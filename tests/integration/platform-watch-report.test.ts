import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyPlatformWatchMigration } from "../../scripts/verify-platform-watch-migration.js";
import { verifiedRequestContext } from "../../src/application/request-context.js";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { openDatabase } from "../../src/persistence/database.js";
import { platformWatchReportView, platformWatchView, todayView } from "../../src/web/views.js";
import { createEmptyTestWorkspace } from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const fixture = createEmptyTestWorkspace({ clock: () => new Date("2026-09-15T00:00:00.000Z") });
  cleanups.push(fixture.cleanup);
  const context = verifiedRequestContext(fixture.database, fixture.identity, "WEB", randomUUID());
  const service = new WorkspaceService(fixture.database, context, {
    timeZone: "Australia/Sydney",
    clock: () => new Date("2026-09-15T00:00:00.000Z"),
  });
  return { ...fixture, web: service };
}

function report(intentKey = randomUUID(), patch: Record<string, unknown> = {}) {
  return {
    externalId: "openai-platform-watch:2026-09-15",
    title: "OpenAI Platform Watch — 2026-09-15",
    generatedAt: "2026-09-15T09:00:00+10:00",
    sourceUrl: "https://chatgpt.com/c/report",
    evidenceCutoff: "2026-09-15T08:59:00+10:00",
    repositorySha: "a".repeat(40),
    directionalJudgment: "NO_DRIFT",
    summary: "Keep platform execution and require domain readback.",
    body: "Decision-first report body <script>unsafe()</script>",
    findings: [{
        key: "W20260915-01",
        title: "Keep bounded platform execution",
        direction: "ADOPT",
        verification: "LIVE_VERIFIED",
        recommendation: "Retain the platform scheduler for the Watch.",
        nextStep: "Review the first revised scheduled report.",
        evidence: [{ label: "Official task docs", url: "https://learn.chatgpt.com/docs/automations" }],
      }],
    intentKey,
    ...patch,
  };
}

function validReport(intentKey = randomUUID(), patch: Record<string, unknown> = {}) {
  return report(intentKey, patch);
}

