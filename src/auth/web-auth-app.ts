import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import type { WorkspaceDatabase } from "../persistence/database.js";
import { IdentityLinks } from "./identity-links.js";
import { SessionStore, equalToken } from "./session-store.js";
import type { LoginProvider } from "./oidc.js";
import { AuthorizationError, NotFoundError, ValidationError } from "../domain/errors.js";
import { verifiedRequestContext } from "../application/request-context.js";
import { WorkspaceService } from "../application/workspace-service.js";
import { CursorError } from "../application/read-pagination.js";
import { createJobSearchReadRouter } from "./job-search-read-router.js";
import { createJobSearchPageRouter, createWebAssetsRouter } from "../web/page-router.js";
import { loginFailureView } from "../web/views.js";

const SESSION_COOKIE = "__Host-paw_session";
const LOGIN_COOKIE = "__Host-paw_login";
const cookieOptions = { secure: true, httpOnly: true, sameSite: "lax" as const, path: "/" };
const objectRoute = /^\/workspace\/job-search\/(?:today|applications(?:\/[a-f0-9-]{36})?|tasks\/[a-f0-9-]{36})$/u;

export function safeReturnTo(value: unknown): string {
  if (value === undefined) return "/workspace/job-search/today";
  if (typeof value !== "string" || !objectRoute.test(value)) {
    throw new ValidationError("Invalid return path");
  }
  return value;
}

function cookie(request: Request, name: string): string {
  const values = (request.headers.cookie ?? "").split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return "";
  const value = values[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/u.test(value) ? value : "";
}

export function createWebAuthApp(options: {
  database: WorkspaceDatabase;
  provider: LoginProvider;
  origin: string;
  bootstrapEnabled?: boolean;
  now?: () => number;
  timeZone?: string;
}) {
  const origin = new URL(options.origin);
  if (origin.protocol !== "https:" || origin.origin !== options.origin) {
    throw new ValidationError("Web origin must be an exact HTTPS origin");
  }
  const now = options.now ?? Date.now;
  const links = new IdentityLinks(options.database, now);
  const sessions = new SessionStore(links, now);
  links.prunePending();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use((request, response, next) => {
    response.set({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    if (request.headers.host !== origin.host) {
      response.status(400).json({ error: "INVALID_HOST" });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "4kb" }));

  // Bounded aggregate limit: do not trust spoofable forwarding headers as an
  // identity/rate-limit key. Per-edge limits can be added during ingress setup.
  let windowStart = now();
  let attempts = 0;
  app.use("/auth", (request, response, next) => {
    if (now() - windowStart >= 60_000) { windowStart = now(); attempts = 0; }
    if (++attempts > 30) {
      if (request.get("accept")?.includes("text/html")) response.status(429).type("html").send(loginFailureView(429));
      else response.status(429).json({ error: "RETRY_LATER" });
      return;
    }
    links.prunePending();
    next();
  });

  app.get("/auth/start", async (request, response) => {
    const returnTo = safeReturnTo(request.query.returnTo);
    const login = sessions.beginLogin(returnTo, cookie(request, LOGIN_COOKIE));
    const url = await options.provider.authorizationUrl(login.transaction);
    response.cookie(LOGIN_COOKIE, login.token, { ...cookieOptions, maxAge: 600_000 });
    response.redirect(303, url.toString());
  });

  app.get("/auth/google/callback", async (request, response) => {
    const current = new URL(request.originalUrl, origin);
    const state = current.searchParams.getAll("state");
    if (state.length !== 1) throw new AuthorizationError("Invalid callback state");
    const transaction = sessions.consumeLogin(cookie(request, LOGIN_COOKIE), state[0]!);
    response.clearCookie(LOGIN_COOKIE, cookieOptions);
    let identity;
    try {
      identity = await options.provider.authenticate(current, transaction);
    } catch {
      if (request.get("accept")?.includes("text/html")) {
        response.status(401).type("html").send(loginFailureView(401, transaction.returnTo));
        return;
      }
      response.status(401).json({ error: "LOGIN_FAILED", restart: "/auth/start" });
      return;
    }
    try {
      links.resolve(identity);
    } catch (error) {
      if (!(error instanceof AuthorizationError)) throw error;
      // A different/unlinked account must not retain the previous app session.
      sessions.destroySession(cookie(request, SESSION_COOKIE));
      response.clearCookie(SESSION_COOKIE, cookieOptions);
      if (options.bootstrapEnabled) {
        const pendingId = links.recordPending(identity);
        if (request.get("accept")?.includes("text/html")) response.status(403).type("html").send(loginFailureView(403, transaction.returnTo, pendingId));
        else response.status(403).json({ error: "IDENTITY_LINK_REQUIRED", pendingId });
      } else {
        if (request.get("accept")?.includes("text/html")) response.status(403).type("html").send(loginFailureView(403, transaction.returnTo));
        else response.status(403).json({ error: "ACCESS_DENIED" });
      }
      return;
    }
    const token = sessions.createSession(identity, cookie(request, SESSION_COOKIE));
    response.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 7 * 86_400_000 });
    response.redirect(303, transaction.returnTo);
  });

  app.get("/api/v1/session", (request, response) => {
    const session = sessions.getSession(cookie(request, SESSION_COOKIE));
    const context = verifiedRequestContext(options.database, session, "WEB", randomUUID());
    response.json({ authenticated: true, workspaceId: context.workspaceId, csrfToken: session.csrfToken });
  });

  app.post("/auth/logout", (request, response) => {
    const token = cookie(request, SESSION_COOKIE);
    const session = sessions.getSession(token);
    const csrf = request.headers["x-csrf-token"];
    if (request.headers.origin !== origin.origin || typeof csrf !== "string" ||
      !equalToken(csrf, session.csrfToken)) {
      response.status(403).json({ error: "ACTION_DENIED" });
      return;
    }
    sessions.destroySession(token);
    response.clearCookie(SESSION_COOKIE, cookieOptions);
    response.status(204).end();
  });

  const serviceFor = (request: Request) => {
    const session = sessions.getSession(cookie(request, SESSION_COOKIE));
    const context = verifiedRequestContext(options.database, session, "WEB", randomUUID());
    return new WorkspaceService(options.database, context, {
      timeZone: options.timeZone, clock: () => new Date(now()),
    });
  };
  app.use("/api/v1/job-search", createJobSearchReadRouter(serviceFor, now));
  app.use(createWebAssetsRouter());
  app.use(createJobSearchPageRouter(serviceFor, options.timeZone, now));

  // No MCP adapter, admin/linking endpoint or browser business write is mounted.
  app.use((_request, response) => { response.status(404).json({ error: "NOT_FOUND" }); });
  app.use((error: unknown, request: Request, response: express.Response, _next: express.NextFunction) => {
    if (request.path.startsWith("/auth/") && request.get("accept")?.includes("text/html")) {
      const status = error instanceof AuthorizationError ? 401 : error instanceof ValidationError ? 400 : 503;
      response.status(status).type("html").send(loginFailureView(status));
      return;
    }
    if (error instanceof AuthorizationError) response.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
    else if (error instanceof NotFoundError) response.status(404).json({ error: "NOT_FOUND" });
    else if (error instanceof CursorError) response.status(409).json({ error: error.code, reloadRequired: true });
    else if (error instanceof ValidationError || error instanceof SyntaxError) response.status(400).json({ error: "INVALID_REQUEST" });
    else response.status(503).json({ error: "TEMPORARILY_UNAVAILABLE" });
  });
  return app;
}
