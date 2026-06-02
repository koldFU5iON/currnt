export function notifyUsageUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('llm-usage-updated'))
  }
}
