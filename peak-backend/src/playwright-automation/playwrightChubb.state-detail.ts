import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import { chubbSelectMatOptionByText, chubbMatSelectDisplayValue } from "./playwrightChubb.mat-select";
import {
  chubbPunchThroughResidenceOverlay,
  chubbWaitForDynamicViewReady,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";
import { chubbPayloadOptionalString } from "./playwrightChubb.payload";

const CHUBB_WIND_HAIL_PERCENTAGE_OPTIONS = ["0.2%", "0.5%", "1%", "2%", "3%", "5%", "10%"] as const;
const CHUBB_ALL_WIND_OR_HAIL = /all\s*wind\s*or\s*hail/i;

function chubbNormalizeWindHailPercentage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withPercent = trimmed.endsWith("%") ? trimmed.replace(/\s+/g, "") : null;
  if (withPercent) {
    const match = CHUBB_WIND_HAIL_PERCENTAGE_OPTIONS.find((o) => o.toLowerCase() === withPercent.toLowerCase());
    if (match) return match;
  }

  const numeric = Number.parseFloat(trimmed.replace(/%/g, "").trim());
  if (!Number.isFinite(numeric)) return null;

  const byNumber: Record<string, string> = {
    "0.2": "0.2%",
    "0.5": "0.5%",
    "1": "1%",
    "2": "2%",
    "3": "3%",
    "5": "5%",
    "10": "10%",
  };
  return byNumber[String(numeric)] ?? null;
}

function chubbWindHailPercentageSelect(root: ReturnType<Page["locator"]>): ReturnType<Page["locator"]> {
  return root
    .locator(
      "mat-select.wind-hail-deductible-percentage, mat-select.hurricane-or-wind-hail-deductible-percent"
    )
    .first();
}

async function chubbIsWindHailPercentageVisible(root: ReturnType<Page["locator"]>): Promise<boolean> {
  const select = chubbWindHailPercentageSelect(root);
  if ((await select.count()) < 1) return false;
  return select.isVisible().catch(() => false);
}

async function chubbWaitForWindHailPercentageVisible(
  page: Page,
  root: ReturnType<Page["locator"]>,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await chubbIsWindHailPercentageVisible(root)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

function chubbDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function chubbRoofYearFromAgeOrYear(raw: string): string | null {
  const digits = chubbDigitsOnly(raw);
  if (digits.length === 4) return digits;
  const age = Number.parseInt(digits, 10);
  if (!Number.isFinite(age) || age <= 0 || age > 120) return null;
  const year = new Date().getFullYear() - age;
  if (year < 1900 || year > new Date().getFullYear() + 1) return null;
  return String(year);
}

async function chubbFillTextInput(page: Page, locator: ReturnType<Page["locator"]>, value: string): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.click({ force: true, timeout: 10_000 }).catch(() => undefined);
  await locator.press("Control+A").catch(() => undefined);
  await locator.press("Backspace").catch(() => undefined);
  await locator.pressSequentially(value, { delay: 25 }).catch(() => undefined);
  await locator.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
  await page.waitForTimeout(120);
}

async function chubbIsMatSelectEnabled(select: ReturnType<Page["locator"]>): Promise<boolean> {
  const ariaDisabled = await select.getAttribute("aria-disabled").catch(() => "false");
  if (ariaDisabled === "true") return false;
  const tabIndex = await select.getAttribute("tabindex").catch(() => "0");
  if (tabIndex === "-1") return false;
  return true;
}

async function chubbCanInteractWithStateDetail(page: Page, root: ReturnType<Page["locator"]>): Promise<boolean> {
  const targets = [
    root.locator("mat-select.roof-shape .mat-mdc-select-trigger").first(),
    root.locator("mat-select.wind-protection .mat-mdc-select-trigger").first(),
    root.locator("input.roof-year[name='RoofYear'], input[name='RoofYear']").first(),
    root.locator("app-page-footer button.continue-button").first(),
  ];

  for (const t of targets) {
    if ((await t.count()) === 0) continue;
    if (!(await t.isVisible().catch(() => false))) continue;
    const ok = await t.click({ trial: true, timeout: 2_500 }).then(() => true).catch(() => false);
    if (ok) return true;
  }

  return false;
}

async function chubbWaitForStateDetailInteractive(page: Page, root: ReturnType<Page["locator"]>, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await chubbWaitIfSavingQuote(page, 10_000);
    await chubbPunchThroughResidenceOverlay(page);
    if (await chubbCanInteractWithStateDetail(page, root)) return;
    await page.waitForTimeout(250);
  }

  throw new Error(`CHUBB state-detail page remained non-interactive (URL: ${page.url()}).`);
}

