import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The (protected) layout calls requireAdmin, but a layout is not re-rendered on
 * client-side navigation, so it cannot be the only session check (Next.js 16
 * authentication guide, "Layouts and auth checks"). Every Admin page therefore
 * checks the session itself, as its first statement, before touching data.
 */

const root = path.join(process.cwd(), "src/app/admin/(protected)");

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

describe("Admin page guards", () => {
  const files = pages(root);

  it("finds the Admin pages", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it.each(files.map((file) => [path.relative(root, file), file]))("%s checks the session before anything else", (_name, file) => {
    const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const body = source.match(/export default async function \w+\([^)]*\)[^{]*\{\n((?:\s*\/\/[^\n]*\n)*)\s*([^\n]+)/);
    expect(body, "default export must be an async function").not.toBeNull();
    expect(body![2].trim()).toBe("await requireAdmin();");
  });
});
