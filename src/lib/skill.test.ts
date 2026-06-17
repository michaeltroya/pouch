import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { getAgentsById, type AgentDefinition } from '@/lib/agents.js'
import { createSkill, toSkillSlug } from '@/lib/skill.js'

const originalCwd = process.cwd()

let tempRoot: string
let projectRoot: string

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pouch-'))
  process.chdir(tempRoot)
  projectRoot = process.cwd()
})

afterEach(async () => {
  process.chdir(originalCwd)
  vi.restoreAllMocks()
  await fs.remove(tempRoot)
})

describe('toSkillSlug', () => {
  it('normalizes names into filesystem-safe skill slugs', () => {
    expect(toSkillSlug(' Test Skill_name!! ')).toBe('test-skill-name')
  })
})

describe('createSkill', () => {
  it('creates a project-scoped canonical skill and selected agent symlinks', async () => {
    const agents = getAgentsById(['codex', 'cursor'], 'project')

    const result = await createSkill({
      name: 'Testing Skill',
      description: 'Checks local skill behavior.',
      location: 'project',
      agents,
    })

    expect(result.canonicalPath).toBe(path.join(projectRoot, '.agents', 'skills', 'testing-skill'))
    await expect(fs.readFile(result.skillFilePath, 'utf8')).resolves.toContain(
      'description: "Checks local skill behavior."',
    )

    await expect(
      fs.realpath(path.join(projectRoot, '.codex', 'skills', 'testing-skill')),
    ).resolves.toBe(result.canonicalPath)
    await expect(
      fs.readlink(path.join(projectRoot, '.codex', 'skills', 'testing-skill')),
    ).resolves.toBe(path.join('..', '..', '.agents', 'skills', 'testing-skill'))
    await expect(
      fs.realpath(path.join(projectRoot, '.cursor', 'skills', 'testing-skill')),
    ).resolves.toBe(result.canonicalPath)
    await expect(
      fs.pathExists(path.join(projectRoot, '.claude', 'skills', 'testing-skill')),
    ).resolves.toBe(false)
  })

  it('creates a home-scoped canonical skill and home agent symlinks', async () => {
    const fakeHome = path.join(projectRoot, 'home')
    vi.spyOn(os, 'homedir').mockReturnValue(fakeHome)

    const agents = getAgentsById(['claude'], 'home')

    const result = await createSkill({
      name: 'Home Skill',
      description: 'Lives in the fake home directory.',
      location: 'home',
      agents,
    })

    expect(result.canonicalPath).toBe(path.join(fakeHome, '.agents', 'skills', 'home-skill'))
    await expect(fs.realpath(path.join(fakeHome, '.claude', 'skills', 'home-skill'))).resolves.toBe(
      result.canonicalPath,
    )
  })

  it('rejects names that do not produce a slug', async () => {
    await expect(
      createSkill({
        name: '!!!',
        description: 'No usable slug.',
        location: 'project',
        agents: [],
      }),
    ).rejects.toThrow('at least one letter or number')
  })

  it('refuses to overwrite an existing canonical SKILL.md', async () => {
    const skillFile = path.join(projectRoot, '.agents', 'skills', 'testing', 'SKILL.md')
    await fs.outputFile(skillFile, 'existing')

    await expect(
      createSkill({
        name: 'testing',
        description: 'Would overwrite.',
        location: 'project',
        agents: getAgentsById(['codex'], 'project'),
      }),
    ).rejects.toThrow('already exists')

    await expect(
      fs.pathExists(path.join(projectRoot, '.codex', 'skills', 'testing')),
    ).resolves.toBe(false)
  })

  it('refuses to write into a non-empty canonical folder without SKILL.md', async () => {
    await fs.outputFile(
      path.join(projectRoot, '.agents', 'skills', 'testing', 'notes.txt'),
      'keep me',
    )

    await expect(
      createSkill({
        name: 'testing',
        description: 'Would mix files.',
        location: 'project',
        agents: [],
      }),
    ).rejects.toThrow('already exists and is not empty')
  })

  it('writes SKILL.md into an existing empty canonical folder', async () => {
    const canonicalPath = path.join(projectRoot, '.agents', 'skills', 'testing')
    await fs.ensureDir(canonicalPath)

    const result = await createSkill({
      name: 'testing',
      description: 'Uses an empty existing folder.',
      location: 'project',
      agents: [],
    })

    expect(result.canonicalPath).toBe(canonicalPath)
    await expect(fs.pathExists(path.join(canonicalPath, 'SKILL.md'))).resolves.toBe(true)
  })

  it('refuses when the canonical parent path is a file', async () => {
    await fs.outputFile(path.join(projectRoot, '.agents'), 'not a directory')

    await expect(
      createSkill({
        name: 'testing',
        description: 'Cannot create under a file.',
        location: 'project',
        agents: [],
      }),
    ).rejects.toThrow('not a directory')
  })

  it('refuses to replace a real folder in an agent skill directory', async () => {
    await fs.ensureDir(path.join(projectRoot, '.codex', 'skills', 'testing'))

    await expect(
      createSkill({
        name: 'testing',
        description: 'Would replace a folder.',
        location: 'project',
        agents: getAgentsById(['codex'], 'project'),
      }),
    ).rejects.toThrow('is not a symlink')

    await expect(
      fs.pathExists(path.join(projectRoot, '.agents', 'skills', 'testing', 'SKILL.md')),
    ).resolves.toBe(false)
  })

  it('refuses when an agent parent path is a file', async () => {
    await fs.outputFile(path.join(projectRoot, '.codex'), 'not a directory')

    await expect(
      createSkill({
        name: 'testing',
        description: 'Cannot link under a file.',
        location: 'project',
        agents: getAgentsById(['codex'], 'project'),
      }),
    ).rejects.toThrow('not a directory')

    await expect(
      fs.pathExists(path.join(projectRoot, '.agents', 'skills', 'testing', 'SKILL.md')),
    ).resolves.toBe(false)
  })

  it('reuses an existing symlink when it already points at the canonical skill', async () => {
    const canonicalPath = path.join(projectRoot, '.agents', 'skills', 'testing')
    const linkPath = path.join(projectRoot, '.codex', 'skills', 'testing')
    await fs.ensureDir(path.dirname(linkPath))
    await fs.symlink(canonicalPath, linkPath, 'dir')

    const result = await createSkill({
      name: 'testing',
      description: 'Uses existing link.',
      location: 'project',
      agents: getAgentsById(['codex'], 'project'),
    })

    expect(result.links).toMatchObject([{ status: 'existing', linkPath }])
  })

  it('deduplicates repeated agent ids before linking', async () => {
    const agents = getAgentsById(['codex', 'codex'], 'project')

    const result = await createSkill({
      name: 'testing',
      description: 'Links once.',
      location: 'project',
      agents,
    })

    expect(result.links).toHaveLength(1)
    expect(result.links[0]?.linkPath).toBe(path.join(projectRoot, '.codex', 'skills', 'testing'))
  })

  it('deduplicates duplicate agent entries passed directly to createSkill', async () => {
    const agent = getAgentsById(['codex'], 'project')[0]

    if (!agent) {
      throw new Error('Expected codex agent definition')
    }

    const result = await createSkill({
      name: 'testing',
      description: 'Links once.',
      location: 'project',
      agents: [agent, agent],
    })

    expect(result.links).toHaveLength(1)
    expect(result.links[0]?.linkPath).toBe(path.join(projectRoot, '.codex', 'skills', 'testing'))
  })

  it('refuses an existing symlink that points somewhere else', async () => {
    const otherTarget = path.join(projectRoot, 'elsewhere')
    const linkPath = path.join(projectRoot, '.codex', 'skills', 'testing')
    await fs.ensureDir(path.dirname(linkPath))
    await fs.symlink(otherTarget, linkPath, 'dir')

    await expect(
      createSkill({
        name: 'testing',
        description: 'Wrong link target.',
        location: 'project',
        agents: getAgentsById(['codex'], 'project'),
      }),
    ).rejects.toThrow('points to')
  })

  it('rolls back files and links created during a failed run', async () => {
    const sharedSkillDirectory = path.join(projectRoot, '.shared-agent', 'skills')
    const agents: AgentDefinition[] = [
      {
        id: 'codex',
        label: 'Codex',
        skillDirectory: sharedSkillDirectory,
      },
      {
        id: 'cursor',
        label: 'Cursor',
        skillDirectory: sharedSkillDirectory,
      },
    ]

    await expect(
      createSkill({
        name: 'testing',
        description: 'Should roll back.',
        location: 'project',
        agents,
      }),
    ).rejects.toThrow()

    await expect(
      fs.pathExists(path.join(projectRoot, '.agents', 'skills', 'testing')),
    ).resolves.toBe(false)
    await expect(fs.pathExists(path.join(sharedSkillDirectory, 'testing'))).resolves.toBe(false)
  })

  it('escapes frontmatter descriptions without changing the body text', async () => {
    const result = await createSkill({
      name: 'quoted',
      description: 'Has: "quotes"\nand a newline.',
      location: 'project',
      agents: [],
    })

    await expect(fs.readFile(result.skillFilePath, 'utf8')).resolves.toContain(
      'description: "Has: \\"quotes\\"\\nand a newline."',
    )
    await expect(fs.readFile(result.skillFilePath, 'utf8')).resolves.toContain(
      'Has: "quotes"\nand a newline.',
    )
  })
})
