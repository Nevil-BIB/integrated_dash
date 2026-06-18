import { chromium, Page } from "playwright";
import speakeasy from "speakeasy";
import { PlaywrightGenerateQuoteRequest } from "./playwright.types";

class AutomationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationError";
  }
}

async function detectAccessDenied(page: Page): Promise<{ isDenied: boolean; message?: string }> {
  const url = page.url();
  const deniedByUrl = url.includes("/vdesk/hangup.php3");
  const deniedHeading = await page.locator("text=Access Denied.").first().isVisible().catch(() => false);
  if (!deniedByUrl && !deniedHeading) return { isDenied: false };

  const supportIdText = await page.locator("text=/Support Ticket ID:/i").first().textContent().catch(() => null);
  const supportId = supportIdText ? supportIdText.replace(/\s+/g, " ").trim() : null;
  return {
    isDenied: true,
    message: supportId ? `Access Denied (${supportId})` : "Access Denied",
  };
}

async function detectOopsBroken(page: Page): Promise<{ isBroken: boolean; message?: string }> {
  const url = page.url();
  const byUrl = url.includes("/errorMaintenance/html/500.html") || url.endsWith("/500.html");
  const heading = await page
    .locator("text=Oops, something is broken.")
    .first()
    .isVisible()
    .catch(() => false);
  if (!byUrl && !heading) return { isBroken: false };

  const supportIdText = await page.locator("text=/Support Ticket ID:/i").first().textContent().catch(() => null);
  const supportId = supportIdText ? supportIdText.replace(/\s+/g, " ").trim() : null;
  return {
    isBroken: true,
    message: supportId ? `AO 500 error (${supportId})` : "AO 500 error (Oops, something is broken)",
  };
}

