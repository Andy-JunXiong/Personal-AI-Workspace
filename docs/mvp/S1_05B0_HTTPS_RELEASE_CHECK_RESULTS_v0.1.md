# S1-05B.0 HTTPS Release Checker Results v0.1

**Status:** LOCALLY VERIFIED AUTOMATION; NO EXTERNAL ENDPOINT CHECKED

**Date:** 2026-09-06 (Australia/Sydney)

## Continuity and benefits

### Upstream requirement

[S1-05A operations](S1_05A_LOCAL_OPERATIONS_RESULTS_v0.1.md) defined a staged
Web deployment, and [S1-05A.1](S1_05A1_GPT_WEB_LINK_RESULTS_v0.1.md) connected
GPT reads to exact Web routes. S1-05B still required repeatable evidence that a
published hostname exposes only the intended signed-out surface before a human
logs in.

### Current package

This package adds `npm run web:check`, a privacy-bounded HTTPS release checker.
It checks signed-out isolation and headers, hidden MCP/health/admin routes,
read-versus-write routing, Google authorization parameters, PKCE/state/nonce,
the host-only login Cookie, and rejection of absolute return paths. It follows
no OAuth redirect, retains no Cookie, reads no private page and uses no real
object ID.

### Downstream enablement

After a separately authorized S1-05B hostname and OAuth/tunnel setup, the same
command can produce the machine preflight required before identity linking and
iPhone testing. Actual Cloudflare, Google, VM, backup/restart and device evidence
is still pending.

### Short-term benefits

- One command replaces a fragile manual checklist for five public-boundary checks.
- Read mode expects completion to be absent; write mode expects the route to
  exist but reject a missing session.
- Reports contain only the origin, expected mode and bounded pass/fail details;
  OAuth state, nonce, challenge, client ID and Cookie values are not returned.

### Long-term benefits

- Every browser release can rerun the same public contract before human or
  real-data acceptance.
- Provider, session and route regressions become deployment failures instead of
  user-discovered incidents.

## Delivered checks

| Check | Required result |
| --- | --- |
| `signed_out_boundary` | Today returns 401 with no-store, CSP, referrer, nosniff and frame policies. |
| `public_route_isolation` | `/mcp`, `/healthz` and `/admin` return 404. |
| `write_mode_boundary` | Completion returns 404 in read mode or 401 without a session in write mode. |
| `oauth_start_contract` | Google code flow uses the exact callback, PKCE S256, state, nonce and a 10-minute host-only secure Cookie. |
| `unsafe_return_rejected` | An absolute return URL returns 400 without redirect or Cookie. |

## Verification

- Synthetic response tests passed both read and write modes.
- Negative tests detected exposed health and weakened CSP independently.
- Invalid HTTP, credential-bearing and path-bearing origins made zero requests.
- The checker passed against the real Express read and write route trees with a
  synthetic OIDC issuer and zero database changes.
- CLI without `--origin` failed closed with usage guidance.
- Full repository verification passed: 21 test files / 189 tests, server and
  browser typechecking, and production build.
- `git diff --check` passed.

## Remaining boundary

No network request to Cloudflare, Google, AWS or a public PAW hostname was made.
This package verifies the checker and application contract, not TLS, DNS, edge
routing, provider registration, account ownership or real-device behavior.
Human testing is not required until the runbook's machine gates pass externally.
