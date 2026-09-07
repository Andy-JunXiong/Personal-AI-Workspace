# Direct two-mailbox Gmail checks

Status: deployed as `paw:gmail-20260907164406`; cloud model probe passed. Real Gmail authorization and end-to-end mailbox checking await the user's two consent flows.

## Cloud deployment update

The user reported enabling Gmail API, adding the readonly scope and Gmail callback URI, and supplied a screenshot showing both intended accounts in OAuth Test users. The console still shows an incomplete-branding banner; real authorization will determine whether it blocks the flow. App remains in Testing.

The provided key is installed as a protected host secret, not bundled in the image. The existing read-only browser mode now includes the Gmail overlay. Backup before release: `workspace-20260907T064416Z.db`; previous image: `paw:433ab3c`. Prior source archive and environment snapshot are stored privately under `/srv/paw/deployments/gmail-20260907164406-*`.

Verified after deployment: container healthy; MCP health reports database available; public application page and unauthenticated Gmail endpoint both return 401; read-only application rendering contains the check button and two mailbox slots; 23 applications and 3 tasks remain; foreign-key violations 0 and integrity check `ok`. A synthetic email interpreted from the actual cloud container using its mounted key and `gpt-4.1-mini` passed without saving test records. Temporary SSH rules and local SSH credentials were removed after each connection.

The initial deploy encountered lost executable bits on shell scripts from Windows packaging and rolled back to the previous image. Restoring executable permissions allowed successful enablement. A separate read-only verification helper then had a heredoc terminator error; it was rerun with encoded stdin and completed successfully. No database restore or synthetic data insertion was performed.

Earlier local validation: the user supplied `OPENAI_API_KEY` in the ignored project `.env`. On 2026-09-07, the model-list request returned HTTP 200 and a minimal synthetic-email interpretation through the actual `OpenAiMailInterpreter` using `gpt-4.1-mini` returned HTTP 200 and passed evidence/schema validation. No real email was sent in that probe. Cloud installation is recorded above.

Local credential loading now supports `OPENAI_API_KEY` in the process environment or project `.env` (including Windows UTF-8 BOM). `PAW_OPENAI_ENV_FILE` can select another absolute dotenv path. A configured `PAW_OPENAI_API_KEY_FILE` takes precedence and fails closed if invalid. Only the key is read from dotenv; feature switches are not imported. The existing production overlay continues to mount an independent secret file.

## Continuity and benefits

- Upstream: [the earlier Gmail receipt workflow](GMAIL_CHECK_RESULTS_2026-09-07.md) required copying a prompt into ChatGPT. The user selected direct Gmail API reads plus model interpretation instead of purchasing Business/Workspace Agents.
- Current package: authenticated application-page button, two separately authorized mailboxes, bounded background search, structured email summaries, deduplicated evidence and check receipts in the existing database, automatic page refresh. This is a result-query workflow; it does not admit lifecycle transitions, create tasks or send email.
- Downstream: cloud deployment and model access are verified; authorize both real accounts and verify one real application end to end. These user consent and mailbox gates remain pending.
- Short-term verified: transport tests cover two mailboxes, CSRF, callback replay, missing session, missing project, duplicate clicks, repeated-check deduplication, partial and failed checks. Type checking, 243 tests and build passed.
- Long-term: the website can collect fresh source evidence independently of an interactive ChatGPT session. It uses the existing canonical observation contract instead of creating a separate source of truth.

## Behavior and limits

