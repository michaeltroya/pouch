import path from 'node:path'
import fs from 'fs-extra'
import { z } from 'zod'
import type { AgentDefinition } from '@/lib/agents.js'
import { isNodeError, lstatOrNull } from '@/lib/fs.js'
import {
  getCanonicalSkillPath,
  toComparablePath,
  type CanonicalSkillLocation,
} from '@/lib/paths.js'

const skillInputSchema = z.object({
  name: z.string().trim().min(1, 'Skill name is required'),
  description: z.string().trim().min(1, 'Skill description is required'),
})

export type CreateSkillInput = z.input<typeof skillInputSchema> & {
  agents: AgentDefinition[]
  location: CanonicalSkillLocation
}

export type SkillLinkPlan =
  | { action: 'link'; agent: AgentDefinition; linkPath: string }
  | { action: 'skip'; agent: AgentDefinition; linkPath: string }

export type SkillLinkResult = {
  agent: AgentDefinition
  linkPath: string
  status: 'created' | 'existing'
}

export type CreateSkillResult = {
  skillName: string
  canonicalPath: string
  skillFilePath: string
  links: SkillLinkResult[]
}

export function toSkillSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createSkill(input: CreateSkillInput): Promise<CreateSkillResult> {
  const parsed = skillInputSchema.parse(input)
  const skillName = toSkillSlug(parsed.name)

  if (!skillName) {
    throw new Error('Skill name must include at least one letter or number.')
  }

  const agents = dedupeAgents(input.agents)
  const canonicalPath = getCanonicalSkillPath(input.location, skillName)
  const skillFilePath = path.join(canonicalPath, 'SKILL.md')
  const canonicalExisted = await fs.pathExists(canonicalPath)

  await ensureCanonicalSkillCanBeCreated(canonicalPath)
  const linkPlans = await planSkillSymlinks(agents, canonicalPath, skillName)

  await fs.ensureDir(canonicalPath)
  await writeSkillFile(skillFilePath, parsed.name, parsed.description)

  const links: SkillLinkResult[] = []
  const createdLinkPaths: string[] = []

  try {
    for (const linkPlan of linkPlans) {
      const result = await applySkillSymlink(linkPlan, canonicalPath)

      if (result.status === 'created') {
        createdLinkPaths.push(result.linkPath)
      }

      links.push(result)
    }
  } catch (error) {
    await rollbackCreatedPaths({
      canonicalExisted,
      canonicalPath,
      createdLinkPaths,
      skillFilePath,
    })

    throw error
  }

  return {
    skillName,
    canonicalPath,
    skillFilePath,
    links,
  }
}

function dedupeAgents(agents: AgentDefinition[]): AgentDefinition[] {
  const seen = new Set<AgentDefinition['id']>()

  return agents.filter((agent) => {
    if (seen.has(agent.id)) {
      return false
    }

    seen.add(agent.id)
    return true
  })
}

async function writeSkillFile(
  skillFilePath: string,
  name: string,
  description: string,
): Promise<void> {
  await fs
    .writeFile(skillFilePath, renderSkillMarkdown(name, description), {
      flag: 'wx',
    })
    .catch((error: unknown) => {
      if (isNodeError(error) && error.code === 'EEXIST') {
        throw new Error(`A canonical skill already exists at ${skillFilePath}`)
      }

      throw error
    })
}

async function ensureCanonicalSkillCanBeCreated(canonicalPath: string): Promise<void> {
  await ensureDirectoryPathCanBeCreated(path.dirname(canonicalPath))

  const existingCanonicalPath = await lstatOrNull(canonicalPath)

  if (existingCanonicalPath && !existingCanonicalPath.isDirectory()) {
    throw new Error(`Cannot create skill because ${canonicalPath} already exists.`)
  }

  if (existingCanonicalPath) {
    const contents = await fs.readdir(canonicalPath)

    if (contents.length > 0 && !contents.includes('SKILL.md')) {
      throw new Error(
        `Cannot create skill because ${canonicalPath} already exists and is not empty.`,
      )
    }
  }
}

function renderSkillMarkdown(name: string, description: string): string {
  return `---
name: ${toSkillSlug(name)}
description: ${JSON.stringify(description.trim())}
---

# ${name.trim()}

${description.trim()}
`
}

async function planSkillSymlinks(
  agents: AgentDefinition[],
  canonicalPath: string,
  skillName: string,
): Promise<SkillLinkPlan[]> {
  return Promise.all(
    agents.map(async (agent) => {
      const linkPath = path.join(agent.skillDirectory, skillName)
      await ensureDirectoryPathCanBeCreated(path.dirname(linkPath))

      const existing = await lstatOrNull(linkPath)

      if (!existing) {
        return {
          agent,
          linkPath,
          action: 'link' as const,
        }
      }

      if (!existing.isSymbolicLink()) {
        throw new Error(
          `Cannot link skill because ${linkPath} already exists and is not a symlink.`,
        )
      }

      const target = await fs.readlink(linkPath)
      const resolvedTarget = path.resolve(path.dirname(linkPath), target)

      if (toComparablePath(resolvedTarget) !== toComparablePath(canonicalPath)) {
        throw new Error(`Cannot link skill because ${linkPath} points to ${resolvedTarget}.`)
      }

      return {
        agent,
        linkPath,
        action: 'skip' as const,
      }
    }),
  )
}

async function ensureDirectoryPathCanBeCreated(directoryPath: string): Promise<void> {
  const existing = await lstatOrNull(directoryPath)

  if (existing) {
    if (!existing.isDirectory()) {
      throw new Error(
        `Cannot create directory because ${directoryPath} already exists and is not a directory.`,
      )
    }

    return
  }

  const parentPath = path.dirname(directoryPath)

  if (parentPath === directoryPath) {
    return
  }

  await ensureDirectoryPathCanBeCreated(parentPath)
}

async function applySkillSymlink(
  plan: SkillLinkPlan,
  canonicalPath: string,
): Promise<SkillLinkResult> {
  if (plan.action === 'skip') {
    return {
      agent: plan.agent,
      linkPath: plan.linkPath,
      status: 'existing',
    }
  }

  await fs.ensureDir(path.dirname(plan.linkPath))
  const linkTarget = path.relative(path.dirname(plan.linkPath), canonicalPath)
  await fs.symlink(linkTarget, plan.linkPath, 'dir')

  return {
    agent: plan.agent,
    linkPath: plan.linkPath,
    status: 'created',
  }
}

async function rollbackCreatedPaths(options: {
  canonicalExisted: boolean
  canonicalPath: string
  createdLinkPaths: string[]
  skillFilePath: string
}): Promise<void> {
  await Promise.all(options.createdLinkPaths.map((linkPath) => fs.remove(linkPath)))

  if (options.canonicalExisted) {
    await fs.remove(options.skillFilePath)
    return
  }

  await fs.remove(options.canonicalPath)
}
