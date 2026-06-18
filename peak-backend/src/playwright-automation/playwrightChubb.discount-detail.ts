import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import { chubbSelectMatOptionByText } from "./playwrightChubb.mat-select";
import { chubbPunchThroughResidenceOverlay, chubbWaitForDynamicViewReady, chubbWaitIfSavingQuote } from "./playwrightChubb.page-guard";
import { chubbPayloadOptionalString, chubbPayloadTruthy } from "./playwrightChubb.payload";

async function chubbIsMatSelectEnabled(select: ReturnType<Page["locator"]>): Promise<boolean> {
  const ariaDisabled = await select.getAttribute("aria-disabled").catch(() => "false");
  if (ariaDisabled === "true") return false;
  const tabIndex = await select.getAttribute("tabindex").catch(() => "0");
  if (tabIndex === "-1") return false;
  return true;
}

async function chubbSetCheckboxValue(
  checkbox: ReturnType<Page["locator"]>,
  checked: boolean
): Promise<void> {
  await checkbox.waitFor({ state: "visible", timeout: 20_000 });
  const input = checkbox.locator("input[type='checkbox']").first();
  const current = await input.isChecked().catch(() => false);
  if (current === checked) return;
  await checkbox.click({ force: true, timeout: 8_000 });
}

export async function runChubbDiscountDetail(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  updateStep("chubb_wait_discount_detail");
  await chubbWaitForDynamicViewReady(page, Math.max(timeoutMs, 60_000));
  await chubbWaitIfSavingQuote(page, 30_000);

  const root = page.locator(".bdd-discount-detail-0").first();
  await root.waitFor({ state: "visible", timeout: 90_000 });

  await chubbPunchThroughResidenceOverlay(page);
  updateStep("chubb_fill_discount_detail");

  const distanceFromFireStation = chubbPayloadOptionalString(payload, [
    "chubbHomeCoverageEstimator.distanceFromFireStation",
  ]);
  if (distanceFromFireStation) {
    const select = root.locator("mat-select.distance-from-fire-station").first();
    if ((await select.count()) > 0 && (await chubbIsMatSelectEnabled(select))) {
      await chubbSelectMatOptionByText(page, select, distanceFromFireStation, { force: true });
    }
  }

  const waterLeakProtection = chubbPayloadOptionalString(payload, ["chubbHomeCoverageEstimator.waterLeakProtection"]);
  if (waterLeakProtection) {
    const select = root.locator("mat-select.water-leak-protection, mat-select.water-leak-detection-system-code").first();
    if ((await select.count()) > 0 && (await chubbIsMatSelectEnabled(select))) {
      await chubbSelectMatOptionByText(page, select, waterLeakProtection, { force: true });
    }
  }

  const boolFields: Array<{ key: string; selector: string }> = [
    { key: "chubbHomeCoverageEstimator.alarmBurglar", selector: "mat-checkbox.burglar-alarm" },
    { key: "chubbHomeCoverageEstimator.alarmFire", selector: "mat-checkbox.fire-alarm" },
    { key: "chubbHomeCoverageEstimator.securityGatedCommunity", selector: "mat-checkbox.gated-community" },
    {
      key: "chubbHomeCoverageEstimator.security24HourGuardMonitoring",
      selector: "mat-checkbox.twenty-four-hour-security",
    },
    { key: "chubbHomeCoverageEstimator.securityGatedHouse", selector: "mat-checkbox.gated-house" },
    { key: "chubbHomeCoverageEstimator.securityFullTimeCaretaker", selector: "mat-checkbox.full-time-caretaker" },
    { key: "chubbHomeCoverageEstimator.detectorGasLeakage", selector: "mat-checkbox.gas-leakage-detector" },
    { key: "chubbHomeCoverageEstimator.detectorLightningProtection", selector: "mat-checkbox.lightning-protection" },
    { key: "chubbHomeCoverageEstimator.detectorBackupGenerator", selector: "mat-checkbox.back-up-generator" },
    { key: "chubbHomeCoverageEstimator.detectorSeismicShutOffValve", selector: "mat-checkbox.seismic-shut-off-valve" },
    { key: "chubbHomeCoverageEstimator.sprinklerResidentialSystem", selector: "mat-checkbox.residential-sprinkler-system" },
  ];

  for (const item of boolFields) {
    const raw = chubbPayloadOptionalString(payload, [item.key]);
    const value = chubbPayloadTruthy(raw);
    if (value === undefined) continue;

    const checkbox = root.locator(item.selector).first();
    if ((await checkbox.count()) === 0) continue;
    const disabled = await checkbox.getAttribute("aria-disabled").catch(() => "false");
    if (disabled === "true") continue;
    await chubbSetCheckboxValue(checkbox, value);
  }

  await chubbWaitIfSavingQuote(page, 20_000);
  updateStep("chubb_discount_detail_continue");
  await chubbScrollFooterContinueIntoView(page);
  await chubbClickFooterContinue(page, timeoutMs);

  updateStep("chubb_discount_detail_next_form_ready");
  await chubbWaitForDynamicViewReady(page, 90_000);
}

