import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import {
  chubbProducerCode,
  chubbSubProducerCode,
  formatChubbEffectiveDateMmDdYyyy,
} from "./playwrightChubb.payload";

async function chubbDispatchInputEvents(
  input: ReturnType<Page["locator"]>,
  value: string
): Promise<void> {
  await input.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
}

async function chubbWaitForPolicyInformationPage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const onUrl = /policy-information/i.test(page.url());
    const bddPage = await page.locator(".bdd-policy-information").first().isVisible().catch(() => false);
    const sectionHeader = await page
      .locator("h2")
      .filter({ hasText: /risk state and the effective date/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (onUrl || bddPage || sectionHeader) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    `CHUBB policy information page did not load within ${timeoutMs}ms (URL: ${page.url()}).`
  );
}

async function chubbEnsureHomeProductSelected(page: Page): Promise<void> {
  const homeBtn = page.locator("a.big-button-checkbox.lob-homeowners.active, a.lob-homeowners.active").first();
  if (await homeBtn.isVisible().catch(() => false)) return;

  const homeInactive = page
    .locator("a.big-button-checkbox.lob-homeowners")
    .filter({ has: page.locator("figcaption", { hasText: /^Home$/ }) })
    .first();
  if (await homeInactive.isVisible().catch(() => false)) {
    await homeInactive.click({ timeout: 10_000, delay: 40 });
    await page.waitForTimeout(150);
  }
}

async function chubbFillEffectiveDate(page: Page, effectiveDate: string, timeoutMs: number): Promise<void> {
  const effectiveInput = page
    .locator('input.effective-date, input[name="EffectiveDate"], #mat-input-0')
    .first();

  await effectiveInput.waitFor({ state: "visible", timeout: timeoutMs });
  await effectiveInput.scrollIntoViewIfNeeded().catch(() => undefined);
  await effectiveInput.click({ delay: 40 });
  await effectiveInput.fill(effectiveDate);
  await chubbDispatchInputEvents(effectiveInput, effectiveDate);
  await page.waitForTimeout(150);
}

async function chubbFillPolicyTextInput(
  input: ReturnType<Page["locator"]>,
  value: string
): Promise<void> {
  await input.evaluate((el: HTMLInputElement, v: string) => {
    el.focus({ preventScroll: true });
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);

  const current = (await input.inputValue().catch(() => "")).trim();
  if (current !== value) {
    await input.fill(value);
    await chubbDispatchInputEvents(input, value);
  }
}

async function chubbFillProducerAndSubProducerCodes(
  page: Page,
  producerCode: string,
  subProducerCode: string,
  timeoutMs: number
): Promise<void> {
  const producerInput = page.locator("#bdd-ProducerCode, input.producer-code").first();
  const subProducerInput = page.locator("#bdd-SubProducerCode, input.sub-producer-code").first();

  await producerInput.waitFor({ state: "visible", timeout: timeoutMs });
  await chubbFillPolicyTextInput(producerInput, producerCode);
  await page.waitForTimeout(120);

  await subProducerInput.waitFor({ state: "attached", timeout: timeoutMs });
  await producerInput.press("Tab").catch(() => undefined);
  await page.waitForTimeout(80);
  await chubbFillPolicyTextInput(subProducerInput, subProducerCode);

  const subValue = (await subProducerInput.inputValue().catch(() => "")).trim();
  if (subValue !== subProducerCode) {
    throw new Error(
      `CHUBB sub producer code was not set (expected ${subProducerCode}, got "${subValue}").`
    );
  }

  await subProducerInput.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  });
  await page.waitForTimeout(120);
}

async function chubbSelectNewClient(page: Page, timeoutMs: number): Promise<void> {
  const newClientRadio = page
    .locator("mat-radio-button.new-or-existing-client-option-new-client")
    .first();

  await newClientRadio.scrollIntoViewIfNeeded().catch(() => undefined);

  if (await newClientRadio.isVisible().catch(() => false)) {
    await newClientRadio.click({ timeout: 15_000, force: true, delay: 40 });
  } else {
    const label = page.getByLabel(/New Client/i).first();
    await label.waitFor({ state: "visible", timeout: timeoutMs });
    await label.click({ timeout: 15_000, force: true, delay: 40 });
  }

  const nativeInput = page.locator("#mat-radio-0-input").first();
  if (!(await nativeInput.isChecked().catch(() => false))) {
    await nativeInput.check({ force: true }).catch(() => undefined);
  }

  await page.waitForTimeout(200);
}

/**
 * Masterpiece EZ Quote policy information: effective date, producer/sub producer code, New Client → Continue.
 */
export async function runChubbPolicyInformation(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  const effectiveDate = formatChubbEffectiveDateMmDdYyyy(payload);
  const producerCode = chubbProducerCode();
  const subProducerCode = chubbSubProducerCode();

  updateStep("chubb_wait_policy_information");
  await chubbWaitForPolicyInformationPage(page, Math.max(timeoutMs, 90_000));

  updateStep("chubb_ensure_home_product");
  await chubbEnsureHomeProductSelected(page);

  updateStep("chubb_fill_effective_date");
  await chubbFillEffectiveDate(page, effectiveDate, timeoutMs);

  updateStep("chubb_fill_producer_codes");
  await chubbFillProducerAndSubProducerCodes(page, producerCode, subProducerCode, timeoutMs);

  updateStep("chubb_select_new_client");
  await chubbSelectNewClient(page, timeoutMs);

  updateStep("chubb_policy_information_continue");
  await chubbClickFooterContinue(page, timeoutMs);
}
