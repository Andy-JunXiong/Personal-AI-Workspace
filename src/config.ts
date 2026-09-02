import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

export interface AppConfig {
  port: number;
  databasePath: string;
  migrationsDirectory: string;
  developmentPrincipal: {
    issuer: string;
    subject: string;
    workspaceName: string;
  };
}

function requiredValue(value: string | undefined, fallback: string): string {
  const selected = value?.trim() || fallback;
  if (!selected) {
    throw new Error("Configuration value must not be empty");
  }
  return selected;
}

function defaultDatabasePath(environment: NodeJS.ProcessEnv): string {
  const localAppData = environment.LOCALAPPDATA?.trim();
  if (localAppData) {
    return join(
      localAppData,
      "PersonalAIWorkspace",
      "data",
      "workspace.db",
    );
  }

  const xdgDataHome = environment.XDG_DATA_HOME?.trim();
  const dataHome = xdgDataHome || join(homedir(), ".local", "share");
  return join(dataHome, "PersonalAIWorkspace", "data", "workspace.db");
}

function expandEnvironmentReferences(
  value: string,
  environment: NodeJS.ProcessEnv,
): string {
  return value.replace(/%([^%]+)%/gu, (reference, name: string) => {
    const replacement = environment[name];
    return replacement?.trim() ? replacement : reference;
  });
}

function isWithinPath(candidate: string, root: string): boolean {
  const comparisonCandidate = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  const comparisonRoot = process.platform === "win32" ? root.toLowerCase() : root;
  const pathFromRoot = relative(comparisonRoot, comparisonCandidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function assertRealDataPathBoundary(
  databasePath: string,
  environment: NodeJS.ProcessEnv,
): void {
  const forbiddenRoots = [
    resolve(),
    environment.OneDrive,
    environment.OneDriveConsumer,
    environment.OneDriveCommercial,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => resolve(value));

  if (forbiddenRoots.some((root) => isWithinPath(databasePath, root))) {
    throw new Error(
      "PAW_DB_PATH must resolve outside the repository and configured OneDrive directories",
    );
  }
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const port = Number.parseInt(environment.PORT ?? "3000", 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid PORT: ${environment.PORT}`);
  }

  const configuredDatabasePath = requiredValue(
    environment.PAW_DB_PATH,
    defaultDatabasePath(environment),
  );
  const databasePath = resolve(
    expandEnvironmentReferences(configuredDatabasePath, environment),
  );
  assertRealDataPathBoundary(databasePath, environment);

  return {
    port,
    databasePath,
    migrationsDirectory: resolve("db/migrations"),
    developmentPrincipal: {
      issuer: requiredValue(
        environment.PAW_DEV_PRINCIPAL_ISSUER,
        "dev-tunnel",
      ),
      subject: requiredValue(
        environment.PAW_DEV_PRINCIPAL_SUBJECT,
        "local-user",
      ),
      workspaceName: requiredValue(
        environment.PAW_DEV_WORKSPACE_NAME,
        "Personal AI Workspace",
      ),
    },
  };
}
