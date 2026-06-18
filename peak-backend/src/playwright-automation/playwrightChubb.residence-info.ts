import type { Page } from "playwright";
import { chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import {
  chubbFillResidenceRiskSection,
  chubbResidenceInfoContinueWithLoading,
} from "./playwrightChubb.residence-risk";
import {
  chubbMatSelectIsEmpty,
  chubbSelectFirstMatOption,
  chubbSelectMatOptionByText,
} from "./playwrightChubb.mat-select";
import {
  chubbClickOutsideHeaderMenu,
  chubbClickResidencePageToCloseOverlays,
  chubbDismissHeaderResourcesMenu,
  chubbIsHeaderResourcesMenuOpen,
  chubbLockHeaderResourcesMenu,
  chubbPrepareResidencePageForInteraction,
  chubbPunchThroughResidenceOverlay,
  chubbRestoreResidencePageAfterHceClose,
  chubbStripHeaderResourcesMenuOverlay,
  chubbWakeResidenceFormInteractivity,
  chubbWaitForDynamicViewReady,
  chubbWaitForPageInteractive,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";

async function chubbModalSelectHasValue(select: ReturnType<Page["locator"]>): Promise<boolean> {
  return !(await chubbMatSelectIsEmpty(select));
}
import type {
  ChubbAttachedStructurePayload,
  ChubbConstructionTypePayload,
} from "./playwrightChubb.payload";
import {
  chubbClientEmail,
  chubbResidenceAttachedStructures,
  chubbResidenceBuildingType,
  chubbResidenceClassification,
  chubbResidenceConstructionTypes,
  chubbResidenceContentsAmount,
  chubbResidenceContentsPercentage,
  chubbResidenceDeductible,
  chubbResidenceDeductibleWaiverOption,
  chubbResidenceLivingAreaSqFt,
  chubbResidenceOtherPermanentStructuresAmount,
  chubbResidenceOtherPermanentStructuresPercentage,
  chubbResidencePercentRenovated,
  chubbResidenceRenovatedOptional,
  chubbResidenceTypeOfContents,
  chubbResidenceYearBuilt,
} from "./playwrightChubb.payload";

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

async function chubbScrollWithinModal(locator: ReturnType<Page["locator"]>): Promise<void> {
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const scrollable =
        /auto|scroll/i.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 4;
      if (scrollable) {
        const rect = el.getBoundingClientRect();
        const container = parent.getBoundingClientRect();
        if (rect.bottom > container.bottom - 8) {
          parent.scrollTop += rect.bottom - container.bottom + 24;
        }
        if (rect.top < container.top + 8) {
          parent.scrollTop -= container.top - rect.top + 24;
        }
        break;
      }
      parent = parent.parentElement;
    }
  });
}

async function chubbFillInput(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  value: string
): Promise<void> {
  await locator.waitFor({ state: "attached", timeout: 30_000 });
  await chubbScrollWithinModal(locator);
  await chubbScrollFieldBelowHeader(locator);

  if (!(await locator.isVisible().catch(() => false))) {
    await chubbScrollWithinModal(locator);
  }

  await locator.evaluate((el: HTMLInputElement) => {
    el.focus({ preventScroll: true });
  });
  await locator.press("Control+A").catch(() => undefined);
  await locator.press("Backspace").catch(() => undefined);
  await locator.pressSequentially(value, { delay: 35 }).catch(() => undefined);
  await locator.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
  await page.waitForTimeout(80);
}

