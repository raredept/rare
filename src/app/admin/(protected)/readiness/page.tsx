import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import packageJson from "../../../../../package.json";
import { saveOperationalEvidenceAction } from "@/app/admin/(protected)/readiness/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import {
  buildAdminReadiness,
  readinessAreaLabels,
  type ReadinessArea,
  type ReadinessItem,
  type ReadinessReport,
  type ReadinessSeverity,
} from "@/lib/admin-readiness";
import {
  buildOperationalEvidenceReport,
  operationalEvidenceEnvironments,
  operationalEvidenceStatuses,
  type OperationalEvidenceItem,
  type OperationalEvidenceStatus,
} from "@/lib/admin-operational-evidence";
import {
  buildBannerMediaVariantAuditEntries,
  buildProductMediaVariantAuditEntries,
} from "@/lib/media-variant-audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const areaOrder: ReadinessArea[] = [
  "environment",
  "payments",
  "webhook",
  "checkout",
  "rate-limit",
  "storage",
  "media",
  "evidence",
  "shipping",
  "catalog",
  "seo",
  "security",
  "documentation",
  "deploy",
];

type AdminReadinessPageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function AdminReadinessPage({ searchParams }: AdminReadinessPageProps = {}) {
  const params = (await searchParams) ?? {};
  const [settings, products, categories, banners, operationalEvidenceRows] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { id: "store" },
      select: {
        shippingMode: true,
        originCep: true,
        fixedShippingInCents: true,
        manualShippingInCents: true,
      },
    }),
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        active: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        images: {
          orderBy: { sortOrder: "asc" },
          select: { url: true, alt: true, sortOrder: true },
        },
        variants: {
          select: { active: true, stock: true, reservedStock: true },
        },
      },
    }),
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        _count: {
          select: {
            products: true,
            subcategoryProducts: true,
          },
        },
      },
    }),
    prisma.homeBannerSlide.findMany({
      select: {
        id: true,
        title: true,
        active: true,
        sortOrder: true,
        imageUrl: true,
        mobileImageUrl: true,
      },
    }),
    prisma.operationalEvidence.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        key: true,
        status: true,
        environment: true,
        checkedAt: true,
        checkedByLabel: true,
        notes: true,
        evidenceReference: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  const operationalEvidenceReport = buildOperationalEvidenceReport(operationalEvidenceRows);

  const report = buildAdminReadiness({
    settings,
    products,
    categories,
    mediaAuditEntries: [
      ...buildProductMediaVariantAuditEntries(products),
      ...buildBannerMediaVariantAuditEntries(banners),
    ],
    operationalEvidenceRows,
    documentation: getDocumentationStatus(),
  });
  const groupedItems = groupReadinessItems(report.items);

  return (
    <div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">Prontidão de Venda</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-neutral-500">
            Esta tela é informativa: não altera configurações, não chama checkout, não cria pedidos e nunca exibe secrets.
          </p>
        </div>
        <Link
          href="/admin"
          className="w-fit rounded-lg border border-neutral-300 px-4 py-2 text-sm font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
        >
          Voltar ao dashboard
        </Link>
      </div>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <StatusBadge report={report} />
            <h2 className="mt-4 text-xl font-black text-neutral-950">{report.summaryLabel}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-neutral-500">{report.summaryDescription}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Counter label="OK" value={report.counts.ok} tone="ok" />
            <Counter label="Warnings" value={report.counts.warning} tone="warning" />
            <Counter label="Bloqueios" value={report.counts.blocked} tone="blocked" />
            <Counter label="Dependem do cliente" value={report.clientActionCount} tone="info" />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-950 p-5 text-white">
        <h2 className="text-lg font-black">Ações úteis</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <CommandLine command="npm run smoke -- https://raredept.com.br" description="Valida rotas públicas, headers, 404s e health depois do deploy." />
          <CommandLine command="npm run checkout:smoke" description="Executa o guard seguro antes de qualquer homologação Stripe test mode." />
          <CommandLine command="npm run media:variants:audit" description="Lista mídias legadas sem variantes, sem upload, sem R2 write e sem rede externa por padrão." />
        </div>
      </section>

      <OperationalEvidenceSection
        error={params.error}
        report={operationalEvidenceReport}
        success={params.success}
      />

      <div className="mt-6 space-y-6">
        {groupedItems.map(([area, items]) => (
          <section key={area} className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-black text-neutral-950">{readinessAreaLabels[area]}</h2>
              <span className="w-fit rounded-lg border border-neutral-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-neutral-600">
                {items.length} item(ns)
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {items.map((item) => (
                <ReadinessItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function OperationalEvidenceSection({
  error,
  report,
  success,
}: {
  error?: string;
  report: ReturnType<typeof buildOperationalEvidenceReport>;
  success?: string;
}) {
  return (
    <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-neutral-950">Evidências operacionais</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-neutral-500">
            Configuração presente não significa homologação concluída. Esta seção registra evidências manuais e sanitizadas antes da venda aberta.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <EvidenceCounter label="Aprovadas" value={report.passed} tone="ok" />
          <EvidenceCounter label="Pendentes" value={report.pending} tone="warning" />
          <EvidenceCounter label="Bloqueios" value={report.openSalesBlockedCount} tone="blocked" />
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700" role="alert">
          {error}
        </div>
      ) : null}
      {success === "evidence-saved" ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
          Evidência salva.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        {report.items.map((item) => (
          <OperationalEvidenceCard key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}

function EvidenceCounter({ label, value, tone }: { label: string; value: number; tone: ReadinessSeverity }) {
  const classes = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    blocked: "border-red-200 bg-red-50 text-red-700",
    info: "border-neutral-200 bg-neutral-50 text-neutral-700",
  }[tone];

  return (
    <div className={`min-w-28 rounded-lg border px-3 py-2 ${classes}`}>
      <p className="text-[10px] font-black uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function OperationalEvidenceCard({ item }: { item: OperationalEvidenceItem }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceStatusBadge status={item.status} />
            <span className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-neutral-600">
              {item.environment}
            </span>
            {item.missingForOpenSales ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-700">
                Bloqueia venda aberta
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-black text-neutral-950">{item.title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-neutral-600">{item.description}</p>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <EvidenceField label="Última evidência" value={formatEvidenceDate(item.checkedAt)} />
            <EvidenceField label="Responsável" value={item.checkedByLabel ?? "Não informado"} />
            <EvidenceField label="Referência" value={item.evidenceReference ?? "Não informada"} />
            <EvidenceField label="Documento" value={item.docsPath} code />
          </div>
          {item.notes ? (
            <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm font-semibold leading-6 text-neutral-700">
              {item.notes}
            </div>
          ) : null}
          <p className="mt-3 text-xs font-bold leading-5 text-neutral-500">{item.recommendedAction}</p>
        </div>

        <form action={saveOperationalEvidenceAction} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <input type="hidden" name="key" value={item.key} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Status</span>
              <select name="status" defaultValue={item.status} className="admin-input">
                {operationalEvidenceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getEvidenceStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Ambiente</span>
              <select name="environment" defaultValue={item.environment} className="admin-input">
                {operationalEvidenceEnvironments.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Responsável/label</span>
            <input name="checkedByLabel" defaultValue={item.checkedByLabel ?? ""} maxLength={80} className="admin-input" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Referência segura</span>
            <input
              name="evidenceReference"
              defaultValue={item.evidenceReference ?? ""}
              maxLength={180}
              placeholder="Ex.: Vercel logs 2026-06-06 03:00"
              className="admin-input"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Observação sanitizada</span>
            <textarea name="notes" defaultValue={item.notes ?? ""} rows={3} maxLength={500} className="admin-input" />
          </label>
          <p className="text-xs font-semibold leading-5 text-neutral-500">
            Não salve secrets, tokens, URLs assinadas, CPF, e-mail real, cartão, payload Stripe/webhook ou dados pessoais.
          </p>
          <AdminSubmitButton
            idleLabel="Salvar evidência"
            pendingLabel="Salvando..."
            className="h-10 w-full rounded-lg bg-black px-4 text-xs font-black uppercase tracking-wide text-white"
          />
        </form>
      </div>
    </article>
  );
}

function EvidenceField({ code = false, label, value }: { code?: boolean; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-neutral-500">{label}</p>
      {code ? (
        <code className="mt-1 block break-words text-xs font-black text-neutral-700">{value}</code>
      ) : (
        <p className="mt-1 break-words font-semibold leading-6 text-neutral-700">{value}</p>
      )}
    </div>
  );
}

function formatEvidenceDate(value: Date | null) {
  if (!value) return "Pendente";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function getEvidenceStatusLabel(status: OperationalEvidenceStatus) {
  const labels: Record<OperationalEvidenceStatus, string> = {
    pending: "Pendente",
    passed: "Aprovado",
    failed: "Falhou",
    not_applicable: "Não aplicável",
  };
  return labels[status];
}

function EvidenceStatusBadge({ status }: { status: OperationalEvidenceStatus }) {
  const tone: Record<OperationalEvidenceStatus, string> = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    passed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    failed: "border-red-200 bg-red-50 text-red-700",
    not_applicable: "border-neutral-200 bg-white text-neutral-600",
  };

  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${tone[status]}`}>
      {getEvidenceStatusLabel(status)}
    </span>
  );
}

function getDocumentationStatus() {
  const scripts = packageJson.scripts as Record<string, string | undefined>;

  return {
    vercelEnvChecklistExists: existsSync(path.join(process.cwd(), "docs", "vercel-env-checklist.md")),
    clientHandoffExists: existsSync(path.join(process.cwd(), "docs", "client-handoff.md")),
    checkoutSmokeTestExists: existsSync(path.join(process.cwd(), "docs", "checkout-smoke-test.md")),
    smokeScriptExists: Boolean(scripts.smoke),
    checkoutSmokeScriptExists: Boolean(scripts["checkout:smoke"]),
  };
}

function groupReadinessItems(items: ReadinessItem[]) {
  return areaOrder
    .map((area) => [area, items.filter((item) => item.area === area)] as const)
    .filter(([, areaItems]) => areaItems.length > 0);
}

function StatusBadge({ report }: { report: ReadinessReport }) {
  const classes = report.finalStatus.includes("blocked")
    ? "border-red-200 bg-red-50 text-red-700"
    : report.finalStatus === "ready_for_limited_production"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}>{report.summaryLabel}</span>;
}

function Counter({ label, value, tone }: { label: string; value: number; tone: ReadinessSeverity }) {
  const classes = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    blocked: "border-red-200 bg-red-50 text-red-700",
    info: "border-neutral-200 bg-neutral-50 text-neutral-700",
  }[tone];

  return (
    <div className={`min-w-32 rounded-lg border p-4 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function CommandLine({ command, description }: { command: string; description: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-black p-4">
      <code className="text-sm font-black text-white">{command}</code>
      <p className="mt-2 text-xs font-semibold leading-5 text-neutral-400">{description}</p>
    </div>
  );
}

function ReadinessItemCard({ item }: { item: ReadinessItem }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={item.severity} />
            {item.dependsOnClient ? (
              <span className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-neutral-600">
                Depende do cliente
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-black text-neutral-950">{item.title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-neutral-600">{item.description}</p>
        </div>
        {item.adminHref ? (
          <Link
            href={item.adminHref}
            className="w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
          >
            Abrir no Admin
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Impacto</p>
          <p className="mt-1 font-semibold leading-6 text-neutral-700">{item.impact}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Ação recomendada</p>
          <p className="mt-1 font-semibold leading-6 text-neutral-700">{item.recommendedAction}</p>
        </div>
      </div>

      {item.docsPath ? (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-black text-neutral-600">
          Documento: <code>{item.docsPath}</code>
        </div>
      ) : null}
    </article>
  );
}

function SeverityBadge({ severity }: { severity: ReadinessSeverity }) {
  const labels: Record<ReadinessSeverity, string> = {
    ok: "OK",
    warning: "WARNING",
    blocked: "BLOQUEIO",
    info: "INFO",
  };
  const classes: Record<ReadinessSeverity, string> = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    blocked: "border-red-200 bg-red-50 text-red-700",
    info: "border-neutral-200 bg-white text-neutral-600",
  };

  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${classes[severity]}`}>{labels[severity]}</span>;
}
