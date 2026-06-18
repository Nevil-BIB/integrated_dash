import type { Page } from "playwright";

/** Wait for CHUBB "Saving your quote" spinner to disappear. */
export async function chubbWaitIfSavingQuote(
  page: Page,
  maxMs = 45_000,
  postMs = 400
): Promise<void> {
  const saving = page.getByText(/saving your quote/i).first();
  const visible = await saving.isVisible().catch(() => false);
  if (!visible) return;

  await saving.waitFor({ state: "hidden", timeout: maxMs }).catch(() => undefined);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  if (postMs > 0) {
    await page.waitForTimeout(postMs);
  }
}

/** `#header-container` → Resources nav trigger (`mat-mdc-menu-trigger`). */
export function chubbHeaderResourcesTrigger(page: Page): ReturnType<Page["locator"]> {
  return page
    .locator("#header-container .mat-mdc-menu-trigger.header-label")
    .filter({ has: page.locator(".header-label-text", { hasText: /^Resources$/i }) })
    .first();
}

/** Header Resources mat-menu panel (Agency ClaimView, Marketing Center, Home Coverage Estimator link, …). */
export function chubbHeaderResourcesMenu(page: Page): ReturnType<Page["locator"]> {
  return page
    .locator(
      ".cdk-overlay-pane .mat-mdc-menu-content:has(.resources-menu-left):has(.resources-menu-right), .mat-mdc-menu-panel:has(.resources-menu-left)"
    )
    .first();
}

export async function chubbIsHeaderResourcesTriggerExpanded(page: Page): Promise<boolean> {
  const trigger = chubbHeaderResourcesTrigger(page);
  if ((await trigger.count()) === 0) return false;
  return (await trigger.getAttribute("aria-expanded").catch(() => "false")) === "true";
}

export async function chubbIsHeaderResourcesMenuPanelVisible(page: Page): Promise<boolean> {
  return page.locator(".resources-menu-left").first().isVisible().catch(() => false);
}

export async function chubbIsHeaderResourcesMenuOpen(page: Page): Promise<boolean> {
  return chubbIsHeaderResourcesMenuPanelVisible(page);
}

/** Remove Resources mat-menu overlay from the DOM (never clicks the Resources header trigger). */
export async function chubbStripHeaderResourcesMenuOverlay(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  await page.evaluate(() => {
    document.querySelectorAll(".cdk-overlay-pane").forEach((pane) => {
      if (pane.querySelector(".resources-menu-left, .resources-menu-right")) {
        pane.remove();
      }
    });

    document.querySelectorAll(".mat-mdc-menu-panel").forEach((panel) => {
      if (panel.querySelector(".resources-menu-left, .resources-menu-right")) {
        panel.remove();
      }
    });

    document.querySelectorAll(".cdk-overlay-backdrop").forEach((el) => {
      (el as HTMLElement).style.pointerEvents = "none";
      el.remove();
    });

    document.querySelectorAll("#header-container .mat-mdc-menu-trigger").forEach((trigger) => {
      const label = trigger.querySelector(".header-label-text");
      if (!label || !/^Resources$/i.test(label.textContent?.trim() ?? "")) return;
      trigger.setAttribute("aria-expanded", "false");
      trigger.classList.remove("mat-mdc-menu-trigger-active");
      (trigger as HTMLElement).blur();
    });

    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.focus();
  });

  await page.waitForTimeout(120);
}

/** Block accidental opens of the Resources header menu during residence form automation. */
export async function chubbLockHeaderResourcesMenu(page: Page, locked: boolean): Promise<void> {
  await page.evaluate((isLocked) => {
    document.querySelectorAll("#header-container .mat-mdc-menu-trigger").forEach((trigger) => {
      const label = trigger.querySelector(".header-label-text");
      if (!label || !/^Resources$/i.test(label.textContent?.trim() ?? "")) return;
      const el = trigger as HTMLElement;
      if (isLocked) {
        el.dataset.chubbResourcesLocked = "true";
        el.style.pointerEvents = "none";
      } else {
        delete el.dataset.chubbResourcesLocked;
        el.style.pointerEvents = "";
      }
    });
  }, locked);
}

