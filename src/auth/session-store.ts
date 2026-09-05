import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AuthorizationError, ValidationError } from "../domain/errors.js";
import { IdentityLinks, type VerifiedWebIdentity } from "./identity-links.js";
import type { IdentityContext } from "../domain/types.js";
import type { LoginChecks } from "./oidc.js";

export const randomToken = (): string => randomBytes(32).toString("base64url");
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
export function equalToken(actual: string, expected: string): boolean {
  return timingSafeEqual(Buffer.from(hash(actual)), Buffer.from(hash(expected)));
}

interface Session {
  identity: Pick<VerifiedWebIdentity, "issuer" | "subject">;
  principalId: string;
  workspaceId: string;
  csrfToken: string;
  createdAt: number;
  lastUsedAt: number;
}

interface LoginTransaction extends LoginChecks {
  returnTo: string;
  expiresAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly logins = new Map<string, LoginTransaction>();
  constructor(private readonly links: IdentityLinks, private readonly now = Date.now) {}

  beginLogin(returnTo: string, previousToken?: string): { token: string; transaction: LoginTransaction } {
    this.prune();
    if (previousToken) this.logins.delete(hash(previousToken));
    if (this.logins.size >= 100) throw new ValidationError("Login capacity reached");
    const token = randomToken();
    const transaction = {
      state: randomToken(), nonce: randomToken(), codeVerifier: randomToken(),
      returnTo, expiresAt: this.now() + 600_000,
    };
    this.logins.set(hash(token), transaction);
    return { token, transaction: { ...transaction } };
  }

  consumeLogin(token: string, state: string): LoginTransaction {
    this.prune();
    const key = hash(token);
    const transaction = this.logins.get(key);
    if (!transaction || !equalToken(state, transaction.state)) {
      throw new AuthorizationError("Login transaction is invalid or expired");
    }
    // Consume before asynchronous token exchange to prevent simultaneous replay.
    this.logins.delete(key);
    return { ...transaction };
  }

  createSession(identity: VerifiedWebIdentity, previousToken?: string): string {
    this.prune();
    const owner = this.links.resolve(identity);
    if (previousToken) this.destroySession(previousToken);
    if (this.sessions.size >= 100) throw new ValidationError("Session capacity reached");
    const token = randomToken();
    this.sessions.set(hash(token), {
      identity: { issuer: identity.issuer, subject: identity.subject },
      ...owner, csrfToken: randomToken(), createdAt: this.now(), lastUsedAt: this.now(),
    });
    return token;
  }

  getSession(token: string): IdentityContext & { csrfToken: string } {
    this.prune();
    const key = hash(token);
    const session = this.sessions.get(key);
    if (!session) throw new AuthorizationError("Session is invalid or expired");
    try {
      const owner = this.links.resolve(session.identity);
      if (owner.principalId !== session.principalId || owner.workspaceId !== session.workspaceId) {
        throw new AuthorizationError("Session ownership changed");
      }
      session.lastUsedAt = this.now();
      return Object.freeze({ ...owner, csrfToken: session.csrfToken });
    } catch (error) {
      this.sessions.delete(key);
      throw error;
    }
  }

  destroySession(token: string): void { this.sessions.delete(hash(token)); }

  private prune(): void {
    const now = this.now();
    for (const [key, session] of this.sessions) {
      if (now - session.createdAt >= 7 * 86_400_000 || now - session.lastUsedAt >= 12 * 3_600_000) {
        this.sessions.delete(key);
      }
    }
    for (const [key, transaction] of this.logins) {
      if (transaction.expiresAt <= now) this.logins.delete(key);
    }
  }
}
