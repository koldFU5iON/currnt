---
name: capture-job
description: Save a job posting URL to the Resume dashboard for tracking. Use when the user wants to capture, save, or track a job posting they found online — especially when they paste a URL from LinkedIn jobs, Greenhouse, Lever, Workday, or company careers pages.
version: 1.0.0
metadata:
  hermes:
    tags: [job-search, productivity, resume, http]
    category: job-search
    config:
      - key: resume.bearer_token
        description: "Bearer token for the Resume capture API"
        prompt: "Paste your Resume bearer token (starts with rsm_). Mint one at the URL below if you don't have one yet:"
        url: "{{RESUME_URL}}/dashboard/settings/api-tokens"
---

# Capture Job

Submits a job posting URL to the user's Resume dashboard at `{{RESUME_URL}}/api/jobs/capture`. The endpoint extracts title, company, location, and other fields from the URL automatically and returns a `reviewUrl` the user can open to confirm or edit.

## When to Use

Trigger on phrases like:

- "save this job"
- "capture this job"
- "track this job"
- "add this to my applications"
- "save this for later"

Or when the user provides a URL that looks like a job posting:

- `linkedin.com/jobs/view/...`
- `boards.greenhouse.io/<board>/jobs/<id>`
- `<company>.com/careers/jobs/<id>` (many use Greenhouse under the hood)
- Lever, Workday, Indeed, and other ATS-hosted postings

**Do not use** for:
- General web pages or articles
- Job *listing* pages (search results, company career indexes) — only individual postings
- LinkedIn profiles, company pages, or non-job URLs

## Procedure

1. **Read auth**: Get the bearer token from `skills.config.resume.bearer_token`. If unset, Hermes will have prompted on first invocation; surface any error clearly.

2. **Build the request**:
   - Method: `POST`
   - URL: `{{RESUME_URL}}/api/jobs/capture`
   - Headers:
     - `Authorization: Bearer <token>`
     - `Content-Type: application/json`
   - Body (JSON):
     - `url` (required, string) — the job posting URL
     - `notes` (optional, string ≤2000 chars) — context like "saw on LinkedIn" or "referred by Alex"
     - `applicationSource` (optional) — one of `cold`, `referral`, `recruiter_outreach`. Default `cold`. Set `referral` if the user mentions being referred; `recruiter_outreach` if a recruiter reached out.
     - `dedupeStrategy` (optional) — `return_existing` (default) or `create_anyway`. Only use `create_anyway` if the user explicitly wants a duplicate.

3. **Send the request** using Hermes' HTTP/fetch tool primitive.

4. **Parse the response** — JSON shape:
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

5. **Report back to the user**:
   - Extracted title + company (confirms the extractor worked)
   - The `reviewUrl` (so they can open / edit / mark applied)
   - Whether it was newly created (`created: true`) or returned from dedup (`created: false`)
   - If `duplicate.isDuplicate` is `true`, mention it — they may want to look at the existing entry

   Example response to the user:
   > Captured **Staff Technical Program Manager** at **MongoDB**. Review at: {{RESUME_URL}}/dashboard/job-applications/view/cuid

## Pitfalls

| Status | Meaning | Recovery |
|---|---|---|
| 401 | Token missing, malformed, or revoked | Tell user the token is invalid; point at `{{RESUME_URL}}/dashboard/settings/api-tokens` to remint. They can then re-run `hermes config skills.config.resume.bearer_token` (or whatever Hermes' reconfig command is) to update. |
| 400 | Invalid URL or malformed JSON body | The URL was rejected by schema validation. Ask the user for a valid URL. |
| 422 | Extractor couldn't get title/company from the URL | Site format isn't yet supported. Tell the user; suggest they file an issue with the URL so the extractor can be improved. Supported sources are listed in the When to Use section. |
| Network error | Connection failed | Surface the underlying error; retry once if the cause is transient. |

**Common mistake**: forgetting `Content-Type: application/json` — the endpoint rejects requests without it.

**Don't**: log or echo the bearer token in any response back to the user. It's a credential.

## Verification

After a successful call:

- Response status is `201` (new) or `200` (existing dedup)
- Response body contains a `reviewUrl` matching the pattern `{{RESUME_URL}}/dashboard/job-applications/view/<cuid>`
- (Optional) GET the `reviewUrl` to confirm the row is readable — but this requires session auth, not the bearer token, so usually skip this and just trust the response.

If the user reports the job didn't appear in their dashboard later, possible causes:
- They're signed into a different account than the token belongs to (tokens are profile-scoped)
- The token was revoked between mint and use
