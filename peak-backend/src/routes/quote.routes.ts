import { Router } from "express";
import {
  generateQuoteController,
  latestOtpJobController,
  otpReadController,
  otpWebhookController,
  skyvernRunStatusController,
  skyvernTotpPollController,
} from "../controllers/quote.controller";
import {
  generateQuotePlaywrightController,
  playwrightJobStatusController,
} from "../controllers/playwright-generate-quote.controller";
import {
  generateQuotePlaywrightTravelersController,
  playwrightTravelerJobStatusController,
} from "../controllers/playwrightTraveler.controller";
import {
  generateQuotePlaywrightChubbController,
  playwrightChubbJobStatusController,
} from "../controllers/playwrightChubb.controller";
import {
  generateQuotePlaywrightNationalGeneralController,
  playwrightNationalGeneralJobStatusController,
} from "../controllers/playwrightNationalGeneral.controller";
import {
  generateQuotePlaywrightSafecoController,
  playwrightSafecoJobStatusController,
} from "../controllers/playwrightSafeco.controller";

export const quoteRouter = Router();


// ! Hit By frontend to run Playwright locally (Auto-Owners only)
quoteRouter.post("/generate-quote/playwright", generateQuotePlaywrightController);
// ! Hit By frontend to check Auto-Owners Playwright job status
quoteRouter.get("/generate-quote/playwright/:jobId", playwrightJobStatusController);
// ! Travelers Playwright
quoteRouter.post("/generate-quote/playwright/travelers", generateQuotePlaywrightTravelersController);
quoteRouter.get("/generate-quote/playwright/travelers/:jobId", playwrightTravelerJobStatusController);
// ! CHUBB Playwright
quoteRouter.post("/generate-quote/playwright/chubb", generateQuotePlaywrightChubbController);
quoteRouter.get("/generate-quote/playwright/chubb/:jobId", playwrightChubbJobStatusController);
// ! National General Playwright
quoteRouter.post("/generate-quote/playwright/national-general", generateQuotePlaywrightNationalGeneralController);
quoteRouter.get("/generate-quote/playwright/national-general/:jobId", playwrightNationalGeneralJobStatusController);
// ! Safeco Playwright
quoteRouter.post("/generate-quote/playwright/safeco", generateQuotePlaywrightSafecoController);
quoteRouter.get("/generate-quote/playwright/safeco/:jobId", playwrightSafecoJobStatusController);
// ! .......................................................................................... //
// // ! Hit By backend to generate quote
// quoteRouter.post("/generate-quote", generateQuoteController);
// // ! Hit By backend to get quote status by runId
// quoteRouter.get("/skyvern/run-status/:runId", skyvernRunStatusController);
// // ! Hit By n8n bridge to fetch latest active job mapping
// quoteRouter.get("/otp/latest-job", latestOtpJobController);
// // ! Hit By n8n to give me OTP
// quoteRouter.post("/webhooks/otp", otpWebhookController);
// // ! Hit By Skyvern to get OTP For Travelers
// quoteRouter.post("/otp/skyvern-totp", skyvernTotpPollController);
// quoteRouter.get("/otp/skyvern-totp", skyvernTotpPollController);
// quoteRouter.get("/otp/:carrier/:runId", otpReadController);
