import { createHash, generateKeyPairSync, sign } from "node:crypto";
import * as oidc from "openid-client";
import { OidcLoginProvider } from "../../src/auth/oidc.js";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...pair.publicKey.export({ format: "jwk" }), kid: "synthetic-key", alg: "RS256", use: "sig" };
const wrongPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const syntheticIssuer = "https://identity.example.test";
export const webOrigin = "https://workspace.example.test";
const clientId = "synthetic-client";

export function syntheticOidc() {
  let authorization: URL | undefined;
  let claimsPatch: Record<string, unknown> = {};
  let badSignature = false;
  let used = false;
  let tokenCalls = 0;
  const config = new oidc.Configuration({
    issuer: syntheticIssuer,
    authorization_endpoint: `${syntheticIssuer}/authorize`,
    token_endpoint: `${syntheticIssuer}/token`,
    jwks_uri: `${syntheticIssuer}/jwks`,
    response_types_supported: ["code"],
    id_token_signing_alg_values_supported: ["RS256"],
  }, clientId, { client_secret: "synthetic-secret", id_token_signed_response_alg: "RS256" },
  oidc.ClientSecretPost("synthetic-secret"));
  config[oidc.customFetch] = async (url, options) => {
    if (String(url) === `${syntheticIssuer}/jwks`) return Response.json({ keys: [publicJwk] });
    if (String(url) !== `${syntheticIssuer}/token`) throw new Error("Unexpected provider request");
    tokenCalls++;
    const body = new URLSearchParams(options?.body as string);
    const challenge = createHash("sha256").update(body.get("code_verifier") ?? "").digest("base64url");
    if (used || !authorization || body.get("code") !== "synthetic-code" ||
      challenge !== authorization.searchParams.get("code_challenge") ||
      body.get("redirect_uri") !== `${webOrigin}/auth/google/callback` ||
      body.get("client_secret") !== "synthetic-secret") {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    used = true;
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: syntheticIssuer, sub: "synthetic-user", aud: clientId,
      iat: now, exp: now + 300, nonce: authorization.searchParams.get("nonce"),
      email: "synthetic-user@example.test", email_verified: true, ...claimsPatch };
    const encoded = [Buffer.from(JSON.stringify({ alg: "RS256", kid: "synthetic-key" })).toString("base64url"),
      Buffer.from(JSON.stringify(claims)).toString("base64url")].join(".");
    const signature = sign("RSA-SHA256", Buffer.from(encoded), badSignature ? wrongPair.privateKey : pair.privateKey)
      .toString("base64url");
    return Response.json({ token_type: "Bearer", access_token: "synthetic-unused-access-token",
      id_token: `${encoded}.${signature}`, expires_in: 300 });
  };
  return {
    provider: new OidcLoginProvider(config, `${webOrigin}/auth/google/callback`),
    get tokenCalls() { return tokenCalls; },
    authorize(url: URL, patch: Record<string, unknown> = {}, forged = false): URL {
      authorization = url;
      claimsPatch = patch;
      badSignature = forged;
      used = false;
      const callback = new URL(`${webOrigin}/auth/google/callback`);
      callback.searchParams.set("code", "synthetic-code");
      callback.searchParams.set("state", url.searchParams.get("state")!);
      return callback;
    },
  };
}
