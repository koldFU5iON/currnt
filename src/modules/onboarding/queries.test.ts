import { expect, test } from 'vitest'
import { getOnboardingStatus } from './queries'

test('getOnboardingStatus is exported as a function', () => {
  expect(typeof getOnboardingStatus).toBe('function')
})
