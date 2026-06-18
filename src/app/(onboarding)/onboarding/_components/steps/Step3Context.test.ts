import { expect, test } from 'vitest'

test('Step3Context module exports the component', async () => {
  const mod = await import('./Step3Context')
  expect(typeof mod.Step3Context).toBe('function')
})
