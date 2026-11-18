"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { parseAdminEntityId } from "@/lib/admin-action-input";
import { recordAdminAudit } from "@/lib/admin-audit";
import {
  assistantConfigAuditView,
  assistantConfigSchema,
  assistantEntryAuditView,
  assistantEntrySchema,
  ASSISTANT_LIMITS,
  isSafeAssistantHref,
  parseAssistantKeywords,
} from "@/lib/assistant/config";
import { getAssistantEngine } from "@/lib/assistant/engine";
import { invalidateAssistantCache, readActiveAssistantEntries, readAssistantConfig } from "@/lib/assistant/store";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin → Sistema → Assistente Virtual. SYSTEM_ADMIN only ("system.assistant"; the legacy ADMIN role
// and SELLER_ADMIN do not hold it). Every action authorizes first, validates on the server, writes
// in a transaction with a sanitized audit entry, and clears the assistant cache. Entries are never
// hard-deleted: they are deactivated.

const PAGE = "/admin/assistant";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function integer(formData: FormData, key: string) {
  const raw = field(formData, key).trim();
  if (!raw) return 0;
  return /^-?\d{1,6}$/.test(raw) ? Number(raw) : Number.NaN;
}

function done(query: string, anchor = ""): never {
  redirect(withAdminActionRefresh(`${PAGE}?${query}`) + anchor);
}

function actorOf(admin: { id: string; username: string | null; email: string }) {
  return { id: admin.id, label: admin.username ?? admin.email };
}

function afterMutation() {
  invalidateAssistantCache();
  revalidatePath(PAGE);
}

export async function saveAssistantConfigAction(formData: FormData) {
  const admin = await requireAdmin("system.assistant");
  const href = field(formData, "supportCtaHref");
  if (!isSafeAssistantHref(href)) done("error=assistant-href-invalid", "#configuracao");
  const parsed = assistantConfigSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    displayName: field(formData, "displayName"),
    welcomeMessage: field(formData, "welcomeMessage"),
    inputPlaceholder: field(formData, "inputPlaceholder"),
    fallbackMessage: field(formData, "fallbackMessage"),
    supportCtaLabel: field(formData, "supportCtaLabel"),
    supportCtaHref: href,
  });
  if (!parsed.success) done("error=assistant-validation", "#configuracao");
  const value = parsed.data;

  const outcome = await prisma.$transaction(async (tx) => {
    if (value.enabled && (await tx.virtualAssistantEntry.count({ where: { active: true } })) === 0) return "empty" as const;
    const before = await readAssistantConfig(tx);
    await tx.virtualAssistantConfig.upsert({ where: { id: "store" }, update: value, create: { id: "store", ...value } });
    await recordAdminAudit(tx, {
      actor: actorOf(admin),
      action: "assistant.config_updated",
      entityType: "VirtualAssistantConfig",
      entityId: "store",
      before: assistantConfigAuditView(before),
      after: assistantConfigAuditView(value),
    });
    return "saved" as const;
  });
  if (outcome === "empty") done("error=assistant-enable-empty", "#configuracao");

  afterMutation();
  // The storefront layout renders the widget's copy: refresh every store page.
  revalidatePath("/", "layout");
  done("success=assistant-config-saved", "#configuracao");
}

function parseEntry(formData: FormData) {
  const keywords = parseAssistantKeywords(field(formData, "keywords"));
  return assistantEntrySchema.safeParse({
    question: field(formData, "question"),
    answer: field(formData, "answer"),
    category: field(formData, "category"),
    keywords,
    active: formData.get("active") === "on",
    priority: integer(formData, "priority"),
    sortOrder: integer(formData, "sortOrder"),
  });
}

export async function createAssistantEntryAction(formData: FormData) {
  const admin = await requireAdmin("system.assistant");
  const parsed = parseEntry(formData);
  if (!parsed.success) done("error=assistant-entry-invalid", "#nova-pergunta");
  const value = parsed.data;

  await prisma.$transaction(async (tx) => {
    const created = await tx.virtualAssistantEntry.create({
      data: { ...value, createdById: admin.id, updatedById: admin.id },
      select: { id: true },
    });
    await recordAdminAudit(tx, {
      actor: actorOf(admin),
      action: "assistant.entry_created",
      entityType: "VirtualAssistantEntry",
      entityId: created.id,
      after: assistantEntryAuditView(value),
    });
  });

  afterMutation();
  done("success=assistant-entry-created", "#perguntas");
}

