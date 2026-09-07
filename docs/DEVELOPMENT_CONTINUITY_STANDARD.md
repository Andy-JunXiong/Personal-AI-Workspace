# Development Continuity and Benefits Standard v0.1

**Status:** Required repository development and communication standard.

**Effective date:** 2026-09-06 (Australia/Sydney).

**Purpose:** Every development package must explain its place in the product
sequence, not only the code changed. A reader should understand what requirement
the package inherits, why it is being built now, what it enables next, and the
near- and long-term value of the work.

## Required continuity statement

For Job Search, first reconcile the [authoritative core workflow](architecture/CORE_JOB_WORKFLOW.md),
latest user instructions, current status, original task instructions and actual
runtime evidence. GPT is the primary operations entry; the website is the
reporting frontend of the same Workspace database. Do not infer missing daily
automation from one module, or equate manual tests with scheduled-run acceptance.

Before implementation starts, communicate all five items below. Repeat or update
them in the result or handoff document with links to the relevant evidence.

| Required item | Question that must be answered |
| --- | --- |
| Upstream requirement | Which approved requirement, decision, defect, acceptance gap or prior package requires this work? |
| Current package | What user or system capability is added now, why is this the correct next increment, and what is explicitly outside its scope? |
| Downstream enablement | Which concrete next package, release gate or user journey becomes possible because this work exists? What remains blocked? |
| Short-term benefits | What becomes safer, faster, testable or usable immediately after this package? |
| Long-term benefits | Which durable product capability, architecture quality, operating model or future domain does this investment support? |

These statements must be specific. Avoid generic claims such as "improves user
experience" or "supports scalability" without naming the workflow, invariant,
measurement or future decision affected.

## When to communicate it

### Development start

The first substantive development update must state:

1. the upstream requirement and current gap;
2. the bounded capability being implemented;
3. the next step this package is intended to unlock;
4. expected short- and long-term benefits;
5. boundaries that remain unchanged, especially data, deployment, spending and
   external-access authority.

### During implementation

Progress updates should explain discoveries that change the package's role,
risk, scope or downstream dependency. Routine command narration does not replace
the continuity statement. If a defect is discovered, explain which acceptance
gate it threatens and how the correction preserves the next handoff.

### Result and handoff

Every new implementation result or handoff document must include a section named
`Continuity and benefits` near the beginning. It must record:

- linked upstream requirements and prior evidence;
- the delivered capability and explicit non-goals;
- the exact next package or acceptance gate;
- verified short-term benefits, distinguished from expected benefits;
- long-term benefits and any assumptions still awaiting evidence.

The final development report to the user must summarize the same chain. It must
not imply that local verification completed a public, device, real-data or
production gate that was not actually run.

## Required document template

```markdown
## Continuity and benefits

### Upstream requirement

[Requirement/decision/prior result] requires this package because [specific gap].

### Current package

This package delivers [bounded capability]. It does not include [explicit boundaries].

### Downstream enablement

This enables [next package/gate/journey]. [Remaining condition] is still pending.

### Short-term benefits

- [Immediate user/engineering/operational benefit with evidence or measurement.]

### Long-term benefits

- [Durable product/architecture/operating benefit and the future capability it supports.]
```

## Definition of done

A development package is not complete until:

- its continuity statement has been communicated before or at the start of work;
- implementation and verification evidence are recorded;
- the result or handoff document contains all five required items;
- project status and next-step indexes are updated without erasing historical
  evidence;
- short-term verified outcomes are separated from long-term expected value;
- remaining authority, deployment and acceptance boundaries are explicit.

This standard applies to feature work, infrastructure, migrations, security
hardening, defect remediation and research spikes. Small maintenance changes may
use a concise paragraph instead of five subsections, but must still cover the
same chain when they affect a planned milestone or downstream gate.
