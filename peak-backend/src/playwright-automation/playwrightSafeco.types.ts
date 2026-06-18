import type { PlaywrightRunOptions } from "./playwright.types";

export interface SafecoCredentials {
  username: string;
  password: string;
}

export interface PlaywrightSafecoWebhookOtpPayload {
  otp?: string;
  time?: number;
}

export interface PlaywrightSafecoRunRequest {
  payload: unknown;
  credentials: SafecoCredentials;
  webhookUrl: string;
  loginUrl: string;
  options?: PlaywrightRunOptions;
}
