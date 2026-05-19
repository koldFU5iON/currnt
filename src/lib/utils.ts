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

export function daysAgo(value: Date | string | null | undefined): number | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return null
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}
