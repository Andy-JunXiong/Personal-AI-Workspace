import { ValidationError } from "../domain/errors.js";

const rootPath = "/workspace/job-search";

export interface WorkspaceWebLinks {
  today(): string;
  applications(): string;
  application(projectId: string): string;
  task(taskId: string): string;
}

export function createWorkspaceWebLinks(origin?: string): WorkspaceWebLinks | undefined {
  if (origin === undefined) return undefined;
  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { throw new ValidationError("Web link origin must be an exact HTTPS origin"); }
  if (parsed.protocol !== "https:" || parsed.origin !== origin) {
    throw new ValidationError("Web link origin must be an exact HTTPS origin");
  }
  const link = (path: string) => new URL(path, `${origin}/`).toString();
  return Object.freeze({
    today: () => link(`${rootPath}/today`),
    applications: () => link(`${rootPath}/applications`),
    application: (projectId: string) => link(`${rootPath}/applications/${encodeURIComponent(projectId)}`),
    task: (taskId: string) => link(`${rootPath}/tasks/${encodeURIComponent(taskId)}`),
  });
}
