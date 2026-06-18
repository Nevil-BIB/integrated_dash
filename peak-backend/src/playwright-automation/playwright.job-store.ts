import { PlaywrightJobState } from "./playwright.types";

const jobs = new Map<string, PlaywrightJobState>();

export const playwrightJobStore = {
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
