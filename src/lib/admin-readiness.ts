import {
  buildCatalogIssues,
  type CatalogIssue,
  type CatalogIssueCategory,
  type CatalogIssueProduct,
} from "@/lib/admin-catalog-issues";
import { isCheckoutEnabled, validateEnvironment } from "@/lib/env";
import { buildMediaVariantAuditReport, type MediaVariantAuditEntry } from "@/lib/media-variant-audit";
import { getRateLimitStatus } from "@/lib/rate-limit-config";
import { getSecurityHeaders } from "@/lib/security-headers";
import { normalizeShippingMode, normalizeShippingProvider } from "@/lib/shipping";
import { getStripeSecretKeyMode } from "@/lib/stripe-smoke-guard";

export type ReadinessSeverity = "ok" | "warning" | "blocked" | "info";

export type ReadinessArea =
  | "deploy"
  | "environment"
  | "checkout"
  | "payments"
  | "webhook"
  | "rate-limit"
  | "storage"
  | "media"
  | "shipping"
  | "catalog"
  | "seo"
  | "security"
  | "documentation";

export type ReadinessFinalStatus =
  | "blocked_for_staging"
  | "ready_for_staging"
  | "blocked_for_open_sales"
  | "ready_for_limited_production"
  | "ready_for_open_sales";

export type ReadinessItem = {
  id: string;
  area: ReadinessArea;
  title: string;
  severity: ReadinessSeverity;
  description: string;
  impact: string;
  recommendedAction: string;
  adminHref?: string;
  docsPath?: string;
  blocksOpenSales: boolean;
  blocksStaging: boolean;
  dependsOnClient: boolean;
};

export type ReadinessCounts = Record<ReadinessSeverity, number>;

export type ReadinessReport = {
  finalStatus: ReadinessFinalStatus;
  summaryLabel: string;
  summaryDescription: string;
  counts: ReadinessCounts;
  stagingReady: boolean;
  openSalesReady: boolean;
  clientActionCount: number;
  items: ReadinessItem[];
};

export type ReadinessStoreSettings = {
  shippingMode: string | null;
  originCep: string | null;
  fixedShippingInCents: number | null;
  manualShippingInCents: number | null;
};

export type ReadinessDocumentationInput = {
  vercelEnvChecklistExists: boolean;
  clientHandoffExists: boolean;
  checkoutSmokeTestExists: boolean;
  smokeScriptExists: boolean;
  checkoutSmokeScriptExists: boolean;
};

export type BuildAdminReadinessInput = {
  env?: Record<string, string | undefined>;
  products: CatalogIssueProduct[];
  categories: CatalogIssueCategory[];
  settings: ReadinessStoreSettings | null;
  documentation?: Partial<ReadinessDocumentationInput>;
  mediaAuditEntries?: MediaVariantAuditEntry[];
};

export const readinessAreaLabels: Record<ReadinessArea, string> = {
  deploy: "Deploy",
  environment: "Ambiente",
  checkout: "Checkout",
  payments: "Pagamentos",
  webhook: "Webhook",
  "rate-limit": "Rate limit",
  storage: "Storage",
  media: "Midia",
  shipping: "Frete",
  catalog: "Catalogo",
  seo: "SEO",
  security: "Seguranca",
  documentation: "Documentacao",
};

const severityOrder: Record<ReadinessSeverity, number> = {
  blocked: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

const defaultDocumentation: ReadinessDocumentationInput = {
  vercelEnvChecklistExists: true,
  clientHandoffExists: true,
  checkoutSmokeTestExists: true,
  smokeScriptExists: true,
  checkoutSmokeScriptExists: true,
};

const placeholderFragments = [
  "replace-with",
  "placeholder",
  "change-me",
  "paste-here",
  "set-this",
  "your-",
  "example.com",
];

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasPlaceholderValue(value: string | undefined) {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) return true;
  return placeholderFragments.some((fragment) => normalized.includes(fragment));
}

function isConfigured(value: string | undefined) {
  return Boolean(clean(value) && !hasPlaceholderValue(value));
}

function isProductionRuntime(env: Record<string, string | undefined>) {
  return clean(env.NODE_ENV)?.toLowerCase() === "production";
}

function getAppEnvironment(env: Record<string, string | undefined>) {
  return clean(env.APP_ENV ?? env.VERCEL_ENV)?.toLowerCase() ?? "not-set";
}

