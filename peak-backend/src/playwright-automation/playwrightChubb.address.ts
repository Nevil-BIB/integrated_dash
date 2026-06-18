import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import { chubbSelectMatOptionByText } from "./playwrightChubb.mat-select";
import { chubbWaitIfSavingQuote } from "./playwrightChubb.page-guard";
import { chubbResidenceStreetAddress } from "./playwrightChubb.payload";

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

async function chubbWaitForResidenceAddressPage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const onBdd = await page.locator(".bdd-address-0").first().isVisible().catch(() => false);
    const header = await page
      .locator("h2")
      .filter({ hasText: /address of the residence/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (onBdd || header) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`CHUBB residence address page did not load within ${timeoutMs}ms (URL: ${page.url()}).`);
}

async function chubbEnsurePropertyCoverageSelected(page: Page, addressRoot: ReturnType<Page["locator"]>): Promise<void> {
  const propRadio = addressRoot.locator(
    'mat-radio-button.residence-coverage-type-property-with-without-liability input[value="PropLiab"], #mat-radio-4-input'
  ).first();

  const checked = await propRadio.isChecked().catch(() => false);
  if (!checked) {
    await addressRoot
      .locator("mat-radio-button.residence-coverage-type-property-with-without-liability")
      .first()
      .click({ force: true, timeout: 10_000 })
      .catch(() => undefined);
  }
}

function chubbStreetAutocompletePanel(page: Page): ReturnType<Page["locator"]> {
  return page
    .locator(".cdk-overlay-pane")
    .filter({
      has: page.locator("mat-autocomplete-panel, .mat-mdc-autocomplete-panel"),
    })
    .last();
}

function chubbStreetAutocompleteOptions(page: Page): ReturnType<Page["locator"]> {
  const panel = chubbStreetAutocompletePanel(page);
  return panel.locator(
    'mat-option:not([aria-disabled="true"]), [role="option"]:not([aria-disabled="true"])'
  );
}

async function chubbWaitForStreetAutocompletePanel(
  page: Page,
  streetInput: ReturnType<Page["locator"]>,
  timeoutMs: number
): Promise<ReturnType<Page["locator"]> | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const expanded =
      (await streetInput.getAttribute("aria-expanded").catch(() => "false")) === "true";
    const options = chubbStreetAutocompleteOptions(page);
    const count = await options.count();
    if (count > 0) {
      const first = options.first();
      if (await first.isVisible().catch(() => false)) return options;
    }

    const roleOptions = page.getByRole("option");
    if ((await roleOptions.count()) > 0 && (await roleOptions.first().isVisible().catch(() => false))) {
      return roleOptions;
    }

    if (expanded) {
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(250);
  }

  return null;
}

async function chubbStreetSelectionApplied(
  page: Page,
  addressRoot: ReturnType<Page["locator"]>,
  streetInput: ReturnType<Page["locator"]>,
  typedStreet: string
): Promise<boolean> {
  const streetVal = (await streetInput.inputValue().catch(() => "")).trim();
  const cityVal = (await addressRoot.locator("#bdd-City, input.city").first().inputValue().catch(() => "")).trim();
  const zipVal = (await addressRoot.locator('input[name="ZipCode"], input.zip-code').first().inputValue().catch(() => "")).trim();

  if (cityVal.length > 0 || zipVal.length > 0) return true;
  if (!streetVal) return false;

  const typed = typedStreet.trim().toLowerCase();
  const current = streetVal.toLowerCase();
  if (current !== typed && (current.includes(",") || current.length > typed.length + 3)) return true;

  const panelOpen =
    (await streetInput.getAttribute("aria-expanded").catch(() => "false")) === "true";
  if (panelOpen) return false;

  await page.waitForTimeout(400);
  const cityAfter = (await addressRoot.locator("#bdd-City, input.city").first().inputValue().catch(() => "")).trim();
  return cityAfter.length > 0;
}

