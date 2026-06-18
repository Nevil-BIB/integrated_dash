import type { PlaywrightTravelerWebhookOtpPayload } from "./playwrightTraveler.types";

const OTP_MAX_AGE_MS = 60_000;

export interface PollTravelersOtpOptions {
  /** Total time to keep polling before giving up (default 2 minutes). */
  maxWaitMs?: number;
  /** Delay between attempts (default 2 seconds). */
  intervalMs?: number;
}

function isFreshOtp(time: number, now: number): boolean {
  if (!Number.isFinite(time)) return false;
  // OTP must have been issued within the last minute (small future skew for clock drift).
  const age = now - time;
  return age >= -30_000 && age <= OTP_MAX_AGE_MS;
}

/**
 * Polls GET webhookUrl until a JSON body `{ otp, time }` is returned with a fresh OTP.
 */
export async function pollTravelersWebhookOtp(
  webhookUrl: string,
  opts: PollTravelersOtpOptions = {}
): Promise<string> {
  const maxWaitMs = opts.maxWaitMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const deadline = Date.now() + maxWaitMs;

  let lastError = "No valid OTP received from webhook.";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(webhookUrl, { method: "GET" });
      if (!response.ok) {
        lastError = `Webhook returned ${response.status}.`;
      } else {
        const data = (await response.json()) as PlaywrightTravelerWebhookOtpPayload;
        const otp = String(data?.otp ?? "").trim();
        const time = data?.time;

        if (!otp) {
          lastError = "OTP missing in webhook response.";
        } else if (time === undefined || time === null || !Number.isFinite(Number(time))) {
          lastError = "Time not found in webhook response.";
        } else {
          const t = Number(time);
          const now = Date.now();
          if (!isFreshOtp(t, now)) {
            lastError = "OTP is expired (older than 1 minute) or invalid timestamp.";
          } else {
            return otp;
          }
        }
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(lastError);
}
