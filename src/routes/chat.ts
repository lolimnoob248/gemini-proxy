import { Hono } from "hono";
import { z } from "zod";
import { buildGeminiRequest } from "../gemini/request";
import { geminiResponseToOpenAI } from "../gemini/response";
import { createOpenAIStreamFromGemini } from "../gemini/stream";
import { getValidAccessToken, readTokenStore } from "../store/tokens";
import type { OpenAIChatRequest } from "../types";

export const chatRoutes = new Hono();

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.record(z.unknown()))]).nullable(),
  name: z.string().optional(),
  tool_calls: z.array(z.unknown()).optional(),
  tool_call_id: z.string().optional(),
});

const chatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  top_p: z.number().optional(),
  tools: z.array(z.unknown()).optional(),
  tool_choice: z.unknown().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
});

chatRoutes.post("/v1/chat/completions", async (c) => {
  const rawBody = await c.req.json().catch(() => null);
  if (!rawBody) {
    return c.json({ error: { message: "Invalid JSON body", type: "invalid_request_error", code: null } }, 400);
  }

  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.message, type: "invalid_request_error", code: null } },
      400,
    );
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return c.json(
      { error: { message: "Not authenticated. Visit /auth/login to connect your Google account.", type: "authentication_error", code: "not_authenticated" } },
      401,
    );
  }

  const store = readTokenStore();
  const projectId = store?.managedProjectId ?? store?.projectId;
  if (!projectId) {
    return c.json(
      { error: { message: "No managed project found. Re-authenticate at /auth/login.", type: "authentication_error", code: "no_project" } },
      401,
    );
  }

  const openAiRequest = parsed.data as OpenAIChatRequest;
  const prepared = buildGeminiRequest(openAiRequest, accessToken, projectId);

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(prepared.url, {
      method: "POST",
      headers: prepared.headers,
      body: prepared.body,
    });
  } catch (err) {
    return c.json(
      { error: { message: err instanceof Error ? err.message : "Upstream request failed", type: "api_error", code: null } },
      502,
    );
  }

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text().catch(() => "");
    return c.json(
      { error: { message: `Upstream error (${geminiResponse.status}): ${errText}`, type: "api_error", code: String(geminiResponse.status) } },
      geminiResponse.status as 400 | 401 | 403 | 404 | 429 | 500 | 502,
    );
  }

  if (prepared.streaming && geminiResponse.body) {
    const openAiStream = createOpenAIStreamFromGemini(geminiResponse.body, openAiRequest.model);
    return new Response(openAiStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const geminiJson = (await geminiResponse.json()) as Record<string, unknown>;
  // Cloud Code Assist wraps the response body under a "response" key
  const inner = (geminiJson["response"] ?? geminiJson) as import("../types").GeminiResponse;
  const completion = geminiResponseToOpenAI(inner, openAiRequest.model);
  return c.json(completion);
});
