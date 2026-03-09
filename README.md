# gemini-proxy

A self-hosted, OpenAI-compatible HTTP proxy for Google Gemini AI — authenticated via **OAuth 2.0 + PKCE** using the same credentials as the official Gemini CLI. No paid API key required. No `gcloud` CLI. No external tooling to install.

Point any OpenAI SDK or tool at `http://localhost:3000` and it will transparently route requests through Google's [Cloud Code Assist](https://cloudcode-pa.googleapis.com) endpoint using your personal Google account.

---

> **Warning — read before using**
>
> This project uses internal Google API endpoints and OAuth credentials that are publicly embedded in the official Gemini CLI. By using this software you acknowledge:
>
> - **Terms of Service risk** — This approach may violate the ToS of Google and other AI model providers
> - **Account risk** — Google may suspend or restrict your account
> - **No guarantees** — Internal APIs may change or break without notice
> - **Assumption of risk** — You assume all legal, financial, and technical risks associated with using this software
>
> **Intended use:** Personal and internal development only. Respect internal quotas and data-handling policies. Not for production services or circumventing intended rate limits.

---

## Features

- **OpenAI wire-compatible** — drop-in replacement for any tool that speaks OpenAI's API
- **OAuth 2.0 + PKCE** — browser-based login, no API key purchase needed
- **Auto token refresh** — silently refreshes expired access tokens with in-flight deduplication
- **SSE streaming** — `stream: true` with proper `data:` chunks and `[DONE]` terminator
- **Tool calls** — function calling in both streaming and non-streaming modes
- **Multi-modal input** — base64 inline images in content blocks passed through to Gemini
- **Auto project provisioning** — automatically provisions a free-tier managed GCP project on first login
- **Static bearer auth** — `PROXY_API_KEY` protects `/v1/*` endpoints from unauthorized use
- **Zero build step** — TypeScript runs directly via Bun (`noEmit: true`)
- **No external auth tools** — no `gcloud`, no Gemini CLI, no npm auth packages

---

## Supported Models

| Model ID | Notes |
|---|---|
| `gemini-2.5-pro` | Latest Pro |
| `gemini-2.5-flash` | Latest Flash |
| `gemini-2.0-flash` | Recommended default |
| `gemini-2.0-flash-lite` | Fastest / lowest quota |
| `gemini-1.5-pro` | Previous generation |
| `gemini-1.5-flash` | Previous generation |

---

## Requirements

- [Bun](https://bun.sh) v1.1+
- A Google account (personal Gmail works)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/KashifKhn/gemini-proxy.git
cd gemini-proxy
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `PROXY_API_KEY` to any random secret string:

```bash
# Generate one:
openssl rand -base64 32
```

```env
PROXY_API_KEY=your-secret-key-here
```

### 3. Start the server

```bash
bun start
# or with hot reload during development:
bun run dev
```

The server starts on `http://localhost:3000` (or `$PROXY_PORT` if set).

### 4. Authenticate with Google

Open your browser and visit:

```
http://localhost:3000/auth/login
```

You will be redirected to Google's OAuth consent screen. After approving, you will be redirected back and shown:

> **Authentication successful** — You can close this window. Gemini Proxy is ready.

Tokens are saved to `tokens.json` in the project root (path is configurable via `TOKEN_STORE_PATH`). Access tokens are automatically refreshed when they expire.

---

## API Reference

### Auth endpoints (no API key required)

#### `GET /auth/login`

Initiates the OAuth 2.0 + PKCE flow. Redirects the browser to Google's consent screen.

#### `GET /auth/callback`

OAuth redirect URI. Exchanges the authorization code for tokens, provisions the GCP project if needed, and saves credentials to `tokens.json`. Returns an HTML success page.

#### `GET /auth/status`

Returns the current authentication state.

**Response:**
```json
{
  "authenticated": true,
  "email": "you@gmail.com",
  "projectId": "atomic-winter-l2w4j",
  "expiresAt": "2026-03-09T10:33:14.302Z"
}
```

If not authenticated:
```json
{ "authenticated": false }
```

---

### AI endpoints (API key required)

All requests to `/v1/*` must include:

```
Authorization: Bearer <PROXY_API_KEY>
```

#### `GET /v1/models`

Returns the list of supported Gemini models in OpenAI format.

**Response:**
```json
{
  "object": "list",
  "data": [
    { "id": "gemini-2.0-flash", "object": "model", "created": 1773048939, "owned_by": "google" },
    ...
  ]
}
```

#### `POST /v1/chat/completions`

Creates a chat completion. Accepts the standard OpenAI request body.

**Request body:**
```json
{
  "model": "gemini-2.0-flash",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user",   "content": "What is the capital of France?" }
  ],
  "temperature": 0.7,
  "max_tokens": 1024,
  "stream": false
}
```

**Supported fields:** `model`, `messages`, `stream`, `temperature`, `max_tokens`, `top_p`, `stop`, `tools`, `tool_choice`

**Non-streaming response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1773048955,
  "model": "gemini-2.0-flash",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Paris." },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 3,
    "total_tokens": 21
  }
}
```

**Streaming response** (`"stream": true`):

Returns `text/event-stream` with OpenAI-format delta chunks:

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":...,"model":"gemini-2.0-flash","choices":[{"index":0,"delta":{"role":"assistant","content":"Par"},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":...,"model":"gemini-2.0-flash","choices":[{"index":0,"delta":{"content":"is."},"finish_reason":"stop"}]}

data: [DONE]
```

