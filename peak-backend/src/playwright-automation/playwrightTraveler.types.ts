import type { PlaywrightRunOptions } from "./playwright.types";

export interface TravelersCredentials {
  username: string;
  password: string;
}

/** Response shape from TRAVELERS_WEBHOOK_URL */
export interface PlaywrightTravelerWebhookOtpPayload {
  otp?: string;
  time?: number;
}

export interface PlaywrightTravelerRunRequest {
  payload: unknown;
  credentials: TravelersCredentials;
  /** Polled after "Send Code" is clicked; OTP must be fresh when returned. */
  webhookUrl: string;
  options?: PlaywrightRunOptions;
}
