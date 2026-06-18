import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import { downloadChubbPdfFromTrigger } from "./playwrightChubb.pdf";
import {
  chubbIsEzQuoteNonResidenceScreenReady,
  chubbWaitForPostInterestedPartiesScreen,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";

const CHUBB_MAX_NEXT_ALERT_CLICKS = 20;
const CHUBB_CREDIT_ALERT_WAIT_MS = 90_000;
const CHUBB_SUMMARY_NO_ALERT_SETTLE_MS = 10_000;

const CHUBB_NEXT_ALERT_BUTTON_SELECTOR =
  "div.left-pad button.link.arrow-action.next-button:not(.previous-arrow-style), div.left-pad button.next-button:not(.previous-arrow-style)";

function chubbIsOnSummaryUrl(page: Page): boolean {
  return /\/summary(?:\?|#|$)/i.test(page.url());
}

function chubbNextAlertButton(page: Page): ReturnType<Page["locator"]> {
  return page
    .locator(CHUBB_NEXT_ALERT_BUTTON_SELECTOR)
    .filter({ hasText: /^Next\s*Alert$/i })
    .first();
}

function chubbCreditFooterContinueButtons(page: Page): ReturnType<Page["locator"]>[] {
  return [
    page.locator("credit app-page-footer button.bdd-continue.continue"),
    page.locator("credit app-page-footer button.continue-button.bdd-continue.continue"),
    page.locator("credit app-page-footer button.button-submit.bdd-continue"),
    page.locator(".dynamic-premium-container credit app-page-footer button.bdd-continue"),
    page.locator(".dynamic-premium-container app-page-footer button.continue-button.bdd-continue"),
    page.locator(".dynamic-premium-container app-page-footer button.button-submit.bdd-continue"),
    page.locator(".page-footer button.bdd-continue.continue, .page-footer button.continue-button.bdd-continue"),
    page.locator("credit app-page-footer").getByRole("button", { name: /^Continue$/i }),
    page.locator(".dynamic-premium-container app-page-footer").getByRole("button", { name: /^Continue$/i }),
    page.locator("app-page-footer button.continue-button.bdd-continue").filter({ hasText: /Continue/i }),
    page.locator("app-page-footer").getByRole("button", { name: /^Continue$/i }),
  ];
}

async function chubbIsNextAlertVisible(page: Page): Promise<boolean> {
  const btn = chubbNextAlertButton(page);
  if ((await btn.count().catch(() => 0)) < 1) return false;
  return btn.isVisible().catch(() => false);
}

/** Credit / advisory alert screens on /summary (not Premium Summary). */
async function chubbIsCreditAlertPage(page: Page): Promise<boolean> {
  if (await chubbIsPremiumSummaryVisible(page)) return false;

  const heading = await page
    .locator("h2")
    .filter({ hasText: /Address Discrepancy|Advisory Alert/i })
    .first()
    .isVisible()
    .catch(() => false);
  const warning = await page
    .locator(".alert-warning, app-alert")
    .filter({ hasText: /Credit information was returned|Advisory Alert/i })
    .first()
    .isVisible()
    .catch(() => false);
  const creditData = await page.locator(".credit-result-data").first().isVisible().catch(() => false);
  const nextOrPrevAlert = await page
    .locator("div.left-pad button.next-button, div.left-pad button.previous-button")
    .filter({ hasText: /Next\s*Alert|Previous\s*Alert/i })
    .first()
    .isVisible()
    .catch(() => false);

  return heading || warning || creditData || nextOrPrevAlert;
}

async function chubbResolveCreditFooterContinue(
  page: Page
): Promise<ReturnType<Page["locator"]> | null> {
  for (const locator of chubbCreditFooterContinueButtons(page)) {
    const btn = locator.first();
    if ((await btn.count().catch(() => 0)) < 1) continue;
    if (!(await btn.isVisible().catch(() => false))) continue;

    const hidden = await btn.getAttribute("hidden").catch(() => null);
    if (hidden === "" || hidden === "true") continue;

    const enabled = await btn
      .evaluate((el) => {
        const button = el as HTMLButtonElement;
        return (
          !button.disabled &&
          button.getAttribute("aria-disabled") !== "true" &&
          !button.classList.contains("mat-mdc-button-disabled")
        );
      })
      .catch(() => false);

    if (enabled) return btn;
  }
  return null;
}

async function chubbCanClickCreditAlertContinue(page: Page): Promise<boolean> {
  return (await chubbResolveCreditFooterContinue(page)) !== null;
}

async function chubbClearBlockingOverlays(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      document.querySelectorAll(".cdk-overlay-backdrop").forEach((el) => el.remove());
      const container = document.querySelector(".cdk-overlay-container");
      if (container instanceof HTMLElement) {
        container.style.pointerEvents = "";
      }
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    })
    .catch(() => undefined);
  await page.waitForTimeout(80);
}

