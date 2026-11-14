import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

// Real PostgreSQL, synthetic accounts, disposable database. Proves the invariant that unit tests
// can only mock: no interleaving of concurrent demotions / deactivations leaves the store without
// an active user manager, and the loser gets a business error instead of a deadlock.
// Refuses any non-local database.

const ROUNDS = 15;

async function main() {
  const source = new URL(process.env.QA_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_rbac_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const maintenanceUrl = new URL(source);
  maintenanceUrl.pathname = "/postgres";
  const maintenance = new pg.Client({ connectionString: maintenanceUrl.toString() });
  let created = false;
  let database: Awaited<typeof import("../src/lib/prisma")>["prisma"] | undefined;
  await maintenance.connect();
  try {
    await maintenance.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    source.pathname = `/${databaseName}`;
    Object.assign(process.env, {
      DATABASE_URL: source.toString(), APP_ENV: "test", NODE_ENV: "test", APP_URL: "http://localhost:3000",
      ADMIN_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64"), RATE_LIMIT_DRIVER: "memory", EMAIL_DRIVER: "disabled",
    });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: process.env, windowsHide: true, stdio: "pipe" });
      child.stdout.resume();
      child.stderr.resume();
      child.once("error", reject);
      child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("Isolated migration failed."))));
    });

    const { prisma } = await import("../src/lib/prisma");
    database = prisma;
    const { AdminUserError, assignAdminRole, createAdminUser, resetAdminUserMfa, revokeAdminUserSessions, setAdminUserActive } = await import("../src/lib/admin-users");
    const { hasAdminPermission, ADMIN_PERMISSIONS } = await import("../src/lib/admin-permissions");
    const results: string[] = [];
    const pass = (name: string) => { results.push(name); console.log(`PASS ${name}`); };

    type Role = "ADMIN" | "SYSTEM_ADMIN" | "SELLER_ADMIN";
    let counter = 0;
    const account = async (role: Role, active = true) => {
      counter += 1;
      const user = await prisma.user.create({
        data: { name: `QA ${role} ${counter}`, email: `qa-rbac-${counter}-${randomBytes(3).toString("hex")}@rare.invalid`, passwordHash: "x", role, active, mustChangePassword: false },
        select: { id: true },
      });
      return user.id;
    };
    const reset = async () => {
      await prisma.adminAuditLog.deleteMany({});
      await prisma.adminNotification.deleteMany({});
      await prisma.user.deleteMany({});
    };
    const activeManagers = () => prisma.user.count({ where: { active: true, role: { in: ["ADMIN", "SYSTEM_ADMIN"] } } });
    const outcome = async (run: Promise<unknown>) => run.then(
      () => "ok" as const,
      (error: unknown) => {
        if (error instanceof AdminUserError) return error.code;
        throw error; // a deadlock or serialization failure is a QA failure, not a business refusal
      },
    );

    // 1. The enum carries the two scoped roles next to the legacy one.
    const roles = await prisma.$queryRaw<Array<{ value: string }>>`SELECT unnest(enum_range(NULL::"UserRole"))::text AS value`;
    assert.deepEqual(roles.map((row) => row.value).sort(), ["ADMIN", "SELLER_ADMIN", "SYSTEM_ADMIN"]);
    pass("migration adds SYSTEM_ADMIN and SELLER_ADMIN without removing ADMIN");

    // 2. Two managers demote each other at the same time: exactly one wins, every round.
    for (let round = 0; round < ROUNDS; round += 1) {
      await reset();
      const [a, b] = [await account("SYSTEM_ADMIN"), await account("SYSTEM_ADMIN")];
      const outcomes = await Promise.all([
        outcome(assignAdminRole({ id: b, label: "b" }, a, "SELLER_ADMIN")),
        outcome(assignAdminRole({ id: a, label: "a" }, b, "SELLER_ADMIN")),
      ]);
      assert.deepEqual([...outcomes].sort(), ["last-system-admin", "ok"], `round ${round}: ${outcomes.join(",")}`);
      assert.equal(await activeManagers(), 1);
    }
    pass(`${ROUNDS}x concurrent mutual demotion: one succeeds, one is refused, never a deadlock`);

    // 3. Same race through deactivation.
    for (let round = 0; round < ROUNDS; round += 1) {
      await reset();
      const [a, b] = [await account("SYSTEM_ADMIN"), await account("SYSTEM_ADMIN")];
      const outcomes = await Promise.all([
        outcome(setAdminUserActive({ id: b, label: "b" }, a, false)),
        outcome(setAdminUserActive({ id: a, label: "a" }, b, false)),
      ]);
      assert.deepEqual([...outcomes].sort(), ["last-system-admin", "ok"], `round ${round}: ${outcomes.join(",")}`);
      assert.equal(await activeManagers(), 1);
    }
    pass(`${ROUNDS}x concurrent mutual deactivation: one active manager always remains`);

    // 4. Mixed paths, and the legacy role counts as a manager.
    for (let round = 0; round < ROUNDS; round += 1) {
      await reset();
      const [legacy, system] = [await account("ADMIN"), await account("SYSTEM_ADMIN")];
      const outcomes = await Promise.all([
        outcome(setAdminUserActive({ id: system, label: "s" }, legacy, false)),
        outcome(assignAdminRole({ id: legacy, label: "l" }, system, "SELLER_ADMIN")),
      ]);
      assert.deepEqual([...outcomes].sort(), ["last-system-admin", "ok"], `round ${round}: ${outcomes.join(",")}`);
      assert.equal(await activeManagers(), 1);
    }
    pass(`${ROUNDS}x demotion racing a deactivation (legacy ADMIN + SYSTEM_ADMIN): one manager remains`);

    // 5. Five managers, five simultaneous demotions by an outside actor: four succeed, the last is kept.
    for (let round = 0; round < 5; round += 1) {
      await reset();
      const ids = await Promise.all(Array.from({ length: 5 }, () => account("SYSTEM_ADMIN")));
      const outcomes = await Promise.all(ids.map((id) => outcome(assignAdminRole({ id: null, label: "qa" }, id, "SELLER_ADMIN"))));
      assert.equal(outcomes.filter((value) => value === "ok").length, 4, outcomes.join(","));
      assert.equal(outcomes.filter((value) => value === "last-system-admin").length, 1, outcomes.join(","));
      assert.equal(await activeManagers(), 1);
      // Every success is audited and revokes that account's sessions; the refusal writes nothing.
      assert.equal(await prisma.adminAuditLog.count({ where: { action: "admin_user.role_changed" } }), 4);
      assert.equal(await prisma.user.count({ where: { sessionVersion: { gt: 0 } } }), 4);
    }
    pass("5 simultaneous demotions: 4 succeed with audit + session revocation, the last manager is kept");

    // 6. An inactive manager does not count: the only active one cannot be removed.
    await reset();
    const active = await account("SYSTEM_ADMIN");
    const inactive = await account("SYSTEM_ADMIN", false);
    assert.equal(await outcome(assignAdminRole({ id: inactive, label: "x" }, active, "SELLER_ADMIN")), "last-system-admin");
    assert.equal(await outcome(setAdminUserActive({ id: inactive, label: "x" }, active, false)), "last-system-admin");
    // Demoting the inactive one is harmless and allowed.
    assert.equal(await outcome(assignAdminRole({ id: active, label: "x" }, inactive, "SELLER_ADMIN")), "ok");
    assert.equal(await activeManagers(), 1);
    pass("inactive managers do not satisfy the minimum; the only active one cannot be demoted or deactivated");

    // 7. Unknown ids are never manageable, self-changes are refused.
    await reset();
    const manager = await account("SYSTEM_ADMIN");
    const seller = await account("SELLER_ADMIN");
    assert.equal(await outcome(assignAdminRole({ id: manager, label: "m" }, "does-not-exist", "SELLER_ADMIN")), "not-found");
    assert.equal(await outcome(setAdminUserActive({ id: manager, label: "m" }, manager, false)), "self-change");
    assert.equal(await outcome(assignAdminRole({ id: manager, label: "m" }, manager, "SELLER_ADMIN")), "self-change");
    assert.equal(await outcome(revokeAdminUserSessions({ id: manager, label: "m" }, manager)), "self-change");
    assert.equal(await outcome(resetAdminUserMfa({ id: manager, label: "m" }, manager, "perdeu o celular")), "self-change");
    pass("unknown accounts and self-changes are refused");

    // 8. Lifecycle of a managed account: create, deactivate, activate, revoke, MFA reset, all audited.
    const createdUser = await createAdminUser({ id: manager, label: "m" }, { name: "Loja QA", email: "Loja.QA@rare.invalid", role: "SELLER_ADMIN" });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: createdUser.user.id } });
    assert.equal(stored.role, "SELLER_ADMIN");
    assert.equal(stored.mustChangePassword, true);
    assert.equal(stored.email, "loja.qa@rare.invalid");
    assert(!stored.passwordHash.includes(createdUser.temporaryPassword));
    assert.equal(await prisma.adminAuditLog.count({ where: { action: "admin_user.created", actorUserId: manager, entityId: stored.id } }), 1);
    assert.equal(await outcome(createAdminUser({ id: manager, label: "m" }, { name: "Dup", email: "loja.qa@RARE.invalid", role: "SYSTEM_ADMIN" })), "email-taken");
    await prisma.adminAuditLog.deleteMany({});
    await setAdminUserActive({ id: manager, label: "m" }, seller, false);
    await setAdminUserActive({ id: manager, label: "m" }, seller, true);
    await revokeAdminUserSessions({ id: manager, label: "m" }, seller);
    await resetAdminUserMfa({ id: manager, label: "m" }, seller, "perdeu o celular");
    const sellerRow = await prisma.user.findUniqueOrThrow({ where: { id: seller } });
    assert(sellerRow.sessionVersion >= 3, `sessionVersion ${sellerRow.sessionVersion}`);
    const actions = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "asc" }, select: { action: true, actorUserId: true, before: true, after: true } });
    assert.deepEqual(actions.map((row) => row.action).sort(), ["admin_user.activated", "admin_user.deactivated", "admin_user.sessions_revoked", "mfa.reset"]);
    assert(actions.every((row) => row.actorUserId === manager));
    assert(!/password|hash|secret|rare\.invalid/i.test(JSON.stringify(actions)), "audit snapshots must not carry credentials or emails");
    pass("create / deactivate / activate / revoke sessions / MFA reset are audited with the actor and no credentials");

    // 9. The permission map itself: default deny, and the two roles never share a commercial or system module.
    for (const permission of ADMIN_PERMISSIONS) {
      const system = hasAdminPermission("SYSTEM_ADMIN", permission);
      const sellerAllowed = hasAdminPermission("SELLER_ADMIN", permission);
      if (permission.startsWith("system.")) assert(system && !sellerAllowed, permission);
      if (permission.startsWith("commerce.") || permission === "analytics.sales") assert(!system && sellerAllowed, permission);
      assert(!hasAdminPermission("CUSTOMER", permission) && !hasAdminPermission(undefined, permission) && !hasAdminPermission("", permission));
    }
    pass("permission map: system.* only SYSTEM_ADMIN, commerce.* only SELLER_ADMIN, anything else denied");

    console.log(`\n${results.length} proofs passed.`);
  } finally {
    await database?.$disconnect().catch(() => undefined);
    if (created) {
      await maintenance.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [databaseName]).catch(() => undefined);
      await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => undefined);
    }
    await maintenance.end();
  }
}

main().catch((error) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
