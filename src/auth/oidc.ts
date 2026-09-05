import * as oidc from "openid-client";
import type { VerifiedWebIdentity } from "./identity-links.js";
import { AuthorizationError } from "../domain/errors.js";

export const GOOGLE_ISSUER = "https://accounts.google.com";

export interface LoginChecks {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface LoginProvider {
  authorizationUrl(checks: LoginChecks): Promise<URL>;
  authenticate(callbackUrl: URL, checks: LoginChecks): Promise<VerifiedWebIdentity>;
}

// Configuration injection enables signed synthetic-provider protocol tests. The
// production factory below pins the Google issuer and performs real discovery.
export class OidcLoginProvider implements LoginProvider {
  constructor(private readonly config: oidc.Configuration, private readonly callback: string) {
    oidc.enableNonRepudiationChecks(config);
    config.timeout = 10;
  }

  async authorizationUrl(checks: LoginChecks): Promise<URL> {
    return oidc.buildAuthorizationUrl(this.config, {
      response_type: "code",
      scope: "openid email",
      redirect_uri: this.callback,
      state: checks.state,
      nonce: checks.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(checks.codeVerifier),
      code_challenge_method: "S256",
    });
  }

  async authenticate(callbackUrl: URL, checks: LoginChecks): Promise<VerifiedWebIdentity> {
    const callback = new URL(this.callback);
    if (callbackUrl.origin !== callback.origin || callbackUrl.pathname !== callback.pathname) {
      throw new AuthorizationError("Invalid login callback");
    }
    const tokens = await oidc.authorizationCodeGrant(this.config, callbackUrl, {
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      pkceCodeVerifier: checks.codeVerifier,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || typeof claims.sub !== "string" || !claims.sub ||
      typeof claims.email !== "string" || !claims.email || claims.email_verified !== true) {
      throw new AuthorizationError("Verified login identity is required");
    }
    // Tokens are deliberately not returned or persisted.
    return Object.freeze({ issuer: claims.iss, subject: claims.sub, email: claims.email });
  }
}

export async function googleLoginProvider(clientId: string, clientSecret: string,
  origin: string): Promise<LoginProvider> {
  const config = await oidc.discovery(new URL(GOOGLE_ISSUER), clientId,
    { client_secret: clientSecret, id_token_signed_response_alg: "RS256" },
    oidc.ClientSecretPost(clientSecret), { timeout: 10 });
  return new OidcLoginProvider(config, `${origin}/auth/google/callback`);
}
