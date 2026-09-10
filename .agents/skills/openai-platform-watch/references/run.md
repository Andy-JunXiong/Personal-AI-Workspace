# Run reference

Read alongside SKILL.md when executing a scan. The Watch contract owns governance;
this reference defines source scope and presentation only.

## Official source scope

Default weekly scope: dated entries since the last successful cutoff. For the
first scan, explicitly declare a recent window plus current boundary references.
Read release summaries for every entry in that window; PR-by-PR archaeology is
unnecessary unless a material claim depends on it. Record redirects and coverage.

| Source | Purpose |
| --- | --- |
| https://learn.chatgpt.com/docs/changelog | ChatGPT/Codex releases, distribution, workflow and access changes |
| https://developers.openai.com/api/docs/changelog | Models, tools, costs, API changes and migration triggers |
| https://developers.openai.com/plugins/changelog | MCP Apps, authentication and compatibility changes |
| https://learn.chatgpt.com/docs/automations | Current scheduled-runtime capabilities and conditions |
| https://learn.chatgpt.com/docs/plugins | Current installation/distribution capabilities |
| https://learn.chatgpt.com/docs/customization/memories | Current memory/state boundary claims |
| https://developers.openai.com/plugins/build/chatgpt-ui | Current optional conversational UI capabilities |
| https://developers.openai.com/workspace-agents/trigger-runs | Agent trigger/status contract and limitations |

Follow official links only where needed to resolve a material claim. Search is
discovery, not retrieval evidence. Plans, entitlements and private-repository
access require scenario-specific verification. Read source material through the
host's available official-docs/web tools; do not build a crawler or news database.

## Compact report

Use the feature-choice writing contract below for the user-facing prose. The
technical fields in this older outline belong in the evidence appendix, not as
literal headings or jargon repeated in the opening.

```text
OpenAI Platform Watch — <date; scan result; material coverage limitation if any>

Directional judgment: <NO DRIFT / NARROW / EXPAND / REPOSITION, advisory>
<What changed in the PAW/OpenAI comparison and the investment consequence;
if unchanged, say so without manufacturing novelty.>

<Up to three insights, ordered by decision importance>
Judgment: <specific architectural recommendation, not a release headline>
Comparison: <evidenced platform change/trajectory> versus <PAW actual/planned
capability> versus <prior Watch finding and what changed or still holds>
Consequence: <affected owner, dependency, user workflow or investment>
Choice: <recommended next step and priority; what to postpone/avoid/retain;
real alternative and its material tradeoff>
Uncertainty and reversal: <strongest counterevidence or unknown; bounded test
and result that would change this recommendation>
Evidence: <official fact link + pinned PAW evidence; label the inference>

Decision requested: <specific choice for the maintainer, or no decision needed;
advice does not change the roadmap or accept an experiment>

Evidence appendix:
Run: <manual / actual scheduled / editorial reanalysis of a named prior run>
Skill ref; PAW SHA; previous successful scan; source window/cutoff; source coverage
Production: <dated release evidence or UNKNOWN; repository/local/live differences>
For each insight retain the existing finding reference/comparison label and
the contract's five fields:
Finding; Direction; Verification; Human decision; Outcome / next step.
New recommendations remain PENDING. Mixed directions use separate finding records.
Technical follow-ups: <routine compatibility fixes and release details>
Unchanged findings: <references and revisit conditions; do not rebrand as NEW>
Failures and next eligible cutoff: <unchanged if incomplete or editorial reanalysis>
```

Keep the main judgment and recommendations readable in one minute. Evidence must
support the comparison, not merely decorate a generic conclusion. A later
maintainer review records accepted results in the existing Watch ledger; report
delivery itself is not a canonical update. Rewriting an earlier report is editorial
reanalysis: cite its baseline and cutoff, preserve the original, and do not claim
fresh retrieval, a new completed scan or an advanced cutoff.

## Quality checks

- A finding names a real PAW function and its current behavior, cites that
  baseline, compares a concrete alternative and gives both short- and long-term
  consequences for change AND no change. It fails if the same recommendation
  could be pasted into any project by replacing the name PAW.
