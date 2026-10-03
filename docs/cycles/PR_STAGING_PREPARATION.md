# PR / staging preparation — 2026-10-03

Repository raredept/rare; base main; branch codex/admin-dashboard-reconciled-20261002. Scope: remote PR/CI discovery and safe existing-staging preparation only. No new Admin audit/refactor, runtime/dependency/config modification, real migration or provider side effect.

## Remote review boundary

Initial local/remote HEAD: `71b0a2e93ae80fe1df99434700b5cbdcdd0f8275`; fetched main: `4ea73f50cafdbf67e16dc71de985052075feca42`; 21 ahead / 0 behind. Documentation commits are pushed normally; final hashes and exact pushed-SHA checks are reported at closure, not embedded in their own commit.

GitHub CLI unavailable. Exact head/base PR search (all states) returned none. This cycle's authorized Draft creation attempt again returned **403 Resource not accessible by integration**: **PR_CREATION_BLOCKED_BY_PERMISSION**. No ACL workaround, hidden PAT lookup, merge or fabricated PR URL/number. Maintainer creation is required.

Initial-SHA remote evidence: 0 check-runs, 0 individual statuses, 0 Actions runs of any event type; no .github workflow tree. Classification **NOT CONFIGURED / none reported**, never PASS. Empty aggregate pending does not represent a running check. A PR-event workflow cannot be ruled out until an actual PR exists. Branch-protection read 403 and empty rulesets do not establish absent classic protection/required reviews. Maintainer must confirm checks/reviews, remote conflicts and mergeability. No failing CI was observed; no workflow/assertion/skip was weakened.

## Exact manual Draft PR handoff

PR_TITLE: `refactor(admin): reconcile dashboard master cycle with current main`

BASE: `main`

HEAD: `codex/admin-dashboard-reconciled-20261002`

PR_CREATION_URL: <https://github.com/raredept/rare/pull/new/codex/admin-dashboard-reconciled-20261002>

Initial state: **Draft**. The creation URL is not an existing PR URL.

PR_BODY:

```markdown
## Summary
- Reconcile Admin with current main: shell/header/navigation, responsive drawer, Dashboard, Analytics, Orders, Products, Customers, pagination and error/loading states.
- Preserve server-side requireAdmin, active ADMIN, sessionVersion/credentialVersion revocation, temporary-password change, expired-session rejection and logout.
- Preserve same-origin mutation controls, actual payload stream limits, quota/rate limiting, strict IDs/allowlisted schemas/enums, uploads/editor and push API protections.
- Retain FR-01 payload, FR-02 repeated params, FR-03 stable pagination/ID ties and FR-04 long-content clipping regressions; no new cosmetic refactor.

## Local QA — closing cycle 2026-10-03; runtime unchanged
- Lint/TypeScript PASS; 147 files / 1,134 unit/integration PASS.
- Admin/auth: 21 files / 140 PASS x3; Prisma validate/generate PASS.
- All 14 migrations from zero in disposable local QA; SQL contracts PASS x3.
- E2E: 178 PASS, 62 skipped, 0 failed/flaky; 54 Admin Axe/keyboard/table scenarios PASS; 8 widths across 11 routes PASS.
- Skips: 24 isolated-staging checkout, 24 multi-image fixture, 14 project scope; no weakened assertion or skip change.
- Clean build/standalone and 28 Server Actions PASS; release guard 6 OK / 1 legacy-cron warning / 0 FAIL.
- Docs-only preparation does not rerun these full suites. Runtime audit refreshed: 3 high / 0 critical; prior full audit 16 high including 13 dev/tooling.

## Operational gates / evidence
- docs/runbooks/STAGING_SAFETY.md: actual Railway staging identified, separate DB/Redis and TEST secrets, mounted dedicated media volume; not this candidate artifact. Web checkout/shipping true and SMTP test do not meet closed bootstrap. No external state changed.
- Stripe TEST webhook registration/account read is configuration evidence, not payment/webhook homologation. Sandbox freight/email/media/monitoring/rollback remain untested.
- docs/runbooks/PENDING_MIGRATIONS.md: real staging schema/checkpoint/executor/authorization required BEFORE web deploy; live pre-deploy runs migrate deploy with advisory locking disabled.
- docs/runbooks/CRON_OWNERSHIP.md: Railway deployments/DB targets inventoried; KEEP existing workers. Vercel live inventory UNKNOWN; no service disabled; processing not proven.
- docs/PRODUCTION_READINESS.md: explicit DEPENDENCY RESIDUAL RISK; UPSTREAM_WAIT on Prisma/config/deepmerge; owner release disposition required, not accepted by Codex.
- Actual PR final-HEAD checks/protection/reviews/conflicts require maintainer verification. No reported CI does not mean green CI.

## Limits
No production deployment.
No main merge.
No live migration.
No live commerce activation.
No live provider modification.
No real DB migration/reset, DNS/secrets change, real payment/label/email or live cron disable.
```

## Evidence and human gate

[Admin reconciliation](ADMIN_MAIN_RECONCILIATION.md), [final review](ADMIN_FINAL_REVIEW.md) and [final local integration](ADMIN_FINAL_INTEGRATION.md) remain the runtime QA sources. Preparation adds [staging safety](../runbooks/STAGING_SAFETY.md), updates [production readiness](../PRODUCTION_READINESS.md) and [cron ownership](../runbooks/CRON_OWNERSHIP.md). Storefront/security/Postgres/Railway guidance informed the strict config-vs-runtime boundary, secret-free target comparisons, migration locks/single executor and non-production provider gates.

No migration history/backup was inferred from provider variables. No email recipient addresses, credentials or DB connection URLs are committed. The two unrelated untracked user planning documents remain untouched.

Docs-only validation: git diff --check PASS; six edited/new documents have zero broken local links, balanced Markdown fences and zero secret-shaped hits. release:guard rerun: 6 OK / 1 unchanged legacy-Vercel-cron warning / 0 FAIL (repository/diff secrets, artifacts, safe defaults, public-variable allowlist, existing browser bundle). Full app suites were not rerun because runtime/main/configuration did not change; previous-cycle evidence remains explicitly dated above.

READY FOR MERGE: NO until actual PR/required remote gates. READY FOR STAGING/HOMOLOGATION: NO until approved closed bootstrap, candidate source, migration checkpoint/executor/authorization and verification gates. READY FOR PRODUCTION: NO, separate release approval required.

Minimal human actions: (1) create Draft PR/confirm required gates; (2) approve existing staging repurpose or another isolated target, safe flags, checkpoint and single migration executor/window; (3) approve controlled fixtures/recipients and owner-led provider/monitoring/rollback/residual-risk gates. No production activation implied.
