import { chromium, Page } from "playwright";
import { runChubbResidenceAddress } from "./playwrightChubb.address";
import { runChubbResidenceInfo } from "./playwrightChubb.residence-info";
import { runChubbStateDetail } from "./playwrightChubb.state-detail";
import { runChubbDiscountDetail } from "./playwrightChubb.discount-detail";
import { runChubbAdditionalCoverages } from "./playwrightChubb.additional-coverages";
import { runChubbLosses } from "./playwrightChubb.losses";
import { runChubbClientLevelCoverages } from "./playwrightChubb.client-level-coverages";
import { runChubbInterestedParties } from "./playwrightChubb.interested-parties";
import { runChubbPostInterestedPartiesHold } from "./playwrightChubb.post-interested-parties";
import { runChubbClientInfo } from "./playwrightChubb.client-info";
import { runChubbCoverageSelection } from "./playwrightChubb.coverage";
import { runChubbLocalAccountLogin } from "./playwrightChubb.login";
import { runChubbSecurityCheckAndOtp } from "./playwrightChubb.mfa";
import { chubbOpenAgentPortalLoginTab } from "./playwrightChubb.portal-nav";
import { runChubbPolicyInformation } from "./playwrightChubb.policy-information";
import { runChubbPolicyLaunch } from "./playwrightChubb.policy-launch";
import { runChubbPersonalLinesQuoteStart } from "./playwrightChubb.quote-start";
import { playwrightChubbJobStore } from "./playwrightChubb.job-store";
import type { PlaywrightChubbRunRequest } from "./playwrightChubb.types";

/**
 * CHUBB phase 1: login → MFA → quote start → coverage → launch → policy information → client info → address → residence info.
 */
export async function runChubbPlaywright(
  input: PlaywrightChubbRunRequest,
  opts?: { jobId?: string }
): Promise<{ pdfPath?: string }> {
  const jobId = opts?.jobId;

  const loginUrl = String(process.env.CHUBB_LOGIN_URL ?? "").trim();
  if (!loginUrl) {
    throw new Error("CHUBB_LOGIN_URL is required for CHUBB automation.");
  }
  if (!/chubb\.com/i.test(loginUrl)) {
    throw new Error("CHUBB_LOGIN_URL must be a chubb.com URL (e.g. marketing log-in page).");
  }

  const headless = input.options?.headless ?? false;
  const slowMo = input.options?.slowMoMs ?? 80;
  const timeoutMs = input.options?.timeoutMs ?? 90_000;
  const { username, password } = input.credentials;
  const { webhookUrl } = input;
  const { payload } = input;

  const browser = await chromium.launch({
    headless,
    slowMo,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  let page: Page | undefined;

  try {
    const context = await browser.newContext({
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    const updateStep = (step: string): void => {
      if (jobId) playwrightChubbJobStore.update(jobId, { step });
    };

    updateStep("chubb_navigate_login");
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    updateStep("chubb_open_agent_portal");
    const marketingPage = page;
    page = await chubbOpenAgentPortalLoginTab(marketingPage, context, timeoutMs);

    updateStep("chubb_sign_in");
    await runChubbLocalAccountLogin(page, username, password, timeoutMs, updateStep, jobId, "initial");
    await runChubbSecurityCheckAndOtp(page, webhookUrl, timeoutMs, updateStep, jobId);

    await runChubbPersonalLinesQuoteStart(page, timeoutMs, updateStep);
    await runChubbCoverageSelection(page, timeoutMs, updateStep);

    page = await runChubbPolicyLaunch(page, context, timeoutMs, updateStep);
    await runChubbPolicyInformation(page, payload, timeoutMs, updateStep);
    await runChubbClientInfo(page, payload, timeoutMs, updateStep);
    await runChubbResidenceAddress(page, payload, timeoutMs, updateStep);
    await runChubbResidenceInfo(page, payload, timeoutMs, updateStep);
    await runChubbStateDetail(page, payload, timeoutMs, updateStep);
    await runChubbDiscountDetail(page, payload, timeoutMs, updateStep);
    await runChubbAdditionalCoverages(page, payload, timeoutMs, updateStep);
    await runChubbLosses(page, payload, timeoutMs, updateStep);
    await runChubbClientLevelCoverages(page, payload, timeoutMs, updateStep);
    await runChubbInterestedParties(page, payload, timeoutMs, updateStep);
    const pdfResult = await runChubbPostInterestedPartiesHold(page, payload, timeoutMs, updateStep, jobId);
    if (!pdfResult.pdfPath) {
      throw new Error("CHUBB Premium Summary PDF download failed.");
    }

    updateStep("chubb_flow_complete");

    await context.close();
    return { pdfPath: pdfResult.pdfPath };
  } catch (err) {
    throw err;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
