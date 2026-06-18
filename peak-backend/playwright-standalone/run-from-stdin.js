require("dotenv").config();
const { runAutoOwnersFlow } = require("./autoowners-flow");

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    throw new Error("Missing payload JSON on stdin.");
  }
  const payload = JSON.parse(raw);
  await runAutoOwnersFlow(payload);
  console.log("Playwright standalone run completed.");
}

main().catch((err) => {
  console.error("Playwright standalone run failed:", err?.message || err);
  process.exit(1);
});