export async function updateAssistantEntryAction(formData: FormData) {
  const admin = await requireAdmin("system.assistant");
  const id = parseAdminEntityId(formData.get("id"));
  const version = field(formData, "version");
  if (!id) done("error=assistant-entry-not-found", "#perguntas");
  const parsed = parseEntry(formData);
  if (!parsed.success) done("error=assistant-entry-invalid", `#pergunta-${id}`);
  const value = parsed.data;

  const outcome = await prisma.$transaction(async (tx) => {
    const before = await tx.virtualAssistantEntry.findUnique({ where: { id } });
    if (!before) return "missing" as const;
    // Optimistic concurrency: the form carries the updatedAt it was rendered with.
    if (version && before.updatedAt.toISOString() !== version) return "conflict" as const;
    const updated = await tx.virtualAssistantEntry.updateMany({
      where: { id, updatedAt: before.updatedAt },
      data: { ...value, updatedById: admin.id },
    });
    if (updated.count !== 1) return "conflict" as const;
    await recordAdminAudit(tx, {
      actor: actorOf(admin),
      action: "assistant.entry_updated",
      entityType: "VirtualAssistantEntry",
      entityId: id,
      before: assistantEntryAuditView(before),
      after: assistantEntryAuditView(value),
    });
    return "saved" as const;
  });
  if (outcome === "missing") done("error=assistant-entry-not-found", "#perguntas");
  if (outcome === "conflict") done("error=assistant-entry-conflict", `#pergunta-${id}`);

  afterMutation();
  done("success=assistant-entry-saved", `#pergunta-${id}`);
}

export async function setAssistantEntryActiveAction(formData: FormData) {
  const admin = await requireAdmin("system.assistant");
  const id = parseAdminEntityId(formData.get("id"));
  const active = field(formData, "active") === "true";
  if (!id) done("error=assistant-entry-not-found", "#perguntas");

  const outcome = await prisma.$transaction(async (tx) => {
    const before = await tx.virtualAssistantEntry.findUnique({ where: { id }, select: { active: true } });
    if (!before) return "missing" as const;
    if (before.active === active) return "unchanged" as const;
    await tx.virtualAssistantEntry.update({ where: { id }, data: { active, updatedById: admin.id } });
    await recordAdminAudit(tx, {
      actor: actorOf(admin),
      action: active ? "assistant.entry_activated" : "assistant.entry_deactivated",
      entityType: "VirtualAssistantEntry",
      entityId: id,
      before: { active: before.active },
      after: { active },
    });
    return "saved" as const;
  });
  if (outcome === "missing") done("error=assistant-entry-not-found", "#perguntas");

  afterMutation();
  done(`success=${active ? "assistant-entry-activated" : "assistant-entry-deactivated"}`, `#pergunta-${id}`);
}

export type AssistantPreviewState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | {
      status: "done";
      question: string;
      fallback: boolean;
      answer: string;
      confidence: number;
      entry: { id: string; question: string; category: string | null } | null;
      closest: { question: string; score: number } | null;
      runnerUp: { question: string; score: number } | null;
      cta: { label: string; href: string } | null;
      enabled: boolean;
      activeEntries: number;
    };

/**
 * "Testar Assistente": runs the SAME engine as the storefront, on fresh (uncached) data. The test
 * question is answered and dropped: it is not stored, logged or audited.
 */
export async function previewAssistantAction(_previous: AssistantPreviewState, formData: FormData): Promise<AssistantPreviewState> {
  await requireAdmin("system.assistant");
  const question = field(formData, "question").replace(/\s+/g, " ").trim();
  if (!question || question.length > ASSISTANT_LIMITS.message) {
    return { status: "invalid", message: `Digite uma pergunta de até ${ASSISTANT_LIMITS.message} caracteres.` };
  }
  const [config, entries] = await Promise.all([readAssistantConfig(), readActiveAssistantEntries()]);
  const result = getAssistantEngine().answer({ message: question, entries });
  if (result.kind === "answer") {
    return {
      status: "done",
      question,
      fallback: false,
      answer: result.text,
      confidence: result.confidence,
      entry: { id: result.entry.id, question: result.entry.question, category: result.entry.category },
      closest: null,
      runnerUp: result.runnerUp ? { question: result.runnerUp.entry.question, score: result.runnerUp.score } : null,
      cta: null,
      enabled: config.enabled,
      activeEntries: entries.length,
    };
  }
  return {
    status: "done",
    question,
    fallback: true,
    answer: config.fallbackMessage,
    confidence: result.confidence,
    entry: null,
    closest: result.closest ? { question: result.closest.entry.question, score: result.closest.score } : null,
    runnerUp: null,
    cta: { label: config.supportCtaLabel, href: config.supportCtaHref },
    enabled: config.enabled,
    activeEntries: entries.length,
  };
}
