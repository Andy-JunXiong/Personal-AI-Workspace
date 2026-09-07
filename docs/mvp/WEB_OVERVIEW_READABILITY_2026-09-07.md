# Application overview and readability — 2026-09-07

## Continuity and benefits

During [P6 browser feedback](P6_RUNTIME_RESULTS_2026-09-07.md), the user asked
to include rejected applications by default to see the complete situation and
reported that the text was too small. The Web Applications view now supplies
`status=ALL` by default, preserving explicit filters and pagination. Supporting
text is enlarged to at least 14px, base text to 16px, and desktop application
titles to 19px. Mobile navigation and pagination adapt to the larger text.

This resolves the reported overview/readability gap before further P6
acceptance. Verified immediate benefits: rejected applications appear in the
default Web overview; the open filter still works; pagination retains the
selected scope; no horizontal content overflow was detected at 1440/390/320px.
Expected long-term benefit: the overview communicates the full application
history with less reading effort. Actual device comfort still needs user feedback.

Only Web presentation changed. MCP/query defaults and Today attention rules
retain their contracts. No data, lifecycle state, identity, or schema changed;
the retained test fixture remains present. P6 fixture creation remains pending.

## Verification

- `npm.cmd run verify`: 28 files / 236 tests, typecheck and build passed.
- Added authenticated HTTP coverage for default rejected visibility, explicit
  OPEN filtering, REJECTED filtering, and default-scope pagination.
- Local synthetic Edge preview at 1440, 390 and 320px: ALL selected, 16px root,
  14px company/caption, 19px desktop title / 16px mobile title, no visible
  main/navigation element extending past the viewport.
- Desktop and 320px screenshots were visually inspected.

## Deployment

Pending exact-image deployment and live verification. Keep browser writes and
bootstrap disabled. Use an unchanged-database backup-copy rehearsal because
this release adds no migration; preserve the previous S2 image for rollback.
