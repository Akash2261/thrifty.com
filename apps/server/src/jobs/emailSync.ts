import { createQueue, createWorker } from "../lib/queue";
import { syncAllActiveConnections } from "../modules/email/emailConnections.service";

const QUEUE_NAME = "email-sync";

export function startEmailSyncWorker() {
  return createWorker(QUEUE_NAME, async () => syncAllActiveConnections());
}

export async function enqueueEmailSync() {
  const queue = createQueue(QUEUE_NAME);
  await queue.add("sync-all", {});
  await queue.close();
}