/**
 * Click neutral content area (never workflow nav items) to dismiss overlays.
 */
export async function chubbClickOutsideHeaderMenu(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  const neutralCandidates = [
    page.locator("#dynamic-view .page-content h2").first(),
    page.locator("#dynamic-view .page-content").first(),
    page.locator(".bdd-residence-info-0 #property-section").first(),
    page.locator(".bdd-state-detail-0 #state-detail-section").first(),
    page.locator("app-page-context .page-context").first(),
  ];

  for (const area of neutralCandidates) {
    if ((await area.count()) === 0) continue;
    if (!(await area.isVisible().catch(() => false))) continue;

    const box = await area.boundingBox().catch(() => null);
    if (!box || box.width < 4) continue;

    const x = box.x + Math.min(Math.max(24, box.width * 0.2), Math.max(28, box.width - 10));
    const y = Math.max(box.y + Math.min(36, box.height * 0.15), 96);
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
    if (!(await chubbIsHeaderResourcesMenuPanelVisible(page))) return;
  }

  const viewport = page.viewportSize();
  if (viewport) {
    await page.mouse.click(Math.max(120, viewport.width * 0.32), Math.min(300, viewport.height * 0.32));
    await page.waitForTimeout(200);
  }
}

/**
 * Click a safe area on the current form to close stray overlays (client-info, address, residence).
 */
export async function chubbClickPageToDismissOverlays(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  await chubbClickOutsideHeaderMenu(page);
  if (!(await chubbIsHeaderResourcesMenuPanelVisible(page))) return;

  const targets = [
    ".bdd-client-info h2",
    ".bdd-client-info input.primary-insured-first-name",
    ".bdd-address-0 input.street",
    ".bdd-residence-info-0 #risk-section input.year-built",
    ".bdd-residence-info-0 #property-section h2",
    "main .page-content h2",
  ];

  for (const selector of targets) {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) continue;
    if (!(await el.isVisible().catch(() => false))) continue;

    const box = await el.boundingBox().catch(() => null);
    if (!box || box.width < 8 || box.height < 8) continue;

    const x = box.x + Math.min(16, box.width * 0.08);
    const y = Math.max(box.y + Math.min(20, box.height * 0.1), 96);
    await page.mouse.click(x, y);
    await page.waitForTimeout(220);

    if (!(await chubbIsHeaderResourcesMenuPanelVisible(page))) return;
  }

  await chubbClickFooterToDismissOverlays(page);
}

/**
 * Click the left edge of the residence form (Resources menu covers center-right).
 */
export async function chubbClickResidencePageToCloseOverlays(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  const onClientInfo = await page.locator(".bdd-client-info").first().isVisible().catch(() => false);
  const onAddress = await page.locator(".bdd-address-0").first().isVisible().catch(() => false);
  if (onClientInfo || onAddress) {
    await chubbClickPageToDismissOverlays(page);
    return;
  }

  await chubbClickOutsideHeaderMenu(page);
  if (!(await chubbIsHeaderResourcesMenuPanelVisible(page))) return;

  const targets = [
    ".bdd-residence-info-0 #risk-section input.year-built",
    ".bdd-residence-info-0 #property-section h2",
    ".bdd-residence-info-0 #contents-section h2",
    ".bdd-residence-info-0 #property-section",
  ];

  for (const selector of targets) {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) continue;
    if (!(await el.isVisible().catch(() => false))) continue;

    const box = await el.boundingBox().catch(() => null);
    if (!box || box.width < 8 || box.height < 8) continue;

    const x = box.x + Math.min(16, box.width * 0.08);
    const y = Math.max(box.y + Math.min(20, box.height * 0.1), 96);
    await page.mouse.click(x, y);
    await page.waitForTimeout(220);

    if (!(await chubbIsHeaderResourcesMenuPanelVisible(page))) return;
  }

  await chubbClickFooterToDismissOverlays(page);
}

/**
 * After HCE, a harmless mat-select open/close often restores form interactivity (manual workaround).
 */
