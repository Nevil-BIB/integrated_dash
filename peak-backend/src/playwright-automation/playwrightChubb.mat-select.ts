import type { Page } from "playwright";
import {
  chubbClickPageToDismissOverlays,
  chubbDismissHeaderResourcesMenu,
  chubbIsHeaderResourcesMenuPanelVisible,
  chubbPunchThroughResidenceOverlay,
  chubbStripHeaderResourcesMenuOverlay,
} from "./playwrightChubb.page-guard";

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

async function chubbWaitForMatSelectClosed(
  selectLocator: ReturnType<Page["locator"]>,
  timeoutMs = 8_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const expanded = await selectLocator.getAttribute("aria-expanded").catch(() => "false");
    if (expanded !== "true") return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function chubbIsResidenceRiskForm(page: Page): Promise<boolean> {
  return page
    .locator(".bdd-residence-info-0 #risk-section")
    .first()
    .isVisible()
    .catch(() => false);
}

async function chubbPrepareMatSelectPage(page: Page, fast: boolean): Promise<void> {
  const onClientInfo = await page
    .locator(".bdd-client-info")
    .first()
    .isVisible()
    .catch(() => false);
  const onResidenceRisk = fast || (await chubbIsResidenceRiskForm(page));

  if (onClientInfo || onResidenceRisk) {
    if (await chubbIsHeaderResourcesMenuPanelVisible(page)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await chubbDismissHeaderResourcesMenu(page);
    }
    return;
  }

  await chubbPunchThroughResidenceOverlay(page);
}

async function chubbFinishMatSelectPage(page: Page, fast: boolean): Promise<void> {
  const onClientInfo = await page
    .locator(".bdd-client-info")
    .first()
    .isVisible()
    .catch(() => false);
  const onResidenceRisk = fast || (await chubbIsResidenceRiskForm(page));

  if (onClientInfo || onResidenceRisk) {
    await chubbDismissHeaderResourcesMenu(page).catch(() => undefined);
    return;
  }

  await chubbStripHeaderResourcesMenuOverlay(page);
  await chubbDismissHeaderResourcesMenu(page);
}

async function chubbIsHomeCoverageEstimatorOpen(page: Page): Promise<boolean> {
  return page
    .locator("mat-dialog-container, .mat-mdc-dialog-container")
    .filter({ hasText: /Home Coverage Estimator/i })
    .first()
    .isVisible()
    .catch(() => false);
}

export async function chubbCloseMatSelectIfOpen(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>
): Promise<void> {
  await chubbWaitForMatSelectClosed(selectLocator, 5_000);

  const expanded = await selectLocator.getAttribute("aria-expanded").catch(() => "false");
  if (expanded === "true") {
    if (await chubbIsHomeCoverageEstimatorOpen(page)) {
      const modal = page
        .locator("mat-dialog-container, .mat-mdc-dialog-container")
        .filter({ hasText: /Home Coverage Estimator/i })
        .last();
      await modal
        .locator(".mat-mdc-dialog-content, .dialog-content, .content-container")
        .first()
        .click({ position: { x: 24, y: 24 }, force: true })
        .catch(() => undefined);
    } else {
      await page.keyboard.press("Escape").catch(() => undefined);
      await chubbWaitForMatSelectClosed(selectLocator, 2_500);

      const stillExpanded =
        (await selectLocator.getAttribute("aria-expanded").catch(() => "false")) === "true";
      if (stillExpanded) {
        await chubbClickPageToDismissOverlays(page);
        await chubbDismissHeaderResourcesMenu(page);
        await chubbWaitForMatSelectClosed(selectLocator, 2_500);
      }
    }
  }
}

function chubbOverlayOptions(page: Page, selectId?: string | null): ReturnType<Page["locator"]> {
  if (selectId) {
    return page.locator(`#${selectId}-panel mat-option:not([aria-disabled="true"])`);
  }
  return page
    .locator(".cdk-overlay-pane")
    .last()
    .locator('mat-option:not([aria-disabled="true"])');
}

async function chubbOverlayOptionsForSelect(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>
): Promise<ReturnType<Page["locator"]>> {
  const selectId = await selectLocator.getAttribute("id");
  const ariaControls = await selectLocator.getAttribute("aria-controls");

  if (ariaControls) {
    const byControls = page.locator(`#${ariaControls} mat-option:not([aria-disabled="true"])`);
    if ((await byControls.count()) > 0) return byControls;
  }

  if (selectId) {
    const byPanel = chubbOverlayOptions(page, selectId);
    if ((await byPanel.count()) > 0) return byPanel;
  }

  const roleOptions = page.getByRole("option");
  if ((await roleOptions.count()) > 0) return roleOptions;

  return chubbOverlayOptions(page, selectId);
}

async function chubbWaitForOverlayOptions(
  page: Page,
  selectId: string | null,
  timeoutMs: number
): Promise<ReturnType<Page["locator"]>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const byPanel = chubbOverlayOptions(page, selectId);
    if ((await byPanel.count()) > 0 && (await byPanel.first().isVisible().catch(() => false))) {
      return byPanel;
    }

    const generic = chubbOverlayOptions(page, null);
    if ((await generic.count()) > 0 && (await generic.first().isVisible().catch(() => false))) {
      return generic;
    }

    const roleOption = page.getByRole("option").first();
    if (await roleOption.isVisible().catch(() => false)) {
      return page.getByRole("option");
    }

    await page.waitForTimeout(150);
  }

  return chubbOverlayOptions(page, selectId);
}

