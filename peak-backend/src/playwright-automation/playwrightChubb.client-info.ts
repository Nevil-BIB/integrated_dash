import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import {
  chubbCloseMatSelectIfOpen,
  chubbMatSelectDisplayValue,
  chubbMatSelectIsEmpty,
  chubbSelectMatSelectOption,
} from "./playwrightChubb.mat-select";
import {
  chubbDismissHeaderResourcesMenu,
  chubbIsHeaderResourcesMenuPanelVisible,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";
import {
  chubbClientEmail,
  chubbClientFirstName,
  chubbClientLastName,
  chubbClientSocialSecurityDigits,
  formatChubbDateOfBirthMmDdYyyy,
} from "./playwrightChubb.payload";

const CHUBB_DEFAULT_OCCUPATION = "Agriculture";
const CHUBB_DEFAULT_OCCUPATION_DETAIL = "Administrative Assistant";

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

async function chubbScrollFieldBelowHeader(locator: ReturnType<Page["locator"]>): Promise<void> {
  await locator.evaluate((el) => {
    const header = document.querySelector("#header-container, app-header");
    const headerBottom =
      header instanceof HTMLElement ? header.getBoundingClientRect().bottom : 72;
    const rect = el.getBoundingClientRect();
    const delta = rect.top - headerBottom - 20;
    if (Math.abs(delta) > 2) {
      window.scrollBy({ top: delta, behavior: "instant" });
    }
  });
}

async function chubbReadInputValue(locator: ReturnType<Page["locator"]>): Promise<string> {
  return locator.inputValue().catch(() => "");
}

function chubbDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

async function chubbFillTextInput(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  value: string,
  opts?: { masked?: boolean }
): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await chubbScrollFieldBelowHeader(locator);
  await page.waitForTimeout(60);

  await locator.evaluate((el: HTMLInputElement) => {
    el.focus({ preventScroll: true });
  });

  if (opts?.masked) {
    await locator.press("Control+A").catch(() => undefined);
    await locator.press("Backspace").catch(() => undefined);
    await locator.pressSequentially(value, { delay: 35 });
  } else {
    await locator.evaluate((el: HTMLInputElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }, value);
  }

  await page.waitForTimeout(80);

  const expectedDigits = chubbDigitsOnly(value);
  const current = await chubbReadInputValue(locator);
  const currentDigits = chubbDigitsOnly(current);

  if (expectedDigits && currentDigits !== expectedDigits) {
    await locator.evaluate((el: HTMLInputElement) => {
      el.focus({ preventScroll: true });
    });
    await locator.fill(value, { force: true }).catch(() => undefined);
    await chubbDispatchInputEvents(locator, value);
  } else if (!opts?.masked && current.trim() !== value.trim()) {
    await chubbDispatchInputEvents(locator, value);
  }
}

/** Unlock client-info form — never strip CDK backdrops (breaks mat-select open). */
async function chubbPrepareClientInfoInteraction(page: Page): Promise<void> {
  if (await chubbIsHeaderResourcesMenuPanelVisible(page)) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await chubbDismissHeaderResourcesMenu(page);
  }

  await page.evaluate(() => {
    document.body.style.pointerEvents = "";
    document.body.classList.remove("cdk-global-scrollblock");
    document.documentElement.classList.remove("cdk-global-scrollblock");
    document
      .querySelectorAll(".bdd-client-info, #dynamic-view, .bdd-client-info mat-select")
      .forEach((el) => {
        (el as HTMLElement).style.pointerEvents = "";
      });
  });
  await page.waitForTimeout(150);
}

async function chubbWaitForMatSelectValue(
  selectLocator: ReturnType<Page["locator"]>,
  timeoutMs: number,
  label: string
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await chubbMatSelectIsEmpty(selectLocator))) {
      const value = (await chubbMatSelectDisplayValue(selectLocator)).trim();
      if (value.length > 0) return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  throw new Error(`CHUBB ${label} was not filled.`);
}

async function chubbWaitForOccupationDetailEnabled(
  page: Page,
  occupation: ReturnType<Page["locator"]>,
  occupationDetail: ReturnType<Page["locator"]>,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await chubbWaitIfSavingQuote(page, 5_000);

    const occupationFilled = !(await chubbMatSelectIsEmpty(occupation));
    const disabled = await occupationDetail.getAttribute("aria-disabled").catch(() => "true");
    const detailDisabled = disabled === "true";

    if (occupationFilled && !detailDisabled) return;

    await page.waitForTimeout(100);
  }

  throw new Error("CHUBB Occupation Detail did not become enabled after selecting Occupation.");
}

async function chubbSelectOccupationDropdown(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>,
  opts: { optionText?: string; pickFirst?: boolean }
): Promise<void> {
  await chubbPrepareClientInfoInteraction(page);
  await chubbCloseMatSelectIfOpen(page, selectLocator);
  await chubbScrollFieldBelowHeader(selectLocator);

  if (opts.optionText) {
    try {
      await chubbSelectMatSelectOption(page, selectLocator, { optionText: opts.optionText });
      return;
    } catch {
      // fall through to first option
    }
  }

  await chubbSelectMatSelectOption(page, selectLocator, { pickFirst: true });
}

