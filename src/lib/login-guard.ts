import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";

// Valid cost-12 bcrypt hash of a throwaway string. It is not a credential: it only
// makes unknown-account logins spend the same CPU time as known-account logins.
const TIMING_EQUALIZER_HASH = "$2b$12$V6kdWvrsv7m.L9ZtePLobup3fmZ7p/2VJ3t4jNRFu8IDLHCr44rJ6";

/** Compare a password without revealing, through timing, whether the account exists. */
export async function verifyPasswordConstantCost(password: string, passwordHash: string | null | undefined) {
  const matches = await bcrypt.compare(password, passwordHash ?? TIMING_EQUALIZER_HASH);
  return Boolean(passwordHash) && matches;
}

export async function getActionClientIp() {
  try {
    return getClientIp(await headers());
  } catch {
    return "local";
  }
}

/**
 * Three layers, so one client cannot lock the account for everyone else and a
 * distributed guess run still hits a ceiling:
 *  - per identifier + client address (tight),
 *  - per client address across identifiers (stops spraying),
 *  - per identifier overall (ceiling for distributed attempts).
 */
export async function checkLoginRateLimit(scope: string, identifier: string) {
  const ip = await getActionClientIp();
  const results = await Promise.all([
    rateLimit(`${scope}:${identifier}:${ip}`, 8, 5 * 60_000),
    rateLimit(`${scope}-ip:${ip}`, 40, 5 * 60_000),
    rateLimit(`${scope}-account:${identifier}`, 60, 15 * 60_000),
  ]);
  return results.every((result) => result.ok);
}
