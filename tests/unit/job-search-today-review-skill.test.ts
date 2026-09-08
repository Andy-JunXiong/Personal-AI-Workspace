import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const skillDirectory = resolve(
  process.cwd(),
  ".agents/skills/job-search-today-review",
);
const skillPath = resolve(skillDirectory, "SKILL.md");
const skill = readFileSync(skillPath, "utf8");

const frontmatterMatch = skill.match(/^---\n([\s\S]*?)\n---\n/u);
const frontmatter = frontmatterMatch?.[1] ?? "";

describe("job-search-today-review Skill contract", () => {
  it("uses the repository-level Codex discovery location and minimal package", () => {
    expect(existsSync(skillPath)).toBe(true);
    expect(readdirSync(skillDirectory).sort()).toEqual(["SKILL.md"]);
  });

  it("has exact routing metadata and declares the adjacent boundaries", () => {
    expect(frontmatterMatch).not.toBeNull();
    expect(frontmatter).toMatch(/^name: job-search-today-review$/mu);
    expect(frontmatter).toMatch(/^description: .+$/mu);
    expect(frontmatter).toContain("what needs attention today");
    expect(frontmatter).toContain("Read-only");
    expect(frontmatter).toContain("mail scans");
    expect(frontmatter).not.toContain("TODO");
  });

  it("pins the normal trace to one Today read and bounds extra reads", () => {
    expect(skill).toContain("Call `workspace_get_today` exactly once");
    expect(skill).toContain("`applicationsWithoutOpenTask`");
    expect(skill).toContain("`recentLifecycleChanges`");
    expect(skill).toContain("`workspace_get_task` or `workspace_get_project`");
    expect(skill).toContain("Do not enumerate Applications, Projects, or Tasks");
    expect(skill).toContain("Do not recalculate,\n   reclassify, or rerank items");
  });

  it("fails closed and has no mutation or alternate-source branch", () => {
    expect(skill).toContain("This Skill has no mutation branch");
    expect(skill).toContain("Do not call any Workspace mutation tool");
    expect(skill).toContain("Do not call Gmail or mail-evidence tools");
    expect(skill).toContain("Do not use direct database access");
    expect(skill).toContain("do not switch to a database, website, Gmail, or\n   another data source");
  });

  it("contains no embedded secret, stale absolute path, or copied lifecycle graph", () => {
    expect(skill).not.toMatch(/(?:api[_-]?key|bearer|password|secret)\s*[:=]/iu);
    expect(skill).not.toMatch(/(?:^|\s)(?:\/Users\/|\/home\/|[A-Z]:\\)/mu);
    expect(skill).not.toMatch(/APPLIED\s*(?:->|→)/u);
    expect(skill).not.toMatch(/INTERVIEWING\s*(?:->|→)/u);
  });
});
