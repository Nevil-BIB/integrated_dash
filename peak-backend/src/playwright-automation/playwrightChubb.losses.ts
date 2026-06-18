import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import {
  chubbPunchThroughResidenceOverlay,
  chubbWaitForDynamicViewReady,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";
import { chubbPayloadFieldEntries, chubbPayloadOptionalString, chubbTrimmedString } from "./playwrightChubb.payload";

function chubbResolveHasHomeownersLossesPast7Years(payload: unknown): boolean {
  const explicit = chubbPayloadOptionalString(payload, [
    "hasHomeownersLossesPast7Years",
    "homeownersLossesPast7Years",
    "hasHomeownerLossesPast7Years",
  ]);
  if (explicit) {
    const normalized = explicit.trim().toLowerCase();
    if (["yes", "true", "y", "1"].includes(normalized)) return true;
    if (["no", "false", "n", "0", "none"].includes(normalized)) return false;
  }

  const losses5Years = chubbPayloadOptionalString(payload, [
    "insuranceDetails.numberOfLosses5Years",
    "numberOfLosses5Years",
  ]);
  if (losses5Years) {
    const normalized = losses5Years.trim().toLowerCase();
    if (normalized === "0" || normalized === "none" || normalized === "no") return false;
    return true;
  }

  for (const entry of chubbPayloadFieldEntries(payload)) {
    const key = String(entry?.key ?? "").trim();
    if (!/^claimsHistory\.claims\[\d+\]\./.test(key)) continue;
    const value = chubbTrimmedString(entry.value);
    if (value) return true;
  }

  return false;
}

async function chubbSelectHomeownersLossesRadio(
  root: ReturnType<Page["locator"]>,
  wantYes: boolean
): Promise<void> {
  const yesRadio = root.locator("mat-radio-button.has-homeowners-losses-yes").first();
  const noRadio = root.locator("mat-radio-button.has-homeowners-losses-no").first();
  const target = wantYes ? yesRadio : noRadio;

  await target.waitFor({ state: "visible", timeout: 30_000 });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);

  const nativeInput = target.locator("input[type='radio']").first();
  const alreadyChecked = await nativeInput.isChecked().catch(() => false);
  if (alreadyChecked) return;

  await target.click({ force: true, timeout: 10_000 }).catch(async () => {
    await nativeInput.check({ force: true });
  });
}

async function chubbWaitForLossesPage(page: Page, timeoutMs: number): Promise<ReturnType<Page["locator"]>> {
  const root = page.locator(".bdd-losses, #dynamic-view.bdd-losses").first();
  await root.waitFor({ state: "visible", timeout: timeoutMs });
  await root
    .locator("h2")
    .filter({ hasText: /homeowner losses/i })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  await root.locator("mat-radio-group.has-homeowners-losses").first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  return root;
}

/**
 * Losses: "Has the client had any homeowner losses in the past 7 years?" → Yes/No → Continue.
 */
export async function runChubbLosses(
  page: Page,
  payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  updateStep("chubb_wait_losses");
  await chubbWaitForDynamicViewReady(page, Math.max(timeoutMs, 60_000));
  await chubbWaitIfSavingQuote(page, 30_000);

  const root = await chubbWaitForLossesPage(page, 90_000);
  await chubbPunchThroughResidenceOverlay(page);

  const wantYes = chubbResolveHasHomeownersLossesPast7Years(payload);
  updateStep(wantYes ? "chubb_losses_select_yes" : "chubb_losses_select_no");
  await chubbSelectHomeownersLossesRadio(root, wantYes);

  await chubbWaitIfSavingQuote(page, 15_000);

  updateStep("chubb_losses_continue");
  await chubbScrollFooterContinueIntoView(page);
  await chubbClickFooterContinue(page, timeoutMs);

  updateStep("chubb_losses_next_form_ready");
  await chubbWaitForDynamicViewReady(page, 90_000);
}
