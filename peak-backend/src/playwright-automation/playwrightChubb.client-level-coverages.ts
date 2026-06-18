import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import {
  chubbPunchThroughResidenceOverlay,
  chubbWaitForDynamicViewReady,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";

async function chubbWaitForClientLevelCoveragesPage(
  page: Page,
  timeoutMs: number
): Promise<ReturnType<Page["locator"]>> {
  const root = page
    .locator(".bdd-client-level-coverages, #dynamic-view.bdd-client-level-coverages")
    .first();
  await root.waitFor({ state: "visible", timeout: timeoutMs });
  await root
    .locator("h2")
    .filter({ hasText: /additional coverages for this client/i })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  return root;
}

/**
 * Client level coverages: optional big-button selections — skip all → Continue.
 */
export async function runChubbClientLevelCoverages(
  page: Page,
  _payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  updateStep("chubb_wait_client_level_coverages");
  await chubbWaitForDynamicViewReady(page, Math.max(timeoutMs, 60_000));
  await chubbWaitIfSavingQuote(page, 30_000);

  await chubbWaitForClientLevelCoveragesPage(page, 90_000);
  await chubbPunchThroughResidenceOverlay(page);

  updateStep("chubb_client_level_coverages_continue");
  await chubbScrollFooterContinueIntoView(page);
  await chubbClickFooterContinue(page, timeoutMs);

  updateStep("chubb_client_level_coverages_next_form_ready");
  await chubbWaitForDynamicViewReady(page, 90_000);
}
