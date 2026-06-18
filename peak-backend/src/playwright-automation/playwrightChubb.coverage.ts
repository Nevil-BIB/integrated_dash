import type { Page } from "playwright";

const DEFAULT_RISK_STATE = "Alabama";

function chubbRiskState(): string {
  return String(process.env.CHUBB_QUOTE_RISK_STATE ?? DEFAULT_RISK_STATE).trim() || DEFAULT_RISK_STATE;
}

async function chubbWaitForCoverageModal(page: Page, timeoutMs: number): Promise<void> {
  await page
    .locator(".modal-content__coverages, .form-section")
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  await page
    .locator(".modal-content__coverage-item")
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
}

async function chubbSelectHomeCoverage(page: Page, timeoutMs: number): Promise<void> {
  const homeTile = page
    .locator(".modal-content__coverage-item")
    .filter({ has: page.locator(".modal-content__coverage-text", { hasText: /^Home$/ }) })
    .first();

  await homeTile.waitFor({ state: "visible", timeout: timeoutMs });
  await homeTile.scrollIntoViewIfNeeded().catch(() => undefined);
  await homeTile.click({ timeout: 15_000, delay: 40 });

  await homeTile
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);

  const selected = await homeTile.evaluate((el) => el.classList.contains("selected")).catch(() => false);
  if (!selected) {
    await homeTile.click({ timeout: 15_000, delay: 40 });
  }

  await page.locator("#Slider.slide-down, #Slider").first().waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function chubbSelectRiskState(page: Page, stateName: string, timeoutMs: number): Promise<void> {
  const combobox = page
    .locator(
      '#stateDropdown [role="combobox"], p-select#stateDropdown [role="combobox"], [aria-label="Select the risk location state"]'
    )
    .first();

  await combobox.waitFor({ state: "visible", timeout: timeoutMs });
  await combobox.scrollIntoViewIfNeeded().catch(() => undefined);
  await combobox.click({ timeout: 15_000, delay: 40 });

  const option = page
    .locator('[role="listbox"] [role="option"], .p-select-option, .p-select-list .p-select-option')
    .filter({ hasText: new RegExp(`^${stateName}$`, "i") })
    .first();

  await option.waitFor({ state: "visible", timeout: timeoutMs });
  await option.click({ timeout: 15_000, delay: 40 });

  await page.waitForTimeout(150);
}

async function chubbClickCoverageContinue(page: Page, timeoutMs: number): Promise<void> {
  const continueBtn = page
    .locator("button.cb-button--primary-purple, button[cbbutton][variant='primary']")
    .filter({ hasText: /^Continue$/i })
    .first();

  await continueBtn.waitFor({ state: "visible", timeout: timeoutMs });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await continueBtn.click({ timeout: 15_000, delay: 40 });

  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
}

/**
 * Coverage modal: Home → risk state (default Alabama) → Continue.
 */
export async function runChubbCoverageSelection(
  page: Page,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  const stateName = chubbRiskState();

  updateStep("chubb_wait_coverage_modal");
  await chubbWaitForCoverageModal(page, Math.max(timeoutMs, 60_000));

  updateStep("chubb_select_home_coverage");
  await chubbSelectHomeCoverage(page, timeoutMs);

  updateStep("chubb_select_risk_state");
  await chubbSelectRiskState(page, stateName, timeoutMs);

  updateStep("chubb_coverage_continue");
  await chubbClickCoverageContinue(page, timeoutMs);
}
