import { randomUUID } from "node:crypto";
import type { GeminiResponse, OpenAIStreamChunk } from "../types";
import { geminiChunkToOpenAI } from "./response";

export function createOpenAIStreamFromGemini(
  geminiStream: ReadableStream<Uint8Array>,
  model: string,
): ReadableStream<Uint8Array> {
  const chunkId = `chatcmpl-${randomUUID()}`;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = geminiStream.getReader();

      const pump = (): void => {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              if (buffer.trim()) {
                processLine(buffer.trim(), chunkId, model, controller, encoder);
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                processLine(trimmed, chunkId, model, controller, encoder);
              }
            }
            pump();
          })
          .catch((error) => {
            controller.error(error);
          });
      };

      pump();
    },
  });
}

function processLine(
  line: string,
  chunkId: string,
  model: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): void {
  if (!line.startsWith("data:")) return;

  const json = line.slice(5).trim();
  if (!json || json === "[DONE]") return;

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const geminiBody = (parsed["response"] ?? parsed) as GeminiResponse;

    const chunk = geminiChunkToOpenAI(geminiBody, model, chunkId);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
  } catch {
  }
}
