import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceService } from "../../src/application/workspace-service.js";
import { createTestWorkspace } from "../helpers/test-workspace.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const workspace = createTestWorkspace();
  cleanups.push(workspace.cleanup);
  return workspace;
}

function totalChanges(workspace: ReturnType<typeof createTestWorkspace>) {
  return (
    workspace.database.prepare("SELECT total_changes() AS count").get() as {
      count: number;
    }
  ).count;
}

describe("WorkspaceService Job Application lookup", () => {
  it("returns one exact match after Unicode NFKC normalization", () => {
    const workspace = setup();

    const result = workspace.service.findJobApplication(
      "Ｅｘａｍｐｌｅ　Ｃｏ",
      "Ｓｏｆｔｗａｒｅ　Ｅｎｇｉｎｅｅｒ",
    );

    expect(result).toEqual({
      matchStatus: "EXACT",
      matches: [
        expect.objectContaining({
          projectId: workspace.projectId,
          company: "Example Co",
          role: "Software Engineer",
          projectStatus: "ACTIVE",
          lifecycleState: "APPLIED",
          lifecycleVersion: 1,
        }),
      ],
    });
  });

  it("normalizes case differences", () => {
    const workspace = setup();

    expect(
      workspace.service.findJobApplication("EXAMPLE CO", "software engineer")
        .matchStatus,
    ).toBe("EXACT");
  });

  it("trims and collapses whitespace differences", () => {
    const workspace = setup();

    expect(
      workspace.service.findJobApplication(
        "  Example   Co  ",
        " Software\t\nEngineer ",
      ).matchStatus,
    ).toBe("EXACT");
  });

  it("does not fuzzy-match similar company or role values", () => {
    const workspace = setup();

    expect(
      workspace.service.findJobApplication("Example Company", "Software Engineer"),
    ).toEqual({ matchStatus: "NOT_FOUND", matches: [] });
    expect(
      workspace.service.findJobApplication("Example Co", "Software Developer"),
    ).toEqual({ matchStatus: "NOT_FOUND", matches: [] });
  });

  it("returns NOT_FOUND without writing", () => {
    const workspace = setup();
    const before = totalChanges(workspace);

    const result = workspace.service.findJobApplication(
      "Missing Co",
      "Software Engineer",
    );

    expect(result).toEqual({ matchStatus: "NOT_FOUND", matches: [] });
    expect(totalChanges(workspace)).toBe(before);
  });

  it("returns every exact candidate as AMBIGUOUS without writing or choosing", () => {
    const workspace = setup();
    workspace.service.seedJobApplication({
      projectId: "20000000-0000-4000-8000-000000000001",
      initialTransitionId: "20000000-0000-4000-8000-000000000002",
      title: "Duplicate Example Co application",
      company: "Example Co",
      role: "Software Engineer",
    });
    const before = totalChanges(workspace);

    const result = workspace.service.findJobApplication(
      "Example Co",
      "Software Engineer",
    );

    expect(result.matchStatus).toBe("AMBIGUOUS");
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((match) => match.projectId).sort()).toEqual([
      "10000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000001",
    ]);
    expect(totalChanges(workspace)).toBe(before);
  });

  it("excludes closed Job Applications", () => {
    const workspace = setup();
    workspace.database
      .prepare("UPDATE projects SET status = 'CLOSED' WHERE id = ?")
      .run(workspace.projectId);

    expect(
      workspace.service.findJobApplication("Example Co", "Software Engineer"),
    ).toEqual({ matchStatus: "NOT_FOUND", matches: [] });
  });

  it("cannot return a Job Application from another Workspace", () => {
    const workspace = setup();
    const otherService = new WorkspaceService(workspace.database, {
      issuer: "test-suite",
      subject: "other-user",
      workspaceName: "Other Workspace",
    });
    otherService.ensureDevelopmentIdentity();
    otherService.seedJobApplication({
      projectId: "30000000-0000-4000-8000-000000000001",
      initialTransitionId: "30000000-0000-4000-8000-000000000002",
      title: "Isolated Co — Platform Engineer",
      company: "Isolated Co",
      role: "Platform Engineer",
    });

    expect(
      workspace.service.findJobApplication("Isolated Co", "Platform Engineer"),
    ).toEqual({ matchStatus: "NOT_FOUND", matches: [] });
    expect(
      otherService.findJobApplication("Isolated Co", "Platform Engineer"),
    ).toMatchObject({
      matchStatus: "EXACT",
      matches: [{ projectId: "30000000-0000-4000-8000-000000000001" }],
    });
  });
});
