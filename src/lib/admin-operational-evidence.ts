import { z } from "zod";

export const operationalEvidenceKeys = [
  "redis_shared_health",
  "public_smoke",
  "stripe_test_payment",
  "stripe_webhook_signed",
  "order_paid_admin",
  "inventory_reserve_sale_release",
  "inventory_expiration_release",
  "expired_inventory_cron",
  "admin_r2_upload",
  "checkout_enabled_decision",
  "limited_production_approval",
  "open_sales_approval",
] as const;

export const operationalEvidenceStatuses = ["pending", "passed", "failed", "not_applicable"] as const;
export const operationalEvidenceEnvironments = ["local", "staging", "production"] as const;

export type OperationalEvidenceKey = (typeof operationalEvidenceKeys)[number];
export type OperationalEvidenceStatus = (typeof operationalEvidenceStatuses)[number];
export type OperationalEvidenceEnvironment = (typeof operationalEvidenceEnvironments)[number];

export type OperationalEvidenceDefinition = {
  key: OperationalEvidenceKey;
  title: string;
  description: string;
  defaultEnvironment: OperationalEvidenceEnvironment;
  recommendedAction: string;
  docsPath: string;
  blocksOpenSales: boolean;
};

export type StoredOperationalEvidence = {
  key: string;
  status: string;
  environment: string;
  checkedAt: Date | null;
  checkedByLabel: string | null;
  notes: string | null;
  evidenceReference: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OperationalEvidenceItem = OperationalEvidenceDefinition & {
  status: OperationalEvidenceStatus;
  environment: OperationalEvidenceEnvironment;
  checkedAt: Date | null;
  checkedByLabel: string | null;
  notes: string | null;
  evidenceReference: string | null;
  updatedAt: Date | null;
  satisfiedForOpenSales: boolean;
  missingForOpenSales: boolean;
};

export type OperationalEvidenceReport = {
  items: OperationalEvidenceItem[];
  total: number;
  passed: number;
  failed: number;
  pending: number;
  notApplicable: number;
  openSalesBlockedCount: number;
  openSalesReady: boolean;
};

export type OperationalEvidenceInput = {
  key: OperationalEvidenceKey;
  status: OperationalEvidenceStatus;
  environment: OperationalEvidenceEnvironment;
  checkedByLabel?: string;
  notes?: string;
  evidenceReference?: string;
};

type SensitivePattern = {
  label: string;
  pattern: RegExp;
};

const sensitivePatterns: SensitivePattern[] = [
  { label: "Stripe secret key", pattern: /\bsk_(?:live|test)_[A-Za-z0-9_]+/i },
  { label: "Stripe restricted key", pattern: /\brk_(?:live|test)_[A-Za-z0-9_]+/i },
  { label: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9_]+/i },
  { label: "database URL", pattern: /\bDATABASE_URL\b/i },
  { label: "database URL", pattern: /\bpostgres(?:ql)?:\/\/\S+/i },
  { label: "Redis token", pattern: /\bUPSTASH_REDIS_REST_TOKEN\b/i },
  { label: "R2 secret", pattern: /\bR2_SECRET(?:_ACCESS_KEY)?\b/i },
  { label: "Bearer token", pattern: /\bBearer\s+\S+/i },
  { label: "authorization header", pattern: /\bAuthorization\b/i },
  { label: "private key", pattern: /\bPRIVATE_KEY\b/i },
  { label: "signed URL", pattern: /\bX-Amz-[A-Za-z0-9_-]+=/i },
  { label: "signed URL", pattern: /[?&](?:token|signature|signed|policy|credential)=/i },
  { label: "CPF", pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/ },
  { label: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
];

const optionalSafeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => normalizeOperationalEvidenceText(value));

