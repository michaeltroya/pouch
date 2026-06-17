import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const clackMocks = vi.hoisted(() => ({
  intro: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === 'cancelled'),
  multiselect: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  text: vi.fn(),
}))

const skillMocks = vi.hoisted(() => ({
  createSkill: vi.fn(),
}))

vi.mock('@clack/prompts', () => clackMocks)
vi.mock('@/lib/skill.js', () => skillMocks)

const { createCommand } = await import('@/commands/create.js')

const originalCwd = process.cwd()

let tempRoot: string
let projectRoot: string

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pouch-command-'))
  process.chdir(tempRoot)
  projectRoot = process.cwd()

  vi.clearAllMocks()
})

afterEach(async () => {
  process.chdir(originalCwd)
  vi.restoreAllMocks()
  await fs.remove(tempRoot)
})

function mockExit(code: number) {
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error(`process.exit:${code}`)
  }) as never)

  return exit
}

function runCreateCommand() {
  const program = new Command()
  program.addCommand(createCommand())
  return program.parseAsync(['node', 'pouch', 'create'], { from: 'node' })
}

describe('createCommand', () => {
  it('passes project-scoped agent skill directories when project location is selected', async () => {
    clackMocks.text
      .mockResolvedValueOnce('Testing Skill')
      .mockResolvedValueOnce('Checks command wiring.')
    clackMocks.select.mockResolvedValueOnce('project')
    clackMocks.multiselect.mockResolvedValueOnce(['codex', 'cursor'])
    skillMocks.createSkill.mockResolvedValueOnce({
      skillName: 'testing-skill',
      canonicalPath: path.join(projectRoot, '.agent-skills', 'testing-skill'),
      skillFilePath: path.join(projectRoot, '.agent-skills', 'testing-skill', 'SKILL.md'),
      links: [],
    })

    await runCreateCommand()

    expect(skillMocks.createSkill).toHaveBeenCalledWith({
      name: 'Testing Skill',
      description: 'Checks command wiring.',
      location: 'project',
      agents: [
        {
          id: 'codex',
          label: 'Codex',
          skillDirectory: path.join(projectRoot, '.codex', 'skills'),
        },
        {
          id: 'cursor',
          label: 'Cursor',
          skillDirectory: path.join(projectRoot, '.cursor', 'skills'),
        },
      ],
    })
  })

  it('passes home-scoped agent skill directories when home location is selected', async () => {
    const fakeHome = path.join(projectRoot, 'home')
    vi.spyOn(os, 'homedir').mockReturnValue(fakeHome)

    clackMocks.text.mockResolvedValueOnce('Home Skill').mockResolvedValueOnce('Checks home wiring.')
    clackMocks.select.mockResolvedValueOnce('home')
    clackMocks.multiselect.mockResolvedValueOnce(['claude'])
    skillMocks.createSkill.mockResolvedValueOnce({
      skillName: 'home-skill',
      canonicalPath: path.join(fakeHome, '.agent-skills', 'home-skill'),
      skillFilePath: path.join(fakeHome, '.agent-skills', 'home-skill', 'SKILL.md'),
      links: [],
    })

    await runCreateCommand()

    expect(skillMocks.createSkill).toHaveBeenCalledWith({
      name: 'Home Skill',
      description: 'Checks home wiring.',
      location: 'home',
      agents: [
        {
          id: 'claude',
          label: 'Claude',
          skillDirectory: path.join(fakeHome, '.claude', 'skills'),
        },
      ],
    })
  })

  it.each([
    {
      step: 'name',
      setup: () => {
        clackMocks.text.mockResolvedValueOnce('cancelled')
      },
    },
    {
      step: 'description',
      setup: () => {
        clackMocks.text.mockResolvedValueOnce('Testing Skill').mockResolvedValueOnce('cancelled')
      },
    },
    {
      step: 'location',
      setup: () => {
        clackMocks.text
          .mockResolvedValueOnce('Testing Skill')
          .mockResolvedValueOnce('Checks cancellation.')
        clackMocks.select.mockResolvedValueOnce('cancelled')
      },
    },
    {
      step: 'agents',
      setup: () => {
        clackMocks.text
          .mockResolvedValueOnce('Testing Skill')
          .mockResolvedValueOnce('Checks cancellation.')
        clackMocks.select.mockResolvedValueOnce('project')
        clackMocks.multiselect.mockResolvedValueOnce('cancelled')
      },
    },
  ])('exits cleanly when the $step prompt is cancelled', async ({ setup }) => {
    setup()
    const exit = mockExit(0)

    await expect(runCreateCommand()).rejects.toThrow('process.exit:0')

    expect(exit).toHaveBeenCalledWith(0)
    expect(clackMocks.outro).toHaveBeenCalledWith('Cancelled')
    expect(skillMocks.createSkill).not.toHaveBeenCalled()
  })

  it('exits with an error when skill creation fails', async () => {
    clackMocks.text
      .mockResolvedValueOnce('Testing Skill')
      .mockResolvedValueOnce('Checks error handling.')
    clackMocks.select.mockResolvedValueOnce('project')
    clackMocks.multiselect.mockResolvedValueOnce(['codex'])
    skillMocks.createSkill.mockRejectedValueOnce(new Error('already exists'))
    const exit = mockExit(1)
    const spinnerStop = vi.fn()
    clackMocks.spinner.mockReturnValueOnce({
      start: vi.fn(),
      stop: spinnerStop,
    })

    await expect(runCreateCommand()).rejects.toThrow('process.exit:1')

    expect(spinnerStop).toHaveBeenCalledWith('Could not create skill')
    expect(clackMocks.outro).toHaveBeenCalledWith('already exists')
    expect(exit).toHaveBeenCalledWith(1)
  })
})
