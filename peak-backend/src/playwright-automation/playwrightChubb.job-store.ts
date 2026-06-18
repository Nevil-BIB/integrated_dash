import type { PlaywrightJobState } from "./playwright.types";

/** CHUBB-only job store (do not share with Travelers or Auto-Owners). */
const jobs = new Map<string, PlaywrightJobState>();

export const playwrightChubbJobStore = {
  create(job: PlaywrightJobState): void {
    jobs.set(job.jobId, job);
  },
  update(jobId: string, patch: Partial<PlaywrightJobState>): PlaywrightJobState | null {
    const current = jobs.get(jobId);
    if (!current) return null;
    const next = { ...current, ...patch };
    jobs.set(jobId, next);
    return next;
  },
  get(jobId: string): PlaywrightJobState | null {
    return jobs.get(jobId) ?? null;
  },
};
