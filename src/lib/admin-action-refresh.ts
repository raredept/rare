export const ADMIN_ACTION_REFRESH_PARAM = "refresh";

export function withAdminActionRefresh(path: string, nonce = Date.now()) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${ADMIN_ACTION_REFRESH_PARAM}=${nonce}`;
}
