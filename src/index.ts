#!/usr/bin/env node

import { Command } from 'commander'
import { createCommand } from '@/commands/create.js'

const program = new Command()

program.name('pouch').description('Create and link shared agent skills').version('0.1.0')

program.addCommand(createCommand())

await program.parseAsync()