export async function chubbNudgeResidenceFormWithDropdown(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  await chubbStripHeaderResourcesMenuOverlay(page);
  if (await chubbIsHeaderResourcesMenuPanelVisible(page)) return;

  const select = page.locator(".bdd-residence-info-0 mat-select.residence-deductible").first();
  if ((await select.count()) === 0) return;
  if (!(await select.isVisible().catch(() => false))) return;
  if (!(await select.isEnabled().catch(() => false))) return;

  const trigger = select.locator(".mat-mdc-select-trigger").first();
  const opened = await trigger.click({ timeout: 8_000 }).then(() => true).catch(() => false);
  if (!opened) return;

  await page.waitForTimeout(400);
  await chubbStripHeaderResourcesMenuOverlay(page);
  await chubbClickOutsideHeaderMenu(page);
  await page.waitForTimeout(250);
}

/** Click sticky footer (below the Resources overlay). */
async function chubbClickFooterToDismissOverlays(page: Page): Promise<void> {
  const footer = page.locator("app-page-footer .page-footer-content, app-page-footer .page-footer").first();
  if ((await footer.count()) > 0 && (await footer.isVisible().catch(() => false))) {
    const box = await footer.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + Math.min(180, box.width / 2), box.y + 12);
      await page.waitForTimeout(200);
      return;
    }
    await footer.click({ position: { x: 120, y: 8 }, force: true, timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(200);
  }
}

async function chubbClickMenuBackdrop(page: Page): Promise<void> {
  const backdrop = page.locator(".cdk-overlay-container .cdk-overlay-backdrop").last();
  if (await backdrop.isVisible().catch(() => false)) {
    await backdrop.click({ force: true, position: { x: 8, y: 8 }, timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(220);
  }
}

/**
 * Close the header Resources mat-menu. Never clicks the Resources trigger (toggle re-opens the menu).
 */
export async function chubbDismissHeaderResourcesMenu(page: Page): Promise<void> {
  if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;

  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;

    await chubbStripHeaderResourcesMenuOverlay(page);
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;

    await chubbClickOutsideHeaderMenu(page);
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;

    await chubbClickResidencePageToCloseOverlays(page);
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;

    await chubbClickMenuBackdrop(page);
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;

    await chubbClickFooterToDismissOverlays(page);
    if (!(await chubbIsHeaderResourcesMenuOpen(page))) return;

    await page.waitForTimeout(200);
  }

  await chubbStripHeaderResourcesMenuOverlay(page);
}

export async function chubbIsHomeCoverageEstimatorVisible(page: Page): Promise<boolean> {
  return page
    .locator("mat-dialog-container, .mat-mdc-dialog-container")
    .filter({ hasText: /Home Coverage Estimator/i })
    .first()
    .isVisible()
    .catch(() => false);
}

/** Remove stray CDK backdrops left after HCE closes (they block all clicks on the main form). */
export async function chubbClearCdkBackdropsWhenNoHceDialog(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  const backdrops = page.locator(".cdk-overlay-backdrop");
  const count = await backdrops.count();
  for (let i = count - 1; i >= 0; i -= 1) {
    const backdrop = backdrops.nth(i);
    if (!(await backdrop.isVisible().catch(() => false))) continue;
    await backdrop.click({ force: true, position: { x: 4, y: 4 }, timeout: 4_000 }).catch(() => undefined);
  }

  await chubbForceUnblockResidenceOverlays(page);
  await page.waitForTimeout(200);
}

/**
 * Aggressively remove invisible blockers after HCE. Safe to call before every mat-select.
 */
export async function chubbPunchThroughResidenceOverlay(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  await chubbStripHeaderResourcesMenuOverlay(page);

  const onResidence = await page
    .locator(".bdd-residence-info-0")
    .first()
    .isVisible()
    .catch(() => false);

  await page.evaluate((aggressivePaneRemoval) => {
    const isVisible = (el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0.01 &&
        el.offsetWidth > 1 &&
        el.offsetHeight > 1
      );
    };

    if (aggressivePaneRemoval) {
      document.querySelectorAll(".cdk-overlay-pane").forEach((pane) => {
        const node = pane as HTMLElement;
        if (node.querySelector(".resources-menu-left, .resources-menu-right")) {
          node.remove();
          return;
        }
        const dialog = node.querySelector("mat-dialog-container, .mat-mdc-dialog-container") as HTMLElement | null;
        if (dialog && isVisible(dialog)) return;
        if (node.querySelector(".mat-mdc-select-panel, [role='listbox']")) return;
        const openOptions = Array.from(node.querySelectorAll("mat-option")).some((o) =>
          isVisible(o as HTMLElement)
        );
        if (openOptions) return;
        node.remove();
      });
    }

    document.querySelectorAll(".cdk-overlay-backdrop").forEach((el) => el.remove());

    const container = document.querySelector(".cdk-overlay-container");
    if (container instanceof HTMLElement) {
      container.style.pointerEvents = "";
    }

    document.body.classList.remove("cdk-global-scrollblock");
    document.documentElement.classList.remove("cdk-global-scrollblock");
    document.body.style.overflow = "";
    document.body.style.pointerEvents = "";

    document
      .querySelectorAll(
        ".bdd-client-info, .bdd-address-0, .bdd-policy-information, .bdd-residence-info-0, #dynamic-view, .page-content, main"
      )
      .forEach((el) => {
        const node = el as HTMLElement;
        node.style.pointerEvents = "";
      });
  }, onResidence);
  await page.waitForTimeout(100);
}

