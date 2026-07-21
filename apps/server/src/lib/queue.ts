import { Queue, Worker, type Job, type Processor } from "bullmq";
import IORedis from "ioredis";
import { AppError } from "./errors";

let connection: IORedis | null = null;

// Lazy — a server with no background-job needs yet (or no Redis configured) should still boot
// and serve everything else; this only throws when a queue/worker is actually created.
function getConnection(): IORedis {
  if (!connection) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new AppError("Background jobs aren't set up yet on the server (missing REDIS_URL).", 503);
    }
    // BullMQ requires this on the underlying ioredis connection.
    connection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function createQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, { connection: getConnection() });
}

export function createWorker<T>(name: string, processor: Processor<T>): Worker<T> {
  return new Worker<T>(name, processor, { connection: getConnection() });
}

export type { Job };