export async function runChubbStateDetail(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  updateStep("chubb_wait_state_detail");
  await chubbWaitForDynamicViewReady(page, Math.max(timeoutMs, 90_000));
  await chubbWaitIfSavingQuote(page, 90_000);

  const root = page.locator(".bdd-state-detail-0").first();
  await root.waitFor({ state: "visible", timeout: 90_000 });
  await chubbWaitForStateDetailInteractive(page, root, 90_000);

  updateStep("chubb_state_detail_fill_fields");

  const roofShape = chubbPayloadOptionalString(payload, ["homeownersInformations.roofShape", "roofShape"]);
  if (roofShape) {
    const roofShapeSelect = root.locator("mat-select.roof-shape").first();
    if ((await roofShapeSelect.count()) > 0 && (await chubbIsMatSelectEnabled(roofShapeSelect))) {
      await chubbSelectMatOptionByText(page, roofShapeSelect, roofShape, { force: true });
    }
  }

  const roofCoveringType = chubbPayloadOptionalString(payload, ["chubbHomeCoverageEstimator.roofCoveringType"]);
  if (roofCoveringType) {
    const roofTypeSelect = root
      .locator("mat-select.roof-covering-type, mat-select.roof-type, mat-select.roof-covering-type")
      .first();
    if ((await roofTypeSelect.count()) > 0 && (await chubbIsMatSelectEnabled(roofTypeSelect))) {
      await chubbSelectMatOptionByText(page, roofTypeSelect, roofCoveringType, { force: true });
    }
  }

  const windProtection = chubbPayloadOptionalString(payload, ["chubbHomeCoverageEstimator.windProtection"]);
  if (windProtection) {
    const windProtectionSelect = root.locator("mat-select.wind-protection").first();
    if ((await windProtectionSelect.count()) > 0 && (await chubbIsMatSelectEnabled(windProtectionSelect))) {
      await chubbSelectMatOptionByText(page, windProtectionSelect, windProtection, { force: true });
    }
  }

  const windHailType = chubbPayloadOptionalString(payload, [
    "chubbHomeCoverageEstimator.hurricaneOrWindHailDeductibleType",
    "hurricaneOrWindHailDeductibleType",
  ]);
  const windHailSelect = root
    .locator("mat-select.hurricane-or-wind-hail-deductible-type, mat-select.wind-hail-deductible-type")
    .first();
  if (windHailType) {
    if ((await windHailSelect.count()) > 0 && (await chubbIsMatSelectEnabled(windHailSelect))) {
      await chubbSelectMatOptionByText(page, windHailSelect, windHailType, { force: true });
    }
  }

  const effectiveWindHailType =
    windHailType ??
    ((await windHailSelect.count()) > 0 ? (await chubbMatSelectDisplayValue(windHailSelect)).trim() : "");

  if (CHUBB_ALL_WIND_OR_HAIL.test(effectiveWindHailType)) {
    await chubbWaitIfSavingQuote(page, 5_000);
    const percentageVisible = await chubbWaitForWindHailPercentageVisible(page, root, 12_000);
    if (percentageVisible) {
      const windHailPercentage = chubbPayloadOptionalString(payload, [
        "chubbHomeCoverageEstimator.hurricaneOrWindHailDeductiblePercentage",
        "hurricaneOrWindHailDeductiblePercentage",
      ]);
      if (windHailPercentage) {
        const normalized = chubbNormalizeWindHailPercentage(windHailPercentage);
        if (!normalized) {
          throw new Error(
            `CHUBB invalid hurricaneOrWindHailDeductiblePercentage "${windHailPercentage}". Expected one of: ${CHUBB_WIND_HAIL_PERCENTAGE_OPTIONS.join(", ")}.`
          );
        }
        const percentageSelect = chubbWindHailPercentageSelect(root);
        if ((await percentageSelect.count()) > 0 && (await chubbIsMatSelectEnabled(percentageSelect))) {
          await chubbSelectMatOptionByText(page, percentageSelect, normalized, { force: true });
        }
      }
    }
  }

  const roofAgeOrYear = chubbPayloadOptionalString(payload, ["property.roofAge", "roofAge"]);
  if (roofAgeOrYear) {
    const roofYear = chubbRoofYearFromAgeOrYear(roofAgeOrYear);
    if (roofYear) {
      const roofYearInput = root.locator("input.roof-year[name='RoofYear'], input[name='RoofYear']").first();
      if ((await roofYearInput.count()) > 0 && (await roofYearInput.isVisible().catch(() => false))) {
        await chubbFillTextInput(page, roofYearInput, roofYear);
      }
    }
  }

  await chubbWaitIfSavingQuote(page, 15_000);

  updateStep("chubb_state_detail_continue");
  await chubbScrollFooterContinueIntoView(page);
  await chubbClickFooterContinue(page, timeoutMs);

  updateStep("chubb_state_detail_next_form_ready");
  await chubbWaitForDynamicViewReady(page, 90_000);
}

