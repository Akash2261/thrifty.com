import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./storageProvider";

const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads");

export const localDiskStorage: StorageProvider = {
  async save(buffer, extension) {
    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);
    return filename;
  },

  async read(key) {
    return readFile(path.join(UPLOADS_DIR, path.basename(key)));
  },

  async delete(key) {
    try {
      await unlink(path.join(UPLOADS_DIR, path.basename(key)));
    } catch (err) {
      // Already gone (or never existed) is a fine outcome for a delete — anything else, surface it.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  },
};