function chubbNumericOnly(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

function chubbPercentValue(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

async function chubbWaitForResidenceInfoPage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const onBdd = await page.locator(".bdd-residence-info-0").first().isVisible().catch(() => false);
    const header = await page
      .locator("h2")
      .filter({ hasText: /Tell us more about the home/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (onBdd || header) {
      await chubbWaitForPageInteractive(page, Math.max(15_000, timeoutMs - (Date.now() - start)));
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`CHUBB residence info page did not load within ${timeoutMs}ms (URL: ${page.url()}).`);
}

function chubbCoverageEstimatorModal(page: Page): ReturnType<Page["locator"]> {
  return page
    .locator("mat-dialog-container, .mat-mdc-dialog-container")
    .filter({ hasText: /Home Coverage Estimator/i })
    .last();
}

const CHUBB_MODAL_SELECT_FIELDS = {
  buildingType: {
    classes: ["building-type"],
    label: /Building Type/i,
    index: 0,
  },
  yearBuilt: {
    classes: ["year-built"],
    label: /Year Built/i,
    index: 1,
  },
  classification: {
    classes: ["classification", "home-classification"],
    label: /Classification/i,
    index: 2,
  },
} as const;

type ChubbModalSelectField = keyof typeof CHUBB_MODAL_SELECT_FIELDS;

function chubbModalScalarSelects(modal: ReturnType<Page["locator"]>): ReturnType<Page["locator"]> {
  return modal.locator(
    [
      "mat-select.building-type",
      "mat-select.year-built",
      "mat-select.classification",
      "mat-select.home-classification",
      "mat-select.select.building-type",
      "mat-select.select.year-built",
      "mat-select.select.classification",
    ].join(", ")
  );
}

async function chubbResolveModalSelect(
  modal: ReturnType<Page["locator"]>,
  field: ChubbModalSelectField
): Promise<ReturnType<Page["locator"]>> {
  const config = CHUBB_MODAL_SELECT_FIELDS[field];

  for (const cls of config.classes) {
    const byClass = modal.locator(`mat-select.${cls}, mat-select.select.${cls}`).first();
    if ((await byClass.count()) > 0) {
      await chubbScrollWithinModal(byClass);
      return byClass;
    }
  }

  const byMatLabel = modal
    .locator("mat-form-field")
    .filter({ has: modal.locator("mat-label").filter({ hasText: config.label }) })
    .locator("mat-select")
    .first();
  if ((await byMatLabel.count()) > 0) {
    await chubbScrollWithinModal(byMatLabel);
    return byMatLabel;
  }

  const byLooseLabel = modal
    .locator("mat-form-field, app-select, .app-select")
    .filter({ hasText: config.label })
    .locator("mat-select")
    .first();
  if ((await byLooseLabel.count()) > 0) {
    await chubbScrollWithinModal(byLooseLabel);
    return byLooseLabel;
  }

  const topSelects = chubbModalScalarSelects(modal);
  const byIndex = topSelects.nth(config.index);
  if ((await byIndex.count()) > 0) {
    await chubbScrollWithinModal(byIndex);
    return byIndex;
  }

  const fallback = modal.locator("mat-select").nth(config.index);
  await chubbScrollWithinModal(fallback);
  return fallback;
}

function chubbModalInputByLabel(
  modal: ReturnType<Page["locator"]>,
  label: RegExp | string
): ReturnType<Page["locator"]> {
  return modal
    .locator("mat-form-field, app-input-number, app-input-alphanumeric, .input-number-wrapper")
    .filter({ hasText: label })
    .locator("input")
    .first();
}

function chubbModalInputFallbacks(modal: ReturnType<Page["locator"]>, selectors: string[]): ReturnType<Page["locator"]> {
  return modal.locator(selectors.join(", ")).first();
}

async function chubbIsCoverageEstimatorOpen(page: Page): Promise<boolean> {
  return chubbCoverageEstimatorModal(page).isVisible().catch(() => false);
}

async function chubbAssertCoverageEstimatorModalOpen(page: Page): Promise<void> {
  if (await chubbIsCoverageEstimatorOpen(page)) return;
  throw new Error(
    "CHUBB Home Coverage Estimator modal closed unexpectedly (often caused by Escape while a dropdown was open). Complete Calculate and Apply to Quote before leaving the modal."
  );
}

async function chubbModalRenovatedSelect(
  page: Page,
  modal: ReturnType<Page["locator"]>
): Promise<ReturnType<Page["locator"]> | null> {
  const deadline = Date.now() + 25_000;

  while (Date.now() < deadline) {
    const candidates = [
      modal.locator("mat-select.renovated, mat-select.renovated-hce, mat-select.select.renovated"),
      modal
        .locator("mat-form-field")
        .filter({ has: modal.locator("mat-label", { hasText: /^Renovated$/i }) })
        .locator("mat-select"),
      modal.locator("mat-form-field").filter({ hasText: /^Renovated$/i }).locator("mat-select"),
    ];

    for (const candidate of candidates) {
      if ((await candidate.count()) === 0) continue;
      const select = candidate.first();
      try {
        await select.waitFor({ state: "attached", timeout: 1_500 });
      } catch {
        continue;
      }
      await chubbScrollWithinModal(select);
      if (await select.isVisible().catch(() => false)) {
        return select;
      }
    }

    await chubbScrollWithinModal(modal.locator("mat-select.classification").first());
    await page.waitForTimeout(350);
  }

  return null;
}

async function chubbClickBuildingValueCalculatorIcon(
  page: Page,
  propertySection: ReturnType<Page["locator"]>
): Promise<boolean> {
  const iconCandidates = [
    propertySection.locator(
      'mat-form-field:has(input.building-value) mat-icon[data-mat-icon-name="calculator"]'
    ),
    propertySection.locator(
      'mat-form-field:has(input.building-value) mat-icon[data-mat-icon-name="calculator-success"]'
    ),
    propertySection.locator(
      "mat-form-field:has(input.building-value) .mat-mdc-form-field-icon-suffix mat-icon"
    ),
    propertySection.locator('mat-icon[data-mat-icon-name="calculator"]'),
    propertySection.locator('mat-icon[data-mat-icon-name="calculator-success"]'),
  ];

  for (const icon of iconCandidates) {
    if ((await icon.count()) === 0) continue;
    if (!(await icon.isVisible().catch(() => false))) continue;

    await chubbScrollFieldBelowHeader(icon);
    const box = await icon.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await icon.click({ force: true, timeout: 10_000 });
    }
    await page.waitForTimeout(500);
    if (await chubbIsCoverageEstimatorOpen(page)) return true;

    await icon.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
    await page.waitForTimeout(500);
    if (await chubbIsCoverageEstimatorOpen(page)) return true;
  }

  const suffix = propertySection
    .locator("mat-form-field:has(input.building-value) .mat-mdc-form-field-icon-suffix")
    .first();
  if ((await suffix.count()) > 0 && (await suffix.isVisible().catch(() => false))) {
    const box = await suffix.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
      if (await chubbIsCoverageEstimatorOpen(page)) return true;
    }
  }

  return false;
}

async function chubbOpenBuildingValueCalculator(
  page: Page,
  root: ReturnType<Page["locator"]>
): Promise<void> {
  await chubbPrepareResidencePageForInteraction(page);

  const propertySection = root.locator("section#property-section").first();
  await propertySection.waitFor({ state: "visible", timeout: 30_000 });
  await propertySection.scrollIntoViewIfNeeded().catch(() => undefined);

  const buildingInput = propertySection
    .locator('input.building-value, input.structure-amount[name="StructureAmount"]')
    .first();
  await buildingInput.waitFor({ state: "visible", timeout: 30_000 });
  await chubbScrollFieldBelowHeader(buildingInput);

  if (await chubbClickBuildingValueCalculatorIcon(page, propertySection)) return;

  await chubbPrepareResidencePageForInteraction(page);
  if (await chubbClickBuildingValueCalculatorIcon(page, propertySection)) return;

  throw new Error(
    "CHUBB Building Value calculator did not open — could not click the calculator icon on Building Value."
  );
}

function chubbAttachedStructuresIterator(modal: ReturnType<Page["locator"]>): ReturnType<Page["locator"]> {
  return modal.locator('section[id*="attached-structures-0"], section[id*="attached-structures-"]').first();
}

function chubbConstructionTypesIterator(modal: ReturnType<Page["locator"]>): ReturnType<Page["locator"]> {
  return modal
    .locator('section[id*="construction-type-0"], section[id*="construction-type-"]')
    .first();
}

function chubbAttachedStructuresAddLink(modal: ReturnType<Page["locator"]>): ReturnType<Page["locator"]> {
  return modal.locator("a.add-attached-structures, a.house-add-attached-structure").first();
}

function chubbAttachedStructuresAddLinkEnabled(
  modal: ReturnType<Page["locator"]>
): ReturnType<Page["locator"]> {
  return modal.locator(
    "a.add-attached-structures:not(.disabled), a.house-add-attached-structure:not(.disabled)"
  );
}

function chubbConstructionTypesAddLink(modal: ReturnType<Page["locator"]>): ReturnType<Page["locator"]> {
  return modal
    .locator("a.add-construction-types, a.house-home-cost-estimator-add-construction-type")
    .first();
}

function chubbConstructionTypesAddLinkEnabled(
  modal: ReturnType<Page["locator"]>
): ReturnType<Page["locator"]> {
  return modal.locator(
    "a.add-construction-types:not(.disabled), a.house-home-cost-estimator-add-construction-type:not(.disabled)"
  );
}

async function chubbIteratorTotalFromPaginator(
  iteratorSection: ReturnType<Page["locator"]>
): Promise<number> {
  const paginatorLocators = [
    iteratorSection.locator("app-dynamic-paginator:not([hidden])"),
    iteratorSection.locator("app-dynamic-paginator"),
  ];

  for (const paginators of paginatorLocators) {
    const total = await paginators.count();
    for (let i = 0; i < total; i += 1) {
      const paginatorText =
        (await paginators
          .nth(i)
          .locator("span")
          .first()
          .textContent()
          .catch(() => "")) ?? "";
      const match = paginatorText.match(/\bof\s*(\d+)\b/i);
      if (match) return Number.parseInt(match[1], 10);
    }
  }

  return 0;
}

async function chubbSelectIteratorPage(
  page: Page,
  iteratorSection: ReturnType<Page["locator"]>,
  zeroBasedIndex: number
): Promise<void> {
  if ((await iteratorSection.count()) === 0) {
    return;
  }
  await iteratorSection.waitFor({ state: "attached", timeout: 30_000 }).catch(() => undefined);
  await chubbScrollWithinModal(iteratorSection);

  const paginator = iteratorSection.locator("app-dynamic-paginator").first();
  const pageNumber = zeroBasedIndex + 1;

  if (await paginator.isVisible().catch(() => false)) {
    const byClass = paginator.locator(`button.paginator-${pageNumber}`).first();
    if ((await byClass.count()) > 0) {
      await byClass.waitFor({ state: "visible", timeout: 15_000 });
      await byClass.click({ force: true });
      await page.waitForTimeout(600);
    } else {
      await paginator
        .getByRole("button", { name: String(pageNumber) })
        .click({ force: true })
        .catch(() => undefined);
      await page.waitForTimeout(600);
    }
  }

  await chubbWaitIfSavingQuote(page, 15_000);
}

async function chubbWaitForAttachedStructureTypeSelect(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  index: number,
  timeoutMs = 45_000
): Promise<ReturnType<Page["locator"]>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await chubbDismissModalSelectPanels(page);
    await chubbScrollWithinModal(chubbAttachedStructuresIterator(modal));
    await chubbScrollWithinModal(chubbAttachedStructuresAddLink(modal));

    const candidates = [
      modal.locator(`mat-select.house-attached-structure-${index}.attached-structure`),
      modal.locator(`mat-select.house-attached-structure-${index}`),
      modal.locator('section[id*="attached-structures-"] mat-select.attached-structure').first(),
      modal.locator("mat-select.attached-structure").first(),
      modal
        .locator("mat-form-field")
        .filter({ has: modal.locator("mat-label", { hasText: /^Attached Structure$/i }) })
        .locator("mat-select")
        .first(),
    ];

    for (const candidate of candidates) {
      if ((await candidate.count()) === 0) continue;
      try {
        await candidate.waitFor({ state: "attached", timeout: 2_000 });
        await chubbScrollWithinModal(candidate);
        return candidate;
      } catch {
        /* try next candidate */
      }
    }

    await chubbWaitIfSavingQuote(page, 5_000);
    await page.waitForTimeout(350);
  }

  throw new Error(`CHUBB attached structure mat-select not found for row index ${index}.`);
}

