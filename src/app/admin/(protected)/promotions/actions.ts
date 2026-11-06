"use server";

import { redirect } from "next/navigation";
import type { Prisma, PromotionStatus } from "@prisma/client";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { recordAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUniqueViolationOn } from "@/lib/prisma-errors";
import { getActivationIssues } from "@/lib/promotions/admin";
import { getEffectivePromotionStatus } from "@/lib/promotions/engine";
import { parsePromotionForm, slugifyPromotionCode, type PromotionInput } from "@/lib/promotions/validation";

export type PromotionFormState = { errors?: string[] };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function readId(formData: FormData, key = "promotionId") {
  const value = formData.get(key);
  return typeof value === "string" && ID_PATTERN.test(value) ? value : null;
}

function actorOf(admin: { id: string; username: string | null; email: string }) {
  return { id: admin.id, label: admin.username ?? admin.email };
}

/** Business fields recorded in the audit log (no customer data, nothing secret). */
function auditView(promotion: {
  name: string; slug: string; status: string; type: string; value: number | null; scope: string; startsAt: Date | null; endsAt: Date | null;
  priority: number; homepageFeatured: boolean; productIds?: string[]; categoryIds?: string[];
}) {
  return {
    name: promotion.name, code: promotion.slug, status: promotion.status, type: promotion.type, value: promotion.value, scope: promotion.scope,
    startsAt: promotion.startsAt, endsAt: promotion.endsAt, priority: promotion.priority, homepageFeatured: promotion.homepageFeatured,
    productIds: promotion.productIds, categoryIds: promotion.categoryIds,
  };
}

async function findInvalidTargets(input: PromotionInput) {
  const [products, categories] = await Promise.all([
    input.productIds.length ? prisma.product.count({ where: { id: { in: input.productIds } } }) : 0,
    input.categoryIds.length ? prisma.category.count({ where: { id: { in: input.categoryIds } } }) : 0,
  ]);
  const errors: string[] = [];
  if (products !== input.productIds.length) errors.push("Há produto inexistente na seleção.");
  if (categories !== input.categoryIds.length) errors.push("Há categoria inexistente na seleção.");
  return errors;
}

function promotionData(input: PromotionInput) {
  // Allowlist: only these columns are written from the form. Status, ids and audit fields are not.
  return {
    name: input.name, slug: input.slug, type: input.type, value: input.value, scope: input.scope, startsAt: input.startsAt, endsAt: input.endsAt,
    priority: input.priority, homepageFeatured: input.homepageFeatured, badgeText: input.badgeText, headline: input.headline,
    subheadline: input.subheadline, ctaLabel: input.ctaLabel, ctaHref: input.ctaHref, bannerImageUrl: input.bannerImageUrl,
    bannerMobileImageUrl: input.bannerMobileImageUrl, bannerAlt: input.bannerAlt,
  } satisfies Prisma.PromotionUncheckedUpdateInput;
}

