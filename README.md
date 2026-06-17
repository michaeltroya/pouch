# Pouch

Create once. Carry to every agent.

Create one shared agent skill and link it into the agent directories that should use it.

`pouch` is a small CLI for keeping agent skills in one canonical place instead of copying the same `SKILL.md` across Codex, Cursor, and Claude. It creates a canonical skill folder, writes the first `SKILL.md`, and adds symlinks into the selected agents' skill directories.

`pouch` is CLI-only. It does not expose a JavaScript API.

## What it does

- Prompts for a skill name and description.
- Converts the name into a filesystem-safe slug.
- Creates a canonical skill at either:
  - `./.agent-skills/<skill-name>` for project-local skills
  - `~/.agent-skills/<skill-name>` for global skills
- Writes `SKILL.md` with frontmatter and starter content.
- Symlinks the skill into any selected agent directories:
  - Codex: `.codex/skills/<skill-name>` or `~/.codex/skills/<skill-name>`
  - Cursor: `.cursor/skills/<skill-name>` or `~/.cursor/skills/<skill-name>`
  - Claude: `.claude/skills/<skill-name>` or `~/.claude/skills/<skill-name>`

## Install

Requires Node.js 22.13 or newer.

Run without installing:

```sh
npx pouch create
```

Or install globally:

```sh
npm install --global pouch
pouch create
```

With pnpm:

```sh
pnpm dlx pouch create
```

For local development in this repo:

```sh
pnpm install
pnpm build
```

During local development, run the CLI directly from TypeScript:

```sh
pnpm dev -- create
```

After building, the package exposes a `pouch` binary:

```sh
pouch create
```

## Usage

Run:

```sh
pouch create
```

The CLI will ask:

1. Skill name
2. Skill description
3. Whether the canonical skill should live in the current project or your home directory
4. Which agents should use the skill

Example output:

```txt
review-helper
Canonical: /path/to/project/.agent-skills/review-helper
Codex: /path/to/project/.codex/skills/review-helper (created)
Cursor: /path/to/project/.cursor/skills/review-helper (created)
```

## Example

Creating a project-local skill named `Review Helper` produces:

```txt
.agent-skills/
  review-helper/
    SKILL.md
.codex/
  skills/
    review-helper -> ../../.agent-skills/review-helper
.cursor/
  skills/
    review-helper -> ../../.agent-skills/review-helper
```

The generated `SKILL.md` starts like this:

```md
---
name: review-helper
description: 'Helps agents review code consistently.'
---

# Review Helper

Helps agents review code consistently.
```

## Safety behavior

`pouch` is conservative about existing files:

- It validates the canonical skill path before planning agent symlinks.
- It will not overwrite an existing canonical `SKILL.md`.
- It will not replace an existing non-symlink in an agent skill directory.
- It will not repoint an existing symlink that targets a different skill.
- If symlink creation fails partway through, it rolls back the skill and links it created during that run.

For project-local skills, `pouch` creates relative symlinks so the links keep working if the project folder is moved. On Windows, symlink creation may require Developer Mode or an elevated shell, depending on your system configuration.

## Project structure

```txt
src/
  index.ts              CLI entrypoint
  commands/
    create.ts           Prompt flow for `pouch create`
  lib/
    agents.ts           Supported agents and skill directory resolution
    fs.ts                 Shared filesystem helpers
    paths.ts              Canonical skill paths and location schema
    skill.ts              Skill creation, symlink planning, and rollback
```

The command layer handles prompts and user-facing output. The `lib/` modules own path resolution, agent configuration, and filesystem safety checks.

## Supported agents

| Agent  | Project-local skill directory | Global skill directory |
| ------ | ----------------------------- | ---------------------- |
| Codex  | `./.codex/skills`             | `~/.codex/skills`      |
| Cursor | `./.cursor/skills`            | `~/.cursor/skills`     |
| Claude | `./.claude/skills`            | `~/.claude/skills`     |

## Development

```sh
pnpm dev -- create
pnpm build
pnpm check
pnpm lint
pnpm format
```

Tests are available through:

```sh
pnpm test
```