#### `GET /health`

Simple liveness check. Returns `{ "status": "ok" }`. No authentication required.

---

## Usage Examples

### curl (no SDK)

**Non-streaming:**
```bash
curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <PROXY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [{ "role": "user", "content": "Explain recursion in one sentence." }]
  }' | jq .
```

**Streaming:**
```bash
curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <PROXY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [{ "role": "user", "content": "Count from 1 to 5." }],
    "stream": true
  }'
```

**List models:**
```bash
curl -s -H "Authorization: Bearer <PROXY_API_KEY>" \
  http://localhost:3000/v1/models | jq .
```

### OpenAI Node.js SDK

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: process.env.PROXY_API_KEY,
});

// Non-streaming
const completion = await client.chat.completions.create({
  model: "gemini-2.0-flash",
  messages: [{ role: "user", content: "What is 2 + 2?" }],
});
console.log(completion.choices[0]?.message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: "gemini-2.5-pro",
  messages: [{ role: "user", content: "Write a haiku about the sea." }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta.content ?? "");
}
```

### OpenAI Python SDK

```python
from openai import OpenAI
import os

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key=os.environ["PROXY_API_KEY"],
)

# Non-streaming
response = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[{"role": "user", "content": "What is the speed of light?"}],
)
print(response.choices[0].message.content)

