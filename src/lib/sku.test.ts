import { describe, expect, it } from "vitest";
import { SKU_FORMAT_MESSAGE, findRepeatedSku, isValidSku, normalizeSku, parseSkuInput, skuSearchTerm } from "@/lib/sku";

describe("SKU normalization", () => {
  it("trims and upper-cases", () => {
    expect(normalizeSku("  crtz-tsh-blk-g ")).toBe("CRTZ-TSH-BLK-G");
  });

  it("turns blank or missing input into null, never an empty string", () => {
    expect(normalizeSku("")).toBeNull();
    expect(normalizeSku("   ")).toBeNull();
    expect(normalizeSku(undefined)).toBeNull();
    expect(normalizeSku(null)).toBeNull();
  });
});

describe("SKU validation", () => {
  it.each(["CRTZ-TSH-BLK-G", "ABC", "A_B-9", "X".repeat(64)])("accepts %s", (sku) => {
    expect(isValidSku(sku)).toBe(true);
  });

  it.each(["AB", "X".repeat(65), "CRTZ TSH", "CAMISETA-AÇÚCAR", "SKU/1", "SKU.1", "SKU:1"])("rejects %s", (sku) => {
    expect(isValidSku(sku)).toBe(false);
  });

  it("parses an optional SKU: empty is null, valid is normalized, invalid is a readable error", () => {
    expect(parseSkuInput("")).toEqual({ ok: true, sku: null });
    expect(parseSkuInput(" crtz-tsh-blk-g")).toEqual({ ok: true, sku: "CRTZ-TSH-BLK-G" });
    expect(parseSkuInput("a b")).toEqual({ ok: false, error: SKU_FORMAT_MESSAGE });
  });

  it("keeps an unchanged legacy SKU saved before these rules, so the product stays editable", () => {
    expect(parseSkuInput("rare bag", "RARE BAG")).toEqual({ ok: true, sku: "RARE BAG" });
    expect(parseSkuInput("other bag", "RARE BAG")).toEqual({ ok: false, error: SKU_FORMAT_MESSAGE });
  });

  it("finds a SKU repeated inside the same submission", () => {
    expect(findRepeatedSku(["A-1", null, "B-2", null])).toBeNull();
    expect(findRepeatedSku(["A-1", "B-2", "A-1"])).toBe("A-1");
  });
});

describe("SKU search term", () => {
  it("normalizes the query like the stored SKUs", () => {
    expect(skuSearchTerm(" crtz-tsh ")).toBe("CRTZ-TSH");
    expect(skuSearchTerm("")).toBeNull();
    expect(skuSearchTerm(undefined)).toBeNull();
  });
});