async function chubbScrollCreditFooterIntoView(page: Page): Promise<void> {
  await chubbScrollFooterContinueIntoView(page);
  await page
    .evaluate(() => {
      for (const selector of [".dynamic-premium-container", "credit", ".page-content.loaded"]) {
        const el = document.querySelector(selector);
        if (el instanceof HTMLElement) {
          el.scrollTop = el.scrollHeight;
        }
      }
    })
    .catch(() => undefined);
  await page.waitForTimeout(120);
}

async function chubbClickCreditFooterContinueDom(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const selectors = [
      "credit app-page-footer button",
      ".dynamic-premium-container app-page-footer button",
      ".page-footer button",
      "app-page-footer button",
    ];

    for (const selector of selectors) {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(selector));
      const target = buttons.find((btn) => /^\s*continue\s*$/i.test(btn.innerText ?? btn.textContent ?? ""));
      if (!target) continue;
      if (target.disabled || target.getAttribute("aria-disabled") === "true") continue;
      if (target.hasAttribute("hidden")) continue;

      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      target.click();
      return true;
    }

    return false;
  });
}

async function chubbScrollNextAlertIntoView(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const pad = document.querySelector("div.left-pad");
      const btn = document.querySelector(
        "div.left-pad button.next-button:not(.previous-arrow-style), div.left-pad button.link.arrow-action.next-button:not(.previous-arrow-style)"
      );
      if (pad instanceof HTMLElement) {
        pad.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      }
      if (btn instanceof HTMLElement) {
        btn.scrollIntoView({ block: "center", inline: "end", behavior: "instant" });
      }
    })
    .catch(() => undefined);
  await page.waitForTimeout(200);
}

async function chubbWaitForCreditAlertNextAlertOrProceed(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let summarySettledAt: number | null = null;

  while (Date.now() < deadline) {
    await chubbWaitIfSavingQuote(page, 5_000);

    if (await chubbIsNextAlertVisible(page)) return;
    if (await chubbCanClickCreditAlertContinue(page)) return;

    if (await chubbIsCreditAlertPage(page)) {
      summarySettledAt = null;
      await page.waitForTimeout(400);
      continue;
    }

    if (chubbIsOnSummaryUrl(page)) {
      const contentLoaded = await page
        .locator(".page-content.loaded")
        .first()
        .isVisible()
        .catch(() => false);
      if (contentLoaded) {
        if (summarySettledAt === null) summarySettledAt = Date.now();
        if (Date.now() - summarySettledAt >= CHUBB_SUMMARY_NO_ALERT_SETTLE_MS) return;
      }
      await page.waitForTimeout(400);
      continue;
    }

    const footer = await page.locator("app-page-footer, .page-footer").first().isVisible().catch(() => false);
    if (footer) return;

    await page.waitForTimeout(300);
  }
}

async function chubbWaitForNextAlertButton(page: Page, timeoutMs: number): Promise<void> {
  const btn = chubbNextAlertButton(page);
  await btn.waitFor({ state: "visible", timeout: timeoutMs });
  await chubbScrollNextAlertIntoView(page);
}

async function chubbReadCreditAlertFingerprint(page: Page): Promise<string> {
  return page
    .locator(".credit-result-data, h2")
    .first()
    .innerText()
    .catch(() => "");
}

async function chubbClickNextAlertDom(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const matches = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "div.left-pad button.next-button, div.left-pad button.link.arrow-action.next-button"
      )
    ).filter((btn) => {
      if (btn.classList.contains("previous-arrow-style")) return false;
      return /^\s*next\s*alert\s*$/i.test(btn.innerText ?? btn.textContent ?? "");
    });

    const target = matches[0];
    if (!target) return false;

    target.scrollIntoView({ block: "center", inline: "end" });
    const clickTarget = target.querySelector("span") ?? target;
    clickTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    target.click();
    return true;
  });
}

