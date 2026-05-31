import { expect, test } from "vitest"
import { parseMonthYear, parseYear } from "./date-parse"

test("parseMonthYear parses YYYY-MM to first of month UTC", () => {
  const d = parseMonthYear("2024-07")
  expect(d?.toISOString()).toBe("2024-07-01T00:00:00.000Z")
})

test("parseMonthYear returns null for null, empty, and garbage", () => {
  expect(parseMonthYear(null)).toBeNull()
  expect(parseMonthYear("")).toBeNull()
  expect(parseMonthYear("Present")).toBeNull()
  expect(parseMonthYear("not-a-date")).toBeNull()
})

test("parseMonthYear rejects an out-of-range month", () => {
  expect(parseMonthYear("2024-13")).toBeNull()
})

test("parseYear parses YYYY to Jan 1 UTC", () => {
  expect(parseYear("1997")?.toISOString()).toBe("1997-01-01T00:00:00.000Z")
})

test("parseYear returns null for null and garbage", () => {
  expect(parseYear(null)).toBeNull()
  expect(parseYear("nope")).toBeNull()
})
