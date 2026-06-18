import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 7001),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
  skyvernApiUrl: requireEnv("SKYVERN_API_URL", process.env.SKYVERN_API_URL ?? ""),
  skyvernApiKey: requireEnv("SKYVERN_API_KEY", process.env.SKYVERN_API_KEY ?? ""),
  /**
   * When set (e.g. wpid_...), POST /api/v1/workflows/{id}/run is used (Skyvern 2 UI run).
   * When empty, legacy POST to skyvernRunTaskPath with title/url/prompt body is used.
   */
  skyvernWorkflowIdTravelers: (process.env.SKYVERN_WORKFLOW_ID_TRAVELERS ?? "").trim(),
  skyvernWorkflowIdAutoOwners: (process.env.SKYVERN_WORKFLOW_ID_AUTO_OWNERS ?? "").trim(),
  /**
   * If true and skyvernWorkflowId is set, request body includes { parameters: { jobId, quoteId, carriers, ...payload } }.
   * Keep false if the workflow has no declared parameters (avoids 422).
   */
  skyvernWorkflowSendParameters: process.env.SKYVERN_WORKFLOW_SEND_PARAMETERS === "true",
  /**
   * If true, do not send `traveler_credentials` in workflow run parameters (only jobId/quoteId/otp_code/etc.).
   * Use after fixing the credential on the workflow in Skyvern UI if the server still validates a stale embedded id.
   */
  skyvernWorkflowOmitTravelerCredentialParam:
    process.env.SKYVERN_WORKFLOW_OMIT_TRAVELER_CREDENTIAL_PARAM === "true",
  skyvernRunTaskPath: process.env.SKYVERN_RUN_TASK_PATH ?? "/api/v1/run/tasks",
  /** Travelers workflow input parameter values (optional defaults). */
  skyvernTravelerCredential: (process.env.SKYVERN_TRAVELER_CREDENTIAL ?? "").trim(),
  skyvernTravelerOtpDefault: process.env.SKYVERN_TRAVELER_OTP_DEFAULT ?? "",

  /** Auto Owners agent portal (confirm with client if URL changes). */
  autoOwnersPortalUrl: process.env.AUTO_OWNERS_PORTAL_URL ?? "https://www.aoins.com/my.policy",

  /**
   * Base32 TOTP secret for Auto Owners 2FA (from client / authenticator setup).
   * Optional: if empty, we do not attach totp_code to Skyvern metadata (use Skyvern Credentials TOTP instead).
   */
  autoOwnersTotpSecret: process.env.AUTO_OWNERS_TOTP_SECRET ?? "",

  /**
   * Shared secret between n8n and backend webhook.
   * If set, /webhooks/otp requires header: x-webhook-secret
   */
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",

  /**
   * Public base URL of this API (no trailing slash), reachable from Skyvern containers.
   * Used to set workflow run `totp_url` so Skyvern can poll OTP by jobId.
   * Example: http://host.docker.internal:7001
   */
  backendPublicUrl: (process.env.BACKEND_PUBLIC_URL ?? "").replace(/\/$/, ""),
};
