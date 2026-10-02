import { expect, it, vi } from "vitest";
import { getCriticalStock } from "@/lib/admin-analytics";

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

it("ranks critical active variants by available rather than physical stock before limiting", async () => {
  queryRaw.mockResolvedValue([{ productId: "p1", productTitle: "Reserved", size: "M", stock: 500, reservedStock: 499, sellable: 1 }]);
  const result = await getCriticalStock();
  const strings = queryRaw.mock.calls[0][0].join("?");
  expect(strings).toContain('"v"."stock" - "v"."reservedStock" <=');
  expect(strings).toContain('ORDER BY ("v"."stock" - "v"."reservedStock") ASC');
  expect(strings).toContain('"v"."active" = true AND "p"."active" = true');
  expect(queryRaw.mock.calls[0].slice(1)).toEqual([3, 12]);
  expect(result[0].sellable).toBe(1);
});
