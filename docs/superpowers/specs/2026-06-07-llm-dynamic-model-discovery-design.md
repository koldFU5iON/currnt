# LLM Dynamic Model Discovery — Design Spec

**Issue:** #93
**Date:** 2026-06-07
**Scope:** Quick win — replace free-text model input with dynamic provider model discovery. Single provider per user, no per-feature routing (deferred to future multi-provider upgrade).

---

## Goal

Replace the free-text model ID input in `/dashboard/settings/llm` with a dropdown populated by calling the selected provider's model listing API. Users no longer need to know or type model IDs; the list reflects exactly what their key has access to.

---

## Data model

One field added to `UserSettings`:

```prisma
availableModels Json?   // {id: string, name: string}[] cached from provider; null = not yet fetched
```

No new tables. Migration required. All other `UserSettings` columns (`llmProvider`, `llmModel`, `llmApiKey`) are unchanged.

---

## API layer

### New file: `src/modules/llm/models.ts`

Exports one function:

```ts
fetchProviderModels(provider: string, apiKey: string): Promise<{ id: string; name: string }[]>
```

Provider-specific logic:

| Provider | Endpoint | Filter |
|---|---|---|
| **Anthropic** | `GET https://api.anthropic.com/v1/models` | Headers: `x-api-key`, `anthropic-version: 2023-06-01` |
| **OpenAI** | `GET https://api.openai.com/v1/models` | Filter to IDs starting with `gpt-`, `o1`, `o3`, `o4` |
| **Google** | `GET https://generativelanguage.googleapis.com/v1beta/models?key=…` | Filter to models with `generateContent` in `supportedGenerationMethods` |

All results normalised to `{id: string, name: string}[]`. Adding a future provider = one new entry in this file.

### Updated `src/modules/llm/actions.ts`

Three actions replace the current `saveLLMSettings`:

| Action | Trigger | Behaviour |
|---|---|---|
| `saveLLMApiKey({ provider, apiKey })` | Save icon click | Calls `fetchProviderModels(provider, apiKey)` first — this is the key validation step. On success, writes encrypted key + `availableModels` in a single DB upsert. On any failure (401/403 = bad key, network = transient), nothing is written. |
| `saveLLMModel(model: string)` | Model dropdown select | Writes `llmModel` immediately. |
| `refreshModels()` | Refresh link click | Decrypts stored key, calls `fetchProviderModels`, updates `availableModels` in DB, returns updated list. |

`clearLLMApiKey()` stays unchanged — additionally clears `availableModels` on execution.

### Updated `src/app/dashboard/settings/llm/page.tsx`

Passes `availableModels` from `UserSettings` as an additional prop to `LLMSettingsForm`.

---

## Component design

### `src/app/dashboard/settings/llm/_components/llm-settings-form.tsx`

Three distinct UI states:

**① No key configured**
- Provider dropdown: enabled
- API key input group: empty placeholder `sk-ant-api03-…`, save icon disabled (greyed)
- Model field: disabled, shows "Save a key first"

**② Saving key + fetching models (transient)**
- All inputs disabled
- Save icon replaced by spinner
- Model field shows spinner + "Fetching models…"

**③ Ready**
- Provider dropdown: enabled (changing clears `availableModels`, returns to state ①)
- API key input group: masked placeholder "leave blank to keep", "Saved" green badge in label, save icon active for key rotation
- Model field: `Select` dropdown populated from `availableModels`, "Refresh" link in label row, helper text "N models · saves on select"

**Key input group structure:**
- `<Input>` (password/text toggled by eye icon)
- Save icon button (✓) — triggers `saveLLMApiKey` + model fetch
- Eye icon button — toggles visibility

**Model auto-save:** selecting a model calls `saveLLMModel(model)` via `useTransition`, no additional Save button.

---

## Error handling

`fetchProviderModels` is the key validation step — it runs before anything is written to the DB. This means key save and model fetch succeed or fail atomically.

| Scenario | Key saved? | Behaviour |
|---|---|---|
| Invalid key (provider 401/403) | No | Toast error: "Invalid API key — check it and try again." Save icon resets. |
| Network / provider error | No | Toast error: "Couldn't reach provider — try again." Save icon resets. |
| Fetch returns empty list | No | Toast error: "No models returned — check your key has the right permissions." Save icon resets. |
| **Refresh** fails (key already stored) | Already saved | Inline error in model section: "Couldn't load models — Refresh to retry." Existing model selection preserved. |

---

## Files changed

| File | Action |
|---|---|
| `prisma/schema/settings.prisma` | Add `availableModels Json?` to `UserSettings` |
| `prisma/migrations/…` | New migration: `add_available_models_to_user_settings` |
| `src/modules/llm/models.ts` | **Create** — `fetchProviderModels` per-provider logic |
| `src/modules/llm/actions.ts` | Replace `saveLLMSettings` with `saveLLMApiKey`, `saveLLMModel`, `refreshModels`; update `clearLLMApiKey` |
| `src/app/dashboard/settings/llm/page.tsx` | Pass `availableModels` prop to form |
| `src/app/dashboard/settings/llm/_components/llm-settings-form.tsx` | Full rewrite — three-state UX, input group, auto-save on select |

---

## Out of scope (deferred to multi-provider upgrade)

- Multiple providers per user (`ProviderConfig` table)
- Per-feature model routing (issue #70)
- Provider health monitoring
- Automatic model list refresh on schedule
