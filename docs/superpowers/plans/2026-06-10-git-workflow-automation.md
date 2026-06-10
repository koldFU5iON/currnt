# Git Workflow Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce fetch-before-branch and rebase-before-push automatically so PRs never need rebasing after creation.

**Architecture:** Two enforcement points — a global Claude Code `PreToolUse` hook that intercepts `git push` bash calls and rebases first, plus a `CLAUDE.md` rule that instructs the AI to always cut branches from `origin/main`.

**Tech Stack:** Claude Code hooks (`~/.claude/settings.json`), shell script, CLAUDE.md

---

### Task 1: Add PreToolUse hook to ~/.claude/settings.json

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Add the `hooks` key to settings.json**

The current file has no `hooks` key. Add it alongside the existing keys. The final file should look exactly like this:

```json
{
  "enabledPlugins": {
    "frontend-design@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "code-simplifier@claude-plugins-official": true,
    "github@claude-plugins-official": true,
    "claude-md-management@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "security-guidance@claude-plugins-official": true,
    "commit-commands@claude-plugins-official": true,
    "claude-code-setup@claude-plugins-official": true,
    "pr-review-toolkit@claude-plugins-official": true,
    "vercel@claude-plugins-official": true,
    "playwright@claude-plugins-official": false,
    "feature-dev@claude-plugins-official": true,
    "prisma@claude-plugins-official": true,
    "superpowers@claude-plugins-official": true,
    "explanatory-output-style@claude-plugins-official": true
  },
  "alwaysThinkingEnabled": true,
  "effortLevel": "high",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'if echo \"$CLAUDE_TOOL_INPUT\" | grep -q \"git push\"; then BRANCH=$(git branch --show-current 2>/dev/null); if [ -n \"$BRANCH\" ] && [ \"$BRANCH\" != \"main\" ] && [ \"$BRANCH\" != \"master\" ]; then git fetch origin && git rebase origin/main; fi; fi'"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify the JSON is valid**

Run:
```bash
python3 -c "import json; json.load(open('/home/devons/.claude/settings.json')); print('valid')"
```
Expected: `valid`

- [ ] **Step 3: Smoke-test the hook logic in isolation**

Run the hook command manually, simulating a non-push bash call (should exit 0 silently):
```bash
CLAUDE_TOOL_INPUT='{"command":"npm run dev"}' bash -c 'if echo "$CLAUDE_TOOL_INPUT" | grep -q "git push"; then BRANCH=$(git branch --show-current 2>/dev/null); if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then git fetch origin && git rebase origin/main; fi; fi'; echo "exit: $?"
```
Expected output: `exit: 0`

Run again simulating a push on a feature branch (should fetch+rebase):
```bash
CLAUDE_TOOL_INPUT='{"command":"git push origin feat/test"}' bash -c 'if echo "$CLAUDE_TOOL_INPUT" | grep -q "git push"; then BRANCH=$(git branch --show-current 2>/dev/null); if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then git fetch origin && git rebase origin/main; fi; fi'; echo "exit: $?"
```
Expected output: fetch + rebase output, then `exit: 0` (or non-zero if rebase conflicts exist)

---

### Task 2: Add Git workflow section to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (project root — `/home/devons/code/personal/resume/CLAUDE.md`)

- [ ] **Step 1: Append the Git workflow section**

`CLAUDE.md` currently contains only `@AGENTS.md`. The final file should look exactly like this (two blank lines between the import and the new section):

    @AGENTS.md

    ## Git workflow

    Before creating any new branch, always fetch first and cut from `origin/main`:

        git fetch origin
        git switch -c feat/<name> origin/main

    Never branch from local `main` — it may be stale. This applies whether starting
    a new feature, a bugfix, or any other work that needs its own branch.

- [ ] **Step 2: Commit the CLAUDE.md change**

```bash
git add CLAUDE.md
git commit -m "chore: enforce fetch-before-branch in CLAUDE.md git workflow rule"
```

---

### Task 3: End-to-end verification

- [ ] **Step 1: Confirm hook fires on next push**

The hook will run automatically the next time the AI calls `git push` via the Bash tool. After the plan is implemented, trigger a push in a new session and confirm in the terminal output that `git fetch origin` and `git rebase origin/main` run before the push completes.

- [ ] **Step 2: Confirm hook is skipped on main**

Temporarily switch to main (`git checkout main`) and verify the hook skips the rebase step:
```bash
CLAUDE_TOOL_INPUT='{"command":"git push origin main"}' bash -c 'if echo "$CLAUDE_TOOL_INPUT" | grep -q "git push"; then BRANCH=$(git branch --show-current 2>/dev/null); if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then git fetch origin && git rebase origin/main; fi; fi'; echo "exit: $?"
```
Expected: exits 0 with no fetch/rebase output (branch is `main`, inner `if` is skipped).

Switch back to your feature branch when done:
```bash
git checkout feat/ai-career-coach-bot
```
