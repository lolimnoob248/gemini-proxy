import { createApp } from "./app";
import { DEFAULT_PORT } from "./constants";

const port = parseInt(process.env["PROXY_PORT"] ?? String(DEFAULT_PORT), 10);

if (!process.env["PROXY_API_KEY"]) {
  console.warn("WARNING: PROXY_API_KEY is not set. The /v1/* endpoints are unprotected.");
}

const app = createApp();

console.log(`Gemini Proxy running on http://localhost:${port}`);
console.log(`Visit http://localhost:${port}/auth/login to authenticate with Google`);

export default {
  port,
  fetch: app.fetch,
};
