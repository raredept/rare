import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PERMISSIONS, hasAdminPermission, type AdminPermission } from "@/lib/admin-permissions";

// The full identity x permission matrix, executed against the real authorization gate
// (requireAdmin). Every Admin page, Server Action and /api/admin route goes through that gate
// with an explicit permission (see the static proofs at the end and page-guards.test.ts), so the
// matrix below is what each of those surfaces enforces.

const SECRET = "test-admin-session-secret-with-more-than-32-characters";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  findFirst: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: mocks.cookieGet, delete: vi.fn() })) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env", () => ({ getAdminSessionSecret: () => "test-admin-session-secret-with-more-than-32-characters" }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.findFirst, updateMany: vi.fn() } } }));

type Role = "SYSTEM_ADMIN" | "SELLER_ADMIN";

function row(role: Role, overrides: Record<string, unknown> = {}) {
  return {
    id: `${role}-1`, name: role, email: `${role.toLowerCase()}@example.com`, username: null, role,
    mustChangePassword: false, passwordHash: "existing-password-hash", sessionVersion: 0, mfaEnabledAt: new Date("2026-11-01T00:00:00Z"),
    ...overrides,
  };
}

async function cookieFor(role: Role, options: { mfa?: boolean; sessionVersion?: number } = {}) {
  const { signAdminSession } = await import("@/lib/auth");
  const token = await signAdminSession(
    { id: `${role}-1`, email: `${role.toLowerCase()}@example.com`, role, mustChangePassword: false, passwordHash: "existing-password-hash", sessionVersion: options.sessionVersion ?? 0 },
    { mfaVerifiedAt: options.mfa === false ? null : new Date() },
  );
  mocks.cookieGet.mockImplementation((name: string) => (name.includes("pending") ? undefined : { value: token }));
}

