require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { runAutoOwnersFlow } = require("./autoowners-flow");

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node playwright-standalone/run-from-json.js <payload-json-path>");
  }

  const absolutePath = path.resolve(process.cwd(), inputPath);
  const payloadRaw = fs.readFileSync(absolutePath, "utf8");
  const payload = JSON.parse(payloadRaw);

  await runAutoOwnersFlow(payload);
  console.log("Playwright standalone run completed.");
}

main().catch((err) => {
  console.error("Playwright standalone run failed:", err?.message || err);
  process.exit(1);
});
