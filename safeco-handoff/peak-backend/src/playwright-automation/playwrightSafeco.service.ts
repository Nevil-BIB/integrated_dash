import { randomUUID } from "node:crypto";
import type { PlaywrightJobState } from "./playwright.types";
import { playwrightSafecoJobStore } from "./playwrightSafeco.job-store";
import { runSafecoPlaywright } from "./playwrightSafeco.runner";
import type { PlaywrightSafecoRunRequest } from "./playwrightSafeco.types";

export const playwrightSafecoAutomationService = {
  startJob(input: PlaywrightSafecoRunRequest): PlaywrightJobState {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const initial: PlaywrightJobState = {
      jobId,
      status: "queued",
      startedAt: now,
      step: "safeco_queued",
    };
    playwrightSafecoJobStore.create(initial);

    void (async () => {
      playwrightSafecoJobStore.update(jobId, { status: "running", step: "safeco_running" });
      try {
        const result = await runSafecoPlaywright(input, { jobId });
        playwrightSafecoJobStore.update(jobId, {
          status: "completed",
          finishedAt: new Date().toISOString(),
          step: "safeco_completed",
          ...(result.pdfPath ? { pdfPath: result.pdfPath } : {}),
        });
      } catch (err) {
        playwrightSafecoJobStore.update(jobId, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return initial;
  },
  getJob(jobId: string): PlaywrightJobState | null {
    return playwrightSafecoJobStore.get(jobId);
  },
};