/** Last resort: strip orphan CDK layers so the residence form receives clicks. */
export async function chubbForceUnblockResidenceOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    const isVisible = (el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0.01 &&
        el.offsetWidth > 1 &&
        el.offsetHeight > 1
      );
    };

    const hceStillVisible = Array.from(
      document.querySelectorAll("mat-dialog-container, .mat-mdc-dialog-container")
    ).some((el) => isVisible(el as HTMLElement) && /Home Coverage Estimator/i.test(el.textContent ?? ""));
    if (hceStillVisible) return;

    document.querySelectorAll(".cdk-overlay-pane").forEach((pane) => {
      const node = pane as HTMLElement;
      if (node.querySelector(".resources-menu-left, .resources-menu-right")) {
        node.remove();
        return;
      }

      const visibleOptions = Array.from(node.querySelectorAll('mat-option[role="option"]')).filter((opt) =>
        isVisible(opt as HTMLElement)
      );
      if (visibleOptions.length > 0) return;

      const dialog = node.querySelector("mat-dialog-container, .mat-mdc-dialog-container") as HTMLElement | null;
      if (dialog) {
        if (!isVisible(dialog)) node.remove();
        return;
      }

      const rect = node.getBoundingClientRect();
      const coversViewport =
        rect.width >= window.innerWidth * 0.85 && rect.height >= window.innerHeight * 0.85;
      const hasInteractive = node.querySelector(
        "mat-option, button:not([disabled]), input:not([disabled]), a, textarea, mat-dialog-container"
      );
      if (!hasInteractive || coversViewport) {
        node.remove();
      }
    });

    document.querySelectorAll(".cdk-overlay-backdrop").forEach((el) => {
      el.classList.remove("cdk-overlay-backdrop-showing");
      (el as HTMLElement).style.pointerEvents = "none";
      el.remove();
    });

    const overlayContainer = document.querySelector(".cdk-overlay-container");
    if (overlayContainer instanceof HTMLElement) {
      overlayContainer.style.pointerEvents = "";
    }

    document.querySelectorAll("#header-container .mat-mdc-menu-trigger").forEach((trigger) => {
      const label = trigger.querySelector(".header-label-text");
      if (!label || !/^Resources$/i.test(label.textContent?.trim() ?? "")) return;
      trigger.setAttribute("aria-expanded", "false");
    });

    document.body.classList.remove("cdk-global-scrollblock");
    document.documentElement.classList.remove("cdk-global-scrollblock");
    document.body.style.overflow = "";
    document.body.style.pointerEvents = "";

    document
      .querySelectorAll(".bdd-residence-info-0, #dynamic-view, .app-container, main, .page-content")
      .forEach((el) => {
        const node = el as HTMLElement;
        node.style.pointerEvents = "";
        node.style.userSelect = "";
      });
  });
}

