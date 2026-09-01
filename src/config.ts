import { resolve } from "node:path";

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

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const port = Number.parseInt(environment.PORT ?? "3000", 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid PORT: ${environment.PORT}`);
  }

  return {
    port,
    databasePath: resolve(
      requiredValue(environment.PAW_DB_PATH, "./data/workspace.db"),
    ),
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