function isProductionSalesEnvironment(env: Record<string, string | undefined>) {
  const appEnv = getAppEnvironment(env);
  return ["production", "prod", "live"].includes(appEnv) || (isProductionRuntime(env) && !["preview", "staging", "stage", "homologacao", "homologation"].includes(appEnv));
}

function isDisabled(value: string | undefined) {
  const normalized = clean(value)?.toLowerCase();
  return Boolean(normalized && ["0", "false", "off", "disabled", "no"].includes(normalized));
}

function addItem(items: ReadinessItem[], item: ReadinessItem) {
  items.push(item);
}

function createCounts(items: ReadinessItem[]): ReadinessCounts {
  return {
    ok: items.filter((item) => item.severity === "ok").length,
    warning: items.filter((item) => item.severity === "warning").length,
    blocked: items.filter((item) => item.severity === "blocked").length,
    info: items.filter((item) => item.severity === "info").length,
  };
}

function createSummary(items: ReadinessItem[]) {
  const stagingReady = !items.some((item) => item.severity === "blocked" && item.blocksStaging);
  const openSalesReady = !items.some((item) => item.severity === "blocked" && item.blocksOpenSales);
  const warningCount = items.filter((item) => item.severity === "warning").length;

  let finalStatus: ReadinessFinalStatus;
  if (!stagingReady) {
    finalStatus = "blocked_for_staging";
  } else if (!openSalesReady) {
    finalStatus = "blocked_for_open_sales";
  } else if (warningCount) {
    finalStatus = "ready_for_limited_production";
  } else {
    finalStatus = "ready_for_open_sales";
  }

  const labels: Record<ReadinessFinalStatus, { label: string; description: string }> = {
    blocked_for_staging: {
      label: "Bloqueado para homologacao",
      description: "Existem bloqueios que impedem uma validacao segura em staging ou local.",
    },
    ready_for_staging: {
      label: "Pronto para homologacao",
      description: "Nao ha bloqueios de staging; ainda valide checkout e configuracoes antes de abrir vendas.",
    },
    blocked_for_open_sales: {
      label: "Pronto para homologacao; bloqueado para venda aberta",
      description: "A loja pode seguir para validacao, mas ainda possui bloqueios antes de venda aberta.",
    },
    ready_for_limited_production: {
      label: "Pronto para producao limitada",
      description: "Nao ha bloqueios criticos, mas ainda existem warnings que pedem acompanhamento.",
    },
    ready_for_open_sales: {
      label: "Pronto para venda aberta",
      description: "Nao ha bloqueios nem warnings operacionais nos sinais avaliados.",
    },
  };

  return {
    finalStatus,
    stagingReady,
    openSalesReady,
    summaryLabel: labels[finalStatus].label,
    summaryDescription: labels[finalStatus].description,
  };
}

function getStripeModeLabel(secretKey: string | undefined) {
  if (!isConfigured(secretKey)) return "missing";
  return getStripeSecretKeyMode(secretKey);
}

function addEnvironmentItems(items: ReadinessItem[], env: Record<string, string | undefined>) {
  const validation = validateEnvironment({ env });
  const environmentErrors = validation.errors.filter(
    (issue) =>
      ![
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STORAGE_DRIVER",
        "R2_ACCOUNT_ID",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_PUBLIC_BASE_URL",
        "RATE_LIMIT_DRIVER",
        "MELHOR_ENVIO_TOKEN",
      ].includes(issue.variable),
  );

  if (environmentErrors.length) {
    addItem(items, {
      id: "environment-required",
      area: "environment",
      title: "Configuracao basica do ambiente",
      severity: "blocked",
      description: `Existem ${environmentErrors.length} configuracao(oes) obrigatoria(s) pendente(s) no ambiente.`,
      impact: "Admin, banco ou URLs canonicas podem falhar sem essa configuracao.",
      recommendedAction: "Configurar as variaveis pendentes na Vercel ou no ambiente isolado correto e fazer redeploy.",
      docsPath: "docs/vercel-env-checklist.md",
      blocksOpenSales: true,
      blocksStaging: true,
      dependsOnClient: true,
    });
    return;
  }

  addItem(items, {
    id: "environment-required",
    area: "environment",
    title: "Configuracao basica do ambiente",
    severity: "ok",
    description: "Banco, URL da aplicacao e sessao do Admin nao apresentam erro critico nos checks sanitizados.",
    impact: "A base minima para operar o Admin esta presente.",
    recommendedAction: "Manter envs separadas entre staging e production.",
    docsPath: "docs/vercel-env-checklist.md",
    blocksOpenSales: false,
    blocksStaging: false,
    dependsOnClient: false,
  });
}

