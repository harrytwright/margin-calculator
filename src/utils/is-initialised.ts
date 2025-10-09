import { PathLike } from 'fs'
import fs from 'fs/promises'

import { DEFAULT_WORKING_DIR } from './constants'

// Used to tell the user they must initialise first
export async function isInitialised(dir: PathLike = DEFAULT_WORKING_DIR) {
  try {
    await fs.access(dir)
    return true
  } catch (err) {
    return false
  }
}
