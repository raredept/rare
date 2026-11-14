import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_PERMISSIONS } from "@/lib/admin-permissions";

/**
 * The (protected) layout calls requireAdmin, but a layout is not re-rendered on
 * client-side navigation, so it cannot be the only session check (Next.js 16
 * authentication guide, "Layouts and auth checks"). Every Admin page therefore
 * checks the session and its own module permission as its first statement.
 */

const root = path.join(process.cwd(), "src/app/admin/(protected)");

// Top-level directory -> permission its pages and Server Actions must demand.
const MODULE_PERMISSIONS: Record<string, (typeof ADMIN_PERMISSIONS)[number]> = {
  "": "self.account",
  analytics: "analytics.sales",
  banners: "commerce.catalog",
  categories: "commerce.catalog",
  conta: "self.account",
  customers: "commerce.customers",
  notifications: "commerce.notifications",
  orders: "commerce.orders",
  products: "commerce.products",
  promotions: "commerce.promotions",
  readiness: "system.readiness",
  security: "system.security",
  "sem-acesso": "self.account",
  settings: "system.settings",
  users: "system.users",
};

function walk(dir: string, fileName: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, fileName);
    return entry.name === fileName ? [full] : [];
  });
}

function moduleOf(file: string) {
  const parts = path.relative(root, file).split(path.sep);
  return parts.length > 1 ? parts[0] : "";
}

describe("Admin page guards", () => {
  const files = walk(root, "page.tsx");

  it("finds the Admin pages", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it.each(files.map((file) => [path.relative(root, file), file]))("%s checks its module permission before anything else", (_name, file) => {
    const permission = MODULE_PERMISSIONS[moduleOf(file)];
    expect(permission, "every Admin module needs an explicit permission").toBeDefined();
    const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const body = source.match(/export default async function \w+\([^)]*\)[^{]*\{\n((?:\s*\/\/[^\n]*\n)*)\s*([^\n]+)/);
    expect(body, "default export must be an async function").not.toBeNull();
    expect(body![2].trim()).toBe(
      body![2].trim().startsWith("const ") ? `const admin = await requireAdmin("${permission}");` : `await requireAdmin("${permission}");`,
    );
  });

  it("sends a non-commerce Admin away from the commercial dashboard before loading data", () => {
    const source = readFileSync(path.join(root, "page.tsx"), "utf8").replace(/\r\n/g, "\n");
    const guard = source.indexOf('if (!hasAdminPermission(admin.role, "commerce.dashboard")) redirect(getAdminHomePath(admin.role));');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf("await Promise.all"));
  });
});

describe("Admin Server Action guards", () => {
  const files = walk(root, "actions.ts").filter((file) => moduleOf(file) !== "");

  it("finds the Admin Server Action modules", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files.map((file) => [path.relative(root, file), file]))("%s authorizes every exported action before awaiting anything else", (_name, file) => {
    const permission = MODULE_PERMISSIONS[moduleOf(file)];
    expect(permission, "every Admin module needs an explicit permission").toBeDefined();
    const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const chunks = source.split(/^export async function /m).slice(1);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const name = chunk.slice(0, chunk.indexOf("("));
      const firstAwait = /\bawait [^;]+;/.exec(chunk)?.[0];
      expect(firstAwait, name).toBe(`await requireAdmin("${permission}");`);
    }
  });
});