describe("Platform Watch report-to-decision P0", () => {
  it("adds only empty Watch tables while preserving the migration 016 database", () => {
    const w = createEmptyTestWorkspace();
    try {
      const oldMigrations = resolve(w.directory, "migrations016");
      mkdirSync(oldMigrations);
      for (const file of readdirSync("db/migrations").filter((name) => name.endsWith(".sql") && name < "017_")) {
        copyFileSync(resolve("db/migrations", file), resolve(oldMigrations, file));
      }
      const before = resolve(w.directory, "before.db");
      const after = resolve(w.directory, "after.db");
      const old = openDatabase(before, oldMigrations);
      new WorkspaceService(old, { issuer: "migration", subject: "retained", workspaceName: "Retained" })
        .ensureDevelopmentIdentity();
      old.close();
      copyFileSync(before, after);
      openDatabase(after).close();
      openDatabase(after).close();
      openDatabase(after, oldMigrations).close();
      expect(verifyPlatformWatchMigration(before, after)).toMatchObject({
        status: "PASS",
        addedTables: ["platform_watch_decisions", "platform_watch_findings", "platform_watch_reports"],
      });
    } finally {
      w.cleanup();
    }
  });

  it("records immutable reports, rejects identity drift, and deduplicates exact content", () => {
    const w = setup();
    const input = validReport();
    const first = w.web.platformWatchService.recordReportFromWeb(input);
    expect(first).toMatchObject({ created: true, replayed: false });
    expect(first.report.pendingFindingCount).toBe(1);
    expect(w.web.platformWatchService.recordReportFromWeb(input)).toMatchObject({
      created: true,
      replayed: true,
      report: { id: first.report.id },
    });
    expect(w.web.platformWatchService.recordReportFromWeb({ ...input, intentKey: randomUUID() }))
      .toMatchObject({ created: false, replayed: false, report: { id: first.report.id } });
    expect(() => w.web.platformWatchService.recordReportFromWeb({
      ...input,
      body: "Changed report",
      intentKey: randomUUID(),
    })).toThrow(/externalId already exists/u);
    expect(w.web.platformWatchService.recordReportFromWeb({
      ...input,
      externalId: "openai-platform-watch:duplicate-alias",
      intentKey: randomUUID(),
    })).toMatchObject({ created: false, report: { id: first.report.id } });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM platform_watch_reports").get()).toEqual({ n: 1 });
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM platform_watch_findings").get()).toEqual({ n: 1 });
  });

  it("requires authenticated web authority and isolates report reads by Workspace", () => {
    const w = setup();
    expect(() => w.service.platformWatchService.recordReportFromWeb(validReport())).toThrow(/verified browser/u);
    const created = w.web.platformWatchService.recordReportFromWeb(validReport()).report;
    const other = new WorkspaceService(w.database, {
      issuer: "platform-watch-test",
      subject: "other-user",
      workspaceName: "Other Workspace",
    });
    other.ensureDevelopmentIdentity();
    expect(other.platformWatchService.listReports()).toEqual([]);
    expect(() => other.platformWatchService.getReport(created.id)).toThrow(/not found/u);
  });

  it("records attributable, versioned decisions with idempotency and stale-write protection", () => {
    const w = setup();
    const created = w.web.platformWatchService.recordReportFromWeb(validReport()).report;
    const decision = {
      action: "ACCEPT",
      expectedRecordVersion: 1,
      note: "Use platform scheduling; keep PAW readback evidence.",
      intentKey: randomUUID(),
    };
    const first = w.web.platformWatchService.decideFindingFromWeb(created.id, "W20260915-01", decision);
    expect(first).toMatchObject({
      changed: true,
      replayed: false,
      finding: { decision: "ACCEPTED", recordVersion: 2 },
      report: { pendingFindingCount: 0 },
    });
    expect(w.web.platformWatchService.decideFindingFromWeb(created.id, "W20260915-01", decision).replayed).toBe(true);
    expect(() => w.web.platformWatchService.decideFindingFromWeb(created.id, "W20260915-01", {
      action: "DEFER",
      expectedRecordVersion: 2,
      note: "A decided finding must be reopened first.",
      intentKey: randomUUID(),
    })).toThrow(/Reopen the finding/u);
    expect(() => w.web.platformWatchService.decideFindingFromWeb(created.id, "W20260915-01", {
      ...decision,
      action: "DEFER",
      intentKey: randomUUID(),
    })).toThrow(/current version is 2/u);
    const reopened = w.web.platformWatchService.decideFindingFromWeb(created.id, "W20260915-01", {
      action: "REOPEN",
      expectedRecordVersion: 2,
      note: "New contrary evidence requires another review.",
      intentKey: randomUUID(),
    });
    expect(reopened).toMatchObject({ finding: { decision: "PENDING", recordVersion: 3 }, report: { pendingFindingCount: 1 } });
    expect(reopened.finding.decisionHistory).toHaveLength(2);
    expect(reopened.finding.decisionHistory[0]).toMatchObject({
      fromDecision: "ACCEPTED",
      toDecision: "PENDING",
      authorityType: "EXPLICIT_USER_WEB",
      channel: "WEB",
    });
    expect(() => w.web.platformWatchService.decideFindingFromWeb(created.id, "W20260915-01", {
      action: "REOPEN",
      expectedRecordVersion: 3,
      note: "This is already pending.",
      intentKey: randomUUID(),
    })).toThrow(/cannot be reopened/u);
    expect(w.database.prepare(`SELECT channel, authority_type, from_decision, to_decision
      FROM platform_watch_decisions ORDER BY record_version`).all()).toEqual([
      { channel: "WEB", authority_type: "EXPLICIT_USER_WEB", from_decision: "PENDING", to_decision: "ACCEPTED" },
      { channel: "WEB", authority_type: "EXPLICIT_USER_WEB", from_decision: "ACCEPTED", to_decision: "PENDING" },
    ]);
    const html = platformWatchReportView(w.web, created.id, "Australia/Sydney", "2026-09-15T00:00:00.000Z", true);
    expect(html).toContain("决定历史（2）");
    expect(html).toContain("PENDING → ACCEPTED");
    expect(html).toContain("ACCEPTED → PENDING");
  });

  it("surfaces only pending reports on Today and escapes imported content", () => {
    const w = setup();
    const created = w.web.platformWatchService.recordReportFromWeb(validReport()).report;
    const pending = todayView(w.web, "2026-09-15T00:00:00.000Z");
    expect(pending).toContain("1 项判断等待你的决定");
    expect(pending).toContain(created.id);
    expect(platformWatchView(w.web, "Australia/Sydney", "2026-09-15T00:00:00.000Z", false))
      .not.toContain("data-platform-watch-import");
    expect(platformWatchReportView(w.web, created.id, "Australia/Sydney", "2026-09-15T00:00:00.000Z", false))
      .not.toContain("data-decide-watch-finding");
    const detail = w.web.platformWatchService.getReport(created.id);
    expect(detail.body).toContain("<script>");
    const html = platformWatchReportView(
      w.web,
      created.id,
      "Australia/Sydney",
      "2026-09-15T00:00:00.000Z",
      true,
    );
    expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe()</script>");
    w.web.platformWatchService.decideFindingFromWeb(created.id, "W20260915-01", {
      action: "REJECT",
      expectedRecordVersion: 1,
      note: "The evidence does not support this choice.",
      intentKey: randomUUID(),
    });
    expect(todayView(w.web, "2026-09-15T00:00:00.000Z")).not.toContain("判断等待你的决定");
  });

  it("rejects duplicate finding keys before writing", () => {
    const w = setup();
    const base = validReport();
    expect(() => w.web.platformWatchService.recordReportFromWeb({
      ...base,
      findings: [base.findings[0], base.findings[0]],
    })).toThrow(/Finding keys must be unique/u);
    expect(w.database.prepare("SELECT COUNT(*) AS n FROM platform_watch_reports").get()).toEqual({ n: 0 });
  });
});
