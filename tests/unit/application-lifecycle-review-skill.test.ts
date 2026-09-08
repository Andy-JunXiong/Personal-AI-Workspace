import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const skillDirectory = resolve(
  process.cwd(),
  ".agents/skills/application-lifecycle-review",
);
const skillPath = resolve(skillDirectory, "SKILL.md");
const mutationPath = resolve(skillDirectory, "references/mutation-procedure.md");
const skill = readFileSync(skillPath, "utf8");
const mutation = readFileSync(mutationPath, "utf8");
const combined = `${skill}\n${mutation}`;

const allowedWorkspaceTools = new Set([
  "workspace_admit_transition",
  "workspace_find_job_application",
  "workspace_get_project",
  "workspace_list_job_applications",
  "workspace_propose_transition",
  "workspace_record_observation",
]);

describe("application-lifecycle-review Skill contract", () => {
  it("uses a minimal progressively disclosed package", () => {
    expect(existsSync(skillPath)).toBe(true);
    expect(existsSync(mutationPath)).toBe(true);
    expect(readdirSync(skillDirectory).sort()).toEqual(["SKILL.md", "references"]);
    expect(readdirSync(resolve(skillDirectory, "references"))).toEqual([
      "mutation-procedure.md",
    ]);
    expect(skill).toContain("[the mutation procedure](references/mutation-procedure.md)");
  });

  it("has discriminating routing metadata and defaults advice to read-only", () => {
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/u)?.[1] ?? "";
    expect(frontmatter).toMatch(/^name: application-lifecycle-review$/mu);
    expect(frontmatter).toContain("named-application status");
    expect(frontmatter).toContain("Read-only by default");
    expect(frontmatter).toContain("broad daily reviews");
    expect(skill).toContain("A recommendation is not authority");
  });

  it("limits the procedure to the reviewed Workspace tool set", () => {
    const usedTools = new Set(combined.match(/workspace_[a-z_]+/gu) ?? []);
    expect(usedTools).toEqual(allowedWorkspaceTools);
  });

  it("requires exact resolution, all authority gates, and exact readback", () => {
    expect(skill).toContain("On `AMBIGUOUS`, stop");
    expect(skill).toContain("Do not use fuzzy matching");
    expect(skill).toContain("always perform the fresh exact read");
    expect(mutation).toContain("Platform permission");
    expect(mutation).toContain("Workspace authority");
    expect(mutation).toContain("Domain admission");
    expect(mutation).toContain("a proposal also requires platform\npermission and explicit Workspace authority");
    expect(mutation).toContain("authoritative domain-validation operation");
    expect(mutation).toContain("regardless of the proposal\n   response's apparent success");
    expect(mutation).toContain("never admit\nfrom conversation history alone");
    expect(mutation).toContain("do not create another proposal");
    expect(mutation).toContain("readback is authoritative");
  });

  it("does not copy the lifecycle graph or add an unsafe retry path", () => {
    expect(combined).not.toMatch(/APPLIED\s*(?:->|→)/u);
    expect(combined).not.toMatch(/INTERVIEWING\s*(?:->|→)/u);
    expect(combined).toContain("Never retry a rejected mutation blindly");
    expect(combined).toContain("exact same key and\n  payload");
  });

  it("contains no embedded secret or stale machine path", () => {
    expect(combined).not.toMatch(/(?:api[_-]?key|bearer|password|secret)\s*[:=]/iu);
    expect(combined).not.toMatch(/(?:^|\s)(?:\/Users\/|\/home\/|[A-Z]:\\)/mu);
  });
});
