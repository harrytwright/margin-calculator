import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import {
  createDatabase,
  jsonArrayFrom,
  jsonObjectFrom,
  migrate,
} from '@menubook/sqlite'

import type { DatabaseContext } from '../../datastore/context'
import { FileWriter } from '../file-writer'
import { Importer } from '../importer'

describe('FileWriter integration', () => {
  let tempDir: string
  let context: DatabaseContext

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-writer-int-'))
    const db = createDatabase(':memory:')
    await migrate(db)

    context = {
      db,
      helpers: { jsonArrayFrom, jsonObjectFrom },
    }
  })

  afterEach(async () => {
    await context.db.destroy()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('writes files and re-imports updates via slug mapping', async () => {
    const writer = new FileWriter()

    const filePath = await writer.write(
      'supplier',
      'asda',
      {
        name: 'ASDA',
        slug: 'asda',
      },
      tempDir
    )

    const importer = new Importer(context, {
      importOnly: true,
      dataDir: tempDir,
    })

    let result = await importer.import([filePath])

    expect(result.resolved?.get('asda')?.data.name).toBe('ASDA')
    expect(importer.getPathForSlug('asda')).toBe(filePath)

    // Update via existing path reference
    const pathFromMapping = importer.getPathForSlug('asda')
    expect(pathFromMapping).toBe(filePath)

    await writer.write(
      'supplier',
      'asda',
      {
        name: 'ASDA Wholesale',
        slug: 'asda',
      },
      tempDir,
      pathFromMapping
    )

    result = await importer.import([filePath])

    expect(result.resolved?.get('asda')?.data.name).toBe('ASDA Wholesale')

    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('ASDA Wholesale')
  })
})