async function chubbResolveAttachedStructureSqftInput(
  iterator: ReturnType<Page["locator"]>,
  modal: ReturnType<Page["locator"]>,
  index: number
): Promise<ReturnType<Page["locator"]>> {
  const candidates = [
    iterator.locator(`input.house-attached-structure-sq-ft-${index}`),
    iterator.locator('input[class*="house-attached-structure-sq-ft"]'),
    iterator.locator("input.ft.fs-mask").first(),
    modal.locator(`input.house-attached-structure-sq-ft-${index}`),
    modal.locator('input[class*="house-attached-structure-sq-ft"]').first(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count()) === 0) continue;
    const input = candidate.first();
    await chubbScrollWithinModal(input);
    if (await input.isVisible().catch(() => false)) {
      return input;
    }
    if (await input.count()) {
      return input;
    }
  }

  const fallbacks = [
    modal.locator(`input.house-attached-structure-sq-ft-${index}`),
    modal.locator('input[class*="house-attached-structure-sq-ft"]').first(),
    iterator.locator('input[class*="house-attached-structure-sq-ft"]').first(),
  ];
  for (const fallback of fallbacks) {
    if ((await fallback.count()) > 0) {
      await chubbScrollWithinModal(fallback);
      return fallback;
    }
  }

  throw new Error(`CHUBB attached structure ft² input not found for row index ${index}.`);
}

