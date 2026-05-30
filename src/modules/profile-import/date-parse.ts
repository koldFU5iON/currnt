// CV date strings → Date | null. The LLM normalizes raw PDF dates ("July 2024",
// "(1997 - 2001)", "Present") into "YYYY-MM" / "YYYY" / null before they reach
// here; this is the single place those strings become Dates. Day is always the
// 1st, in UTC, so a stored date never shifts across timezones.

export function parseMonthYear(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return new Date(Date.UTC(year, month - 1, 1))
}

export function parseYear(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})$/.exec(value.trim())
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), 0, 1))
}
