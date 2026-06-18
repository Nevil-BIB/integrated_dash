import { randomUUID } from "node:crypto";
import { playwrightTravelerJobStore } from "./playwrightTraveler.job-store";
import type { PlaywrightJobState } from "./playwright.types";
import { runTravelersPlaywright } from "./playwrightTraveler.runner";
import type { PlaywrightTravelerRunRequest } from "./playwrightTraveler.types";

export const playwrightTravelerAutomationService = {
  startJob(input: PlaywrightTravelerRunRequest): PlaywrightJobState {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const initial: PlaywrightJobState = {
      jobId,
      status: "queued",
      startedAt: now,
      step: "travelers_queued",
    };
    playwrightTravelerJobStore.create(initial);

    void (async () => {
      playwrightTravelerJobStore.update(jobId, { status: "running", step: "travelers_running" });
      try {
        await runTravelersPlaywright(input, { jobId });
        playwrightTravelerJobStore.update(jobId, {
          status: "completed",
          finishedAt: new Date().toISOString(),
        });
      } catch (err) {
        playwrightTravelerJobStore.update(jobId, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return initial;
  },

  getJob(jobId: string): PlaywrightJobState | null {
    return playwrightTravelerJobStore.get(jobId);
  },
};
