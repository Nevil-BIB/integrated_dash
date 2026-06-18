import type { Page } from "playwright";
import {
  chubbClickFooterContinue,
  chubbCollectFormValidationErrors,
  chubbScrollFooterContinueIntoView,
  chubbWaitForFooterContinueEnabled,
} from "./playwrightChubb.footer";
import {
  chubbIsMatSelectInteractive,
  chubbMatSelectDisplayValue,
  chubbMatSelectIsEmpty,
  chubbSelectMatOptionByText,
} from "./playwrightChubb.mat-select";
import {
  chubbMapLocationOccupancyPortalValue,
  chubbPayloadOptionalString,
  chubbPayloadTruthy,
  chubbResidenceBasementType,
  chubbResidenceUnderConstructionRenovation,
  chubbResolveUsageValue,
} from "./playwrightChubb.payload";
import {
  chubbDismissHeaderResourcesMenu,
  chubbPrepareResidencePageForInteraction,
  chubbPunchThroughResidenceOverlay,
  chubbWakeResidenceFormInteractivity,
  chubbWaitForDynamicViewReady,
  chubbWaitForPageInteractive,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";

/** Extra fixed wait removed to avoid delayed interactivity. */
export const CHUBB_RESIDENCE_POST_CONTINUE_WAIT_MS = 0;

/** Exact selectors from CHUBB residence-info risk form HTML. */
const CHUBB_RISK = {
  yearBuilt: 'input.year-built[name="YearBuilt"]',
  constructionType: "mat-select.construction-type",
  fireResistive: "mat-checkbox.fire-resistive",
  occupancy: "mat-select.occupancy",
  usage: "mat-select.usage",
  sidingType: "mat-select.siding-type",
  foundationType: "mat-select.foundation-type, mat-select.type-of-foundation",
  basementType: "mat-select.basement-type",
  garageType: "mat-select.garage-type",
  mortgages: 'input.number-of-mortgages[name="NumberOfMortgages"], input.of-mortgages',
  stories: 'input.number-of-stories[name="NumberOfStories"]',
  bathrooms: 'input.number-of-bathrooms[name="NumberOfBathrooms"]',
  fireplaces: "mat-select.number-of-fireplaces",
  underConstruction:
    "mat-select.under-construction-renovation, mat-select.construction-renovation",
  squareFootage:
    'input.total-square-footage[name="SquareFeetAmount"], input.square-feet-amount',
  swimmingPool: "mat-checkbox.swimming-pool",
  multiFamily: "mat-checkbox.multi-family",
  priorCarrier: "mat-select.prior-carrier, mat-select.prior-carrier-name",
  priorCarrierOther:
    'input#bdd-PriorCarrierOtherInformation, input.prior-carrier-other-information[name="PriorCarrierOtherInformation"]',
  continueButton:
    "button.bdd-continue.continue-button, button.continue-button.button-submit.bdd-continue",
} as const;

function chubbDigitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
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

async function chubbPrepareRiskField(page: Page, locator: ReturnType<Page["locator"]>): Promise<void> {
  await chubbDismissHeaderResourcesMenu(page);
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await chubbScrollFieldBelowHeader(locator);
}

async function chubbScrollRiskBlock(
  page: Page,
  root: ReturnType<Page["locator"]>,
  sectionId: "risk-section" | "risk-section-2"
): Promise<void> {
  const section = root.locator(`section#${sectionId}`).first();
  await section.waitFor({ state: "visible", timeout: 30_000 });
  await section.scrollIntoViewIfNeeded();
  await chubbScrollFieldBelowHeader(section.locator("h2, mat-form-field").first());
  await chubbDismissHeaderResourcesMenu(page);
}

async function chubbFillRiskText(
  page: Page,
  root: ReturnType<Page["locator"]>,
  selector: string,
  value: string | undefined,
  fieldLabel: string
): Promise<void> {
  const text = value?.trim();
  if (!text) return;

  const input = root.locator(selector).first();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await chubbPrepareRiskField(page, input);

  await input.evaluate((el: HTMLInputElement) => {
    el.focus({ preventScroll: true });
  });
  await input.press("Control+A").catch(() => undefined);
  await input.press("Backspace").catch(() => undefined);
  await input.pressSequentially(text, { delay: 40 }).catch(() => undefined);
  await input.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, text);

  const actual = (await input.inputValue().catch(() => "")).trim();
  const expectedDigits = chubbDigitsOnly(text);
  const actualDigits = chubbDigitsOnly(actual);
  if (expectedDigits && actualDigits !== expectedDigits && actual !== text) {
    throw new Error(
      `CHUBB ${fieldLabel} was not set (expected "${text}", got "${actual}").`
    );
  }

  await chubbDismissHeaderResourcesMenu(page);
  await chubbWaitIfSavingQuote(page, 5_000, 0);
}