async function chubbResolveConstructionTypeSelect(
  iterator: ReturnType<Page["locator"]>,
  modal: ReturnType<Page["locator"]>,
  index: number
): Promise<ReturnType<Page["locator"]>> {
  const candidates = [
    iterator.locator(`mat-select.house-home-cost-estimator-construction-type-${index}.construction-type`),
    iterator.locator(`mat-select.house-home-cost-estimator-construction-type-${index}`),
    iterator.locator("mat-select.construction-type").first(),
    iterator
      .locator("mat-form-field")
      .filter({ has: iterator.locator("mat-label", { hasText: /^Construction Type$/i }) })
      .locator("mat-select")
      .first(),
    modal.locator(`mat-select.house-home-cost-estimator-construction-type-${index}`),
    modal.locator("mat-select.construction-type").first(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count()) === 0) continue;
    await chubbScrollWithinModal(candidate);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  const fallback = iterator.locator("mat-select.construction-type").first();
  if ((await fallback.count()) > 0) {
    await chubbScrollWithinModal(fallback);
    return fallback;
  }

  throw new Error(`CHUBB construction type mat-select not found for row index ${index}.`);
}

async function chubbResolveConstructionTypePercentageInput(
  iterator: ReturnType<Page["locator"]>,
  modal: ReturnType<Page["locator"]>,
  index: number
): Promise<ReturnType<Page["locator"]>> {
  const candidates = [
    iterator.locator(`input.house-home-cost-estimator-construction-type-percentage-${index}`),
    iterator.locator('input[class*="construction-type-percentage"]'),
    iterator.locator("input.input-percent.percentage").first(),
    modal.locator(`input.house-home-cost-estimator-construction-type-percentage-${index}`),
    modal.locator('input[class*="construction-type-percentage"]').first(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count()) === 0) continue;
    await chubbScrollWithinModal(candidate.first());
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }

  const fallback = iterator.locator("input.input-percent, input.percentage").first();
  if ((await fallback.count()) > 0) return fallback;

  throw new Error(`CHUBB construction type percentage input not found for row index ${index}.`);
}

async function chubbWaitForModalSectionReady(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  opts: {
    heading: RegExp;
    readyLocator: ReturnType<Page["locator"]>;
    errorMessage: string;
    timeoutMs?: number;
  }
): Promise<void> {
  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);

  while (Date.now() < deadline) {
    await chubbDismissModalSelectPanels(page);
    await chubbScrollWithinModal(modal.getByText(opts.heading).first());

    const total = await opts.readyLocator.count();
    for (let i = 0; i < total; i += 1) {
      const candidate = opts.readyLocator.nth(i);
      await chubbScrollWithinModal(candidate);
      if (await candidate.isVisible().catch(() => false)) {
        return;
      }
    }

    if (total > 0) {
      const first = opts.readyLocator.first();
      try {
        await first.waitFor({ state: "attached", timeout: 2_000 });
        await chubbScrollWithinModal(first);
        if (await first.isVisible().catch(() => false)) {
          return;
        }
      } catch {
        /* keep polling */
      }
    }

    await chubbWaitIfSavingQuote(page, 5_000);
    await page.waitForTimeout(350);
  }

  throw new Error(opts.errorMessage);
}

async function chubbWaitForAttachedStructuresAddEnabled(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  timeoutMs = 60_000
): Promise<ReturnType<Page["locator"]>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await chubbDismissModalSelectPanels(page);
    await chubbScrollWithinModal(modal.getByText(/^Attached Structures$/i).first());

    const enabled = chubbAttachedStructuresAddLinkEnabled(modal);
    if ((await enabled.count()) > 0 && (await enabled.first().isVisible().catch(() => false))) {
      return enabled.first();
    }

    await chubbWaitIfSavingQuote(page, 5_000);
    await page.waitForTimeout(350);
  }

  throw new Error(
    "CHUBB '+ Add attached structures' is still disabled — complete Building Type, Living Area, Year Built, Classification, and Agent Email first."
  );
}

async function chubbWaitForConstructionTypesAddEnabled(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  timeoutMs = 60_000
): Promise<ReturnType<Page["locator"]>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await chubbDismissModalSelectPanels(page);
    await chubbScrollWithinModal(modal.getByText(/^Construction Type$/i).first());

    const enabled = chubbConstructionTypesAddLinkEnabled(modal);
    if ((await enabled.count()) > 0 && (await enabled.first().isVisible().catch(() => false))) {
      return enabled.first();
    }

    await chubbWaitIfSavingQuote(page, 5_000);
    await page.waitForTimeout(350);
  }

  throw new Error(
    "CHUBB '+ Add construction types' is still disabled — complete required Home Coverage Estimator fields first."
  );
}

async function chubbEnsureCoverageEstimatorRenovated(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  payload: unknown
): Promise<void> {
  const renovatedValue = chubbResidenceRenovatedOptional(payload)?.trim();
  const renovatedSelect = await chubbModalRenovatedSelect(page, modal);
  if (!renovatedSelect) {
    if (renovatedValue) {
      throw new Error(
        "CHUBB Renovated field not found in Home Coverage Estimator (payload has a value)."
      );
    }
    return;
  }
  if (renovatedValue) {
    await chubbSelectMatOptionByText(page, renovatedSelect, renovatedValue, { force: true });
  } else if (await chubbMatSelectIsEmpty(renovatedSelect)) {
    await chubbSelectFirstMatOption(page, renovatedSelect, { force: true });
  }

  await chubbWaitIfSavingQuote(page, 15_000);
  if (renovatedValue && (await chubbMatSelectIsEmpty(renovatedSelect))) {
    throw new Error(
      `CHUBB Renovated was not set in Home Coverage Estimator (payload: ${renovatedValue}).`
    );
  }
  await chubbAssertCoverageEstimatorModalOpen(page);
}

