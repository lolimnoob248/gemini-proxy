import { randomUUID } from "node:crypto";
import { CODE_ASSIST_ENDPOINT, CODE_ASSIST_HEADERS } from "../constants";
import type {
  GeminiContent,
  GeminiPart,
  GeminiRequestEnvelope,
  OpenAIChatRequest,
  OpenAIMessage,
  OpenAITool,
} from "../types";
import { buildUserAgent } from "../oauth/userAgent";

export interface PreparedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  streaming: boolean;
}

export function buildGeminiRequest(
  openAiRequest: OpenAIChatRequest,
  accessToken: string,
  projectId: string,
): PreparedRequest {
  const streaming = openAiRequest.stream === true;
  const model = openAiRequest.model;
  const action = streaming ? "streamGenerateContent?alt=sse" : "generateContent";
  const url = `${CODE_ASSIST_ENDPOINT}:${action}`;

  const { contents, systemInstruction } = convertMessages(openAiRequest.messages);
  const tools = openAiRequest.tools ? convertTools(openAiRequest.tools) : undefined;

  const requestPayload: Record<string, unknown> = { contents };

  if (systemInstruction) {
    requestPayload["systemInstruction"] = systemInstruction;
  }

  if (tools) {
    requestPayload["tools"] = tools;
  }

  const generationConfig: Record<string, unknown> = {};
  if (openAiRequest.temperature !== undefined) generationConfig["temperature"] = openAiRequest.temperature;
  if (openAiRequest.max_tokens !== undefined) generationConfig["maxOutputTokens"] = openAiRequest.max_tokens;
  if (openAiRequest.top_p !== undefined) generationConfig["topP"] = openAiRequest.top_p;
  if (openAiRequest.stop !== undefined) {
    generationConfig["stopSequences"] = Array.isArray(openAiRequest.stop)
      ? openAiRequest.stop
      : [openAiRequest.stop];
  }
  if (Object.keys(generationConfig).length > 0) {
    requestPayload["generationConfig"] = generationConfig;
  }

  const envelope: GeminiRequestEnvelope = {
    project: projectId,
    model,
    user_prompt_id: randomUUID(),
    request: requestPayload,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": buildUserAgent(model),
    "x-activity-request-id": randomUUID(),
    ...CODE_ASSIST_HEADERS,
  };

  if (streaming) {
    headers["Accept"] = "text/event-stream";
  }

  return {
    url,
    headers,
    body: JSON.stringify(envelope),
    streaming,
  };
}

function convertMessages(messages: OpenAIMessage[]): {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
} {
  const contents: GeminiContent[] = [];
  let systemInstruction: { parts: GeminiPart[] } | undefined;

  for (const message of messages) {
    if (message.role === "system") {
      if (!systemInstruction) {
        const text = typeof message.content === "string" ? message.content : extractTextContent(message.content);
        if (text) {
          systemInstruction = { parts: [{ text }] };
        }
      }
      continue;
    }

    if (message.role === "tool") {
      const lastContent = contents[contents.length - 1];
      const part: GeminiPart = {
        functionResponse: {
          name: message.name ?? "tool",
          response: { content: message.content ?? "" },
        },
      };
      if (lastContent && lastContent.role === "user") {
        lastContent.parts.push(part);
      } else {
        contents.push({ role: "user", parts: [part] });
      }
      continue;
    }

    const role: "user" | "model" = message.role === "assistant" ? "model" : "user";
    const parts = messageToGeminiParts(message);
    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return { contents: mergeConsecutiveTurns(contents), systemInstruction };
}

function messageToGeminiParts(message: OpenAIMessage): GeminiPart[] {
  const parts: GeminiPart[] = [];

  if (message.tool_calls && message.tool_calls.length > 0) {
    for (const tc of message.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        args = { _raw: tc.function.arguments };
      }
      parts.push({ functionCall: { name: tc.function.name, args } });
    }
    return parts;
  }

  if (typeof message.content === "string") {
    if (message.content) parts.push({ text: message.content });
    return parts;
  }

  if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block.type === "text" && block.text) {
        parts.push({ text: block.text });
      } else if (block.type === "image_url" && block.image_url) {
        const url = block.image_url.url;
        if (url.startsWith("data:")) {
          const [header, data] = url.split(",");
          const mimeType = (header ?? "").replace("data:", "").replace(";base64", "");
          parts.push({ inlineData: { mimeType, data: data ?? "" } });
        }
      }
    }
  }

  return parts;
}

function extractTextContent(
  content: OpenAIMessage["content"],
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

function mergeConsecutiveTurns(contents: GeminiContent[]): GeminiContent[] {
  const merged: GeminiContent[] = [];
  for (const turn of contents) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.parts.push(...turn.parts);
    } else {
      merged.push({ role: turn.role, parts: [...turn.parts] });
    }
  }
  return merged;
}

function convertTools(tools: OpenAITool[]): unknown {
  const functionDeclarations = tools
    .filter((t) => t.type === "function")
    .map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));
  return [{ functionDeclarations }];
}