async function chubbMatSelectMatches(select: ReturnType<Page["locator"]>, expected: string): Promise<boolean> {
  if (await chubbMatSelectIsEmpty(select)) return false;
  const current = (await chubbMatSelectDisplayValue(select)).trim();
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i").test(current);
}

async function chubbFillRiskDropdown(
  page: Page,
  root: ReturnType<Page["locator"]>,
  selector: string,
  value: string | undefined,
  fieldLabel: string
): Promise<void> {
  const text = value?.trim();
  if (!text) return;

  const select = root.locator(selector).first();
  if ((await select.count()) === 0) {
    throw new Error(`CHUBB ${fieldLabel} not found (${selector}).`);
  }
  await select.waitFor({ state: "visible", timeout: 30_000 });

  if (!(await chubbIsMatSelectInteractive(select))) {
    return;
  }

  if (await chubbMatSelectMatches(select, text)) {
    return;
  }

  await chubbPrepareRiskField(page, select);
  await chubbSelectMatOptionByText(page, select, text, { force: true, fast: true });
  await chubbDismissHeaderResourcesMenu(page);

  if (!(await chubbMatSelectMatches(select, text))) {
    const current = (await chubbMatSelectDisplayValue(select)).trim();
    throw new Error(
      `CHUBB ${fieldLabel} was not set (expected "${text}", got "${current || "(empty)"}").`
    );
  }
}

async function chubbSetRiskCheckbox(
  page: Page,
  root: ReturnType<Page["locator"]>,
  selector: string,
  checked: boolean | undefined,
  fieldLabel: string
): Promise<void> {
  if (checked === undefined) return;

  const checkbox = root.locator(selector).first();
  if ((await checkbox.count()) === 0) return;
  await checkbox.waitFor({ state: "visible", timeout: 30_000 });
  await chubbPrepareRiskField(page, checkbox);

  const input = checkbox.locator('input[type="checkbox"]').first();
  const isChecked = await input.isChecked().catch(() => false);
  if (isChecked === checked) return;

  await input.click({ force: true, timeout: 10_000 }).catch(async () => {
    await checkbox.click({ force: true });
  });

  const after = await input.isChecked().catch(() => false);
  if (after !== checked) {
    throw new Error(`CHUBB ${fieldLabel} checkbox could not be set to ${checked ? "checked" : "unchecked"}.`);
  }

  await chubbDismissHeaderResourcesMenu(page);
}

async function chubbWaitForBasementTypeEnabled(
  page: Page,
  root: ReturnType<Page["locator"]>,
  timeoutMs: number
): Promise<boolean> {
  const basement = root.locator(CHUBB_RISK.basementType).first();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await chubbIsMatSelectInteractive(basement)) return true;
    await page.waitForTimeout(50);
  }
  return false;
}

/**
 * "Please verify additional information about this home" — field-by-field per portal HTML.
 * Skips Year Renovated. Clicks footer Continue when done.
 */
