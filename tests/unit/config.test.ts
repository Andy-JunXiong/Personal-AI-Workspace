import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const principalEnvironment = {
  PAW_DEV_PRINCIPAL_ISSUER: "test",
  PAW_DEV_PRINCIPAL_SUBJECT: "test-user",
  PAW_DEV_WORKSPACE_NAME: "Test Workspace",
};

describe("real-data database path boundary", () => {
  it("defaults to Local App Data outside the repository", () => {
    const localAppData = resolve("..", "paw-local-app-data");
    const config = loadConfig({
      ...principalEnvironment,
      LOCALAPPDATA: localAppData,
    });

    expect(config.databasePath).toBe(
      join(localAppData, "PersonalAIWorkspace", "data", "workspace.db"),
    );
  });

  it("expands the documented LOCALAPPDATA reference", () => {
    const localAppData = resolve("..", "paw-local-app-data");
    const config = loadConfig({
      ...principalEnvironment,
      LOCALAPPDATA: localAppData,
      PAW_DB_PATH:
        "%LOCALAPPDATA%\\PersonalAIWorkspace\\data\\real-workspace.db",
    });

    expect(config.databasePath).toBe(
      join(
        localAppData,
        "PersonalAIWorkspace",
        "data",
        "real-workspace.db",
      ),
    );
  });

  it("rejects a database path inside the repository", () => {
    expect(() =>
      loadConfig({
        ...principalEnvironment,
        PAW_DB_PATH: resolve("data", "real-workspace.db"),
      }),
    ).toThrow(/outside the repository/u);
  });

  it("rejects a database elsewhere inside a configured OneDrive root", () => {
    const oneDrive = resolve("..", "synced-drive");
    expect(() =>
      loadConfig({
        ...principalEnvironment,
        OneDrive: oneDrive,
        PAW_DB_PATH: join(oneDrive, "WorkspaceData", "workspace.db"),
      }),
    ).toThrow(/configured OneDrive/u);
  });
});
