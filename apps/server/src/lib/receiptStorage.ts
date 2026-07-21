import { localDiskStorage } from "./storage/localDiskStorage";
import { s3Storage } from "./storage/s3Storage";
import type { StorageProvider } from "./storage/storageProvider";

// Local disk by default (dev); set STORAGE_PROVIDER=s3 for S3 or any S3-compatible host
// (Cloudflare R2, etc. — see s3Storage.ts for the relevant env vars).
function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === "s3" ? s3Storage : localDiskStorage;
}

export async function saveReceiptImage(buffer: Buffer, extension: string): Promise<string> {
  return getStorageProvider().save(buffer, extension);
}

export async function readReceiptImage(filename: string): Promise<Buffer> {
  return getStorageProvider().read(filename);
}