export async function chubbFillResidenceRiskSection(
  page: Page,
  root: ReturnType<Page["locator"]>,
  payload: unknown
): Promise<void> {
  await chubbWakeResidenceFormInteractivity(page);
  await chubbPrepareResidencePageForInteraction(page);

  await root.locator("#risk-section h2").filter({
    hasText: /Please verify additional information about this home/i,
  }).first().waitFor({ state: "visible", timeout: 90_000 });

  const risk = root.locator("#risk-section, #risk-section-2");

  await chubbScrollRiskBlock(page, root, "risk-section");

  await chubbFillRiskText(
    page,
    risk,
    CHUBB_RISK.yearBuilt,
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.yearBuilt",
      "yearBuilt",
      "chubbHomeCoverageEstimator.yearBuilt",
    ]),
    "Year Built"
  );

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.constructionType,
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.buildingConstructionType",
      "buildingConstructionType",
    ]),
    "Construction Type"
  );

  await chubbSetRiskCheckbox(
    page,
    risk,
    CHUBB_RISK.fireResistive,
    chubbPayloadTruthy(
      chubbPayloadOptionalString(payload, [
        "homeownersInformations.fireResistive",
        "property.fireResistive",
        "fireResistive",
      ])
    ),
    "Fire Resistive"
  );

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.occupancy,
    chubbMapLocationOccupancyPortalValue(
      chubbPayloadOptionalString(payload, ["locationDetail.locationOccupancy", "locationOccupancy"])
    ),
    "Occupancy"
  );

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.usage,
    chubbResolveUsageValue(payload),
    "Usage"
  );

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.sidingType,
    chubbPayloadOptionalString(payload, ["homeownersInformations.sidingType", "sidingType"]),
    "Siding Type"
  );

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.foundationType,
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.primaryFoundationType",
      "primaryFoundationType",
    ]),
    "Foundation Type"
  );

  const basementValue = chubbResidenceBasementType(payload);
  if (basementValue && (await chubbWaitForBasementTypeEnabled(page, risk, 10_000))) {
    await chubbFillRiskDropdown(page, risk, CHUBB_RISK.basementType, basementValue, "Basement Type");
  }

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.garageType,
    chubbPayloadOptionalString(payload, ["homeownersInformations.garageType", "garageType"]),
    "Garage Type"
  );

  await chubbScrollRiskBlock(page, root, "risk-section-2");

  await chubbFillRiskText(
    page,
    risk,
    CHUBB_RISK.mortgages,
    chubbPayloadOptionalString(payload, [
      "chubbHomeCoverageEstimator.numberOfMortgages",
      "numberOfMortgages",
    ]),
    "# of Mortgages"
  );

  await chubbFillRiskText(
    page,
    risk,
    CHUBB_RISK.stories,
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.numberOfStories",
      "numberOfStories",
    ]),
    "Number of Stories"
  );

  await chubbFillRiskText(
    page,
    risk,
    CHUBB_RISK.bathrooms,
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.numberOfBathrooms",
      "numberOfBathrooms",
    ]),
    "Number of Bathrooms"
  );

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.fireplaces,
    chubbPayloadOptionalString(payload, [
      "property.fireplaceCount",
      "fireplaceCount",
      "homeownersInformations.fireplaceCount",
    ]),
    "Number of Fireplaces"
  );

  await chubbFillRiskDropdown(
    page,
    risk,
    CHUBB_RISK.underConstruction,
    chubbResidenceUnderConstructionRenovation(payload),
    "Under Construction/Renovation?"
  );

  await chubbFillRiskText(
    page,
    risk,
    CHUBB_RISK.squareFootage,
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.squareFootage",
      "squareFootage",
      "chubbHomeCoverageEstimator.livingAreaSqFt",
      "livingAreaSqFt",
    ]),
    "Total Square Footage"
  );

  await chubbSetRiskCheckbox(
    page,
    risk,
    CHUBB_RISK.swimmingPool,
    chubbPayloadTruthy(
      chubbPayloadOptionalString(payload, [
        "homeownersInformations.swimmingPool",
        "property.swimmingPool",
        "swimmingPool",
      ])
    ),
    "Swimming Pool"
  );

  await chubbSetRiskCheckbox(
    page,
    risk,
    CHUBB_RISK.multiFamily,
    chubbPayloadTruthy(
      chubbPayloadOptionalString(payload, [
        "homeownersInformations.multiFamily",
        "property.multiFamily",
        "multiFamily",
      ])
    ),
    "Multi-Family"
  );

  const priorCarrier = chubbPayloadOptionalString(payload, [
    "chubbHomeCoverageEstimator.priorCarrier",
    "priorCarrier",
  ]);
  await chubbFillRiskDropdown(page, root, CHUBB_RISK.priorCarrier, priorCarrier, "Prior Carrier");

  if (priorCarrier && /^other$/i.test(priorCarrier.trim())) {
    const priorOther = chubbPayloadOptionalString(payload, [
      "chubbHomeCoverageEstimator.priorCarrierOther",
      "priorCarrierOther",
    ]);
    if (priorOther) {
      const otherInput = root.locator(CHUBB_RISK.priorCarrierOther).first();
      await otherInput.waitFor({ state: "visible", timeout: 30_000 });
      await chubbFillRiskText(page, root, CHUBB_RISK.priorCarrierOther, priorOther, "Other Carrier");
    }
  }

  await chubbWaitIfSavingQuote(page, 8_000, 0);
  await chubbDismissHeaderResourcesMenu(page);
}