async function chubbWaitForCoverageEstimatorPrerequisites(
  page: Page,
  modal: ReturnType<Page["locator"]>
): Promise<void> {
  const buildingSelect = modal.locator("mat-select.building-type").first();
  const yearSelect = modal.locator("mat-select.year-built, mat-select.year-built-hce").first();
  const classSelect = modal.locator("mat-select.classification").first();
  const livingArea = modal.locator("input.living-area-square-feet, input.living-area-ft").first();

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const buildingOk = await chubbModalSelectHasValue(buildingSelect);
    const yearOk = await chubbModalSelectHasValue(yearSelect);
    const classOk = await chubbModalSelectHasValue(classSelect);
    const area = chubbNumericOnly((await livingArea.inputValue().catch(() => "")).trim());

    if (buildingOk && yearOk && classOk && area.length > 0) {
      const addEnabled = chubbAttachedStructuresAddLinkEnabled(modal);
      if ((await addEnabled.count()) > 0) {
        return;
      }
    }

    await chubbDismissModalSelectPanels(page);
    await page.waitForTimeout(350);
  }

  throw new Error(
    "CHUBB Home Coverage Estimator required fields are incomplete or Add attached structures is still disabled."
  );
}

async function chubbFillCoverageEstimatorAgentEmail(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  payload: unknown
): Promise<void> {
  const email = chubbClientEmail(payload);
  if (!email) return;

  const input = modal
    .locator("mat-form-field")
    .filter({ has: modal.locator("mat-label", { hasText: /Agent Email/i }) })
    .locator("input.agent-email-address, input[type='email']")
    .first()
    .or(modal.locator("input.agent-email-address").first());
  if ((await input.count()) === 0) return;

  const current = (await input.inputValue().catch(() => "")).trim();
  if (current.length > 0) return;

  await chubbFillInput(page, input, email);
  await chubbWaitIfSavingQuote(page, 15_000);
}

async function chubbEnsureModalLocatorVisible(
  page: Page,
  locator: ReturnType<Page["locator"]>
): Promise<void> {
  await locator.waitFor({ state: "attached", timeout: 30_000 });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await chubbScrollWithinModal(locator);
    await chubbScrollFieldBelowHeader(locator);
    if (await locator.isVisible().catch(() => false)) return;
    await page.waitForTimeout(250);
  }

  throw new Error("CHUBB Home Coverage Estimator field did not become visible in the modal.");
}

async function chubbDismissModalSelectPanels(page: Page): Promise<void> {
  const hceOpen = await chubbIsCoverageEstimatorOpen(page);

  const optionOpen = await page
    .locator(".cdk-overlay-pane mat-option")
    .first()
    .isVisible()
    .catch(() => false);
  if (optionOpen) {
    if (hceOpen) {
      const modal = chubbCoverageEstimatorModal(page);
      await modal
        .locator(".mat-mdc-dialog-content, .dialog-content, .content-container")
        .first()
        .click({ position: { x: 24, y: 24 }, force: true })
        .catch(() => undefined);
    } else {
      await chubbClickResidencePageToCloseOverlays(page);
    }
    await chubbDismissHeaderResourcesMenu(page);
    if (hceOpen) {
      await chubbAssertCoverageEstimatorModalOpen(page);
      return;
    }
  }

  if (hceOpen) {
    return;
  }

  await chubbClickResidencePageToCloseOverlays(page);
  await chubbDismissHeaderResourcesMenu(page);
}

/**
 * Resources header menu opens right after HCE Calculate — close without Escape (Escape re-opens it).
 */
async function chubbDismissResourcesMenuAfterCalculate(page: Page): Promise<void> {
  await page.waitForTimeout(500);
  await chubbWaitIfSavingQuote(page, 90_000);

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;
    await chubbStripHeaderResourcesMenuOverlay(page);
    await chubbClickOutsideHeaderMenu(page);
    await chubbDismissHeaderResourcesMenu(page);
    await page.waitForTimeout(250);
  }
}

/** After Calculate / Apply: close Resources menu, then wait for Home Estimate (no Escape). */
async function chubbDismissPostCalculateOverlay(
  page: Page,
  modal: ReturnType<Page["locator"]>
): Promise<void> {
  await chubbDismissResourcesMenuAfterCalculate(page);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await chubbDismissHeaderResourcesMenu(page);

    const matOptionOpen = await page
      .locator(".cdk-overlay-pane mat-option")
      .first()
      .isVisible()
      .catch(() => false);
    if (matOptionOpen && (await chubbIsCoverageEstimatorOpen(page))) {
      await modal
        .locator(".mat-mdc-dialog-content, .dialog-content, .content-container")
        .first()
        .click({ position: { x: 24, y: 24 }, force: true })
        .catch(() => undefined);
      await page.waitForTimeout(300);
      await chubbDismissHeaderResourcesMenu(page);
    }

    const estimateVisible = await modal
      .locator(".home-estimate-result-label")
      .filter({ hasText: /Home Estimate/i })
      .first()
      .isVisible()
      .catch(() => false);
    if (estimateVisible) {
      await chubbDismissHeaderResourcesMenu(page);
      return;
    }

    await chubbWaitIfSavingQuote(page, 8_000);
    await page.waitForTimeout(350);
  }
}

async function chubbCountAttachedStructureRows(
  modal: ReturnType<Page["locator"]>
): Promise<number> {
  const iterator = chubbAttachedStructuresIterator(modal);
  const fromPaginator = await chubbIteratorTotalFromPaginator(iterator);
  if (fromPaginator > 0) return fromPaginator;

  const removeLinks = await modal.locator('a[class*="house-remove-attached-structure"]').count();
  if (removeLinks > 0) return removeLinks;

  return modal.locator("mat-select.attached-structure").count();
}

async function chubbCountConstructionTypeRows(
  modal: ReturnType<Page["locator"]>
): Promise<number> {
  const iterator = chubbConstructionTypesIterator(modal);
  const fromPaginator = await chubbIteratorTotalFromPaginator(iterator);
  if (fromPaginator > 0) return fromPaginator;

  const removeLinks = await modal
    .locator('a[class*="house-home-cost-estimator-remove-construction-type"]')
    .count();
  if (removeLinks > 0) return removeLinks;

  return modal.locator("mat-select.construction-type").count();
}

async function chubbClickAttachedStructuresAdd(
  page: Page,
  modal: ReturnType<Page["locator"]>
): Promise<void> {
  await chubbDismissModalSelectPanels(page);
  const add = await chubbWaitForAttachedStructuresAddEnabled(page, modal, 15_000);
  await chubbScrollWithinModal(add);
  await add.click({ timeout: 10_000 });
}

