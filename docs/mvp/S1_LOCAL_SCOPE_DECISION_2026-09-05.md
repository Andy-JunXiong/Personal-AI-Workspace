# S1 local implementation scope decision — 2026-09-05

The user explicitly approved advancing S1 local development and synthetic-data
testing after the assistant identified the M4 freeze and asked for that bounded
exception. This is the recorded exception to the original freeze, not a change
to its historical evidence or evaluation thresholds.

Authorized scope: implement the S1 application/task interface packages in the
[P0 plan](JOB_SEARCH_SECONDARY_INTERFACE_P0_v0.1.md) locally, beginning with
S1-01 identity linking, login/session handling and shared request identity.
Use synthetic databases outside Git/OneDrive for runtime verification. Local
code, additive migrations and focused regression/security tests are included.

Cloud publication remains separately reviewed. This decision does not authorize
production migrations, real-data writes, account/domain provisioning, recurring
spend, or opening a public web endpoint. The deployed M4 runtime remains frozen.
S2 candidate/digest implementation is outside this exception.

S1-01's local result must distinguish protocol tests using a synthetic identity
provider from actual Google-account and iPhone/HTTPS acceptance. It must retain
the existing MCP contracts and deny browser business mutations until their S1
authority/audit implementation is verified.
