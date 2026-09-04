# M4 Sanitized Daily Log v0.1

**Status:** NOT STARTED — DAY 1 AWAITS FIRST AUTHORIZED REAL WRITE

Record aggregates and sanitized friction only. Do not record company names,
roles, posting references, Task titles, message content, credentials, or other
real job-search details in this file.

| Day | Local date | Check-in | Active | Closed | Open Tasks | Today attention | Writes attempted | Writes rejected | Cross-session readback | Friction categories |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | — | PENDING | — | — | — | — | — | — | — | — |
| 2 | — | PENDING | — | — | — | — | — | — | — | — |
| 3 | — | PENDING | — | — | — | — | — | — | — | — |
| 4 | — | PENDING | — | — | — | — | — | — | — | — |
| 5 | — | PENDING | — | — | — | — | — | — | — | — |
| 6 | — | PENDING | — | — | — | — | — | — | — | — |
| 7 | — | PENDING | — | — | — | — | — | — | — | — |

Allowed friction categories: `DISCOVERY`, `DATA_ENTRY`, `TODAY_QUALITY`,
`LIFECYCLE`, `TASK_FLOW`, `CONTINUITY`, `TRUST`, and `OPERATIONS`.

## Sanitized friction notes

Add only behavior-level observations using this shape:

```text
Day: <1-7>
Category: <allowed category>
Severity: LOW | MEDIUM | HIGH | STOP
Observation: <no real job-search content>
Workaround: <none or sanitized description>
Candidate decision: CONTINUE | REVISE | STOP
```

Any stop-condition event must halt writes immediately and be recorded without
sensitive payloads.