# Streaming
with client.chat.completions.stream(
    model="gemini-2.5-pro",
    messages=[{"role": "user", "content": "Explain quantum entanglement simply."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### Using as a drop-in provider

Any tool that accepts a custom `base_url` and `api_key` works:

```bash
# Continue (VS Code extension)
# Set in settings.json:
# "continue.models": [{ "provider": "openai", "apiBase": "http://localhost:3000/v1", "apiKey": "...", "model": "gemini-2.5-pro" }]

# Aider
aider --openai-api-base http://localhost:3000/v1 \
      --openai-api-key $PROXY_API_KEY \
      --model gemini-2.5-pro

# LiteLLM
litellm --model openai/gemini-2.0-flash \
        --api_base http://localhost:3000/v1 \
        --api_key $PROXY_API_KEY
```

---

## Configuration

All configuration is via environment variables, loaded automatically by Bun from `.env`.

| Variable | Default | Description |
|---|---|---|
| `PROXY_API_KEY` | *(none)* | Static Bearer token for `/v1/*` endpoints. **Required** in production. If unset, endpoints are unprotected with a warning. |
| `PROXY_PORT` | `3000` | Port the HTTP server listens on. Also used to construct the OAuth callback URL. |
| `TOKEN_STORE_PATH` | `./tokens.json` | Path to the JSON file where OAuth tokens are persisted. |

---

## Project Structure

```
gemini-proxy/
├── src/
│   ├── index.ts              # Bun entry point — exports { port, fetch }
│   ├── app.ts                # Hono app factory, route wiring, error handler
│   ├── constants.ts          # Credentials, endpoints, model list, env helpers
│   ├── types.ts              # All shared TypeScript interfaces and types
│   ├── oauth/
│   │   ├── pkce.ts           # PKCE challenge/verifier + state generation (Web Crypto)
│   │   ├── exchange.ts       # Auth URL builder + authorization code exchange
│   │   ├── refresh.ts        # Access token refresh with in-flight deduplication
│   │   ├── project.ts        # loadCodeAssist + onboardUser + LRO polling
│   │   └── userAgent.ts      # Gemini CLI User-Agent string builder
│   ├── store/
│   │   └── tokens.ts         # tokens.json read/write + getValidAccessToken()
│   ├── gemini/
│   │   ├── request.ts        # OpenAI messages → Gemini Cloud Code Assist envelope
│   │   ├── response.ts       # Gemini response → OpenAI ChatCompletion shape
│   │   └── stream.ts         # SSE passthrough with OpenAI delta chunk transformation
│   ├── middleware/
│   │   └── auth.ts           # Bearer token validation middleware
│   └── routes/
│       ├── auth.ts           # GET /auth/login, /auth/callback, /auth/status
│       ├── chat.ts           # POST /v1/chat/completions
│       └── models.ts         # GET /v1/models
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
└── LICENSE
```

---

## How It Works

### Authentication flow

```
Browser → GET /auth/login
       ↓
  Build PKCE challenge + state
  Redirect → accounts.google.com/o/oauth2/v2/auth
       ↓
  User grants consent
       ↓
Google → GET /auth/callback?code=...&state=...
       ↓
  Exchange code for tokens (access + refresh)
  Call :loadCodeAssist to get managed GCP project
  If no project: call :onboardUser → poll LRO → get project ID
  Save to tokens.json
       ↓
  "Authentication successful" page
```

### Request flow

```
Client → POST /v1/chat/completions
       ↓
  Validate Bearer token (PROXY_API_KEY)
  Parse + validate request body (Zod)
  Load access token (auto-refresh if expired)
       ↓
  Build Gemini Cloud Code Assist envelope:
  { project, model, user_prompt_id, request: { contents, ... } }
       ↓
POST cloudcode-pa.googleapis.com/v1internal:generateContent
     (or :streamGenerateContent?alt=sse for streaming)
       ↓
  Unwrap { response: GeminiResponse } envelope
  Transform to OpenAI ChatCompletion shape
  (or pipe SSE chunks → delta chunks for streaming)
       ↓
Client ← OpenAI-format JSON (or SSE stream)
```

### Why Cloud Code Assist instead of the public Gemini API?

The official Gemini CLI authenticates against `cloudcode-pa.googleapis.com/v1internal` (Cloud Code Assist) rather than the public `generativelanguage.googleapis.com`. This endpoint:

- Uses your Google account via OAuth instead of a paid API key
- Automatically provisions a free-tier managed GCP project for billing
- Is the exact same path used by the official Gemini CLI and VS Code Gemini plugin

The OAuth `client_id` and `client_secret` used here are the **official Gemini CLI credentials**, which are intentionally public (security is provided by PKCE + the per-user refresh token, not by keeping client credentials secret).

---

## Legal

### Intended Use

- Personal and internal development only
- Respect internal quotas and data-handling policies of the services used
- Not for production services or bypassing intended rate limits or access controls

### Warning

By using this software, you acknowledge:

- **Terms of Service risk** — This approach may violate the Terms of Service of Google, Google Cloud, and other AI model providers
- **Account risk** — Google or other providers may suspend or restrict your account
- **No guarantees** — Internal APIs and endpoints may change or be removed without notice
- **Assumption of risk** — You assume all legal, financial, and technical risks associated with using this software

### Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Google LLC.

"Gemini", "Google Cloud", "Cloud Code", and "Google" are trademarks of Google LLC. All trademarks are the property of their respective owners.

This is an independent open-source project provided as-is, without warranty of any kind. See [LICENSE](./LICENSE) for full terms.

---

## License

[MIT](./LICENSE) — Copyright (c) 2026 Kashif Khan
