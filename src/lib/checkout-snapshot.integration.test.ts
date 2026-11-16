import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AsaasPayment } from "@/lib/asaas";

// RARE-ORDER-ITEM-IMAGE-SKU-AUDIT-01 — snapshot immutability on a REAL PostgreSQL database.
// The real createCheckoutSession writes the order; only the Asaas network calls are replaced
// (no request leaves the machine). Skipped unless QA_SNAPSHOT_DATABASE_URL points at a local,
// disposable, fully migrated database:
//
//   QA_SNAPSHOT_DATABASE_URL=postgresql://...@localhost:54329/<disposable> npx vitest run src/lib/checkout-snapshot.integration.test.ts

const databaseUrl = process.env.QA_SNAPSHOT_DATABASE_URL;
const enabled = Boolean(databaseUrl && /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl));

const asaas = vi.hoisted(() => ({
  createAsaasPayment: vi.fn(),
  getAsaasPixQrCode: vi.fn(),
  findAsaasCustomerByReference: vi.fn(),
  createAsaasCustomer: vi.fn(),
}));
vi.mock("@/lib/asaas", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/asaas")>()), ...asaas }));
vi.mock("@/lib/settings", () => ({
  getStoreSettings: vi.fn(async () => ({ checkoutRequiresAddress: true, shippingMode: "fixed", fixedShippingInCents: 2000, manualShippingInCents: 0, freeShippingThresholdInCents: null, checkoutReservationMinutes: 30 })),
}));
vi.mock("@/lib/admin-notifications", () => ({ notifyAdminsOfPaidOrder: vi.fn() }));
vi.mock("@/lib/checkout-expiry", () => ({ reconcileCheckoutExpiry: vi.fn() }));

const run = Date.now().toString(36);
const IMAGE_A = `https://media.rare-lab.r2.dev/qa/${run}-a-rare-v1-original.jpg`;
const IMAGE_B = `https://media.rare-lab.r2.dev/qa/${run}-b-rare-v1-original.jpg`;
const SKU_A = `QA-SNAP-${run.toUpperCase()}-A`;
const SKU_B = `QA-SNAP-${run.toUpperCase()}-B`;
const ids = { product: `qa_snap_p_${run}`, variant: `qa_snap_v_${run}`, customer: `qa_snap_c_${run}`, address: `qa_snap_a_${run}` };

describe.skipIf(!enabled)("order item snapshot on a real database", () => {
  const originalEnv = process.env;
  let prisma: (typeof import("@/lib/prisma"))["prisma"];
  let orderId = "";

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: databaseUrl!,
      APP_ENV: "staging",
      APP_URL: "https://staging.rare.example",
      PAYMENT_PROVIDER: "asaas",
      ASAAS_ENV: "sandbox",
      ASAAS_API_KEY: ["$aact", "hmlg", `fixture${"0".repeat(40)}`].join("_"),
      ASAAS_WEBHOOK_TOKEN: "w".repeat(40),
      SHIPPING_ENABLED: "false",
    };
    ({ prisma } = await import("@/lib/prisma"));
    await prisma.product.create({
      data: {
        id: ids.product, title: `QA Camiseta Corteiz ${run}`, slug: `qa-snap-${run}`, description: "QA", shortDescription: "QA", priceInCents: 1200,
        weightGrams: 300, lengthCm: 30, widthCm: 25, heightCm: 3,
        images: { create: [{ url: IMAGE_A, alt: "A", sortOrder: 0 }] },
        variants: { create: [{ id: ids.variant, size: "G", sku: SKU_A, stock: 3 }] },
      },
    });
    await prisma.customer.create({ data: { id: ids.customer, name: "Ana QA", email: `qa.snap.${run}@homologacao.rare.invalid`, cpf: "12345678909", passwordHash: "x", emailVerifiedAt: new Date() } });
    await prisma.customerAddress.create({ data: { id: ids.address, customerId: ids.customer, cep: "01001000", street: "Rua A", number: "1", neighborhood: "Centro", city: "São Paulo", state: "SP", isDefault: true } });
    asaas.findAsaasCustomerByReference.mockResolvedValue(null);
    asaas.createAsaasCustomer.mockResolvedValue("cus_000000000001");
    asaas.createAsaasPayment.mockImplementation(async (_config: unknown, input: { totalInCents: number; orderId: string }) => ({
      id: `pay_${run}`, status: "PENDING", billingType: "PIX", amountInCents: input.totalInCents, customerId: "cus_000000000001", externalReference: input.orderId, invoiceUrl: null, deleted: false,
    } satisfies AsaasPayment));
    asaas.getAsaasPixQrCode.mockResolvedValue({ copyPaste: "00020126QA-SINTETICO-NAO-PAGAR", qrCodeBase64: null, expiresAt: null });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.order.deleteMany({ where: { customerId: ids.customer } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { id: ids.product } }).catch(() => undefined);
      await prisma.customer.deleteMany({ where: { id: ids.customer } }).catch(() => undefined);
    }
    process.env = originalEnv;
  });

  it("the real checkout records SKU A and image A, from the catalog only", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout");
    const result = await createCheckoutSession(
      // Client-sent snapshot fields are ignored by the request schema.
      { items: [{ productId: ids.product, variantId: ids.variant, quantity: 1 }], customerAddressId: ids.address, shippingOptionId: "fixed", paymentMethod: "pix", skuSnapshot: "EVIL", imageUrlSnapshot: "https://evil.example/x.png" },
      { customerId: ids.customer },
    );
    expect(result.url).toMatch(/^\/pedido\/pix\//);
    orderId = (result.url ?? "").split("/").pop()!;
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(item).toMatchObject({ productTitleSnapshot: `QA Camiseta Corteiz ${run}`, sizeSnapshot: "G", skuSnapshot: SKU_A, imageUrlSnapshot: IMAGE_A, unitPriceInCents: 1200, quantity: 1 });
    expect(item.catalogSnapshotAt).toBeInstanceOf(Date);
    expect(asaas.createAsaasPayment).toHaveBeenCalledTimes(1);
  });

  it("changing the catalog to SKU B / image B and archiving the product does not change the order", async () => {
    await prisma.productVariant.update({ where: { id: ids.variant }, data: { sku: SKU_B } });
    await prisma.productImage.updateMany({ where: { productId: ids.product }, data: { url: IMAGE_B } });
    await prisma.product.update({ where: { id: ids.product }, data: { active: false } });

    // Same query as Admin > Pedidos > Detalhes.
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 10, select: { url: true } } } }, variant: { select: { productId: true, size: true, sku: true } } } } },
    });
    const [item] = order.items;
    expect(item).toMatchObject({ skuSnapshot: SKU_A, imageUrlSnapshot: IMAGE_A });
    expect(item.variant?.sku).toBe(SKU_B);

    const { AdminOrderItemRow } = await import("@/components/admin/order-item-row");
    const html = renderToStaticMarkup(AdminOrderItemRow({ item }));
    expect(html).toContain(`SKU: ${SKU_A}`);
    expect(html).not.toContain(SKU_B);
    expect(html).toContain(`${run}-a-rare-v1-thumbnail.webp`);
    expect(html).not.toContain(`${run}-b-`);
  });

  it("an order without snapshot (created before the migration) falls back to the live catalog, labelled", async () => {
    await prisma.orderItem.updateMany({ where: { orderId }, data: { skuSnapshot: null, imageUrlSnapshot: null, catalogSnapshotAt: null } });
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 10, select: { url: true } } } }, variant: { select: { productId: true, size: true, sku: true } } } } },
    });
    const { AdminOrderItemRow } = await import("@/components/admin/order-item-row");
    const html = renderToStaticMarkup(AdminOrderItemRow({ item: order.items[0] }));
    expect(html).toContain(`SKU atual: ${SKU_B}`);
    expect(html).toContain("do catálogo hoje");
    expect(html).toContain(`${run}-b-rare-v1-thumbnail.webp`);

    // Product deleted: relations become NULL (SetNull) and the row still renders.
    await prisma.product.delete({ where: { id: ids.product } });
    const after = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: { select: { images: { select: { url: true } } } }, variant: { select: { productId: true, size: true, sku: true } } } } },
    });
    const orphan = renderToStaticMarkup(AdminOrderItemRow({ item: after.items[0] }));
    expect(after.items[0]).toMatchObject({ productId: null, variantId: null });
    expect(orphan).toContain(`QA Camiseta Corteiz ${run}`);
    expect(orphan).toContain("Sem imagem");
    expect(orphan).not.toContain("SKU");
  });
});
