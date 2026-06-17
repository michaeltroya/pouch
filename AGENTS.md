# AGENTS.md

## Project

`pouch` is a small pnpm/TypeScript CLI for creating shared agent skills and symlinking them into Codex, Cursor, and Claude skill directories. It is CLI-only; there is no public JavaScript API.

Key paths:

- `src/index.ts`: CLI entrypoint.
- `src/commands/create.ts`: interactive `pouch create` prompt flow.
- `src/lib/`: path resolution, agent definitions, filesystem safety, skill creation, symlink planning, and rollback logic.
- `src/**/*.test.ts`: Vitest coverage for command and library behavior.

## Commands

- Install dependencies: `pnpm install`
- Run the CLI locally: `pnpm dev -- create`
- Build package output: `pnpm build`
- Type/lint/check: `pnpm check`, `pnpm lint`
- Format: `pnpm format`
- Tests: `pnpm test`

Do not run tests unless the user explicitly asks. If you think tests are needed, say which command you would run and wait for approval.

## Code Style

- Use TypeScript ESM and keep imports consistent with the existing `@/` alias and `.js` import suffixes.
- Prefer small, explicit functions in `src/lib/` and keep prompt/UI behavior in `src/commands/`.
- Preserve the conservative filesystem behavior: do not overwrite existing skills, non-symlinks, or symlinks pointing somewhere else.
- Keep user-facing CLI messages short and clear.
- Follow the existing formatter/linter output instead of hand-tuning style.

## Change Guidelines

- Read the relevant module before editing; this repo is small enough that targeted context is cheap.
- Keep changes narrow and avoid unrelated README, lockfile, or generated `dist/` churn unless the task requires it.
- When changing skill creation or symlink behavior, consider rollback and partial-failure paths.
- Do not modify files outside this repository unless the user explicitly asks.

## Before Finishing

- Summarize what changed and mention any commands run.
- If you did not run checks because tests were not requested, say so plainly.
