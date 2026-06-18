import type { PlaywrightChubbWebhookOtpPayload } from "./playwrightChubb.types";

const OTP_MAX_AGE_MS = 60_000;

export interface PollChubbOtpOptions {
  maxWaitMs?: number;
  intervalMs?: number;
}

function isFreshOtp(time: number, now: number): boolean {
  if (!Number.isFinite(time)) return false;
  const age = now - time;
  return age >= -30_000 && age <= OTP_MAX_AGE_MS;
}

/**
 * Polls GET webhookUrl until a JSON body `{ otp, time }` is returned with a fresh OTP.
 */
export async function pollChubbWebhookOtp(
  webhookUrl: string,
  opts: PollChubbOtpOptions = {}
): Promise<string> {
  const maxWaitMs = opts.maxWaitMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const deadline = Date.now() + maxWaitMs;

  let lastError = "No valid OTP received from CHUBB webhook.";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(webhookUrl, { method: "GET" });
      if (!response.ok) {
        lastError = `CHUBB webhook returned ${response.status}.`;
      } else {
        const data = (await response.json()) as PlaywrightChubbWebhookOtpPayload;
        const otp = String(data?.otp ?? "").trim();
        const time = data?.time;

        if (!otp) {
          lastError = "OTP missing in CHUBB webhook response.";
        } else if (time === undefined || time === null || !Number.isFinite(Number(time))) {
          lastError = "Time not found in CHUBB webhook response.";
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