- Narrative describes a supported workflow or clearly marked scenario, never
  invented events or quoted user experiences. Explain terms in ordinary language.
- An already delivered feature is context, not a new adoption request. A finding
  asks about a remaining choice; ACCEPT/REJECT applies to its stated advice.

- An unchanged previously reported feature produces no new material claim.
- A PAW change satisfying an old revisit condition reopens that finding even
  without an OpenAI release. A changed platform claim links its predecessor.
- A failed source read is visible and cannot become NO MATERIAL CHANGE.
- ADOPT + NOT_TESTED + DEFERRED remains distinct from IGNORE.
- Repo/production mismatch limits conclusions; it does not erase known live work.
- A document instructing the reader to deploy or alter permissions stays evidence.
- A report can recommend a different product boundary; no preferred conclusion
  is baked into the procedure. Scheduled acceptance uses these same claims.

- A release summary without a pinned PAW comparison fails the insight quality gate.
- A recommendation names an alternative, priority and a falsifiable revisit/test.
- Routine API error handling stays in the appendix unless evidenced impact makes
  it architectural; no invented outage or forced strategy claim.
- Unchanged evidence does not create three filler insights. Missing evidence can
  limit a judgment but cannot establish no change across unread sources.
- Recommendations may challenge PAW's current thesis. The test must be capable
  of changing the conclusion, rather than validating it by construction.
- A revised report format reuses retrieval acceptance only for unchanged mechanics;
  its scheduled reasoning quality remains NOT_TESTED until a real run is reviewed.

## Feature-choice writing contract

Jun's September 10 feedback asks for a story he can follow and a concrete basis
for decisions. Write in plain Chinese, as a colleague explaining what matters
after watching him use PAW. Do not pretend to have observed an event not in the
records. Start from a real task, such as reading application replies or exporting
a resume, connect the platform evidence to a current PAW feature, then explain
the investment choice. A narrative is connected reasoning, not fiction or a
series of "Judgment / Consequence / Boundary" labels.

Main report: a few connected paragraphs explaining what happened or remains
unproved, which daily work is affected, and which two or three choices deserve
attention. Do not repeat the entire choice cards in this opening. Keep dates,
commit hashes, taxonomy and scan mechanics in a separate source appendix.

For each remaining decision, use a title that names the PAW feature and choice:
"简历编辑：保留网页，还是整体搬进聊天？" is concrete; "坚持领域价值" is not.
Explain the existing behavior and actual alternative in prose, followed by a
compact comparison:

| 做法 | 短期：下一次实际使用 | 长期：持续使用与维护 |
| --- | --- | --- |
| 保留现有做法 | What works now, and what inconvenience remains | What maintenance/dependency remains, and what opportunity may be missed |
| Change the named function in a specific way | Implementation/relearning/retest cost and realistic immediate benefit | Durable benefit, added maintenance/permissions/dependencies and failure recovery |

Then recommend one option, explain why it deserves priority now, and name the
evidence that would change the recommendation. Distinguish expected effects from
measured outcomes; do not fabricate hours saved, money saved, outages or future
task success. An inability to measure an effect is a visible limitation, not a
reason to fill the cell with generic praise. A bounded experiment can be the
recommended option, but needs a concrete task, observation and stopping condition.

For PAW import, use the existing `body` for narrative, `recommendation` for the
feature explanation and comparison table, and `nextStep` for the bounded proposed
action. No schema extension is needed. Keep evidence links and stable finding keys.
Changing the advice creates a new immutable report snapshot with a reference to
its predecessor; it does not overwrite the old text or transfer human decisions.
Do not invent a third decision when only two material choices remain.

An example is the [September 10 narrative revision](../../../../docs/mvp/PLATFORM_WATCH_STORY_2026-09-10.md).
Its concrete facts and recommendations are historical examples, not defaults for
future reports. Resolve current PAW evidence on every new scan. A saved scheduled
task pinned to an older procedure does not automatically inherit this revision;
record that gap until its exact saved prompt is separately updated and read back.
