import { randomUUID } from "node:crypto";
import type {
  GeminiCandidate,
  GeminiResponse,
  OpenAIChatCompletion,
  OpenAIStreamChunk,
  OpenAIToolCall,
  OpenAIUsage,
} from "../types";

export function geminiResponseToOpenAI(
  geminiBody: GeminiResponse,
  model: string,
): OpenAIChatCompletion {
  const candidate = geminiBody.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const toolCalls = extractToolCalls(candidate);
  const textContent = toolCalls
    ? null
    : parts
        .filter((p) => p.text !== undefined && !p.thought)
        .map((p) => p.text ?? "")
        .join("") || null;

  const usage = geminiBody.usageMetadata;

  return {
    id: `chatcmpl-${randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: mapFinishReason(candidate?.finishReason),
      },
    ],
    usage: buildUsage(usage),
  };
}

export function geminiChunkToOpenAI(
  geminiBody: GeminiResponse,
  model: string,
  chunkId: string,
): OpenAIStreamChunk {
  const candidate = geminiBody.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const toolCallDeltas = extractStreamingToolCalls(candidate);
  const textDelta = toolCallDeltas
    ? undefined
    : parts
        .filter((p) => p.text !== undefined && !p.thought)
        .map((p) => p.text ?? "")
        .join("") || undefined;

  const finishReason = candidate?.finishReason ? mapFinishReason(candidate.finishReason) : null;

  return {
    id: chunkId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          content: textDelta ?? null,
          ...(toolCallDeltas ? { tool_calls: toolCallDeltas } : {}),
        },
        finish_reason: finishReason,
      },
    ],
  };
}

function extractToolCalls(candidate: GeminiCandidate | undefined): OpenAIToolCall[] | undefined {
  if (!candidate?.content?.parts) return undefined;
  const calls = candidate.content.parts
    .filter((p) => p.functionCall !== undefined)
    .map((p, index) => ({
      id: `call_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      type: "function" as const,
      function: {
        name: p.functionCall?.name ?? "",
        arguments: JSON.stringify(p.functionCall?.args ?? {}),
      },
    }));
  return calls.length > 0 ? calls : undefined;
}

function extractStreamingToolCalls(
  candidate: GeminiCandidate | undefined,
): OpenAIStreamChunk["choices"][number]["delta"]["tool_calls"] | undefined {
  if (!candidate?.content?.parts) return undefined;
  const calls = candidate.content.parts
    .filter((p) => p.functionCall !== undefined)
    .map((p, index) => ({
      index,
      id: `call_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      type: "function" as const,
      function: {
        name: p.functionCall?.name ?? "",
        arguments: JSON.stringify(p.functionCall?.args ?? {}),
      },
    }));
  return calls.length > 0 ? calls : undefined;
}

function mapFinishReason(geminiReason: string | undefined): string {
  switch (geminiReason) {
    case "STOP": return "stop";
    case "MAX_TOKENS": return "length";
    case "SAFETY": return "content_filter";
    case "RECITATION": return "content_filter";
    default: return "stop";
  }
}

function buildUsage(meta: GeminiResponse["usageMetadata"]): OpenAIUsage {
  return {
    prompt_tokens: meta?.promptTokenCount ?? 0,
    completion_tokens: meta?.candidatesTokenCount ?? 0,
    total_tokens: meta?.totalTokenCount ?? 0,
  };
}
