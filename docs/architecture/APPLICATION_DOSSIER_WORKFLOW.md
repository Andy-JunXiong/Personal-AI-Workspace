# Application dossier workflow

## Continuity and benefits

Jun requested a consistent post-application record: the job URL, saved JD,
company-named resume, and a list comparing job requirements with personal skills.
This extends the [core workflow](CORE_JOB_WORKFLOW.md), existing resume associations
and [application detail cleanup](../mvp/APPLICATION_PROGRESS_TIMELINE_2026-09-09.md).
The website now shows four material-completion indicators and a requirement table
with explicit gap/evidence notes. Exact project readback includes the latest
applicationProfile independently of the ten most recent resources.

The immediate benefit is seeing which application materials remain missing.
The next user journey is completing this dossier after each real submission, then
using it for interview preparation. Longer term, attributable JD/resume snapshots
make comparisons reproducible. Website reads do not fetch external documents or
generate comparisons; GPT performs authorized acquisition and saves the results.
No historical material is fabricated, and a real application can still be recorded
when its supporting materials are temporarily unavailable.

## Required post-application sequence

1. Resolve the exact company, role and application. Register only with existing
   user authority or explicit submission evidence under the approved workflow.
2. Save the exact employer/platform posting URL in postingReference. Use the
   existing versioned workspace_update_job_application tool for later backfill.
   Do not substitute a company homepage or another similarly named job.
3. Retrieve the actual JD from that posting or supplied document and save its text
   in a job-application-profile-v0.1 NOTE. Record the URL/source in sourceReference.
   A missing or inaccessible posting remains a visible gap; do not reconstruct
   its JD from the title or a different vacancy.
4. Search available resume files by company, then role and application date.
   Suggested filename: Company_Role_Name_YYYY-MM-DD_v1.pdf (or .docx).
   Multiple roles or versions must remain distinguishable. Filename matches are
   candidates only. Associate the exact Drive file and revision using the existing
   resume contract; confirm actual submission only from user/submission evidence.
   Do not rename user files merely to make a match.
5. Compare each substantive requirement from the saved JD with evidence in the
   identified resume or user-supplied experience. Preserve exact requirements,
   concrete evidence and source/version references. Save structured skillMatch:
   matches[{requirement,evidence,assessment,gap?}] plus summary and gaps.
   MATCH requires evidence, PARTIAL describes the limitation, GAP needs evidence
   of a real gap, and UNKNOWN means evidence is unavailable. Missing resume text
   must never be converted into invented skills or a claim that the skill is absent.
6. Before updating the profile, read applicationProfile.saved and preserve existing
   JD, report and resume text in the new complete snapshot. After writing, read
   workspace_get_project again and verify the URL, latest profile and resume
   association. Disclose missing fields instead of claiming the dossier is complete.

## Completion indicators

The four indicators are: a usable-format saved URL, JD text, confirmed submitted
resume version, and a nonempty structured comparison. A candidate or confirmed
file with an unknown revision is explicitly incomplete for version confirmation.
Saved comparison completeness is not an automated quality certification. The
comparison can still be reviewed when the submission version is pending, with
its source/version uncertainty disclosed in the saved report.

## Validation and release

Local verification passed: 375 tests in 47 files, server/browser type checks and
build. Regression coverage includes profile readback beyond recent resources,
candidate-versus-confirmed material status, saved JD/link/comparison without a
submitted resume, source preservation, gap escaping and read-only rendering.
Deployment pending. No migration or new external service.
