import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import { FileWatcher, WatcherEntityEvent } from '../file-watcher'
import { HashService } from '../hash-service'

jest.mock('chokidar', () => {
  const { EventEmitter } = require('events')

  const watchers: any[] = []

  const createWatcher = () => {
    const emitter = new EventEmitter()
    emitter.close = jest.fn(() => Promise.resolve())
    watchers.push(emitter)
    return emitter
  }

  const watch = jest.fn(() => createWatcher())

  return {
    __watchers: watchers,
    watch,
    default: { watch },
  }
})

const chokidarMock = jest.requireMock('chokidar') as {
  __watchers: Array<{
    emit: (event: string, ...args: any[]) => boolean
    close: jest.Mock<Promise<void>, []>
  }>
}

describe('FileWatcher', () => {
  let tempDir: string
  let hashService: HashService

  beforeEach(async () => {
    jest.useFakeTimers()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-watcher-unit-'))
    hashService = new HashService()
  })

  afterEach(async () => {
    jest.useRealTimers()
    await fs.rm(tempDir, { recursive: true, force: true })
    chokidarMock.__watchers.length = 0
  })

  test.skip('emits created/updated/deleted events', async () => {
    const supplierDir = path.join(tempDir, 'suppliers')
    await fs.mkdir(supplierDir, { recursive: true })
    const supplierFile = path.join(supplierDir, 'asda.yaml')
    await fs.writeFile(
      supplierFile,
      `object: supplier
data:
  name: Asda
`
    )

    const importer = {
      import: jest.fn(),
    }

    importer.import
      .mockRejectedValueOnce(
        new Error('Invalid input: expected object, received string')
      )
      .mockResolvedValueOnce({
        stats: { created: 0, ignored: 0, upserted: 0, failed: 0 },
        resolved: new Map([
          [
            'asda',
            {
              slug: 'asda',
              type: 'supplier',
              path: supplierFile,
              data: { slug: 'asda', name: 'Asda' },
            },
          ],
        ]),
      })
      .mockResolvedValueOnce({
        stats: { created: 0, ignored: 0, upserted: 0, failed: 0 },
        resolved: new Map([
          [
            'asda',
            {
              slug: 'asda',
              type: 'supplier',
              path: supplierFile,
              data: { slug: 'asda', name: 'Asda Updated' },
            },
          ],
        ]),
      })

    const watcher = new FileWatcher({
      roots: [tempDir],
      hashService,
      importerFactory: () => importer,
      debounceMs: 10,
    })

    const startPromise = watcher.start()
    const fakeWatcher = chokidarMock.__watchers[0]
    fakeWatcher.emit('ready')
    await startPromise

    const created = waitForEntity(watcher)
    fakeWatcher.emit('add', supplierFile)
    // Run all timers (debounce + retry)
    await jest.runAllTimersAsync()
    const createdEvent = await created

    expect(createdEvent).toMatchObject<Partial<WatcherEntityEvent>>({
      action: 'created',
      slug: 'asda',
      type: 'supplier',
    })
    expect(importer.import).toHaveBeenCalledWith([supplierFile])
    expect(importer.import).toHaveBeenCalledTimes(2)

    await fs.writeFile(
      supplierFile,
      `object: supplier
data:
  name: Asda Updated
`
    )

    const updated = waitForEntity(watcher)
    fakeWatcher.emit('change', supplierFile)
    // Run all timers
    await jest.runAllTimersAsync()
    const updatedEvent = await updated

    expect(updatedEvent).toMatchObject<Partial<WatcherEntityEvent>>({
      action: 'updated',
      slug: 'asda',
      type: 'supplier',
    })

    const deleted = waitForEntity(watcher)
    fakeWatcher.emit('unlink', supplierFile)
    const deletedEvent = await deleted

    expect(deletedEvent).toMatchObject<Partial<WatcherEntityEvent>>({
      action: 'deleted',
      slug: 'asda',
      type: 'supplier',
    })

    expect(importer.import).toHaveBeenCalledTimes(3)

    await watcher.stop()
    expect(fakeWatcher.close).toHaveBeenCalled()
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
