import { BlockList, isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

// Published by Cloudflare (https://www.cloudflare.com/ips-v4 and /ips-v6).
const cloudflareRanges: Array<[string, number, "ipv4" | "ipv6"]> = [
  ["173.245.48.0", 20, "ipv4"], ["103.21.244.0", 22, "ipv4"], ["103.22.200.0", 22, "ipv4"],
  ["103.31.4.0", 22, "ipv4"], ["141.101.64.0", 18, "ipv4"], ["108.162.192.0", 18, "ipv4"],
  ["190.93.240.0", 20, "ipv4"], ["188.114.96.0", 20, "ipv4"], ["197.234.240.0", 22, "ipv4"],
  ["198.41.128.0", 17, "ipv4"], ["162.158.0.0", 15, "ipv4"], ["104.16.0.0", 13, "ipv4"],
  ["104.24.0.0", 14, "ipv4"], ["172.64.0.0", 13, "ipv4"], ["131.0.72.0", 22, "ipv4"],
  ["2400:cb00::", 32, "ipv6"], ["2606:4700::", 32, "ipv6"], ["2803:f800::", 32, "ipv6"],
  ["2405:b500::", 32, "ipv6"], ["2405:8100::", 32, "ipv6"], ["2a06:98c0::", 29, "ipv6"],
  ["2c0f:f248::", 32, "ipv6"],
];

const cloudflare = new BlockList();
for (const [address, prefix, family] of cloudflareRanges) cloudflare.addSubnet(address, prefix, family);

function validIp(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

export function isCloudflareAddress(address: string) {
  const family = isIP(address);
  return family ? cloudflare.check(address, family === 4 ? "ipv4" : "ipv6") : false;
}

export type ClientIpResolution = { ip: string; source: "cf-connecting-ip" | "x-real-ip" | "x-forwarded-for" | "none" };

/**
 * Resolve the address used as a rate-limit identity.
 *
 * Every request header except the TCP peer is attacker controlled. Railway's edge
 * overwrites X-Real-IP with the real peer (verified on staging: rotating a
 * client-sent X-Real-IP or a left-most X-Forwarded-For does not change the
 * identity), but it forwards a client-sent CF-Connecting-IP untouched. Because
 * Railway routes by Host, anyone can reach the origin without going through
 * Cloudflare, so CF-Connecting-IP is honoured only when that peer is a Cloudflare
 * address, i.e. when Cloudflare really did set it.
 *
 *  1. peer is Cloudflare  -> CF-Connecting-IP (authentic);
 *  2. peer is anyone else -> the peer itself;
 *  3. otherwise           -> right-most non-Cloudflare X-Forwarded-For entry (appended
 *                            by our own proxies), never the client-controlled left side.
 */
export function resolveClientIp(headers: HeaderReader): ClientIpResolution {
  const peer = validIp(headers.get("x-real-ip"));
  if (peer && !isCloudflareAddress(peer)) return { ip: peer, source: "x-real-ip" };

  if (peer) {
    const forwarded = validIp(headers.get("cf-connecting-ip"));
    if (forwarded) return { ip: forwarded, source: "cf-connecting-ip" };
  }

  // Walk the chain from the right (entries appended by our own proxies) and skip
  // Cloudflare's own addresses, so a shared edge address never becomes an identity.
  const chain = (headers.get("x-forwarded-for")?.split(",") ?? []).reverse();
  for (const entry of chain) {
    const candidate = validIp(entry);
    if (candidate && !isCloudflareAddress(candidate)) return { ip: candidate, source: "x-forwarded-for" };
  }

  return peer ? { ip: peer, source: "x-real-ip" } : { ip: "local", source: "none" };
}

export function getClientIp(headers: HeaderReader) {
  return resolveClientIp(headers).ip;
}
