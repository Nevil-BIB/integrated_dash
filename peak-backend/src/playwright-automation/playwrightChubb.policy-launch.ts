import type { BrowserContext, Page } from "playwright";

async function chubbWaitForPolicyLaunchScreen(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const policySystem = await page.locator("policy-system.policy-system, .policy-system").first().isVisible().catch(() => false);
    const launchVisible = await page
      .locator(".policy-system__launch")
      .filter({ hasText: /Launch Masterpiece EZ Quote/i })
      .first()
      .isVisible()
      .catch(() => false);
    const summaryVisible = await page
      .locator(".policy-system__selected-coverage")
      .filter({ hasText: /Home/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (policySystem && (launchVisible || summaryVisible)) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    `CHUBB policy launch screen did not load within ${timeoutMs}ms (URL: ${page.url()}).`
  );
}

async function chubbClickLaunchMasterpieceEzQuote(page: Page, context: BrowserContext, timeoutMs: number): Promise<Page> {
  const launchBtn = page
    .locator(".policy-system__launch")
    .filter({ hasText: /Launch Masterpiece EZ Quote/i })
    .first();

  await launchBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await launchBtn.scrollIntoViewIfNeeded().catch(() => undefined);

  const popupPromise = context.waitForEvent("page", { timeout: timeoutMs }).catch(() => null);

  await launchBtn.click({ timeout: 15_000, delay: 40 });

  const newPage = await popupPromise;
  if (newPage) {
    newPage.setDefaultTimeout(timeoutMs);
    await newPage.waitForLoadState("domcontentloaded").catch(() => undefined);
    return newPage;
  }

  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  return page;
}

/**
 * Policy system summary → Launch Masterpiece EZ Quote (may open same tab or new tab).
 */
export async function runChubbPolicyLaunch(
  page: Page,
  context: BrowserContext,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<Page> {
  updateStep("chubb_wait_policy_launch_screen");
  await chubbWaitForPolicyLaunchScreen(page, Math.max(timeoutMs, 60_000));

  updateStep("chubb_click_launch_masterpiece");
  return chubbClickLaunchMasterpieceEzQuote(page, context, timeoutMs);
}
