import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

import { migrate } from '../../datastore/database'
import { DB } from '../../datastore/types'
import { FileWatcher, WatcherEntityEvent } from '../file-watcher'
import { FileWriter } from '../file-writer'
import { HashService } from '../hash-service'
import { Importer } from '../importer'

describe('FileWatcher (integration)', () => {
  let tempDir: string
  let db: Kysely<DB>

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-watcher-int-'))
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

  test('emits events when files change on disk', async () => {
    const hashService = new HashService()
    const watcher = new FileWatcher({
      roots: [tempDir],
      hashService,
      debounceMs: 50,
      watchOptions: {
        usePolling: true,
        interval: 50,
      },
      importerFactory: () =>
        new Importer(db, {
          importOnly: true,
          dataDir: tempDir,
        }),
    })

    const writer = new FileWriter()

    await watcher.start()

    const created = waitForEntity(watcher)
    const filePath = await writer.write(
      'supplier',
      'asda',
      {
        name: 'ASDA',
        slug: 'asda',
      },
      tempDir
    )
    const createdEvent = await created

    expect(createdEvent).toMatchObject<Partial<WatcherEntityEvent>>({
      action: 'created',
      slug: 'asda',
      type: 'supplier',
    })

    const updated = waitForEntity(watcher)
    await writer.write(
      'supplier',
      'asda',
      {
        name: 'ASDA Wholesale',
        slug: 'asda',
      },
      tempDir,
      filePath
    )
    const updatedEvent = await updated

    expect(updatedEvent).toMatchObject<Partial<WatcherEntityEvent>>({
      action: 'updated',
      slug: 'asda',
      type: 'supplier',
    })

    const deleted = waitForEntity(watcher)
    await writer.deleteFile(filePath)
    const deletedEvent = await deleted

    expect(deletedEvent).toMatchObject<Partial<WatcherEntityEvent>>({
      action: 'deleted',
      slug: 'asda',
      type: 'supplier',
    })

    await watcher.stop()
  })
})

function waitForEntity(watcher: FileWatcher): Promise<WatcherEntityEvent> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      watcher.off('entity', onEntity)
      reject(error)
    }

    const onEntity = (event: WatcherEntityEvent) => {
      watcher.off('error', onError)
      resolve(event)
    }

    watcher.once('error', onError)
    watcher.once('entity', onEntity)
  })
}
