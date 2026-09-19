import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

function validIp(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/**
 * Resolve the client address used as a rate-limit identity.
 *
 * The left-most X-Forwarded-For entry is supplied by the client and must never
 * be trusted: any caller can rotate it per request to obtain a fresh bucket.
 * Precedence:
 *  1. CF-Connecting-IP, which Cloudflare overwrites at the edge;
 *  2. X-Real-IP, which the Railway edge sets;
 *  3. the right-most X-Forwarded-For entry, appended by the closest proxy.
 */
export function getClientIp(headers: HeaderReader) {
  const forwarded = headers.get("x-forwarded-for")?.split(",") ?? [];
  return (
    validIp(headers.get("cf-connecting-ip")) ??
    validIp(headers.get("x-real-ip")) ??
    validIp(forwarded[forwarded.length - 1]) ??
    "local"
  );
}
