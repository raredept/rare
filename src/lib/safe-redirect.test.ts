import { describe, expect, it } from "vitest";
import { getSafeAdminNext, getSafeCustomerNext } from "@/lib/safe-redirect";

// Every value here passed the old "starts with an allowed prefix" check.
const escapes = [
  "//evil.example",
  "https://evil.example/admin",
  "/\evil.example",
  "/admin/../..//evil.example",
  "/admin/%2e%2e/%2e%2e//evil.example",
  "/minha-conta/../..//evil.example",
  "/minha-conta/%2E%2E/%2E%2E//evil.example",
  "/admin\t//evil.example",
  "/minha-conta\n//evil.example",
];

describe("getSafeAdminNext", () => {
  it("keeps Admin paths, with their query", () => {
    expect(getSafeAdminNext("/admin")).toBe("/admin");
    expect(getSafeAdminNext("/admin/orders?status=paid")).toBe("/admin/orders?status=paid");
  });

  it("never leaves the origin, even after dot segments resolve", () => {
    for (const value of escapes) expect(getSafeAdminNext(value), value).toBe("/admin");
  });

  it("checks the allowlist on the resolved path", () => {
    expect(getSafeAdminNext("/admin/../minha-conta")).toBe("/admin");
    expect(getSafeAdminNext("/admin-evil")).toBe("/admin");
    expect(getSafeAdminNext("/admin/login")).toBe("/admin");
    expect(getSafeAdminNext("/admin/./login")).toBe("/admin");
    expect(getSafeAdminNext(null)).toBe("/admin");
  });
});

describe("getSafeCustomerNext", () => {
  it("keeps the allowlisted customer paths, with their query", () => {
    expect(getSafeCustomerNext("/minha-conta/pedidos")).toBe("/minha-conta/pedidos");
    expect(getSafeCustomerNext("/cart")).toBe("/cart");
    expect(getSafeCustomerNext("/finalizar-compra?etapa=entrega")).toBe("/finalizar-compra?etapa=entrega");
  });

  it("never leaves the origin, even after dot segments resolve", () => {
    for (const value of escapes) expect(getSafeCustomerNext(value), value).toBe("/minha-conta");
  });

  it("checks the allowlist on the resolved path", () => {
    expect(getSafeCustomerNext("/minha-conta/../admin")).toBe("/minha-conta");
    expect(getSafeCustomerNext("/minha-conta-falsa")).toBe("/minha-conta");
    expect(getSafeCustomerNext("/cart/../admin")).toBe("/minha-conta");
    expect(getSafeCustomerNext(undefined)).toBe("/minha-conta");
  });
});
