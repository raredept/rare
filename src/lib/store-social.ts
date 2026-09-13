export const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/rare.deptt/";

export function normalizeInstagramUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname) || url.username || url.password || url.port) return null;
    const profile = url.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/)?.[1];
    if (!profile || url.search || url.hash) return null;
    return `https://www.instagram.com/${profile}/`;
  } catch {
    return null;
  }
}

export function getInstagramUrl(value?: string | null) {
  return normalizeInstagramUrl(value) ?? DEFAULT_INSTAGRAM_URL;
}
