import { describe, expect, it } from "vitest";
import { checkWebRelease, type WebWriteExpectation } from "../../src/operations/web-release-check.js";

const origin = "https://workspace.example.test";

function syntheticRelease(options: {
  writes: WebWriteExpectation;
  exposedHealth?: boolean;
  missingCsp?: boolean;
}) {
  return async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input.toString());
    expect(init.redirect).toBe("manual");
    if (url.pathname === "/workspace/job-search/today") {
      const headers = new Headers({
        "cache-control": "private, no-store",
        "content-security-policy": options.missingCsp ? "default-src 'self'" :
          "default-src 'none'; frame-ancestors 'none'; form-action 'self'",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      });
      return new Response("signed out", { status: 401, headers });
    }
    if (url.pathname === "/healthz" && options.exposedHealth) {
      return Response.json({ status: "ok" });
    }
    if (["/mcp", "/healthz", "/admin"].includes(url.pathname)) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (url.pathname.endsWith("/complete") && init.method === "POST") {
      return Response.json({ error: options.writes === "off" ? "NOT_FOUND" : "AUTHENTICATION_REQUIRED" },
        { status: options.writes === "off" ? 404 : 401 });
    }
    if (url.pathname === "/auth/start" && url.searchParams.get("returnTo")?.startsWith("https://")) {
      return new Response("invalid return", { status: 400 });
    }
    if (url.pathname === "/auth/start") {
      const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authorization.search = new URLSearchParams({ response_type: "code", scope: "openid email",
        redirect_uri: `${origin}/auth/google/callback`, state: "PRIVATE_STATE", nonce: "PRIVATE_NONCE",
        code_challenge: "PRIVATE_CHALLENGE", code_challenge_method: "S256", client_id: "synthetic-client" }).toString();
      return new Response(null, { status: 303, headers: {
        location: authorization.toString(),
        "set-cookie": `__Host-paw_login=${"A".repeat(43)}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
      } });
    }
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  };
}

describe("Web HTTPS release checker", () => {
  it("passes the complete signed-out contract in read and write modes", async () => {
    for (const writes of ["off", "on"] as const) {
      const report = await checkWebRelease({ origin, expectedWrites: writes,
        fetcher: syntheticRelease({ writes }) });
      expect(report).toMatchObject({ origin, expectedWrites: writes, passed: true });
      expect(report.checks).toHaveLength(5);
      expect(report.checks.every((check) => check.passed)).toBe(true);
      expect(JSON.stringify(report)).not.toMatch(/PRIVATE_|paw_login|client-id/u);
    }
  });

  it("reports policy and route isolation failures without exposing response contents", async () => {
    const report = await checkWebRelease({ origin, expectedWrites: "off",
      fetcher: syntheticRelease({ writes: "off", exposedHealth: true, missingCsp: true }) });
    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "signed_out_boundary", passed: false,
        detail: "Today is missing the required content-security-policy policy" }),
      expect.objectContaining({ name: "public_route_isolation", passed: false,
        detail: "/healthz must return 404 on the Web origin" }),
    ]));
    expect(JSON.stringify(report)).not.toContain("signed out");
  });

  it("rejects unsafe configuration before making a network request", async () => {
    let requests = 0;
    const fetcher = async () => { requests++; return new Response(); };
    for (const value of ["http://workspace.example.test", "https://workspace.example.test/path",
      "https://user@workspace.example.test", "not-an-origin"]) {
      await expect(checkWebRelease({ origin: value, expectedWrites: "off", fetcher }))
        .rejects.toThrow(/exact HTTPS origin/u);
    }
    await expect(checkWebRelease({ origin, expectedWrites: "off", fetcher, timeoutMs: 1 }))
      .rejects.toThrow(/100-60000ms/u);
    expect(requests).toBe(0);
  });
});