/** Primary insured — Occupation then Occupation Detail (scoped to primary row only). */
async function chubbSelectPrimaryOccupationFields(
  page: Page,
  clientRoot: ReturnType<Page["locator"]>,
  updateStep: (s: string) => void
): Promise<void> {
  const occupationSelect = clientRoot.locator("mat-select.primary-insured-occupation, #mat-select-2").first();
  const occupationDetailSelect = clientRoot
    .locator("mat-select.primary-insured-occupation-detail.occupation-detail, #mat-select-3")
    .first();

  await occupationSelect.waitFor({ state: "visible", timeout: 30_000 });
  await chubbPrepareClientInfoInteraction(page);

  if (await chubbMatSelectIsEmpty(occupationSelect)) {
    updateStep("chubb_select_occupation");
  await chubbSelectOccupationDropdown(page, occupationSelect, {
    optionText: CHUBB_DEFAULT_OCCUPATION,
    pickFirst: true,
  });
  }

  await chubbWaitForMatSelectValue(occupationSelect, 10_000, "Occupation");
  await chubbWaitIfSavingQuote(page, 15_000);

  updateStep("chubb_wait_occupation_detail");
  await occupationDetailSelect.waitFor({ state: "visible", timeout: 30_000 });
  await chubbWaitForOccupationDetailEnabled(
    page,
    occupationSelect,
    occupationDetailSelect,
    30_000
  );

  updateStep("chubb_select_occupation_detail");
  if (await chubbMatSelectIsEmpty(occupationDetailSelect)) {
    try {
      await chubbSelectOccupationDropdown(page, occupationDetailSelect, { pickFirst: true });
    } catch {
      await chubbSelectOccupationDropdown(page, occupationDetailSelect, {
        optionText: CHUBB_DEFAULT_OCCUPATION_DETAIL,
        pickFirst: true,
      });
    }
  }

  await chubbWaitForMatSelectValue(occupationDetailSelect, 10_000, "Occupation Detail");
  await chubbWaitIfSavingQuote(page, 15_000);
}

async function chubbWaitForClientInfoPage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const onBdd = await page.locator(".bdd-client-info").first().isVisible().catch(() => false);
    const header = await page
      .locator("h2")
      .filter({ hasText: /Who are you quoting for/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (onBdd || header) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error(`CHUBB client info page did not load within ${timeoutMs}ms (URL: ${page.url()}).`);
}

async function chubbAcceptConsumerDisclosure(page: Page, timeoutMs: number): Promise<void> {
  const clientRoot = page.locator(".bdd-client-info").first();
  const nativeInput = clientRoot.locator(
    "#mat-mdc-checkbox-1-input, mat-checkbox.accept-disclosure input.mdc-checkbox__native-control"
  ).first();
  const checkboxUi = clientRoot.locator("mat-checkbox.accept-disclosure, #mat-mdc-checkbox-1").first();

  await chubbScrollFieldBelowHeader(checkboxUi);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const disabled = await nativeInput.isDisabled().catch(() => true);
    if (!disabled) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!(await nativeInput.isChecked().catch(() => false))) {
    await checkboxUi.click({ timeout: 10_000, force: true }).catch(() => undefined);
  }

  if (!(await nativeInput.isChecked().catch(() => false))) {
    await nativeInput.check({ force: true }).catch(() => undefined);
  }
}

export async function runChubbClientInfo(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  const firstName = chubbClientFirstName(payload);
  const lastName = chubbClientLastName(payload);
  const dateOfBirth = formatChubbDateOfBirthMmDdYyyy(payload);
  const email = chubbClientEmail(payload);
  const ssnDigits = chubbClientSocialSecurityDigits(payload);

  updateStep("chubb_wait_client_info");
  await chubbWaitForClientInfoPage(page, Math.max(timeoutMs, 90_000));

  const clientRoot = page.locator(".bdd-client-info").first();
  await clientRoot.waitFor({ state: "visible", timeout: 60_000 });
  await chubbPrepareClientInfoInteraction(page);

  updateStep("chubb_fill_primary_insured");
  await chubbFillTextInput(
    page,
    clientRoot.locator("#bdd-PrimaryInsuredFirstName, input.primary-insured-first-name").first(),
    firstName
  );
  await chubbFillTextInput(
    page,
    clientRoot.locator("#bdd-PrimaryInsuredLastName, input.primary-insured-last-name").first(),
    lastName
  );
  await chubbFillTextInput(
    page,
    clientRoot.locator("input.primary-insured-date-of-birth, input[name='PrimaryInsuredDateOfBirth']").first(),
    dateOfBirth,
    { masked: true }
  );

  if (ssnDigits) {
    await chubbFillTextInput(
      page,
      clientRoot.locator("input.primary-insured-ssn, input.social-security.primary-insured-ssn").first(),
      ssnDigits,
      { masked: true }
    );
  }

  await page.waitForTimeout(50);
  await chubbWaitIfSavingQuote(page, 15_000);

  await chubbSelectPrimaryOccupationFields(page, clientRoot, updateStep);

  if (email) {
    updateStep("chubb_fill_insured_email");
    await chubbFillTextInput(
      page,
      clientRoot.locator("input.insured-email-address, #mat-input-13").first(),
      email
    );
    await chubbWaitIfSavingQuote(page);
  }

  updateStep("chubb_accept_disclosure");
  await chubbAcceptConsumerDisclosure(page, timeoutMs);
  await chubbWaitIfSavingQuote(page);

  await chubbScrollFooterContinueIntoView(page);

  updateStep("chubb_client_info_continue");
  await chubbClickFooterContinue(page, timeoutMs);

  await chubbWaitIfSavingQuote(page, 60_000);
  await page.locator(".bdd-address-0").first().waitFor({ state: "visible", timeout: 60_000 });
}
