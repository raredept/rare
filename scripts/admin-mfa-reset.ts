import "dotenv/config";
import { isProductionAppEnv } from "../src/lib/deployment-environment";

// High-risk recovery: removes the second factor of ONE Admin account, every recovery code and every
// session of that account. Run only by the technical owner, with database access, after confirming
// the person's identity out of band (see docs/runbooks/admin-mfa-recovery.md).
//
//   ADMIN_MFA_RESET_EMAIL=admin@example.com ADMIN_MFA_RESET_CONFIRM=RESET-MFA:admin@example.com \
//   ADMIN_MFA_RESET_REASON="lost phone and codes" [CONFIRM_PRODUCTION_MFA_RESET=true] npm run admin:mfa-reset

async function main() {
  const email = process.env.ADMIN_MFA_RESET_EMAIL?.trim().toLowerCase() ?? "";
  const reason = process.env.ADMIN_MFA_RESET_REASON?.trim() ?? "";
  if (!email) throw new Error("ADMIN_MFA_RESET_EMAIL is required.");
  if (process.env.ADMIN_MFA_RESET_CONFIRM !== `RESET-MFA:${email}`) {
    throw new Error("Set ADMIN_MFA_RESET_CONFIRM=RESET-MFA:<email> to confirm this exact account.");
  }
  if (reason.length < 8) throw new Error("ADMIN_MFA_RESET_REASON (at least 8 characters) is required for the audit log.");
  if (isProductionAppEnv() && process.env.CONFIRM_PRODUCTION_MFA_RESET !== "true") {
    throw new Error("Set CONFIRM_PRODUCTION_MFA_RESET=true to reset MFA in production.");
  }

  const { prisma } = await import("../src/lib/prisma");
  const { resetAdminMfa } = await import("../src/lib/admin-mfa");
  try {
    const user = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "SYSTEM_ADMIN", "SELLER_ADMIN"] }, email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (!user) throw new Error("No Admin account with this e-mail.");
    const result = await resetAdminMfa(user.id, "cli:admin-mfa-reset", reason);
    console.log(JSON.stringify({ reset: true, recoveryCodesRemoved: result.recoveryCodesRemoved, sessionsRevoked: true }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "MFA reset failed.");
  process.exitCode = 1;
});
