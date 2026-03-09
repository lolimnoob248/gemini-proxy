import { Hono } from "hono";
import { requireApiKey } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { modelRoutes } from "./routes/models";

export function createApp(): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json(
      { error: { message: "Internal server error", type: "api_error", code: null } },
      500,
    );
  });

  app.use("/auth/*", requireApiKey);
  app.route("/", authRoutes);

  app.use("/v1/*", requireApiKey);
  app.route("/", chatRoutes);
  app.route("/", modelRoutes);

  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}
