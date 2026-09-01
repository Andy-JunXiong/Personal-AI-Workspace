import { WorkspaceService } from "../src/application/workspace-service.js";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/persistence/database.js";
import { spikeFixture } from "../src/spike-fixture.js";

const config = loadConfig();
const database = openDatabase(config.databasePath, config.migrationsDirectory);

try {
  const workspaceService = new WorkspaceService(
    database,
    config.developmentPrincipal,
  );
  workspaceService.ensureDevelopmentIdentity();
  const details = workspaceService.seedJobApplication(spikeFixture);
  console.log(
    JSON.stringify(
      {
        seeded: true,
        projectId: details.project.id,
        lifecycleState: details.project.lifecycleState,
        lifecycleVersion: details.project.lifecycleVersion,
      },
      null,
      2,
    ),
  );
} finally {
  database.close();
}
