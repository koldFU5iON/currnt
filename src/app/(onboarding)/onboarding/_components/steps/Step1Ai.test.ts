import { expect, test } from 'vitest'
import { getProviderKeyUrl } from './Step1Ai'

test('returns Anthropic console URL', () => {
  expect(getProviderKeyUrl('anthropic')).toBe('https://console.anthropic.com/keys')
})

test('returns OpenAI platform URL', () => {
  expect(getProviderKeyUrl('openai')).toBe('https://platform.openai.com/api-keys')
})

test('returns Google AI Studio URL', () => {
  expect(getProviderKeyUrl('google')).toBe('https://aistudio.google.com/app/apikey')
})

test('returns empty string for unknown provider', () => {
  expect(getProviderKeyUrl('unknown')).toBe('')
})
