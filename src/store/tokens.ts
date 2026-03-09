import { readFileSync, writeFileSync } from "node:fs";
import { TOKEN_STORE_PATH_DEFAULT, TOKEN_EXPIRY_BUFFER_MS } from "../constants";
import type { TokenStore } from "../types";
import { refreshAccessToken } from "../oauth/refresh";

function getStorePath(): string {
  return process.env["TOKEN_STORE_PATH"] ?? TOKEN_STORE_PATH_DEFAULT;
}

export function readTokenStore(): TokenStore | null {
  try {
    const raw = readFileSync(getStorePath(), "utf8");
    return JSON.parse(raw) as TokenStore;
  } catch {
    return null;
  }
}

export function writeTokenStore(store: TokenStore): void {
  writeFileSync(getStorePath(), JSON.stringify(store, null, 2), "utf8");
}

export function clearTokenStore(): void {
  try {
    writeFileSync(getStorePath(), "", "utf8");
  } catch {
    // file may not exist
  }
}

export function isTokenExpired(store: TokenStore): boolean {
  return store.expiresAt <= Date.now() + TOKEN_EXPIRY_BUFFER_MS;
}

export async function getValidAccessToken(): Promise<string | null> {
  const store = readTokenStore();
  if (!store) return null;

  if (!isTokenExpired(store)) {
    return store.accessToken;
  }

  const result = await refreshAccessToken(store.refreshToken);
  if (!result.ok) {
    console.error("Token refresh failed:", result.error);
    return null;
  }

  const updated: TokenStore = {
    ...store,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
  };
  writeTokenStore(updated);
  return updated.accessToken;
}
