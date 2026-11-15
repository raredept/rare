export const ADMIN_SESSION_COOKIE = "rare_admin_session";
export const CUSTOMER_SESSION_COOKIE = "rare_customer_session";
/** Short-lived proof that the password was right; grants nothing but the MFA step. */
export const ADMIN_MFA_PENDING_COOKIE = "rare_admin_mfa_pending";
/** Admin pages reachable without a full Admin session. Each one checks its own credential. */
export const ADMIN_PUBLIC_PATHS: readonly string[] = ["/admin/login", "/admin/mfa", "/admin/mfa/setup"];
