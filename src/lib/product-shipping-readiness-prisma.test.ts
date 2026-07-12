import { describe, expect, it } from "vitest";
import { getProductShippingNotReadyWhere } from "@/lib/product-shipping-readiness-prisma";

describe("product shipping Prisma readiness filter", () => {
  it("covers missing, non-positive and out-of-range fields", () => {
    const serialized = JSON.stringify(getProductShippingNotReadyWhere());
    for (const field of ["weightGrams", "lengthCm", "widthCm", "heightCm"]) {
      expect(serialized).toContain(field);
    }
    expect(serialized).toContain('"lte":0');
    expect(serialized).toContain('"gt":');
  });
});
