// Pure role → permission map (no database, no Node APIs): shared by the server guards, the edge
// proxy and the client navigation. Anything not listed here is denied.

export const ADMIN_ROLES = ["ADMIN", "SYSTEM_ADMIN", "SELLER_ADMIN"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Roles an operator can assign. ADMIN is legacy and can no longer be granted. */
export const ASSIGNABLE_ADMIN_ROLES = ["SYSTEM_ADMIN", "SELLER_ADMIN"] as const;
export type AssignableAdminRole = (typeof ASSIGNABLE_ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "self.account",
  "system.users",
  "system.security",
  "system.readiness",
  "system.settings",
  "analytics.site",
  "analytics.sales",
  "commerce.dashboard",
  "commerce.orders",
  "commerce.customers",
  "commerce.products",
  "commerce.inventory",
  "commerce.promotions",
  "commerce.catalog",
  "commerce.media",
  "commerce.notifications",
  "commerce.support",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const SYSTEM_PERMISSIONS: readonly AdminPermission[] = [
  "self.account",
  "system.users",
  "system.security",
  "system.readiness",
  "system.settings",
  "analytics.site",
];

const SELLER_PERMISSIONS: readonly AdminPermission[] = [
  "self.account",
  "analytics.site",
  "analytics.sales",
  "commerce.dashboard",
  "commerce.orders",
  "commerce.customers",
  "commerce.products",
  "commerce.inventory",
  "commerce.promotions",
  "commerce.catalog",
  "commerce.media",
  "commerce.notifications",
  "commerce.support",
];

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  // Transitional: accounts created before RBAC must not lose access on deploy.
  ADMIN: new Set(ADMIN_PERMISSIONS),
  SYSTEM_ADMIN: new Set(SYSTEM_PERMISSIONS),
  SELLER_ADMIN: new Set(SELLER_PERMISSIONS),
};

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin legado (acesso total)",
  SYSTEM_ADMIN: "Administrador de Sistema",
  SELLER_ADMIN: "Administrador Vendedor",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isAssignableAdminRole(value: unknown): value is AssignableAdminRole {
  return typeof value === "string" && (ASSIGNABLE_ADMIN_ROLES as readonly string[]).includes(value);
}

export function hasAdminPermission(role: unknown, permission: AdminPermission) {
  return isAdminRole(role) && ROLE_PERMISSIONS[role].has(permission);
}

export function getAdminPermissions(role: unknown): AdminPermission[] {
  return isAdminRole(role) ? ADMIN_PERMISSIONS.filter((permission) => ROLE_PERMISSIONS[role].has(permission)) : [];
}

/** Roles that can manage users; at least one active account must always hold one of them. */
export const USER_MANAGER_ROLES = ADMIN_ROLES.filter((role) => ROLE_PERMISSIONS[role].has("system.users"));

/** Where an Admin lands: the commercial dashboard if allowed, otherwise the first area they may open. */
export function getAdminHomePath(role: unknown) {
  if (hasAdminPermission(role, "commerce.dashboard")) return "/admin";
  if (hasAdminPermission(role, "system.users")) return "/admin/users";
  return "/admin/conta";
}
