import type { PlaywrightRunOptions } from "./playwright.types";

export interface ChubbCredentials {
  username: string;
  password: string;
}

/** Response shape from CHUBB_WEBHOOK_URL */
export interface PlaywrightChubbWebhookOtpPayload {
  otp?: string;
  time?: number;
}

export interface PlaywrightChubbRunRequest {
  payload: unknown;
  credentials: ChubbCredentials;
  /** Polled after MFA send/trigger when applicable; OTP must be fresh when returned. */
  webhookUrl: string;
  options?: PlaywrightRunOptions;
}