async function chubbScrollOptionIntoPanelView(option: ReturnType<Page["locator"]>): Promise<void> {
  await option.evaluate((el) => {
    const optionEl = el as HTMLElement;
    const panel = optionEl.closest(".mat-mdc-select-panel, [role='listbox']") as HTMLElement | null;
    if (panel) {
      const optionTop = optionEl.offsetTop;
      const optionBottom = optionTop + optionEl.offsetHeight;
      const viewTop = panel.scrollTop;
      const viewBottom = viewTop + panel.clientHeight;
      if (optionTop < viewTop) {
        panel.scrollTop = Math.max(0, optionTop - 8);
      } else if (optionBottom > viewBottom) {
        panel.scrollTop = optionBottom - panel.clientHeight + 8;
      }
    }
    optionEl.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  });
}

async function chubbResolveMatOption(
  page: Page,
  options: ReturnType<Page["locator"]>,
  optionText: string | undefined
): Promise<ReturnType<Page["locator"]>> {
  if (!optionText?.trim()) return options.first();

  const escaped = optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = options.filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`, "i") }).first();
  if ((await exact.count()) > 0) return exact;

  const partial = options.filter({ hasText: new RegExp(escaped, "i") }).first();
  if ((await partial.count()) > 0) return partial;

  const byRole = page.getByRole("option", { name: new RegExp(`^\\s*${escaped}\\s*$`, "i") }).first();
  if ((await byRole.count()) > 0 && (await byRole.isVisible().catch(() => false))) {
    return byRole;
  }

  return options.first();
}

async function chubbWaitForMatSelectValueMatch(
  selectLocator: ReturnType<Page["locator"]>,
  expectedText: string | undefined,
  timeoutMs: number,
  anyValue = false
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await chubbMatSelectHasValue(selectLocator)) {
      if (anyValue || !expectedText?.trim()) return;
      const current = (await chubbMatSelectDisplayValue(selectLocator)).trim();
      const escaped = expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(escaped, "i").test(current)) return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const current = (await chubbMatSelectDisplayValue(selectLocator)).trim();
  if (anyValue && current) return;

  throw new Error(
    `CHUBB mat-select did not retain a value after selecting ${expectedText ?? "first option"}${current ? ` (displayed "${current}")` : ""}.`
  );
}

async function chubbClickMatOptionRobust(
  page: Page,
  option: ReturnType<Page["locator"]>,
  selectLocator: ReturnType<Page["locator"]>
): Promise<void> {
  await chubbScrollOptionIntoPanelView(option);

  const label = option.locator(".mdc-list-item__primary-text, span").first();
  const labelCount = await label.count().catch(() => 0);
  const clickTarget = labelCount > 0 ? label : option;

  const clicked = await clickTarget.click({ force: true, timeout: 8_000 }).then(() => true).catch(() => false);
  if (clicked) return;

  const domClicked = await clickTarget
    .evaluate((el) => {
      (el as HTMLElement).scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      (el as HTMLElement).click();
      return true;
    })
    .then(() => true)
    .catch(() => false);
  if (domClicked) return;

  // Last fallback: keyboard select highlighted option.
  await selectLocator.focus().catch(() => undefined);
  await page.keyboard.press("ArrowDown").catch(() => undefined);
  await page.keyboard.press("Enter").catch(() => undefined);
}

async function chubbOpenMatSelect(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>,
  opts?: { allowDisabled?: boolean; fast?: boolean }
): Promise<void> {
  const fast = Boolean(opts?.fast);
  const pollMs = fast ? 50 : 150;
  const firstOpenMs = fast ? 5_000 : 12_000;
  const secondOpenMs = fast ? 3_000 : 8_000;
  const thirdOpenMs = fast ? 2_000 : 5_000;

  await selectLocator.waitFor({ state: "visible", timeout: 30_000 });
  await chubbScrollFieldBelowHeader(selectLocator);

  const expanded = await selectLocator.getAttribute("aria-expanded").catch(() => "false");
  if (expanded === "true") return;

  const disabled = await selectLocator.getAttribute("aria-disabled").catch(() => "false");
  if (disabled === "true" && !opts?.allowDisabled) {
    throw new Error("CHUBB mat-select is disabled and cannot be opened.");
  }

  const trigger = selectLocator.locator(".mat-mdc-select-trigger").first();
  await trigger.click({ force: true, timeout: 15_000 }).catch(() => undefined);

  let openDeadline = Date.now() + firstOpenMs;
  while (Date.now() < openDeadline) {
    const isExpanded =
      (await selectLocator.getAttribute("aria-expanded").catch(() => "false")) === "true";
    const options = await chubbOverlayOptionsForSelect(page, selectLocator);
    const count = await options.count();
    if (isExpanded && count > 0) return;
    if (count > 0) return;
    await page.waitForTimeout(pollMs);
  }

  await selectLocator.focus().catch(() => undefined);
  await page.keyboard.press("ArrowDown").catch(() => undefined);
  await page.waitForTimeout(fast ? 100 : 350);

  openDeadline = Date.now() + secondOpenMs;
  while (Date.now() < openDeadline) {
    const options = await chubbOverlayOptionsForSelect(page, selectLocator);
    if ((await options.count()) > 0) return;
    await page.waitForTimeout(pollMs);
  }

  await selectLocator.evaluate((el) => {
    const triggerEl = el.querySelector(".mat-mdc-select-trigger") as HTMLElement | null;
    (triggerEl ?? (el as HTMLElement)).dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    (triggerEl ?? (el as HTMLElement)).dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    (triggerEl ?? (el as HTMLElement)).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  openDeadline = Date.now() + thirdOpenMs;
  while (Date.now() < openDeadline) {
    const options = await chubbOverlayOptionsForSelect(page, selectLocator);
    if ((await options.count()) > 0) return;
    await page.waitForTimeout(pollMs);
  }

  throw new Error("CHUBB mat-select did not open — overlay may still be blocking the dropdown.");
}

export async function chubbMatSelectDisplayValue(
  selectLocator: ReturnType<Page["locator"]>
): Promise<string> {
  const fromValueText = await selectLocator
    .locator(".mat-mdc-select-value-text")
    .innerText()
    .catch(() => "");
  if (fromValueText.trim()) return fromValueText;

  return selectLocator
    .locator(".mat-mdc-select-value .mat-mdc-select-min-line")
    .innerText()
    .catch(() => "");
}

export async function chubbMatSelectIsEmpty(selectLocator: ReturnType<Page["locator"]>): Promise<boolean> {
  const emptyClass = await selectLocator
    .evaluate((el) => el.classList.contains("mat-mdc-select-empty"))
    .catch(() => true);
  if (!emptyClass) return false;

  const text = (await chubbMatSelectDisplayValue(selectLocator)).trim();
  return text.length === 0;
}

async function chubbMatSelectHasValue(selectLocator: ReturnType<Page["locator"]>): Promise<boolean> {
  if (await chubbMatSelectIsEmpty(selectLocator)) return false;
  const text = (await chubbMatSelectDisplayValue(selectLocator)).trim();
  return text.length > 0;
}

/**
 * Open a mat-select and pick an option by text (partial match) or first option.
 * Uses `#mat-select-N-panel` when the select has id mat-select-N.
 */
export async function chubbSelectMatSelectOption(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>,
  opts?: { optionText?: string; allowDisabled?: boolean; pickFirst?: boolean; fast?: boolean }
): Promise<void> {
  const maxAttempts = opts?.fast ? 2 : 3;
  const retryMs = opts?.fast ? 150 : 500;
  const overlayWaitMs = opts?.fast ? 6_000 : 12_000;
  const valueMatchMs = opts?.fast ? 6_000 : 10_000;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await chubbPrepareMatSelectPage(page, Boolean(opts?.fast));
      await chubbOpenMatSelect(page, selectLocator, {
        allowDisabled: opts?.allowDisabled,
        fast: opts?.fast,
      });

      const options = await chubbWaitForOverlayOptions(
        page,
        await selectLocator.getAttribute("id"),
        overlayWaitMs
      );
      let resolvedOptions = options;
      if ((await resolvedOptions.count()) < 1) {
        resolvedOptions = await chubbOverlayOptionsForSelect(page, selectLocator);
      }
      const count = await resolvedOptions.count();
      if (count < 1) {
        throw new Error("CHUBB mat-select opened but no options appeared in the overlay.");
      }

      const target = await chubbResolveMatOption(page, resolvedOptions, opts?.optionText);
      await chubbClickMatOptionRobust(page, target, selectLocator);
      await chubbWaitForMatSelectClosed(selectLocator, opts?.fast ? 4_000 : 8_000);
      await chubbWaitForMatSelectValueMatch(
        selectLocator,
        opts?.optionText,
        valueMatchMs,
        Boolean(opts?.pickFirst && !opts?.optionText)
      );
      await chubbCloseMatSelectIfOpen(page, selectLocator);
      await chubbFinishMatSelectPage(page, Boolean(opts?.fast));
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await chubbCloseMatSelectIfOpen(page, selectLocator).catch(() => undefined);
      if (!opts?.fast) {
        await chubbStripHeaderResourcesMenuOverlay(page).catch(() => undefined);
      }
      await page.waitForTimeout(retryMs);
    }
  }

  throw lastError ?? new Error(`CHUBB mat-select failed after ${maxAttempts} attempts.`);
}