export const expectedOperationalEvidence: OperationalEvidenceDefinition[] = [
  {
    key: "redis_shared_health",
    title: "Redis/Upstash compartilhado validado",
    description: "Health sem warning de rate limit em memoria no ambiente de producao.",
    defaultEnvironment: "production",
    recommendedAction: "Validar /api/health depois do redeploy com RATE_LIMIT_DRIVER=redis.",
    docsPath: "docs/vercel-env-checklist.md",
    blocksOpenSales: true,
  },
  {
    key: "public_smoke",
    title: "Smoke publico sem warnings criticos",
    description: "Smoke publico executado no dominio correto com 0 FAIL e warnings aceitos.",
    defaultEnvironment: "production",
    recommendedAction: "Rodar npm run smoke -- https://raredept.com.br depois do deploy oficial.",
    docsPath: "docs/client-handoff.md",
    blocksOpenSales: true,
  },
  {
    key: "stripe_test_payment",
    title: "Stripe test payment aprovado",
    description: "Fluxo test mode validado sem chave live, cartao real ou banco de producao.",
    defaultEnvironment: "staging",
    recommendedAction: "Executar o runbook Stripe test mode com banco isolado.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: true,
  },
  {
    key: "stripe_webhook_signed",
    title: "Webhook assinado aprovado",
    description: "Webhook test assinado confirmou eventos sem expor whsec ou payload bruto.",
    defaultEnvironment: "staging",
    recommendedAction: "Validar assinatura do webhook test no Stripe Dashboard e no app.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: true,
  },
  {
    key: "order_paid_admin",
    title: "Pedido pago conferido no Admin",
    description: "Pedido test pago apareceu no Admin com status e totais coerentes.",
    defaultEnvironment: "staging",
    recommendedAction: "Conferir o pedido test no Admin sem registrar dados pessoais reais.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: true,
  },
  {
    key: "inventory_reserve_sale_release",
    title: "Estoque e reserva validados",
    description: "Reserva, baixa por pagamento e movimentos de inventario foram conferidos.",
    defaultEnvironment: "staging",
    recommendedAction: "Validar movimentos reserve/sale em pedido test mode.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: true,
  },
  {
    key: "inventory_expiration_release",
    title: "Expiracao/cancelamento liberou reserva",
    description: "Falha, expiracao ou cancelamento de checkout liberou estoque reservado.",
    defaultEnvironment: "staging",
    recommendedAction: "Confirmar movimento release em pedido expirado/cancelado de teste.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: true,
  },
  {
    key: "expired_inventory_cron",
    title: "Cron de reservas validada",
    description: "Logs da Vercel ou execucao controlada comprovaram a liberacao de reservas expiradas.",
    defaultEnvironment: "staging",
    recommendedAction: "Validar logs da cron protegida sem chamar a rota em producao sem autorizacao.",
    docsPath: "docs/client-handoff.md",
    blocksOpenSales: true,
  },
  {
    key: "admin_r2_upload",
    title: "Upload Admin/R2 validado",
    description: "Upload autenticado pelo Admin persistiu no R2 e renderizou no storefront.",
    defaultEnvironment: "staging",
    recommendedAction: "Executar upload de fixture em produto/banner de staging.",
    docsPath: "docs/media-optimization.md",
    blocksOpenSales: true,
  },
  {
    key: "checkout_enabled_decision",
    title: "Decisao de CHECKOUT_ENABLED registrada",
    description: "Cliente decidiu conscientemente quando habilitar checkout em producao.",
    defaultEnvironment: "production",
    recommendedAction: "Registrar decisao antes de manter CHECKOUT_ENABLED=true em Production.",
    docsPath: "docs/client-handoff.md",
    blocksOpenSales: true,
  },
  {
    key: "limited_production_approval",
    title: "Autorizacao de producao limitada",
    description: "Cliente autorizou producao limitada apos evidencias criticas.",
    defaultEnvironment: "production",
    recommendedAction: "Registrar aprovacao textual, sem dados pessoais ou secrets.",
    docsPath: "docs/full-project-readiness-audit.md",
    blocksOpenSales: true,
  },
  {
    key: "open_sales_approval",
    title: "Autorizacao de venda aberta",
    description: "Cliente autorizou venda aberta apos producao limitada e monitoramento.",
    defaultEnvironment: "production",
    recommendedAction: "Registrar aprovacao final antes de campanha ou trafego aberto.",
    docsPath: "docs/full-project-readiness-audit.md",
    blocksOpenSales: true,
  },
];

