import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "../errors";
import type { StorageProvider } from "./storageProvider";

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!region || !accessKeyId || !secretAccessKey) {
      throw new AppError("File storage isn't set up yet on the server (missing S3 credentials).", 503);
    }
    client = new S3Client({
      region,
      endpoint: process.env.S3_ENDPOINT || undefined, // set for Cloudflare R2 / non-AWS S3-compatible hosts
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new AppError("File storage isn't set up yet on the server (missing S3_BUCKET).", 503);
  }
  return bucket;
}

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const s3Storage: StorageProvider = {
  async save(buffer, extension) {
    const s3 = getClient();
    const bucket = getBucket();
    const key = `receipts/${randomUUID()}.${extension}`;

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: EXTENSION_TO_CONTENT_TYPE[extension] ?? "application/octet-stream",
        }),
      );
    } catch (err) {
      console.error("S3 upload failed", err);
      throw new AppError("Couldn't save that image. Try again.", 502);
    }

    return key;
  },

  async read(key) {
    const s3 = getClient();
    const bucket = getBucket();

    try {
      const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await response.Body!.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      console.error("S3 download failed", err);
      throw new AppError("Couldn't retrieve that image.", 502);
    }
  },
};
