# Contributing

Thanks for your interest in contributing. This is a small open source project — PRs and issues are welcome.

## Ground rules

- Be respectful. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- One concern per PR. Keep changes focused.
- Open an issue before starting large refactors or new features so we can align on approach.

## Getting started

```bash
git clone https://github.com/koldFU5iON/currnt.git
cd currnt
npm install
cp .env.example .env.local   # fill in the required values
docker compose up -d
npm run db:reset
npm run dev
```

See [README.md](README.md) for full setup details.

## Making a change

1. Fork the repo and create a branch off `main`.
2. Make your changes.
3. Run the checks locally before pushing:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

4. Open a pull request. The CI suite runs automatically and must pass before merge.

## Commit style

Plain English, imperative mood, present tense:

- `add CV generation retry logic`
- `fix null pointer in profile snapshot`
- `remove unused import`

No ticket numbers or emoji in commit messages.

## Database migrations

If your change touches the Prisma schema, create a named migration:

```bash
npm run db:migrate   # prompts for a migration name
```

Never use `db:push` for schema changes — see the README for why.

## Reporting bugs

Open a GitHub issue using the **Bug report** template. Include:
- What you did
- What you expected
- What actually happened
- Relevant logs or screenshots

## Requesting features

Open a GitHub issue using the **Feature request** template.
