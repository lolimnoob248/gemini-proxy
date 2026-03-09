import { GEMINI_CLIENT_ID, GEMINI_CLIENT_SECRET, GOOGLE_TOKEN_URL } from "../constants";
import type { TokenRefreshResult } from "../types";

const refreshInFlight = new Map<string, Promise<TokenRefreshResult>>();

export async function refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
  const inflight = refreshInFlight.get(refreshToken);
  if (inflight) return inflight;

  const promise = doRefresh(refreshToken);
  refreshInFlight.set(refreshToken, promise);
  try {
    return await promise;
  } finally {
    refreshInFlight.delete(refreshToken);
  }
}

async function doRefresh(refreshToken: string): Promise<TokenRefreshResult> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: GEMINI_CLIENT_ID,
        client_secret: GEMINI_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Token refresh failed (${response.status}): ${text}` };
    }

    const payload = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    return {
      ok: true,
      accessToken: payload.access_token,
      // Google may rotate the refresh token; fall back to the original if not
      refreshToken: payload.refresh_token ?? refreshToken,
      expiresAt: Date.now() + payload.expires_in * 1000,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
