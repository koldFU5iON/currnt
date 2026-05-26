# Job Capture API

Authenticated endpoint for submitting a job URL from outside the dashboard —
agents (Hermes), bookmarklets, browser extensions, CLI scripts, or anything
else that can hit an HTTP endpoint.

## Authentication

Bearer token in the `Authorization` header. Tokens are minted at
`/dashboard/settings/api-tokens` and look like:

```
rsm_<43 random chars>
```

The token value is shown once at creation. Lose it → revoke and mint a new one.

## Endpoint

```
POST /api/jobs/capture
Content-Type: application/json
Authorization: Bearer rsm_…
```

### Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string (URL) | yes | The job posting URL to extract from. |
| `notes` | string (≤2000) | no | Free-form context (e.g. "saw on LinkedIn"). |
| `applicationSource` | `cold` \| `referral` \| `recruiter_outreach` | no | Defaults to `cold`. |
| `dedupeStrategy` | `return_existing` \| `create_anyway` | no | Defaults to `return_existing`. |

### Response

```json
{
  "id": "cuid",
  "created": true,
  "title": "Staff Technical Program Manager",
  "company": "MongoDB",
  "reviewUrl": "https://resume.devonstanton.com/dashboard/job-applications/view/cuid",
  "duplicate": {
    "isDuplicate": false
  },
  "extraction": {
    "fieldsExtracted": ["title", "company", "location", "jobNumber", "jobDescription", "datePublished"]
  }
}
```

| Field | Meaning |
|---|---|
| `id` | The job's ID, whether newly created or returned from dedup. |
| `created` | `true` when a new row was written; `false` when an existing one was returned. |
| `reviewUrl` | Direct link to the dashboard detail view. |
| `duplicate.isDuplicate` | `true` when the extractor's title/company/jobNumber matched an existing job for this profile. Detection runs even when `created: true` (via `create_anyway`). |
| `duplicate.existingId` | The matched job's ID (only present when `isDuplicate: true`). |
| `extraction.fieldsExtracted` | Which fields the extractor managed to populate from the URL. Useful for agents to know what's missing. |

### Status codes

| Code | Meaning |
|---|---|
| 201 | New job created (`created: true`). |
| 200 | Existing job returned (`created: false`). |
| 400 | Body failed schema validation (missing/bad `url`, malformed JSON). |
| 401 | Missing, malformed, or revoked Bearer token. |
| 422 | URL was reachable but extraction couldn't get the bare minimum (title/company). |

Captured jobs always land at `status: "not started"` — direct intake never
auto-marks a job as applied.

## Examples

### Simplest case

```bash
curl -X POST https://resume.devonstanton.com/api/jobs/capture \
  -H "Authorization: Bearer $RSM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.mongodb.com/careers/jobs/7465124"}'
```

### With context and override

```bash
curl -X POST https://resume.devonstanton.com/api/jobs/capture \
  -H "Authorization: Bearer $RSM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://boards.greenhouse.io/stripe/jobs/5530229",
    "notes": "Referred by Alex on 2026-05-26",
    "applicationSource": "referral"
  }'
```

### Force-create even when a duplicate exists

```bash
curl -X POST https://resume.devonstanton.com/api/jobs/capture \
  -H "Authorization: Bearer $RSM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://...",
    "dedupeStrategy": "create_anyway"
  }'
```

## Supported URL sources

The extractor handles, in order:

1. **LinkedIn** — `linkedin.com/jobs/view/...` (via the crawler-friendly guest API)
2. **Greenhouse direct** — `boards.greenhouse.io/{board}/jobs/{id}` and `job-boards.greenhouse.io/{board}/jobs/{id}`
3. **Greenhouse embedded** — wrapper sites like `mongodb.com/careers/jobs/{id}` that load Greenhouse client-side
4. **JSON-LD `JobPosting`** — Lever, Workday, Indeed, and many ATSs
5. **OpenGraph / meta fallback** — last-resort title-only extraction

If you hit a site that consistently fails, file an issue with the URL — the
extraction module in `src/modules/jobs/extract.ts` is the place to add a
template.
