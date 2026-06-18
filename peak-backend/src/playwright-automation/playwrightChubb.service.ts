import { randomUUID } from "node:crypto";
import { playwrightChubbJobStore } from "./playwrightChubb.job-store";
import type { PlaywrightJobState } from "./playwright.types";
import { runChubbPlaywright } from "./playwrightChubb.runner";
import type { PlaywrightChubbRunRequest } from "./playwrightChubb.types";

export const playwrightChubbAutomationService = {
  startJob(input: PlaywrightChubbRunRequest): PlaywrightJobState {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const initial: PlaywrightJobState = {
      jobId,
      status: "queued",
      startedAt: now,
      step: "chubb_queued",
    };
    playwrightChubbJobStore.create(initial);

    void (async () => {
      playwrightChubbJobStore.update(jobId, { status: "running", step: "chubb_running" });
      try {
        const result = await runChubbPlaywright(input, { jobId });
        playwrightChubbJobStore.update(jobId, {
          status: "completed",
          finishedAt: new Date().toISOString(),
          step: "chubb_pdf_downloaded",
          ...(result.pdfPath ? { pdfPath: result.pdfPath } : {}),
        });
      } catch (err) {
        playwrightChubbJobStore.update(jobId, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return initial;
  },

  getJob(jobId: string): PlaywrightJobState | null {
    return playwrightChubbJobStore.get(jobId);
  },
};
