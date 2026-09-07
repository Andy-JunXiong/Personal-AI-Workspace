# Check all applications

Status: deployed as `paw:gmail-batch-20260907165919`.

Cloud verification: container and database healthy; batch endpoint returns 401 when signed out; read-only authenticated rendering includes the batch button; the owned target snapshot contains 23 applications; both encrypted Gmail connections remain available; database integrity is `ok`. Before-release backup: `workspace-20260907T065928Z.db`; previous image `paw:gmail-20260907164406`. Temporary SSH firewall changes and local SSH credentials were cleaned up. No real batch was automatically started during deployment; the user can initiate it from the applications list.

## Continuity and benefits

- Upstream: [direct two-mailbox checking](GMAIL_DIRECT_API_2026-09-07.md) required a separate click per application. The user requested a single Check all button.
- Current package: the applications list can start a sequential background batch over every owned job application, including closed/rejected records, independent of filters and pagination. It reuses the existing two mailbox connections and persists the existing per-application receipts and summaries.
- Downstream: deploy, then the user can start one batch and inspect individual result links. No scheduler is introduced.
- Short-term verified: a 106-application transport test proves full coverage beyond pagination/cache limits, closed/rejected inclusion, exclusion of another owner's private application, duplicate-click reuse and continuation after an individual failure. Full verification: 30 files / 245 tests, typecheck and build passed.
- Long-term: the same saved result model supports a batch workflow without duplicating job state or mailbox credentials.

## Operation

The list-page button checks all applications, not just the visible filtered rows. The server creates an owned target snapshot and returns 202. It processes one target at a time, sharing the global two-run limit with individual checks. Running batches and recently started batches are reused on repeat clicks. Each completed target has an outcome and a link in the batch panel. No explicit application status or task changes are made by this query workflow.

GET/POST `/api/v1/gmail/check-all` require the normal authenticated session; POST also requires same-origin CSRF authority and rejects supplied project IDs or filters. The browser polls and reconnects to the current batch when the list is refreshed or revisited. Filtering does not change the batch's target snapshot. Progress includes completed/total, updated and partial/failed counts.

The batch state is in server memory; per-job evidence and receipts are durable. Closing the browser does not cancel the batch, but restarting/deploying the server does. After a server restart, already saved job results remain and a new batch can be started. Failed or incomplete checks do not mean there are no new emails. Tests only used isolated synthetic databases, not production fixtures.
