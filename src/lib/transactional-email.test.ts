import { describe, expect, it, vi } from "vitest";
import {
  deliverTransactionalEmail,
  renderOrderConfirmationEmail,
  renderOrderShippedEmail,
  renderPaymentApprovedEmail,
  renderPaymentDeclinedEmail,
  renderSupportContactEmail,
} from "@/lib/transactional-email";

const order = {
  to: "cliente@example.com",
  customerName: "Cliente <script>alert(1)</script>",
  orderNumber: "RARE-123",
  total: "R$ 199,90",
};

describe("transactional email", () => {
  it("renders all minimum order templates", () => {
    const templates = [
      renderOrderConfirmationEmail(order),
      renderPaymentApprovedEmail(order),
      renderPaymentDeclinedEmail(order),
      renderOrderShippedEmail({ ...order, trackingCode: "BR123" }),
    ];

    expect(templates.map((template) => template.kind)).toEqual([
      "order_confirmation",
      "payment_approved",
      "payment_declined",
      "order_shipped",
    ]);
    expect(templates.every((template) => template.text.includes("RARE-123"))).toBe(true);
  });

  it("escapes customer-controlled HTML and strips control characters", () => {
    const template = renderSupportContactEmail({
      to: "suporte@raredept.com.br",
      customerName: "<img src=x onerror=alert(1)>",
      customerEmail: "cliente@example.com",
      message: "Olá\u0000<script>bad()</script>",
    });

    expect(template.html).not.toContain("<script>");
    expect(template.html).not.toContain("<img");
    expect(template.html).toContain("&lt;script&gt;");
    expect(template.text).not.toContain("\u0000");
    expect(renderOrderConfirmationEmail({ ...order, orderNumber: "RARE-123\r\nBcc: attacker@example.com" }).subject).not.toContain("\n");
  });

  it("is safely disabled by default without calling a provider", async () => {
    const provider = { name: "future-provider", send: vi.fn(async () => ({ id: "message-1" })) };
    const result = await deliverTransactionalEmail(renderOrderConfirmationEmail(order), provider);

    expect(result).toEqual({ status: "disabled" });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("contains provider failures so they cannot roll back business operations", async () => {
    vi.stubEnv("EMAIL_DRIVER", "future-provider");
    const provider = { name: "future-provider", send: vi.fn(async () => { throw new Error("secret provider payload"); }) };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(deliverTransactionalEmail(renderPaymentApprovedEmail(order), provider)).resolves.toEqual({
      status: "failed",
      provider: "future-provider",
    });
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("secret provider payload"));
    vi.unstubAllEnvs();
    consoleSpy.mockRestore();
  });

  it("contains a missing provider configuration instead of throwing", async () => {
    vi.stubEnv("EMAIL_DRIVER", "future-provider");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(deliverTransactionalEmail(renderPaymentApprovedEmail(order))).resolves.toEqual({
      status: "failed",
      provider: "future-provider",
    });
    vi.unstubAllEnvs();
    consoleSpy.mockRestore();
  });
});
