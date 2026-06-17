---
name: pouch-maintainer
description: 'Use when working on the pouch TypeScript CLI, especially changes to skill creation, canonical skill paths, agent skill directory resolution, symlink planning, rollback behavior, CLI prompts, packaging, README usage, or repository maintenance. Preserve conservative filesystem safety and do not run tests unless the user explicitly asks.'
---

# Pouch Maintainer

## Start Here

Read the relevant source before editing. Pouch is small, so targeted context is cheap:

- `src/index.ts`: CLI entrypoint.
- `src/commands/create.ts`: interactive `pouch create` flow.
- `src/lib/agents.ts`: supported agents and skill directory resolution.
- `src/lib/paths.ts`: project vs home canonical roots.
- `src/lib/skill.ts`: skill slugging, `SKILL.md` creation, symlink planning, rollback.
- `src/lib/fs.ts`: filesystem helpers.
- `README.md`: user-facing usage and safety promises.

## Project Rules

- Treat pouch as CLI-only. Do not add or document a public JavaScript API.
- Keep TypeScript ESM imports consistent with the repo, including `@/` aliases and `.js` suffixes.
- Keep prompt/UI behavior in `src/commands/`; keep filesystem and planning behavior in `src/lib/`.
- Preserve short, clear CLI messages.
- Avoid unrelated README, lockfile, generated `dist/`, or formatting churn.
- Do not run tests unless the user explicitly asks. If tests would help, name the exact command and wait.

## Filesystem Safety

Preserve pouch's conservative behavior:

- Do not overwrite an existing canonical `SKILL.md`.
- Do not replace existing non-symlinks in agent skill directories.
- Do not repoint symlinks that already target another skill.
- Keep project-local symlinks relative so moved project folders keep working.
- Consider rollback whenever skill creation or symlink creation can partially fail.
- When changing path logic, account for both project-local and home-directory skills.

## Common Workflows

When changing `pouch create`:

1. Read `src/commands/create.ts`, `src/lib/skill.ts`, `src/lib/agents.ts`, and `src/lib/paths.ts`.
2. Keep validation close to user input, but keep reusable business rules in `src/lib/`.
3. Check cancellation, empty input, duplicate agent selection, existing files, and partial-failure behavior.
4. Update README examples only when the user-facing behavior changes.

When changing package usage or install instructions:

1. Verify whether the package is actually published before recommending `pnpm dlx pouch create`, `npx pouch create`, or `pouch create`.
2. For local development, prefer `pnpm dev -- create`.
3. Remember the package requires Node `>=22.13.0`.

## Verification

Do not run `pnpm test` unless the user explicitly asks.

Use lower-blast-radius checks when appropriate and allowed by the user, such as:

- `pnpm check` for type and project checks.
- `pnpm lint` for linting.
- `pnpm build` for package output.

If no checks are run, say so plainly in the final response.
