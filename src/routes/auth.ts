import { Hono } from "hono";
import { buildAuthorizationUrl, exchangeCode } from "../oauth/exchange";
import { resolveProject } from "../oauth/project";
import { readTokenStore, writeTokenStore } from "../store/tokens";
import type { TokenStore } from "../types";

export const authRoutes = new Hono();

const SUCCESS_HTML = `<!DOCTYPE html><html><head><title>Gemini Proxy</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f4f8}
.card{background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)}
h1{color:#1a73e8;margin:0 0 12px}p{color:#555;margin:0}</style></head>
<body><div class="card"><h1>Authentication successful</h1>
<p>You can close this window. Gemini Proxy is ready.</p></div></body></html>`;

const ERROR_HTML = (msg: string) =>
  `<!DOCTYPE html><html><body><h1>Authentication failed</h1><p>${msg}</p></body></html>`;

authRoutes.get("/auth/login", async (c) => {
  const { url } = await buildAuthorizationUrl();
  return c.redirect(url);
});

authRoutes.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.html(ERROR_HTML(`Google returned error: ${error}`), 400);
  }
  if (!code || !state) {
    return c.html(ERROR_HTML("Missing code or state parameter"), 400);
  }

  const tokenResult = await exchangeCode(code, state);
  if (!tokenResult.ok) {
    return c.html(ERROR_HTML(tokenResult.error), 500);
  }

  const projectResult = await resolveProject(tokenResult.accessToken);
  if (!projectResult.ok) {
    return c.html(ERROR_HTML(`Project resolution failed: ${projectResult.error}`), 500);
  }

  const store: TokenStore = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    expiresAt: tokenResult.expiresAt,
    projectId: projectResult.projectId,
    managedProjectId: projectResult.projectId,
    email: tokenResult.email,
  };
  writeTokenStore(store);

  return c.html(SUCCESS_HTML);
});

authRoutes.get("/auth/status", (c) => {
  const store = readTokenStore();
  if (!store) {
    return c.json({ authenticated: false });
  }
  return c.json({
    authenticated: true,
    email: store.email,
    projectId: store.managedProjectId ?? store.projectId,
    expiresAt: new Date(store.expiresAt).toISOString(),
  });
});
