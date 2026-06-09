import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    storeSettings: {
      findUnique: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    customer: {
      count: vi.fn(),
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
    RATE_LIMIT_DRIVER: "redis",
    UPSTASH_REDIS_REST_URL: "https://redis.example",
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
  mocks.prisma.order.findMany.mockResolvedValue([]);
  mocks.prisma.productVariant.findMany.mockResolvedValue([]);
  mocks.prisma.product.findMany.mockResolvedValue([
    {
      id: "prod-no-media",
      title: "Produto sem midia",
      active: true,
      weightGrams: 500,
      lengthCm: 30,
      widthCm: 24,
      heightCm: 4,
      images: [],
      variants: [{ active: true, stock: 2, reservedStock: 0 }],
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
  mocks.prisma.customer.count.mockResolvedValue(0);
});

afterEach(() => {
  process.env = originalEnv;
});

describe("AdminDashboardPage", () => {
  it("renders catalog issues with correction links", async () => {
    const { default: AdminDashboardPage } = await import("@/app/admin/(protected)/page");
    process.env = { ...process.env, NODE_ENV: "production" };
    const element = await AdminDashboardPage();
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Pendencias do catalogo");
    expect(html).toContain("Prontidão de Venda");
    expect(html).toContain("Produto sem midia sem midia principal");
    expect(html).toContain('href="/admin/products/prod-no-media/edit"');
    expect(html).toContain("Bags ativa sem produtos");
    expect(html).toContain('href="/admin/categories/cat-empty/edit"');
    expect(html).not.toContain(process.env.STRIPE_SECRET_KEY);
    expect(html).not.toContain(process.env.STRIPE_WEBHOOK_SECRET);
    expect(html).not.toContain(process.env.DATABASE_URL);
    expect(html).not.toContain(process.env.UPSTASH_REDIS_REST_TOKEN);
    expect(html).not.toContain(process.env.R2_SECRET_ACCESS_KEY);
    expect(html).not.toContain(process.env.MELHOR_ENVIO_TOKEN);
  }, 10_000);
});
