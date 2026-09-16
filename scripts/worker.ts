import { drain } from "../lib/sync";
import { db } from "../lib/db";
// One-shot worker for Render Cron. The web service can drain the same durable queue.
async function main() {
  try {
    await drain();
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Worker failed. Consult SyncJob and integration status.");
  process.exitCode = 1;
});