export async function chubbSelectRandomMatOption(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>
): Promise<void> {
  if (await chubbMatSelectHasValue(selectLocator)) return;
  await chubbSelectMatSelectOption(page, selectLocator, { pickFirst: true });
}

export async function chubbSelectMatOptionByText(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>,
  optionText: string,
  opts?: { force?: boolean; allowDisabled?: boolean; fast?: boolean }
): Promise<void> {
  if (!opts?.force && !(await chubbMatSelectIsEmpty(selectLocator))) {
    const current = (await chubbMatSelectDisplayValue(selectLocator)).trim();
    if (new RegExp(optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(current)) {
      return;
    }
  }

  await chubbSelectMatSelectOption(page, selectLocator, {
    optionText,
    allowDisabled: opts?.allowDisabled,
    fast: opts?.fast,
  });
}

export async function chubbSelectFirstMatOption(
  page: Page,
  selectLocator: ReturnType<Page["locator"]>,
  opts?: { force?: boolean; allowDisabled?: boolean }
): Promise<void> {
  if (!opts?.force && (await chubbMatSelectHasValue(selectLocator))) return;
  await chubbSelectMatSelectOption(page, selectLocator, {
    pickFirst: true,
    allowDisabled: opts?.allowDisabled,
  });
}

export async function chubbIsMatSelectInteractive(
  selectLocator: ReturnType<Page["locator"]>
): Promise<boolean> {
  return selectLocator
    .evaluate((el) => {
      if (el.getAttribute("aria-disabled") === "true") return false;
      if (el.classList.contains("mat-mdc-select-disabled")) return false;
      const field = el.closest("mat-form-field");
      if (field?.classList.contains("mat-form-field-disabled")) return false;
      return true;
    })
    .catch(() => false);
}
