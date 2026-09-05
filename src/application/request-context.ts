import type { IdentityContext } from "../domain/types.js";
import { AuthorizationError } from "../domain/errors.js";
import type { WorkspaceDatabase } from "../persistence/database.js";

export interface RequestContext extends Readonly<IdentityContext> {
  readonly channel: "WEB" | "MCP";
  readonly requestId: string;
}

export function verifiedRequestContext(
  database: WorkspaceDatabase,
  identity: IdentityContext,
  channel: RequestContext["channel"],
  requestId: string,
): RequestContext {
  if (!requestId || !database.prepare(
    "SELECT 1 FROM workspaces WHERE id = ? AND owner_principal_id = ?",
  ).get(identity.workspaceId, identity.principalId)) {
    throw new AuthorizationError("Identity is not mapped to this Workspace");
  }
  return Object.freeze({
    principalId: identity.principalId,
    workspaceId: identity.workspaceId,
    channel,
    requestId,
  });
}
