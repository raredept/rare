import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    storeSettings: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
    APP_ENV: "production",
    APP_URL: "https://rare.example",
    NEXT_PUBLIC_APP_URL: "https://rare.example",
    DATABASE_URL: "postgresql://user:password@db.example/rare",
    ADMIN_SESSION_SECRET: "admin-session-secret-with-more-than-32-characters",
    CHECKOUT_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_live_value_that_must_not_render",
    STRIPE_WEBHOOK_SECRET: "whsec_value_that_must_not_render",
    RATE_LIMIT_DRIVER: "memory",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "redis-token-that-must-not-render",
    STORAGE_DRIVER: "r2",
    R2_ACCOUNT_ID: "account-id",
    R2_BUCKET: "rare-media",
    R2_ACCESS_KEY_ID: "r2-access-key-that-must-not-render",
    R2_SECRET_ACCESS_KEY: "r2-secret-that-must-not-render",
    R2_PUBLIC_BASE_URL: "https://media.rare.example",
    SHIPPING_PROVIDER: "melhor_envio",
    SHIPPING_ORIGIN_CEP: "31170350",
    MELHOR_ENVIO_TOKEN: "melhor-envio-token-that-must-not-render",
    MELHOR_ENVIO_ENV: "production",
  };

  mocks.prisma.storeSettings.findUnique.mockResolvedValue({
    shippingMode: "melhor_envio",
    originCep: "31170350",
    fixedShippingInCents: 0,
    manualShippingInCents: 0,
  });
  mocks.prisma.product.findMany.mockResolvedValue([
    {
      id: "prod-no-dimensions",
      title: "Produto sem medidas",
      active: true,
      weightGrams: 500,
      lengthCm: 30,
      widthCm: null,
      heightCm: 4,
      images: [{ url: "https://media.rare.example/products/produto.webp" }],
      variants: [{ active: true, stock: 4, reservedStock: 0 }],
    },
  ]);
  mocks.prisma.category.findMany.mockResolvedValue([
    {
      id: "cat-empty",
      name: "Bags",
      active: true,
      _count: { products: 0, subcategoryProducts: 0 },
    },
  ]);
});

afterEach(() => {
  process.env = originalEnv;
});

describe("AdminReadinessPage", () => {
  it("renders readiness status, blockers, actions and sanitized links", async () => {
    const { default: AdminReadinessPage } = await import("@/app/admin/(protected)/readiness/page");
    process.env = { ...process.env, NODE_ENV: "production" };
    const element = await AdminReadinessPage();
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Prontidão de Venda");
    expect(html).toContain("Pronto para homologacao; bloqueado para venda aberta");
    expect(html).toContain("Rate limit compartilhado");
    expect(html).toContain("Configurar RATE_LIMIT_DRIVER=redis");
    expect(html).toContain("Produto sem medidas sem peso ou dimensoes completas");
    expect(html).toContain('href="/admin/products/prod-no-dimensions/edit"');
    expect(html).toContain("Bags ativa sem produtos");
    expect(html).toContain('href="/admin/categories/cat-empty/edit"');
    expect(html).not.toContain(process.env.STRIPE_SECRET_KEY);
    expect(html).not.toContain(process.env.STRIPE_WEBHOOK_SECRET);
    expect(html).not.toContain(process.env.DATABASE_URL);
    expect(html).not.toContain(process.env.UPSTASH_REDIS_REST_TOKEN);
    expect(html).not.toContain(process.env.R2_SECRET_ACCESS_KEY);
    expect(html).not.toContain(process.env.MELHOR_ENVIO_TOKEN);
  });
});
