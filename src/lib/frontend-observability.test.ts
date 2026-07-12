import { describe, expect, it, vi } from "vitest";
import { buildFrontendIssueRecord, reportFrontendError, sanitizeFrontendRoute } from "@/lib/frontend-observability";

describe("frontend observability", () => {
  it("keeps only a sanitized pathname", () => {
    expect(sanitizeFrontendRoute("https://raredept.com.br/produto/camiseta?q=email@example.com&token=secret")).toBe("/produto/camiseta");
    expect(sanitizeFrontendRoute("/%3Cscript%3E")).not.toContain("<script>");
  });

  it("does not copy messages, stacks, tokens, or personal data", () => {
    const error = new Error("Bearer secret-token for person@example.com");
    const record = buildFrontendIssueRecord(error, { route: "/conta?cpf=12345678900" });
    const serialized = JSON.stringify(record);

    expect(record).toEqual({ level: "error", source: "storefront", route: "/conta", kind: "Error" });
    expect(serialized).not.toMatch(/secret|example\.com|12345678900|stack|Bearer/);
  });

  it("logs only the sanitized record", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reportFrontendError(new TypeError("private payload"), "/produto/teste?token=private");
    expect(consoleError).toHaveBeenCalledWith("[RARE frontend] unexpected error", {
      level: "error",
      source: "storefront",
      route: "/produto/teste",
      kind: "TypeError",
    });
    consoleError.mockRestore();
  });
});
