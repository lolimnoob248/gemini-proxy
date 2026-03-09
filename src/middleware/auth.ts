import type { Context, Next } from "hono";

export function requireApiKey(c: Context, next: Next): Promise<Response | void> {
  const apiKey = process.env["PROXY_API_KEY"];
  if (!apiKey) {
    console.error("PROXY_API_KEY is not set. Server is running without authentication — set it immediately.");
    return next();
  }

  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (token !== apiKey) {
    return Promise.resolve(
      c.json(
        { error: { message: "Invalid API key", type: "authentication_error", code: "invalid_api_key" } },
        401,
      ),
    );
  }

  return next();
}
