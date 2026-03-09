import {
  GEMINI_CLIENT_ID,
  GEMINI_CLIENT_SECRET,
  GEMINI_SCOPES,
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  getCallbackUrl,
} from "../constants";
import type { TokenExchangeResult } from "../types";
import { generatePkce, generateState } from "./pkce";

const pendingVerifiers = new Map<string, string>();

export interface AuthorizationParams {
  url: string;
  state: string;
}

export async function buildAuthorizationUrl(): Promise<AuthorizationParams> {
  const { challenge, verifier } = await generatePkce();
  const state = generateState();

  pendingVerifiers.set(state, verifier);

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", GEMINI_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getCallbackUrl());
  url.searchParams.set("scope", GEMINI_SCOPES.join(" "));
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.hash = "gemini-proxy";

  return { url: url.toString(), state };
}

export async function exchangeCode(code: string, state: string): Promise<TokenExchangeResult> {
  const verifier = pendingVerifiers.get(state);
  if (!verifier) {
    return { ok: false, error: "Unknown or expired OAuth state parameter" };
  }
  pendingVerifiers.delete(state);

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GEMINI_CLIENT_ID,
        client_secret: GEMINI_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: getCallbackUrl(),
        code_verifier: verifier,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Token exchange failed (${response.status}): ${text}` };
    }

    const payload = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    if (!payload.refresh_token) {
      return { ok: false, error: "No refresh token in response — ensure prompt=consent was set" };
    }

    const email = await fetchUserEmail(payload.access_token);

    return {
      ok: true,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
      email,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const info = (await response.json()) as { email?: string };
    return info.email;
  } catch {
    return undefined;
  }
}
