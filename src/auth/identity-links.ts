import { randomUUID } from "node:crypto";
import type { WorkspaceDatabase } from "../persistence/database.js";
import type { IdentityContext } from "../domain/types.js";
import { AuthorizationError, ValidationError } from "../domain/errors.js";

export interface VerifiedWebIdentity {
  readonly issuer: string;
  readonly subject: string;
  readonly email: string;
}

export interface PendingIdentity {
  id: string;
  issuer: string;
  subject: string;
  verified_email: string;
  expires_at: string;
}

export class IdentityLinks {
  constructor(
    private readonly database: WorkspaceDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  resolve(identity: Pick<VerifiedWebIdentity, "issuer" | "subject">): IdentityContext {
    const row = this.database.prepare(
      `SELECT l.principal_id AS principalId, w.id AS workspaceId
       FROM principal_identity_links l
       JOIN workspaces w ON w.owner_principal_id = l.principal_id
       WHERE l.issuer = ? AND l.subject = ? AND l.revoked_at IS NULL`,
    ).get(identity.issuer, identity.subject) as IdentityContext | undefined;
    if (!row) throw new AuthorizationError("Web identity is not linked");
    return Object.freeze(row);
  }

  recordPending(identity: VerifiedWebIdentity): string {
    return this.database.transaction(() => {
      this.prunePending();
      const count = this.database.prepare("SELECT COUNT(*) AS n FROM pending_web_identities")
        .get() as { n: number };
      if (count.n >= 100) throw new ValidationError("Pending identity capacity reached");
      const id = randomUUID();
      this.database.prepare(
        `INSERT INTO pending_web_identities
         (id, issuer, subject, verified_email, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, identity.issuer, identity.subject, identity.email,
        new Date(this.now()).toISOString(), new Date(this.now() + 600_000).toISOString());
      return id;
    })();
  }

  prunePending(): void {
    this.database.prepare("DELETE FROM pending_web_identities WHERE expires_at <= ?")
      .run(new Date(this.now()).toISOString());
  }

  inspectPending(id: string): PendingIdentity {
    const row = this.database.prepare(
      "SELECT * FROM pending_web_identities WHERE id = ? AND expires_at > ?",
    ).get(id, new Date(this.now()).toISOString()) as PendingIdentity | undefined;
    if (!row) throw new AuthorizationError("Pending identity is missing or expired");
    return row;
  }

  linkPending(pendingId: string, target: IdentityContext, actorPrincipalId: string): void {
    this.database.transaction(() => {
      this.assertOperator(target, actorPrincipalId);
      const pending = this.inspectPending(pendingId);
      // No reassignment or reactivation of an old link: use a separately reviewed
      // recovery procedure. This also prevents old sessions reviving on relink.
      if (this.database.prepare(
        "SELECT 1 FROM principal_identity_links WHERE issuer = ? AND subject = ?",
      ).get(pending.issuer, pending.subject)) {
        throw new ValidationError("Identity already has an association");
      }
      const timestamp = new Date(this.now()).toISOString();
      this.database.prepare(
        `INSERT INTO principal_identity_links
         (issuer, subject, principal_id, created_at, linked_by_principal_id)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(pending.issuer, pending.subject, target.principalId, timestamp, actorPrincipalId);
      this.audit(pending, target.principalId, actorPrincipalId, "LINK", timestamp);
      this.database.prepare("DELETE FROM pending_web_identities WHERE id = ?").run(pendingId);
    })();
  }

  revoke(identity: Pick<VerifiedWebIdentity, "issuer" | "subject">,
    target: IdentityContext, actorPrincipalId: string): void {
    this.database.transaction(() => {
      this.assertOperator(target, actorPrincipalId);
      const timestamp = new Date(this.now()).toISOString();
      const result = this.database.prepare(
        `UPDATE principal_identity_links SET revoked_at = ?
         WHERE issuer = ? AND subject = ? AND principal_id = ? AND revoked_at IS NULL`,
      ).run(timestamp, identity.issuer, identity.subject, target.principalId);
      if (result.changes !== 1) throw new AuthorizationError("Active association not found");
      this.audit(identity, target.principalId, actorPrincipalId, "REVOKE", timestamp);
    })();
  }

  private assertOperator(target: IdentityContext, actor: string): void {
    if (actor !== target.principalId || !this.database.prepare(
      "SELECT 1 FROM workspaces WHERE id = ? AND owner_principal_id = ?",
    ).get(target.workspaceId, target.principalId)) {
      throw new AuthorizationError("Operator target must be the existing Workspace owner");
    }
  }

  private audit(identity: Pick<VerifiedWebIdentity, "issuer" | "subject">,
    principal: string, actor: string, action: "LINK" | "REVOKE", at: string): void {
    this.database.prepare(
      `INSERT INTO identity_link_events
       (id, issuer, subject, principal_id, actor_principal_id, action, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), identity.issuer, identity.subject, principal, actor, action, at);
  }
}
