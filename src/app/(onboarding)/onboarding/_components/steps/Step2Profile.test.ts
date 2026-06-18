import { expect, test } from 'vitest'

test('Step2Profile module exports the component', async () => {
  const mod = await import('./Step2Profile')
  expect(typeof mod.Step2Profile).toBe('function')
})
