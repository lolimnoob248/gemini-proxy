export const GEMINI_CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
export const GEMINI_CLIENT_SECRET = "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";

export const GEMINI_SCOPES: readonly string[] = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";

export const CODE_ASSIST_BASE = "https://cloudcode-pa.googleapis.com";
export const CODE_ASSIST_ENDPOINT = `${CODE_ASSIST_BASE}/v1internal`;

export const CODE_ASSIST_HEADERS = {
  "X-Goog-Api-Client": "gl-node/22.17.0",
  "Client-Metadata": "ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI",
} as const;

export const GEMINI_CLI_VERSION = "0.30.0-nightly.20260210.a2174751d";

export const SUPPORTED_MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
] as const;

export const FREE_TIER_ID = "free-tier";
export const LEGACY_TIER_ID = "legacy-tier";

export const TOKEN_EXPIRY_BUFFER_MS = 60_000;
export const ONBOARD_POLL_ATTEMPTS = 10;
export const ONBOARD_POLL_DELAY_MS = 5000;
export const DEFAULT_PORT = 3000;
export const TOKEN_STORE_PATH_DEFAULT = "./tokens.json";

export function getServerPort(): number {
  return parseInt(process.env["PROXY_PORT"] ?? String(DEFAULT_PORT), 10);
}

export function getCallbackUrl(): string {
  return `http://localhost:${getServerPort()}/auth/callback`;
}
