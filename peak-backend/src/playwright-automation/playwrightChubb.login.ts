import type { Page } from "playwright";
import {
  CHUBB_LOCAL_ACCOUNT_FORM,
  CHUBB_LOCAL_ACCOUNT_SIGNIN_BTN,
  CHUBB_UNIFIED_API,
} from "./playwrightChubb.constants";

export async function chubbWaitForLocalAccountForm(page: Page, timeoutMs: number): Promise<void> {
  await page.locator(CHUBB_UNIFIED_API).waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);
  await page.locator(CHUBB_LOCAL_ACCOUNT_FORM).waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator(`${CHUBB_LOCAL_ACCOUNT_FORM} #signInName`).waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator(`${CHUBB_LOCAL_ACCOUNT_FORM} #password`).waitFor({ state: "visible", timeout: timeoutMs });
}

export async function chubbEnsureLocalAccountSigninVisible(page: Page, timeoutMs: number): Promise<void> {
  const signInName = page.locator(`${CHUBB_LOCAL_ACCOUNT_FORM} #signInName`).first();
  if (await signInName.isVisible().catch(() => false)) return;

  const localBtn = page.locator(CHUBB_LOCAL_ACCOUNT_SIGNIN_BTN).first();
  if (await localBtn.isVisible().catch(() => false)) {
    await localBtn.click({ timeout: timeoutMs });
    await signInName.waitFor({ state: "visible", timeout: timeoutMs });
  }
}

export async function chubbFillLocalAccountForm(
  page: Page,
  username: string,
  password: string,
  timeoutMs: number
): Promise<void> {
  const signIn = page.locator(`${CHUBB_LOCAL_ACCOUNT_FORM} #signInName`).first();
  const pwd = page.locator(`${CHUBB_LOCAL_ACCOUNT_FORM} #password`).first();

  await signIn.waitFor({ state: "visible", timeout: timeoutMs });
  await signIn.scrollIntoViewIfNeeded().catch(() => undefined);
  await signIn.click();
  await signIn.fill(username);
  await signIn.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, username);

  await pwd.waitFor({ state: "visible", timeout: timeoutMs });
  await pwd.scrollIntoViewIfNeeded().catch(() => undefined);
  await pwd.click();
  await pwd.fill(password);
  await pwd.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, password);
}

export async function chubbClickLoginButton(page: Page, timeoutMs: number): Promise<void> {
  const loginBtn = page.locator(`${CHUBB_LOCAL_ACCOUNT_FORM} #next`).first();
  await loginBtn.waitFor({ state: "visible", timeout: timeoutMs });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const enabled = await loginBtn.isEnabled().catch(() => false);
    const disabledAttr = await loginBtn.getAttribute("disabled").catch(() => null);
    if (enabled && disabledAttr === null) break;
    await page.waitForTimeout(100);
  }

  if (!(await loginBtn.isEnabled().catch(() => false))) {
    throw new Error("CHUBB Login button (#next) stayed disabled after filling User ID and Password.");
  }

  await loginBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await loginBtn.click({ timeout: 15_000 }).catch(async () => {
    await loginBtn.evaluate((el: HTMLButtonElement) => el.click());
  });
}

export async function chubbWaitForPostLoginScreen(page: Page, timeoutMs: number): Promise<void> {
  const loginForm = page.locator(CHUBB_LOCAL_ACCOUNT_FORM);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await page
      .locator(".working, .verifying-modal")
      .waitFor({ state: "hidden", timeout: 1500 })
      .catch(() => undefined);

    const securityCheck = await page
      .locator("#first_screen_main_text")
      .filter({ hasText: /Quick security check/i })
      .first()
      .isVisible()
      .catch(() => false);
    const emailMfaRadio = await page.locator("#extension_EmailTelephoneMFAType_emailOTP").isVisible().catch(() => false);
    const formHidden = !(await loginForm.isVisible().catch(() => true));
    const signInHidden = await page.locator("#signInName").isHidden().catch(() => false);
    const onAgentPortal = /agentview\.chubb\.com/i.test(page.url());

    if (securityCheck || emailMfaRadio || formHidden || signInHidden || onAgentPortal) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(`CHUBB did not advance past Login within ${timeoutMs}ms (URL: ${page.url()}).`);
}

export async function runChubbLocalAccountLogin(
  page: Page,
  username: string,
  password: string,
  timeoutMs: number,
  updateStep: (s: string) => void,
  jobId?: string,
  phase: "initial" | "post_otp" = "initial"
): Promise<void> {
  const prefix = phase === "post_otp" ? "chubb_post_otp" : "chubb";

  updateStep(`${prefix}_wait_local_account_form`);
  await chubbWaitForLocalAccountForm(page, timeoutMs);
  await chubbEnsureLocalAccountSigninVisible(page, timeoutMs);

  updateStep(`${prefix}_fill_local_account`);
  await chubbFillLocalAccountForm(page, username, password, timeoutMs);

  updateStep(`${prefix}_click_login`);
  await chubbClickLoginButton(page, timeoutMs);

  if (phase === "initial") {
    updateStep("chubb_wait_post_login_screen");
    await chubbWaitForPostLoginScreen(page, Math.max(timeoutMs, 60_000));
    return;
  }

  updateStep("chubb_post_otp_wait_agent_portal");
  const start = Date.now();
  const waitMs = Math.max(timeoutMs, 60_000);
  while (Date.now() - start < waitMs) {
    if (/agentview\.chubb\.com/i.test(page.url())) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }
    const securityCheck = await page
      .locator("#first_screen_main_text")
      .filter({ hasText: /Quick security check/i })
      .first()
      .isVisible()
      .catch(() => false);
    if (securityCheck) return;
    await page.waitForTimeout(250);
  }
}

export function chubbIsAgentPortalUrl(url: string): boolean {
  return /agentview\.chubb\.com/i.test(url);
}

export async function chubbWaitForPostOtpUnifiedScreen(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page
      .locator(".verifying-modal, .working")
      .waitFor({ state: "hidden", timeout: 1500 })
      .catch(() => undefined);

    const unified = await page.locator(CHUBB_UNIFIED_API).isVisible().catch(() => false);
    const localForm = await page.locator(CHUBB_LOCAL_ACCOUNT_FORM).isVisible().catch(() => false);
    const onAgentPortal = /agentview\.chubb\.com/i.test(page.url());

    if (unified || localForm || onAgentPortal) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(
    `CHUBB did not reach post-OTP screen (Unified login) within ${timeoutMs}ms (URL: ${page.url()}).`
  );
}