- POST `/api/v1/gmail/connect` starts session-bound OAuth with PKCE, state and nonce. The two slots cannot contain the same Google subject. A new Gmail identity never becomes an application login identity.
- POST `/api/v1/gmail/applications/:id/check` returns 202; GET on the same path polls progress. Only the authenticated workspace owner can start or inspect its checks. General browser writes can remain disabled.
- Search covers the application date minus one day, matching company or role, including spam/trash. Pagination is followed up to 120 candidates per mailbox. Plain-text body limit is 12,000 characters per message. HTML-only, truncated and capped searches are marked incomplete. Search matching does not guarantee finding emails that omit both company and role.
- Interpretation is batched at 10 messages, requires exact supporting excerpts, and stores only minimized summaries. Full bodies and supporting excerpts are not persisted. The selected model receives relevant candidate subjects and text; OpenAI storage is disabled for the request.
- Relevant message IDs are namespaced by a Google-subject fingerprint to prevent cross-mailbox collisions. Legacy unnamespaced MCP observations can appear once again as a namespaced API observation on the first direct check.
- UPDATED means new email evidence was saved; NO_UPDATE means a complete check saved no new relevant evidence. Latest relevant summaries are still shown on repeat checks. PARTIAL/FAILED never mean no new email. Application lifecycle/task totals remain unchanged by a query.
- Two global concurrent runs, one active run per application, a 60-second per-application cooldown and a 180-second search/interpretation deadline limit duplicate spending. There is no scheduler.
- Active run state is in process memory. A process restart interrupts a check; the browser reports an unconfirmed result, and the user can retry. Completed receipts survive restart in the database. Do not redeploy while a check is active.

## Required account setup

1. Use the Google Cloud project and OAuth web client already configured for the website login. Enable Gmail API.
2. Add `https://www.googleapis.com/auth/gmail.readonly` to the consent configuration.
3. Add the exact additional authorized redirect URI:
   `https://workspace.ai-radar-lab.com/auth/gmail/callback`.
   Keep the existing login redirect URI.
4. If the OAuth app is in Testing, add both intended Gmail accounts as test users. Google documents that testing refresh tokens for these scopes normally expire after seven days; a durable setup must account for the app's publishing/verification status. Do not promise permanent authorization based on one successful test.
5. Save a model-capable OpenAI key outside the repository and supply only its file path to the operator. A Tunnel Read/Use-only key is insufficient. Configure a model that the key can access and that supports strict JSON schema Responses output.

Sources: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Google token expiration](https://developers.google.com/identity/protocols/oauth2#expiration), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Deployment configuration

Create `/etc/paw/secrets/gmail-model-api-key` and `/etc/paw/secrets/gmail-encryption-key` on the host, owned by UID 1000, mode 0400. Encryption key contents: 32 randomly generated bytes encoded as 64 lowercase hex characters. Do not regenerate it after authorizing mailboxes; existing credentials would become unreadable.

Create `/srv/paw/gmail-connections`, owned by UID 1000, mode 0700. Its AES-GCM encrypted credentials are separate from the application database backups. Back up these credentials and their encryption key using the private secrets backup process, never a public repository.

Set `PAW_GMAIL_MODEL` in `/etc/paw/paw.env`. The `compose.gmail.yaml` overlay sets secret paths and enables the feature. After deploying an image containing this code, `bash deploy/cloud/web-mode.sh read gmail` enables the Gmail-specific routes while general browser writes stay off. Running `web-mode.sh read` disables this integration; every future release must deliberately retain the Gmail overlay if the feature is intended to stay enabled.

Pre-deploy: database backup, image build, typecheck/tests/build, and secret/config preflight. Post-deploy: existing signed-out boundary and MCP health checks, log in, authorize each mailbox, confirm labels show distinct addresses, check one real application, verify receipt and email evidence in the database and rendered page, repeat after the cooldown to verify no duplicate evidence. Do not introduce synthetic production rows.

## Validation

Final local validation on 2026-09-07: `npm.cmd run verify` passed (typecheck, 29 test files / 243 tests, build). `git diff --check` and Bash syntax validation of `deploy/cloud/web-mode.sh` passed. Docker Compose configuration and real-cloud deployment have not been run for this package.

After dotenv support: `npm.cmd run verify` passed again (30 test files / 244 tests, typecheck and build). The new credential test checks BOM/CRLF parsing, secret precedence, failed-secret handling and that dotenv cannot activate browser writes or Gmail integration.

Local integration tests use synthetic providers and isolated temporary databases only. No real email has yet been searched through the direct API path, and no production job records were changed by this deployment. Final acceptance awaits real Gmail authorization and a user-triggered check.
