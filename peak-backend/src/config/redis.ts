import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

export async function ensureRedisConnection(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") return;
  await redis.connect();
}
