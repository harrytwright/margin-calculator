import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import { migrate } from '../../datastore/database'
import { DB } from '../../datastore/types'
import { FileWriter } from '../file-writer'
import { Importer } from '../importer'

describe('FileWriter integration', () => {
  let tempDir: string
  let db: Kysely<DB>

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-writer-int-'))
    db = new Kysely<DB>({
      dialect: new SqliteDialect({
        database: new Database(':memory:'),
      }),
    })

    await migrate.call(
      db,
      'up',
      path.join(__dirname, '../../datastore/migrations')
    )
  })

  afterEach(async () => {
    await db.destroy()
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

    const importer = new Importer(db, {
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