function addRateLimitItems(items: ReadinessItem[], env: Record<string, string | undefined>) {
  const status = getRateLimitStatus(env);
  if (status.shared && status.activeDriver === "redis") {
    addItem(items, {
      id: "rate-limit-shared",
      area: "rate-limit",
      title: "Rate limit compartilhado",
      severity: "ok",
      description: "Rate limit usa driver Redis compartilhado.",
      impact: "Protecao contra abuso fica consistente entre instancias.",
      recommendedAction: "Manter Redis/Upstash ativo e monitorado.",
      docsPath: "docs/rate-limit.md",
      blocksOpenSales: false,
      blocksStaging: false,
      dependsOnClient: false,
    });
    return;
  }

  const production = isProductionRuntime(env);
  addItem(items, {
    id: "rate-limit-shared",
    area: "rate-limit",
    title: "Rate limit compartilhado",
    severity: production ? "blocked" : "warning",
    description: `Driver configurado: ${status.configuredDriver}; driver ativo: ${status.activeDriver}; compartilhado: ${status.shared ? "sim" : "nao"}. Credenciais REST presentes: URL ${status.redisRestUrlConfigured ? "sim" : "nao"}, token ${status.redisRestTokenConfigured ? "sim" : "nao"}.`,
    impact: "Protecao contra abuso fica inconsistente em multiplas instancias quando o driver ativo e memory.",
    recommendedAction: "Configurar RATE_LIMIT_DRIVER=redis e credenciais Redis/Upstash REST na Vercel; depois fazer redeploy.",
    docsPath: "docs/vercel-env-checklist.md",
    blocksOpenSales: production,
    blocksStaging: false,
    dependsOnClient: true,
  });
}

function addCheckoutItems(items: ReadinessItem[], env: Record<string, string | undefined>) {
  const checkoutEnabled = isCheckoutEnabled(env);
  const stripeMode = getStripeModeLabel(env.STRIPE_SECRET_KEY);
  const webhookConfigured = isConfigured(env.STRIPE_WEBHOOK_SECRET);
  const productionSales = isProductionSalesEnvironment(env);

  addItem(items, {
    id: "checkout-enabled",
    area: "checkout",
    title: "Checkout habilitado",
    severity: checkoutEnabled ? "ok" : "blocked",
    description: checkoutEnabled ? "Checkout esta habilitado neste ambiente." : "CHECKOUT_ENABLED esta desabilitado neste ambiente.",
    impact: checkoutEnabled ? "O fluxo pode ser homologado conforme os demais checks." : "Venda aberta nao pode iniciar com checkout desabilitado.",
    recommendedAction: checkoutEnabled
      ? "Executar o smoke de checkout em modo seguro antes de venda aberta."
      : "Habilitar checkout somente no ambiente correto, depois de configurar Stripe e webhook.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: !checkoutEnabled,
    blocksStaging: false,
    dependsOnClient: !checkoutEnabled,
  });

  if (!checkoutEnabled) {
    addItem(items, {
      id: "payments-stripe-mode",
      area: "payments",
      title: "Modo da Stripe",
      severity: "info",
      description: "Checkout desabilitado; a chave Stripe sera exigida antes da homologacao do pagamento.",
      impact: "Nao ha chamada de pagamento enquanto checkout estiver desabilitado.",
      recommendedAction: "Configurar Stripe test mode em staging antes de rodar o smoke de checkout.",
      docsPath: "docs/checkout-smoke-test.md",
      blocksOpenSales: false,
      blocksStaging: false,
      dependsOnClient: true,
    });
    return;
  }

  const stripeSeverity: ReadinessSeverity =
    stripeMode === "missing" || stripeMode === "unknown" || (stripeMode === "live" && !productionSales) || (stripeMode === "test" && productionSales)
      ? "blocked"
      : "ok";
  const stripeDescription =
    stripeMode === "test"
      ? "Chave Stripe detectada como test mode."
      : stripeMode === "live"
        ? "Chave Stripe detectada como live mode."
        : "Chave Stripe ausente ou com formato nao reconhecido.";

  addItem(items, {
    id: "payments-stripe-mode",
    area: "payments",
    title: "Modo da Stripe",
    severity: stripeSeverity,
    description: stripeDescription,
    impact:
      stripeSeverity === "ok"
        ? "O modo da chave esta coerente com o ambiente avaliado."
        : "Homologacao ou venda aberta ficam inseguras sem uma chave do modo correto.",
    recommendedAction:
      stripeMode === "test"
        ? "Usar test mode apenas em staging/homologacao; Production de venda aberta exige live mode aprovado."
        : stripeMode === "live"
          ? "Usar live mode apenas em Production depois do smoke test mode aprovado."
          : "Configurar a chave secreta Stripe no ambiente correto sem expor o valor.",
    docsPath: "docs/vercel-env-checklist.md",
    blocksOpenSales: stripeSeverity === "blocked",
    blocksStaging: stripeSeverity === "blocked" && stripeMode !== "test",
    dependsOnClient: stripeSeverity === "blocked",
  });

  addItem(items, {
    id: "webhook-stripe-secret",
    area: "webhook",
    title: "Webhook Stripe assinado",
    severity: webhookConfigured ? "ok" : "blocked",
    description: webhookConfigured ? "Secret do webhook esta presente no ambiente." : "Secret do webhook Stripe esta ausente ou placeholder.",
    impact: webhookConfigured ? "Pagamentos podem ser confirmados por webhook assinado." : "Pedidos pagos nao podem ser confirmados com seguranca.",
    recommendedAction: "Criar webhook no Stripe Dashboard para /api/stripe/webhook e configurar o signing secret no ambiente correto.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: !webhookConfigured,
    blocksStaging: !webhookConfigured,
    dependsOnClient: !webhookConfigured,
  });
}

