import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const releaseConfigPath = resolve(repositoryRoot, ".agents/skills/release.json");
const defaultOutputDirectory = resolve(repositoryRoot, "dist/workspace-skills");
const utf8Flag = 0x0800;
const dosTime = 0;
const dosDate = 0x21; // 1980-01-01, the earliest DOS ZIP date.

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function crc32(content) {
  let value = 0xffffffff;
  for (const byte of content) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function gitText(argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
}

function gitBuffer(argumentsList) {
  return execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: null,
  });
}

function collectFiles(directory, prefix = "") {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    compareNames(left.name, right.name),
  );
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    const archivePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

    if (entry.isSymbolicLink()) {
      throw new Error(`Skill packages must not contain symbolic links: ${archivePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath, archivePath));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported Skill package entry: ${archivePath}`);
    }

    files.push({ archivePath, content: readFileSync(absolutePath) });
  }

  return files;
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const file of files) {
    const name = Buffer.from(file.archivePath, "utf8");
    const checksum = crc32(file.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(utf8Flag, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(file.content.length, 18);
    localHeader.writeUInt32LE(file.content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, file.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(utf8Flag, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(file.content.length, 20);
    centralHeader.writeUInt32LE(file.content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + file.content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function parseArguments(argumentsList) {
  const options = { outputDirectory: defaultOutputDirectory, sourceRef: null };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--output") {
      const value = argumentsList[index + 1];
      if (!value) throw new Error("--output requires a directory");
      options.outputDirectory = isAbsolute(value)
        ? resolve(value)
        : resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (argument === "--source-ref") {
      const value = argumentsList[index + 1];
      if (!value) throw new Error("--source-ref requires a 40-character commit SHA");
      options.sourceRef = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function resolveSourceCommit(sourceRef) {
  const commit = sourceRef ?? gitText(["rev-parse", "HEAD"]);
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error(`Source ref must be a lowercase 40-character commit SHA: ${commit}`);
  }

  let resolvedCommit;
  try {
    resolvedCommit = gitText(["rev-parse", "--verify", `${commit}^{commit}`]);
  } catch {
    throw new Error(`Source ref is not an available Git commit: ${commit}`);
  }
  const headCommit = gitText(["rev-parse", "HEAD"]);
  if (resolvedCommit !== headCommit) {
    throw new Error(
      `Source commit must match the checked-out HEAD: source=${resolvedCommit} HEAD=${headCommit}`,
    );
  }

  return commit;
}

function assertCanonicalSourcesMatchCommit(sourceCommit) {
  const skillsRoot = resolve(repositoryRoot, ".agents/skills");
  const workingFiles = collectFiles(skillsRoot);
  const committedPrefix = ".agents/skills/";
  const committedFiles = gitText([
    "ls-tree",
    "-r",
    "--name-only",
    sourceCommit,
    "--",
    ".agents/skills",
  ])
    .split("\n")
    .filter(Boolean)
    .map((path) => path.slice(committedPrefix.length))
    .sort(compareNames);
  const workingPaths = workingFiles
    .map((file) => file.archivePath)
    .sort(compareNames);

  if (JSON.stringify(workingPaths) !== JSON.stringify(committedFiles)) {
    throw new Error(
      "Canonical Skills file list does not match the declared source commit",
    );
  }

  for (const file of workingFiles) {
    const committedContent = gitBuffer([
      "show",
      `${sourceCommit}:${committedPrefix}${file.archivePath}`,
    ]);
    if (!file.content.equals(committedContent)) {
      throw new Error(
        `Canonical Skill source does not match the declared source commit: ${file.archivePath}`,
      );
    }
  }
}

function assertSafeOutputDirectory(outputDirectory) {
  const repositoryFromOutput = relative(outputDirectory, repositoryRoot);
  if (
    repositoryFromOutput === "" ||
    (!repositoryFromOutput.startsWith(`..${sep}`) && repositoryFromOutput !== "..")
  ) {
    throw new Error(`Output directory must not contain the repository: ${outputDirectory}`);
  }

  const skillsRoot = resolve(repositoryRoot, ".agents/skills");
  const outputFromSkills = relative(skillsRoot, outputDirectory);
  if (
    outputFromSkills === "" ||
    (!outputFromSkills.startsWith(`..${sep}`) && outputFromSkills !== "..")
  ) {
    throw new Error(`Output directory must not be inside the canonical Skills tree: ${outputDirectory}`);
  }
}

function assertManagedOutputDirectory(outputDirectory, packageFiles) {
  if (!existsSync(outputDirectory)) {
    mkdirSync(outputDirectory, { recursive: true });
    return;
  }
  if (lstatSync(outputDirectory).isSymbolicLink()) {
    throw new Error(`Output directory must not be a symbolic link: ${outputDirectory}`);
  }

  const managedFiles = new Set(["release-manifest.json", ...packageFiles]);
  for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !managedFiles.has(entry.name)) {
      throw new Error(
        `Output directory contains an unmanaged entry; refusing to modify it: ${entry.name}`,
      );
    }
  }
}

function assertCanonicalSkillDirectory(sourceDirectory, skillName) {
  const skillsRoot = resolve(repositoryRoot, ".agents/skills");
  const sourceFromSkills = relative(skillsRoot, sourceDirectory);
  if (
    sourceFromSkills === "" ||
    sourceFromSkills.startsWith(`..${sep}`) ||
    sourceFromSkills === ".."
  ) {
    throw new Error(`${skillName} source must be inside the canonical Skills tree`);
  }
}

function canonicalTreeHash(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.archivePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(file.content.length), "utf8");
    hash.update("\0", "utf8");
    hash.update(file.content);
  }
  return hash.digest("hex");
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourceCommit = resolveSourceCommit(options.sourceRef);
  const releaseConfig = readFileSync(releaseConfigPath);
  const config = JSON.parse(releaseConfig.toString("utf8"));
  const packageFiles = config.skills.map(
    (skill) => `${skill.name}-${skill.skillVersion}.zip`,
  );

  assertCanonicalSourcesMatchCommit(sourceCommit);
  assertSafeOutputDirectory(options.outputDirectory);
  assertManagedOutputDirectory(options.outputDirectory, packageFiles);

  const packagedSkills = [];
  for (const skillConfig of config.skills) {
    const sourceDirectory = resolve(repositoryRoot, skillConfig.sourceDirectory);
    assertCanonicalSkillDirectory(sourceDirectory, skillConfig.name);
    const files = collectFiles(sourceDirectory);
    const entrypoint = files.find((file) => file.archivePath === "SKILL.md");
    if (!entrypoint) throw new Error(`${skillConfig.name} is missing SKILL.md`);

    const declaredName = entrypoint.content
      .toString("utf8")
      .match(/^---\n[\s\S]*?^name:\s*([^\n]+)$/mu)?.[1]
      ?.trim();
    if (declaredName !== skillConfig.name) {
      throw new Error(
        `${skillConfig.name} frontmatter name mismatch: ${declaredName ?? "missing"}`,
      );
    }

    const packageFile = `${skillConfig.name}-${skillConfig.skillVersion}.zip`;
    const packageBytes = createStoredZip(files);
    writeFileSync(resolve(options.outputDirectory, packageFile), packageBytes);

    packagedSkills.push({
      name: skillConfig.name,
      skillVersion: skillConfig.skillVersion,
      policyVersion: skillConfig.policyVersion,
      sourceDirectory: skillConfig.sourceDirectory,
      sourceTreeSha256: canonicalTreeHash(files),
      sourceFiles: files.map((file) => ({
        path: file.archivePath,
        bytes: file.content.length,
        sha256: sha256(file.content),
      })),
      requiredWorkspaceTools:
        config.workspaceCompatibility.toolsBySkill[skillConfig.name],
      packageFile,
      packageBytes: packageBytes.length,
      packageSha256: sha256(packageBytes),
    });
  }

  const manifest = {
    schemaVersion: config.schemaVersion,
    releaseVersion: config.releaseVersion,
    sourceCommit,
    canonicalSourceRoot: ".agents/skills",
    releaseConfigSha256: sha256(releaseConfig),
    workspaceCompatibility: {
      capabilitySet: config.workspaceCompatibility.capabilitySet,
      note: "Tool availability does not grant Workspace authority or domain admission.",
    },
    skills: packagedSkills,
  };
  const manifestPath = resolve(options.outputDirectory, "release-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify({ outputDirectory: options.outputDirectory, manifestPath, skills: packagedSkills.map(({ name, packageFile, packageSha256 }) => ({ name, packageFile, packageSha256 })) }, null, 2)}\n`,
  );
}

main();