async function chubbCountVisibleBackdrops(page: Page): Promise<number> {
  return page.locator(".cdk-overlay-backdrop").evaluateAll((nodes) => {
    return nodes.filter((node) => {
      const el = node as HTMLElement;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
    }).length;
  }).catch(() => 0);
}

/** True when a real click would reach a residence form control (Playwright trial click). */
export async function chubbCanInteractWithResidenceForm(page: Page): Promise<boolean> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return false;
  if (await chubbIsHeaderResourcesMenuPanelVisible(page)) return false;

  const targets = [
    page.locator(".bdd-residence-info-0 mat-select.residence-deductible .mat-mdc-select-trigger").first(),
    page.locator(".bdd-residence-info-0 input.contents-amount").first(),
    page.locator(".bdd-residence-info-0 mat-select.deductible-waiver-option .mat-mdc-select-trigger").first(),
    page.locator(".bdd-residence-info-0 mat-select.type-of-contents .mat-mdc-select-trigger").first(),
    page.locator(".bdd-residence-info-0 #risk-section input.year-built").first(),
  ];

  for (const target of targets) {
    if ((await target.count()) === 0) continue;
    if (!(await target.isVisible().catch(() => false))) continue;

    const ok = await target.click({ trial: true, timeout: 3_000 }).then(() => true).catch(() => false);
    if (ok) return true;
  }

  // Heuristic fallback: no blocking overlays and residence container is visible.
  const backdrops = await chubbCountVisibleBackdrops(page);
  const residenceRootVisible = await page
    .locator(".bdd-residence-info-0, #property-section")
    .first()
    .isVisible()
    .catch(() => false);
  if (backdrops === 0 && residenceRootVisible) return true;

  return false;
}

export async function chubbPrepareResidencePageForInteraction(page: Page): Promise<void> {
  if (!(await chubbIsHomeCoverageEstimatorVisible(page))) {
    await chubbStripHeaderResourcesMenuOverlay(page);
    await chubbClickOutsideHeaderMenu(page);
  }
  await chubbDismissHeaderResourcesMenu(page);
  if (!(await chubbIsHomeCoverageEstimatorVisible(page))) {
    await chubbClearCdkBackdropsWhenNoHceDialog(page);
  }
}

async function chubbDismissEstimatorRecalcBanner(page: Page): Promise<void> {
  const notice = page
    .locator(
      ".alert, .notification, .banner, .toast, .info-message, .message-container, [role='alert']"
    )
    .filter({ hasText: /Estimator Tool|recalculated/i })
    .first();

  if (!(await notice.isVisible().catch(() => false))) return;

  const closeBtn = notice
    .locator("button, a, .close, mat-icon, [aria-label*='close' i], [aria-label*='dismiss' i]")
    .first();
  if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible().catch(() => false))) {
    await closeBtn.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(200);
    return;
  }

  await notice.click({ position: { x: 12, y: 12 }, force: true, timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
}

/**
 * After HCE closes, invisible CDK overlays often block the form until a dropdown is used once.
 * Mirrors the manual workaround: clear overlays, then open/close a mat-select and click an input.
 */
export async function chubbWakeResidenceFormInteractivity(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  await chubbWaitIfSavingQuote(page, 30_000);
  await chubbLockHeaderResourcesMenu(page, false);

  const deadline = Date.now() + 6_000;
  while (Date.now() < deadline) {
    const onResidence = await page.locator(".bdd-residence-info-0").first().isVisible().catch(() => false);
    if (!onResidence) {
      // Not on residence form anymore; do not block flow with a hard failure.
      return;
    }

    await chubbPunchThroughResidenceOverlay(page);
    await chubbClickOutsideHeaderMenu(page);
    await chubbDismissEstimatorRecalcBanner(page);

    const deductible = page.locator(".bdd-residence-info-0 mat-select.residence-deductible").first();
    if ((await deductible.count()) > 0) {
      await chubbPunchThroughResidenceOverlay(page);
      const trigger = deductible.locator(".mat-mdc-select-trigger").first();
      await trigger.click({ force: true, timeout: 8_000 }).catch(() => undefined);
      await page.waitForTimeout(50);

      const panelId = await deductible.getAttribute("aria-controls").catch(() => null);
      const option = panelId
        ? page.locator(`#${panelId} mat-option`).first()
        : page.locator(".cdk-overlay-pane mat-option").first();
      if (await option.isVisible().catch(() => false)) {
        await option.click({ force: true, timeout: 5_000 }).catch(() => undefined);
      } else {
        await chubbClickOutsideHeaderMenu(page);
      }
      await page.waitForTimeout(50);
    }

    await chubbPunchThroughResidenceOverlay(page);

    if (await chubbCanInteractWithResidenceForm(page)) {
      return;
    }

    await page.waitForTimeout(50);
  }

  // Never hard-fail here; downstream field handlers are robust and should continue.
  await chubbPunchThroughResidenceOverlay(page);
}

/**
 * After HCE Calculate → Apply → Yes, CDK backdrops and Resources menu often block the residence form.
 */
export async function chubbRestoreResidencePageAfterHceClose(page: Page): Promise<void> {
  await chubbWaitIfSavingQuote(page, 90_000);

  const hceDialog = page
    .locator("mat-dialog-container, .mat-mdc-dialog-container")
    .filter({ hasText: /Home Coverage Estimator/i })
    .first();
  await hceDialog.waitFor({ state: "hidden", timeout: 90_000 }).catch(() => undefined);
  await page.waitForTimeout(800);

  await chubbPunchThroughResidenceOverlay(page);
  await chubbClickOutsideHeaderMenu(page);

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await chubbIsHomeCoverageEstimatorVisible(page)) {
      await page.waitForTimeout(500);
      continue;
    }
    await chubbPunchThroughResidenceOverlay(page);
    await page.waitForTimeout(300);
  }

  await chubbWakeResidenceFormInteractivity(page);
}