/** True when residence-info step 2 content is gone (URL may stay on residence-info-0). */
export async function chubbHasLeftResidenceInfoStep(page: Page): Promise<boolean> {
  if (!/\/residence-info-0/i.test(page.url())) return true;

  const riskHeading = page
    .locator(".bdd-residence-info-0 #risk-section h2")
    .filter({ hasText: /verify additional information about this home/i })
    .first();

  if (await riskHeading.isVisible().catch(() => false)) {
    return false;
  }

  const nextStepHints = [
    page.getByText(/Location Check Details/i).first(),
    page.getByText(/^Location Check$/i).first(),
    page.getByText(/Residence Details/i).first(),
    page.locator('[class*="bdd-location-check"], [class*="location-check"]').first(),
  ];

  for (const hint of nextStepHints) {
    if ((await hint.count()) > 0 && (await hint.isVisible().catch(() => false))) {
      return true;
    }
  }

  const propertyHeading = page
    .locator(".bdd-residence-info-0 #property-section h2")
    .filter({ hasText: /Replacement Cost/i })
    .first();
  if (await propertyHeading.isVisible().catch(() => false)) {
    return false;
  }

  return true;
}

export async function chubbResidenceContinueNavigationStarted(page: Page): Promise<boolean> {
  if (
    await page
      .getByText(/saving your quote/i)
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return true;
  }

  const busy = await page
    .locator("mat-progress-spinner, .loading, .spinner")
    .first()
    .isVisible()
    .catch(() => false);
  if (busy) return true;

  return chubbHasLeftResidenceInfoStep(page);
}

export async function chubbWaitResidenceInfoPostContinue(
  page: Page,
  updateStep?: (step: string) => void
): Promise<void> {
  const started = Date.now();
  updateStep?.("chubb_residence_next_form_loading");

  await chubbWaitIfSavingQuote(page, CHUBB_RESIDENCE_POST_CONTINUE_WAIT_MS);

  while (Date.now() - started < CHUBB_RESIDENCE_POST_CONTINUE_WAIT_MS) {
    const saving = await page
      .getByText(/saving your quote/i)
      .first()
      .isVisible()
      .catch(() => false);
    const spinner = await page
      .locator(".loading, .spinner, mat-progress-spinner, .mat-mdc-progress-spinner")
      .first()
      .isVisible()
      .catch(() => false);
    const leftResidence = await chubbHasLeftResidenceInfoStep(page);

    if (!saving && !spinner && leftResidence) {
      await chubbWaitForDynamicViewReady(page, 90_000);
      break;
    }

    if (!saving && !spinner) {
      const loaded = await page.locator("#dynamic-view.loaded").first().isVisible().catch(() => false);
      if (loaded && leftResidence) {
        await chubbWaitForDynamicViewReady(page, 60_000);
        break;
      }
    }

    await page.waitForTimeout(500);
  }

  const remaining = CHUBB_RESIDENCE_POST_CONTINUE_WAIT_MS - (Date.now() - started);
  if (remaining > 0) {
    updateStep?.("chubb_residence_next_form_loading");
    await page.waitForTimeout(remaining);
  }

  updateStep?.("chubb_residence_next_form_ready");
  await chubbWaitForPageInteractive(page, 90_000);
}

export async function chubbResidenceInfoContinueWithLoading(
  page: Page,
  timeoutMs: number,
  updateStep?: (step: string) => void
): Promise<void> {
  await chubbPunchThroughResidenceOverlay(page);
  await chubbDismissHeaderResourcesMenu(page);
  await chubbWaitIfSavingQuote(page, 60_000);

  const riskBlock = page.locator("#risk-section, #risk-section-2").last();
  if ((await riskBlock.count()) > 0) {
    await riskBlock.scrollIntoViewIfNeeded().catch(() => undefined);
  }

  await chubbScrollFooterContinueIntoView(page);
  await chubbWaitForFooterContinueEnabled(page, 60_000);

  const clickAttempts = 3;
  let navigationStarted = false;

  for (let attempt = 0; attempt < clickAttempts; attempt += 1) {
    await chubbPunchThroughResidenceOverlay(page);
    await chubbScrollFooterContinueIntoView(page);
    await chubbClickFooterContinue(page, Math.min(timeoutMs, 60_000));

    const navDeadline = Date.now() + 45_000;
    while (Date.now() < navDeadline) {
      if (await chubbResidenceContinueNavigationStarted(page)) {
        navigationStarted = true;
        break;
      }
      await page.waitForTimeout(500);
    }

    if (navigationStarted) break;
    await page.waitForTimeout(800);
  }

  if (!navigationStarted) {
    const validation = await chubbCollectFormValidationErrors(page, ".bdd-residence-info-0");
    const validationHint =
      validation.length > 0 ? ` Validation messages: ${validation.join(" | ")}` : "";
    throw new Error(
      `CHUBB residence-info Continue did not advance to the next step (URL: ${page.url()}).${validationHint}`
    );
  }

  await chubbWaitIfSavingQuote(page, 120_000);
  await chubbWaitResidenceInfoPostContinue(page, updateStep);
}
