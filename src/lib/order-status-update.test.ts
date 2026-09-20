import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateOrderStatusWithReservationRelease } from "@/lib/checkout";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    order: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    emailOutbox: { createMany: vi.fn() },
  };
  return { tx, prisma: { order: { findUnique: vi.fn() }, $transaction: vi.fn() } };
});
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

const order = (status: string) => ({
  id: "o1", orderNumber: "RARE-1", status, totalInCents: 15400, items: [],
  customerEmail: "c@example.org", customerEmailSnapshot: "c@example.org", customerName: "C", customerNameSnapshot: "Cliente",
  stripeCheckoutSessionId: null, checkoutDeadlineAt: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (cb: (tx: typeof mocks.tx) => unknown) => cb(mocks.tx));
});

describe("manual order status updates", () => {
  it("rejects an invalid transition before touching the database transaction", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(order("canceled"));
    await expect(updateOrderStatusWithReservationRelease("o1", "shipped", "admin")).rejects.toThrow("Transição de status inválida");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("re-checks under the row lock when a webhook changed the order meanwhile", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(order("processing"));
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(order("refunded"));
    await expect(updateOrderStatusWithReservationRelease("o1", "shipped", "admin")).rejects.toThrow("Transição de status inválida");
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.tx.emailOutbox.createMany).not.toHaveBeenCalled();
  });

  it("queues exactly one 'order shipped' e-mail in the same transaction as the status change", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(order("processing"));
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(order("processing"));

    await updateOrderStatusWithReservationRelease("o1", "shipped", "admin");

    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { status: "shipped" } });
    expect(mocks.tx.emailOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ orderId: "o1", kind: "order_shipped", recipient: "c@example.org", totalInCents: 15400 })],
    }));
  });

  it("does not queue e-mail for other transitions", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(order("paid"));
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(order("paid"));
    await updateOrderStatusWithReservationRelease("o1", "processing", "admin");
    expect(mocks.tx.emailOutbox.createMany).not.toHaveBeenCalled();
  });
});