function addStorageItems(items: ReadinessItem[], env: Record<string, string | undefined>) {
  const validation = validateEnvironment({ env });
  const storageErrors = validation.errors.filter((issue) =>
    ["STORAGE_DRIVER", "R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"].includes(issue.variable),
  );
  const production = isProductionRuntime(env);

  if (validation.storageDriver === "r2" && !storageErrors.length) {
    addItem(items, {
      id: "storage-r2",
      area: "storage",
      title: "Storage persistente",
      severity: "ok",
      description: "Cloudflare R2 esta selecionado e as credenciais obrigatorias estao presentes.",
      impact: "Uploads do Admin podem persistir fora do filesystem temporario da Vercel.",
      recommendedAction: "Validar upload de imagem/banner em staging antes de venda aberta.",
      docsPath: "docs/vercel-env-checklist.md",
      blocksOpenSales: false,
      blocksStaging: false,
      dependsOnClient: false,
    });
    return;
  }

  if (validation.storageDriver === "local") {
    addItem(items, {
      id: "storage-r2",
      area: "storage",
      title: "Storage persistente",
      severity: production ? "blocked" : "warning",
      description: "Storage local esta ativo.",
      impact: "Uploads locais nao persistem corretamente em producao na Vercel.",
      recommendedAction: "Configurar STORAGE_DRIVER=r2 e credenciais Cloudflare R2 antes de venda aberta.",
      docsPath: "docs/vercel-env-checklist.md",
      blocksOpenSales: production,
      blocksStaging: false,
      dependsOnClient: true,
    });
    return;
  }

  addItem(items, {
    id: "storage-r2",
    area: "storage",
    title: "Storage persistente",
    severity: "blocked",
    description: `Configuracao de storage incompleta: ${Math.max(1, storageErrors.length)} item(ns) pendente(s).`,
    impact: "Uploads podem falhar ou nao ficar publicos.",
    recommendedAction: "Completar configuracao R2 no ambiente correto e fazer redeploy.",
    docsPath: "docs/vercel-env-checklist.md",
    blocksOpenSales: true,
    blocksStaging: true,
    dependsOnClient: true,
  });
}

