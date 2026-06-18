import type { Locator, Page } from "playwright";
import {
  CHUBB_CONTINUE_ENABLE_POLL_MS,
  CHUBB_MFA_SCREEN_SETTLE_MS,
  CHUBB_OTP_INPUT_SELECTORS,
  CHUBB_OTP_SUBMIT_SELECTORS,
  CHUBB_SECURITY_CHECK_FORM,
} from "./playwrightChubb.constants";
import { pollChubbWebhookOtp } from "./playwrightChubb.otp";

async function chubbFirstVisibleLocator(
  page: Page,
  selectors: string[],
  timeoutMs: number
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      if (await loc.isVisible().catch(() => false)) return loc;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`CHUBB: no visible element for selectors: ${selectors.join(", ")}`);
}

async function chubbIsButtonEnabled(btn: Locator): Promise<boolean> {
  const enabled = await btn.isEnabled().catch(() => false);
  const disabledAttr = await btn.getAttribute("disabled").catch(() => null);
  const ariaDisabled = await btn.getAttribute("aria-disabled").catch(() => null);
  return enabled && disabledAttr === null && ariaDisabled !== "true";
}

async function chubbIsContinueEnabled(page: Page): Promise<boolean> {
  const continueBtn = page.locator(`${CHUBB_SECURITY_CHECK_FORM} #continue`).first();
  return chubbIsButtonEnabled(continueBtn);
}

async function chubbFindOtpSubmitButton(page: Page): Promise<Locator | null> {
  for (const selector of CHUBB_OTP_SUBMIT_SELECTORS) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) return btn;
  }

  const byLabel = page
    .locator(`${CHUBB_SECURITY_CHECK_FORM} button`)
    .filter({ hasText: /^(Continue|Verify|Submit)$/i })
    .first();
  if (await byLabel.isVisible().catch(() => false)) return byLabel;

  return null;
}

async function chubbIsOtpSubmitEnabled(page: Page): Promise<boolean> {
  const btn = await chubbFindOtpSubmitButton(page);
  if (!btn) return false;
  return chubbIsButtonEnabled(btn);
}

async function chubbDispatchRadioSelectionEvents(radio: Locator): Promise<void> {
  await radio.evaluate((el: HTMLInputElement) => {
    el.checked = true;
    el.focus();
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  });
}

async function chubbWaitForRadioChecked(radio: Locator, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await radio.isChecked().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 80));
  }
}

async function chubbClickReceiveEmailMfaOption(page: Page): Promise<void> {
  const radio = page.locator("#extension_EmailTelephoneMFAType_emailOTP").first();
  const label = page.locator("#emailOTP_option").first();

  await radio.scrollIntoViewIfNeeded().catch(() => undefined);

  if (await label.isVisible().catch(() => false)) {
    await label.click({ timeout: 10_000, delay: 40 });
  } else {
    await radio.click({ timeout: 10_000, delay: 40 });
  }

  await chubbWaitForRadioChecked(radio, 5_000);

  if (!(await radio.isChecked().catch(() => false))) {
    await radio.click({ timeout: 10_000, delay: 40 }).catch(() => undefined);
    await chubbWaitForRadioChecked(radio, 5_000);
  }

  if (!(await radio.isChecked().catch(() => false))) {
    await chubbDispatchRadioSelectionEvents(radio);
  }

  if (!(await radio.isChecked().catch(() => false))) {
    throw new Error('CHUBB could not select "Receive an email" MFA option.');
  }

  await page.waitForTimeout(80);
}

async function chubbWaitForSecurityCheckScreen(page: Page, timeoutMs: number): Promise<void> {
  await page
    .locator("#first_screen_main_text")
    .filter({ hasText: /Quick security check/i })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator(CHUBB_SECURITY_CHECK_FORM).waitFor({ state: "visible", timeout: timeoutMs });
  await page
    .locator("#extension_EmailTelephoneMFAType_emailOTP")
    .waitFor({ state: "visible", timeout: timeoutMs });
  await page
    .locator(`${CHUBB_SECURITY_CHECK_FORM} #continue`)
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(CHUBB_MFA_SCREEN_SETTLE_MS);
}

async function chubbWaitForSecurityContinueEnabled(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let retriedSelection = false;

  while (Date.now() - start < timeoutMs) {
    if (await chubbIsContinueEnabled(page)) return;

    if (!retriedSelection && Date.now() - start > 2_000) {
      retriedSelection = true;
      await chubbClickReceiveEmailMfaOption(page);
    }

    await page.waitForTimeout(CHUBB_CONTINUE_ENABLE_POLL_MS);
  }

  throw new Error(
    "CHUBB security check Continue (#continue) stayed disabled after selecting Receive an email."
  );
}