async function chubbClickConstructionTypesAdd(
  page: Page,
  modal: ReturnType<Page["locator"]>
): Promise<void> {
  await chubbDismissModalSelectPanels(page);
  const add = await chubbWaitForConstructionTypesAddEnabled(page, modal, 60_000);
  await chubbScrollWithinModal(add);
  await add.click({ timeout: 10_000 });
}

async function chubbWaitForConstructionTypeRowReady(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  index: number,
  timeoutMs = 45_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const iterator = chubbConstructionTypesIterator(modal);

  while (Date.now() < deadline) {
    await chubbDismissModalSelectPanels(page);
    await chubbScrollWithinModal(modal.getByText(/^Construction Type$/i).first());
    await chubbScrollWithinModal(chubbConstructionTypesAddLink(modal));
    await chubbSelectIteratorPage(page, iterator, index);

    const typeSelect = modal.locator(
      `mat-select.house-home-cost-estimator-construction-type-${index}.construction-type, mat-select.house-home-cost-estimator-construction-type-${index}`
    );
    const pctInput = modal.locator(
      `input.house-home-cost-estimator-construction-type-percentage-${index}, input[class*="construction-type-percentage"]`
    );

    if (
      (await typeSelect.count()) > 0 &&
      (await typeSelect.first().isVisible().catch(() => false)) &&
      (await pctInput.count()) > 0 &&
      (await pctInput.first().isVisible().catch(() => false))
    ) {
      return;
    }

    await chubbWaitIfSavingQuote(page, 5_000);
    await page.waitForTimeout(350);
  }

  throw new Error(
    `CHUBB Construction Type row ${index + 1} did not load in Home Coverage Estimator.`
  );
}

async function chubbWaitForModalRowCountAtLeast(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  countRows: (modal: ReturnType<Page["locator"]>) => Promise<number>,
  minCount: number,
  timeoutMs: number
): Promise<number> {
  const start = Date.now();
  let count = await countRows(modal);
  while (Date.now() - start < timeoutMs) {
    if (count >= minCount) return count;
    await page.waitForTimeout(200);
    count = await countRows(modal);
  }
  return count;
}

async function chubbEnsureAttachedStructureRowAtIndex(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  rowIndex: number
): Promise<void> {
  const needed = rowIndex + 1;
  let count = await chubbCountAttachedStructureRows(modal);
  if (count >= needed) return;

  let attempts = 0;
  while (count < needed && attempts < 4) {
    await chubbClickAttachedStructuresAdd(page, modal);
    await chubbWaitIfSavingQuote(page, 30_000);
    count = await chubbWaitForModalRowCountAtLeast(
      page,
      modal,
      chubbCountAttachedStructureRows,
      needed,
      15_000
    );
    if (count >= needed) return;
    attempts += 1;
  }

  throw new Error(
    `CHUBB modal did not reach ${needed} attached structure row(s) (found ${count}) after clicking Add attached structures.`
  );
}

async function chubbEnsureConstructionTypeRowAtIndex(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  rowIndex: number
): Promise<void> {
  const needed = rowIndex + 1;
  let count = await chubbCountConstructionTypeRows(modal);
  if (count >= needed) {
    await chubbWaitForConstructionTypeRowReady(page, modal, rowIndex);
    return;
  }

  let attempts = 0;
  while (count < needed && attempts < 4) {
    if (rowIndex > 0) {
      await chubbWaitForConstructionTypesAddEnabled(page, modal, 60_000);
    }
    await chubbClickConstructionTypesAdd(page, modal);
    await chubbWaitIfSavingQuote(page, 30_000);
    count = await chubbWaitForModalRowCountAtLeast(
      page,
      modal,
      chubbCountConstructionTypeRows,
      needed,
      20_000
    );
    if (count >= needed) {
      await chubbWaitForConstructionTypeRowReady(page, modal, rowIndex);
      return;
    }
    attempts += 1;
  }

  throw new Error(
    `CHUBB modal did not reach ${needed} construction type row(s) (found ${count}) after clicking Add construction types.`
  );
}

async function chubbFillAttachedStructureRow(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  index: number,
  item: ChubbAttachedStructurePayload
): Promise<void> {
  const iterator = chubbAttachedStructuresIterator(modal);
  await chubbSelectIteratorPage(page, iterator, index);

  const typeSelect = await chubbWaitForAttachedStructureTypeSelect(page, modal, index);
  await chubbScrollWithinModal(typeSelect);
  await chubbSelectMatOptionByText(page, typeSelect, item.attachedStructureType, { force: true });

  const sqftInput = await chubbResolveAttachedStructureSqftInput(iterator, modal, index);
  await chubbFillInput(page, sqftInput, chubbNumericOnly(item.squareFeet));
}

async function chubbFillConstructionTypeRow(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  index: number,
  item: ChubbConstructionTypePayload
): Promise<void> {
  const iterator = chubbConstructionTypesIterator(modal);
  await chubbWaitForConstructionTypeRowReady(page, modal, index);
  await chubbSelectIteratorPage(page, iterator, index);

  const typeSelect = await chubbResolveConstructionTypeSelect(iterator, modal, index);
  await chubbEnsureModalLocatorVisible(page, typeSelect);
  await chubbSelectMatOptionByText(page, typeSelect, item.constructionType, { force: true });
  await chubbWaitIfSavingQuote(page, 10_000);
  if (!(await chubbModalSelectHasValue(typeSelect))) {
    throw new Error(
      `CHUBB Construction Type was not set for row ${index + 1} in Home Coverage Estimator.`
    );
  }

  const pctInput = await chubbResolveConstructionTypePercentageInput(iterator, modal, index);
  await chubbEnsureModalLocatorVisible(page, pctInput);
  const pctValue = chubbPercentValue(item.percentage);
  await chubbFillInput(page, pctInput, pctValue);
  await chubbWaitIfSavingQuote(page, 10_000);

  const filledPct = chubbNumericOnly((await pctInput.inputValue().catch(() => "")).trim());
  if (!filledPct || filledPct === "0") {
    throw new Error(
      `CHUBB Construction Type percentage was not set for row ${index + 1} in Home Coverage Estimator.`
    );
  }
}

