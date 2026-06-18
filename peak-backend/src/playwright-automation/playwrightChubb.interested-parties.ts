import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import {
  chubbPunchThroughResidenceOverlay,
  chubbWaitForDynamicViewReady,
  chubbWaitForPostInterestedPartiesScreen,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";

async function chubbWaitForInterestedPartiesPage(
  page: Page,
  timeoutMs: number
): Promise<ReturnType<Page["locator"]>> {
  const root = page
    .locator(".bdd-interested-parties, #dynamic-view.bdd-interested-parties")
    .first();
  await root.waitFor({ state: "visible", timeout: timeoutMs });
  await root
    .locator("h2")
    .filter({ hasText: /Interested Parties for the Policy/i })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  return root;
}

/**
 * Interested parties: optional add — skip → Continue.
 */
export async function runChubbInterestedParties(
  page: Page,
  _payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  updateStep("chubb_wait_interested_parties");
  await chubbWaitForDynamicViewReady(page, Math.max(timeoutMs, 60_000));
  await chubbWaitIfSavingQuote(page, 30_000);

  await chubbWaitForInterestedPartiesPage(page, 90_000);
  await chubbPunchThroughResidenceOverlay(page);

  updateStep("chubb_interested_parties_continue");
  await chubbScrollFooterContinueIntoView(page);
  await chubbClickFooterContinue(page, timeoutMs);

  updateStep("chubb_interested_parties_next_form_ready");
  await chubbWaitForPostInterestedPartiesScreen(page, 90_000);
}
