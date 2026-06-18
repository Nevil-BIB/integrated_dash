export interface GenerateQuoteRequest {
  quoteId?: string;
  /** When set (top-level or inside payload), duplicate submits reuse the same Skyvern run response until TTL expires. */
  extractionId?: string;
  carriers?: string[];
  payload?: Record<string, unknown>;
}

export interface GenerateQuoteResponse {
  quoteId: string;
  jobId: string;
  status: "queued" | "running" | "completed";
  note: string;
  /** Skyvern workflow run id (e.g. wr_...) when API returns it; use for OTP correlation with n8n. */
  skyvernRunId?: string | null;
}