async function chubbFillConstructionTypesInModal(
  page: Page,
  modal: ReturnType<Page["locator"]>,
  payload: unknown
): Promise<void> {
  const constructionTypes = chubbResidenceConstructionTypes(payload);
  if (constructionTypes.length === 0) return;

  await chubbAssertCoverageEstimatorModalOpen(page);
  await chubbScrollWithinModal(modal.getByText(/^Construction Type$/i).first());
  await chubbScrollWithinModal(chubbConstructionTypesAddLink(modal));

  for (let i = 0; i < constructionTypes.length; i += 1) {
    await chubbAssertCoverageEstimatorModalOpen(page);
    await chubbEnsureConstructionTypeRowAtIndex(page, modal, i);
    await chubbFillConstructionTypeRow(page, modal, i, constructionTypes[i]);
    await chubbDismissModalSelectPanels(page);
  }
}

async function chubbResolveLivingAreaInput(
  modal: ReturnType<Page["locator"]>
): Promise<ReturnType<Page["locator"]>> {
  const candidates = [
    chubbModalInputByLabel(modal, /Living Area/i),
    chubbModalInputFallbacks(modal, [
      "input.living-area-square-feet.living-area-ft",
      "input.living-area-sq-ft",
      "input.living-area-square-feet",
      "input.living-area",
      "input[name*='LivingArea' i]",
      "input[name*='Living' i]",
      "input.input-number.living-area-sq-ft",
    ]),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count()) > 0 && (await candidate.first().isVisible().catch(() => false))) {
      return candidate.first();
    }
  }

  throw new Error("CHUBB Home Coverage Estimator living area input not found in modal.");
}

async function chubbFillCoverageEstimatorModal(page: Page, payload: unknown): Promise<void> {
  const modal = chubbCoverageEstimatorModal(page);
  await modal.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(500);

  const buildingSelect = await chubbResolveModalSelect(modal, "buildingType");
  await chubbSelectMatOptionByText(
    page,
    buildingSelect,
    chubbResidenceBuildingType(payload),
    { force: true }
  );
  await chubbWaitIfSavingQuote(page, 15_000);
  if (!(await chubbModalSelectHasValue(buildingSelect))) {
    throw new Error("CHUBB Building Type was not set in Home Coverage Estimator.");
  }

  await chubbFillInput(
    page,
    await chubbResolveLivingAreaInput(modal),
    chubbNumericOnly(chubbResidenceLivingAreaSqFt(payload))
  );
  await chubbWaitIfSavingQuote(page, 10_000);

  const yearBuiltSelect = await chubbResolveModalSelect(modal, "yearBuilt");
  await chubbSelectMatOptionByText(
    page,
    yearBuiltSelect,
    chubbResidenceYearBuilt(payload),
    { force: true }
  );
  await chubbWaitIfSavingQuote(page, 15_000);
  if (!(await chubbModalSelectHasValue(yearBuiltSelect))) {
    throw new Error("CHUBB Year Built was not set in Home Coverage Estimator.");
  }

  const classificationSelect = await chubbResolveModalSelect(modal, "classification");
  await chubbSelectMatOptionByText(
    page,
    classificationSelect,
    chubbResidenceClassification(payload),
    { force: true }
  );
  await chubbWaitIfSavingQuote(page, 15_000);
  if (!(await chubbModalSelectHasValue(classificationSelect))) {
    throw new Error("CHUBB Classification was not set in Home Coverage Estimator.");
  }

  await chubbFillCoverageEstimatorAgentEmail(page, modal, payload);
  await chubbAssertCoverageEstimatorModalOpen(page);

  await chubbEnsureCoverageEstimatorRenovated(page, modal, payload);

  const percentRenovated = chubbResidencePercentRenovated(payload);
  if (percentRenovated) {
    const pctField = chubbModalInputByLabel(modal, /^Percent [Rr]enovated$/);
    if ((await pctField.count()) > 0 && (await pctField.isVisible().catch(() => false))) {
      await chubbFillInput(page, pctField, chubbPercentValue(percentRenovated));
      await chubbWaitIfSavingQuote(page, 10_000);
      await chubbAssertCoverageEstimatorModalOpen(page);
    }
  }

  await chubbWaitForCoverageEstimatorPrerequisites(page, modal);
  await chubbAssertCoverageEstimatorModalOpen(page);

  const attachedStructures = chubbResidenceAttachedStructures(payload);
  if (attachedStructures.length > 0) {
    for (let i = 0; i < attachedStructures.length; i += 1) {
      await chubbAssertCoverageEstimatorModalOpen(page);
      await chubbEnsureAttachedStructureRowAtIndex(page, modal, i);
      await chubbFillAttachedStructureRow(page, modal, i, attachedStructures[i]);
      await chubbDismissModalSelectPanels(page);
    }
  }

  await chubbFillConstructionTypesInModal(page, modal, payload);

  await chubbSubmitCoverageEstimatorModal(page, modal);
}

