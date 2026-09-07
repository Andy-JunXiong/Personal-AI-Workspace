# S2 migration and release procedure — 2026-09-07

## Continuity and benefits

The [P6 preparation review](../mvp/P6_PREPARATION_RESULTS_2026-09-07.md)
identified that unchanged-database recovery checks cannot verify migrations
006–008. This package adds a narrowly scoped `--s2-upgrade` rehearsal and a
read-only migration verifier. It enables S2 deployment followed by P6 Phase 0B
and A01–A12; cloud/device success must be recorded separately.

Immediate verified benefit: synthetic regression checks detect changed old
rows, unexpected schema/indexes, changed migration history, and unexpected
data in new tables. Expected long-term benefit: repeatable upgrade and rollback
evidence for database releases. No runtime feature or schema was added.

The user explicitly authorized steps 1–4 (migration rehearsal, release commit,
cloud deployment, P6 acceptance) on 2026-09-07, including the planned synthetic
fixtures. Real application mutations, identity/bootstrap changes and destructive
database restoration remain outside this work.

## Local checks

- `npm.cmd run verify`: 27 files / 233 tests pass, typecheck and build pass.
- `bash -n deploy/cloud/rehearse-database-copy.sh`: pass.
- The old migration-directory startup test uses the current loader with the
  S1 migration set. Actual old-image compatibility requires the cloud rehearsal.

## Cloud sequence

1. Verify healthy read mode, bootstrap disabled, current image and clean source.
2. Transfer the committed release source; build `paw:<release-tag>` once.
3. Back up the running database with `deploy/cloud/backup.sh`.
4. Run as root from the reviewed source directory:

   ```bash
   ./deploy/cloud/rehearse-database-copy.sh \
     workspace-YYYYMMDDTHHMMSSZ.db <release-tag> 9303de5 --s2-upgrade
   ```

   The candidate first migrates an isolated copy. The verifier checks integrity,
   migration versions, exact schema including indexes, every old table's rows,
   retained migration timestamps, and empty new tables. The candidate starts
   again and the previous image starts on that SAME migrated copy; both must
   leave logical content unchanged. The original backup is mounted read-only
   for comparison. No application port is published by rehearsal containers.

5. Deploy the exact rehearsed image without rebuilding it. Preserve the prior
   active-tag receipt, set the active tag to the candidate, and run
   `web-mode.sh read` (the command uses `--no-build`). Run ingress health and
   the external writes-off release checker. Record the resulting image ID.
6. Check the live migration against the pre-release backup before creating
   fixtures; run Phase 0B. Only then create P6 fixtures and run scenarios.

## Failure and cleanup

Any rehearsal or release smoke failure stops dependent deployment/acceptance
work. Report the failing gate and evidence. Do not restore a live database or
run down migrations. Rehearsal cleanup is confined to its unique temporary
container/directory. Restore any temporary operator-IP SSH rule and remove
temporary local SSH credentials at session closeout.

## Runtime results

Pending execution. Current preflight confirmed the existing Workspace is
available, the VM source is `4cb9015`, the running image is `paw:9303de5`,
and HTTPS health passes with port 80 closed and application ports on loopback.