async function chubbSelectReceiveEmailAndContinue(page: Page, timeoutMs: number): Promise<void> {
  await chubbClickReceiveEmailMfaOption(page);
  await chubbWaitForSecurityContinueEnabled(page, Math.max(timeoutMs, 45_000));

  const continueBtn = page.locator(`${CHUBB_SECURITY_CHECK_FORM} #continue`).first();
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await continueBtn.click({ timeout: 15_000 }).catch(async () => {
    await continueBtn.evaluate((el: HTMLButtonElement) => el.click());
  });
}

async function chubbWaitForCodeEntryScreen(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page
      .locator(".verifying-modal")
      .waitFor({ state: "hidden", timeout: 1500 })
      .catch(() => undefined);

    const codeScreenTitle = await page
      .locator("#second_screen_main_text")
      .filter({ hasText: /Type in your code/i })
      .first()
      .isVisible()
      .catch(() => false);

    for (const selector of CHUBB_OTP_INPUT_SELECTORS) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        return;
      }
    }

    if (codeScreenTitle) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(
    `CHUBB did not reach code entry screen after security Continue within ${timeoutMs}ms (URL: ${page.url()}).`
  );
}

async function chubbWaitForOtpCodeScreen(page: Page, timeoutMs: number): Promise<void> {
  await page
    .locator("#second_screen_main_text")
    .filter({ hasText: /Type in your code/i })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs })
    .catch(() => undefined);
}

async function chubbDispatchOtpInputEvents(codeInput: Locator, otp: string): Promise<void> {
  await codeInput.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("keyup", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, otp);
}

async function chubbFillOtpInput(page: Page, otp: string, timeoutMs: number): Promise<void> {
  await chubbWaitForOtpCodeScreen(page, timeoutMs);

  const codeInput = await chubbFirstVisibleLocator(page, CHUBB_OTP_INPUT_SELECTORS, timeoutMs);
  await codeInput.scrollIntoViewIfNeeded().catch(() => undefined);
  await codeInput.click({ delay: 40 });
  await codeInput.fill("");
  await codeInput.pressSequentially(otp, { delay: 60 });
  await chubbDispatchOtpInputEvents(codeInput, otp);
  await page.waitForTimeout(150);
}

async function chubbSubmitOtpForm(page: Page): Promise<boolean> {
  return page
    .locator(CHUBB_SECURITY_CHECK_FORM)
    .evaluate((form) => {
      if (!(form instanceof HTMLFormElement)) return false;
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
        return true;
      }
      form.submit();
      return true;
    })
    .catch(() => false);
}

async function chubbClickOtpSubmit(page: Page, otp: string, timeoutMs: number): Promise<void> {
  const waitMs = Math.max(timeoutMs, 45_000);
  const start = Date.now();
  let retriedFill = false;

  while (Date.now() - start < waitMs) {
    if (await chubbIsOtpSubmitEnabled(page)) break;

    if (!retriedFill && Date.now() - start > 2_000) {
      retriedFill = true;
      await chubbFillOtpInput(page, otp, 10_000).catch(() => undefined);
    }

    await page.waitForTimeout(CHUBB_CONTINUE_ENABLE_POLL_MS);
  }

  const submitBtn = await chubbFindOtpSubmitButton(page);
  if (submitBtn && (await chubbIsButtonEnabled(submitBtn))) {
    await submitBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(80);
    await submitBtn.click({ timeout: 15_000, delay: 40 }).catch(async () => {
      await submitBtn.evaluate((el: HTMLButtonElement) => el.click());
    });
    return;
  }

  if (await chubbSubmitOtpForm(page)) {
    await page.waitForTimeout(300);
    return;
  }

  const continueBtn = page.locator(`${CHUBB_SECURITY_CHECK_FORM} #continue`).first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.evaluate((el: HTMLButtonElement) => el.click());
    return;
  }

  throw new Error(
    "CHUBB OTP submit did not run — Continue/Verify stayed disabled or was not clickable after entering the code."
  );
}

/**
 * Quick security check: email MFA → Continue → poll webhook → enter OTP → submit.
 */
export async function runChubbSecurityCheckAndOtp(
  page: Page,
  webhookUrl: string,
  timeoutMs: number,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("chubb_security_check_loading");
  await chubbWaitForSecurityCheckScreen(page, timeoutMs);

  updateStep("chubb_security_check_select_email");
  await chubbSelectReceiveEmailAndContinue(page, timeoutMs);

  updateStep("chubb_wait_code_entry_screen");
  await chubbWaitForCodeEntryScreen(page, Math.max(timeoutMs, 60_000));

  updateStep("chubb_poll_webhook_otp");
  const otp = await pollChubbWebhookOtp(webhookUrl);

  updateStep("chubb_mfa_enter_otp");
  await chubbFillOtpInput(page, otp, timeoutMs);

  updateStep("chubb_mfa_submit");
  await chubbClickOtpSubmit(page, otp, timeoutMs);

  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page
    .locator(".verifying-modal")
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);
}
