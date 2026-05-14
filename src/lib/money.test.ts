import { describe, expect, it } from "vitest";
import { calculateShipping, formatMoney, parseMoneyToCents } from "@/lib/money";

describe("money helpers", () => {
  it("formats BRL values with two decimal places", () => {
    expect(formatMoney(52999)).toBe("R$\u00a0529,99");
    expect(formatMoney(23999)).toBe("R$\u00a0239,99");
    expect(formatMoney(48999)).toBe("R$\u00a0489,99");
    expect(formatMoney(31999)).toBe("R$\u00a0319,99");
    expect(formatMoney(28999)).toBe("R$\u00a0289,99");
  });

  it("parses Brazilian money strings into cents", () => {
    expect(parseMoneyToCents("R$ 299,90")).toBe(29990);
    expect(parseMoneyToCents("R$\u00a0299,90")).toBe(29990);
    expect(parseMoneyToCents("1.299,99")).toBe(129999);
  });

  it("applies free shipping threshold", () => {
    expect(calculateShipping(40000, 2500, 30000)).toBe(0);
    expect(calculateShipping(20000, 2500, 30000)).toBe(2500);
  });
});
