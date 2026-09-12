import { ValidationError } from "../domain/errors.js";
import { githubSnapshotSchema } from "../domain/skill-library.js";

// Fixed API origin, no redirects, credentials, code execution or arbitrary URLs.
export async function readGithubProject(repositoryUrl: string, paths: string[],
  previousCommit: string | null, fetcher: typeof fetch = fetch) {
  const parts = new URL(repositoryUrl).pathname.replace(/\/$/u, "").split("/").slice(1);
  const api = `https://api.github.com/repos/${parts.map(encodeURIComponent).join("/")}`;
  const signal = AbortSignal.timeout(30000);
  async function json(url: string) {
    const response = await fetcher(url, { redirect: "error", signal,
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Personal-AI-Workspace" } });
    if (!response.ok) throw new ValidationError(`GitHub refresh unavailable (HTTP ${response.status}); previous evidence retained`);
    if (!response.body) throw new ValidationError("Empty GitHub response");
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length;
        if (size > 200000) throw new ValidationError("GitHub response exceeds evidence limit");
        chunks.push(part.value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    } finally { await reader.cancel(); }
  }
  const head = await json(`${api}/commits/HEAD`);
  if (typeof head.sha !== "string" || !/^[a-f0-9]{40}$/u.test(head.sha)) throw new ValidationError("GitHub commit was not verifiable");
  if (head.sha === previousCommit) return { commit: head.sha, snapshot: null };
  const files: Array<{ path: string; url: string; text: string }> = [];
  let total = 0;
  for (const path of paths) {
    const file = await json(`${api}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${head.sha}`);
    if (file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string" ||
        typeof file.size !== "number" || file.size > 30000) throw new ValidationError(`Not a supported bounded text file: ${path}`);
    const bytes = Buffer.from(file.content, "base64");
    if (bytes.length > 30000 || bytes.includes(0)) throw new ValidationError(`Not a supported text file: ${path}`);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    total += text.length;
    if (total > 38000) throw new ValidationError("Selected GitHub evidence exceeds 38000 characters; choose fewer files");
    files.push({ path, url: `${repositoryUrl}/blob/${head.sha}/${path.split("/").map(encodeURIComponent).join("/")}`, text });
  }
  return { commit: head.sha, snapshot: githubSnapshotSchema.parse({ format: "github-project-v1", repositoryUrl,
    commit: head.sha, paths, files,
    limitation: "Selected files only, not a whole-repository audit. Repository technology is not proof of personal contribution, proficiency or commercial SWE tenure." }) };
}
