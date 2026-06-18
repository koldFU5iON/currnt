import { expect, test } from 'vitest'

test('onboarding page module has default export', async () => {
  const mod = await import('./page')
  expect(typeof mod.default).toBe('function')
})
