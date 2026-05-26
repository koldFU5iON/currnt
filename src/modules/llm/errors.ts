// Normalized LLM error surface. Product code catches LLMError (and its `kind`)
// instead of provider-specific SDK errors, so swapping providers later doesn't
// require touching every catch block.

import {
  AISDKError,
  APICallError,
  LoadAPIKeyError,
  LoadSettingError,
  NoContentGeneratedError,
  NoObjectGeneratedError,
  NoSuchModelError,
  TypeValidationError,
} from 'ai'

export type LLMErrorKind =
  | 'config'         // missing key, bad model id, datasource mis-set
  | 'auth'           // valid request, wrong/expired credentials
  | 'rate_limit'     // 429
  | 'unavailable'    // 5xx from provider
  | 'safety'         // policy refusal / empty output
  | 'invalid_output' // structured output didn't match schema
  | 'unknown'

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly kind: LLMErrorKind,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

// Map AI SDK / provider errors to our normalized shape. Order matters — the
// most specific cases come first; AISDKError is a base class for many of them.
export function normalizeLLMError(err: unknown): LLMError {
  if (err instanceof LLMError) return err

  if (err instanceof LoadAPIKeyError || err instanceof LoadSettingError) {
    return new LLMError(
      'LLM is not configured. Set AI_GATEWAY_API_KEY in your environment.',
      'config',
      err,
    )
  }

  if (err instanceof NoSuchModelError) {
    return new LLMError(`Configured LLM model not found: ${err.message}`, 'config', err)
  }

  if (err instanceof APICallError) {
    const status = err.statusCode
    if (status === 401 || status === 403) {
      return new LLMError('LLM auth failed — invalid key or unauthorized model.', 'auth', err)
    }
    if (status === 429) {
      return new LLMError('LLM rate limit exceeded — try again shortly.', 'rate_limit', err)
    }
    if (status != null && status >= 500) {
      return new LLMError('LLM provider unavailable — try again shortly.', 'unavailable', err)
    }
    return new LLMError(`LLM call failed: ${err.message}`, 'unknown', err)
  }

  if (err instanceof NoObjectGeneratedError || err instanceof TypeValidationError) {
    return new LLMError('LLM output did not match the expected schema.', 'invalid_output', err)
  }

  if (err instanceof NoContentGeneratedError) {
    return new LLMError('LLM returned no content — likely a safety refusal.', 'safety', err)
  }

  if (err instanceof AISDKError) {
    return new LLMError(`LLM error: ${err.message}`, 'unknown', err)
  }

  return new LLMError(
    err instanceof Error ? err.message : 'Unknown LLM error',
    'unknown',
    err,
  )
}
