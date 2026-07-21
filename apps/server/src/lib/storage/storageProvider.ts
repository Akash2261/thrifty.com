export interface StorageProvider {
  save(buffer: Buffer, extension: string): Promise<string>;
  read(key: string): Promise<Buffer>;
}
