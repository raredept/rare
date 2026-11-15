# Credential-free local build check

Test-only tooling for the paused storefront cycle. It does not change the application's build script or runtime configuration. Do not deploy its `.next` output.

From the repository root:

```powershell
node tests/build-storefront-safe/safe-build.mjs
# Explicit alternative after investigating the default compiler:
node tests/build-storefront-safe/safe-build.mjs --webpack
```

The wrapper verifies the expected build lifecycle, creates a child environment from an OS-only allowlist, supplies empty database/auth configuration and disabled commerce flags, and runs a guard self-test before the build. The preload refuses `.env`/`.env.*` and npm credential-config reads, Node socket connections (including loopback) and `fetch`. Node children inherit the preload. No credential values are logged. The Webpack alternative runs the standalone/artifact checks only if compilation and generated TypeScript validation succeed.

This is a Node API guard, **not an OS sandbox**: it does not contain native addons or arbitrary external executables. Do not reuse it with a changed lifecycle, start a Next server, or treat it as permission to execute a database/provider test. The wrapper has no automatic timeout; inspect a stalled process and terminate only its verified child tree.

## Observed result — 2026-10-07

- Guard self-test passed: zero environment files loaded; protected read and network probes refused.
- Default `npm run build` (Turbopack) did not finish during the bounded observation, 20:23:18–20:28:59 UTC. Its verified process subtree was stopped. Cause is unproven; result is **TIMEOUT / NOT VERIFIED**, not a successful build.
- Webpack fallback initially compiled in 58 seconds and failed generated Next route-type validation. The final frozen-source rerun, 20:40:00.517–20:40:57.409 UTC, compiled in **48 seconds**, then failed the same four contracts (exit 1). The failing signatures are the optional page props in Admin banners/categories/readiness and optional `Request` in `/api/health` GET. All four source signatures are unchanged from `cc72e3b`.
- Final Next guard counts: 2 protected environment reads denied, 0 npm-config reads, 0 network calls; TypeScript worker counts: 0/0/0. The self-test separately denied 10 environment reads, 1 npm-config read and 2 deliberate network probes. These are guard observations, not an OS containment proof.
- These Admin/API sources are explicitly outside the visual cycle. No workaround, generated-type exclusion or TypeScript-ignore flag was applied. Standalone preparation and artifact checks were not reached.
- Root `npm run typecheck` also reports those four generated-type errors after this build. Earlier checks without the generated contracts passed; that is not the final integrated result.

The partial build artifact is not release-ready. Resolve the route contracts only in a separately authorized cycle, then rerun the full build and production-runtime/performance checks in an approved environment.
