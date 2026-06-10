# Git Workflow Automation Design

**Date:** 2026-06-10
**Status:** Approved

## Problem

PRs consistently need updating because:
1. Branches are cut from stale local `main` (main had moved since last fetch)
2. No rebase happens before push, so the PR base diverges from origin/main

## Solution: Option A — PreToolUse hook + CLAUDE.md rule

Two enforcement points, one for each gap.

## Components

### 1. PreToolUse hook (push side)

A global Claude Code hook in `~/.claude/settings.json` that fires before every `Bash` tool call. When the command contains `git push` and the current branch is not `main` or `master`, it runs:

```bash
git fetch origin && git rebase origin/main
```

If the rebase succeeds, the push proceeds normally. If there are conflicts, the hook exits non-zero, the push is blocked, and the AI surfaces the conflict for manual resolution.

The hook uses an `if/fi` guard so non-push bash calls always exit 0, while rebase failures on push calls correctly exit non-zero and block the push.

**Scope:** Global (`~/.claude/settings.json`) — applies to this repo and all future projects.

### 2. CLAUDE.md rule (branch creation side)

A new "Git workflow" section in the project-level `CLAUDE.md` that instructs the AI to always fetch and cut from `origin/main` before creating any branch:

```bash
git fetch origin
git switch -c feat/<name> origin/main
```

This is a standing instruction read at the start of every session. It is not mechanically enforced, but is always in context.

**Scope:** Project-level (`CLAUDE.md`) — scoped to this repo.

## Data flow

```
Start new work
  → AI reads CLAUDE.md rule
  → git fetch origin && git switch -c feat/name origin/main
  → [develop]

Ready to push
  → AI calls Bash("git push ...")
  → PreToolUse hook fires
  → git fetch origin && git rebase origin/main
    → success: push proceeds
    → conflict: hook blocks push, AI surfaces conflict
```

## Error handling

- **Rebase conflict on push:** Hook exits non-zero, push is blocked. AI must resolve the conflict (or ask the user to) before retrying the push. This is the correct behavior — the conflict needs resolution regardless.
- **Fetch failure (no network):** Hook exits non-zero, push is blocked. AI surfaces the error.
- **Pushing to main/master:** Hook skips the fetch+rebase (branch name check). No change to the main-branch push flow.

## Files to change

1. `~/.claude/settings.json` — add `PreToolUse` hook entry
2. `CLAUDE.md` (project root) — add "Git workflow" section

## Out of scope

- No changes to the `commit-push-pr` or `commit` plugin skills
- No new slash commands or skills
- Does not cover `git push --force` scenarios (user should be explicit about force pushes)
