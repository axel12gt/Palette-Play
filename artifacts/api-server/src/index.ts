import app from "./app";
import { logger } from "./lib/logger";
import { cleanupRankingDataIfDue } from "./lib/ranking-privacy";

const cleanup = () => cleanupRankingDataIfDue().catch((err: unknown) => {
  logger.error({ err }, 'Ranking privacy cleanup failed; will retry on the next request or hourly run');
});
void cleanup();
setInterval(() => { void cleanup(); }, 3600000).unref();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
