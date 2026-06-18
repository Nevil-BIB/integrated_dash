import { env } from "../config/env";
import { ensureRedisConnection, redis } from "../config/redis";

interface StoredOtp {
  carrier: string;
  otp: string;
  runId: string;
  extractedAt: string;
  messageId: string | null;
  receivedAt: string;
  expiresAt: string;
}

const DEFAULT_OTP_TTL_SECONDS = 300;

export class OtpStoreService {
  private readonly otpTtlSeconds: number;
  private readonly latestJobKey = "skyvern:latestJobId";

  constructor(otpTtlSeconds: number = env.otpTtlSeconds || DEFAULT_OTP_TTL_SECONDS) {
    this.otpTtlSeconds = otpTtlSeconds;
  }

  private jobToRunKey(jobId: string): string {
    return `skyvern:jobMap:${jobId}`;
  }

  private inFlightQuoteKey(dedupeKey: string): string {
    return `skyvern:inFlightQuote:${dedupeKey}`;
  }

  /** Raw Redis value: pending marker JSON or final GenerateQuoteResponse JSON. */
  async getInFlightQuoteRun(dedupeKey: string): Promise<string | null> {
    await ensureRedisConnection();
    return redis.get(this.inFlightQuoteKey(dedupeKey));
  }

  /** Reserve slot for an in-flight run; returns false if another run already holds the key. */
  async tryReserveInFlightQuoteRun(dedupeKey: string, ttlSeconds: number): Promise<boolean> {
    await ensureRedisConnection();
    const pending = JSON.stringify({ _pending: true });
    const r = await redis.set(this.inFlightQuoteKey(dedupeKey), pending, "EX", ttlSeconds, "NX");
    return r === "OK";
  }

  async setInFlightQuoteRunPayload(dedupeKey: string, json: string, ttlSeconds: number): Promise<void> {
    await ensureRedisConnection();
    await redis.set(this.inFlightQuoteKey(dedupeKey), json, "EX", ttlSeconds);
  }

  async clearInFlightQuoteRun(dedupeKey: string): Promise<void> {
    await ensureRedisConnection();
    await redis.del(this.inFlightQuoteKey(dedupeKey));
  }

  /** Maps backend jobId → Skyvern run id so n8n can POST OTP with jobId only. */
  async setJobSkyvernRunMapping(jobId: string, skyvernRunId: string): Promise<void> {
    await ensureRedisConnection();
    await redis.set(this.jobToRunKey(jobId), skyvernRunId, "EX", this.otpTtlSeconds);
    await redis.set(this.latestJobKey, jobId, "EX", this.otpTtlSeconds);
  }

  async getSkyvernRunIdForJob(jobId: string): Promise<string | null> {
    await ensureRedisConnection();
    const v = await redis.get(this.jobToRunKey(jobId));
    return v && v.length > 0 ? v : null;
  }

  async getLatestActiveJob(): Promise<{ jobId: string; skyvernRunId: string } | null> {
    await ensureRedisConnection();
    const jobId = await redis.get(this.latestJobKey);
    if (!jobId) return null;
    const skyvernRunId = await redis.get(this.jobToRunKey(jobId));
    if (!skyvernRunId) return null;
    return { jobId, skyvernRunId };
  }

  private makeKey(carrier: string, runId: string): string {
    return `otp:${carrier}:${runId}`;
  }

  async upsert(input: {
    carrier: string;
    otp: string;
    runId: string;
    extractedAt: string;
    messageId?: string | null;
  }): Promise<StoredOtp> {
    await ensureRedisConnection();
    const now = Date.now();
    const expiresAtMs = now + this.otpTtlSeconds * 1000;
    const record: StoredOtp = {
      carrier: input.carrier,
      otp: input.otp,
      runId: input.runId,
      extractedAt: input.extractedAt,
      messageId: input.messageId ?? null,
      receivedAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };

    await redis.set(
      this.makeKey(input.carrier, input.runId),
      JSON.stringify(record),
      "EX",
      this.otpTtlSeconds
    );
    return record;
  }

  async get(carrier: string, runId: string): Promise<StoredOtp | null> {
    await ensureRedisConnection();
    const key = this.makeKey(carrier, runId);
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredOtp;
    } catch {
      await redis.del(key);
      return null;
    }
  }

  async consume(carrier: string, runId: string): Promise<StoredOtp | null> {
    await ensureRedisConnection();
    const raw = await redis.call("GETDEL", this.makeKey(carrier, runId));
    if (typeof raw !== "string") return null;
    try {
      return JSON.parse(raw) as StoredOtp;
    } catch {
      return null;
    }
  }
}

export const otpStoreService = new OtpStoreService();
