import { Hono } from "hono";
import { SUPPORTED_MODELS } from "../constants";

export const modelRoutes = new Hono();

modelRoutes.get("/v1/models", (c) => {
  const created = Math.floor(Date.now() / 1000);
  const data = SUPPORTED_MODELS.map((id) => ({
    id,
    object: "model",
    created,
    owned_by: "google",
  }));
  return c.json({ object: "list", data });
});
