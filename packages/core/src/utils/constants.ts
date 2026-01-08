import os from 'os'
import path from 'path'

// System data location (config + database)
export const DEFAULT_LOCATION_DIR = path.join(os.homedir(), './margin')

// User workspace location (YAML files)
export const DEFAULT_WORKSPACE_DIR = path.join(process.cwd(), './data')

// Legacy export for backward compatibility during migration
export const DEFAULT_WORKING_DIR = DEFAULT_LOCATION_DIR
