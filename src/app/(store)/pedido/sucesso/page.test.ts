import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import OrderSuccessPage from "@/app/(store)/pedido/sucesso/page";

const successMocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: successMocks.prisma,
}));

vi.mock("@/components/store/clear-cart-on-success", () => ({
  ClearCartOnSuccess: () => "CLEAR_CART_MARKER",
}));

describe("OrderSuccessPage", () => {
  it("handles a missing session_id without confirming or clearing the cart", async () => {
    const element = await OrderSuccessPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Não encontramos uma sessão de pagamento nesta página.");
    expect(html).not.toContain("CLEAR_CART_MARKER");
    expect(successMocks.prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("confirms only a known Stripe Checkout session", async () => {
    successMocks.prisma.order.findUnique.mockResolvedValueOnce({
      orderNumber: "RARE-TEST",
      status: "awaiting_payment",
      totalInCents: 21500,
    });

    const element = await OrderSuccessPage({
      searchParams: Promise.resolve({ session_id: "cs_test_knownSession123" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("CLEAR_CART_MARKER");
    expect(html).toContain("Pedido recebido pela RARE");
    expect(html).toContain("RARE-TEST");
    expect(successMocks.prisma.order.findUnique).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: "cs_test_knownSession123" },
      select: {
        orderNumber: true,
        status: true,
        totalInCents: true,
      },
    });
  });
});