async function chubbSubmitCoverageEstimatorModal(
  page: Page,
  modal: ReturnType<Page["locator"]>
): Promise<void> {
  const calculateBtn = modal
    .locator("a.calculate-home-cost-estimator, a.calculate")
    .filter({ hasText: /^Calculate$/i })
    .first();
  await chubbScrollWithinModal(calculateBtn);
  await chubbStripHeaderResourcesMenuOverlay(page);
  await calculateBtn.click({ force: true, timeout: 15_000 });

  await modal
    .locator(".mat-mdc-dialog-content, .dialog-content, .content-container")
    .first()
    .click({ position: { x: 32, y: 32 }, force: true })
    .catch(() => undefined);

  for (let i = 0; i < 8; i += 1) {
    await chubbStripHeaderResourcesMenuOverlay(page);
    await chubbClickOutsideHeaderMenu(page);
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) break;
    await page.waitForTimeout(200);
  }

  await chubbDismissPostCalculateOverlay(page, modal);

  if (!(await chubbIsCoverageEstimatorOpen(page))) {
    await chubbRestoreResidencePageAfterHceClose(page);
    return;
  }

  const activeModal = chubbCoverageEstimatorModal(page);

  await activeModal
    .locator(".home-estimate-result-label")
    .filter({ hasText: /Home Estimate/i })
    .waitFor({ state: "visible", timeout: 90_000 });

  const applyLink = activeModal
    .locator(
      "a.apply-home-cost-estimator, a[class*='apply-home-cost-estimator'], a.arrow-action"
    )
    .filter({ hasText: /Apply to Quote/i })
    .first();
  await applyLink.waitFor({ state: "visible", timeout: 60_000 });
  await chubbScrollWithinModal(applyLink);
  await applyLink.click({ force: true, timeout: 15_000 });

  await chubbWaitIfSavingQuote(page, 30_000);
  await chubbDismissResourcesMenuAfterCalculate(page);

  if (!(await chubbIsCoverageEstimatorOpen(page))) {
    await chubbRestoreResidencePageAfterHceClose(page);
    return;
  }

  const confirmModal = chubbCoverageEstimatorModal(page);

  await confirmModal
    .locator(".dialog-confirmation h3, h3")
    .filter({ hasText: /save the replacement cost to the Quote/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  const yesBtn = confirmModal.locator("a.confirmation-yes, a.confirmation-link.confirmation-yes").first();
  await yesBtn.click({ force: true, timeout: 15_000 });

  await chubbWaitIfSavingQuote(page, 90_000);
  await confirmModal.waitFor({ state: "hidden", timeout: 90_000 });
  await chubbStripHeaderResourcesMenuOverlay(page);
  await chubbClickOutsideHeaderMenu(page);
  await chubbRestoreResidencePageAfterHceClose(page);
}

async function chubbWaitForBuildingValueFilled(
  root: ReturnType<Page["locator"]>,
  timeoutMs: number
): Promise<void> {
  const input = root.locator("input.building-value, input.structure-amount").first();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const value = chubbNumericOnly((await input.inputValue().catch(() => "")).trim());
    const hasError = await root
      .locator("mat-error")
      .filter({ hasText: /Building Value is required/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (value.length > 0 && !hasError) return;
    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error("CHUBB Building Value was not populated after Home Coverage Estimator Calculate.");
}

async function chubbFillMainResidenceFields(
  page: Page,
  root: ReturnType<Page["locator"]>,
  payload: unknown
): Promise<void> {
  await chubbWakeResidenceFormInteractivity(page);
  await chubbPunchThroughResidenceOverlay(page);
  await chubbWaitForPageInteractive(page, 30_000);

  const residenceDeductible = chubbResidenceDeductible(payload);
  if (residenceDeductible) {
    await chubbSelectMatOptionByText(
      page,
      root.locator("mat-select.residence-deductible").first(),
      residenceDeductible,
      { force: true }
    );
  }

  const contentsAmount = chubbResidenceContentsAmount(payload);
  if (contentsAmount) {
    await chubbFillInput(
      page,
      root.locator("input.contents-amount").first(),
      chubbNumericOnly(contentsAmount)
    );
  }

  const contentsPercentage = chubbResidenceContentsPercentage(payload);
  if (contentsPercentage) {
    await chubbFillInput(
      page,
      root.locator("input.contents-percentage").first(),
      chubbPercentValue(contentsPercentage)
    );
  }

  const typeOfContents = chubbResidenceTypeOfContents(payload);
  if (typeOfContents) {
    await chubbSelectMatOptionByText(
      page,
      root.locator("mat-select.type-of-contents").first(),
      typeOfContents,
      { force: true }
    );
  }

  const otherPermanentStructuresAmount = chubbResidenceOtherPermanentStructuresAmount(payload);
  if (otherPermanentStructuresAmount) {
    await chubbFillInput(
      page,
      root.locator("input.other-permanent-structures-amount").first(),
      chubbNumericOnly(otherPermanentStructuresAmount)
    );
  }

  const otherPct = chubbResidenceOtherPermanentStructuresPercentage(payload);
  if (otherPct) {
    await chubbFillInput(
      page,
      root.locator("input.other-permanent-structures-percentage").first(),
      chubbPercentValue(otherPct)
    );
  }

  const waiver = chubbResidenceDeductibleWaiverOption(payload);
  if (waiver) {
    await chubbSelectMatOptionByText(
      page,
      root.locator("mat-select.deductible-waiver-option").first(),
      waiver,
      { force: true }
    );
  }

  await chubbWaitIfSavingQuote(page);
  await chubbDismissHeaderResourcesMenu(page);
}

/**
 * Residence info (property section): Building Value calculator modal → coverage fields → Continue.
 */
export async function runChubbResidenceInfo(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  try {
    updateStep("chubb_wait_residence_info");
    await chubbWaitForResidenceInfoPage(page, Math.max(timeoutMs, 90_000));

    const root = page.locator(".bdd-residence-info-0").first();

    updateStep("chubb_open_building_value_calculator");
    await chubbOpenBuildingValueCalculator(page, root);

    updateStep("chubb_fill_coverage_estimator");
    await chubbFillCoverageEstimatorModal(page, payload);
    await chubbRestoreResidencePageAfterHceClose(page);

    updateStep("chubb_wait_building_value");
    await chubbWaitForBuildingValueFilled(root, 60_000);
    await chubbStripHeaderResourcesMenuOverlay(page);

    updateStep("chubb_fill_residence_coverage_fields");
    await chubbFillMainResidenceFields(page, root, payload);

    updateStep("chubb_fill_residence_risk_section");
    await chubbFillResidenceRiskSection(page, root, payload);

    updateStep("chubb_residence_info_continue");
    await chubbResidenceInfoContinueWithLoading(page, timeoutMs, updateStep);
  } finally {
    await chubbLockHeaderResourcesMenu(page, false);
  }
}
