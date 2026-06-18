import { skyvernIntegration } from "../integrations/skyvern.integration";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const skyvernStatusService = {
  async getRun(runId: string): Promise<Record<string, unknown>> {
    const run = await skyvernIntegration.getRunStatus(runId);
    return {
      runId,
      status: String(run.status ?? "unknown"),
      terminal: this.isTerminalStatus(String(run.status ?? "")),
      failureReason:
        run.failure_reason ??
        run.failureReason ??
        run.error_message ??
        run.errorMessage ??
        run.error ??
        null,
      raw: run,
    };
  },

  isTerminalStatus(statusRaw: string): boolean {
    const status = String(statusRaw ?? "").toLowerCase();
    return ["completed", "succeeded", "success", "failed", "terminated", "cancelled", "canceled", "error"].includes(
      status
    );
  },

  async pollUntilTerminal(
    runId: string,
    options?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<Record<string, unknown>> {
    const timeoutMs = options?.timeoutMs ?? 120000;
    const intervalMs = options?.intervalMs ?? 5000;
    const startedAt = Date.now();
    let last: Record<string, unknown> = {};

    while (Date.now() - startedAt <= timeoutMs) {
      const current = await this.getRun(runId);
      last = current;
      if (Boolean(current.terminal)) {
        return { ...current, timedOut: false, elapsedMs: Date.now() - startedAt };
      }
      await sleep(intervalMs);
    }

    return {
      ...last,
      runId,
      timedOut: true,
      elapsedMs: Date.now() - startedAt,
      message: "Polling timeout exceeded before terminal status.",
    };
  },
};
