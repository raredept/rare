import { describe, expect, it } from "vitest";
import {
  compareCollections,
  getCollectionDescription,
  getCollectionHref,
  getCollectionLabel,
  getCollectionLabelKey,
  isCollectionLive,
  isCollectionSlug,
  toNavigationCollection,
} from "@/lib/promotions/collections";
import { parsePromotionForm } from "@/lib/promotions/validation";

const now = new Date("2026-11-20T15:00:00.000Z");
const base = { storefrontCollectionEnabled: true, value: 30, status: "ACTIVE" as const, startsAt: null, endsAt: null };

describe("storefront collections (RARE-COLLECTIONS-CART-01)", () => {
  it("label: the menu name when filled, otherwise the promotion name (never an empty link)", () => {
    expect(getCollectionLabel({ name: "Black Friday 30%", storefrontCollectionLabel: "SALE BLACK" })).toBe("SALE BLACK");
    expect(getCollectionLabel({ name: "Black Friday 30%", storefrontCollectionLabel: "   " })).toBe("Black Friday 30%");
    expect(getCollectionLabel({ name: "Black Friday 30%", storefrontCollectionLabel: null })).toBe("Black Friday 30%");
  });

  it("href uses the promotion slug; only url-safe slugs are accepted", () => {
    expect(getCollectionHref("sale-black")).toBe("/colecao/sale-black");
    expect(isCollectionSlug("sale-black")).toBe(true);
    expect(isCollectionSlug("Sale-Black")).toBe(false);
    expect(isCollectionSlug("../admin")).toBe(false);
    expect(isCollectionSlug("javascript:alert(1)")).toBe(false);
  });

  it("is live only when enabled, with a discount and EFFECTIVELY active", () => {
    expect(isCollectionLive(base, now)).toBe(true);
    expect(isCollectionLive({ ...base, storefrontCollectionEnabled: false }, now)).toBe(false);
    expect(isCollectionLive({ ...base, value: null }, now)).toBe(false);
    expect(isCollectionLive({ ...base, status: "DRAFT" }, now)).toBe(false);
    expect(isCollectionLive({ ...base, status: "PAUSED" }, now)).toBe(false);
    expect(isCollectionLive({ ...base, status: "ENDED" }, now)).toBe(false);
    // SCHEDULED before its start: hidden; stored ACTIVE but already past its end: hidden.
    expect(isCollectionLive({ ...base, status: "SCHEDULED", startsAt: new Date("2026-11-21T03:00:00.000Z") }, now)).toBe(false);
    expect(isCollectionLive({ ...base, status: "SCHEDULED", startsAt: new Date("2026-11-20T03:00:00.000Z") }, now)).toBe(true);
    expect(isCollectionLive({ ...base, endsAt: new Date("2026-11-20T14:59:59.000Z") }, now)).toBe(false);
  });

  it("menu order: sort order, then label, then id (deterministic)", () => {
    const items = [
      toNavigationCollection({ id: "c", name: "Drop", slug: "drop", storefrontCollectionLabel: null, storefrontCollectionSortOrder: 20 }),
      toNavigationCollection({ id: "b", name: "x", slug: "liquidacao", storefrontCollectionLabel: "Liquidação", storefrontCollectionSortOrder: 10 }),
      toNavigationCollection({ id: "a", name: "x", slug: "sale-black", storefrontCollectionLabel: "SALE BLACK", storefrontCollectionSortOrder: 10 }),
    ].sort(compareCollections);
    expect(items.map((item) => item.slug)).toEqual(["liquidacao", "sale-black", "drop"]);
    expect(items[1]).toEqual({ id: "a", label: "SALE BLACK", slug: "sale-black", href: "/colecao/sale-black", sortOrder: 10 });
  });

  it("duplicate menu names are detected case/spacing-insensitively", () => {
    expect(getCollectionLabelKey("SALE  BLACK ")).toBe(getCollectionLabelKey("sale black"));
  });

  it("description comes from the promotion's own copy; nothing invented", () => {
    expect(getCollectionDescription({ subheadline: "Até 30% off", headline: "Black Friday" })).toBe("Até 30% off");
    expect(getCollectionDescription({ subheadline: null, headline: "Black Friday" })).toBe("Black Friday");
    expect(getCollectionDescription({ subheadline: " ", headline: null })).toBeNull();
  });

  describe("Admin form", () => {
    function form(fields: Record<string, string>) {
      const data = new FormData();
      for (const [key, value] of Object.entries({ name: "SALE BLACK", type: "PERCENTAGE", value: "30", scope: "SELECTED_PRODUCTS", productIds: "prod_1", ...fields })) data.append(key, value);
      return data;
    }

    it("reads the three collection fields; defaults keep the collection off", () => {
      const off = parsePromotionForm(form({}), { requireComplete: false, now });
      expect(off.ok && off.input).toMatchObject({ storefrontCollectionEnabled: false, storefrontCollectionLabel: null, storefrontCollectionSortOrder: 0 });
      const on = parsePromotionForm(form({ storefrontCollectionEnabled: "on", storefrontCollectionLabel: "  SALE   BLACK ", storefrontCollectionSortOrder: "10" }), { requireComplete: false, now });
      expect(on.ok && on.input).toMatchObject({ storefrontCollectionEnabled: true, storefrontCollectionLabel: "SALE BLACK", storefrontCollectionSortOrder: 10 });
    });

    it("the label is plain text (no HTML), capped at 40 characters", () => {
      const parsed = parsePromotionForm(form({ storefrontCollectionEnabled: "on", storefrontCollectionLabel: `<script>x</script>${"A".repeat(60)}` }), { requireComplete: false, now });
      expect(parsed.ok).toBe(true);
      const label = parsed.ok ? parsed.input.storefrontCollectionLabel ?? "" : "";
      expect(label).not.toMatch(/[<>]/);
      expect(label.length).toBeLessThanOrEqual(40);
    });

    it("the menu order must be a whole number from 0 to 999", () => {
      for (const bad of ["-1", "1000", "2.5", "abc"]) {
        const parsed = parsePromotionForm(form({ storefrontCollectionSortOrder: bad }), { requireComplete: false, now });
        expect(parsed.ok, bad).toBe(false);
      }
    });

    it("turning the collection on changes nothing else of the promotion", () => {
      const off = parsePromotionForm(form({}), { requireComplete: true, now });
      const on = parsePromotionForm(form({ storefrontCollectionEnabled: "on", storefrontCollectionLabel: "SALE BLACK" }), { requireComplete: true, now });
      expect(off.ok && on.ok).toBe(true);
      if (!off.ok || !on.ok) return;
      const keys = ["storefrontCollectionEnabled", "storefrontCollectionLabel", "storefrontCollectionSortOrder"];
      const strip = (input: typeof on.input) => Object.fromEntries(Object.entries(input).filter(([key]) => !keys.includes(key)));
      expect(strip(on.input)).toEqual(strip(off.input));
    });
  });
});