export const operationalEvidenceInputSchema = z
  .object({
    key: z.enum(operationalEvidenceKeys),
    status: z.enum(operationalEvidenceStatuses),
    environment: z.enum(operationalEvidenceEnvironments),
    checkedByLabel: optionalSafeText(80),
    notes: optionalSafeText(500),
    evidenceReference: optionalSafeText(180),
  })
  .superRefine((value, context) => {
    for (const field of ["checkedByLabel", "notes", "evidenceReference"] as const) {
      const sensitiveMatch = findSensitiveOperationalEvidencePattern(value[field]);
      if (sensitiveMatch) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `Remova ${sensitiveMatch.label} antes de salvar a evidencia.`,
        });
      }
    }
  });

function normalizeOperationalEvidenceText(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function isOperationalEvidenceStatus(value: string): value is OperationalEvidenceStatus {
  return operationalEvidenceStatuses.includes(value as OperationalEvidenceStatus);
}

function isOperationalEvidenceEnvironment(value: string): value is OperationalEvidenceEnvironment {
  return operationalEvidenceEnvironments.includes(value as OperationalEvidenceEnvironment);
}

function findDefinition(key: string) {
  return expectedOperationalEvidence.find((definition) => definition.key === key);
}

export function findSensitiveOperationalEvidencePattern(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return sensitivePatterns.find((candidate) => candidate.pattern.test(normalized)) ?? null;
}

export function sanitizeOperationalEvidenceDisplayText(value: string | null | undefined) {
  let sanitized = normalizeOperationalEvidenceText(value ?? undefined);
  if (!sanitized) return null;

  for (const sensitivePattern of sensitivePatterns) {
    sanitized = sanitized.replace(sensitivePattern.pattern, "[removido]");
  }

  return sanitized;
}

export function parseOperationalEvidenceInput(input: unknown) {
  return operationalEvidenceInputSchema.safeParse(input);
}

export function buildOperationalEvidenceReport(rows: StoredOperationalEvidence[] = []): OperationalEvidenceReport {
  const latestByKey = new Map<string, StoredOperationalEvidence>();

  for (const row of rows) {
    if (!findDefinition(row.key)) continue;
    const current = latestByKey.get(row.key);
    if (!current || row.updatedAt > current.updatedAt) {
      latestByKey.set(row.key, row);
    }
  }

  const items = expectedOperationalEvidence.map((definition): OperationalEvidenceItem => {
    const row = latestByKey.get(definition.key);
    const status = row && isOperationalEvidenceStatus(row.status) ? row.status : "pending";
    const environment = row && isOperationalEvidenceEnvironment(row.environment) ? row.environment : definition.defaultEnvironment;
    const satisfiedForOpenSales = status === "passed" || status === "not_applicable";
    const missingForOpenSales = definition.blocksOpenSales && !satisfiedForOpenSales;

    return {
      ...definition,
      status,
      environment,
      checkedAt: row?.checkedAt ?? null,
      checkedByLabel: sanitizeOperationalEvidenceDisplayText(row?.checkedByLabel),
      notes: sanitizeOperationalEvidenceDisplayText(row?.notes),
      evidenceReference: sanitizeOperationalEvidenceDisplayText(row?.evidenceReference),
      updatedAt: row?.updatedAt ?? null,
      satisfiedForOpenSales,
      missingForOpenSales,
    };
  });

  const passed = items.filter((item) => item.status === "passed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const pending = items.filter((item) => item.status === "pending").length;
  const notApplicable = items.filter((item) => item.status === "not_applicable").length;
  const openSalesBlockedCount = items.filter((item) => item.missingForOpenSales).length;

  return {
    items,
    total: items.length,
    passed,
    failed,
    pending,
    notApplicable,
    openSalesBlockedCount,
    openSalesReady: openSalesBlockedCount === 0,
  };
}
