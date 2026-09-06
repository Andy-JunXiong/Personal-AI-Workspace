import { describe, expect, it } from "vitest";
import { createWorkspaceWebLinks } from "../../src/mcp/web-links.js";

describe("Workspace Web links", () => {
  it("stays absent until an exact HTTPS origin is configured", () => {
    expect(createWorkspaceWebLinks()).toBeUndefined();
    for (const origin of ["http://workspace.example.test", "https://workspace.example.test/path",
      "https://user@workspace.example.test", "not-an-origin"]) {
      expect(() => createWorkspaceWebLinks(origin)).toThrow(/exact HTTPS origin/u);
    }
  });

  it("builds canonical Today, inventory, application and task routes", () => {
    const links = createWorkspaceWebLinks("https://workspace.example.test")!;
    expect(links.today()).toBe("https://workspace.example.test/workspace/job-search/today");
    expect(links.applications()).toBe("https://workspace.example.test/workspace/job-search/applications");
    expect(links.application("project-id")).toBe("https://workspace.example.test/workspace/job-search/applications/project-id");
    expect(links.task("task-id")).toBe("https://workspace.example.test/workspace/job-search/tasks/task-id");
  });
});
