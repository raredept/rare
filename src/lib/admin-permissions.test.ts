import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSIONS,
  getAdminHomePath,
  getAdminPermissions,
  hasAdminPermission,
  isAdminRole,
  isAssignableAdminRole,
  USER_MANAGER_ROLES,
} from "@/lib/admin-permissions";

const systemOnly = ["system.users", "system.security", "system.readiness", "system.settings"] as const;
const commerce = ADMIN_PERMISSIONS.filter((permission) => permission.startsWith("commerce.") || permission === "analytics.sales");

describe("Admin role permissions", () => {
  it("denies every permission to an unknown, customer or missing role", () => {
    for (const role of ["CUSTOMER", "admin", "", null, undefined, 1, {}]) {
      expect(getAdminPermissions(role)).toEqual([]);
      for (const permission of ADMIN_PERMISSIONS) expect(hasAdminPermission(role, permission)).toBe(false);
    }
  });

  it("gives SYSTEM_ADMIN the system areas and site analytics, but no commercial screens", () => {
    for (const permission of [...systemOnly, "self.account", "analytics.site"] as const) {
      expect(hasAdminPermission("SYSTEM_ADMIN", permission)).toBe(true);
    }
    for (const permission of commerce) expect(hasAdminPermission("SYSTEM_ADMIN", permission)).toBe(false);
  });

  it("gives SELLER_ADMIN the commercial areas and site analytics, but no system area", () => {
    for (const permission of [...commerce, "self.account", "analytics.site"] as const) {
      expect(hasAdminPermission("SELLER_ADMIN", permission)).toBe(true);
    }
    for (const permission of systemOnly) expect(hasAdminPermission("SELLER_ADMIN", permission)).toBe(false);
  });

  it("keeps the pre-RBAC ADMIN role on full access until an operator assigns a scoped role", () => {
    expect(getAdminPermissions("ADMIN")).toEqual([...ADMIN_PERMISSIONS]);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAssignableAdminRole("ADMIN")).toBe(false);
  });

  it("only offers the two scoped roles for assignment", () => {
    expect(isAssignableAdminRole("SYSTEM_ADMIN")).toBe(true);
    expect(isAssignableAdminRole("SELLER_ADMIN")).toBe(true);
    expect(isAssignableAdminRole("CUSTOMER")).toBe(false);
  });

  it("counts ADMIN and SYSTEM_ADMIN as user managers for the last-manager rule", () => {
    expect([...USER_MANAGER_ROLES].sort()).toEqual(["ADMIN", "SYSTEM_ADMIN"]);
  });

  it("lands each role on a page it can open", () => {
    expect(getAdminHomePath("SELLER_ADMIN")).toBe("/admin");
    expect(getAdminHomePath("ADMIN")).toBe("/admin");
    expect(getAdminHomePath("SYSTEM_ADMIN")).toBe("/admin/users");
    expect(getAdminHomePath("CUSTOMER")).toBe("/admin/conta");
  });
});