async function chubbClickNextAlert(page: Page): Promise<void> {
  await chubbClearBlockingOverlays(page);
  await chubbWaitForNextAlertButton(page, 30_000);

  const fingerprintBefore = await chubbReadCreditAlertFingerprint(page);
  await chubbScrollNextAlertIntoView(page);

  const btn = chubbNextAlertButton(page);
  let clicked = await btn.click({ timeout: 10_000, force: true, delay: 50 }).then(() => true).catch(() => false);

  if (!clicked) {
    const span = page
      .locator("div.left-pad button.next-button span")
      .filter({ hasText: /^Next Alert$/i })
      .first();
    clicked = await span.click({ timeout: 10_000, force: true }).then(() => true).catch(() => false);
  }

  if (!clicked) {
    clicked = await chubbClickNextAlertDom(page);
  }

  if (!clicked) {
    throw new Error(`CHUBB Next Alert button could not be clicked (URL: ${page.url()}).`);
  }

  const transitionDeadline = Date.now() + 20_000;
  while (Date.now() < transitionDeadline) {
    await chubbWaitIfSavingQuote(page, 3_000);
    const fingerprintAfter = await chubbReadCreditAlertFingerprint(page);
    if (fingerprintAfter !== fingerprintBefore) return;
    if (await chubbCanClickCreditAlertContinue(page)) return;
    await page.waitForTimeout(350);
  }
}

async function chubbClickCreditAlertFooterContinue(page: Page, timeoutMs: number): Promise<void> {
  if (await chubbIsPremiumSummaryVisible(page)) return;

  await chubbClearBlockingOverlays(page);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await chubbIsPremiumSummaryVisible(page)) return;

    await chubbWaitIfSavingQuote(page, 5_000);
    await chubbScrollCreditFooterIntoView(page);

    const continueBtn = await chubbResolveCreditFooterContinue(page);
    if (continueBtn) {
      const clicked = await continueBtn
        .click({ timeout: 15_000, force: true, delay: 40 })
        .then(() => true)
        .catch(() => false);

      if (!clicked) {
        const box = await continueBtn.boundingBox().catch(() => null);
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        } else {
          await continueBtn.evaluate((el: HTMLButtonElement) => {
            el.scrollIntoView({ block: "center", inline: "nearest" });
            el.click();
          });
        }
      }

      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(300);
      return;
    }

    if (await chubbClickCreditFooterContinueDom(page)) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(300);
      return;
    }

    try {
      await chubbClickFooterContinue(page, Math.min(12_000, deadline - Date.now()));
      return;
    } catch {
      // keep polling until deadline
    }

    await page.waitForTimeout(300);
  }

  if (await chubbIsPremiumSummaryVisible(page)) return;

  throw new Error(
    `CHUBB credit alert footer Continue not clickable (URL: ${page.url()}).`
  );
}

async function chubbWaitForFormAfterCreditContinue(page: Page, timeoutMs: number): Promise<void> {
  const urlBefore = page.url();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await chubbWaitIfSavingQuote(page, 5_000);

    if (await chubbIsPremiumSummaryVisible(page)) return;

    if (page.url() !== urlBefore) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(400);
      if (await chubbIsPremiumSummaryVisible(page)) return;
    }

    const stillOnCreditAlerts =
      (await chubbIsNextAlertVisible(page)) ||
      ((await chubbIsCreditAlertPage(page)) && (await chubbCanClickCreditAlertContinue(page)));

    if (!stillOnCreditAlerts && (await chubbIsEzQuoteNonResidenceScreenReady(page))) return;

    await page.waitForTimeout(300);
  }
}

async function chubbIsPremiumSummaryVisible(page: Page): Promise<boolean> {
  const heading = await page
    .locator("h2.prem-header-title, h2")
    .filter({ hasText: /Premium Summary/i })
    .first()
    .isVisible()
    .catch(() => false);
  const printer = await page
    .locator(
      "div.print-prem-summary-text div.printer mat-icon[svgicon='printer'], div.printer mat-icon[svgicon='printer'], mat-icon[data-mat-icon-name='printer']"
    )
    .first()
    .isVisible()
    .catch(() => false);
  return heading || printer;
}

async function chubbWaitForPremiumSummary(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await chubbWaitIfSavingQuote(page, 5_000);
    if (await chubbIsPremiumSummaryVisible(page)) {
      await page.waitForTimeout(400);
      return;
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`CHUBB Premium Summary did not load within ${timeoutMs}ms (URL: ${page.url()}).`);
}

async function chubbResolvePremiumSummaryPrintTrigger(
  page: Page
): Promise<ReturnType<Page["locator"]> | null> {
  const locators = [
    page.locator("div.print-prem-summary-text div.printer mat-icon[svgicon='printer']"),
    page.locator("div.printer mat-icon[svgicon='printer']"),
    page.locator("mat-icon[data-mat-icon-name='printer']").first(),
  ];

  for (const locator of locators) {
    const icon = locator.first();
    if ((await icon.count().catch(() => 0)) < 1) continue;
    if (await icon.isVisible().catch(() => false)) return icon;
  }
  return null;
}