export async function savePromotionAction(_state: PromotionFormState, formData: FormData): Promise<PromotionFormState> {
  const admin = await requireAdmin();
  const now = new Date();
  const promotionId = readId(formData);
  const existing = promotionId
    ? await prisma.promotion.findUnique({ where: { id: promotionId }, include: { products: { select: { productId: true } }, categories: { select: { categoryId: true } } } })
    : null;
  if (promotionId && !existing) return { errors: ["Promoção não encontrada."] };
  if (existing?.status === "ENDED") return { errors: ["Promoção encerrada não pode ser editada. Use Duplicar."] };

  const live = existing ? getEffectivePromotionStatus(existing, now) : "DRAFT";
  const parsed = parsePromotionForm(formData, { requireComplete: live === "ACTIVE" || live === "SCHEDULED", now });
  if (!parsed.ok) return { errors: parsed.errors };
  const input = parsed.input;
  const targetErrors = await findInvalidTargets(input);
  if (targetErrors.length) return { errors: targetErrors };

  let savedId: string;
  try {
    savedId = await prisma.$transaction(async (tx) => {
      if (!existing) {
        const created = await tx.promotion.create({
          data: {
            ...promotionData(input),
            status: "DRAFT",
            createdById: admin.id,
            updatedById: admin.id,
            products: { create: input.productIds.map((productId) => ({ productId })) },
            categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
          },
        });
        await recordAdminAudit(tx, { actor: actorOf(admin), action: "promotion.created", entityType: "Promotion", entityId: created.id, after: auditView({ ...created, productIds: input.productIds, categoryIds: input.categoryIds }) });
        return created.id;
      }
      await tx.promotionProduct.deleteMany({ where: { promotionId: existing.id } });
      await tx.promotionCategory.deleteMany({ where: { promotionId: existing.id } });
      const updated = await tx.promotion.update({
        where: { id: existing.id },
        data: {
          ...promotionData(input),
          updatedById: admin.id,
          products: { create: input.productIds.map((productId) => ({ productId })) },
          categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });
      await recordAdminAudit(tx, {
        actor: actorOf(admin),
        action: "promotion.updated",
        entityType: "Promotion",
        entityId: existing.id,
        before: auditView({ ...existing, productIds: existing.products.map((item) => item.productId), categoryIds: existing.categories.map((item) => item.categoryId) }),
        after: auditView({ ...updated, productIds: input.productIds, categoryIds: input.categoryIds }),
      });
      return existing.id;
    });
  } catch (error) {
    if (isUniqueViolationOn(error, "slug")) return { errors: ["Já existe uma promoção com este código interno."] };
    console.error("[promotions] save failed", error instanceof Error ? error.name : "unknown");
    return { errors: ["Não foi possível salvar a promoção."] };
  }
  redirect(withAdminActionRefresh(`/admin/promotions/${savedId}?success=${existing ? "promotion-saved" : "promotion-created"}`));
}

const transitions: Record<"activate" | "pause" | "end", { from: PromotionStatus[]; action: string }> = {
  activate: { from: ["DRAFT", "PAUSED", "SCHEDULED"], action: "promotion.activated" },
  pause: { from: ["ACTIVE", "SCHEDULED"], action: "promotion.paused" },
  end: { from: ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED"], action: "promotion.ended" },
};

export async function changePromotionStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const promotionId = readId(formData);
  const intent = formData.get("intent");
  if (!promotionId || (intent !== "activate" && intent !== "pause" && intent !== "end")) {
    redirect(withAdminActionRefresh("/admin/promotions?error=promotion-action-failed"));
  }
  const now = new Date();
  const promotion = await prisma.promotion.findUnique({ where: { id: promotionId }, include: { _count: { select: { products: true, categories: true } } } });
  if (!promotion) redirect(withAdminActionRefresh("/admin/promotions?error=promotion-not-found"));
  const transition = transitions[intent];
  if (!transition.from.includes(promotion.status)) {
    redirect(withAdminActionRefresh(`/admin/promotions/${promotion.id}?error=promotion-invalid-transition`));
  }
  let nextStatus: PromotionStatus;
  if (intent === "activate") {
    const issues = getActivationIssues({ ...promotion, productCount: promotion._count.products, categoryCount: promotion._count.categories }, now);
    if (issues.length) redirect(withAdminActionRefresh(`/admin/promotions/${promotion.id}?error=promotion-incomplete`));
    nextStatus = promotion.startsAt && promotion.startsAt > now ? "SCHEDULED" : "ACTIVE";
  } else {
    nextStatus = intent === "pause" ? "PAUSED" : "ENDED";
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Conditional on the status we validated: a concurrent change makes this a no-op.
    const result = await tx.promotion.updateMany({ where: { id: promotion.id, status: promotion.status }, data: { status: nextStatus, updatedById: admin.id } });
    if (result.count !== 1) return false;
    await recordAdminAudit(tx, {
      actor: actorOf(admin), action: transition.action, entityType: "Promotion", entityId: promotion.id,
      before: { status: promotion.status }, after: { status: nextStatus, startsAt: promotion.startsAt, endsAt: promotion.endsAt },
    });
    return true;
  });
  redirect(withAdminActionRefresh(`/admin/promotions/${promotion.id}?${updated ? `success=promotion-${intent}` : "error=promotion-invalid-transition"}`));
}

export async function duplicatePromotionAction(formData: FormData) {
  const admin = await requireAdmin();
  const promotionId = readId(formData);
  const source = promotionId
    ? await prisma.promotion.findUnique({ where: { id: promotionId }, include: { products: { select: { productId: true } }, categories: { select: { categoryId: true } } } })
    : null;
  if (!source) redirect(withAdminActionRefresh("/admin/promotions?error=promotion-not-found"));

  const copyId = await prisma.$transaction(async (tx) => {
    const base = slugifyPromotionCode(`${source.slug}-copia`).slice(0, 52);
    let slug = base;
    for (let attempt = 2; await tx.promotion.findUnique({ where: { slug }, select: { id: true } }); attempt += 1) slug = `${base}-${attempt}`;
    const copy = await tx.promotion.create({
      data: {
        name: `Cópia de ${source.name}`.slice(0, 120), slug, status: "DRAFT", type: source.type, value: source.value, scope: source.scope,
        startsAt: null, endsAt: null, priority: source.priority, homepageFeatured: false, badgeText: source.badgeText, headline: source.headline,
        subheadline: source.subheadline, ctaLabel: source.ctaLabel, ctaHref: source.ctaHref, bannerImageUrl: source.bannerImageUrl,
        bannerMobileImageUrl: source.bannerMobileImageUrl, bannerAlt: source.bannerAlt, createdById: admin.id, updatedById: admin.id,
        products: { create: source.products.map((item) => ({ productId: item.productId })) },
        categories: { create: source.categories.map((item) => ({ categoryId: item.categoryId })) },
      },
    });
    await recordAdminAudit(tx, { actor: actorOf(admin), action: "promotion.duplicated", entityType: "Promotion", entityId: copy.id, after: { sourceId: source.id, code: copy.slug } });
    return copy.id;
  });
  redirect(withAdminActionRefresh(`/admin/promotions/${copyId}/edit?success=promotion-duplicated`));
}
