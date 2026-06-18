import { randomUUID } from "node:crypto";
import { playwrightNationalGeneralJobStore } from "./playwrightNationalGeneral.job-store";
import type { PlaywrightJobState } from "./playwright.types";
import { runNationalGeneralPlaywright } from "./playwrightNationalGeneral.runner";
import type { PlaywrightNationalGeneralRunRequest } from "./playwrightNationalGeneral.types";

export const playwrightNationalGeneralAutomationService = {
  startJob(input: PlaywrightNationalGeneralRunRequest): PlaywrightJobState {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const initial: PlaywrightJobState = {
      jobId,
      status: "queued",
      startedAt: now,
      step: "national_general_queued",
    };
    playwrightNationalGeneralJobStore.create(initial);

    void (async () => {
      playwrightNationalGeneralJobStore.update(jobId, { status: "running", step: "national_general_running" });
      try {
        const result = await runNationalGeneralPlaywright(input, { jobId });
        playwrightNationalGeneralJobStore.update(jobId, {
          status: "completed",
          finishedAt: new Date().toISOString(),
          step: "national_general_completed",
          ...(result.pdfPath ? { pdfPath: result.pdfPath } : {}),
        });
      } catch (err) {
        playwrightNationalGeneralJobStore.update(jobId, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return initial;
  },
  getJob(jobId: string): PlaywrightJobState | null {
    return playwrightNationalGeneralJobStore.get(jobId);
  },
};