/** Run after Escape / overlay dismiss — Resources menu often opens instead of closing a dropdown. */
export async function chubbAfterKeyboardDismiss(page: Page): Promise<void> {
  await page.waitForTimeout(150);
  await chubbDismissHeaderResourcesMenu(page);
}

async function chubbClearStrayOverlays(page: Page): Promise<void> {
  if (await chubbIsHomeCoverageEstimatorVisible(page)) return;

  await chubbStripHeaderResourcesMenuOverlay(page);
  await chubbDismissHeaderResourcesMenu(page);
  await chubbClearCdkBackdropsWhenNoHceDialog(page);
}

async function chubbIsSpinnerVisible(page: Page): Promise<boolean> {
  return page
    .locator(".loading, .spinner, mat-progress-spinner, .mat-mdc-progress-spinner")
    .first()
    .isVisible()
    .catch(() => false);
}

/** True when the EZ Quote app finished loading a non-residence screen (summary, credit, premium). */
export async function chubbIsEzQuoteNonResidenceScreenReady(page: Page): Promise<boolean> {
  const url = page.url();

  if (/\/summary(?:\?|#|$)/i.test(url)) {
    const creditAlert = await page
      .locator("h2")
      .filter({ hasText: /Address Discrepancy/i })
      .first()
      .isVisible()
      .catch(() => false);
    const creditData = await page.locator(".credit-result-data").first().isVisible().catch(() => false);
    const footer = await page.locator("app-page-footer, .page-footer").first().isVisible().catch(() => false);
    const content = await page
      .locator(".page-content.loaded, .page-content, .dynamic-premium-container")
      .first()
      .isVisible()
      .catch(() => false);
    const heading = await page
      .locator("h1, h2")
      .filter({ hasText: /summary|premium|quote/i })
      .first()
      .isVisible()
      .catch(() => false);
    return creditAlert || creditData || footer || content || heading;
  }

  const credit = await page.locator("credit, .dynamic-premium-container").first().isVisible().catch(() => false);
  if (credit) return true;

  const pageContentLoaded = await page.locator(".page-content.loaded").first().isVisible().catch(() => false);
  return pageContentLoaded;
}

/** Wait until Angular dynamic view finishes loading (`.loaded` on container). */
export async function chubbWaitForDynamicViewReady(page: Page, timeoutMs = 90_000): Promise<void> {
  await chubbWaitIfSavingQuote(page, timeoutMs);
  await chubbClearStrayOverlays(page);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const loaded = await page
      .locator("#dynamic-view.loaded, .app-container.loaded, .dynamic-container.loaded")
      .first()
      .isVisible()
      .catch(() => false);

    const spinner = await chubbIsSpinnerVisible(page);

    const anyInput = page
      .locator(
        ".bdd-residence-info-0 input.building-value, .bdd-address-0 input.street, .bdd-client-info input.primary-insured-first-name"
      )
      .first();
    const inputReady =
      (await anyInput.isVisible().catch(() => false)) &&
      (await anyInput.isEnabled().catch(() => false));

    const nonResidenceReady = await chubbIsEzQuoteNonResidenceScreenReady(page);

    if (!spinner && (loaded || inputReady || nonResidenceReady)) {
      await page.waitForTimeout(300);
      return;
    }

    await chubbClearStrayOverlays(page);
    await page.waitForTimeout(250);
  }

  throw new Error(`CHUBB dynamic view did not reach loaded state within ${timeoutMs}ms (URL: ${page.url()}).`);
}

