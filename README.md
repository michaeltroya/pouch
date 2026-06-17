# Pouch

Create one agent skill and share it across Codex, Cursor, and Claude.

Pouch is a small CLI for keeping agent skills in one canonical place. Instead of copying the same `SKILL.md` into every agent's folder, Pouch creates the real skill once and links each agent to it.

```txt
.agent-skills/review-helper/SKILL.md
.codex/skills/review-helper  -> ../../.agent-skills/review-helper
.cursor/skills/review-helper -> ../../.agent-skills/review-helper
.claude/skills/review-helper -> ../../.agent-skills/review-helper
```

## Why Pouch?

Agent skills are useful, but they tend to drift when each tool keeps its own copy.

Pouch gives you one source of truth:

- Create a skill once.
- Use it from multiple agents.
- Keep project-local skills inside the repo.
- Keep personal/global skills in your home directory.
- Avoid overwriting existing skills by accident.

Pouch is CLI-only. It does not expose a JavaScript API.

## Quick Start

Requires Node.js 22.13 or newer.

Run Pouch without installing it:

```sh
pnpm dlx pouch create
```

Or install it globally:

```sh
pnpm add --global pouch
pouch create
```

Using npm instead of pnpm:

```sh
npx pouch create
```

## Usage

Create a shared skill:

```sh
pouch create
```

Pouch will ask:

1. Skill name
2. Skill description
3. Where the canonical skill should live
4. Which agents should use it

You can choose a project-local skill:

```txt
./.agent-skills/<skill-name>
```

Or a global skill:

```txt
~/.agent-skills/<skill-name>
```

Example output:

```txt
review-helper
Canonical: /path/to/project/.agent-skills/review-helper
Codex: /path/to/project/.codex/skills/review-helper (created)
Cursor: /path/to/project/.cursor/skills/review-helper (created)
Claude: /path/to/project/.claude/skills/review-helper (created)
```

## What Pouch Creates

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
.claude/
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

## Supported Agents

| Agent  | Project-local skill directory | Global skill directory |
| ------ | ----------------------------- | ---------------------- |
| Codex  | `./.codex/skills`             | `~/.codex/skills`      |
| Cursor | `./.cursor/skills`            | `~/.cursor/skills`     |
| Claude | `./.claude/skills`            | `~/.claude/skills`     |

## Safety

Pouch is conservative with your files:

- It will not overwrite an existing canonical `SKILL.md`.
- It will not replace an existing non-symlink in an agent skill directory.
- It will not repoint an existing symlink that targets a different skill.
- If symlink creation fails partway through, it rolls back the skill and links it created during that run.

For project-local skills, Pouch creates relative symlinks so the links keep working if the project folder is moved.

On Windows, symlink creation may require Developer Mode or an elevated shell.

## Local Development

This repo uses pnpm.

Install dependencies:

```sh
pnpm install
```

Run the CLI from TypeScript:

```sh
pnpm dev -- create
```

Build the package:

```sh
pnpm build
```

Run checks and formatting:

```sh
pnpm check
pnpm lint
pnpm format
```

Tests are available through:

```sh
pnpm test
```

## Project Structure

```txt
src/
  index.ts              CLI entrypoint
  commands/
    create.ts           Prompt flow for `pouch create`
  lib/
    agents.ts           Supported agents and skill directory resolution
    fs.ts               Shared filesystem helpers
    paths.ts            Canonical skill paths and location schema
    skill.ts            Skill creation, symlink planning, and rollback
```

## Contributing

Issues and pull requests are welcome.

Before opening a PR, please run:

```sh
pnpm check
pnpm lint
pnpm format
```

If your change touches behavior, also run:

```sh
pnpm test
```

## License

MIT
