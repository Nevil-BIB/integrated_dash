import { randomUUID } from "node:crypto";
import { playwrightJobStore } from "./playwright.job-store";
import { PlaywrightGenerateQuoteRequest, PlaywrightJobState } from "./playwright.types";
import { runAutoOwnersPlaywright } from "./playwright.runner";

export const playwrightAutomationService = {
  startJob(input: PlaywrightGenerateQuoteRequest): PlaywrightJobState {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const initial: PlaywrightJobState = {
      jobId,
      status: "queued",
      startedAt: now,
      step: "secure_sign_in_username",
    };
    playwrightJobStore.create(initial);

    // Fire-and-forget (runs in background inside same Node process).
    // Production note: move to a queue/worker if you need concurrency controls.
    void (async () => {
      playwrightJobStore.update(jobId, { status: "running" });
      try {
        playwrightJobStore.update(jobId, { step: "secure_sign_in_password" });
        const result = await runAutoOwnersPlaywright(input, { jobId });
        playwrightJobStore.update(jobId, {
          status: "completed",
          finishedAt: new Date().toISOString(),
          step: "pdf_downloaded",
          ...(result.pdfPath ? { pdfPath: result.pdfPath } : {}),
        });
      } catch (err) {
        playwrightJobStore.update(jobId, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return initial;
  },

  getJob(jobId: string): PlaywrightJobState | null {
    return playwrightJobStore.get(jobId);
  },
};