function addMediaItems(items: ReadinessItem[], entries: MediaVariantAuditEntry[] | undefined) {
  const report = buildMediaVariantAuditReport(entries ?? []);

  if (report.summary.totalReuploadCandidates > 0) {
    const activeCandidates = report.reuploadCandidates.filter((item) => item.ownerActive).length;
    addItem(items, {
      id: "media-legacy-variants",
      area: "media",
      title: "Midias legadas sem variantes otimizadas",
      severity: "warning",
      description: `${report.summary.totalReuploadCandidates} midia(s) estatica(s) sem variantes foram encontradas; ${activeCandidates} estao em produto/banner ativo.`,
      impact: "Nao bloqueia venda aberta sozinho, mas pode manter downloads maiores em mobile, cards, detalhes ou Open Graph.",
      recommendedAction: "Rodar npm run media:variants:audit e reenviar manualmente as imagens pesadas pelo Admin em staging antes de repetir em producao autorizada.",
      docsPath: "docs/media-optimization.md",
      blocksOpenSales: false,
      blocksStaging: false,
      dependsOnClient: true,
    });
    return;
  }

  addItem(items, {
    id: "media-legacy-variants",
    area: "media",
    title: "Variantes de midia",
    severity: "ok",
    description: "Nenhuma imagem estatica candidata a reupload manual foi encontrada nos dados avaliados.",
    impact: "Novos uploads elegiveis podem usar thumbnail/medium; GIF e MP4 continuam preservados.",
    recommendedAction: "Manter o checklist de upload em staging antes de substituir midias antigas.",
    docsPath: "docs/media-optimization.md",
    blocksOpenSales: false,
    blocksStaging: false,
    dependsOnClient: false,
  });
}

function addShippingItems(items: ReadinessItem[], env: Record<string, string | undefined>, settings: ReadinessStoreSettings | null) {
  const production = isProductionRuntime(env);
  const envProvider = normalizeShippingProvider(clean(env.SHIPPING_PROVIDER));
  const mode = normalizeShippingMode(settings?.shippingMode);
  const fixedModeActive = mode === "fixed" && !envProvider;
  const provider = envProvider ?? (fixedModeActive ? "fixed" : normalizeShippingProvider(mode) ?? (mode === "disabled" ? null : "manual"));
  const shippingDisabled = mode === "disabled" || isDisabled(env.SHIPPING_ENABLED);
  const originCepConfigured = Boolean(clean(settings?.originCep) || clean(env.SHIPPING_ORIGIN_CEP));
  const melhorEnvioTokenConfigured = isConfigured(env.MELHOR_ENVIO_TOKEN) || isConfigured(env.MELHOR_ENVIO_ACCESS_TOKEN);

  if (!settings) {
    addItem(items, {
      id: "shipping-settings",
      area: "shipping",
      title: "Configuracao de frete",
      severity: "blocked",
      description: "Registro de configuracoes da loja nao foi encontrado.",
      impact: "Frete e checkout nao podem ser considerados prontos sem configuracao base.",
      recommendedAction: "Revisar o banco de staging/production e recriar as configuracoes da loja se necessario.",
      adminHref: "/admin/settings",
      blocksOpenSales: true,
      blocksStaging: true,
      dependsOnClient: false,
    });
    return;
  }

  if (shippingDisabled) {
    addItem(items, {
      id: "shipping-settings",
      area: "shipping",
      title: "Frete habilitado",
      severity: "blocked",
      description: "Frete esta desabilitado.",
      impact: "Checkout de venda aberta nao deve iniciar sem politica de entrega validada.",
      recommendedAction: "Habilitar e validar o frete real antes de venda aberta.",
      adminHref: "/admin/settings",
      blocksOpenSales: true,
      blocksStaging: false,
      dependsOnClient: true,
    });
    return;
  }

  if (provider === "melhor_envio" && melhorEnvioTokenConfigured && originCepConfigured) {
    addItem(items, {
      id: "shipping-settings",
      area: "shipping",
      title: "Frete Melhor Envio",
      severity: "ok",
      description: "Melhor Envio esta selecionado, token esta presente e CEP de origem esta configurado.",
      impact: "Cotacao de frete real pode ser validada sem expor credenciais.",
      recommendedAction: "Executar cotacao em staging e validar o fluxo de checkout test mode.",
      adminHref: "/admin/settings",
      docsPath: "docs/client-handoff.md",
      blocksOpenSales: false,
      blocksStaging: false,
      dependsOnClient: false,
    });
    return;
  }

  const missing: string[] = [];
  if (provider === "melhor_envio" && !melhorEnvioTokenConfigured) missing.push("token Melhor Envio");
  if (!originCepConfigured && provider !== "fixed") missing.push("CEP de origem");
  const legacyProvider = provider === "fixed" || provider === "manual";
  const blocked = production && (legacyProvider || missing.length > 0);

  addItem(items, {
    id: "shipping-settings",
    area: "shipping",
    title: "Configuracao de frete",
    severity: blocked ? "blocked" : "warning",
    description: legacyProvider
      ? `Frete esta em modo ${provider}.`
      : `Frete precisa de revisao: ${missing.join(", ") || "configuracao incompleta"}.`,
    impact: legacyProvider ? "Modo manual/fixo e provisório para venda aberta." : "Cotacao real pode falhar ou usar fallback operacional.",
    recommendedAction: "Configurar Melhor Envio com token valido e CEP de origem em Settings/Vercel.",
    adminHref: "/admin/settings",
    docsPath: "docs/vercel-env-checklist.md",
    blocksOpenSales: blocked,
    blocksStaging: false,
    dependsOnClient: true,
  });
}

