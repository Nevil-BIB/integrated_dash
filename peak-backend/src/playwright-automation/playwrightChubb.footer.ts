import type { Page } from "playwright";

/** Scroll page + inner containers so the sticky footer Continue is reachable (no button locator required). */
export async function chubbScrollFooterContinueIntoView(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scrollTargets = [
      document.querySelector("#dynamic-view"),
      document.querySelector(".dynamic-container"),
      document.querySelector(".page-content"),
      document.querySelector("main"),
      document.documentElement,
      document.body,
    ];
    for (const el of scrollTargets) {
      if (el instanceof HTMLElement) {
        el.scrollTop = el.scrollHeight;
      }
    }
    const footer = document.querySelector("app-page-footer, .page-footer");
    if (footer instanceof HTMLElement) {
      footer.scrollIntoView({ block: "end", inline: "nearest", behavior: "instant" });
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  });

  await page.locator("app-page-footer, .page-footer").first().scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(200);
}

function chubbFooterContinueLocators(page: Page): ReturnType<Page["locator"]>[] {
  return [
    page
      .locator("app-page-footer")
      .locator(
        "button.bdd-continue.continue-button, button.continue-button.button-submit.bdd-continue, button.continue-button.button-submit"
      )
      .filter({ hasText: /^Continue$/i }),
    page.locator("app-page-footer").getByRole("button", { name: /^Continue$/i }),
    page.locator(".page-footer").getByRole("button", { name: /^Continue$/i }),
    page
      .locator(
        "app-page-footer button.bdd-continue, app-page-footer button.continue-button, app-page-footer button.button-submit"
      )
      .filter({ hasText: /^Continue$/i }),
  ];
}

async function chubbResolveVisibleFooterContinue(
  page: Page,
  timeoutMs: number
): Promise<ReturnType<Page["locator"]> | null> {
  const start = Date.now();
  let passes = 0;
  const maxPasses = Math.max(8, Math.ceil(timeoutMs / 400));

  while (Date.now() - start < timeoutMs && passes < maxPasses) {
    passes += 1;

    for (const locator of chubbFooterContinueLocators(page)) {
      const candidate = locator.first();
      const count = await candidate.count().catch(() => 0);
      if (count < 1) continue;

      const visible = await candidate.isVisible().catch(() => false);
      const hidden = await candidate.getAttribute("hidden").catch(() => null);
      if (visible && hidden !== "") return candidate;
    }

    if (passes === 1 || passes === maxPasses) {
      await chubbScrollFooterContinueIntoView(page);
    }

    await page.waitForTimeout(200);
  }

  return null;
}

/** Visible mat-error / validation messages inside a form root (for Continue failures). */
export async function chubbCollectFormValidationErrors(
  page: Page,
  rootSelector: string
): Promise<string[]> {
  return page
    .locator(`${rootSelector} mat-error, ${rootSelector} .mat-mdc-form-field-error`)
    .evaluateAll((nodes) =>
      nodes
        .map((n) => (n.textContent ?? "").trim())
        .filter((t) => t.length > 0)
    )
    .catch(() => []);
}

/** Wait until footer Continue is visible and not disabled. */
export async function chubbWaitForFooterContinueEnabled(
  page: Page,
  timeoutMs: number
): Promise<ReturnType<Page["locator"]>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const continueBtn = await chubbResolveVisibleFooterContinue(page, 2_000);
    if (continueBtn) {
      const enabled = await continueBtn
        .evaluate((el) => {
          const btn = el as HTMLButtonElement;
          if (btn.disabled) return false;
          if (btn.getAttribute("aria-disabled") === "true") return false;
          if (btn.classList.contains("mat-mdc-button-disabled")) return false;
          const field = btn.closest("mat-form-field, .mat-mdc-form-field");
          if (field?.classList.contains("mat-form-field-disabled")) return false;
          return true;
        })
        .catch(() => false);

      if (enabled) return continueBtn;
    }

    await chubbScrollFooterContinueIntoView(page);
    await page.waitForTimeout(300);
  }

  throw new Error(
    `CHUBB footer Continue stayed disabled or hidden (URL: ${page.url()}). Check required fields.`
  );
}

async function chubbIsInViewport(locator: ReturnType<Page["locator"]>): Promise<boolean> {
  return locator
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return rect.top >= 0 && rect.bottom <= vh + 2;
    })
    .catch(() => false);
}

/** Scroll footer Continue into view and click (Masterpiece EZ Quote pages). */
export async function chubbClickFooterContinue(page: Page, timeoutMs: number): Promise<void> {
  const findMs = Math.min(timeoutMs, 45_000);
  let continueBtn = await chubbResolveVisibleFooterContinue(page, findMs);

  if (!continueBtn) {
    await chubbScrollFooterContinueIntoView(page);
    for (const locator of chubbFooterContinueLocators(page)) {
      const candidate = locator.first();
      if ((await candidate.count()) > 0) {
        continueBtn = candidate;
        break;
      }
    }
  }

  if (!continueBtn || (await continueBtn.count()) < 1) {
    throw new Error(
      `CHUBB Continue button not found in footer (URL: ${page.url()}). Scroll the form or verify required fields.`
    );
  }

  const enabled = await continueBtn
    .evaluate((el) => {
      const btn = el as HTMLButtonElement;
      return !btn.disabled && btn.getAttribute("aria-disabled") !== "true";
    })
    .catch(() => true);

  if (!enabled) {
    throw new Error(`CHUBB footer Continue is disabled (URL: ${page.url()}).`);
  }

  await chubbScrollFooterContinueIntoView(page);

  const clickDeadline = Date.now() + 8_000;
  while (Date.now() < clickDeadline) {
    const visible = await continueBtn.isVisible().catch(() => false);
    const inView = await chubbIsInViewport(continueBtn);
    if (visible && inView) break;
    await page.waitForTimeout(150);
  }

  const clicked = await continueBtn
    .click({ timeout: 15_000, force: true, delay: 40 })
    .then(() => true)
    .catch(() => false);

  if (!clicked) {
    const box = await continueBtn.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await continueBtn.evaluate((el: HTMLButtonElement) => {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        el.click();
      });
    }
  }

  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(300);
}
