const base = process.env.APP_URL,
  secret = process.env.SYNC_SECRET;
if (!base || !secret || secret.length < 32)
  throw Error("Configure APP_URL and SYNC_SECRET in GitHub Actions secrets.");
const origin = new URL(base);
if (origin.protocol !== "https:" && origin.hostname !== "localhost")
  throw Error("HTTPS required.");
async function call(path) {
  const response = await fetch(new URL(path, origin), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(3500000),
  });
  if (!response.ok)
    throw Error(
      `Sync endpoint returned ${response.status}. Inspect SyncJob in the application.`,
    );
  return response.json();
}
await call("/api/sync/cron");
for (let count = 0; count < 200; count++) {
  const result = await call("/api/sync/cron?drain=1");
  if (!result.processed) {
    console.log("Synchronization queue finished.");
    process.exit(0);
  }
  console.log(`Processed job ${count + 1}.`);
}
throw Error("More than 200 jobs remain. Run workflow again.");