async function attempt(permission: AdminPermission) {
  const { requireAdmin } = await import("@/lib/auth");
  return requireAdmin(permission).then(
    () => "ALLOW",
    (error: Error) => error.message.replace("NEXT_REDIRECT:", "DENY -> "),
  );
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_MFA_REQUIRED", "true");
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

describe("RBAC matrix: identities that are not a signed-in Admin", () => {
  it.each(ADMIN_PERMISSIONS)("anonymous -> %s is sent to the login, before any query", async (permission) => {
    mocks.cookieGet.mockReturnValue(undefined);
    expect(await attempt(permission)).toBe("DENY -> /admin/login");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it.each(ADMIN_PERMISSIONS)("customer -> %s is sent to the login, before any query", async (permission) => {
    const { SignJWT } = await import("jose");
    // A customer session: valid signature shape, but neither the Admin type nor an Admin role.
    const token = await new SignJWT({ typ: "customer", email: "cliente@example.com", role: "CUSTOMER", credentialVersion: "x", sessionVersion: 0, mfa: true })
      .setProtectedHeader({ alg: "HS256" }).setSubject("customer-1").setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    mocks.cookieGet.mockReturnValue({ value: token });
    expect(await attempt(permission)).toBe("DENY -> /admin/login");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it.each((["SYSTEM_ADMIN", "SELLER_ADMIN"] as const).flatMap((role) => ADMIN_PERMISSIONS.map((permission) => [role, permission] as const)))(
    "%s with the password step only (MFA pending) -> %s is sent to the login",
    async (role, permission) => {
      await cookieFor(role, { mfa: false });
      mocks.findFirst.mockResolvedValue(row(role));
      expect(await attempt(permission)).toBe("DENY -> /admin/login");
    },
  );

  it.each(["SYSTEM_ADMIN", "SELLER_ADMIN"] as const)("%s without an enrolled factor still cannot skip MFA when it is required", async (role) => {
    await cookieFor(role, { mfa: false });
    mocks.findFirst.mockResolvedValue(row(role, { mfaEnabledAt: null }));
    expect(await attempt("self.account")).toBe("DENY -> /admin/login");
  });

  it.each((["SYSTEM_ADMIN", "SELLER_ADMIN"] as const).flatMap((role) => ADMIN_PERMISSIONS.map((permission) => [role, permission] as const)))(
    "deactivated %s -> %s is sent to the login",
    async (role, permission) => {
      await cookieFor(role);
      mocks.findFirst.mockResolvedValue(null); // the query filters on active: true and the Admin roles
      expect(await attempt(permission)).toBe("DENY -> /admin/login");
    },
  );

  it.each(["SYSTEM_ADMIN", "SELLER_ADMIN"] as const)("%s whose sessions were revoked (role change, deactivation, MFA reset) is sent to the login", async (role) => {
    await cookieFor(role, { sessionVersion: 0 });
    mocks.findFirst.mockResolvedValue(row(role, { sessionVersion: 1 }));
    expect(await attempt("self.account")).toBe("DENY -> /admin/login");
  });

  it.each(["SYSTEM_ADMIN", "SELLER_ADMIN"] as const)("%s with a pending password change reaches nothing but the change-password page", async (role) => {
    await cookieFor(role);
    mocks.findFirst.mockResolvedValue(row(role, { mustChangePassword: true }));
    for (const permission of ADMIN_PERMISSIONS) expect(await attempt(permission)).toBe("DENY -> /admin/change-password");
  });
});

describe("RBAC matrix: signed-in Admins with a verified second factor", () => {
  const expected: Record<Role, Record<AdminPermission, boolean>> = {
    SYSTEM_ADMIN: {
      "self.account": true, "system.users": true, "system.security": true, "system.readiness": true, "system.settings": true,
      "analytics.site": true, "analytics.sales": false, "commerce.dashboard": false, "commerce.orders": false, "commerce.customers": false,
      "commerce.products": false, "commerce.inventory": false, "commerce.promotions": false, "commerce.catalog": false, "commerce.media": false,
      "commerce.notifications": false, "commerce.support": false,
    },
    SELLER_ADMIN: {
      "self.account": true, "system.users": false, "system.security": false, "system.readiness": false, "system.settings": false,
      "analytics.site": true, "analytics.sales": true, "commerce.dashboard": true, "commerce.orders": true, "commerce.customers": true,
      "commerce.products": true, "commerce.inventory": true, "commerce.promotions": true, "commerce.catalog": true, "commerce.media": true,
      "commerce.notifications": true, "commerce.support": true,
    },
  };

  it("spells out every permission for both roles (a new permission must be decided here)", () => {
    for (const role of ["SYSTEM_ADMIN", "SELLER_ADMIN"] as const) expect(Object.keys(expected[role]).sort()).toEqual([...ADMIN_PERMISSIONS].sort());
  });

  it.each((["SYSTEM_ADMIN", "SELLER_ADMIN"] as const).flatMap((role) => ADMIN_PERMISSIONS.map((permission) => [role, permission, expected[role][permission]] as const)))(
    "%s -> %s: allowed=%s",
    async (role, permission, allowed) => {
      await cookieFor(role);
      mocks.findFirst.mockResolvedValue(row(role));
      expect(await attempt(permission)).toBe(allowed ? "ALLOW" : "DENY -> /admin/sem-acesso");
      expect(hasAdminPermission(role, permission)).toBe(allowed);
    },
  );

  it("a token that claims SYSTEM_ADMIN gets the permissions of the role stored in the database", async () => {
    await cookieFor("SYSTEM_ADMIN");
    mocks.findFirst.mockResolvedValue(row("SELLER_ADMIN", { id: "SYSTEM_ADMIN-1" }));
    expect(await attempt("system.users")).toBe("DENY -> /admin/sem-acesso");
    expect(await attempt("commerce.orders")).toBe("ALLOW");
  });
});

// Which permission each mutation surface demands. Combined with the matrix above this gives the
// required rows: SYSTEM_ADMIN cannot mutate products, orders or promotions; SELLER_ADMIN can; and
// SELLER_ADMIN cannot reach users, security, readiness or settings.
describe("RBAC matrix: surfaces", () => {
  const root = process.cwd();
  const read = (file: string) => readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

  function exportedFunctions(file: string) {
    return read(file).split(/^export async function /m).slice(1).map((chunk) => ({
      name: chunk.slice(0, chunk.indexOf("(")),
      firstAwait: /\bawait [^;]+;/.exec(chunk)?.[0],
    }));
  }

  it.each([
    ["src/app/admin/(protected)/products/actions.ts", "commerce.products"],
    ["src/app/admin/(protected)/orders/actions.ts", "commerce.orders"],
    ["src/app/admin/(protected)/promotions/actions.ts", "commerce.promotions"],
    ["src/app/admin/(protected)/categories/actions.ts", "commerce.catalog"],
    ["src/app/admin/(protected)/banners/actions.ts", "commerce.catalog"],
    ["src/app/admin/(protected)/notifications/actions.ts", "commerce.notifications"],
    ["src/app/admin/(protected)/support/actions.ts", "commerce.support"],
    ["src/app/admin/(protected)/users/actions.ts", "system.users"],
    ["src/app/admin/(protected)/settings/actions.ts", "system.settings"],
    ["src/app/admin/(protected)/readiness/actions.ts", "system.readiness"],
    ["src/app/admin/(protected)/conta/actions.ts", "self.account"],
  ] as const)("every Server Action in %s authorizes %s before anything else", (file, permission) => {
    const actions = exportedFunctions(file);
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(action.firstAwait, action.name).toBe(`await requireAdmin("${permission}");`);
  });

  it("every /api/admin route handler authorizes a permission before reading the request", () => {
    const apiRoot = path.join(root, "src/app/api/admin");
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : entry.name === "route.ts" ? [full] : [];
    });
    const routes = walk(apiRoot);
    expect(routes.length).toBeGreaterThanOrEqual(4);
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      const handlers = source.split(/^export async function (?=GET|POST|PUT|PATCH|DELETE)/m).slice(1);
      expect(handlers.length, route).toBeGreaterThan(0);
      for (const handler of handlers) {
        const firstAwait = /\bawait [^;]+;/.exec(handler)?.[0] ?? "";
        // Either the shared gate with a permission, or the route's own JSON gate that checks one.
        expect(firstAwait, route).toMatch(/await requireAdmin\("[a-z.]+"\);|await requireApiAdmin\(\);/);
      }
      if (source.includes("requireApiAdmin")) expect(source, route).toMatch(/hasAdminPermission\(admin\.role, "[a-z.]+"\)/);
    }
  });

  it("the health endpoint only gives configuration detail to an Admin who can see readiness", () => {
    expect(read("src/app/api/health/route.ts")).toContain('hasAdminPermission(admin.role, "system.readiness")');
  });

  it("only the layout asks for a session without a permission", () => {
    const adminRoot = path.join(root, "src/app");
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
    });
    const bare = walk(adminRoot).filter((file) => /requireAdmin\(\s*\)/.test(readFileSync(file, "utf8")));
    expect(bare.map((file) => path.relative(root, file).replaceAll(path.sep, "/"))).toEqual(["src/app/admin/(protected)/layout.tsx"]);
  });
});
