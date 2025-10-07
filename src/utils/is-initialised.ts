import { PathLike } from 'fs'
import fs from 'fs/promises'

import { defaultWorkingDir } from '../commands/initialise'

// Used to tell the user they must initialise first
export async function isInitialised(dir: PathLike = defaultWorkingDir) {
  try {
    await fs.access(dir)
    return true
  } catch (err) {
    return false
  }
}
