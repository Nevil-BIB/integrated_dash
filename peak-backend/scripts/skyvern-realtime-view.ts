import axios from "axios";
import readline from "node:readline";

type RunResponse = {
  run_id?: string;
  status?: string;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  app_url?: string;
  screenshot_urls?: string[] | null;
  recording_url?: string | null;
  failure_reason?: string | null;
  errors?: unknown;
  [k: string]: unknown;
};

function getArg(name: string): string | undefined {
  const p = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(p));
  return arg ? arg.slice(p.length) : undefined;
}

function formatNow(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim();
}

async function main(): Promise<void> {
  const baseUrl = getArg("baseUrl") ?? process.env.SKYVERN_API_URL;
  const apiKey = getArg("apiKey") ?? process.env.SKYVERN_API_KEY;
  const runId = getArg("runId") ?? (await ask("Enter Skyvern run id (wr_...): "));
  const intervalMs = Number(getArg("intervalMs") ?? "3000");

  if (!baseUrl || !apiKey || !runId) {
    console.error(
      "Usage: npx ts-node scripts/skyvern-realtime-view.ts --baseUrl=http://host:8000 --apiKey=... --runId=wr_... [--intervalMs=3000]"
    );
    process.exit(1);
  }

  const client = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  let previousStatus = "";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const paths = [`/api/v1/runs/${runId}`, `/v1/runs/${runId}`];
      let data: RunResponse | null = null;
      for (const p of paths) {
        try {
          const res = await client.get<RunResponse>(p);
          data = res.data;
          break;
        } catch (e: unknown) {
          if (axios.isAxiosError(e) && e.response?.status === 404) continue;
          throw e;
        }
      }

      if (!data) {
        console.log(`[${formatNow()}] run not found on known paths`);
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }

      const status = data.status ?? "unknown";
      if (status !== previousStatus) {
        console.log(`\n[${formatNow()}] status changed -> ${status}`);
        previousStatus = status;
      } else {
        console.log(`[${formatNow()}] status=${status}`);
      }

      if (data.failure_reason) {
        console.log(`failure_reason: ${data.failure_reason}`);
      }

      if (Array.isArray(data.screenshot_urls) && data.screenshot_urls.length > 0) {
        console.log(`latest screenshot: ${data.screenshot_urls[data.screenshot_urls.length - 1]}`);
      }

      if (data.recording_url) {
        console.log(`recording: ${data.recording_url}`);
      }

      if (status === "completed" || status === "failed" || status === "canceled" || status === "cancelled") {
        console.log(`\n[${formatNow()}] run finished with status=${status}`);
        break;
      }
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        console.error(
          `[${formatNow()}] request error: ${e.message} (status=${e.response?.status ?? "n/a"})`
        );
      } else {
        console.error(`[${formatNow()}] error: ${String(e)}`);
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