function catalogSeverity(issue: CatalogIssue): ReadinessSeverity {
  if (
    issue.type === "active-product-no-stock" ||
    issue.type === "active-product-no-purchasable-variant" ||
    (issue.type === "product-missing-shipping-data" && issue.tone === "danger")
  ) {
    return "blocked";
  }

  if (issue.tone === "muted") return "info";
  return "warning";
}

function catalogBlocksOpenSales(issue: CatalogIssue) {
  return (
    issue.type === "active-product-no-stock" ||
    issue.type === "active-product-no-purchasable-variant" ||
    (issue.type === "product-missing-shipping-data" && issue.tone === "danger")
  );
}

function addCatalogItems(items: ReadinessItem[], products: CatalogIssueProduct[], categories: CatalogIssueCategory[]) {
  const activeProducts = products.filter((product) => product.active);
  const issues = buildCatalogIssues({ products, categories });

  if (!activeProducts.length) {
    addItem(items, {
      id: "catalog-active-products",
      area: "catalog",
      title: "Produtos ativos",
      severity: "blocked",
      description: "Nenhum produto ativo encontrado.",
      impact: "A loja nao tem catalogo publicado para venda.",
      recommendedAction: "Cadastrar e ativar produtos com midia, estoque, variacoes e medidas.",
      adminHref: "/admin/products",
      blocksOpenSales: true,
      blocksStaging: false,
      dependsOnClient: true,
    });
  }

  for (const issue of issues) {
    const severity = catalogSeverity(issue);
    addItem(items, {
      id: `catalog:${issue.id}`,
      area: "catalog",
      title: issue.title,
      severity,
      description: issue.description,
      impact:
        severity === "blocked"
          ? "Essa pendencia impede venda aberta segura do item publicado."
          : "Essa pendencia reduz qualidade operacional ou visual, mas nao bloqueia sozinha a venda aberta.",
      recommendedAction: issue.actionLabel,
      adminHref: issue.href,
      blocksOpenSales: catalogBlocksOpenSales(issue),
      blocksStaging: false,
      dependsOnClient: true,
    });
  }

  if (activeProducts.length && !issues.some((issue) => catalogBlocksOpenSales(issue))) {
    addItem(items, {
      id: "catalog-critical",
      area: "catalog",
      title: "Catalogo sem bloqueios criticos",
      severity: "ok",
      description: "Nao foram encontradas pendencias criticas em produtos ativos.",
      impact: "Catalogo pode seguir para validacao operacional.",
      recommendedAction: "Revisar warnings visuais antes de campanha ou trafego pago.",
      adminHref: "/admin/products",
      blocksOpenSales: false,
      blocksStaging: false,
      dependsOnClient: false,
    });
  }
}

