import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Admin is always rendered inside `.admin-dark`, which remaps a fixed list
 * of light utility backgrounds. A light background outside that list stays
 * light under light text: unread notifications used `bg-amber-50/50`, which
 * the theme did not remap, and rendered at 1.3:1 contrast (found by axe on
 * staging). Every light "-50" background in Admin code must be remapped.
 */

const roots = ["src/app/admin", "src/components/admin"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
  });
}

describe("admin dark theme", () => {
  it("remaps every light -50 background used in Admin code", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const used = new Set<string>();
    for (const file of roots.flatMap((root) => sourceFiles(path.join(process.cwd(), root)))) {
      for (const [, cls] of readFileSync(file, "utf8").matchAll(/(?<![\w-])(bg-[a-z]+-50(?:\/\d+)?)(?![\w/-])/g)) used.add(cls);
    }

    // In CSS a "/" in a class name is written "\/".
    const missing = [...used].filter((cls) => !css.includes(`.admin-dark .${cls.replace("/", "\\/")}`));
    expect(used.size).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
