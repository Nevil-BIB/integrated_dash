import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const server = app.listen(env.port, () => {
  logger.info(`peak-backend started on port ${env.port}`, {
    nodeEnv: env.nodeEnv,
  });
});

function shutdown(signal: string): void {
  logger.warn(`Received ${signal}. Shutting down server...`);
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
