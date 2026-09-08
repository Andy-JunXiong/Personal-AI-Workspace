import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const packageScript = resolve(repositoryRoot, "scripts/package-workspace-skills.mjs");
const releaseConfigPath = resolve(repositoryRoot, ".agents/skills/release.json");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const temporaryRoots: string[] = [];

function createOutputDirectory(label: string) {
  const directory = mkdtempSync(join(tmpdir(), `paw-skills-${label}-`));
  temporaryRoots.push(directory);
  return join(directory, "release");
}

function packageSkills(outputDirectory: string) {
  const result = spawnSync(
    process.execPath,
    [packageScript, "--source-ref", sourceCommit, "--output", outputDirectory],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(readFileSync(join(outputDirectory, "release-manifest.json"), "utf8"));
}

function createRepositoryFixture(label: string) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), `paw-skills-repository-${label}-`));
  temporaryRoots.push(fixtureRoot);
  mkdirSync(resolve(fixtureRoot, "scripts"), { recursive: true });
  cpSync(packageScript, resolve(fixtureRoot, "scripts/package-workspace-skills.mjs"));
  cpSync(resolve(repositoryRoot, ".agents"), resolve(fixtureRoot, ".agents"), {
    recursive: true,
  });

  const git = (argumentsList: string[]) =>
    execFileSync("git", argumentsList, { cwd: fixtureRoot, encoding: "utf8" }).trim();
  git(["init", "--initial-branch=main"]);
  git(["add", ".agents", "scripts/package-workspace-skills.mjs"]);
  execFileSync(
    "git",
    [
      "-c",
      "user.name=PAW Test",
      "-c",
      "user.email=paw-test@example.invalid",
      "commit",
      "-m",
      "fixture",
    ],
    { cwd: fixtureRoot, encoding: "utf8" },
  );
  writeFileSync(resolve(fixtureRoot, "fixture-marker.txt"), "second commit\n");
  git(["add", "fixture-marker.txt"]);
  execFileSync(
    "git",
    [
      "-c",
      "user.name=PAW Test",
      "-c",
      "user.email=paw-test@example.invalid",
      "commit",
      "-m",
      "fixture head",
    ],
    { cwd: fixtureRoot, encoding: "utf8" },
  );

  return {
    fixtureRoot,
    fixtureScript: resolve(fixtureRoot, "scripts/package-workspace-skills.mjs"),
    sourceCommit: git(["rev-parse", "HEAD"]),
  };
}

