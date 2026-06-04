import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import packageJson from "../../../../../package.json";
import {
  buildAdminReadiness,
  readinessAreaLabels,
  type ReadinessArea,
  type ReadinessItem,
  type ReadinessReport,
  type ReadinessSeverity,
} from "@/lib/admin-readiness";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const areaOrder: ReadinessArea[] = [
  "environment",
  "payments",
  "webhook",
  "checkout",
  "rate-limit",
  "storage",
  "shipping",
  "catalog",
  "seo",
  "security",
  "documentation",
  "deploy",
];

export default async function AdminReadinessPage() {
  const [settings, products, categories] = await Promise.all([
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
          select: { url: true },
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
  ]);

  const report = buildAdminReadiness({
    settings,
    products,
    categories,
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
        </div>
      </section>

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
