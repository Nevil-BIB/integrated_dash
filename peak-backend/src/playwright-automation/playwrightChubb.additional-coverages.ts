import type { Page } from "playwright";
import { chubbClickFooterContinue, chubbScrollFooterContinueIntoView } from "./playwrightChubb.footer";
import {
  chubbPunchThroughResidenceOverlay,
  chubbWaitForDynamicViewReady,
  chubbWaitIfSavingQuote,
} from "./playwrightChubb.page-guard";

export async function runChubbAdditionalCoverages(
  page: Page,
  _payload: unknown,
  timeoutMs: number,
  updateStep: (s: string) => void
): Promise<void> {
  updateStep("chubb_wait_additional_coverages");
  await chubbWaitForDynamicViewReady(page, Math.max(timeoutMs, 60_000));
  await chubbWaitIfSavingQuote(page, 30_000);

  const root = page.locator(".bdd-additional-coverages-0").first();
  await root.waitFor({ state: "visible", timeout: 90_000 });

  await chubbPunchThroughResidenceOverlay(page);

  updateStep("chubb_additional_coverages_continue");
  await chubbScrollFooterContinueIntoView(page);
  await chubbClickFooterContinue(page, timeoutMs);

  updateStep("chubb_additional_coverages_next_form_ready");
  await chubbWaitForDynamicViewReady(page, 90_000);
}