export async function runAutoOwnersPlaywright(
  input: PlaywrightGenerateQuoteRequest,
  opts?: { jobId?: string }
): Promise<{ pdfPath?: string }> {
  const headless = input.options?.headless ?? false;
  const slowMo = input.options?.slowMoMs ?? 80;
  const timeoutMs = input.options?.timeoutMs ?? 60000;
  const keepOpenOnErrorMs = input.options?.keepBrowserOpenOnErrorMs ?? 15000;

  const browser = await chromium.launch({
    headless,
    slowMo,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  let pdfPath: string | undefined;
  try {
    const context = await browser.newContext({
      // Stabilize fingerprint vs. strict auth/WAF rules.
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: { width: 1366, height: 768 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    let page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.goto("https://www.aoins.com/my.policy", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(300).catch(() => undefined);

    // Step 1 implemented now (username screen). Next steps will be added from your selectors.
    const { stepSecureSignInUsername } = await import("./autoowners.steps");
    await stepSecureSignInUsername(page, input.auto_owners_credentials.username);

    // After Continue, sometimes AO shows a 500 error page.
    let brokenAfterUsername = await detectOopsBroken(page);
    if (brokenAfterUsername.isBroken) {
      // One retry: the 500 is often transient or token-timing related.
      await page.waitForTimeout(1200);
      await page.goto("https://www.aoins.com/my.policy", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(300).catch(() => undefined);
      await stepSecureSignInUsername(page, input.auto_owners_credentials.username);
      brokenAfterUsername = await detectOopsBroken(page);
      if (brokenAfterUsername.isBroken) {
        if (!headless && keepOpenOnErrorMs > 0) await page.waitForTimeout(keepOpenOnErrorMs);
        throw new AutomationError(brokenAfterUsername.message ?? "AO 500 error");
      }
    }

    // Step 2: password screen (username is readonly on this screen)
    const { stepSecureSignInPassword } = await import("./autoowners.steps");
    if (!input.auto_owners_credentials.password) {
      throw new Error("Missing auto_owners_credentials.password for Playwright login step.");
    }
    await stepSecureSignInPassword(page, input.auto_owners_credentials.password);

    const brokenAfterPassword = await detectOopsBroken(page);
    if (brokenAfterPassword.isBroken) {
      if (!headless && keepOpenOnErrorMs > 0) await page.waitForTimeout(keepOpenOnErrorMs);
      throw new AutomationError(brokenAfterPassword.message ?? "AO 500 error");
    }

    // After Sign In, detect common hard-fail pages early (e.g., Access Denied).
    const denied = await detectAccessDenied(page);
    if (denied.isDenied) {
      if (!headless && keepOpenOnErrorMs > 0) {
        await page.waitForTimeout(keepOpenOnErrorMs);
      }
      throw new AutomationError(denied.message ?? "Access Denied");
    }

    // Step 3: If 2FA is present, switch to Authenticator App and submit TOTP.
    const hasTryAnother = await page
      .getByRole("link", { name: /try another method/i })
      .isVisible()
      .catch(() => false);
    const hasVerification = await page
      .getByLabel(/verification code|code/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (hasTryAnother || hasVerification) {
      if (!input.auto_owners_credentials.totpSecret) {
        throw new Error("Missing auto_owners_credentials.totpSecret for 2FA step.");
      }
      const { stepTwoFactorSwitchToAuthenticator, stepTwoFactorEnterCodeAndSubmit } = await import("./autoowners.steps");
      await stepTwoFactorSwitchToAuthenticator(page);
      // Use a CJS-compatible generator (avoids ts-node ESM require crash).
      const token = speakeasy.totp({
        secret: input.auto_owners_credentials.totpSecret,
        encoding: "base32",
        digits: 6,
      });
      await stepTwoFactorEnterCodeAndSubmit(page, token);
    }

    // Step 4: Start Proposal modal (static DW + payload fields)
    const { stepStartProposalModal, stepScoreDisclosureModalIfPresent } = await import("./autoowners.steps");
    await stepStartProposalModal(page, input.payload);
    await stepScoreDisclosureModalIfPresent(page);

    // After starting new business / disclosure, AO often opens /V5/PersonalProperty in a NEW TAB.
    // Smoothly switch to that tab and verify URL.
    const personalPropertyUrlRe = /\/V5\/PersonalProperty/i;
    const switchToPersonalProperty = async (): Promise<void> => {
      // 1) If current tab navigated there, just wait for it.
      const currentMatches = personalPropertyUrlRe.test(page.url());
      if (currentMatches) return;

      // 2) Otherwise, race for either a popup/new page or a navigation.
      // IMPORTANT: don't wait for full "load" on AO SPA pages; use domcontentloaded.
      const waitForNewPage = context.waitForEvent("page", { timeout: 45000 }).catch(() => null);
      const waitForPopup = page.waitForEvent("popup", { timeout: 45000 }).catch(() => null);
      const waitForNav = page
        .waitForURL(personalPropertyUrlRe, { timeout: 45000, waitUntil: "domcontentloaded" })
        .catch(() => null);

      const winner = await Promise.race([waitForNewPage, waitForPopup, waitForNav]);
      if (winner && typeof (winner as any).url === "function") {
        const newPage = winner as unknown as Page;
        page = newPage;
      }

      // 3) Final verification: ensure the active page is on PersonalProperty.
      // If the new page opened but navigation is still in progress, wait for URL on any page.
      const existingMatch = context.pages().find((p) => personalPropertyUrlRe.test(p.url()));
      if (existingMatch) page = existingMatch;

      if (!personalPropertyUrlRe.test(page.url())) {
        // Sometimes the navigation completes on a different tab; scan briefly.
        const startedAt = Date.now();
        while (Date.now() - startedAt < 45000) {
          const match = context.pages().find((p) => personalPropertyUrlRe.test(p.url()));
          if (match) {
            page = match;
            break;
          }
          await page.waitForTimeout(500);
        }
      }
      if (!personalPropertyUrlRe.test(page.url())) {
        await page.waitForURL(personalPropertyUrlRe, { timeout: 45000, waitUntil: "domcontentloaded" });
      }
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    };

    await switchToPersonalProperty();

    // Step 6: Fill Basic Policy (Fire/Dwelling) and continue
    const {
      stepBasicPolicyFireDwelling,
      stepHouseholdMember,
      stepInsuranceScoreNoScore,
      stepAddLocation,
      stepLocationInformation,
      stepLocationInformationContinued,
      stepAddlCoveragesContinue,
      stepUnderwritingPolicyQuestions,
      stepUnderwritingLocationSpecificQuestions,
      stepUnderwritingPriorLossesOrderReports,
      stepSummaryDisplayContinue,
      stepFinalSalePolicyQuestions,
      stepFinalSaleLocationSpecificQuestions,
      stepFinalSaleBillingSubmitForIssuanceAndDownloadPdf,
      stepDownloadPrintableDocumentsPdf,
    } = await import("./autoowners.steps");
    await stepBasicPolicyFireDwelling(page, input.payload);

    // Step 7: Household Member(s)
    await stepHouseholdMember(page, input.payload);

    // Step 8: Insurance Score (No Score)
    await stepInsuranceScoreNoScore(page);

    // Step 9: Location(s) -> Address(es) (Add Location)
    await stepAddLocation(page, input.payload);

    // Step 10: Location(s) -> Information
    await stepLocationInformation(page, input.payload);

    // Step 11: Location(s) -> Information Continued
    await stepLocationInformationContinued(page, input.payload);

    // Step 12: Add'l Coverages (Property -> Liability) continue-through
    await stepAddlCoveragesContinue(page);

    // Step 13: Underwriting -> Policy Questions
    await stepUnderwritingPolicyQuestions(page, input.payload);

    // Step 14: Underwriting -> Location Specific Questions
    await stepUnderwritingLocationSpecificQuestions(page, input.payload);

    // Step 15: Summary Continue → Prior Losses → Order Loss Reports → Continue → Summary
    await stepUnderwritingPriorLossesOrderReports(page);

    // Step 16: Summary Continue → Final Sale
    await stepSummaryDisplayContinue(page);

    // Step 17: Final Sale -> Policy Questions
    await stepFinalSalePolicyQuestions(page, input.payload);

    // Step 18: Final Sale -> Location Specific Questions
    await stepFinalSaleLocationSpecificQuestions(page, input.payload);

    // Step 19: Final Sale -> Billing — save PDF locally (playwright-artifacts/)
    const pdfResult = await stepFinalSaleBillingSubmitForIssuanceAndDownloadPdf(page, opts?.jobId, input.payload);
    pdfPath = pdfResult.pdfPath;
    if (!pdfPath) {
      const fallback = await stepDownloadPrintableDocumentsPdf(page, opts?.jobId, input.payload).catch(() => ({
        pdfPath: undefined,
      }));
      pdfPath = fallback.pdfPath;
    }
    if (!pdfPath) throw new AutomationError("PDF download failed.");

    // PDF saved — stop automation immediately (do not keep browser open).
    return { pdfPath };
  } catch (err) {
    if (!headless && keepOpenOnErrorMs > 0) {
      try {
        const pages = browser.contexts().flatMap((c) => c.pages());
        const page = pages[0];
        if (page) await page.waitForTimeout(keepOpenOnErrorMs);
      } catch {
        // ignore
      }
    }
    if (err instanceof AutomationError) throw err;
    throw new AutomationError(err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }
}
