# S1-05B.1 External Binding Preflight Results v0.1

**Status:** Implemented and locally verified; real external binding remains
blocked on operator account access and approved values.

## Continuity and benefits

### Upstream requirement

The [S1-05B.0 HTTPS release checker](S1_05B0_HTTPS_RELEASE_CHECK_RESULTS_v0.1.md)
can test a published origin, but it cannot prove that the VM-side hostname,
OAuth client, Tunnel ingress and credential files agree before publication. The
[operations runbook](../cloud/S1_WEB_OPERATIONS_RUNBOOK.md) requires those
values and modes to be reviewed before the first read-only release.

### Current package

This package adds a fail-closed VM-side preflight for the external binding. It
checks configuration agreement, placeholder removal, restricted credential
files, disabled bootstrap and browser writes, loopback-only Web routing, a final
404 ingress fallback, inactive Tunnel service and `cloudflared` validation. It
does not connect external accounts, create DNS/OAuth/Tunnel resources, reveal
secrets, publish the application or mutate Workspace data.

### Downstream enablement

This enables the real S1-05B read-only binding once an owned Cloudflare hostname,
Google OAuth client, supported `cloudflared` version and AWS operator access are
available. External HTTPS checks, identity linking, synthetic completion and
iPhone acceptance remain pending.

### Short-term benefits

- Misaligned hostnames, example values, unsafe modes and credential permissions
  now stop the release before the Tunnel can be started.
- The operator gets non-secret evidence naming the reviewed host, origin,
  disabled-write state and installed `cloudflared` version.

### Long-term benefits

- Repeatable pre-publication checks reduce configuration drift across upgrades,
  restores and replacement hosts.
- The same fail-closed release boundary can protect later browser commands while
  MCP and Web continue sharing one persistent Workspace.

## Verification

- Static contract coverage is included in
  `tests/unit/cloud-web-deployment.test.ts`.
- Repository typecheck, unit/integration tests and build must pass before this
  package is accepted.
- Real VM execution is intentionally pending until account access and approved
  external values exist.

## External readiness recorded on 2026-09-06

- Local AWS CLI has no configured credentials or region.
- GitHub CLI authentication was restored and verified commit `8f21071` was
  pushed to `origin/main`.
- The user-approved Cloudflare connection succeeded, but the connected account
  currently contains zero Zones and zero Tunnels. There is therefore no owned
  hostname or existing Tunnel available to bind.
- No Google Web OAuth client is recorded in the repository or local
  environment.

The next external action is to identify an already-owned Cloudflare-managed
domain or separately approve a domain acquisition/onboarding decision. AWS
operator access and a dedicated Google Web OAuth client are also required before
the real VM preflight can run.

Do not send OAuth secrets, Tunnel credentials or cloud keys through chat. Human
acceptance is not requested until real read-only publication and every machine
gate in the runbook passes.