function addSeoAndSecurityItems(items: ReadinessItem[]) {
  const headers = getSecurityHeaders();
  const hasCspReportOnly = headers.some((header) => header.key === "Content-Security-Policy-Report-Only");

  addItem(items, {
    id: "seo-public-routes",
    area: "seo",
    title: "SEO publico basico",
    severity: "ok",
    description: "robots.txt, sitemap.xml e 404 real estao implementados no app.",
    impact: "As rotas publicas essenciais existem no codigo; a validacao externa continua sendo o smoke publico.",
    recommendedAction: "Rodar npm run smoke -- https://raredept.com.br depois do deploy.",
    docsPath: "docs/client-handoff.md",
    blocksOpenSales: false,
    blocksStaging: false,
    dependsOnClient: false,
  });

  addItem(items, {
    id: "security-headers",
    area: "security",
    title: "Headers e CSP progressiva",
    severity: hasCspReportOnly ? "ok" : "warning",
    description: hasCspReportOnly ? "Headers basicos e CSP Report-Only estao centralizados." : "CSP Report-Only nao foi encontrada nos headers centrais.",
    impact: "CSP Report-Only permite observar violações sem quebrar o storefront.",
    recommendedAction: "Manter Report-Only nesta etapa e validar headers pelo smoke publico.",
    blocksOpenSales: false,
    blocksStaging: false,
    dependsOnClient: false,
  });
}

function addDocumentationItems(items: ReadinessItem[], documentation: ReadinessDocumentationInput) {
  const missingDocs = [
    ["docs/vercel-env-checklist.md", documentation.vercelEnvChecklistExists],
    ["docs/client-handoff.md", documentation.clientHandoffExists],
    ["docs/checkout-smoke-test.md", documentation.checkoutSmokeTestExists],
  ].filter(([, exists]) => !exists);
  const missingScripts = [
    ["npm run smoke", documentation.smokeScriptExists],
    ["npm run checkout:smoke", documentation.checkoutSmokeScriptExists],
  ].filter(([, exists]) => !exists);

  addItem(items, {
    id: "documentation-handoff",
    area: "documentation",
    title: "Documentacao operacional",
    severity: missingDocs.length ? "warning" : "ok",
    description: missingDocs.length ? `Documentos ausentes: ${missingDocs.map(([name]) => name).join(", ")}.` : "Checklist Vercel, handoff e checkout smoke estao presentes.",
    impact: "Cliente precisa dos guias para configurar Vercel, Redis, Stripe, R2 e Melhor Envio.",
    recommendedAction: "Usar os documentos locais como referencia de configuracao e go-live.",
    docsPath: "docs/client-handoff.md",
    blocksOpenSales: false,
    blocksStaging: false,
    dependsOnClient: missingDocs.length > 0,
  });

  addItem(items, {
    id: "documentation-smoke-scripts",
    area: "documentation",
    title: "Scripts de validacao",
    severity: missingScripts.length ? "warning" : "ok",
    description: missingScripts.length ? `Scripts ausentes: ${missingScripts.map(([name]) => name).join(", ")}.` : "Scripts npm run smoke e npm run checkout:smoke estao disponiveis.",
    impact: "Validacoes finais dependem desses comandos, mas eles nao alteram dados por si so.",
    recommendedAction: "Rodar smoke publico apos deploy e guard de checkout antes de qualquer homologacao Stripe.",
    docsPath: "docs/checkout-smoke-test.md",
    blocksOpenSales: false,
    blocksStaging: false,
    dependsOnClient: false,
  });
}

export function buildAdminReadiness(input: BuildAdminReadinessInput): ReadinessReport {
  const env = input.env ?? process.env;
  const documentation = { ...defaultDocumentation, ...input.documentation };
  const items: ReadinessItem[] = [];

  addEnvironmentItems(items, env);
  addRateLimitItems(items, env);
  addCheckoutItems(items, env);
  addStorageItems(items, env);
  addMediaItems(items, input.mediaAuditEntries);
  addShippingItems(items, env, input.settings);
  addCatalogItems(items, input.products, input.categories);
  addSeoAndSecurityItems(items);
  addDocumentationItems(items, documentation);

  const sortedItems = items.sort(
    (first, second) =>
      severityOrder[first.severity] - severityOrder[second.severity] ||
      first.area.localeCompare(second.area) ||
      first.title.localeCompare(second.title),
  );
  const counts = createCounts(sortedItems);
  const summary = createSummary(sortedItems);

  return {
    ...summary,
    counts,
    clientActionCount: sortedItems.filter((item) => item.dependsOnClient).length,
    items: sortedItems,
  };
}
