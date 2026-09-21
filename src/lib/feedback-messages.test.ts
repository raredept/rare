import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_PRODUCT_SHIPPING_DATA_MESSAGE,
  ADMIN_GENERIC_ERROR,
  CUSTOMER_GENERIC_ERROR,
  isKnownAdminServerMessage,
  resolveAdminErrorMessage,
  resolveAdminSuccessMessage,
  resolveCustomerAddressError,
} from "@/lib/feedback-messages";
import { ACTIVE_PRODUCT_SHIPPING_DATA_ERROR } from "@/lib/validators";

describe("resolveAdminErrorMessage", () => {
  it("maps known codes", () => {
    expect(resolveAdminErrorMessage("category-save-failed")).toBe("Não foi possível salvar a categoria.");
    expect(resolveAdminErrorMessage("category-slug-taken")).toContain("Já existe uma categoria");
  });

  it("passes through messages the server itself produces", () => {
    expect(resolveAdminErrorMessage("Cadastre pelo menos uma variação.")).toBe("Cadastre pelo menos uma variação.");
    expect(resolveAdminErrorMessage("Altura deve ser um número inteiro entre 1 e 1000 cm.")).toBe("Altura deve ser um número inteiro entre 1 e 1000 cm.");
  });

  it("never renders attacker-supplied text from the URL", () => {
    for (const injected of [
      "Sua conta foi bloqueada, ligue para 0800 000 0000",
      "Sessão expirada. Entre em https://rare-login.example",
      "Cadastre pelo menos uma variação. Depois acesse evil.example",
      "Altura deve ser um número inteiro entre 1 e 1000 cm. Ligue já",
    ]) {
      expect(resolveAdminErrorMessage(injected)).toBe(ADMIN_GENERIC_ERROR);
    }
  });

  it("returns nothing for an absent value", () => {
    expect(resolveAdminErrorMessage(null)).toBeNull();
  });
});

describe("resolveAdminSuccessMessage", () => {
  it("maps known codes and drops anything else", () => {
    expect(resolveAdminSuccessMessage("product-created")).toBe("Produto criado com sucesso.");
    expect(resolveAdminSuccessMessage("Pagamento aprovado! Confirme seus dados em evil.example")).toBeNull();
  });
});

describe("resolveCustomerAddressError", () => {
  it("shows only the address messages the server sends", () => {
    expect(resolveCustomerAddressError("Endereço não encontrado.")).toBe("Endereço não encontrado.");
    expect(resolveCustomerAddressError("Seu cartão foi recusado, atualize em evil.example")).toBe(CUSTOMER_GENERIC_ERROR);
    expect(resolveCustomerAddressError(undefined)).toBeNull();
  });
});

describe("catalogue stays in sync with the code that produces the messages", () => {
  it("mirrors the validator's shipping message", () => {
    expect(ACTIVE_PRODUCT_SHIPPING_DATA_MESSAGE).toBe(ACTIVE_PRODUCT_SHIPPING_DATA_ERROR);
  });

  // Every literal an Admin action passes to one of its error redirects must be
  // in the catalogue; otherwise the operator would see the generic message.
  it("knows every literal the Admin actions send", () => {
    const files = [
      "src/app/admin/(protected)/products/actions.ts",
      "src/app/admin/(protected)/banners/actions.ts",
      "src/app/admin/(protected)/orders/actions.ts",
    ];
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      const calls = source.matchAll(/redirectWith\w*Error\(\s*(?:\w+\s*,\s*)?"([^"]+)"/g);
      for (const [, literal] of calls) if (!isKnownAdminServerMessage(literal)) missing.push(`${file}: ${literal}`);
      // The orders action builds its message from a fallback literal.
      for (const [, literal] of source.matchAll(/:\s*"(Não foi possível[^"]+)"/g)) {
        if (!isKnownAdminServerMessage(literal)) missing.push(`${file}: ${literal}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
