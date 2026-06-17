import { intro, isCancel, multiselect, note, outro, select, spinner, text } from '@clack/prompts'
import { Command } from 'commander'
import { agentIdSchema, getAgentsById, supportedAgents } from '@/lib/agents.js'
import { createSkill } from '@/lib/skill.js'
import { canonicalSkillLocationSchema } from '@/lib/paths.js'

function promptOrExit<T>(value: T | symbol): T {
  if (isCancel(value)) {
    outro('Cancelled')
    process.exit(0)
  }

  return value
}

function requireNonEmpty(message: string) {
  return (value?: string) => {
    if (!(value ?? '').trim()) {
      return message
    }
    return undefined
  }
}

export function createCommand(): Command {
  const command = new Command('create')

  command.description('Create a shared skill and link it into agent skill directories')

  command.action(async () => {
    intro('Create a shared agent skill')

    const name = promptOrExit(
      await text({
        message: 'Skill name',
        placeholder: 'review-helper',
        validate: requireNonEmpty('Enter a skill name.'),
      }),
    )

    const description = promptOrExit(
      await text({
        message: 'Skill description',
        placeholder: 'Helps agents review code consistently.',
        validate: requireNonEmpty('Enter a skill description.'),
      }),
    )

    const location = promptOrExit(
      await select({
        message: 'Where should the canonical skill live?',
        options: [
          {
            value: 'project',
            label: 'Current project',
            hint: './.agents/skills/<skill-name>',
          },
          {
            value: 'home',
            label: 'Home directory',
            hint: '~/.agents/skills/<skill-name>',
          },
        ],
      }),
    )

    const selectedAgentIds = promptOrExit(
      await multiselect({
        message: 'Which agents should use this skill?',
        options: supportedAgents.map((agent) => ({
          value: agent.id,
          label: agent.label,
        })),
        required: true,
      }),
    )

    const canonicalLocation = canonicalSkillLocationSchema.parse(location)
    const parsedAgentIds = agentIdSchema.array().parse(selectedAgentIds)
    const agents = getAgentsById(parsedAgentIds, canonicalLocation)
    const activity = spinner()

    activity.start('Creating canonical skill and symlinks')

    try {
      const result = await createSkill({
        name,
        description,
        location: canonicalLocation,
        agents,
      })

      activity.stop('Skill created')

      note(
        [
          `Canonical: ${result.canonicalPath}`,
          ...result.links.map((link) => `${link.agent.label}: ${link.linkPath} (${link.status})`),
        ].join('\n'),
        result.skillName,
      )

      outro('Done')
    } catch (error) {
      activity.stop('Could not create skill')
      outro(error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  })

  return command
}
