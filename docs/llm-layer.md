# LLM Layer

Server-side abstraction over the Vercel AI Gateway. Product features call
`complete()` or `completeStructured()` and don't import from `ai` directly —
swapping providers later is a string/env change, not a refactor.

Files live in `src/modules/llm/`:

```
src/modules/llm/
  client.ts   — public surface: complete, completeStructured
  errors.ts   — LLMError + normalizeLLMError
```

## Setup

The Gateway routes to multiple providers with a single API key.

1. Create a key at Vercel dashboard → **AI Gateway** → **API Keys**
2. Add to Vercel project env: `AI_GATEWAY_API_KEY=...` (Production + Preview)
3. For local dev, add the same key to `.env.local`
4. (Optional) `LLM_MODEL=anthropic/claude-sonnet-4.6` — override the default

On Vercel, the SDK can also authenticate via `VERCEL_OIDC_TOKEN` (auto-injected
into every function invocation), so prod will work even without the API key as
long as your Vercel team has Gateway enabled.

## Usage

### Plain text

```ts
import { complete } from '@/modules/llm/client'

const { text, model, usage, latencyMs } = await complete(
  'Summarize the following resume in 3 bullets: …',
  { maxOutputTokens: 200, temperature: 0.3 },
)
```

Return shape:

```ts
{
  text: string
  finishReason: string
  provider: string      // 'anthropic' / 'openai' / etc. parsed from model id
  model: string
  usage: { inputTokens, outputTokens, totalTokens, ... }
  latencyMs: number
}
```

### Structured output

Pass a zod schema; the model is steered to JSON matching it, and the result is
parsed + validated before return.

```ts
import { z } from 'zod'
import { completeStructured } from '@/modules/llm/client'

const JobFitSchema = z.object({
  rating: z.number().min(0).max(10),
  label: z.enum(['poor', 'ok', 'stretch', 'good', 'excellent']),
  justification: z.string(),
})

const { object } = await completeStructured(
  `Score this candidate for the role.\n\nCandidate: …\n\nRole: …`,
  JobFitSchema,
  { maxOutputTokens: 500, temperature: 0 },
)
// object is typed as z.infer<typeof JobFitSchema>
```

### Per-call provider override

Both functions accept a `model` option:

```ts
await complete(prompt, { model: 'openai/gpt-5' })
await complete(prompt, { model: 'google/gemini-2.5-pro' })
```

Get the current list of available models:

```bash
curl -s https://ai-gateway.vercel.sh/v1/models \
  | python3 -c "import json,sys; \
      [print(m['id']) for m in json.load(sys.stdin)['data']]"
```

## Error handling

All thrown errors are `LLMError` instances with a `kind` field:

| `kind` | Meaning |
|---|---|
| `config` | Missing key, unknown model id, datasource not configured |
| `auth` | 401/403 from provider — key invalid or unauthorized for model |
| `rate_limit` | 429 — back off and retry |
| `unavailable` | 5xx — try again shortly |
| `safety` | Provider refused to generate output |
| `invalid_output` | Structured output didn't match the schema |
| `unknown` | Anything else — original error preserved on `.cause` |

```ts
import { LLMError } from '@/modules/llm/errors'

try {
  await complete(prompt)
} catch (err) {
  if (err instanceof LLMError) {
    switch (err.kind) {
      case 'rate_limit':  return scheduleRetry()
      case 'config':      return showSetupHint()
      case 'safety':      return showFallbackUI()
      default:            throw err
    }
  }
  throw err
}
```

## Verifying the setup

`GET /api/llm/ping` is a session-authed sanity check. Sign in to the dashboard,
then:

```bash
curl --cookie-jar /tmp/jar -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password"}'

curl --cookie /tmp/jar http://localhost:3000/api/llm/ping
```

Expected:

```json
{
  "ok": true,
  "reply": "pong",
  "provider": "anthropic",
  "model": "anthropic/claude-sonnet-4.6",
  "latencyMs": 712,
  "usage": { "inputTokens": 12, "outputTokens": 2, "totalTokens": 14 }
}
```

A 503 with `error: "config"` means `AI_GATEWAY_API_KEY` isn't set. A 503 with
`error: "auth"` means the key exists but isn't valid for the model.

## Adding a new provider

If the Gateway already supports it (most do — OpenAI, Anthropic, Google, Mistral,
Groq, DeepSeek, etc.), just pass a different `model` string. No code change.

If you want to bypass the Gateway and call a provider directly, add the provider
package (e.g. `@ai-sdk/anthropic`) and update `client.ts` to map model strings
to provider instances. The public surface (`complete`, `completeStructured`,
`LLMError`) stays the same — only the SDK plumbing changes.
