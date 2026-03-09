export interface TokenStore {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  projectId?: string;
  managedProjectId?: string;
  email?: string;
}

export interface PkceParams {
  challenge: string;
  verifier: string;
}

export type TokenExchangeResult =
  | { ok: true; accessToken: string; refreshToken: string; expiresAt: number; email?: string }
  | { ok: false; error: string };

export type TokenRefreshResult =
  | { ok: true; accessToken: string; expiresAt: number; refreshToken: string }
  | { ok: false; error: string };

export interface LoadCodeAssistPayload {
  cloudaicompanionProject?: string | { id?: string };
  currentTier?: { id?: string; name?: string };
  allowedTiers?: Array<{ id?: string; isDefault?: boolean; userDefinedCloudaicompanionProject?: boolean }>;
  ineligibleTiers?: Array<{ reasonCode?: string; reasonMessage?: string; validationUrl?: string }>;
}

export interface OnboardUserPayload {
  name?: string;
  done?: boolean;
  response?: {
    cloudaicompanionProject?: { id?: string };
  };
}

export type ProjectResolveResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: OpenAITool[];
  tool_choice?: string | { type: string; function?: { name: string } };
  stop?: string | string[];
  [key: string]: unknown;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

export interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: OpenAIDelta;
    finish_reason: string | null;
  }>;
}

export interface OpenAIChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCall[] };
    finish_reason: string;
  }>;
  usage: OpenAIUsage;
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thought?: boolean;
  [key: string]: unknown;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: string;
  index?: number;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  [key: string]: unknown;
}

export interface GeminiRequestEnvelope {
  project: string;
  model: string;
  user_prompt_id: string;
  request: Record<string, unknown>;
}
