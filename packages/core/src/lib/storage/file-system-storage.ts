import { FileWriter } from '../file-writer'
import type {
  StorageMode,
  StorageService,
  WriteData,
  WriteObjectType,
} from '../storage'

/**
 * File system storage implementation.
 * Writes entity data to YAML files on disk using FileWriter.
 */
export class FileSystemStorage implements StorageService {
  private readonly fileWriter = new FileWriter()

  async write<T extends WriteObjectType>(
    type: T,
    slug: string,
    data: WriteData<T>,
    workingDir: string,
    existingPath?: string
  ): Promise<string> {
    return await this.fileWriter.write(
      type,
      slug,
      data,
      workingDir,
      existingPath
    )
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.fileWriter.deleteFile(filePath)
  }

  getMode(): StorageMode {
    return 'fs'
  }
}
