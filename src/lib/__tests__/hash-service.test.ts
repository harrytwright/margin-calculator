import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import { HashService } from '../hash-service'

describe('HashService', () => {
  let tempDir: string
  let service: HashService

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hash-service-test-'))
    service = new HashService()
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('computes hashes consistently', async () => {
    const filePath = path.join(tempDir, 'sample.txt')
    await fs.writeFile(filePath, 'first')

    const hash1 = await service.computeHash(filePath)
    const hash2 = await service.computeHash(filePath)

    expect(hash1).toBe(hash2)
  })

  test('detects changes and updates cache', async () => {
    const filePath = path.join(tempDir, 'mutable.txt')
    await fs.writeFile(filePath, 'a')

    let result = await service.hasChanged(filePath)
    expect(result.changed).toBe(true)
    service.set(filePath, result.hash)

    result = await service.hasChanged(filePath)
    expect(result.changed).toBe(false)

    await fs.writeFile(filePath, 'b')
    result = await service.hasChanged(filePath)
    expect(result.changed).toBe(true)
  })

  test('prefills snapshot and restores state', async () => {
    const fileA = path.join(tempDir, 'a.txt')
    const fileB = path.join(tempDir, 'b.txt')
    await fs.writeFile(fileA, 'A')
    await fs.writeFile(fileB, 'B')

    const snapshot = await service.prefill([fileA, fileB])
    expect(Object.keys(snapshot).sort()).toEqual([fileA, fileB].sort())

    const clone = new HashService()
    clone.restore(snapshot)
    expect(clone.get(fileA)).toBe(snapshot[fileA])
    expect(clone.get(fileB)).toBe(snapshot[fileB])
  })
})
