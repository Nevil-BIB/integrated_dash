export interface AutoOwnersCredentials {
  username: string;
  password?: string;
  totpSecret?: string;
}

export interface PlaywrightRunOptions {
  headless?: boolean;
  slowMoMs?: number;
  timeoutMs?: number;
  /** Keep browser open on failure for debugging (headed mode only). */
  keepBrowserOpenOnErrorMs?: number;
  /** Keep browser open at end (headed mode only). */
  keepBrowserOpenOnSuccessMs?: number;
}

export interface PlaywrightGenerateQuoteRequest {
  carriers?: string;
  // Frontend may send either a flat object or an array of { key, value } items.
  payload: unknown;
  auto_owners_credentials: AutoOwnersCredentials;
  options?: PlaywrightRunOptions;
}

export type PlaywrightJobStatus = "queued" | "running" | "completed" | "failed";

export interface PlaywrightJobState {
  jobId: string;
  status: PlaywrightJobStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  step?: string;
  pdfPath?: string;
}
