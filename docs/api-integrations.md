# API integration recipes

Copy-pasteable recipes for calling `POST /api/jobs/capture` from common surfaces. The technical contract lives in [`docs/api-jobs-capture.md`](./api-jobs-capture.md); this file is the "how do I wire this into my tool" layer.

> **Security**: tokens look like `rsm_<43 chars>` and are shown **once** at creation. Store them in a secrets manager, env var, or password manager. **If a token leaks, revoke it immediately** at `/dashboard/settings/api-tokens` and mint a new one.

## Get a token

1. Sign in at `https://resume.devonstanton.com/dashboard`
2. Open `https://resume.devonstanton.com/dashboard/settings/api-tokens`
3. Mint a token — save the value somewhere safe (it won't be shown again)
4. Export it for shell use:

```bash
export RSM_TOKEN="rsm_..."
# Add to ~/.zshrc or ~/.bashrc to persist across sessions.
```

---

## Shell / curl

The fastest path. Drop this function into `~/.zshrc` or `~/.bashrc`:

```bash
# Usage:
#   rsm-capture <url> [notes]
#   rsm-capture https://boards.greenhouse.io/stripe/jobs/5530229
#   rsm-capture https://… "referred by Alex"
rsm-capture() {
  local url="${1:?usage: rsm-capture <url> [notes]}"
  local notes="${2:-}"
  local body
  if [[ -n "$notes" ]]; then
    body=$(jq -nc --arg u "$url" --arg n "$notes" '{url:$u, notes:$n}')
  else
    body=$(jq -nc --arg u "$url" '{url:$u}')
  fi
  curl -sS -X POST https://resume.devonstanton.com/api/jobs/capture \
    -H "Authorization: Bearer ${RSM_TOKEN:?set RSM_TOKEN env var first}" \
    -H "Content-Type: application/json" \
    -d "$body" \
    | jq '{title, company, created, reviewUrl, duplicate}'
}
```

After capture, open the result in your browser:

```bash
rsm-capture "https://..." | jq -r .reviewUrl | xargs xdg-open  # Linux
rsm-capture "https://..." | jq -r .reviewUrl | xargs open      # macOS
```

---

## Claude Code skill

Install once; then any Claude Code session can capture jobs by saying "save this job" with a URL.

### Install

```bash
# From the resume repo:
mkdir -p ~/.claude/skills/capture-job
cp docs/integrations/claude-code/SKILL.md ~/.claude/skills/capture-job/SKILL.md

# Or symlink so updates to the repo propagate automatically:
ln -s "$(pwd)/docs/integrations/claude-code/SKILL.md" ~/.claude/skills/capture-job/SKILL.md
```

Make sure `$RSM_TOKEN` is exported in your shell config so Claude Code sessions inherit it.

### Use

In any Claude Code session:

> User: "save this job https://www.mongodb.com/careers/jobs/7465124"

Claude will recognize the trigger phrase + URL, invoke the skill, and POST to the endpoint with `$RSM_TOKEN`. It then reports back the extracted title, company, and `reviewUrl`.

The full skill source lives in [`docs/integrations/claude-code/SKILL.md`](./integrations/claude-code/SKILL.md) — same file that gets copied to `~/.claude/skills/capture-job/`.

---

## Browser bookmarklet

Capture the current tab with a single click. The token is embedded in the bookmarklet URL — **anyone with access to your browser can see it**, so use this only on a trusted machine, and revoke + remint if the device is ever shared.

### Install

1. Copy the snippet below
2. Replace `rsm_PASTE_TOKEN_HERE` with your actual token
3. Right-click the bookmarks bar → Add page → set URL to the snippet, name it "Capture job"

```js
javascript:(()=>{const t='rsm_PASTE_TOKEN_HERE';fetch('https://resume.devonstanton.com/api/jobs/capture',{method:'POST',headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({url:location.href})}).then(r=>r.json()).then(d=>{if(d.reviewUrl){window.open(d.reviewUrl,'_blank')}else{alert('Capture failed: '+JSON.stringify(d))}}).catch(e=>alert('Network error: '+e.message))})();
```

### Use

Open any job posting → click the bookmarklet → a new tab opens to the dashboard view of the captured job. If extraction fails (422 from a site we don't yet handle), an `alert()` shows the error body.

---

## Coming soon (follow-up issue)

These surfaces are TODO — file an issue if you need one and we'll prioritize:

- **Anthropic Claude API tool definition** — JSON tool schema + Python/TS example loop wiring it into `client.messages.create(...)`
- **OpenAI function calling** — function definition + chat completions loop
- **MCP server** — minimal MCP server exposing this endpoint as a tool any MCP-aware client can use

The contract is stable, so building any of these against the existing spec is straightforward.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` | `RSM_TOKEN` unset, malformed, or revoked | Mint a new token, re-export `RSM_TOKEN`. |
| `400 Bad Request` | Invalid URL or malformed JSON body | Check the URL; ensure body matches the schema in `docs/api-jobs-capture.md`. |
| `422 Unprocessable Entity` | Extractor couldn't get title/company from this site | File an issue with the URL — `src/modules/jobs/extract.ts` is where new site templates land. |
| Bookmarklet does nothing | Browser stripping the `javascript:` prefix when pasting | Re-paste the snippet directly into the bookmark URL field, not the page content. |
| Skill never triggers in Claude Code | Skill file in wrong location, or trigger phrase didn't match | Verify `~/.claude/skills/capture-job/SKILL.md` exists; try a more explicit phrase like "use the capture-job skill on this URL". |