async function chubbClickFirstAutocompleteOption(
  page: Page,
  streetInput: ReturnType<Page["locator"]>,
  options: ReturnType<Page["locator"]>
): Promise<boolean> {
  const activeOption = page.locator(
    "mat-option.mat-mdc-option-active, mat-option[aria-selected='true'], [role='option'][aria-selected='true']"
  ).first();
  const firstOption = (await activeOption.count()) > 0 && (await activeOption.isVisible().catch(() => false))
    ? activeOption
    : options.first();

  if ((await firstOption.count()) === 0) return false;
  if (!(await firstOption.isVisible().catch(() => false))) return false;

  await firstOption.scrollIntoViewIfNeeded().catch(() => undefined);
  await firstOption.hover({ force: true }).catch(() => undefined);

  await firstOption.click({ force: true, timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(300);

  const stillOpen = (await streetInput.getAttribute("aria-expanded").catch(() => "false")) === "true";
  if (!stillOpen) return true;

  await firstOption.evaluate((el: HTMLElement) => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);

  return (await streetInput.getAttribute("aria-expanded").catch(() => "false")) !== "true";
}

async function chubbPickStreetAutocompleteViaKeyboard(
  page: Page,
  streetInput: ReturnType<Page["locator"]>
): Promise<boolean> {
  await streetInput.focus();
  await streetInput.press("ArrowDown").catch(() => undefined);
  await page.waitForTimeout(250);
  await streetInput.press("Enter").catch(() => undefined);
  await page.waitForTimeout(400);

  return (await streetInput.getAttribute("aria-expanded").catch(() => "false")) !== "true";
}

async function chubbTypeStreetForAutocomplete(
  page: Page,
  streetInput: ReturnType<Page["locator"]>,
  street: string
): Promise<void> {
  await streetInput.waitFor({ state: "visible", timeout: 30_000 });
  await chubbScrollFieldBelowHeader(streetInput);

  await streetInput.click({ force: true, timeout: 10_000 }).catch(async () => {
    await streetInput.evaluate((el: HTMLInputElement) => el.focus({ preventScroll: true }));
  });

  await streetInput.press("Control+A").catch(() => undefined);
  await streetInput.press("Backspace").catch(() => undefined);
  await streetInput.pressSequentially(street, { delay: 45 });

  await streetInput.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("keyup", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, street);

  await page.waitForTimeout(800);
}

async function chubbFillStreetAutocomplete(
  page: Page,
  addressRoot: ReturnType<Page["locator"]>,
  streetInput: ReturnType<Page["locator"]>,
  street: string
): Promise<void> {
  await chubbTypeStreetForAutocomplete(page, streetInput, street);

  const pickDeadline = Date.now() + 25_000;
  let picked = false;

  while (Date.now() < pickDeadline && !picked) {
    const options = await chubbWaitForStreetAutocompletePanel(page, streetInput, 6_000);

    if (options) {
      picked = await chubbClickFirstAutocompleteOption(page, streetInput, options);
      if (picked && (await chubbStreetSelectionApplied(page, addressRoot, streetInput, street))) {
        break;
      }
      picked = false;
    }

    if (!picked) {
      picked = await chubbPickStreetAutocompleteViaKeyboard(page, streetInput);
      if (picked && (await chubbStreetSelectionApplied(page, addressRoot, streetInput, street))) {
        break;
      }
      picked = false;
    }

    if (await chubbStreetSelectionApplied(page, addressRoot, streetInput, street)) {
      picked = true;
      break;
    }

    await streetInput.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(500);
  }

  if (!picked) {
    await streetInput.focus();
    await streetInput.press("ArrowDown").catch(() => undefined);
    await page.waitForTimeout(200);
    const options = chubbStreetAutocompleteOptions(page);
    if ((await options.count()) > 0) {
      await chubbClickFirstAutocompleteOption(page, streetInput, options);
    } else {
      await streetInput.press("Enter").catch(() => undefined);
    }
    await page.waitForTimeout(600);
  }

  await chubbWaitIfSavingQuote(page, 30_000);

  const applied = await chubbStreetSelectionApplied(page, addressRoot, streetInput, street);
  const entered = (await streetInput.inputValue().catch(() => "")).trim();

  if (!entered || !applied) {
    throw new Error(
      "CHUBB Street autocomplete did not commit — first suggestion was not selected (city/zip still empty)."
    );
  }

  await streetInput.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  });
  await page.waitForTimeout(300);
}

/**
 * Residence address: street autocomplete → Residence Type House → Continue.
 */
export async function runChubbResidenceAddress(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  const street = chubbResidenceStreetAddress(payload);

  updateStep("chubb_wait_residence_address");
  await chubbWaitForResidenceAddressPage(page, Math.max(timeoutMs, 90_000));

  const addressRoot = page.locator(".bdd-address-0").first();

  updateStep("chubb_residence_coverage_type");
  await chubbEnsurePropertyCoverageSelected(page, addressRoot);

  updateStep("chubb_fill_street_autocomplete");
  const streetInput = addressRoot.locator(
    "#bdd-Street, input.input-address.street, input.mat-mdc-autocomplete-trigger.street"
  ).first();
  await chubbFillStreetAutocomplete(page, addressRoot, streetInput, street);

  updateStep("chubb_select_residence_type_house");
  const residenceType = addressRoot.locator("mat-select.residence-type, #mat-select-12").first();
  await chubbSelectMatOptionByText(page, residenceType, "House");

  await chubbScrollFooterContinueIntoView(page);

  updateStep("chubb_residence_address_continue");
  await chubbClickFooterContinue(page, timeoutMs);
  await chubbWaitIfSavingQuote(page, 60_000);

  const { chubbWaitForDynamicViewReady } = await import("./playwrightChubb.page-guard");
  await page.locator(".bdd-residence-info-0").first().waitFor({ state: "visible", timeout: 60_000 });
  await chubbWaitForDynamicViewReady(page, 60_000);
}
