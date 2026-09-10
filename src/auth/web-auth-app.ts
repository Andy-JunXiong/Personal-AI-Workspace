import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceDatabase } from "../persistence/database.js";
import { IdentityLinks } from "./identity-links.js";
import { SessionStore, equalToken } from "./session-store.js";
import type { LoginProvider } from "./oidc.js";
import {
  ActionDeniedError,
  AuthorizationError,
  ConcurrencyConflictError,
  IdempotencyConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import { verifiedRequestContext } from "../application/request-context.js";
import { WorkspaceService } from "../application/workspace-service.js";
import { CursorError } from "../application/read-pagination.js";
import { createJobSearchReadRouter } from "./job-search-read-router.js";
import { createJobSearchWriteRouter, createPlatformWatchWriteRouter } from "./job-search-write-router.js";
import { createJobSearchPageRouter, createWebAssetsRouter } from "../web/page-router.js";
import { loginFailureView } from "../web/views.js";
import type { GmailRuntime } from "../gmail/checks.js";
import { createGmailRouter } from "../gmail/router.js";
import { createResumeRouter } from "./resume-router.js";
import { createJobLibraryRouter } from "./job-library-router.js";
import type { JobFitAnalyzer } from "../application/job-fit-analyzer.js";
import { GmailMcpReader } from "../gmail/mcp-reader.js";

const SESSION_COOKIE = "__Host-paw_session";
const LOGIN_COOKIE = "__Host-paw_login";
const cookieOptions = { secure: true, httpOnly: true, sameSite: "lax" as const, path: "/" };
const objectRoute = /^\/workspace\/job-search\/(?:today|library|resume|platform-watch(?:\/[a-f0-9-]{36})?|applications(?:\/[a-f0-9-]{36})?|tasks\/[a-f0-9-]{36}|jobs(?:\/[a-f0-9-]{36})?)$/u;

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
  writesEnabled?: boolean;
  now?: () => number;
  timeZone?: string;
  gmail?: GmailRuntime;
  jobFitAnalyzer?: JobFitAnalyzer;
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
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" + (request.path==="/workspace/job-search/resume"?"; frame-src blob:":""),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    if (request.headers.host !== origin.host) {
      response.status(400).json({ error: "INVALID_HOST" });
      return;
    }
    next();
  });
  app.use("/api/v1/job-search/library", express.json({ limit: "256kb" }));
  app.use("/api/v1/job-search/resume", express.json({ limit: "256kb" }));
  app.use("/api/v1/job-search/platform-watch", express.json({ limit: "256kb" }));
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
  const gmailIdentityFor = (request: Request, write = false) => {
    const session = sessions.getSession(cookie(request, SESSION_COOKIE));
    verifiedRequestContext(options.database, session, "WEB", randomUUID());
    const csrf = request.headers["x-csrf-token"];
    if (write && (request.headers.origin !== origin.origin || typeof csrf !== "string" || !equalToken(csrf, session.csrfToken))) {
      throw new ActionDeniedError("Browser action authority was not verified");
    }
    return session;
  };
  if (options.gmail) app.use(createGmailRouter(options.gmail, options.origin, gmailIdentityFor, serviceFor, now));
  app.use("/api/v1/job-search", createResumeRouter(serviceFor, request => gmailIdentityFor(request, true)));
  app.use("/api/v1/job-search", createJobLibraryRouter(serviceFor,
    (request) => gmailIdentityFor(request, true), options.jobFitAnalyzer,
    options.gmail ? new GmailMcpReader(options.gmail.connections,options.gmail.authorization) : undefined));
  app.use("/api/v1/job-search", createPlatformWatchWriteRouter((request) => {
    gmailIdentityFor(request, true);
    return serviceFor(request);
  }, now));
  if (options.writesEnabled) {
    const writeServiceFor = (request: Request) => {
      const session = sessions.getSession(cookie(request, SESSION_COOKIE));
      const csrf = request.headers["x-csrf-token"];
      if (request.headers.origin !== origin.origin || typeof csrf !== "string" ||
        !equalToken(csrf, session.csrfToken)) {
        throw new ActionDeniedError("Browser action authority was not verified");
      }
      const context = verifiedRequestContext(options.database, session, "WEB", randomUUID());
      return new WorkspaceService(options.database, context, {
        timeZone: options.timeZone, clock: () => new Date(now()),
      });
    };
    app.use("/api/v1/job-search", createJobSearchWriteRouter(writeServiceFor, now));
  }
  app.use(createWebAssetsRouter());
  app.use(createJobSearchPageRouter(serviceFor, options.timeZone, now, options.writesEnabled,
    options.gmail ? (request) => [1, 2].map(slot => ({ slot,
      email: options.gmail!.connections.get(gmailIdentityFor(request), slot)?.email ?? null })) : undefined, Boolean(options.jobFitAnalyzer)));

  // No MCP adapter or administration endpoint is mounted on the web listener.
  app.use((_request, response) => { response.status(404).json({ error: "NOT_FOUND" }); });
  app.use((error: unknown, request: Request, response: express.Response, _next: express.NextFunction) => {
    if (request.path.startsWith("/auth/") && request.get("accept")?.includes("text/html")) {
      const status = error instanceof AuthorizationError ? 401 : error instanceof ValidationError ? 400 : 503;
      response.status(status).type("html").send(loginFailureView(status));
      return;
    }
    const write = request.method === "POST" && request.path.startsWith("/api/v1/job-search/");
    if (error instanceof AuthorizationError) response.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
    else if (error instanceof ActionDeniedError) response.status(403).json({ error: "ACTION_DENIED" });
    else if (error instanceof NotFoundError) response.status(404).json({ error: "NOT_FOUND" });
    else if (error instanceof ConcurrencyConflictError || error instanceof IdempotencyConflictError) {
      response.status(409).json({ error: error.code, reloadRequired: error instanceof ConcurrencyConflictError });
    }
    else if (error instanceof CursorError) response.status(409).json({ error: error.code, reloadRequired: true });
    else if (error instanceof ValidationError || error instanceof SyntaxError || error instanceof z.ZodError) {
      response.status(write ? 422 : 400).json({ error: "INVALID_REQUEST" });
    }
    else response.status(503).json({ error: "TEMPORARILY_UNAVAILABLE" });
  });
  return app;
}
