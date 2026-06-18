import type { PlaywrightRunOptions } from "./playwright.types";

export interface NationalGeneralCredentials {
  username: string;
  password: string;
}

export interface PlaywrightNationalGeneralWebhookOtpPayload {
  otp?: string;
  time?: number;
}

export interface PlaywrightNationalGeneralRunRequest {
  payload: unknown;
  credentials: NationalGeneralCredentials;
  webhookUrl: string;
  options?: PlaywrightRunOptions;
}

