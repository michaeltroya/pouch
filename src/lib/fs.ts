import fs from 'fs-extra'

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export async function lstatOrNull(filePath: string): Promise<fs.Stats | null> {
  return fs.lstat(filePath).catch((error: unknown) => {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null
    }

    throw error
  })
}