/** Wait for post–Interested Parties navigation (summary, credit, premium). */
export async function chubbWaitForPostInterestedPartiesScreen(page: Page, timeoutMs = 90_000): Promise<void> {
  await chubbWaitIfSavingQuote(page, Math.min(timeoutMs, 45_000));

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    if (/\/summary|\/credit|\/premium/i.test(url)) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      if (!(await chubbIsSpinnerVisible(page)) && (await chubbIsEzQuoteNonResidenceScreenReady(page))) {
        await page.waitForTimeout(300);
        return;
      }
    }

    if (!(await chubbIsSpinnerVisible(page)) && (await chubbIsEzQuoteNonResidenceScreenReady(page))) {
      await page.waitForTimeout(300);
      return;
    }

    await chubbClearStrayOverlays(page);
    await page.waitForTimeout(250);
  }

  throw new Error(
    `CHUBB post–Interested Parties screen did not load within ${timeoutMs}ms (URL: ${page.url()}).`
  );
}

/** Page is ready for clicks — save finished, loaded, no stray backdrop. */
export async function chubbWaitForPageInteractive(page: Page, timeoutMs = 90_000): Promise<void> {
  await chubbWaitForDynamicViewReady(page, timeoutMs);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await chubbWaitIfSavingQuote(page, 5_000);
    await chubbClearStrayOverlays(page);

    const hceOpen = await chubbIsHomeCoverageEstimatorVisible(page);

    if (hceOpen) {
      await page.waitForTimeout(250);
      continue;
    }

    if (!hceOpen && (await chubbCanInteractWithResidenceForm(page))) {
      return;
    }

    await chubbStripHeaderResourcesMenuOverlay(page);
    await chubbForceUnblockResidenceOverlays(page);
    await page.waitForTimeout(250);
  }

  await chubbWakeResidenceFormInteractivity(page);
}

export async function chubbAssertClientInfoPage(page: Page): Promise<void> {
  await chubbWaitIfSavingQuote(page);

  const onClientInfo = await page
    .locator(".bdd-client-info")
    .first()
    .isVisible()
    .catch(() => false);
  if (onClientInfo) return;

  const onDashboard = /dashboard|personal-lines/i.test(page.url());
  if (onDashboard) {
    throw new Error(
      `CHUBB left client-info and returned to dashboard (${page.url()}). ` +
        "Likely accidental Save & Exit or form submit — complete email, disclosure, then Continue only."
    );
  }

  throw new Error(`CHUBB left client-info page unexpectedly (URL: ${page.url()}).`);
}

export async function chubbAssertResidenceAddressPage(page: Page): Promise<void> {
  await chubbWaitIfSavingQuote(page);

  const onAddress = await page
    .locator(".bdd-address-0")
    .first()
    .isVisible()
    .catch(() => false);
  if (onAddress) return;

  throw new Error(`CHUBB expected residence address page but got URL: ${page.url()}.`);
}
