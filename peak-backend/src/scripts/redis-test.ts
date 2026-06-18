import Redis from "ioredis";

async function main() {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  await redis.set("health:test", "ok", "EX", 30);
  const value = await redis.get("health:test");
  console.log("Redis value:", value);
  await redis.quit();
}

main().catch((err) => {
  console.error("Redis connection failed:", err);
  process.exit(1);
});