async function chubbDownloadPremiumSummaryPdf(
  page: Page,
  payload: unknown,
  jobId: string | undefined,
  timeoutMs: number
): Promise<string> {
  await chubbWaitForPremiumSummary(page, Math.max(timeoutMs, 60_000));
  await chubbClearBlockingOverlays(page);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const trigger = await chubbResolvePremiumSummaryPrintTrigger(page);
    if (trigger) {
      return downloadChubbPdfFromTrigger(page, trigger, payload, jobId);
    }
    await page.waitForTimeout(350);
  }

  throw new Error(`CHUBB Premium Summary print icon not found (URL: ${page.url()}).`);
}

async function chubbWaitForCreditAlertContinueReady(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await chubbIsPremiumSummaryVisible(page)) return true;
    if (await chubbCanClickCreditAlertContinue(page)) return true;
    await chubbWaitIfSavingQuote(page, 3_000);
    await chubbScrollCreditFooterIntoView(page);
    await page.waitForTimeout(250);
  }
  return (await chubbCanClickCreditAlertContinue(page)) || (await chubbIsPremiumSummaryVisible(page));
}

async function chubbProcessCreditAlertsIfPresent(
  page: Page,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<boolean> {
  updateStep("chubb_wait_credit_alert_next_alert");
  await chubbWaitForCreditAlertNextAlertOrProceed(page, CHUBB_CREDIT_ALERT_WAIT_MS);

  if (await chubbIsPremiumSummaryVisible(page)) return false;

  const hasNextAlert = await chubbIsNextAlertVisible(page);
  const onCreditAlert = await chubbIsCreditAlertPage(page);
  const canContinue = await chubbCanClickCreditAlertContinue(page);

  if (!hasNextAlert && !onCreditAlert && !canContinue) return false;

  let alertClicks = 0;
  while (alertClicks < CHUBB_MAX_NEXT_ALERT_CLICKS) {
    if (await chubbIsPremiumSummaryVisible(page)) return true;

    if (!(await chubbIsNextAlertVisible(page))) {
      const ready = await chubbWaitForCreditAlertContinueReady(page, 45_000);
      if (ready) break;
      if (!(await chubbIsCreditAlertPage(page))) return false;
      break;
    }

    updateStep("chubb_credit_next_alert_click");
    await chubbClickNextAlert(page);
    alertClicks += 1;

    await chubbWaitIfSavingQuote(page, 15_000);
    await page.waitForTimeout(250);

    if (await chubbIsPremiumSummaryVisible(page)) return true;
    if (!(await chubbIsNextAlertVisible(page)) && (await chubbCanClickCreditAlertContinue(page))) {
      break;
    }
  }

  if (alertClicks >= CHUBB_MAX_NEXT_ALERT_CLICKS && (await chubbIsNextAlertVisible(page))) {
    throw new Error("CHUBB credit alerts: too many Next Alert clicks without clearing the alert flow.");
  }

  if (await chubbIsPremiumSummaryVisible(page)) return true;

  updateStep("chubb_credit_alerts_footer_continue");
  await chubbClickCreditAlertFooterContinue(page, 60_000);
  await chubbWaitIfSavingQuote(page, 30_000);
  await chubbWaitForFormAfterCreditContinue(page, 90_000);
  return true;
}

/**
 * After Interested Parties:
 * - If credit alerts: Next Alert loop → Continue → Premium Summary
 * - Else: go straight to Premium Summary when visible
 * - Click print icon and save PDF locally (*-chubb-*.pdf)
 */
export async function runChubbPostInterestedPartiesHold(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<{ pdfPath?: string }> {
  updateStep("chubb_wait_post_interested_parties_form");
  await chubbWaitForPostInterestedPartiesScreen(page, Math.max(timeoutMs, 60_000));
  await chubbWaitIfSavingQuote(page, 30_000);

  if (!(await chubbIsPremiumSummaryVisible(page))) {
    await chubbProcessCreditAlertsIfPresent(page, timeoutMs, updateStep);
  }

  updateStep("chubb_premium_summary_print");
  const pdfPath = await chubbDownloadPremiumSummaryPdf(page, payload, jobId, timeoutMs);
  updateStep("chubb_pdf_downloaded");
  return { pdfPath };
}
