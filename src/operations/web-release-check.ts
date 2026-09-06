import { ValidationError } from "../domain/errors.js";

export type WebWriteExpectation = "off" | "on";

export interface WebReleaseCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface WebReleaseReport {
  origin: string;
  expectedWrites: WebWriteExpectation;
  passed: boolean;
  checks: WebReleaseCheckResult[];
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

class CheckFailure extends Error {}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CheckFailure(message);
}

function exactHttpsOrigin(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new ValidationError("Release origin must be an exact HTTPS origin"); }
  if (parsed.protocol !== "https:" || parsed.origin !== value) {
    throw new ValidationError("Release origin must be an exact HTTPS origin");
  }
  return parsed.origin;
}

function setCookies(headers: Headers): string[] {
  const values = headers.getSetCookie();
  if (values.length > 0) return values;
  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

export async function checkWebRelease(options: {
  origin: string;
  expectedWrites: WebWriteExpectation;
  fetcher?: FetchLike;
  timeoutMs?: number;
  expectedAuthorizationOrigin?: string;
}): Promise<WebReleaseReport> {
  const origin = exactHttpsOrigin(options.origin);
  const authorizationOrigin = exactHttpsOrigin(
    options.expectedAuthorizationOrigin ?? "https://accounts.google.com",
  );
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    throw new ValidationError("Release check timeout must be 100-60000ms");
  }
  const request = (path: string, init: RequestInit = {}) => fetcher(new URL(path, `${origin}/`), {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const checks: WebReleaseCheckResult[] = [];
  const check = async (name: string, run: () => Promise<string>) => {
    try { checks.push({ name, passed: true, detail: await run() }); }
    catch (error) {
      checks.push({ name, passed: false,
        detail: error instanceof CheckFailure ? error.message : "Request failed or timed out" });
    }
  };

  await check("signed_out_boundary", async () => {
    const response = await request("/workspace/job-search/today", {
      headers: { accept: "text/html" },
    });
    requireCondition(response.status === 401, "Today must return 401 without a session");
    const requiredHeaders: Record<string, string[]> = {
      "cache-control": ["no-store"],
      "content-security-policy": ["default-src 'none'", "frame-ancestors 'none'", "form-action 'self'"],
      "referrer-policy": ["no-referrer"],
      "x-content-type-options": ["nosniff"],
      "x-frame-options": ["deny"],
    };
    for (const [name, fragments] of Object.entries(requiredHeaders)) {
      const value = response.headers.get(name)?.toLowerCase() ?? "";
      requireCondition(fragments.every((fragment) => value.includes(fragment)),
        `Today is missing the required ${name} policy`);
    }
    return "Signed-out Today returned 401 with the required browser policies";
  });

  await check("public_route_isolation", async () => {
    for (const path of ["/mcp", "/healthz", "/admin"]) {
      const response = await request(path);
      requireCondition(response.status === 404, `${path} must return 404 on the Web origin`);
    }
    return "MCP, health and administration routes returned 404";
  });

  await check("write_mode_boundary", async () => {
    const response = await request(
      "/api/v1/job-search/tasks/00000000-0000-4000-8000-000000000000/complete",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ expectedRecordVersion: 1,
          intentKey: "00000000-0000-4000-8000-000000000001" }),
      },
    );
    const expectedStatus = options.expectedWrites === "off" ? 404 : 401;
    requireCondition(response.status === expectedStatus,
      `Completion must return ${expectedStatus} without a session when writes are ${options.expectedWrites}`);
    return options.expectedWrites === "off"
      ? "Completion route was absent in read mode"
      : "Completion route required authentication in write mode";
  });

  await check("oauth_start_contract", async () => {
    const response = await request("/auth/start?returnTo=%2Fworkspace%2Fjob-search%2Ftoday", {
      headers: { accept: "text/html" },
    });
    requireCondition(response.status === 303, "OAuth start must return 303");
    const location = response.headers.get("location");
    requireCondition(location, "OAuth start must return a Location header");
    const authorization = new URL(location);
    requireCondition(authorization.origin === authorizationOrigin,
      "OAuth start must redirect to the configured issuer");
    requireCondition(authorization.searchParams.get("response_type") === "code",
      "OAuth response_type must be code");
    requireCondition(Boolean(authorization.searchParams.get("client_id")),
      "OAuth start must include a client ID");
    requireCondition(authorization.searchParams.get("redirect_uri") === `${origin}/auth/google/callback`,
      "OAuth callback must use the exact Web origin");
    requireCondition(authorization.searchParams.get("code_challenge_method") === "S256" &&
      Boolean(authorization.searchParams.get("code_challenge")), "OAuth start must use PKCE S256");
    requireCondition(Boolean(authorization.searchParams.get("state")) &&
      Boolean(authorization.searchParams.get("nonce")), "OAuth start must include state and nonce");
    const scope = new Set((authorization.searchParams.get("scope") ?? "").split(" "));
    requireCondition(scope.has("openid") && scope.has("email"),
      "OAuth scope must include openid and email");
    const loginCookies = setCookies(response.headers)
      .filter((cookie) => cookie.startsWith("__Host-paw_login="));
    requireCondition(loginCookies.length === 1, "OAuth start must set one login cookie");
    const parts = loginCookies[0]!.split(";").map((part) => part.trim());
    requireCondition(/^__Host-paw_login=[A-Za-z0-9_-]{43}$/u.test(parts[0] ?? ""),
      "Login cookie must contain one bounded opaque token");
    const attributes = new Set(parts.slice(1).map((part) => part.toLowerCase()));
    for (const policy of ["secure", "httponly", "samesite=lax", "path=/", "max-age=600"]) {
      requireCondition(attributes.has(policy), `Login cookie must include exact ${policy}`);
    }
    requireCondition(![...attributes].some((attribute) => attribute.startsWith("domain=")),
      "Login cookie must not set Domain");
    return "Google authorization redirect, PKCE, state, nonce and login cookie policies passed";
  });

  await check("unsafe_return_rejected", async () => {
    const response = await request("/auth/start?returnTo=https%3A%2F%2Fevil.example", {
      headers: { accept: "text/html" },
    });
    requireCondition(response.status === 400, "Absolute OAuth return paths must return 400");
    requireCondition(!response.headers.has("location"), "Rejected return paths must not redirect");
    requireCondition(setCookies(response.headers).length === 0,
      "Rejected return paths must not set a login cookie");
    return "Absolute return path was rejected without redirect or cookie";
  });

  return { origin, expectedWrites: options.expectedWrites,
    passed: checks.every((result) => result.passed), checks };
}
