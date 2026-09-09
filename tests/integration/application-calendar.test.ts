import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applicationCalendar } from "../../src/domain/application-calendar.js";
import { applicationListView } from "../../src/web/views.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";

describe("application submission calendar", () => {
  it("uses the workspace day across year boundaries and handles leap dates and missing dates", () => {
    const calendar = applicationCalendar([], new Date("2025-12-31T14:00:00Z"), "Australia/Sydney");
    expect(calendar.today).toBe("2026-01-01");
    expect(calendar.months.map(m => [m.year, m.month, m.days.length])).toEqual([[2025, 12, 31], [2026, 1, 31]]);
    const dates = ["2024-02-29", "2024-02-30", null, "unknown", "2024-01-31"];
    const leap = applicationCalendar(dates.map((appliedDate, i) => ({ projectId: String(i), company: "Co", role: "Role", appliedDate })), new Date("2024-03-01T00:00:00Z"), "UTC");
    expect(leap.months[0]!.days).toHaveLength(29);
    expect(leap.months[0]!.leading).toBe(3);
    expect(leap.months[0]!.total).toBe(1);
    expect(leap.months[0]!.days[28]!.applications).toHaveLength(1);
    expect(leap.undatedCount).toBe(3);
  });

  it("counts closed submissions independently of pagination and filters, isolates workspaces, and escapes day links", () => {
    const w = createEmptyTestWorkspace({ clock: () => new Date("2026-09-09T06:00:00Z") });
    try {
      const authority = { type: "EXPLICIT_USER_DEV" as const, confirmed: true as const, reference: "Synthetic calendar" };
      const create = (service: WorkspaceService, company: string, appliedDate?: string) => {
        const result = service.createJobApplication({ company, role: "Role", appliedDate, authority, idempotencyKey: randomUUID() });
        if (result.creationStatus !== "CREATED") throw new Error("Expected application");
        return result.project;
      };
      create(w.service, "Current", "2026-09-08");
      const closed = create(w.service, "<script>Closed</script>", "2026-09-08");
      const proposal = w.service.proposeTransition({ projectId: closed.id, expectedLifecycleVersion: 1, toState: "REJECTED",
        triggerType: "USER_ASSERTION", evidenceResourceIds: [], rationale: "Synthetic closure", idempotencyKey: randomUUID() });
      w.service.admitTransition({ transitionId: proposal.transition.id, expectedLifecycleVersion: 1, authority, idempotencyKey: randomUUID() });
      create(w.service, "Previous", "2026-08-31");
      create(w.service, "Undated");
      create(w.service, "Older", "2026-07-31");
      const paused = create(w.service, "Paused", "2026-09-01");
      w.database.prepare("UPDATE projects SET status = 'PAUSED' WHERE id = ?").run(paused.id);
      const other = new WorkspaceService(w.database, { issuer: "test", subject: "other", workspaceName: "Other" });
      other.ensureDevelopmentIdentity();
      create(other, "Private other workspace", "2026-09-08");
      const before = w.database.prepare("SELECT total_changes() AS n").get();
      const calendar = w.service.jobSearchQueryService.applicationCalendar("Australia/Sydney");
      expect(calendar.months.map(m => m.total)).toEqual([1, 3]);
      expect(calendar.months[1]!.days[7]!.applications).toHaveLength(2);
      expect(calendar.undatedCount).toBe(1);
      const html = applicationListView(w.service, { pageSize: 1, q: "Current" }, "Australia/Sydney");
      expect(html.indexOf('aria-label="投递时间轴"')).toBeLessThan(html.indexOf('aria-label="邮件更新"'));
      expect(html).toContain('value="ONGOING" selected');
      expect(html).toContain('aria-label="2026-09-08，2份投递"');
      expect(html).toContain('aria-current="date"');
      expect(html).toContain("&lt;script&gt;Closed&lt;/script&gt;");
      expect(html).not.toContain("<script>Closed</script>");
      expect(html).not.toContain("Private other workspace");
      const rows = html.slice(html.indexOf('<div data-page-items>'));
      expect(rows).not.toContain("Closed");
      expect(rows).not.toContain("Paused");
      expect(w.service.jobSearchQueryService.listApplications({ status: "ONGOING" }).totalCount).toBe(4);
      expect(w.database.prepare("SELECT total_changes() AS n").get()).toEqual(before);
    } finally { w.cleanup(); }
  });
});
