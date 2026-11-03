# Provider Model Refresh

**Status:** Decided

## Decision

For each configured BYOK provider, currnt will retrieve available models when the user saves the provider key and store the resulting model metadata for that user and provider.

The AI settings area will show when the list was last refreshed and offer an explicit **Refresh models** action. Opening those settings may refresh the list automatically when it is older than 24 hours. AI workflows will use the cached list rather than refreshing it for each request.

## Fallbacks and history

- Users can enter a model identifier manually when discovery is unavailable, incomplete, or does not include a model they know their key can access.
- Model discovery sends only the credentials and provider request needed to retrieve model metadata. It must not send career or opportunity content.
- Generated work records the provider and model used.
- A model that later becomes unavailable remains identified on existing work, but cannot be selected for new AI requests until it is available again.

## Rationale

Provider model catalogues change faster than an application-maintained list can reliably track. A cached list, explicit refresh, and occasional settings refresh keep choices current while avoiding provider calls during normal AI use.

## Related

- [[02 Shared Capabilities/AI and Prompts|AI and Prompts]]
- [[03 Decisions/Initial Technology Baseline|Initial Technology Baseline]]
