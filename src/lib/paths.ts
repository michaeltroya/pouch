import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'

export const canonicalSkillLocationSchema = z.enum(['home', 'project'])

export type CanonicalSkillLocation = z.infer<typeof canonicalSkillLocationSchema>

export function resolveHomePath(value: string): string {
  if (value === '~') {
    return os.homedir()
  }

  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2))
  }

  return value
}

export function getLocationRoot(location: CanonicalSkillLocation): string {
  if (location === 'project') {
    return process.cwd()
  }

  return os.homedir()
}

export function getCanonicalSkillsDirectory(location: CanonicalSkillLocation): string {
  return path.join(getLocationRoot(location), '.agents', 'skills')
}

export function getCanonicalSkillPath(location: CanonicalSkillLocation, skillName: string): string {
  return path.join(getCanonicalSkillsDirectory(location), skillName)
}

export function toComparablePath(value: string): string {
  const resolved = path.resolve(value)

  if (resolved.startsWith('/private/var/')) {
    return resolved.replace('/private/var/', '/var/')
  }

  return resolved
}
