import { z } from 'zod'
import path from 'node:path'
import { getLocationRoot } from '@/lib/paths.js'
import type { CanonicalSkillLocation } from '@/lib/paths.js'

export const agentIdSchema = z.enum(['codex', 'cursor', 'claude'])

export type AgentId = z.infer<typeof agentIdSchema>

export type AgentDefinition = {
  id: AgentId
  label: string
  skillDirectory: string
}

type SupportedAgent = {
  id: AgentId
  label: string
  directoryName: string
}

export const supportedAgents = [
  {
    id: 'codex',
    label: 'Codex',
    directoryName: '.codex',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    directoryName: '.cursor',
  },
  {
    id: 'claude',
    label: 'Claude',
    directoryName: '.claude',
  },
] satisfies SupportedAgent[]

export function getAgentsById(
  agentIds: AgentId[],
  location: CanonicalSkillLocation,
): AgentDefinition[] {
  const selected = new Set(agentIds)
  return supportedAgents
    .filter((agent) => selected.has(agent.id))
    .map((agent) => ({
      id: agent.id,
      label: agent.label,
      skillDirectory: getAgentSkillDirectory(agent.directoryName, location),
    }))
}

function getAgentSkillDirectory(directoryName: string, location: CanonicalSkillLocation): string {
  return path.join(getLocationRoot(location), directoryName, 'skills')
}
