import { describe, it, expect, vi, afterEach } from "vitest"
import { daysAgo, formatRelative } from "./utils"

describe("daysAgo", () => {
  afterEach(() => vi.useRealTimers())

  it("returns 0 for a timestamp earlier the same calendar day", () => {
    vi.setSystemTime(new Date(2026, 4, 31, 14, 0, 0))
    expect(daysAgo(new Date(2026, 4, 31, 9, 0, 0))).toBe(0)
  })

  it("returns 0 for a timestamp slightly in the future (clock skew)", () => {
    vi.setSystemTime(new Date(2026, 4, 31, 14, 0, 0, 0))
    // 100ms ahead of 'now' — must not become -1
    expect(daysAgo(new Date(2026, 4, 31, 14, 0, 0, 100))).toBe(0)
  })

  it("counts calendar days, not elapsed 24h windows", () => {
    // Only 2 hours elapsed, but it was the previous calendar day → "1 day ago"
    vi.setSystemTime(new Date(2026, 4, 31, 1, 0, 0))
    expect(daysAgo(new Date(2026, 4, 30, 23, 0, 0))).toBe(1)
  })

  it("returns the calendar-day count for older dates", () => {
    vi.setSystemTime(new Date(2026, 4, 31, 12, 0, 0))
    expect(daysAgo(new Date(2026, 4, 22, 12, 0, 0))).toBe(9)
  })

  it("returns null for empty/invalid input", () => {
    expect(daysAgo(null)).toBeNull()
    expect(daysAgo("not a date")).toBeNull()
  })
})

describe("formatRelative", () => {
  it("renders 0 as 'today'", () => {
    expect(formatRelative(0)).toBe("today")
  })

  it("clamps negative day counts to 'today' (never shows -1d ago)", () => {
    expect(formatRelative(-1)).toBe("today")
  })

  it("renders recent days as 'Nd ago'", () => {
    expect(formatRelative(1)).toBe("1d ago")
    expect(formatRelative(9)).toBe("9d ago")
  })
})
