---
name: capture-job
description: Use when the user wants to save a job posting URL to their Resume dashboard for tracking — triggers on phrases like "capture this job", "save this job", "track this job", "add this to my applications", "save this for later", or when given a URL from job sites (LinkedIn jobs, Greenhouse, Lever, Workday, company careers pages). Posts to {{RESUME_URL}}/api/jobs/capture using the bearer token in $RSM_TOKEN.
---

# Capture Job

Submits a job posting URL to the Resume dashboard at `{{RESUME_URL}}/api/jobs/capture` for tracking. The endpoint extracts title, company, and other fields from the URL automatically.

## Auth setup (one-time)

The skill reads the bearer token from the `RSM_TOKEN` environment variable.

If `$RSM_TOKEN` is unset, the user needs to mint one:

1. Open `{{RESUME_URL}}/dashboard/settings/api-tokens`
2. Create a new token (shown only once)
3. Export it: `export RSM_TOKEN="rsm_..."` (and add to `~/.zshrc` / `~/.bashrc` for persistence)

If the token leaks, revoke it at the same dashboard page and mint a new one.

## How to call

Use `Bash` with `curl`. **Always include the `Authorization` header from `$RSM_TOKEN`**:

```bash
curl -sS -X POST {{RESUME_URL}}/api/jobs/capture \
  -H "Authorization: Bearer $RSM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"<JOB_URL>"}'
```

### Required body field

| Field | Type | Notes |
|---|---|---|
| `url` | string (URL) | The job posting URL. |

### Optional body fields

| Field | Type | Notes |
|---|---|---|
| `notes` | string (≤2000 chars) | Free-form context. Use when the user mentions where they saw the job or why it caught their eye. |
| `applicationSource` | `cold` \| `referral` \| `recruiter_outreach` | Defaults to `cold`. Set to `referral` if the user mentions being referred, or `recruiter_outreach` if a recruiter reached out. |
| `dedupeStrategy` | `return_existing` \| `create_anyway` | Defaults to `return_existing` — returns the existing record if a duplicate is detected. Set to `create_anyway` only when the user explicitly wants a duplicate. |

## Handling the response

The endpoint returns JSON with these fields:

```json
{
  "id": "cuid",
  "created": true,
  "title": "Staff Technical Program Manager",
  "company": "MongoDB",
  "reviewUrl": "{{RESUME_URL}}/dashboard/job-applications/view/cuid",
  "duplicate": { "isDuplicate": false },
  "extraction": { "fieldsExtracted": ["title", "company", "location", "jobNumber"] }
}
```

**Always report back to the user**:

- The job title + company (so they can confirm extraction worked)
- The `reviewUrl` (so they can open it to edit / mark applied)
- Whether it was newly created (`created: true`) or returned from dedup (`created: false`)
- If `duplicate.isDuplicate` is `true`, mention it explicitly — they may want to look at the existing entry

Example response to the user:

> Captured **Staff Technical Program Manager** at **MongoDB**. Open in dashboard: {{RESUME_URL}}/dashboard/job-applications/view/cuid

## Error handling

| Status | What it means | What to do |
|---|---|---|
| 201 | New job created | Report success + `reviewUrl`. |
| 200 | Existing job returned (dedup) | Report it was already saved + `reviewUrl`. |
| 400 | Bad request body (invalid URL, malformed JSON) | Tell the user the URL was rejected; ask for a valid one. |
| 401 | Missing / malformed / revoked token | Tell the user `$RSM_TOKEN` is invalid; point them at `/dashboard/settings/api-tokens` to remint. |
| 422 | URL was reachable but extraction couldn't get title/company | Tell the user the site format isn't recognized; suggest filing an issue with the URL so the extractor can be improved (see `src/modules/jobs/extract.ts` for supported sources). |

For non-2xx responses, surface the response body to the user so they can debug.

## Supported URL sources

The extractor handles, in priority order:

1. **LinkedIn** — `linkedin.com/jobs/view/...`
2. **Greenhouse direct** — `boards.greenhouse.io/{board}/jobs/{id}` and `job-boards.greenhouse.io/{board}/jobs/{id}`
3. **Greenhouse embedded** — wrapper sites like `mongodb.com/careers/jobs/{id}` that load Greenhouse client-side
4. **JSON-LD `JobPosting`** — Lever, Workday, Indeed, and many ATSs
5. **OpenGraph / meta fallback** — last-resort title-only extraction

If the URL doesn't match any of these, extraction will likely return 422.

## Examples

### Simplest: user pasted a URL

User: "save this https://www.mongodb.com/careers/jobs/7465124"

```bash
curl -sS -X POST {{RESUME_URL}}/api/jobs/capture \
  -H "Authorization: Bearer $RSM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.mongodb.com/careers/jobs/7465124"}'
```

### With referral context

User: "Alex referred me to this Stripe role: https://boards.greenhouse.io/stripe/jobs/5530229"

```bash
curl -sS -X POST {{RESUME_URL}}/api/jobs/capture \
  -H "Authorization: Bearer $RSM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://boards.greenhouse.io/stripe/jobs/5530229",
    "notes": "Referred by Alex",
    "applicationSource": "referral"
  }'
```

### Forced duplicate

User: "save this again even if it's a duplicate"

Add `"dedupeStrategy": "create_anyway"` to the body.
