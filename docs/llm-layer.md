# LLM Layer (Bring-Your-Own-Key)

Server-side abstraction over multiple AI providers. **Each user supplies their
own API key** at `/dashboard/settings/llm` — token costs land on their account,
not the app owner's.

Product features call `complete()` / `completeStructured()` with a `profileId`
and never import from `ai` or any provider SDK directly. Switching providers,
adding new ones, or moving off any specific provider is a localised change in
`client.ts`.

```
src/modules/llm/
  client.ts   public surface: complete, completeStructured, getLLMConfigStatus
  actions.ts  use-server: saveLLMSettings, clearLLMApiKey (for the settings UI)
  errors.ts   LLMError + normalizeLLMError
```

## Providers wired in

| Provider | Env model id example |
|---|---|
| Anthropic | `claude-sonnet-4-6` |
| OpenAI | `gpt-5` |
| Google | `gemini-2.5-pro` |

Adding a new provider is one line in `PROVIDERS` in `client.ts` — supply a
factory that takes `(apiKey, modelId)` and returns a `LanguageModel`.

## How users set it up

1. Sidebar → **Settings** → **LLM**
2. Pick a provider
3. Enter a model id (the form pre-fills a current example per provider)
4. Paste the provider API key — stored AES-256-GCM-encrypted at rest, never
   logged, never returned to the client after save
5. Click **Save**, then **Test connection** to verify

The "Test connection" button hits `GET /api/llm/ping`, which runs a 16-token,
temp=0 `pong` round-trip using the user's saved settings.

## Usage

### Plain text

```ts
import { complete } from '@/modules/llm/client'
import { requireProfile } from '@/lib/session'

const { profile } = await requireProfile()
const { text, model, usage, latencyMs } = await complete(
  profile.id,
  'Summarize the following resume in 3 bullets: …',
  { maxOutputTokens: 200, temperature: 0.3 },
)
```

Return shape:

```ts
{
  text: string
  finishReason: string
  provider: string      // 'anthropic' | 'openai' | 'google' | future...
  model: string         // exact model id used
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
  profile.id,
  `Score this candidate for the role.\n\nCandidate: …\n\nRole: …`,
  JobFitSchema,
  { maxOutputTokens: 500, temperature: 0 },
)
// object is typed as z.infer<typeof JobFitSchema>
```

### Cheap config check (no LLM call)

For UIs that need to know "has this user finished setup yet?" without paying
for a ping:

```ts
import { getLLMConfigStatus } from '@/modules/llm/client'

const status = await getLLMConfigStatus(profile.id)
// { configured: boolean, provider: string | null, model: string | null }
```

## Error handling

All thrown errors are `LLMError` instances with a `kind` field:

| `kind` | Meaning | What to surface |
|---|---|---|
| `not_configured` | User hasn't saved a key yet | Link them to `/dashboard/settings/llm` |
| `config` | Bad model id, unsupported provider, undecryptable stored key | Tell them to re-enter |
| `auth` | 401/403 from provider — key invalid or unauthorized for model | Tell them to check their key |
| `rate_limit` | 429 — back off and retry | Generic "try again shortly" |
| `unavailable` | 5xx from provider | Generic "try again shortly" |
| `safety` | Provider refused to generate output | Offer a fallback path |
| `invalid_output` | Structured output didn't match the schema | Internal error — retry or fallback |
| `unknown` | Anything else | Log the cause; show generic error |

```ts
import { LLMError } from '@/modules/llm/errors'

try {
  await complete(profileId, prompt)
} catch (err) {
  if (err instanceof LLMError) {
    switch (err.kind) {
      case 'not_configured': return redirect('/dashboard/settings/llm')
      case 'rate_limit':     return scheduleRetry()
      case 'auth':           return showKeyErrorBanner()
      default:               throw err
    }
  }
  throw err
}
```

## Adding a provider

In `client.ts`:

```ts
import { createMistral } from '@ai-sdk/mistral'
// ...
const PROVIDERS: Record<string, ProviderFactory> = {
  anthropic: (apiKey, modelId) => createAnthropic({ apiKey })(modelId),
  openai:    (apiKey, modelId) => createOpenAI({ apiKey })(modelId),
  google:    (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
  mistral:   (apiKey, modelId) => createMistral({ apiKey })(modelId),  // ← new
}
```

Then add the option to the settings form's `PROVIDERS` list. No other code
needs to change.

## Encryption

User keys are encrypted by `src/lib/encryption.ts` (AES-256-GCM). The KEK is
derived from `process.env.ENCRYPTION_KEY` via SHA-256. Rotating `ENCRYPTION_KEY`
without re-encrypting stored values will cause `decrypt()` to silently return
`null`, which surfaces as `LLMError(kind='config')` — the user re-enters their
key and the new encryption goes through.