function sha256(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

function readStoredZip(zipPath: string) {
  const zip = readFileSync(zipPath);
  const entries = new Map<string, Buffer>();
  let offset = 0;

  while (zip.readUInt32LE(offset) === 0x04034b50) {
    expect(zip.readUInt16LE(offset + 8)).toBe(0);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = zip.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.set(name, zip.subarray(contentStart, contentStart + compressedSize));
    offset = contentStart + compressedSize;
  }

  return entries;
}

afterAll(() => {
  for (const directory of temporaryRoots) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Workspace Skills release packaging", () => {
  it("produces byte-identical packages and manifests for the same source", () => {
    const firstOutput = createOutputDirectory("first");
    const secondOutput = createOutputDirectory("second");
    const firstManifest = packageSkills(firstOutput);
    const secondManifest = packageSkills(secondOutput);

    expect(firstManifest).toEqual(secondManifest);
    expect(firstManifest.sourceCommit).toBe(sourceCommit);
    expect(firstManifest.releaseVersion).toBe("0.1.0");
    expect(firstManifest.releaseConfigSha256).toBe(
      sha256(readFileSync(releaseConfigPath)),
    );

    for (const skill of firstManifest.skills) {
      expect(readFileSync(join(firstOutput, skill.packageFile))).toEqual(
        readFileSync(join(secondOutput, skill.packageFile)),
      );
    }
  });

  it("preserves canonical Skill files and progressive-disclosure references", () => {
    const outputDirectory = createOutputDirectory("contents");
    const manifest = packageSkills(outputDirectory);
    const s1 = manifest.skills.find(
      (skill: { name: string }) => skill.name === "job-search-today-review",
    );
    const s2 = manifest.skills.find(
      (skill: { name: string }) => skill.name === "application-lifecycle-review",
    );
    expect(s1.sourceFiles.map((file: { path: string }) => file.path)).toEqual([
      "SKILL.md",
    ]);
    expect(s2.sourceFiles.map((file: { path: string }) => file.path)).toEqual([
      "SKILL.md",
      "references/mutation-procedure.md",
    ]);

    for (const skill of [s1, s2]) {
      const entries = readStoredZip(join(outputDirectory, skill.packageFile));
      for (const file of skill.sourceFiles) {
        const source = readFileSync(
          resolve(repositoryRoot, skill.sourceDirectory, file.path),
        );
        expect(entries.get(file.path)).toEqual(source);
        expect(file.sha256).toBe(sha256(source));
      }
    }
  });

  it("records the reviewed PAW capability boundary without granting authority", () => {
    const outputDirectory = createOutputDirectory("capabilities");
    const manifest = packageSkills(outputDirectory);
    const toolsBySkill = Object.fromEntries(
      manifest.skills.map((skill: { name: string; requiredWorkspaceTools: string[] }) => [
        skill.name,
        skill.requiredWorkspaceTools,
      ]),
    );

    expect(toolsBySkill).toEqual({
      "job-search-today-review": [
        "workspace_get_today",
        "workspace_get_project",
        "workspace_get_task",
      ],
      "application-lifecycle-review": [
        "workspace_admit_transition",
        "workspace_find_job_application",
        "workspace_get_project",
        "workspace_list_job_applications",
        "workspace_propose_transition",
        "workspace_record_observation",
      ],
    });
    expect(manifest.workspaceCompatibility.note).toContain(
      "does not grant Workspace authority or domain admission",
    );
  });

  it("refuses to remove unmanaged output content", () => {
    const outputDirectory = createOutputDirectory("unmanaged-output");
    writeFileSync(outputDirectory.replace(/\/release$/u, "/keep.txt"), "keep\n");

    const result = spawnSync(
      process.execPath,
      [packageScript, "--source-ref", sourceCommit, "--output", outputDirectory.replace(/\/release$/u, "")],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("contains an unmanaged entry");
  });

  it("rejects a source commit that is not the checked-out HEAD", () => {
    const fixture = createRepositoryFixture("wrong-commit");
    const outputDirectory = resolve(fixture.fixtureRoot, "dist/workspace-skills");
    const parentCommit = execFileSync("git", ["rev-parse", "HEAD^"], {
      cwd: fixture.fixtureRoot,
      encoding: "utf8",
    }).trim();
    const result = spawnSync(
      process.execPath,
      [
        fixture.fixtureScript,
        "--source-ref",
        parentCommit,
        "--output",
        outputDirectory,
      ],
      { cwd: fixture.fixtureRoot, encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must match the checked-out HEAD");
    expect(existsSync(outputDirectory)).toBe(false);
  });

  it("rejects modified canonical Skill content", () => {
    const fixture = createRepositoryFixture("modified");
    const outputDirectory = resolve(fixture.fixtureRoot, "dist/workspace-skills");
    appendFileSync(
      resolve(
        fixture.fixtureRoot,
        ".agents/skills/job-search-today-review/SKILL.md",
      ),
      "\nmodified\n",
    );
    const result = spawnSync(
      process.execPath,
      [
        fixture.fixtureScript,
        "--source-ref",
        fixture.sourceCommit,
        "--output",
        outputDirectory,
      ],
      { cwd: fixture.fixtureRoot, encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Canonical Skill source does not match the declared source commit",
    );
    expect(existsSync(outputDirectory)).toBe(false);
  });

  it("rejects uncommitted files in the canonical Skills tree", () => {
    const fixture = createRepositoryFixture("untracked");
    const outputDirectory = resolve(fixture.fixtureRoot, "dist/workspace-skills");
    writeFileSync(
      resolve(fixture.fixtureRoot, ".agents/skills/untracked-policy.md"),
      "not committed\n",
    );
    const result = spawnSync(
      process.execPath,
      [
        fixture.fixtureScript,
        "--source-ref",
        fixture.sourceCommit,
        "--output",
        outputDirectory,
      ],
      { cwd: fixture.fixtureRoot, encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Canonical Skills file list does not match the declared source commit",
    );
    expect(existsSync(outputDirectory)).toBe(false);
  });
});
