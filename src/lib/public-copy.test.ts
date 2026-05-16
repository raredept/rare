import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicCopyFiles = [
  "src/app/(store)/page.tsx",
  "src/app/(store)/categoria/[slug]/page.tsx",
  "src/app/(store)/trocas-e-devolucoes/page.tsx",
  "src/app/(store)/sobre/page.tsx",
  "src/app/layout.tsx",
  "src/components/store/footer.tsx",
  "src/components/store/product-detail-client.tsx",
  "src/components/store/cart-page-client.tsx",
  "src/lib/home-hero-slides.ts",
  "src/lib/storefront.ts",
];

describe("public storefront copy", () => {
  it("keeps banned robotic phrases out of public copy sources", () => {
    const copy = publicCopyFiles.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");

    expect(copy).not.toContain("A home aponta");
    expect(copy).not.toContain("experiência de compra limpa");
  });
});
