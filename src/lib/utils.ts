import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value: Date | string | null | undefined, fallback = "Not set"): string {
  if (!value) return fallback
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return fallback
  return date.toLocaleDateString()
}

export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function daysAgo(value: Date | string | null | undefined): number | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return null
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatShortDate(value: Date | string | null | undefined, fallback = "—"): string {
  if (!value) return fallback
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).format(date)
}

export function formatRelative(days: number): string {
  if (days === 0) return "today"
  if (days < 14) return `${days}d ago`
  if (days < 60) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
