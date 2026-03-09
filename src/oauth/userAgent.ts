import { GEMINI_CLI_VERSION } from "../constants";

export function buildUserAgent(model = "gemini-code-assist"): string {
  return `GeminiCLI/${GEMINI_CLI_VERSION}/${model} (${process.platform}; ${process.arch})`;
}
