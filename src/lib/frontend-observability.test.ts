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

    expect(record).toEqual({
      level: "error",
      source: "storefront",
      route: "/conta",
      kind: "Error",
      category: "unexpected_error",
    });
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
      category: "unexpected_error",
    });
    consoleError.mockRestore();
  });

  it("uses only the fixed version-mismatch category for recognized stale actions", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reportFrontendError(new Error("private action id"), "/entrar?email=private@example.com", "server_action_version_mismatch");

    expect(consoleError).toHaveBeenCalledWith("[RARE frontend] unexpected error", {
      level: "error",
      source: "storefront",
      route: "/entrar",
      kind: "Error",
      category: "server_action_version_mismatch",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("private action id");
    consoleError.mockRestore();
  });
});
