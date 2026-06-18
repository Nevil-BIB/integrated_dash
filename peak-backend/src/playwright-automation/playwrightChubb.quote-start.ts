import type { Page } from "playwright";

async function chubbWaitForPersonalLinesDashboard(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page
      .locator(".verifying-modal, .working")
      .waitFor({ state: "hidden", timeout: 1500 })
      .catch(() => undefined);

    const personalLineCard = await page
      .locator(".greeting__card__layout-personalLine")
      .isVisible()
      .catch(() => false);
    const welcomeText = await page
      .locator(".greeting__message")
      .filter({ hasText: /welcome to Personal Lines/i })
      .first()
      .isVisible()
      .catch(() => false);
    const searchTabs = await page
      .locator(".dashboard__search-tabs.personal-lines-tabs")
      .isVisible()
      .catch(() => false);

    if (personalLineCard || welcomeText || searchTabs) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    `CHUBB Personal Lines dashboard did not load within ${timeoutMs}ms (URL: ${page.url()}).`
  );
}

async function chubbClickStartNewQuoteTab(page: Page, timeoutMs: number): Promise<void> {
  const desktopTab = page
    .locator(".dashboard__search-tabs mat-tab")
    .filter({ has: page.locator("mat-label", { hasText: /Start a\s*new quote/i }) })
    .first();

  if (await desktopTab.isVisible().catch(() => false)) {
    await desktopTab.scrollIntoViewIfNeeded().catch(() => undefined);
    await desktopTab.click({ timeout: 15_000, delay: 40 });
    await page.waitForTimeout(200);
    return;
  }

  const tabLabel = page.locator("mat-label.newquote-label, mat-label").filter({ hasText: /Start a\s*new quote/i }).first();
  if (await tabLabel.isVisible().catch(() => false)) {
    await tabLabel.click({ timeout: 15_000, delay: 40 });
    await page.waitForTimeout(200);
    return;
  }

  const mobileBtn = page
    .locator("#mobile-view-button-content-label")
    .filter({ hasText: /Start a new quote/i })
    .first();
  if (await mobileBtn.isVisible().catch(() => false)) {
    await mobileBtn.click({ timeout: 15_000, delay: 40 });
    await page.waitForTimeout(200);
    return;
  }

  const tabByRole = page.getByRole("tab", { name: /Start a\s*new quote/i }).first();
  await tabByRole.waitFor({ state: "visible", timeout: timeoutMs });
  await tabByRole.click({ timeout: 15_000, delay: 40 });
  await page.waitForTimeout(200);
}

async function chubbClickGetAQuote(page: Page, timeoutMs: number): Promise<void> {
  const getQuoteBtn = page.locator(".tab-content__button").filter({ hasText: /Get a quote/i }).first();
  await getQuoteBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await getQuoteBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await getQuoteBtn.click({ timeout: 15_000, delay: 40 });

  await page
    .locator(".search__wrapper, app-get-quote")
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs })
    .catch(() => undefined);
}

/**
 * Personal Lines dashboard → Start a new quote → Get a quote.
 */
export async function runChubbPersonalLinesQuoteStart(
  page: Page,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  updateStep("chubb_wait_personal_lines_dashboard");
  await chubbWaitForPersonalLinesDashboard(page, Math.max(timeoutMs, 90_000));

  updateStep("chubb_click_start_new_quote");
  await chubbClickStartNewQuoteTab(page, timeoutMs);

  updateStep("chubb_click_get_a_quote");
  await chubbClickGetAQuote(page, timeoutMs);
}
