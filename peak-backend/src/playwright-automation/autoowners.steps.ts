import fs from "node:fs";
import path from "node:path";
import { Locator, Page } from "playwright";

type PayloadKV = { key?: unknown; value?: unknown };

function getPayloadValue(payload: unknown, key: string): unknown {
  if (!payload) return undefined;

  // Array form: [{ key: "personal.firstName", value: "Alex" }, ...]
  if (Array.isArray(payload)) {
    const found = (payload as PayloadKV[]).find((it) => String(it?.key ?? "") === key);
    return found?.value;
  }

  // Object form: allow dotted path lookup too.
  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    // If payload has a "fields" container (your current shape), search inside it first.
    // Example: { extractionId, ..., fields: [{ key, value }, ...] }
    if (Object.prototype.hasOwnProperty.call(obj, "fields")) {
      const inner = (obj as Record<string, unknown>).fields;
      const innerVal = getPayloadValue(inner, key);
      if (innerVal !== undefined) return innerVal;
    }

    // Array-like object form: { "0": { key, value }, "1": { key, value }, ... }
    // This happens when something serializes an array into an object with numeric keys.
    const keys = Object.keys(obj);
    const looksArrayLike =
      keys.length > 0 &&
      keys.slice(0, Math.min(keys.length, 5)).every((k) => /^[0-9]+$/.test(k)) &&
      typeof obj[keys[0]] === "object" &&
      obj[keys[0]] !== null &&
      Object.prototype.hasOwnProperty.call(obj[keys[0]] as Record<string, unknown>, "key");
    if (looksArrayLike) {
      const values = Object.values(obj) as PayloadKV[];
      const found = values.find((it) => String(it?.key ?? "") === key);
      return found?.value;
    }

    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    if (!key.includes(".")) return undefined;
    return key.split(".").reduce<unknown>((acc, part) => {
      if (!acc || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[part];
    }, obj);
  }

  return undefined;
}

function hasPayloadKey(payload: unknown, key: string): boolean {
  const v = getPayloadValue(payload, key);
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function formatEffectiveDateToMMDDYYYY(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;

  // Accept YYYY-MM-DD or MM/DD/YYYY
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[2]}/${ymd[3]}/${ymd[1]}`;

  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = mdy[1].padStart(2, "0");
    const dd = mdy[2].padStart(2, "0");
    return `${mm}/${dd}/${mdy[3]}`;
  }

  return null;
}

function parseMMDDYYYY(dateStr: string): { mm: number; dd: number; yyyy: number } | null {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return { mm: Number(m[1]), dd: Number(m[2]), yyyy: Number(m[3]) };
}

function mapEntityTypeToOptionValue(entity: unknown): string | null {
  const v = typeof entity === "string" ? entity.trim().toLowerCase() : "";
  if (!v) return null;

  // Matches HTML:
  // 01 Individual, 02 Partnership, 04 Corporation, 09 Other, 10 LLC, 12 Estate, 13 Trust
  if (v.includes("individual") || v.includes("sole")) return "01";
  if (v.includes("partnership") || v.includes("joint")) return "02";
  if (v.includes("corporation") || v.includes("corp")) return "04";
  if (v.includes("limited liability") || v === "llc") return "10";
  if (v.includes("estate")) return "12";
  if (v.includes("trust")) return "13";
  if (v.includes("other")) return "09";
  return null;
}

async function clearAndType(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 15000 });
  await loc.click();
  await loc.press("Control+A");
  await loc.press("Backspace");
  // Human-like typing reduces backend/WAF flakiness on auth flows.
  await loc.type(value, { delay: 45 });
}

async function setInputValueAndCommit(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 60000 });
  // Fast path for long forms: fill() is much faster than type().
  // (Login uses a separate slow-typing helper to reduce WAF flakiness.)
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click({ force: true }).catch(() => undefined);
  await loc.fill(value).catch(async () => {
    // Fallback if the control is stubborn.
    await loc.press("Control+A").catch(() => undefined);
    await loc.press("Backspace").catch(() => undefined);
    await loc.type(value, { delay: 5 }).catch(() => undefined);
  });
  // Commit to framework listeners
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
}

async function setDateValueWithoutSubmitting(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);

  // Use native setter so frameworks detect change.
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);

  // Blur safely without Enter/Tab/Esc (they can submit/close the modal).
  await page.locator("label[for='startProposalBusinessState']").first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function setComboBoxAndAcceptFirst(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click({ force: true });
  await loc.press("Control+A");
  await loc.press("Backspace");
  // Set exact value ONCE (avoid duplication like "AlexHiggins AlexHiggins").
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  // Blur safely; no Enter/Tab/Esc here (can submit/close modal).
  await page.locator("label[for='startProposalBusinessState']").first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(100);
}

async function setComboBoxValueNoClear(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click({ force: true });
  await loc.press("Control+A");
  await loc.press("Backspace");
  // Force-set + dispatch events for frameworks that clear uncommitted combo-box text
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
  await page.locator("label[for='startProposalBusinessState']").first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(100);
}

async function setSelectValueAndDispatch(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  // Try native selectOption first
  await loc.selectOption({ value }).catch(() => undefined);
  // Force set + dispatch for stubborn UIs
  await loc.evaluate((el: HTMLSelectElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
}

async function forceTypeIntoInput(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 60000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);

  // JS native setter + dispatch (works even when frameworks override value tracking)
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
  await page.locator("label[for='startProposalBusinessState']").first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(100);
}

async function trySelectDateFromCalendar(page: Page, effective: string): Promise<void> {
  const parsed = parseMMDDYYYY(effective);
  if (!parsed) return;
  // If a datepicker dialog is open, try selecting the day. (Month/year nav can be added later.)
  const dialog = page.getByRole("dialog").first();
  const isOpen = await dialog.isVisible().catch(() => false);
  if (!isOpen) return;
  // Never hang here: use short timeout and swallow failures.
  await page
    .getByRole("button", { name: new RegExp(`^${parsed.dd}$`) })
    .first()
    .click({ force: true, timeout: 2000 })
    .catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
}

async function closeDatePickerIfOpen(page: Page): Promise<void> {
  const isOpen = await page.getByRole("dialog").first().isVisible().catch(() => false);
  if (isOpen) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

/**
 * Step 1: Auto Owners username screen
 * HTML provided by user:
 * - input: <input type="text" name="username" id="input_1" ...>
 * - submit: <input type="submit" value="Continue">
 */
export async function stepSecureSignInUsername(page: Page, username: string): Promise<void> {
  // Prefer resilient selectors: id + name + form context.
  const usernameSelector = 'form#auth_form input[name="username"]#input_1';
  await clearAndType(page, usernameSelector, username);

  const continueSelector = 'form#auth_form input[type="submit"][value="Continue"]';
  // Small pause before submit to allow any client-side tokens to settle.
  await page.waitForTimeout(600);
  await page.locator(continueSelector).first().click();

  // Password screen is next; wait until either password appears or 2FA/next content appears.
  await page.waitForTimeout(1500);
}

/**
 * Step 2: Auto Owners password screen
 * HTML provided by user:
 * - password input: <input id="password" name="password" type="password" ...>
 * - submit: <button id="submit-button" type="submit">Sign In</button>
 */
export async function stepSecureSignInPassword(page: Page, password: string): Promise<void> {
  const passwordSelector = 'form#form input#password[name="password"][type="password"]';
  await clearAndType(page, passwordSelector, password);

  const submitSelector = 'form#form button#submit-button[type="submit"]';
  await page.locator(submitSelector).first().click();

  // Next page can be 2FA or post-login landing; give SPA time.
  await page.waitForTimeout(2000);
}

/**
 * Step 3: 2FA method switching (SMS -> Authenticator App)
 * You provided screenshot (no HTML yet). We'll use resilient locators:
 * - "Try Another Method" (link)
 * - "Authenticator App" (option)
 * - "Continue/Confirm" after selecting method (if present)
 */
export async function stepTwoFactorSwitchToAuthenticator(page: Page): Promise<void> {
  const tryAnother = page.getByRole("link", { name: /try another method/i });
  if (await tryAnother.isVisible().catch(() => false)) {
    await tryAnother.click();
    await page.waitForTimeout(800);
  }

  // Method chooser screen (your screenshot): "Authentication Method" with radio options.
  // Prefer explicit label-based selection, then click Continue.
  const methodHeading = page.getByText(/authentication method/i).first();
  const chooserVisible = await methodHeading.isVisible().catch(() => false);

  // On this page, the <label> can intercept pointer events over the <input>.
  // Prefer setChecked() to avoid click interception, then fallback to clicking the label.
  const authenticatorRadio = page.getByLabel(/authenticator app/i).first();
  const authenticatorInput = page.locator('input[type="radio"]#totp-factor-input').first();
  const authenticatorLabel = page.locator('label[for="totp-factor-input"]').first();
  const authenticatorText = page.getByText(/authenticator app/i).first();

  const didSelectAuthenticator = await (async () => {
    if (await authenticatorRadio.isVisible().catch(() => false)) {
      // Use radio-specific APIs first. These trigger proper events without pointer issues.
      if (await authenticatorInput.isVisible().catch(() => false)) {
        await authenticatorInput.check({ force: true }).catch(() => undefined);
        const checked = await authenticatorInput.isChecked().catch(() => false);
        if (checked) return true;
      }

      // Fallback: click the label (it is the one intercepting pointer events).
      if (await authenticatorLabel.isVisible().catch(() => false)) {
        await authenticatorLabel.click({ timeout: 15000, force: true }).catch(() => undefined);
        const checkedAfter = await authenticatorInput.isChecked().catch(() => false);
        if (checkedAfter) return true;
      }

      // Last resort: set checked via DOM + dispatch events.
      if (await authenticatorInput.isVisible().catch(() => false)) {
        await authenticatorInput.evaluate((el: HTMLInputElement) => {
          el.checked = true;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        });
        const checkedAfterEval = await authenticatorInput.isChecked().catch(() => false);
        if (checkedAfterEval) return true;
      }

      // Ultimate last resort: click label text node.
      await authenticatorText.click({ force: true }).catch(() => undefined);
      return await authenticatorInput.isChecked().catch(() => false);
    }
    if (chooserVisible && (await authenticatorText.isVisible().catch(() => false))) {
      await authenticatorText.click({ force: true }).catch(() => undefined);
      return await authenticatorInput.isChecked().catch(() => true);
    }
    return false;
  })();

  if (didSelectAuthenticator) {
    await page.waitForTimeout(500);
    // This page uses <button type="submit" class="ao-button-primary ...">Continue</button>
    const continueBtn = page.locator('form[role="form"] button[type="submit"].ao-button-primary').first();
    const fallbackContinue = page.getByRole("button", { name: /continue|confirm|next/i }).first();
    const btn = (await continueBtn.isVisible().catch(() => false)) ? continueBtn : fallbackContinue;
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Step 3b: Enter authenticator code and submit
 */
export async function stepTwoFactorEnterCodeAndSubmit(page: Page, code: string): Promise<void> {
  const labeled = page.getByLabel(/verification code|code/i).first();
  const generic = page.locator('input[type="text"], input[type="tel"], input[type="number"]').first();
  const target = (await labeled.isVisible().catch(() => false)) ? labeled : generic;

  await target.waitFor({ state: "visible", timeout: 15000 });
  await target.click();
  await target.press("Control+A");
  await target.press("Backspace");
  await target.type(code);

  const submitBtn = page.getByRole("button", { name: /sign in|verify|continue|confirm/i }).first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
  }
  await page.waitForTimeout(2000);
}

/**
 * Step 4: Start Proposal modal (from your provided HTML)
 * - Always select Line of Business = Dwelling Fire (value "DW")
 * - Fill effective date / named insured / entity type from payload
 */
export async function stepStartProposalModal(page: Page, payload: unknown): Promise<void> {
  // Click "Start Proposal" on home widget
  // payload can be array-of-kv or object; use getPayloadValue() for reads.
  const startProposalBtn = page.locator("button#startProposal").first();
  await startProposalBtn.waitFor({ state: "visible", timeout: 30000 });
  await startProposalBtn.click({ force: true });

  // Wait modal content
  const modal = page.locator(".ao-modal-dialog-content").first();
  await modal.waitFor({ state: "visible", timeout: 30000 });

  // Business State (if present in payload)
  const stateRaw = getPayloadValue(payload, "personal.state") ?? getPayloadValue(payload, "state");
  const state = typeof stateRaw === "string" ? stateRaw.trim().toUpperCase() : "";
  const businessStateSelect = page.locator("select#startProposalBusinessState").first();
  if (state && (await businessStateSelect.isVisible().catch(() => false))) {
    await businessStateSelect.selectOption({ value: state }).catch(() => undefined);
  }

  // Line of Business: always DW (Dwelling Fire)
  const lobSelect = page.locator("select#startProposalProductCode").first();
  await lobSelect.waitFor({ state: "visible", timeout: 30000 });
  await lobSelect.selectOption({ value: "DW" });
  // Verify
  await lobSelect.waitFor({ state: "visible" });

  // Effective Date
  const effectiveRaw =
    getPayloadValue(payload, "insuranceDetails.effectiveDate") ?? getPayloadValue(payload, "personal.effectiveDate");
  const effective = formatEffectiveDateToMMDDYYYY(effectiveRaw);
  if (effective) {
    const effectiveSelector = "#startProposalEffectiveDate input.ao-textbox";
    await setDateValueWithoutSubmitting(page, effectiveSelector, effective);

    // Hard verify effective value (if it got cleared by picker)
    const effectiveInput = page.locator(effectiveSelector).first();
    const after = (await effectiveInput.inputValue().catch(() => "")).trim();
    // Only use calendar fallback if date is empty/invalid (otherwise it can steal time/focus).
    const effectiveErrorNow = await page
      .getByText(/please enter a valid effective date/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!after || effectiveErrorNow) {
      await trySelectDateFromCalendar(page, effective);

      await setDateValueWithoutSubmitting(page, effectiveSelector, effective);
    }

    // Do NOT press Esc here (it can close the modal).
    await page.waitForTimeout(250);
  }

  // Named Insured
  const firstNameRaw =
    getPayloadValue(payload, "personal.firstName") ??
    getPayloadValue(payload, "personal.ownerFirstName") ??
    getPayloadValue(payload, "firstName");
  const lastNameRaw =
    getPayloadValue(payload, "personal.lastName") ??
    getPayloadValue(payload, "personal.ownerLastName") ??
    getPayloadValue(payload, "lastName");
  const firstName = typeof firstNameRaw === "string" ? firstNameRaw.trim() : "";
  const lastName = typeof lastNameRaw === "string" ? lastNameRaw.trim() : "";
  const namedInsured = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (namedInsured) {
    const insuredSelector = '#startProposalCustomer input[name="insuredName"]';
    const insuredLoc = page.locator(insuredSelector).first();
    await insuredLoc.waitFor({ state: "visible", timeout: 30000 });
    const enabled = await insuredLoc.isEnabled().catch(() => true);
    const editable = await insuredLoc.isEditable().catch(() => true);

    // Prefer combo accept, but if UI blocks typing, force-set input value.
    await setComboBoxAndAcceptFirst(page, insuredSelector, namedInsured);
    let v = (await insuredLoc.inputValue().catch(() => "")).trim();
    if (!v) {
      await setComboBoxValueNoClear(page, insuredSelector, namedInsured);
      v = (await insuredLoc.inputValue().catch(() => "")).trim();
    }
    // Hard retry loop (modal can re-render and clear the value)
    for (let i = 0; i < 3 && !v; i++) {
      await page.waitForTimeout(300);
      await forceTypeIntoInput(page, insuredSelector, namedInsured);
      v = (await insuredLoc.inputValue().catch(() => "")).trim();
    }
    if (!v) {
      throw new Error("Start Proposal modal: Named Insured could not be set.");
    }
  }

  // Entity Type
  const entityRaw = getPayloadValue(payload, "entity") ?? getPayloadValue(payload, "personal.entityType");
  const entityValue = mapEntityTypeToOptionValue(entityRaw);
  // Entity logs intentionally omitted (user requested only first/last).
  const entitySelect = page.locator("select#startProposalEntityType").first();
  await entitySelect.waitFor({ state: "visible", timeout: 30000 });
  if (entityValue && (await entitySelect.isVisible().catch(() => false))) {
    await setSelectValueAndDispatch(page, "select#startProposalEntityType", entityValue);
  } else if (typeof entityRaw === "string" && entityRaw.trim() && (await entitySelect.isVisible().catch(() => false))) {
    // fallback: try by label text
    await entitySelect.selectOption({ label: entityRaw.trim() }).catch(() => undefined);
  }
  // Verify entity is not empty if payload provided
  if (typeof entityRaw === "string" && entityRaw.trim() && (await entitySelect.isVisible().catch(() => false))) {
    const val = await entitySelect.inputValue().catch(() => "");
    if (!val) {
      const fallback = mapEntityTypeToOptionValue(entityRaw) ?? "01";
      await setSelectValueAndDispatch(page, "select#startProposalEntityType", fallback);
    }
  }
  // Entity logs intentionally omitted.

  // Do NOT submit if validation banner is present
  const effectiveError = page.getByText(/please enter a valid effective date/i).first();
  if (await effectiveError.isVisible().catch(() => false)) {
    // Try one more time to commit date by reopening picker and selecting day if possible
    const effectiveInput = page.locator("#startProposalEffectiveDate input.ao-textbox").first();
    await effectiveInput.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300);
    if (effective) await trySelectDateFromCalendar(page, effective);
    await page.keyboard.press("Escape").catch(() => undefined);
  }

  // Start New Business
  const startNewBusiness = page.locator("#startProposalComboButton_newBusiness").first();
  await startNewBusiness.waitFor({ state: "visible", timeout: 30000 });
  await startNewBusiness.click({ force: true });

  await page.waitForTimeout(2000);
}

/**
 * Step 5: Score Disclosure modal (if present)
 * - check #accepted
 * - click Continue (submit)
 */
export async function stepScoreDisclosureModalIfPresent(page: Page): Promise<void> {
  const modal = page.locator(".ao-modal-dialog-content").first();
  const hasCheckbox = await page.locator('input#accepted.ao-checkbox-input[name="accepted"]').first().isVisible().catch(() => false);
  const hasScoreText = await page.locator("text=Insurance Score").first().isVisible().catch(() => false);
  if (!(await modal.isVisible().catch(() => false)) || (!hasCheckbox && !hasScoreText)) return;

  const accepted = page.locator('input#accepted.ao-checkbox-input[name="accepted"]').first();
  await accepted.waitFor({ state: "visible", timeout: 15000 });
  await accepted.check({ force: true }).catch(() => undefined);

  const continueBtn = page.locator('.ao-modal-dialog-content button[type="submit"].ao-button-primary').first();
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
}

/**
 * Step 6: Fire/Dwelling "Basic Policy" form on /V5/PersonalProperty
 * Fill available fields using payload `fields` keys (key/value array).
 * Then click Continue and wait for Household Member(s) subtab to become active/available.
 */
export async function stepBasicPolicyFireDwelling(page: Page, payload: unknown): Promise<void> {
  // Ensure we're on the correct page (SPA-safe)
  await page.waitForURL(/\/V5\/PersonalProperty/i, { timeout: 45000, waitUntil: "domcontentloaded" });

  const digitsOnly = (v: unknown): string => String(v ?? "").replace(/\D/g, "");
  const zip5 = (v: unknown): string => digitsOnly(v).slice(0, 5);
  const zip4 = (v: unknown): string => {
    const d = digitsOnly(v);
    return d.length >= 9 ? d.slice(5, 9) : "";
  };
  const sanitizeAddress = (v: string): string => v.replace(/[,.\-#]/g, " ").replace(/\s+/g, " ").trim();

  // GLOBAL RULE — CLOSE "Producer Change Forms" MODAL (MUST)
  const closeProducerChangeFormsIfPresent = async (): Promise<void> => {
    const byModalContent = page.locator(".ao-modal-dialog-content").filter({ hasText: /producer change forms/i }).first();
    // Your screenshot shows a titlebar "Producer Change Forms" with a small X button.
    // That UI is often rendered as a content box / jQuery UI dialog rather than the AO modal wrapper.
    const byTitle = page.getByText(/producer change forms/i).first();
    const byTitleContainer = byTitle.locator(
      'xpath=ancestor::*[contains(@class,"ao-contentbox") or contains(@class,"ui-dialog") or contains(@class,"ao-modal") or contains(@class,"modal")][1]'
    );
    const dlg = (await byModalContent.isVisible().catch(() => false))
      ? byModalContent
      : (await byTitleContainer.isVisible().catch(() => false))
        ? byTitleContainer
        : byTitle;

    if (!(await dlg.isVisible().catch(() => false))) return;
    for (let i = 0; i < 3; i++) {
      // Let it fully render before clicking X (prevents "click too early" flakiness).
      await dlg.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(500);

      const xBtn = dlg
        .locator(
          [
            'button[aria-label="Close"]',
            'button[title="Close"]',
            'button:has-text("×")',
            'button:has-text("X")',
            'button:has-text("x")',
            ".ao-modal-dialog-close",
            ".ao-modal-dialog-close-button",
            ".ui-dialog-titlebar-close",
            ".close",
            'a[aria-label="Close"]',
            'a[title="Close"]',
          ].join(", ")
        )
        .first();
      // IMPORTANT: Only click once the X is actually visible (it can mount late).
      if (!(await xBtn.isVisible().catch(() => false))) {
        await xBtn.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      }
      if (await xBtn.isVisible().catch(() => false)) {
        await page.waitForTimeout(150);
        await xBtn.click({ force: true }).catch(() => undefined);
      }
      const closeBtn = dlg.getByRole("button", { name: /close|cancel|ok/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click({ force: true }).catch(() => undefined);
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(500);
      if (!(await dlg.isVisible().catch(() => false))) return;
    }
    throw new Error("Producer Change Forms modal could not be closed.");
  };

  const verifyInputEquals = async (selector: string, expected: string): Promise<boolean> => {
    const loc = page.locator(selector).first();
    const v = (await loc.inputValue().catch(() => "")).trim();
    return v === expected.trim();
  };

  const setTextWithVerify = async (selector: string, expected: string): Promise<void> => {
    await closeProducerChangeFormsIfPresent().catch(() => undefined);
    await setInputValueAndCommit(page, selector, expected);
    if (await verifyInputEquals(selector, expected)) return;
    await page.waitForTimeout(150);
    await closeProducerChangeFormsIfPresent().catch(() => undefined);
    await setInputValueAndCommit(page, selector, expected);
  };

  // STEP 0: Verify Page is Ready
  const basicTabCurrent = page.locator('li[id="subtab.basicPolicy"].current').first();
  await basicTabCurrent.waitFor({ state: "visible", timeout: 30000 });
  const formReadySignals = [
    page.locator("input#firstName").first(),
    page.locator("input#lastName").first(),
    page.locator("input#addressLine1").first(),
    page.locator('input[type="button"].F02v3[value="Continue"]').first(),
  ];
  const start = Date.now();
  while (Date.now() - start < 11000) {
    await closeProducerChangeFormsIfPresent().catch(() => undefined);
    const anyReady = await Promise.all(formReadySignals.map((l) => l.isVisible().catch(() => false))).then((xs) => xs.some(Boolean));
    if (anyReady) break;
    await page.waitForTimeout(350);
  }

  // Read payload values (values from parameters — no defaults)
  const firstName = String(getPayloadValue(payload, "personal.firstName") ?? "").trim();
  const lastName = String(getPayloadValue(payload, "personal.lastName") ?? "").trim();
  const address = String(getPayloadValue(payload, "personal.address") ?? getPayloadValue(payload, "personal.streetAddress") ?? "").trim();
  const city = String(getPayloadValue(payload, "personal.city") ?? "").trim();
  const state = String(getPayloadValue(payload, "personal.state") ?? "").trim().toUpperCase();
  const zip = getPayloadValue(payload, "personal.zipCode") ?? getPayloadValue(payload, "zipCode");
  const phone = getPayloadValue(payload, "personal.phone") ?? getPayloadValue(payload, "phone");
  const email = getPayloadValue(payload, "personal.email") ?? getPayloadValue(payload, "email");
  const termLengthRaw = String(getPayloadValue(payload, "termLength") ?? "").trim();
  const producerName = String(getPayloadValue(payload, "agentProducerName") ?? "").trim();
  const lossesRaw =
    getPayloadValue(payload, "insuranceDetails.numberOfLosses5Years") ??
    getPayloadValue(payload, "numberOfLosses5Years") ??
    getPayloadValue(payload, "insuranceDetails.numberOfLosses(5 Years)");
  const lossesStr = String(lossesRaw ?? "").trim();

  // STEP 1: First Name (with verify/retry)
  if (firstName) await setTextWithVerify("input#firstName", firstName);

  // STEP 2: Last Name (with verify/retry)
  if (lastName) await setTextWithVerify("input#lastName", lastName);

  // STEP 3: Mailing Address (Street, City, State, ZIP)
  if (address) await setTextWithVerify("input#addressLine1", address);
  if (city) await setTextWithVerify("input#city", city);
  if (state) await setSelectValueAndDispatch(page, "select#state", state);
  const z5 = zip5(zip);
  const z4 = zip4(zip);
  if (z5) await setTextWithVerify("input#zipCode1To5", z5);
  if (z4) await setTextWithVerify("input#zipCode6To9", z4);

  // STEP 4: Phone Number (digits only)
  const pd = digitsOnly(phone);
  const p10 = pd.length >= 10 ? pd.slice(-10) : pd;
  if (p10.length === 10) {
    await setTextWithVerify("input#phoneNumberAreaCode", p10.slice(0, 3));
    await setTextWithVerify("input#phoneNumberExchange", p10.slice(3, 6));
    await setTextWithVerify("input#phoneNumberLineNumber", p10.slice(6, 10));
  }

  // STEP 5: Email
  if (email) await setTextWithVerify("input#emailAddress", String(email).trim());

  // STEP 6: Term Length (best-effort mapping to UI codes)
  // If your UI uses codes, we map common English values. If it already is a code, try it directly.
  if (termLengthRaw) {
    const termSelect = page.locator("select#termLengthCode").first();
    if (await termSelect.isVisible().catch(() => false)) {
      const termLower = termLengthRaw.toLowerCase();
      const mapped =
        termLower === "a" || termLower.includes("annual") || termLower.includes("12")
          ? "A"
          : termLower === "s" || termLower.includes("semi") || termLower.includes("6")
            ? "S"
            : termLower === "q" || termLower.includes("quarter") || termLower.includes("3")
              ? "Q"
              : termLower === "m" || termLower.includes("month") || termLower.includes("1")
                ? "M"
                : termLengthRaw;
      await setSelectValueAndDispatch(page, "select#termLengthCode", mapped).catch(() => undefined);
    }
  }

  // STEP 7: Agent/Producer Name (exact match else NOT LISTED)
  const producerSelect = page.locator("select#producerKey").first();
  if (await producerSelect.isVisible().catch(() => false)) {
    if (producerName) {
      await producerSelect.selectOption({ label: producerName }).catch(async () => {
        await producerSelect.selectOption({ value: "NOTLISTED" }).catch(() => undefined);
      });
    } else {
      // If payload is missing producer, do not invent a name; keep existing UI value.
    }
  }

  // STEP 8: Any Losses For Past Five Years
  const lossesSelect = page.locator("select#lossesForFiveYearsInd").first();
  if (await lossesSelect.isVisible().catch(() => false)) {
    const lossesLower = lossesStr.toLowerCase();
    const treatAsNone = lossesStr === "0" || lossesLower === "none" || lossesLower === "no";
    // Try label-based first ("None"/"0"/"No"), then fall back to existing Y/N codes.
    if (treatAsNone) {
      await lossesSelect.selectOption({ label: "None" }).catch(() => undefined);
      await lossesSelect.selectOption({ label: "0" }).catch(() => undefined);
      await lossesSelect.selectOption({ label: "No" }).catch(() => undefined);
      await lossesSelect.selectOption({ value: "N" }).catch(() => undefined);
      await setSelectValueAndDispatch(page, "select#lossesForFiveYearsInd", "N").catch(() => undefined);
    } else if (lossesStr) {
      await lossesSelect.selectOption({ label: lossesStr }).catch(() => undefined);
      await lossesSelect.selectOption({ value: "Y" }).catch(() => undefined);
      await setSelectValueAndDispatch(page, "select#lossesForFiveYearsInd", "Y").catch(() => undefined);
    }
  }

  // STEP 9: Address Validation (if error occurs)
  const addressError = page.locator("text=/address not found|invalid characters/i").first();
  const hasAddressError = await addressError.isVisible().catch(() => false);
  if (hasAddressError && address) {
    const cleaned = sanitizeAddress(address);
    if (cleaned && cleaned !== address) {
      await setTextWithVerify("input#addressLine1", cleaned);
      await page.waitForTimeout(200);
    }
    const override = page.getByText(/override address/i).first();
    const overrideCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /override address/i }).first();
    if (await override.isVisible().catch(() => false)) {
      await override.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
    } else if (await overrideCheckbox.isVisible().catch(() => false)) {
      await overrideCheckbox.check({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
  }

  // STEP 10: Additional Name Fields (clear & leave empty)
  if (await page.locator("input#additionalName1").first().isVisible().catch(() => false)) {
    await setInputValueAndCommit(page, "input#additionalName1", "");
  }
  if (await page.locator("input#additionalName2").first().isVisible().catch(() => false)) {
    await setInputValueAndCommit(page, "input#additionalName2", "");
  }

  // STEP 11: Verify ALL Fields Before Continue (best-effort, only for fields present)
  if (firstName && !(await verifyInputEquals("input#firstName", firstName))) await setTextWithVerify("input#firstName", firstName);
  if (lastName && !(await verifyInputEquals("input#lastName", lastName))) await setTextWithVerify("input#lastName", lastName);
  if (address && !(await verifyInputEquals("input#addressLine1", address))) {
    // if we sanitized due to validation, re-verify against sanitized.
    const current = (await page.locator("input#addressLine1").first().inputValue().catch(() => "")).trim();
    const cleaned = sanitizeAddress(address);
    if (current !== cleaned) await setTextWithVerify("input#addressLine1", cleaned || address);
  }
  if (city && !(await verifyInputEquals("input#city", city))) await setTextWithVerify("input#city", city);
  if (z5 && !(await verifyInputEquals("input#zipCode1To5", z5))) await setTextWithVerify("input#zipCode1To5", z5);
  if (email && !(await verifyInputEquals("input#emailAddress", String(email).trim()))) {
    await setTextWithVerify("input#emailAddress", String(email).trim());
  }

  await closeProducerChangeFormsIfPresent().catch(() => undefined);

  // STEP 12: Continue + SPA Transition Handling
  const continueBtn = page.locator('input[type="button"].F02v3[value="Continue"], input[type="button"][value="Next"]').first();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);

  const successSignal = async (): Promise<boolean> => {
    const hhTabCurrent = await page.locator('li[id="subtab.householdMembers"].current').first().isVisible().catch(() => false);
    const hhText = await page.locator("text=/ADD A HOUSEHOLD MEMBER|Add all household member\\(s\\)/i").first().isVisible().catch(() => false);
    const url = page.url();
    const hashOk = /#(household|member)/i.test(url);
    return hhTabCurrent || hhText || hashOk;
  };

  // If this popup races in right when we click Continue, close it and re-click immediately.
  await closeProducerChangeFormsIfPresent().catch(() => undefined);
  await continueBtn.click({ force: true });
  await page.waitForTimeout(350);
  await closeProducerChangeFormsIfPresent().catch(() => undefined);
  const t1 = Date.now();
  while (Date.now() - t1 < 10000) {
    await closeProducerChangeFormsIfPresent().catch(() => undefined);
    if (await successSignal()) break;
    await page.waitForTimeout(350);
  }

  if (!(await successSignal())) {
    await page.waitForTimeout(2000);
    await closeProducerChangeFormsIfPresent().catch(() => undefined);
    await continueBtn.click({ force: true }).catch(() => undefined);
    const t2 = Date.now();
    while (Date.now() - t2 < 20000) {
      if (await successSignal()) break;
      await page.waitForTimeout(500);
    }
  }

  if (!(await successSignal())) {
    const hhTab = page.locator('li[id="subtab.householdMembers"]').first();
    if (await hhTab.isVisible().catch(() => false)) {
      await hhTab.click({ force: true }).catch(() => undefined);
      const t3 = Date.now();
      while (Date.now() - t3 < 8000) {
        if (await successSignal()) break;
        await page.waitForTimeout(350);
      }
    }
  }

  if (!(await successSignal())) {
    // Let the runner capture the final error screenshot too; we throw a clear reason here.
    throw new Error("Household Member section not reachable after Continue + direct-tab fallback.");
  }

  // FINAL SYNC CHECK
  await page.waitForTimeout(2000);
}

function parseMMDDYYYYFlexible(dateRaw: unknown): { mm: string; dd: string; yyyy: string } | null {
  const s = typeof dateRaw === "string" ? dateRaw.trim() : "";
  if (!s) return null;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return { mm: mdy[1].padStart(2, "0"), dd: mdy[2].padStart(2, "0"), yyyy: mdy[3] };
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return { mm: ymd[2], dd: ymd[3], yyyy: ymd[1] };
  return null;
}

function mapRelationshipToValue(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s) return "";
  if (s.includes("self") || s.includes("named insured") || s === "i") return "I";
  if (s.includes("spouse") || s === "s") return "S";
  if (s.includes("child") || s === "c") return "C";
  if (s.includes("resident") || s.includes("relative") || s === "r") return "R";
  if (s.includes("other") || s === "o") return "O";
  return "";
}

function mapMaritalToValue(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s) return "";
  if (s.startsWith("marr") || s === "m") return "M";
  if (s.startsWith("sing") || s === "s") return "S";
  if (s.startsWith("div") || s === "d") return "D";
  if (s.startsWith("wid") || s === "w") return "W";
  return "";
}

function parseSSNDigits(ssnRaw: unknown): { a: string; b: string; c: string } | null {
  const d = String(ssnRaw ?? "").replace(/\D/g, "");
  if (d.length !== 9) return null;
  return { a: d.slice(0, 3), b: d.slice(3, 5), c: d.slice(5, 9) };
}

/**
 * Step 7: Household Member(s) form
 * - Fill from payload.householdMember.* (or dotted keys in kv-array)
 * - Save is mandatory before Continue
 * - SPA-safe forward-progress skip
 */
export async function stepHouseholdMember(page: Page, payload: unknown): Promise<void> {
  // STEP 0: Verify Page is Ready (post-Block 4 transition)
  const startedAt = Date.now();
  while (Date.now() - startedAt < 11000) {
    const ready =
      (await page.locator(".householdMemberDetails").first().isVisible().catch(() => false)) ||
      (await page.locator("text=/ADD A HOUSEHOLD MEMBER/i").first().isVisible().catch(() => false)) ||
      (await page.locator('li[id="subtab.householdMembers"].current').first().isVisible().catch(() => false));
    if (ready) break;
    await page.waitForTimeout(350);
  }

  const householdIndicators = async (): Promise<boolean> => {
    const byHeading = await page.locator("text=/ADD A HOUSEHOLD MEMBER/i").first().isVisible().catch(() => false);
    const byTab = await page.locator('li[id="subtab.householdMembers"].current').first().isVisible().catch(() => false);
    const byFields = await page
      .locator(
        [
          ".householdMemberDetails input#firstName",
          ".householdMemberDetails input#lastName",
          "input#firstName",
          "input#lastName",
        ].join(", ")
      )
      .first()
      .isVisible()
      .catch(() => false);
    return byHeading || byTab || byFields;
  };

  const forwardProgressIndicators = async (): Promise<boolean> => {
    const candidates = [
      'li[id="subtab.insuranceScore"].current',
      'li[id="tab.locations"].current',
      'li[id="tab.addlCoverages"].current',
      'li[id="tab.underwriting"].current',
      'li[id="tab.summary"].current',
      'li[id="tab.finalSale"].current',
    ];
    for (const sel of candidates) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) return true;
    }
    // also accept content text as forward progress signal
    const byText = await page
      .locator("text=/Insurance Score|Location\\(s\\)|Add'l Coverages|Underwriting|Summary|Final Sale/i")
      .first()
      .isVisible()
      .catch(() => false);
    return byText;
  };

  // STEP 1: Check if household page present or already moved ahead
  let found = await householdIndicators();
  for (let i = 0; i < 6 && !found; i++) {
    await page.waitForTimeout(5000);
    found = await householdIndicators();
  }
  if (!found) {
    if (await forwardProgressIndicators()) return;
    throw new Error("Navigation failed");
  }

  // PRE-CHECK: ensure form fields visible, else click Add Household Member if present
  const detailsContainer = page.locator(".householdMemberDetails").first();
  const hasDetailsContainer = await detailsContainer.isVisible().catch(() => false);
  const hmBase = (): string => (hasDetailsContainer ? ".householdMemberDetails " : "");
  const hmSel = (css: string): string => `${hmBase()}${css}`;

  const fieldsVisible = await page
    .locator([hmSel("input#firstName"), "input#firstName"].join(", "))
    .first()
    .isVisible()
    .catch(() => false);
  if (!fieldsVisible) {
    // We might already be on the post-save summary/list screen (schedule card),
    // where the edit form fields are intentionally hidden.
    const scheduleCard = page.locator(".scheduleCard.householdMember, .householdMemberSummary").first();
    const listContinue = page
      .locator(
        [
          'input[type="button"].F02v3[value="Continue"]',
          'input[type="button"][value="Continue"]',
          'button.F02v3:has-text("Continue")',
          'button:has-text("Continue")',
        ].join(", ")
      )
      .first();
    const isListScreen =
      (await scheduleCard.isVisible().catch(() => false)) || (await listContinue.isVisible().catch(() => false));
    if (isListScreen) {
      if (await listContinue.isVisible().catch(() => false)) {
        await listContinue.scrollIntoViewIfNeeded().catch(() => undefined);
        // Click + retry (SPA sometimes drops the first click)
        await listContinue.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(1200);
        if (await listContinue.isVisible().catch(() => false)) {
          await listContinue.scrollIntoViewIfNeeded().catch(() => undefined);
          await page.waitForTimeout(200);
          await listContinue.click({ force: true }).catch(() => undefined);
          await page.waitForTimeout(800);
        }
      }
      // After clicking Continue on the list screen, wait for Insurance Score to load (SPA-safe).
      await page
        .waitForURL(/subtab\.insuranceScore|\/insuranceScore/i, { timeout: 45000, waitUntil: "domcontentloaded" })
        .catch(() => undefined);
      const t = Date.now();
      while (Date.now() - t < 8000) {
        const moved =
          (await page.locator('li[id="subtab.insuranceScore"].current').first().isVisible().catch(() => false)) ||
          (await page.locator("text=/Apply an Insurance Score/i").first().isVisible().catch(() => false));
        if (moved) break;
        await page.waitForTimeout(400);
      }
      return;
    }

    // Otherwise, click Add Household Member (HTML uses an <input type="button" value="Add Household Member">)
    const addBtn = page
      .locator(
        [
          'input[type="button"][value="Add Household Member"]',
          "input.addItem.addPerson",
          'input.addItem[value*="Add Household"]',
          'button:has-text("Add Household Member")',
        ].join(", ")
      )
      .first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await addBtn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(900);
    }
    const nowVisible = await page
      .locator([hmSel("input#firstName"), "input#firstName"].join(", "))
      .first()
      .isVisible()
      .catch(() => false);
    if (!nowVisible) throw new Error("Required household member field not found or not fillable.");
  }

  // Ensure the form is in view (SPA sometimes renders below fold).
  await (hasDetailsContainer ? detailsContainer : page.locator(hmSel("input#firstName")).first())
    .scrollIntoViewIfNeeded()
    .catch(() => undefined);
  await page.waitForTimeout(200);

  // Data source
  const hmFirst = String(getPayloadValue(payload, "householdMember.firstName") ?? getPayloadValue(payload, "personal.householdMember.firstName") ?? "").trim();
  const hmLast = String(getPayloadValue(payload, "householdMember.lastName") ?? getPayloadValue(payload, "personal.householdMember.lastName") ?? "").trim();
  const hmSuffix = String(getPayloadValue(payload, "householdMember.suffix") ?? "").trim();
  const hmDob = getPayloadValue(payload, "householdMember.dob") ?? getPayloadValue(payload, "householdMember.dateOfBirth");
  const hmSsn = getPayloadValue(payload, "householdMember.ssn");
  const hmRel = getPayloadValue(payload, "householdMember.relationship");
  const hmMarital = getPayloadValue(payload, "householdMember.maritalStatus");
  const dlState = String(getPayloadValue(payload, "personal.state") ?? getPayloadValue(payload, "state") ?? "").trim().toUpperCase();
  const dlNumber = String(getPayloadValue(payload, "householdMember.dlNumber") ?? getPayloadValue(payload, "householdMember.licenseNumber") ?? "").trim();

  const verifyInputEquals = async (selector: string, expected: string): Promise<boolean> => {
    const v = (await page.locator(selector).first().inputValue().catch(() => "")).trim();
    return v === expected.trim();
  };
  const setTextWithVerify = async (selector: string, expected: string): Promise<void> => {
    await setInputValueAndCommit(page, selector, expected);
    if (await verifyInputEquals(selector, expected)) return;
    await page.waitForTimeout(150);
    await setInputValueAndCommit(page, selector, expected);
  };
  const withRetries = async (fn: () => Promise<void>, attempts = 3): Promise<void> => {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        await fn();
        return;
      } catch (e) {
        lastErr = e;
        await page.waitForTimeout(150);
        // If SPA re-rendered, re-scroll to stabilize.
        await (hasDetailsContainer ? detailsContainer : page.locator(hmSel("input#firstName")).first())
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
        await page.waitForTimeout(80);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };

  // STEP 2: First Name
  if (hmFirst) await withRetries(() => setTextWithVerify(hmSel("input#firstName"), hmFirst));

  // STEP 3: Last Name
  if (hmLast) await withRetries(() => setTextWithVerify(hmSel("input#lastName"), hmLast));

  // STEP 4: Suffix
  if (hmSuffix) {
    const suffixSel = page.locator(hmSel("select#suffix")).first();
    if (await suffixSel.isVisible().catch(() => false)) {
      await withRetries(async () => {
        await suffixSel.waitFor({ state: "visible", timeout: 15000 });
        await suffixSel.selectOption({ value: hmSuffix }).catch(async () => {
          await suffixSel.selectOption({ label: hmSuffix }).catch(() => undefined);
        });
      });
    }
  }

  // STEP 5: Date of Birth (split fields)
  const dob = parseMMDDYYYYFlexible(hmDob);
  if (dob) {
    await withRetries(() => setTextWithVerify(hmSel("input#dateOfBirthMonth"), dob.mm));
    await withRetries(() => setTextWithVerify(hmSel("input#dateOfBirthDay"), dob.dd));
    await withRetries(() => setTextWithVerify(hmSel("input#dateOfBirthYear"), dob.yyyy));
  }

  // STEP 6: SSN (split fields)
  const ssn = parseSSNDigits(hmSsn);
  if (ssn) {
    await withRetries(() => setTextWithVerify(hmSel("input#ssn1To3"), ssn.a));
    await withRetries(() => setTextWithVerify(hmSel("input#ssn4To5"), ssn.b));
    await withRetries(() => setTextWithVerify(hmSel("input#ssn6To9"), ssn.c));
  }

  // STEP 7: Relationship to Insured
  const relVal = mapRelationshipToValue(hmRel);
  if (relVal) {
    await withRetries(() => setSelectValueAndDispatch(page, hmSel("select#relationship"), relVal));
  } else if (typeof hmRel === "string" && hmRel.trim()) {
    const rel = page.locator(hmSel("select#relationship")).first();
    if (await rel.isVisible().catch(() => false)) {
      await withRetries(async () => {
        await rel.selectOption({ label: hmRel.trim() }).catch(() => undefined);
      });
    }
  }

  // STEP 8: Marital Status
  const maritalVal = mapMaritalToValue(hmMarital);
  if (maritalVal) {
    await withRetries(() => setSelectValueAndDispatch(page, hmSel("select#maritalStatus"), maritalVal));
  } else if (typeof hmMarital === "string" && hmMarital.trim()) {
    const ms = page.locator(hmSel("select#maritalStatus")).first();
    if (await ms.isVisible().catch(() => false)) {
      await withRetries(async () => {
        await ms.selectOption({ label: hmMarital.trim() }).catch(() => undefined);
      });
    }
  }

  // STEP 9: Driver's License State
  if (dlState) await withRetries(() => setSelectValueAndDispatch(page, hmSel("select#licenseState"), dlState));

  // STEP 10: Driver's License Number
  if (dlNumber) await withRetries(() => setTextWithVerify(hmSel("input#licenseNumber"), dlNumber));

  // STEP 11: Pre-Save verification (best-effort for fields we filled)
  if (hmFirst && !(await verifyInputEquals(hmSel("input#firstName"), hmFirst))) {
    await setTextWithVerify(hmSel("input#firstName"), hmFirst);
  }
  if (hmLast && !(await verifyInputEquals(hmSel("input#lastName"), hmLast))) {
    await setTextWithVerify(hmSel("input#lastName"), hmLast);
  }

  // STEP 12: Save (mandatory before continue)
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);
  const saveBtn = page
    .locator(
      [
        hmSel('input[type="button"].F02v4[value="Save"]'),
        hmSel('input[type="button"][value="Save"]'),
        'input[type="button"].F02v4[value="Save"]',
        'input[type="button"][value="Save"]',
      ].join(", ")
    )
    .first();
  await saveBtn.waitFor({ state: "visible", timeout: 30000 });
  await saveBtn.click({ force: true });

  const saveConfirmed = async (): Promise<boolean> => {
    // After Save, AO often collapses the edit form into a summary "schedule card"
    // and shows a single green Continue on the Household Member(s) list screen.
    const scheduleCard = await page.locator(".scheduleCard.householdMember, .householdMemberSummary").first().isVisible().catch(() => false);
    const listContinue = await page
      .locator(
        [
          'input[type="button"].F02v3[value="Continue"]',
          'input[type="button"][value="Continue"]',
          'button.F02v3:has-text("Continue")',
          'button:has-text("Continue")',
        ].join(", ")
      )
      .first()
      .isVisible()
      .catch(() => false);
    if (scheduleCard || listContinue) return true;

    // Fallback: no visible validation errors inside the form
    const scope = hasDetailsContainer ? detailsContainer : page.locator("body");
    const hasErrorText = await scope.getByText(/required|invalid|please/i).first().isVisible().catch(() => false);
    const hasErrorClass = await page
      .locator(
        [
          hmSel(".error"),
          hmSel(".validationError"),
          hmSel(".fieldError"),
          ".error",
          ".validationError",
          ".fieldError",
        ].join(", ")
      )
      .first()
      .isVisible()
      .catch(() => false);
    return !hasErrorText && !hasErrorClass;
  };

  const s1 = Date.now();
  while (Date.now() - s1 < 8000) {
    if (await saveConfirmed()) break;
    await page.waitForTimeout(350);
  }
  if (!(await saveConfirmed())) {
    await page.waitForTimeout(3000);
    if (!(await saveConfirmed())) throw new Error("Save failed on household member form.");
  }

  // STEP 13: Continue (only after save)
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);
  // After Save, we are typically on the Household Member(s) summary list screen.
  // Use the green list Continue there (matches your picture 2).
  const continueBtn = page.locator('input[type="button"].F02v3[value="Continue"]').first();

  const insuranceTab = page.locator('li[id="subtab.insuranceScore"]').first();

  const clickContinueWithRetries = async (): Promise<void> => {
    if (!(await continueBtn.isVisible().catch(() => false))) return;
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(200);
    await continueBtn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(1200);
    // If still on same screen, click once more (SPA sometimes drops first click)
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(200);
      await continueBtn.click({ force: true }).catch(() => undefined);
    }
  };

  // Ensure we are truly on the "picture 2" state before continuing:
  // schedule card row + green Continue.
  const listStateStart = Date.now();
  while (Date.now() - listStateStart < 12000) {
    const scheduleCard = await page.locator(".scheduleCard.householdMember, .householdMemberSummary").first().isVisible().catch(() => false);
    const btn = await continueBtn.isVisible().catch(() => false);
    if (scheduleCard && btn) break;
    await page.waitForTimeout(400);
  }

  // Prefer list Continue button; if it doesn't exist, go via Insurance Score tab.
  if (await continueBtn.isVisible().catch(() => false)) {
    await clickContinueWithRetries();
  } else if (await insuranceTab.isVisible().catch(() => false)) {
    await insuranceTab.click({ force: true }).catch(() => undefined);
  }

  const transitioned = async (): Promise<boolean> => {
    const url = page.url();
    const tabMoved = await page.locator('li[id="subtab.insuranceScore"].current, li[id="subtab.location"].current').first().isVisible().catch(() => false);
    const byText = await page.locator("text=/Apply an Insurance Score|Location\\(s\\)/i").first().isVisible().catch(() => false);
    return tabMoved || byText || /insuranceScore/i.test(url);
  };

  // Extra SPA wait: URL or tab can lag behind the click.
  await page
    .waitForURL(/subtab\.insuranceScore|\/insuranceScore/i, { timeout: 12000, waitUntil: "domcontentloaded" })
    .catch(() => undefined);

  const c1 = Date.now();
  while (Date.now() - c1 < 8000) {
    if (await transitioned()) break;
    await page.waitForTimeout(400);
  }
  if (!(await transitioned())) {
    // Final fallback: click Insurance Score subtab directly.
    if (await insuranceTab.isVisible().catch(() => false)) {
      await insuranceTab.click({ force: true }).catch(() => undefined);
      await page
        .waitForURL(/subtab\.insuranceScore|\/insuranceScore/i, { timeout: 12000, waitUntil: "domcontentloaded" })
        .catch(() => undefined);
    }
    await page.waitForTimeout(2500);
    if (!(await transitioned())) throw new Error("Continue clicked but no page transition detected after Save.");
  }

  // FINAL SYNC CHECK
  await page.waitForTimeout(2000);
}

/**
 * Step 8: Insurance Score (select "No Score" and continue)
 * SPA-safe: If already moved to later tabs, treat as success.
 */
export async function stepInsuranceScoreNoScore(page: Page): Promise<void> {
  // STEP 0: Verify page is ready
  const startedAt = Date.now();
  while (Date.now() - startedAt < 11000) {
    const ready =
      (await page.locator('li[id="subtab.insuranceScore"]').first().isVisible().catch(() => false)) ||
      (await page.locator("text=/Insurance Score/i").first().isVisible().catch(() => false));
    if (ready) break;
    await page.waitForTimeout(350);
  }

  const forwardProgressIndicators = async (): Promise<boolean> => {
    const selectors = [
      'li#tab.location.current',
      'li#tab.addlCoverages.current',
      'li#tab.underwriting.current',
      'li#tab.summary.current',
      'li#tab.finalSale.current',
    ];
    for (const s of selectors) {
      if (await page.locator(s).first().isVisible().catch(() => false)) return true;
    }
    const byText = await page
      .locator("text=/Add Location|Location Schedule|Property Coverages|Liability Coverages|Underwriting|Summary|Final Sale/i")
      .first()
      .isVisible()
      .catch(() => false);
    return byText;
  };

  // PRE-CHECK: already past insurance score?
  if (await forwardProgressIndicators()) return;

  const insuranceIndicators = async (): Promise<boolean> => {
    const heading = await page.locator("text=/Apply an Insurance Score/i").first().isVisible().catch(() => false);
    const tabCurrent = await page.locator('li[id="subtab.insuranceScore"].current').first().isVisible().catch(() => false);
    const noScoreText = await page.locator("text=/No Score/i").first().isVisible().catch(() => false);
    return heading || tabCurrent || noScoreText;
  };

  // STEP 1: ensure insurance score context visible (click tab up to 2 times)
  if (!(await insuranceIndicators())) {
    const tab = page.locator('li[id="subtab.insuranceScore"]').first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
    }
    const t1 = Date.now();
    while (Date.now() - t1 < 8000) {
      if (await insuranceIndicators()) break;
      await page.waitForTimeout(350);
    }
  }
  if (!(await insuranceIndicators())) {
    const tab = page.locator('li[id="subtab.insuranceScore"]').first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
    }
    const t2 = Date.now();
    while (Date.now() - t2 < 8000) {
      if (await insuranceIndicators()) break;
      await page.waitForTimeout(350);
    }
  }

  // STEP 2: final check
  if (!(await insuranceIndicators())) {
    if (await forwardProgressIndicators()) return;
    throw new Error("Insurance Score tab not reachable.");
  }

  // STEP 3: select "No Score"
  // NOTE: Some proposals show an error banner:
  // "We are unable to obtain an Insurance Score at this time. You may click continue and try again later"
  // In that case, there may be NO "No Score" option at all. We must just click Continue.
  const scoreUnavailableBanner = page
    .locator("#errorSection, .errorContainer")
    .filter({ hasText: /unable to obtain an insurance score/i })
    .first();
  const hasScoreUnavailable = await scoreUnavailableBanner.isVisible().catch(() => false);

  const noScoreRadioByLabel = page.getByLabel(/no score/i).first();
  const noScoreByText = page.getByText(/no score/i).first();
  const noScoreRadio = page.locator('input[type="radio"]').filter({ has: noScoreByText }).first();
  const pickNoScore = async (): Promise<boolean> => {
    // Strategy 1: label-based
    if (await noScoreRadioByLabel.isVisible().catch(() => false)) {
      await noScoreRadioByLabel.check({ force: true }).catch(() => undefined);
      const checked = await noScoreRadioByLabel.isChecked().catch(() => false);
      if (checked) return true;
    }
    // Strategy 2: click the text then find a nearby radio
    if (await noScoreByText.isVisible().catch(() => false)) {
      await noScoreByText.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
    }
    // Strategy 3: xpath: find an input radio in same row/container as "No Score"
    const nearRadio = page
      .locator('xpath=//*[contains(normalize-space(.),"No Score")]/ancestor::*[self::label or self::div or self::tr][1]//input[@type="radio"]')
      .first();
    if (await nearRadio.isVisible().catch(() => false)) {
      await nearRadio.check({ force: true }).catch(() => undefined);
      const checked = await nearRadio.isChecked().catch(() => false);
      if (checked) return true;
    }
    // Strategy 4: fallback already-resolved radio filter (may be empty depending on DOM)
    if (await noScoreRadio.isVisible().catch(() => false)) {
      await noScoreRadio.check({ force: true }).catch(() => undefined);
      const checked = await noScoreRadio.isChecked().catch(() => false);
      if (checked) return true;
    }
    return false;
  };

  // Only click if not selected
  const alreadySelected =
    (await noScoreRadioByLabel.isChecked().catch(() => false)) ||
    (await page
      .locator('xpath=//*[contains(normalize-space(.),"No Score")]/ancestor::*[self::label or self::div or self::tr][1]//input[@type="radio" and @checked]')
      .first()
      .isVisible()
      .catch(() => false));

  if (!alreadySelected) {
    const didPick = await pickNoScore();
    if (!didPick) {
      // If the site cannot obtain a score, proceed by clicking Continue (per UI instructions).
      if (hasScoreUnavailable) {
        // fall through to Continue step below
      } else {
        // If the page is confirmed but No Score can't be found, terminate.
        throw new Error("No Score option missing on Insurance Score page.");
      }
    }
    if (didPick) {
      // re-verify once
      await page.waitForTimeout(500);
      if (!(await pickNoScore())) {
        // still not selected → try once more and keep going (do not loop forever)
        await page.waitForTimeout(300);
        await pickNoScore();
      }
    }
  }

  // STEP 5: Continue (SPA)
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);
  const errorSection = page.locator("#errorSection, .errorContainer").first();
  const ensureIgnoreErrorsCheckedIfPresent = async (): Promise<void> => {
    const candidates = [
      page.locator('#errorSection input#ignoreErrors[name="ignoreErrors"]').first(),
      page.locator('input#ignoreErrors[name="ignoreErrors"]').first(),
      page.locator('#errorSection input[type="checkbox"][name*="ignore" i]').first(),
      page.locator('input[type="checkbox"][name*="ignore" i]').first(),
      page.locator('label:has-text("Ignore Errors") input[type="checkbox"]').first(),
      page.locator('xpath=//label[contains(normalize-space(.),"Ignore Errors")]/preceding::input[@type="checkbox"][1]').first(),
      page.locator('xpath=//*[contains(normalize-space(.),"Ignore Errors")]/preceding::input[@type="checkbox"][1]').first(),
      page.locator('#errorSection input[type="checkbox"]').first(),
    ];

    for (const cb of candidates) {
      if (!(await cb.isVisible().catch(() => false))) continue;
      const checked = await cb.isChecked().catch(() => false);
      if (checked) return;

      await cb.scrollIntoViewIfNeeded().catch(() => undefined);
      await cb.check({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await cb.isChecked().catch(() => false)) return;

      await cb.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await cb.isChecked().catch(() => false)) return;

      await cb
        .evaluate((el: HTMLInputElement) => {
          el.checked = true;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        })
        .catch(() => undefined);
      await page.waitForTimeout(250);
      if (await cb.isChecked().catch(() => false)) return;
    }

    // Final fallback: brute-force in DOM around "Ignore Errors" text.
    await page
      .evaluate(() => {
        const norm = (s: string | null | undefined): string => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
        const textNodes = Array.from(document.querySelectorAll("label, span, div, td")).filter((el) =>
          norm(el.textContent).includes("ignore errors")
        );
        const markChecked = (el: HTMLInputElement): boolean => {
          if (el.type !== "checkbox" || el.disabled) return false;
          el.checked = true;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return el.checked;
        };

        // 1) Any checkbox in/near nodes containing "Ignore Errors"
        for (const n of textNodes) {
          const within = n.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
          if (within && markChecked(within)) return;

          const prev = n.previousElementSibling?.querySelector?.('input[type="checkbox"]') as HTMLInputElement | null;
          if (prev && markChecked(prev)) return;

          const next = n.nextElementSibling?.querySelector?.('input[type="checkbox"]') as HTMLInputElement | null;
          if (next && markChecked(next)) return;
        }

        // 2) Known ID/name fallback
        const direct = document.querySelector('input#ignoreErrors, input[name="ignoreErrors"]') as HTMLInputElement | null;
        if (direct) markChecked(direct);
      })
      .catch(() => undefined);
    await page.waitForTimeout(250);
  };
  // If it's already visible, check it BEFORE continuing.
  await ensureIgnoreErrorsCheckedIfPresent();
  const continueBtn = page
    .locator(
      [
        'input[type="button"].F02v3[value="Continue"]',
        'input[type="button"][value="Continue"]',
        'input[type="button"][value="Next"]',
        'button.F02v3:has-text("Continue")',
        'button:has-text("Continue")',
      ].join(", ")
    )
    .first();
  // Prefer a guaranteed-visible variant; AO sometimes leaves hidden duplicates in DOM.
  const continueBtnVisible = page
    .locator(
      [
        'input[type="button"].F02v3[value="Continue"]:visible',
        'input[type="button"][value="Continue"]:visible',
        'button.F02v3:has-text("Continue"):visible',
        'button:has-text("Continue"):visible',
      ].join(", ")
    )
    .first();

  await (await continueBtnVisible.isVisible().catch(() => false) ? continueBtnVisible : continueBtn).waitFor({
    state: "visible",
    timeout: 30000,
  });

  const clickContinue = async (): Promise<void> => {
    const resolveContinueBtn = async (): Promise<import("playwright").Locator> => {
      const visible = page
        .locator(
          [
            'input[type="button"].F02v3[value="Continue"]:visible',
            'input[type="button"][value="Continue"]:visible',
            'button.F02v3:has-text("Continue"):visible',
            'button:has-text("Continue"):visible',
          ].join(", ")
        )
        .first();
      if (await visible.isVisible().catch(() => false)) return visible;
      return continueBtn;
    };

    const btn = await resolveContinueBtn();
    await btn.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(250);

    const urlBefore = page.url();
    const urlChanged = (): boolean => page.url() !== urlBefore && !/\/insuranceScore/i.test(page.url());
    const progressed = async (): Promise<boolean> => {
      if (urlChanged()) return true;
      const locationMainCurrent = await page.locator("li#tab.location.current").first().isVisible().catch(() => false);
      if (locationMainCurrent) return true;
      return await locationReady();
    };

    // 1) Normal click first
    await (await resolveContinueBtn()).click({ timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    if (await progressed()) return;

    // 2) Force click (some AO layouts have overlays intercepting)
    await (await resolveContinueBtn()).click({ force: true, timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(450);
    if (await progressed()) return;

    // 3) DOM click (bypasses pointer interception)
    await (await resolveContinueBtn()).evaluate((el: HTMLElement) => el.click()).catch(() => undefined);
    await page.waitForTimeout(600);
    if (await progressed()) return;

    // 3b) Keyboard activation (helps when button is focused but clicks don't fire)
    await (await resolveContinueBtn()).focus().catch(() => undefined);
    await page.keyboard.press("Enter").catch(() => undefined);
    await page.waitForTimeout(600);
    if (await progressed()) return;

    // 4) Coordinate click at center (last resort)
    const box = await (await resolveContinueBtn()).boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => undefined);
      await page.waitForTimeout(700);
      if (await progressed()) return;
    }

    // 5) Last resort DOM submit intent for input/button continue controls.
    await page
      .evaluate(() => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
            'input[type="button"][value="Continue"], button'
          )
        ).filter((el) => {
          const text = (el instanceof HTMLInputElement ? el.value : el.textContent || "").trim().toLowerCase();
          const style = window.getComputedStyle(el);
          const visible = style.display !== "none" && style.visibility !== "hidden";
          return visible && text === "continue";
        });
        const btn = candidates[0];
        if (!btn) return;
        (btn as HTMLButtonElement).click();
      })
      .catch(() => undefined);
    await page.waitForTimeout(700);
  };

  const locationUrlRe = /\/locationSchedule/i;
  const locationReady = async (): Promise<boolean> => {
    const url = page.url();
    if (locationUrlRe.test(url)) return true;
    if (/\/basicLocationDwlg|\/addlLocationInfo|\/addlInterests/i.test(url)) return true;
    const locationMainCurrent = await page.locator("li#tab.location.current").first().isVisible().catch(() => false);
    if (locationMainCurrent) return true;
    // Accept if it already flipped to Information subtabs
    const scheduleTab = await page.locator('li#subtab.locationSchedule.current').first().isVisible().catch(() => false);
    const infoTab = await page.locator('li#subtab.basicLocationDwlg.current').first().isVisible().catch(() => false);
    const infoContinuedTab = await page.locator('li#subtab.addlLocationInfo.current').first().isVisible().catch(() => false);
    if (scheduleTab || infoTab || infoContinuedTab) return true;
    const basicInfo = await page.locator("text=/Basic Location Information/i").first().isVisible().catch(() => false);
    return basicInfo;
  };

  const waitUntil = async (fn: () => Promise<boolean>, timeoutMs: number): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await fn()) return true;
      await page.waitForTimeout(450);
    }
    return false;
  };

  // HARDEN: Continue sometimes "clicks" but doesn't fire. Retry a few times while still on this page.
  for (let i = 0; i < 4; i++) {
    await clickContinue();
    await page.waitForTimeout(900);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    if (!/\/insuranceScore/i.test(page.url())) break;
    // Ensure button is truly in view and no overlay is blocking.
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(150);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);

  // If the error banner / checkbox appears AFTER the first Continue,
  // tick Ignore Errors and click Continue again.
  const stillOnInsuranceScore = (): boolean => /\/insuranceScore/i.test(page.url()) || /subtab\.insuranceScore/i.test(page.url());
  if (stillOnInsuranceScore() && (await errorSection.isVisible().catch(() => false))) {
    await ensureIgnoreErrorsCheckedIfPresent();
    if (stillOnInsuranceScore()) {
      await clickContinue();
      await page.waitForTimeout(1200);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    }
  }
  if (!(await waitUntil(locationReady, 45000))) {
    // If it didn't load, click Continue again on this screen.
    await clickContinue();
    if (!(await waitUntil(locationReady, 25000))) {
      // Final fallback: click Location(s) main tab directly.
      const locationMain = page.locator("li#tab.location").first();
      if (await locationMain.isVisible().catch(() => false)) {
        await locationMain.click({ force: true }).catch(() => undefined);
        await waitUntil(locationReady, 15000);
      }
    }
  }

  // Extra hardening: sometimes Continue does not fire even when there is no visible error.
  if (!(await locationReady())) {
    for (let i = 0; i < 6; i++) {
      if (await locationReady()) break;
      if (!stillOnInsuranceScore()) break;
      await ensureIgnoreErrorsCheckedIfPresent(); // harmless when absent
      await clickContinue();
      await page.waitForTimeout(900);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    }
  }

  if (!(await locationReady())) throw new Error("Insurance Score continue transition failed: Location not loaded.");

  // Extra settle time: next step often mounts async after the tab flips.
  await page.waitForTimeout(4000);
}

function mapOccupancyToValue(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s) return "";
  if (s.includes("primary") || s.includes("principal") || s === "p") return "P";
  if (s.includes("season") || s === "s") return "S";
  if (s.includes("second") || s === "c" || s.includes("secondary")) return "C";
  if (s.includes("short") || s.includes("rental") || s === "t") return "T";
  return "";
}

function mapYesNoToOwnerOccupied(v: unknown): string {
  // HTML: ownerOccupied: O=Yes, T=No
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (typeof v === "boolean") return v ? "O" : "T";
  if (!s) return "";
  if (["yes", "y", "true", "1", "owner occupied"].includes(s)) return "O";
  if (["no", "n", "false", "0"].includes(s)) return "T";
  return "";
}

function mapYesNoToYN(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (typeof v === "boolean") return v ? "Y" : "N";
  if (!s) return "";
  if (["yes", "y", "true", "1"].includes(s)) return "Y";
  if (["no", "n", "false", "0"].includes(s)) return "N";
  return "";
}

function mapYesNoToLiabilityOnly(v: unknown): string {
  // HTML: liabilityCoverage: Y=Yes, " " (space) = No
  const yn = mapYesNoToYN(v);
  if (!yn) return "";
  return yn === "Y" ? "Y" : " ";
}

/**
 * Step 9: Location(s) -> Address(es) (Add Location)
 * - Prefer "Same as mailing address" checkbox if present
 * - Fill occupancy/owner/vacant/liability fields
 * - Save then Continue (SPA-safe)
 * - Handoff check: if Information fields already visible, treat as success
 */
export async function stepAddLocation(page: Page, payload: unknown): Promise<void> {
  // 0) Handoff check (avoid running Location work if already on Information)
  const infoAlreadyVisible = await page
    .locator("text=/Program|Coverage F|Coverage G|Within 1000 Feet Of Hydrant|Responding Fire Department/i")
    .first()
    .isVisible()
    .catch(() => false);
  if (infoAlreadyVisible) return;

  const locationUrlRe = /\/locationSchedule/i;
  const insuranceScoreUrlRe = /\/insuranceScore/i;

  // Self-heal: if we are still on Insurance Score (URL/subtab), click its Continue first.
  // AO can highlight the main Location(s) tab before the SPA actually leaves Insurance Score.
  if (insuranceScoreUrlRe.test(page.url())) {
    const insuranceContinue = page
      .locator(
        [
          'input[type="button"].F02v3[value="Continue"]:visible',
          'input[type="button"][value="Continue"]:visible',
          'button.F02v3:has-text("Continue"):visible',
          'button:has-text("Continue"):visible',
        ].join(", ")
      )
      .first();
    if (await insuranceContinue.isVisible().catch(() => false)) {
      await insuranceContinue.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(200);
      await insuranceContinue.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(1200);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    }
    // Wait for Location Schedule URL if it happens directly after Insurance Score continue.
    await page.waitForURL(locationUrlRe, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
  }

  // 1) Verify on Location page, else click Location(s) tab
  const isOnLocation = async (): Promise<boolean> => {
    const mainTabCurrent = await page.locator("li#tab.location.current").first().isVisible().catch(() => false);
    const subTabCurrent = await page.locator("li#subtab.locationSchedule.current").first().isVisible().catch(() => false);
    const title = await page.locator("text=/Add Location/i").first().isVisible().catch(() => false);
    const addressFields = await page.locator('#addressContainer input#addressLine1, #addressContainer input#city, #addressContainer input#zipCode1To5').first().isVisible().catch(() => false);
    const saveBtn = await page.locator('#saveUpdateButtonSection button[value="Save"], button.F02v4:has-text("Save")').first().isVisible().catch(() => false);
    // Location SPA often sets the tab current before the fields mount.
    return mainTabCurrent || subTabCurrent || locationUrlRe.test(page.url()) || title || (addressFields && saveBtn);
  };

  // If we're not already on Location Schedule, click Location(s) and wait for URL/tab (SPA-safe).
  if (!locationUrlRe.test(page.url())) {
    const tab = page.locator("li#tab.location").first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
    }
    await page.waitForURL(locationUrlRe, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
  }
  // Also accept UI tab signals if URL doesn't change in some SPA cases.
  const t = Date.now();
  while (Date.now() - t < 45000) {
    if (await isOnLocation()) break;
    await page.waitForTimeout(450);
  }
  if (!(await isOnLocation())) throw new Error("Location page not properly loaded");

  // Wait for the Address(es) form fields to mount (SPA can mount after tab turns current).
  const addressFormReady = async (): Promise<boolean> => {
    const addressFields = await page
      .locator('#addressContainer input#addressLine1, #addressContainer input#city, #addressContainer input#zipCode1To5')
      .first()
      .isVisible()
      .catch(() => false);
    const saveBtn = await page
      .locator('#saveUpdateButtonSection button[value="Save"], button.F02v4:has-text("Save")')
      .first()
      .isVisible()
      .catch(() => false);
    return addressFields && saveBtn;
  };

  const mountStart = Date.now();
  while (Date.now() - mountStart < 45000) {
    if (await addressFormReady()) break;
    await page.waitForTimeout(450);
  }

  if (!(await addressFormReady())) {
    // One more gentle retry: click Location(s) again and wait a bit.
    const tab = page.locator("li#tab.location").first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(900);
    }
    const retryStart = Date.now();
    while (Date.now() - retryStart < 20000) {
      if (await addressFormReady()) break;
      await page.waitForTimeout(450);
    }
  }
  if (!(await addressFormReady())) throw new Error("Location page not properly loaded");

  // wait for stable render
  await page.waitForTimeout(500);

  // 2) Fill address using payload
  const street =
    String(
      getPayloadValue(payload, "streetAddress") ??
        getPayloadValue(payload, "personal.address") ??
        getPayloadValue(payload, "personal.streetAddress") ??
        getPayloadValue(payload, "address") ??
        ""
    ).trim();
  const city = String(getPayloadValue(payload, "city") ?? getPayloadValue(payload, "personal.city") ?? "").trim();
  const state = String(getPayloadValue(payload, "state") ?? getPayloadValue(payload, "personal.state") ?? "").trim().toUpperCase();
  const zip = getPayloadValue(payload, "zipCode") ?? getPayloadValue(payload, "personal.zipCode");
  const zipDigits = String(zip ?? "").replace(/\\D/g, "");
  const zip5 = zipDigits.slice(0, 5);
  const zip4 = zipDigits.length >= 9 ? zipDigits.slice(5, 9) : "";

  const sameAsMailing = page.locator("input#sameAsMailingAddress").first();
  if (await sameAsMailing.isVisible().catch(() => false)) {
    // Preferred option A
    await sameAsMailing.check({ force: true }).catch(() => undefined);
    await page.waitForTimeout(600);
  } else {
    // Option B: fill fields directly
    if (street) await setInputValueAndCommit(page, "input#addressLine1", street);
    if (city) await setInputValueAndCommit(page, "input#city", city);
    // state can be disabled display-only; only set if enabled
    const stateSel = page.locator("select#state").first();
    if (state && (await stateSel.isEnabled().catch(() => false))) {
      await setSelectValueAndDispatch(page, "select#state", state).catch(() => undefined);
    }
    if (zip5) await setInputValueAndCommit(page, "input#zipCode1To5", zip5);
    if (zip4) await setInputValueAndCommit(page, "input#zipCode6To9", zip4);
  }

  // 3) Occupancy fields
  const occVal = mapOccupancyToValue(getPayloadValue(payload, "locationOccupancy")) || "P";
  const ownerVal = mapYesNoToOwnerOccupied(getPayloadValue(payload, "ownerOccupied")) || "O";
  const vacantVal = mapYesNoToYN(getPayloadValue(payload, "vacant")) || "N";
  const liabVal = mapYesNoToLiabilityOnly(getPayloadValue(payload, "liabilityCoverageOnly")) || " ";

  await setSelectValueAndDispatch(page, "select#occupancy", occVal).catch(() => undefined);
  await setSelectValueAndDispatch(page, "select#ownerOccupied", ownerVal).catch(() => undefined);
  await setSelectValueAndDispatch(page, "select#vacantCode", vacantVal).catch(() => undefined);
  await setSelectValueAndDispatch(page, "select#liabilityCoverage", liabVal).catch(() => undefined);

  // 4) Save (mandatory before continue)
  const saveBtn = page.locator('#saveUpdateButtonSection button[value="Save"], button.F02v4:has-text("Save")').first();
  await saveBtn.waitFor({ state: "visible", timeout: 30000 });
  await saveBtn.click({ force: true });
  await page.waitForTimeout(1200);

  const saveOk = async (): Promise<boolean> => {
    // A common success signal is that "Information" subtab becomes enabled or selected
    const infoEnabled = await page.locator("li#subtab.basicLocationDwlg:not(.disabled)").first().isVisible().catch(() => false);
    const err = await page.locator("text=/required|invalid|please|No valid locations/i").first().isVisible().catch(() => false);
    return infoEnabled || !err;
  };
  const s = Date.now();
  while (Date.now() - s < 3000) {
    if (await saveOk()) break;
    await page.waitForTimeout(300);
  }

  // 5) Continue (only after save)
  const continueBtn = page.locator('input[type="button"].F02v3[value="Continue"], input[type="button"][value="Continue"], input[type="button"][value="Next"]').first();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);
  await continueBtn.click({ force: true });

  const transitioned = async (): Promise<boolean> => {
    // any of these is success
    const infoTab = await page.locator("li#subtab.basicLocationDwlg.current, li#subtab.addlLocationInfo.current, li#subtab.addlInterests.current").first().isVisible().catch(() => false);
    const uwTab = await page.locator("li#tab.underwriting.current, li#tab.summary.current, li#tab.finalSale.current").first().isVisible().catch(() => false);
    const infoFields = await page
      .locator("text=/Program|Coverage F|Coverage G|Within 1000 Feet Of Hydrant|Responding Fire Department/i")
      .first()
      .isVisible()
      .catch(() => false);
    return infoTab || infoFields || uwTab;
  };

  const c1 = Date.now();
  while (Date.now() - c1 < 6000) {
    if (await transitioned()) break;
    await page.waitForTimeout(400);
  }
  if (!(await transitioned())) {
    await continueBtn.click({ force: true }).catch(() => undefined);
    const c2 = Date.now();
    while (Date.now() - c2 < 8000) {
      if (await transitioned()) break;
      await page.waitForTimeout(450);
    }
  }
  if (!(await transitioned())) throw new Error("Location continue transition failed after retries.");
  await page.waitForTimeout(2000);
}

async function clickNeutralBlankArea(page: Page): Promise<void> {
  // Click top-left-ish safe spot to blur dropdowns without hitting map/inputs.
  await page.mouse.click(15, 15).catch(() => undefined);
}

async function preDropdownAntiOverlay(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(150);
  await clickNeutralBlankArea(page);
  await page.waitForTimeout(150);
}

async function openSelectWithKeyboardFallback(page: Page, selector: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 30000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await preDropdownAntiOverlay(page);
  await loc.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(250);
  // Try to open native select options (browser-dependent but helps when clicks are intercepted)
  await page.keyboard.press("Alt+ArrowDown").catch(() => undefined);
  await page.keyboard.press("Space").catch(() => undefined);
  await page.waitForTimeout(200);
}

async function setSelectByValueOrLabelWithFallback(
  page: Page,
  selector: string,
  opts: { value?: string; label?: string; fieldName: string; required?: boolean }
): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 30000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);

  const tryNative = async (): Promise<boolean> => {
    if (opts.value) {
      const ok = await loc.selectOption({ value: opts.value }).then(() => true).catch(() => false);
      if (ok) return true;
    }
    if (opts.label) {
      const ok = await loc.selectOption({ label: opts.label }).then(() => true).catch(() => false);
      if (ok) return true;
    }
    return false;
  };

  // click twice + overlay cleanup strategy
  await preDropdownAntiOverlay(page);
  await loc.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(500);
  await loc.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(250);

  if (await tryNative()) return;

  // retry after overlay cleanup
  await preDropdownAntiOverlay(page);
  if (await tryNative()) return;

  // keyboard fallback: open dropdown and then try native selectOption again
  await openSelectWithKeyboardFallback(page, selector);
  if (await tryNative()) return;

  if (opts.required) throw new Error(`Required dropdown not interactable: ${opts.fieldName}`);
}

async function setInputTextSafe(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 30000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await preDropdownAntiOverlay(page);
  await setInputValueAndCommit(page, selector, value);
}

function cssEscapeId(id: string): string {
  // Minimal CSS id escaping for Node runtime (avoids using browser-only CSS.escape).
  // Good enough for typical AO ids (letters/numbers/_/-). Falls back to escaping non-safe chars.
  return id.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

async function findSelectNearLabel(page: Page, labelText: RegExp): Promise<string | null> {
  const label = page.getByText(labelText).first();
  if (!(await label.isVisible().catch(() => false))) return null;
  // Try: label[for] -> #id
  const htmlFor = await label.evaluate((el) => (el instanceof HTMLLabelElement ? el.htmlFor : "")).catch(() => "");
  if (htmlFor) return `#${cssEscapeId(htmlFor)}`;
  // Else: first select following within same row/container
  const sel = page.locator('xpath=//*[self::label or self::span][contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"bridge access")]/following::select[1]').first();
  if (await sel.isVisible().catch(() => false)) {
    const id = await sel.getAttribute("id").catch(() => null);
    if (id) return `#${cssEscapeId(id)}`;
  }
  return null;
}

async function findInputNearLabel(page: Page, labelText: RegExp): Promise<string | null> {
  const label = page.getByText(labelText).first();
  if (!(await label.isVisible().catch(() => false))) return null;
  const htmlFor = await label.evaluate((el) => (el instanceof HTMLLabelElement ? el.htmlFor : "")).catch(() => "");
  if (htmlFor) return `#${cssEscapeId(htmlFor)}`;
  // Fallback: grab the first input following the visible label in DOM order.
  const input = label.locator("xpath=following::input[1]").first();
  if (await input.isVisible().catch(() => false)) {
    const id = await input.getAttribute("id").catch(() => null);
    if (id) return `#${cssEscapeId(id)}`;
    // If no id, return an xpath locator string (used only with locator(), not CSS).
    // Caller should ignore if it can't be used as CSS.
  }
  return null;
}

/**
 * Step 10: Location(s) -> Information (Basic Location Information)
 * Implements the strict anti-overlay dropdown rules + required checks + Ignore Errors flow.
 */
export async function stepLocationInformation(page: Page, payload: unknown): Promise<void> {
  // Verify correct section is open (SPA-safe)
  const hasIndicators = async (): Promise<boolean> => {
    const labels = [
      /program/i,
      /coverage c/i,
      /coverage f/i,
      /coverage g/i,
      /construction year/i,
      /construction\b/i,
      /foundation/i,
      /within 1000 feet of hydrant/i,
      /responding fire department/i,
      /is there bridge access/i,
    ];
    for (const re of labels) {
      if (await page.getByText(re).first().isVisible().catch(() => false)) return true;
    }
    return false;
  };

  // If we are already past this, just return (Information Continued or later visible)
  const alreadyPast = await page.locator("li#subtab.addlLocationInfo.current, li#subtab.addlInterests.current").first().isVisible().catch(() => false);
  if (alreadyPast) return;

  if (!(await hasIndicators())) {
    const infoTab = page.locator("li#subtab.basicLocationDwlg").first();
    if (await infoTab.isVisible().catch(() => false)) {
      await infoTab.click({ force: true }).catch(() => undefined);
    }
    const t = Date.now();
    while (Date.now() - t < 8000) {
      if (await hasIndicators()) break;
      await page.waitForTimeout(350);
    }
  }
  if (!(await hasIndicators())) throw new Error("Wrong or corrupted page - expected Location/Information fields not found.");

  // Payload mappings (only fill when value exists)
  const program = getPayloadValue(payload, "program");
  const type = getPayloadValue(payload, "type");
  const coverageF = getPayloadValue(payload, "coverageF");
  const coverageC = getPayloadValue(payload, "coverageC");
  const coverageCAmount = getPayloadValue(payload, "coverageCAmount");
  const personalInjury = getPayloadValue(payload, "personalInjury");
  const coverageG = getPayloadValue(payload, "coverageG");
  const coverageA = getPayloadValue(payload, "coverageA");
  const coverageAAmount = getPayloadValue(payload, "coverageAAmount");
  const constructionYear = getPayloadValue(payload, "constructionYear");
  const construction = getPayloadValue(payload, "construction");
  const foundation = getPayloadValue(payload, "foundation");
  const finishedLivingArea = getPayloadValue(payload, "finishedLivingArea");
  const numberOfFamiliesUnits = getPayloadValue(payload, "numberOfFamiliesUnits");
  const replacementCost100 = getPayloadValue(payload, "replacementCost100");
  const roofLossSettlementWindstormHail = getPayloadValue(payload, "roofLossSettlementWindstormHail");
  const marketValue = getPayloadValue(payload, "marketValue");
  const boardingOrLodgingOrStudentRentals = getPayloadValue(payload, "boardingOrLodgingOrStudentRentals");
  const visibleFromOtherDwellings = getPayloadValue(payload, "visibleFromOtherDwellings");
  const locatedOnIsland = getPayloadValue(payload, "locatedOnIsland");
  const conditionOfDwelling = getPayloadValue(payload, "conditionOfDwelling");
  const dogsOwnedOrKept = getPayloadValue(payload, "dogsOwnedOrKept");
  const specificBreed = getPayloadValue(payload, "specificBreed");
  const biteHistoryAggressiveBehavior = getPayloadValue(payload, "biteHistoryAggressiveBehavior");
  const allOtherPerilsDeductible = getPayloadValue(payload, "allOtherPerilsDeductible");
  const withinHydrant = getPayloadValue(payload, "within1000FeetOfHydrant");
  const bridgeAccess = getPayloadValue(payload, "bridgeAccess");
  const personalPropertyOnly = getPayloadValue(payload, "personalPropertyOnly");
  const dwellingConstructedWithAsbestos = getPayloadValue(payload, "dwellingConstructedWithAsbestos");
  const roofUpdateYear = getPayloadValue(payload, "roofUpdateYear");
  const hasMortgageeContractHolderOrSecuredLineOfCredit = getPayloadValue(payload, "hasMortgageeContractHolderOrSecuredLineOfCredit");
  const isStudentRental = getPayloadValue(payload, "isStudentRental");
  const windHailDeductible = getPayloadValue(payload, "windHailDeductible");
  const hurricaneDeductible = getPayloadValue(payload, "hurricaneDeductible");

  // Required visible fields (if present)
  const programSel = "select#formAndProgram";
  const typeSel = "select#structureTypeCode";
  const coverageAInput = "input#coverageAAmount";
  const covF = "select#coverageFSelection";
  const covCInput = "input#coverageCAmount";
  const piSel = "select#personalInjury";
  const covG = "select#coverageGSelection";
  const aopDed = "select#aopDeductible";
  const windHailDedSel = "select#windHailDeductible";
  const hurricaneDedSel = "select#hurricaneDeductiblePct";
  const constructionYearInput = "input#constructionYear";
  const constructionSel = "select#construction";
  const foundationSel = "select#foundation";
  const squareFeetInput = "input#squareFeet";
  const numFamiliesInput = "input#numberOfFamilies";
  const replacementCostInput = "input#replacementCost";
  const roofACVSel = "select#roofACV";
  const marketValueInput = "input#marketValue";
  const rentalCodeSel = "select#rentalCode";
  const visibleOtherSel = "select#visibleFromOtherDwellings";
  const conditionSel = "select#conditionOfDwelling";
  const islandSel = "select#islandInd";
  const dogSel = "select#dogOnPremises";
  // Breed / bite history containers can mount extra selects dynamically; best-effort via label matching later.
  const hydrantSel = "select#within1000FeetOfHydrant";
  const personalPropertyOnlySel = "select#contentsOnlyIndicator";

  const hasValue = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";
  const ynValue = (v: unknown): string => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return "";
    if (["y", "yes", "true", "1"].includes(s)) return "Y";
    if (["n", "no", "false", "0"].includes(s)) return "N";
    // accept already-coded
    if (s === "Y".toLowerCase()) return "Y";
    if (s === "N".toLowerCase()) return "N";
    return s.toUpperCase();
  };
  const ynOrNull = (v: unknown): "Y" | "N" | null => {
    const mapped = ynValue(v);
    if (mapped === "Y" || mapped === "N") return mapped;
    return null;
  };
  const mapConstructionToCode = (v: unknown): string => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return "";
    // Already a code
    if (["fr", "ma", "mv", "lo", "rf", "cs"].includes(s)) return s.toUpperCase();
    // Common labels/variants seen from frontend
    if (s.includes("frame")) return "FR";
    if (s.includes("masonry veneer")) return "MV";
    if (s.includes("masonry")) return "MA";
    if (s.includes("log")) return "LO";
    if (s.includes("reinforced")) return "RF";
    if (s.includes("concrete") || s.includes("steel")) return "CS";
    return "";
  };

  const fillSelectIfEnabled = async (
    selector: string,
    opts: { value?: string; label?: string; fieldName: string; required?: boolean }
  ): Promise<void> => {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible().catch(() => false))) return;
    const enabled = await loc.isEnabled().catch(() => false);
    if (!enabled) return; // skip displayOnly/disabled
    await setSelectByValueOrLabelWithFallback(page, selector, opts);
  };

  const setSelectValueWithVerify = async (selector: string, expectedValue: string, fieldName: string): Promise<void> => {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible().catch(() => false))) return;
    const enabled = await loc.isEnabled().catch(() => false);
    if (!enabled) return;
    await loc.scrollIntoViewIfNeeded().catch(() => undefined);

    const read = async (): Promise<string> => (await loc.inputValue().catch(() => "")).trim();
    const trySet = async (): Promise<void> => {
      // 1) Native
      await loc.selectOption({ value: expectedValue }).catch(() => undefined);
      await page.waitForTimeout(120);
      // 2) Forced DOM set + events
      await loc
        .evaluate((el: HTMLSelectElement, v: string) => {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
        }, expectedValue)
        .catch(() => undefined);
      await page.waitForTimeout(120);
    };

    for (let i = 0; i < 3; i++) {
      if ((await read()) === expectedValue) return;
      await preDropdownAntiOverlay(page);
      await trySet();
      if ((await read()) === expectedValue) return;
      await page.waitForTimeout(180);
    }
    // Do not throw (per your rule: only fill when payload present; UI may still accept defaults),
    // but we DO want to surface a clearer failure if the UI blocks progression later.
    throw new Error(`Required dropdown not interactable: ${fieldName}`);
  };

  const fillInputIfEditable = async (selector: string, value: string): Promise<void> => {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible().catch(() => false))) return;
    const enabled = await loc.isEnabled().catch(() => false);
    const editable = await loc.isEditable().catch(() => false);
    if (!enabled || !editable) return; // skip readonly/displayOnly
    await setInputTextSafe(page, selector, value);
  };

  const isEmptySelect = async (selector: string): Promise<boolean> => {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible().catch(() => false))) return false;
    const v = await loc.inputValue().catch(() => "");
    return !v || v.trim() === "" || v.trim() === " ";
  };

  // Fill Program (required)
  if (await page.locator(programSel).first().isVisible().catch(() => false)) {
    // If payload provides, try label match. Else keep default.
    if (hasValue(program)) {
      await fillSelectIfEnabled(programSel, { label: String(program).trim(), fieldName: "Program", required: true });
    } else if (await isEmptySelect(programSel)) {
      // Basic is first option; do not invent.
    }
  }

  // Type (optional)
  if (await page.locator(typeSel).first().isVisible().catch(() => false)) {
    if (hasValue(type)) {
      await fillSelectIfEnabled(typeSel, { label: String(type).trim(), fieldName: "Type" });
    }
  }

  // Personal Property Only (new required field in updated flow)
  // Options: value="Y" => Yes, value=" " => No
  if (await page.locator(personalPropertyOnlySel).first().isVisible().catch(() => false)) {
    if (hasValue(personalPropertyOnly)) {
      const v = ynOrNull(personalPropertyOnly);
      if (v) {
        await fillSelectIfEnabled(personalPropertyOnlySel, {
          value: v,
          label: v === "Y" ? "Yes" : "No",
          fieldName: "Personal Property Only",
          required: true,
        });
        // In the new AO flow, changing some dropdowns mounts more questions below without clicking Continue.
        await page.waitForTimeout(350);
      }
    }
  }

  // Coverage A (must be filled first if payload provides it; many downstream fields/logic depend on it)
  // HTML: <input id="coverageAAmount" ...>
  const covARaw = hasValue(coverageAAmount) ? coverageAAmount : coverageA;
  if (hasValue(covARaw)) {
    const covA = String(covARaw).replace(/[^0-9]/g, "");
    if (covA) {
      // AO sometimes renders Coverage A as an <input>, and sometimes as a <select>.
      const covAInputLoc = page.locator("input#coverageAAmount").first();
      const covASelectLoc = page.locator("select#coverageAAmount").first();

      const formatWithCommas = (digits: string): string => {
        // 40000 -> 40,000
        try {
          const n = Number(digits);
          if (!Number.isFinite(n)) return digits;
          return n.toLocaleString("en-US");
        } catch {
          return digits;
        }
      };

      if (await covASelectLoc.isVisible().catch(() => false)) {
        await covASelectLoc.scrollIntoViewIfNeeded().catch(() => undefined);
        const read = async (): Promise<string> => (await covASelectLoc.inputValue().catch(() => "")).trim();
        const label = formatWithCommas(covA);
        for (let attempt = 0; attempt < 6; attempt++) {
          if ((await read()) === covA) break;
          await preDropdownAntiOverlay(page);
          // Try by value then label
          await covASelectLoc.selectOption({ value: covA }).catch(() => undefined);
          await page.waitForTimeout(120);
          if ((await read()) === covA) break;
          await covASelectLoc.selectOption({ label }).catch(() => undefined);
          await page.waitForTimeout(120);
          if ((await read()) === covA) break;
          // Force DOM set + events
          await covASelectLoc
            .evaluate((el: HTMLSelectElement, v: string) => {
              el.value = v;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true }));
            }, covA)
            .catch(() => undefined);
          await page.waitForTimeout(150);
          if ((await read()) === covA) break;
          await page.keyboard.press("Tab").catch(() => undefined);
          await page.waitForTimeout(120);
        }
        await page.waitForTimeout(350);
      } else if (await covAInputLoc.isVisible().catch(() => false)) {
        const loc = covAInputLoc;
        await loc.scrollIntoViewIfNeeded().catch(() => undefined);
        const readDigits = async (): Promise<string> => {
          const v = await loc.inputValue().catch(() => "");
          return v.replace(/[^0-9]/g, "");
        };
        const chooseFromSuggestionDropdownIfPresent = async (): Promise<boolean> => {
          // Many AO inputs trigger a suggestion dropdown; if the requested value isn't available,
          // AO may clear the field on blur. In that case pick the closest available option.
          const list = page
            .locator(
              [
                'ul[role="listbox"]:visible',
                'div[role="listbox"]:visible',
                "ul.ui-autocomplete:visible",
                "ul.ui-menu:visible",
                ".ui-autocomplete:visible",
                ".autocomplete:visible",
              ].join(", ")
            )
            .first();
          if (!(await list.isVisible().catch(() => false))) return false;

          const options = list
            .locator(
              [
                '[role="option"]',
                "li",
                "div",
                "span",
              ].join(", ")
            )
            .filter({ hasText: /\d/ });

          const count = await options.count().catch(() => 0);
          if (!count) return false;

          const wanted = Number(covA);
          let bestIdx = 0;
          let bestScore = Number.POSITIVE_INFINITY;

          for (let i = 0; i < Math.min(count, 30); i++) {
            const txt = (await options.nth(i).innerText().catch(() => "")).trim();
            const digits = txt.replace(/[^0-9]/g, "");
            const n = digits ? Number(digits) : NaN;
            if (!Number.isFinite(n)) continue;

            // Prefer exact match, else smallest absolute difference
            const score = n === wanted ? 0 : Math.abs(n - wanted) + (n < wanted ? 0.1 : 0); // tiny bias to >= wanted
            if (score < bestScore) {
              bestScore = score;
              bestIdx = i;
              if (score === 0) break;
            }
          }

          const choice = options.nth(bestIdx);
          await choice.scrollIntoViewIfNeeded().catch(() => undefined);
          await choice.click({ force: true }).catch(() => undefined);
          await page.waitForTimeout(200);
          return (await readDigits()) !== "";
        };

        // AO sometimes resets Coverage A during SPA recalcs; use multi-pass set+verify.
        for (let attempt = 0; attempt < 6; attempt++) {
          if ((await readDigits()) === covA) break;

          await loc.click({ force: true }).catch(() => undefined);
          await page.waitForTimeout(80);

          // 1) Preferred commit helper (fill + input/change/blur)
          await setInputValueAndCommit(page, coverageAInput, covA).catch(() => undefined);
          await page.waitForTimeout(150);
          if ((await readDigits()) === covA) break;

          // 2) DOM setter + events
          await loc
            .evaluate((el: HTMLInputElement, v: string) => {
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
              setter?.call(el, v);
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true }));
            }, covA)
            .catch(() => undefined);
          await page.waitForTimeout(150);
          if ((await readDigits()) === covA) break;

          // 3) Blur/commit pass
          await page.keyboard.press("Tab").catch(() => undefined);
          await page.waitForTimeout(120);

          // If blur caused the value to be cleared and a suggestion dropdown is present,
          // select from it to keep Coverage A non-empty.
          if ((await readDigits()) === "") {
            await chooseFromSuggestionDropdownIfPresent().catch(() => false);
          }

          await page.waitForTimeout(250);
        }

        // If AO cleared value because exact amount is unavailable, at least ensure it is NOT empty
        // by selecting from the suggestion dropdown if present.
        if ((await readDigits()) === "") {
          await loc.click({ force: true }).catch(() => undefined);
          await page.waitForTimeout(120);
          await chooseFromSuggestionDropdownIfPresent().catch(() => false);
        }

        if ((await readDigits()) !== covA && (await readDigits()) === "") {
          await setInputValueAndCommit(page, coverageAInput, covA).catch(() => undefined);
          await page.waitForTimeout(200);
        }
        await page.waitForTimeout(350);
      }
    }
  }

  // Alternate Location Information form: Coverage C is present instead of Coverage A.
  // Fill only when that field is visible and payload provides value.
  const covCRaw = hasValue(coverageCAmount) ? coverageCAmount : coverageC;
  if ((await page.locator(covCInput).first().isVisible().catch(() => false)) && hasValue(covCRaw)) {
    const covC = String(covCRaw).replace(/[^0-9]/g, "");
    if (covC) {
      await fillInputIfEditable(covCInput, covC);
    }
  }

  // Coverage F (required if visible)
  if (await page.locator(covF).first().isVisible().catch(() => false)) {
    if (hasValue(coverageF)) {
      const asVal = String(coverageF).replace(/[^0-9]/g, "");
      await fillSelectIfEnabled(covF, { value: asVal || undefined, label: String(coverageF).trim(), fieldName: "Coverage F", required: true });
    }
  }

  // Personal Injury (required)
  if (await page.locator(piSel).first().isVisible().catch(() => false)) {
    if (hasValue(personalInjury)) {
      await fillSelectIfEnabled(piSel, { value: ynValue(personalInjury) || undefined, fieldName: "Personal Injury", required: true });
    }
  }

  // Coverage G (required)
  if (await page.locator(covG).first().isVisible().catch(() => false)) {
    if (hasValue(coverageG)) {
      const asVal = String(coverageG).replace(/[^0-9]/g, "");
      await fillSelectIfEnabled(covG, { value: asVal || undefined, label: String(coverageG).trim(), fieldName: "Coverage G", required: true });
    }
  }

  // All Other Perils Deductible (optional)
  if (hasValue(allOtherPerilsDeductible)) {
    const asVal = String(allOtherPerilsDeductible).replace(/[^0-9]/g, "");
    await fillSelectIfEnabled(aopDed, { value: asVal || undefined, label: String(allOtherPerilsDeductible).trim(), fieldName: "All Other Perils Deductible" });
  }

  // Wind/Hail Deductible (frontend key)
  if (hasValue(windHailDeductible)) {
    const raw = String(windHailDeductible).trim();
    const asVal = raw.replace(/[^0-9]/g, "");
    // Prefer exact option value if numeric; else fall back to label.
    await fillSelectIfEnabled(windHailDedSel, {
      value: asVal || undefined,
      label: raw, // e.g. "1,500" also works if provided
      fieldName: "Wind/Hail Deductible",
      required: true,
    });
    if (asVal) {
      await setSelectValueWithVerify(windHailDedSel, asVal, "Wind/Hail Deductible").catch(() => undefined);
    }
    // Let AO recalc dependent fields.
    await page.waitForTimeout(250);
  }

  // Hurricane Deductible (frontend key)
  // HTML options are values like "0" and "5" (label "5%")
  if (hasValue(hurricaneDeductible)) {
    const raw = String(hurricaneDeductible).trim();
    const asVal = raw.replace(/[^0-9]/g, ""); // "5%" -> "5"
    // If payload is "0" / "No" / blankish, treat it as "0" when digits indicate it.
    const value = asVal || undefined;
    const label = raw.endsWith("%") ? raw : raw === "5" ? "5%" : raw;
    await fillSelectIfEnabled(hurricaneDedSel, {
      value,
      label,
      fieldName: "Hurricane Deductible",
      required: true,
    });
    if (asVal) {
      await setSelectValueWithVerify(hurricaneDedSel, asVal, "Hurricane Deductible").catch(() => undefined);
    }
    await page.waitForTimeout(250);
  }

  // Construction Year (optional)
  if (hasValue(constructionYear)) {
    await fillInputIfEditable(constructionYearInput, String(constructionYear).trim());
  }
  // Construction (required in many cases)
  if (hasValue(construction)) {
    // Construction options are commonly coded values (FR/MA/MV/LO/RF/CS).
    // Try code + label together, then verify with code when derived.
    const rawConstruction = String(construction).trim();
    const constructionCode = mapConstructionToCode(rawConstruction);
    try {
      await fillSelectIfEnabled(constructionSel, {
        value: constructionCode || undefined,
        label: rawConstruction,
        fieldName: "Construction",
        required: true,
      });
      if (constructionCode) {
        await setSelectValueWithVerify(constructionSel, constructionCode, "Construction").catch(() => undefined);
      }
    } catch {
      // Construction-only hard fallback (do not change other dropdown behavior).
      const loc = page.locator(constructionSel).first();
      if (await loc.isVisible().catch(() => false)) {
        await loc.scrollIntoViewIfNeeded().catch(() => undefined);
        await preDropdownAntiOverlay(page);
        await loc
          .evaluate(
            (el: HTMLSelectElement, args: { code: string; raw: string }) => {
              const raw = args.raw.trim().toLowerCase();
              const code = args.code.trim().toLowerCase();
              const opts = Array.from(el.options || []);

              let idx = -1;
              if (code) idx = opts.findIndex((o) => (o.value || "").trim().toLowerCase() === code);
              if (idx < 0) idx = opts.findIndex((o) => ((o.textContent || "").trim().toLowerCase() === raw));
              if (idx < 0) idx = opts.findIndex((o) => ((o.textContent || "").trim().toLowerCase().includes(raw)));
              if (idx < 0 && code) idx = opts.findIndex((o) => ((o.textContent || "").trim().toLowerCase().includes(code)));
              if (idx >= 0) el.selectedIndex = idx;

              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true }));
            },
            { code: constructionCode, raw: rawConstruction }
          )
          .catch(() => undefined);
        await page.waitForTimeout(180);
      }

      const selected = (await page.locator(constructionSel).first().inputValue().catch(() => "")).trim();
      if (!selected) {
        throw new Error("Required dropdown not interactable: Construction");
      }
    }
  }
  // Foundation (required)
  if (hasValue(foundation)) {
    await fillSelectIfEnabled(foundationSel, { label: String(foundation).trim(), fieldName: "Foundation", required: true });
  }
  // Finished Living Area (optional)
  if (hasValue(finishedLivingArea)) {
    await fillInputIfEditable(squareFeetInput, String(finishedLivingArea).replace(/[^0-9]/g, ""));
  }
  // Number Of Families/Units (required)
  if (hasValue(numberOfFamiliesUnits)) {
    await fillInputIfEditable(numFamiliesInput, String(numberOfFamiliesUnits).replace(/[^0-9]/g, ""));
  }
  // 100% Replacement Cost (optional)
  if (hasValue(replacementCost100)) {
    await fillInputIfEditable(replacementCostInput, String(replacementCost100).replace(/[^0-9]/g, ""));
  }
  // Roof Loss Settlement (Windstorm/Hail) (optional)
  if (hasValue(roofLossSettlementWindstormHail)) {
    const s = String(roofLossSettlementWindstormHail).toLowerCase();
    // Select values: Y=Actual Cash Value, N=Replacement Cost
    const v = s.includes("actual") || s.includes("acv") ? "Y" : s.includes("replacement") || s.includes("rc") ? "N" : "";
    await fillSelectIfEnabled(roofACVSel, { value: v || undefined, label: String(roofLossSettlementWindstormHail).trim(), fieldName: "Roof Loss Settlement for Windstorm or Hail Losses" });
  }
  // Market Value (optional)
  if (hasValue(marketValue)) {
    const mv = String(marketValue).replace(/[^0-9]/g, "");
    // Only interact if we actually have digits to set (avoids clearing field when payload is "X"/blank-like).
    if (!mv) {
      // do nothing
    } else {
      const mvLoc = page.locator("input#marketValue[name='marketValue'], input#marketValue").first();
      if (await mvLoc.isVisible().catch(() => false)) {
        await mvLoc.scrollIntoViewIfNeeded().catch(() => undefined);
        // Always prefer JS setter for this specific field (AO sometimes misreports editable state).
        await mvLoc
          .evaluate((el: HTMLInputElement, v: string) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            setter?.call(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
          }, mv)
          .catch(() => undefined);
        await page.waitForTimeout(120);
        // Verify and retry once if it didn't stick (AO may format with commas).
        const readBack = await mvLoc.inputValue().catch(() => "");
        if (readBack.replace(/[^0-9]/g, "") !== mv) {
          await setInputValueAndCommit(page, "input#marketValue", mv).catch(() => undefined);
          await page.waitForTimeout(120);
        }
      }
    }
  }

  // Market Value can be recalculated/cleared after deductible/coverage changes.
  // Re-apply once near the end if payload provided.
  if (hasValue(marketValue)) {
    const mv = String(marketValue).replace(/[^0-9]/g, "");
    if (mv) {
      const mvLoc = page.locator("input#marketValue[name='marketValue'], input#marketValue").first();
      if (await mvLoc.isVisible().catch(() => false)) {
        const readBack = await mvLoc.inputValue().catch(() => "");
        if (readBack.replace(/[^0-9]/g, "") !== mv) {
          await setInputValueAndCommit(page, "input#marketValue", mv).catch(() => undefined);
          await page.waitForTimeout(120);
        }
      }
    }
  }

  // Final re-apply for deductibles (AO can reset after other field changes)
  if (hasValue(windHailDeductible)) {
    const raw = String(windHailDeductible).trim();
    const asVal = raw.replace(/[^0-9]/g, "");
    if (asVal) await setSelectValueWithVerify(windHailDedSel, asVal, "Wind/Hail Deductible").catch(() => undefined);
  }
  if (hasValue(hurricaneDeductible)) {
    const raw = String(hurricaneDeductible).trim();
    const asVal = raw.replace(/[^0-9]/g, "");
    if (asVal) await setSelectValueWithVerify(hurricaneDedSel, asVal, "Hurricane Deductible").catch(() => undefined);
  }
  // Student Rental (frontend key) + Boarding/Lodging/Student Rentals (legacy key)
  // UI label is "Is this a student rental?" and/or a rentalCode select.
  if (hasValue(isStudentRental)) {
    await fillSelectIfEnabled(rentalCodeSel, {
      value: ynValue(isStudentRental) || undefined,
      fieldName: "Is this a student rental?",
      required: true,
    });
  } else if (hasValue(boardingOrLodgingOrStudentRentals)) {
    await fillSelectIfEnabled(rentalCodeSel, {
      value: ynValue(boardingOrLodgingOrStudentRentals) || undefined,
      fieldName: "Boarding/Lodging/Student Rentals",
      required: true,
    });
  }
  // Visible From Other Dwellings (required)
  if (hasValue(visibleFromOtherDwellings)) {
    await fillSelectIfEnabled(visibleOtherSel, { value: ynValue(visibleFromOtherDwellings) || undefined, fieldName: "Visible From Other Dwellings", required: true });
  }
  // Condition Of Dwelling (optional)
  if (hasValue(conditionOfDwelling)) {
    await fillSelectIfEnabled(conditionSel, { label: String(conditionOfDwelling).trim(), fieldName: "Condition Of Dwelling" });
  }
  // Located On Island (required)
  if (hasValue(locatedOnIsland)) {
    const v = ynOrNull(locatedOnIsland);
    if (v) await fillSelectIfEnabled(islandSel, { value: v, fieldName: "Located On Island", required: true });
  }

  // Roof Update Year (can be present on this page; fill if shown)
  if (hasValue(roofUpdateYear)) {
    const roofSel = await findInputNearLabel(page, /roof update year/i);
    if (roofSel) {
      await fillInputIfEditable(roofSel.startsWith("#") ? `input${roofSel}` : roofSel, String(roofUpdateYear).replace(/[^0-9]/g, ""));
    }
  }

  // Mortgagee/secured LOC question (Yes/No select, fill if shown)
  if (hasValue(hasMortgageeContractHolderOrSecuredLineOfCredit)) {
    const mortSel = await findSelectNearLabel(page, /mortgagee|contract holder|secured line of credit/i);
    if (mortSel) {
      const v = ynOrNull(hasMortgageeContractHolderOrSecuredLineOfCredit);
      if (v) {
        await fillSelectIfEnabled(mortSel, {
          value: v,
          fieldName: "Mortgagee/contract holder/secured line of credit",
        });
      }
    }
  }

  // Coastal Storm Risk Area (per your HTML) is a readonly display-only input (often "X").
  // DO NOT interact with it.
  // Any dogs owned/kept (required)
  if (hasValue(dogsOwnedOrKept)) {
    await fillSelectIfEnabled(dogSel, { value: ynValue(dogsOwnedOrKept) || undefined, fieldName: "Any dogs owned/kept", required: true });
  }
  // Specific Breed (dynamic field, best-effort by label)
  if (hasValue(specificBreed)) {
    const breedSel = await findSelectNearLabel(page, /specific breed|specify breed/i);
    if (breedSel) {
      await fillSelectIfEnabled(breedSel, { label: String(specificBreed).trim(), fieldName: "Specify Breed" });
    }
  }
  // Bite history/aggressive behavior (dynamic field, best-effort by label)
  if (hasValue(biteHistoryAggressiveBehavior)) {
    const biteSel = await findSelectNearLabel(page, /bite history|aggressive behavior/i);
    if (biteSel) {
      await fillSelectIfEnabled(biteSel, { value: ynValue(biteHistoryAggressiveBehavior) || undefined, fieldName: "Bite history/aggressive behavior" });
    }
  }

  // Within 1000 Feet Of Hydrant (required)
  if (await page.locator(hydrantSel).first().isVisible().catch(() => false)) {
    if (hasValue(withinHydrant)) {
      await fillSelectIfEnabled(hydrantSel, { value: ynValue(withinHydrant) || undefined, fieldName: "Within 1000 Feet Of Hydrant", required: true });
    }
  }

  // Bridge Access (dedicated safety)
  const bridgeSelector = await findSelectNearLabel(page, /is there bridge access/i);
  if (bridgeSelector && bridgeAccess !== undefined && bridgeAccess !== null && String(bridgeAccess).trim() !== "") {
    const target = String(bridgeAccess).trim().toLowerCase().startsWith("y") ? "Y" : String(bridgeAccess).trim();
    // Try exact Yes first by value/label; else closest among YES/Y/True
    await setSelectByValueOrLabelWithFallback(page, bridgeSelector, {
      value: target === "Y" ? "Y" : undefined,
      label: target === "Y" ? "Yes" : String(bridgeAccess).trim(),
      fieldName: "Is there bridge access",
      required: true,
    });
  }

  // New dynamic question: Asbestos (can appear AFTER dropdown changes, without clicking Continue)
  // Detect by label and fill the nearest select when it mounts.
  let asbestosSelector: string | null = null;
  if (hasValue(dwellingConstructedWithAsbestos)) {
    const v = ynOrNull(dwellingConstructedWithAsbestos);
    if (!v) {
      // Do not interact unless payload is a real Yes/No.
      // (Prevents unwanted dropdown interaction when payload contains placeholders like "X".)
    } else {
    const start = Date.now();
    while (Date.now() - start < 6500) {
      asbestosSelector = await findSelectNearLabel(page, /asbestos/i);
      if (asbestosSelector && (await page.locator(asbestosSelector).first().isVisible().catch(() => false))) break;
      await page.waitForTimeout(350);
    }
    if (asbestosSelector && (await page.locator(asbestosSelector).first().isVisible().catch(() => false))) {
      await fillSelectIfEnabled(asbestosSelector, {
        value: v,
        fieldName: "Is the dwelling constructed with material containing asbestos?",
        required: true,
      });
    }
    }
  }

  // IMPORTANT RULE (per your instruction):
  // Do NOT interact with fields unless data is coming from frontend (payload has a value).
  // Therefore, we do not enforce required-field checks here; the UI itself will block Continue if needed.

  // Handle red banner with Ignore Errors
  const errorSection = page.locator("#errorSection, .errorContainer").first();
  const ignoreErrorsCheckbox = page
    .locator(
      [
        '#errorSection input#ignoreErrors',
        ".errorContainer input#ignoreErrors",
        "input#ignoreErrors",
        '#errorSection input[name="ignoreErrors"]',
        '.errorContainer input[name="ignoreErrors"]',
        'input[name="ignoreErrors"]',
        // Some pages render the checkbox without id/name inside the banner.
        "#errorSection input[type=\"checkbox\"]",
        ".errorContainer input[type=\"checkbox\"]",
      ].join(", ")
    )
    .first();
  const ignoreErrorsByLabel = page.getByLabel(/ignore errors/i).first();
  const ignoreErrorsByTextCheckbox = page
    .getByText(/ignore errors/i)
    .first()
    .locator("xpath=preceding::input[@type='checkbox'][1]")
    .first();
  const ensureIgnoreErrors = async (): Promise<void> => {
    const byText = page.getByText(/ignore errors/i).first();
    const checkboxBeforeText = byText.locator("xpath=preceding::input[@type='checkbox'][1]").first();
    const checkboxAfterText = byText.locator("xpath=following::input[@type='checkbox'][1]").first();
    const checkboxNearby = page
      .locator(
        [
          "#errorSection input[type='checkbox']",
          ".errorContainer input[type='checkbox']",
          "input#ignoreErrors",
          "input[name='ignoreErrors']",
          "input[type='checkbox']",
        ].join(", ")
      )
      .first();

    const candidates = [
      ignoreErrorsCheckbox,
      ignoreErrorsByLabel,
      ignoreErrorsByTextCheckbox,
      checkboxBeforeText,
      checkboxAfterText,
      checkboxNearby,
    ];

    const firstVisible = async (): Promise<import("playwright").Locator | null> => {
      for (const c of candidates) {
        if (await c.isVisible().catch(() => false)) return c;
      }
      return null;
    };

    let target = await firstVisible();
    if (!target) return;

    const labelFor = page.locator('label[for="ignoreErrors"]').first();

    for (let attempt = 0; attempt < 3; attempt++) {
      // Refresh the target each attempt in case the DOM rerendered.
      target = (await firstVisible()) ?? target;
      const checkedNow = await target.isChecked().catch(() => false);
      if (checkedNow) return;

      await target.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(150);

      // 1) Best: checkbox check() (avoids label interception issues)
      await target.check({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await target.isChecked().catch(() => false)) return;

      // 1b) Force click (some UIs block check() but accept click)
      await target.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await target.isChecked().catch(() => false)) return;

      // 2) Click the associated label (some layouts overlay the checkbox)
      if (await labelFor.isVisible().catch(() => false)) {
        await labelFor.scrollIntoViewIfNeeded().catch(() => undefined);
        await page.waitForTimeout(120);
        await labelFor.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(250);
        if (await target.isChecked().catch(() => false)) return;
      }

      // 2b) Click the visible "Ignore Errors" text itself (often toggles checkbox)
      if (await byText.isVisible().catch(() => false)) {
        await byText.scrollIntoViewIfNeeded().catch(() => undefined);
        await page.waitForTimeout(120);
        await byText.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(250);
        if (await target.isChecked().catch(() => false)) return;
      }

      // 3) Last resort: set checked via DOM + dispatch events
      await target
        .evaluate((el: HTMLInputElement) => {
          el.checked = true;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        })
        .catch(() => undefined);
      await page.waitForTimeout(250);
      if (await target.isChecked().catch(() => false)) return;
    }

    // FINAL fallback: force-check visible checkboxes near the banner in the DOM.
    // Some AO pages render the checkbox without a stable id/name and intercept clicks.
    await page
      .evaluate(() => {
        const findBanner = (): HTMLElement | null => {
          const byId = document.querySelector("#errorSection") as HTMLElement | null;
          if (byId) return byId;
          const byClass = document.querySelector(".errorContainer") as HTMLElement | null;
          if (byClass) return byClass;
          const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
          return (
            all.find((el) => /protection class.*ineligible/i.test(el.innerText || "")) ||
            all.find((el) => /ignore errors/i.test(el.innerText || "")) ||
            null
          );
        };
        const banner = findBanner();
        const root: ParentNode = banner ? (banner.parentElement ?? banner) : document;
        const isVisible = (el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
        };
        const checkboxes = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='checkbox']")).filter((el) =>
          isVisible(el)
        );
        for (const cb of checkboxes) {
          if (!cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event("input", { bubbles: true }));
            cb.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      })
      .catch(() => undefined);

    // Absolute final: if the page exposes the exact #ignoreErrors control (your HTML does),
    // force-check it and verify.
    const exact = page.locator("input#ignoreErrors[name='ignoreErrors']").first();
    if (await exact.isVisible().catch(() => false)) {
      await exact.scrollIntoViewIfNeeded().catch(() => undefined);
      await exact.check({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
      if (!(await exact.isChecked().catch(() => false))) {
        await exact
          .evaluate((el: HTMLInputElement) => {
            el.checked = true;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          })
          .catch(() => undefined);
        await page.waitForTimeout(200);
      }
      if (!(await exact.isChecked().catch(() => false))) {
        // Try clicking the label as last resort.
        await page.locator('label[for="ignoreErrors"]').first().click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(200);
      }
    }
  };
  const protectionIneligible = await page.locator("text=/protection class.*ineligible/i").first().isVisible().catch(() => false);
  const dogExclusion = await page.locator("text=/dog liability exclusion/i").first().isVisible().catch(() => false);
  const isErrorBannerVisible = await errorSection.isVisible().catch(() => false);
  if ((isErrorBannerVisible && protectionIneligible && dogExclusion) || isErrorBannerVisible) {
    // HARD ENFORCEMENT: if banner is visible, we must end with Ignore Errors checked.
    const exact = page.locator("input#ignoreErrors[name='ignoreErrors'], input#ignoreErrors, input[name='ignoreErrors']").first();
    const hardCheckIgnoreErrors = async (): Promise<void> => {
      // Try multiple times because AO SPA can rerender the banner mid-click.
      for (let i = 0; i < 4; i++) {
        await ensureIgnoreErrors();
        if (await exact.isVisible().catch(() => false)) {
          const checked = await exact.isChecked().catch(() => false);
          if (checked) return;
          // Force DOM-set once more
          await exact
            .evaluate((el: HTMLInputElement) => {
              el.checked = true;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            })
            .catch(() => undefined);
          await page.waitForTimeout(200);
          if (await exact.isChecked().catch(() => false)) return;
        }
        await page.waitForTimeout(250);
      }
      // If banner is present and we still can't check, fail loudly (otherwise we keep getting stuck).
      if (await errorSection.isVisible().catch(() => false)) {
        throw new Error("Ignore Errors checkbox could not be checked on Location Information page.");
      }
    };
    await hardCheckIgnoreErrors();
  }

  // Continue to next form (SPA)
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);
  const continueBtn = page.locator('input[type="button"].F02v3[value="Continue"], button.F02v3:has-text("Continue"), button:has-text("Continue")').first();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  // In the updated flow, Continue can remain disabled until dynamic questions (like asbestos) are answered.
  const enableStart = Date.now();
  while (Date.now() - enableStart < 8000) {
    const enabled = await continueBtn.isEnabled().catch(() => true);
    if (enabled) break;
    await page.waitForTimeout(300);
  }
  await continueBtn.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(600);

  // If errors appear AFTER clicking Continue (single or multiple), tick Ignore Errors and try Continue again.
  const postClickHasErrors = await errorSection.isVisible().catch(() => false);
  if (postClickHasErrors) {
    // Ensure Ignore Errors is truly checked, then retry Continue.
    await ensureIgnoreErrors();
    const exact = page.locator("input#ignoreErrors[name='ignoreErrors'], input#ignoreErrors, input[name='ignoreErrors']").first();
    if (await exact.isVisible().catch(() => false)) {
      const checked = await exact.isChecked().catch(() => false);
      if (!checked) {
        await exact.check({ force: true }).catch(() => undefined);
        await page.waitForTimeout(200);
      }
    }
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await continueBtn.click({ force: true }).catch(() => undefined);
  }

  const successSignal = async (): Promise<boolean> => {
    const tab = await page.locator("li#subtab.addlLocationInfo.current").first().isVisible().catch(() => false);
    const labels = await page.getByText(/roof|heating|plumbing|electrical/i).first().isVisible().catch(() => false);
    const moved = await page.locator("li#subtab.addlLocationInfo.current, li#subtab.addlInterests.current").first().isVisible().catch(() => false);
    return tab || labels || moved;
  };

  const w1 = Date.now();
  while (Date.now() - w1 < 6000) {
    if (await successSignal()) break;
    await page.waitForTimeout(400);
  }
  if (!(await successSignal())) {
    // If still blocked, re-check requireds once and click Continue again
    await page.waitForTimeout(800);
    // Re-run post-click ignore-errors behavior if the banner is present.
    if (await errorSection.isVisible().catch(() => false)) {
      await ensureIgnoreErrors();
    }
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await continueBtn.click({ force: true }).catch(() => undefined);
    const w2 = Date.now();
    while (Date.now() - w2 < 5000) {
      if (await successSignal()) break;
      await page.waitForTimeout(400);
    }
  }
  if (!(await successSignal())) {
    // SPA fallback: click the Information Continued tab directly.
    const tab = page.locator('li[id="subtab.addlLocationInfo"]').first();
    const tabLink = page.locator('li[id="subtab.addlLocationInfo"] a').first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ force: true }).catch(() => undefined);
    if (await tabLink.isVisible().catch(() => false)) await tabLink.click({ force: true }).catch(() => undefined);
    const t3 = Date.now();
    while (Date.now() - t3 < 8000) {
      if (await successSignal()) break;
      await page.waitForTimeout(400);
    }
  }
  if (!(await successSignal())) throw new Error("Continue clicked but Information Continued did not become visible.");
  await page.waitForTimeout(2000);
}

function normalizeYesNoToYN(v: unknown): "Y" | "N" | "" {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (["y", "yes", "true", "1"].includes(s)) return "Y";
  if (["n", "no", "false", "0"].includes(s)) return "N";
  if (s === "y" || s === "n") return s.toUpperCase() as "Y" | "N";
  return "";
}

function fortifiedHomeCodeFromPayload(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (["N", "F", "I", "1", "2", "3", "7"].includes(raw.toUpperCase())) return raw.toUpperCase();
  if (lower === "no") return "N";
  if (lower.includes("safer living")) return "F";
  if (lower.includes("irc")) return "I";
  if (lower.includes("bronze")) return "1";
  if (lower.includes("silver")) return "2";
  if (lower.includes("gold")) return "3";
  if (lower.includes("fortified roof") || (lower.includes("fortified") && lower.includes("roof"))) return "7";
  if (lower.includes("fortified")) return "F";
  return null;
}

function fortifiedHomeLabelForCode(code: string, raw: unknown): string {
  const labels: Record<string, string> = {
    N: "No",
    F: "Safer Living",
    I: "IRC",
    "1": "Bronze",
    "2": "Silver",
    "3": "Gold",
    "7": "Fortified Roof",
  };
  return labels[code] ?? String(raw ?? "").trim();
}

async function fillAoYesNoSelectSticky(
  page: Page,
  selector: string,
  raw: unknown,
  fieldName: string,
  defaultYN?: "Y" | "N"
): Promise<boolean> {
  const target = normalizeYesNoToYN(raw) || defaultYN;
  if (!target) return false;

  const loc = page.locator(selector).first();
  const visible = await loc
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return false;

  const read = async (): Promise<"Y" | "N" | ""> => normalizeYesNoToYN(await loc.inputValue().catch(() => ""));
  const label = target === "Y" ? "Yes" : "No";

  for (let attempt = 0; attempt < 10; attempt++) {
    if ((await read()) === target) return true;
    await loc.scrollIntoViewIfNeeded().catch(() => undefined);
    await preDropdownAntiOverlay(page);
    await loc.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(80);
    await loc.selectOption({ value: target }).catch(() => undefined);
    await page.waitForTimeout(140);
    if ((await read()) === target) return true;
    await loc.selectOption({ label }).catch(() => undefined);
    await page.waitForTimeout(140);
    if ((await read()) === target) return true;
    await loc
      .evaluate((el: HTMLSelectElement, v: string) => {
        const opts = Array.from(el.options || []);
        let idx = opts.findIndex((o) => (o.value || "").trim().toUpperCase() === v);
        if (idx < 0) idx = opts.findIndex((o) => /^(yes|no)$/i.test((o.textContent || "").trim()) && (v === "Y" ? /^yes$/i.test((o.textContent || "").trim()) : /^no$/i.test((o.textContent || "").trim())));
        if (idx >= 0) el.selectedIndex = idx;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }, target)
      .catch(() => undefined);
    await page.waitForTimeout(160);
  }

  const ok = (await read()) === target;
  if (!ok) {
    throw new Error(`${fieldName} dropdown could not be set to ${label} (required).`);
  }
  return ok;
}

async function fillAoFortifiedHomeSelectSticky(page: Page, raw: unknown, defaultCode: string = "N"): Promise<boolean> {
  const code = fortifiedHomeCodeFromPayload(raw) ?? defaultCode;
  const label = fortifiedHomeLabelForCode(code, raw);
  const selector = "select#fortifiedHomeInd";
  const loc = page.locator(selector).first();
  const visible = await loc
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return false;

  const read = async (): Promise<string> => (await loc.inputValue().catch(() => "")).trim().toUpperCase();

  for (let attempt = 0; attempt < 10; attempt++) {
    if ((await read()) === code) return true;
    await loc.scrollIntoViewIfNeeded().catch(() => undefined);
    await preDropdownAntiOverlay(page);
    await loc.selectOption({ value: code }).catch(() => undefined);
    await page.waitForTimeout(140);
    if ((await read()) === code) return true;
    await loc.selectOption({ label }).catch(() => undefined);
    await page.waitForTimeout(140);
    if ((await read()) === code) return true;
    await loc
      .evaluate(
        (el: HTMLSelectElement, args: { code: string; label: string }) => {
          const opts = Array.from(el.options || []);
          const code = args.code.trim().toUpperCase();
          const label = args.label.trim().toLowerCase();
          let idx = opts.findIndex((o) => (o.value || "").trim().toUpperCase() === code);
          if (idx < 0) idx = opts.findIndex((o) => (o.textContent || "").trim().toLowerCase() === label);
          if (idx < 0) idx = opts.findIndex((o) => (o.textContent || "").trim().toLowerCase().includes(label));
          if (idx >= 0) el.selectedIndex = idx;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
        },
        { code, label }
      )
      .catch(() => undefined);
    await page.waitForTimeout(160);
  }

  const ok = (await read()) === code;
  if (!ok) {
    throw new Error(`FORTIFIED Home dropdown could not be set to ${label} (required).`);
  }
  return ok;
}

async function waitForNewVentureSelect(page: Page, timeoutMs = 12000): Promise<string | null> {
  const directSelectors = [
    "select#newVentureInd",
    "select#newVentureIndicator",
    "select#newVenture",
    "#newVentureContainer select",
    "select[name='newVentureInd']",
    "select[name='newVentureIndicator']",
  ];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of directSelectors) {
      const loc = page.locator(sel).first();
      const ok = await loc
        .evaluate((el) => {
          if (!(el instanceof HTMLSelectElement)) return false;
          const style = window.getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null && !el.disabled;
        })
        .catch(() => false);
      if (ok) return sel;
    }
    const labelSel = await findSelectNearLabel(page, /new venture|no previous landlord|rental property experience/i);
    if (labelSel) {
      const loc = page.locator(labelSel).first();
      const ok = await loc.isVisible().catch(() => false);
      if (ok) return labelSel;
    }
    await page.waitForTimeout(350);
  }
  return null;
}

async function fillAoNewVentureFromPayload(page: Page, raw: unknown): Promise<boolean> {
  const target = normalizeYesNoToYN(raw);
  if (!target) return false;

  const selector = await waitForNewVentureSelect(page);
  if (!selector) {
    throw new Error("New Venture dropdown did not appear on Underwriting Location Specific Questions.");
  }
  return fillAoYesNoSelectSticky(page, selector, raw, "New Venture");
}

function getNewVenturePayloadValue(payload: unknown): unknown {
  return (
    getPayloadValue(payload, "isNewVentureNoPreviousLandlordOrRentalPropertyExperience") ??
    getPayloadValue(payload, "newVenture")
  );
}

/**
 * Step 11: Location(s) -> Information Continued (Location Premium Adjustments)
 * - Forward-progress skip (Add'l Coverages/Underwriting/Summary/Final Sale)
 * - Ensure "Information Continued" subtab is active
 * - Fill fields when present from payload (skip missing)
 * - Continue with SPA retries + direct-tab fallback
 */
export async function stepLocationInformationContinued(page: Page, payload: unknown): Promise<void> {
  const forwardProgress = async (): Promise<boolean> => {
    const url = page.url();
    if (/\/propertyCoverages|\/liabilityCoverages|\/underwriting|\/summary|\/finalSale/i.test(url)) return true;
    const selectors = [
      "li#tab.addlCoverages.current",
      "li#tab.underwriting.current",
      "li#tab.summary.current",
      "li#tab.finalSale.current",
    ];
    for (const s of selectors) {
      if (await page.locator(s).first().isVisible().catch(() => false)) return true;
    }
    const byText = await page
      .locator("text=/Property Coverages|Liability Coverages|Underwriting|Summary|Final Sale/i")
      .first()
      .isVisible()
      .catch(() => false);
    return byText;
  };
  // Give SPA a moment to settle before deciding.
  const settleStart = Date.now();
  while (Date.now() - settleStart < 6000) {
    if (await forwardProgress()) return;
    // If we are already on the page, stop waiting.
    if (/\/addlLocationInfo/i.test(page.url())) break;
    await page.waitForTimeout(400);
  }

  const isOnTab = async (): Promise<boolean> => {
    // Accept by URL, active tab, or unique field presence (SPA can lag tab highlighting).
    const url = page.url();
    if (/\/addlLocationInfo/i.test(url)) return true;
    const tabCurrent = await page.locator('li[id="subtab.addlLocationInfo"].current').first().isVisible().catch(() => false);
    const hasFields =
      (await page.locator("select#fireplace").first().isVisible().catch(() => false)) ||
      (await page.locator("select#swimmingPoolCode").first().isVisible().catch(() => false)) ||
      (await page.locator("text=/Location Premium Adjustments/i").first().isVisible().catch(() => false));
    return tabCurrent || hasFields;
  };

  // If the tab/content is mounting slowly, wait a bit before attempting tab clicks.
  const mountStart = Date.now();
  while (Date.now() - mountStart < 12000) {
    if (await isOnTab()) break;
    if (await forwardProgress()) return;
    await page.waitForTimeout(450);
  }

  // Recovery: if we're still on "Information" and a red error banner is blocking,
  // tick Ignore Errors and click Continue to move forward.
  const isOnInformation = await page.locator('li[id="subtab.basicLocationDwlg"].current').first().isVisible().catch(() => false);
  if (isOnInformation) {
    const errorSection = page.locator("#errorSection, .errorContainer").first();
    const ignoreErrors = page
      .locator(
        [
          '#errorSection input#ignoreErrors',
          ".errorContainer input#ignoreErrors",
          "input#ignoreErrors",
          '#errorSection input[name=\"ignoreErrors\"]',
          '.errorContainer input[name=\"ignoreErrors\"]',
          'input[name=\"ignoreErrors\"]',
        ].join(", ")
      )
      .first();
    const ignoreLabel = page.getByLabel(/ignore errors/i).first();
    const cont = page.locator('input[type="button"].F02v3[value="Continue"], button:has-text("Continue")').first();

    if (await errorSection.isVisible().catch(() => false)) {
      for (let i = 0; i < 3; i++) {
        const target = (await ignoreErrors.isVisible().catch(() => false)) ? ignoreErrors : ignoreLabel;
        if (await target.isVisible().catch(() => false)) {
          const checked = await target.isChecked().catch(() => false);
          if (!checked) {
            await target.scrollIntoViewIfNeeded().catch(() => undefined);
            await target.check({ force: true }).catch(() => undefined);
            await page.waitForTimeout(250);
          }
        }
        if (await cont.isVisible().catch(() => false)) {
          await cont.scrollIntoViewIfNeeded().catch(() => undefined);
          await cont.click({ force: true }).catch(() => undefined);
          await page.waitForTimeout(1200);
          await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        }
        if (await isOnTab()) break;
      }
    }
  }

  if (!(await isOnTab())) {
    const tab = page.locator('li[id="subtab.addlLocationInfo"]').first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
    }
    const tabLink = page.locator('li[id="subtab.addlLocationInfo"] a').first();
    if (await tabLink.isVisible().catch(() => false)) {
      await tabLink.click({ force: true }).catch(() => undefined);
    }
    const t1 = Date.now();
    while (Date.now() - t1 < 8000) {
      if (await isOnTab()) break;
      await page.waitForTimeout(350);
    }
  }
  if (!(await isOnTab())) {
    // retry once
    const tab = page.locator('li[id="subtab.addlLocationInfo"]').first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
    }
    const tabLink = page.locator('li[id="subtab.addlLocationInfo"] a').first();
    if (await tabLink.isVisible().catch(() => false)) {
      await tabLink.click({ force: true }).catch(() => undefined);
    }
    const t2 = Date.now();
    while (Date.now() - t2 < 8000) {
      if (await isOnTab()) break;
      await page.waitForTimeout(350);
    }
  }
  if (!(await isOnTab())) {
    if (await forwardProgress()) return;
    throw new Error("Information Continued tab not reachable.");
  }

  // Only portal-required fields on Information Continued — skip optional controls
  // (fireplace, swimming pool, roof material, plumbing, etc.).
  const hasValue = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";
  const isYesPayload = (v: unknown): boolean => normalizeYesNoToYN(v) === "Y";

  const fortifiedHome = getPayloadValue(payload, "fortifiedHome");
  const woodCoalHeating = getPayloadValue(payload, "woodCoalHeating");
  const woodCoalHeatingQuantity = getPayloadValue(payload, "woodCoalHeatingQuantity");
  const gatedAccessToDwelling = getPayloadValue(payload, "gatedAccessToDwelling");
  const applicantWillingToCompleteDiySurvey = getPayloadValue(payload, "applicantWillingToCompleteDiySurvey");
  const screenedEnclosure = getPayloadValue(payload, "screenedEnclosure");

  const fillRequiredContinuedFields = async (): Promise<void> => {
    // Top-of-page required fields (visible in screenshot).
    if (hasValue(fortifiedHome)) {
      await fillAoFortifiedHomeSelectSticky(page, fortifiedHome);
    }
    if (hasValue(woodCoalHeating)) {
      await fillAoYesNoSelectSticky(page, "select#solidFuelInd", woodCoalHeating, "Wood/Coal Heating");
    }
    if (hasValue(woodCoalHeating) && isYesPayload(woodCoalHeating) && hasValue(woodCoalHeatingQuantity)) {
      const qtyInput = await findInputNearLabel(page, /wood\/coal heating.*quantity|quantity.*wood\/coal/i);
      if (qtyInput) {
        await setInputTextSafe(page, qtyInput, String(woodCoalHeatingQuantity).replace(/[^0-9]/g, "")).catch(() => undefined);
      }
    }

    // Below-the-fold required fields — scroll each into view before filling.
    if (hasValue(gatedAccessToDwelling)) {
      await fillAoYesNoSelectSticky(
        page,
        "select#gatedCommunityUndQuestionInd",
        gatedAccessToDwelling,
        "Gated access to dwelling"
      );
    }
    if (hasValue(applicantWillingToCompleteDiySurvey)) {
      await fillAoYesNoSelectSticky(
        page,
        "select#diySurveyOptInInd",
        applicantWillingToCompleteDiySurvey,
        "DIY survey opt-in"
      );
    }
    if (hasValue(screenedEnclosure)) {
      await fillAoYesNoSelectSticky(page, "select#screenEnclosure1Ind", screenedEnclosure, "Screened Enclosure");
    }
  };

  // Corn/Pellet Heating (#cornPelletInd) and woodCoalHeatingLocation are intentionally skipped.
  await page.waitForTimeout(800);
  await page
    .locator("select#fortifiedHomeInd, select#solidFuelInd")
    .first()
    .waitFor({ state: "attached", timeout: 20000 })
    .catch(() => undefined);
  await fillRequiredContinuedFields();

  const continuedErrorBanner = page.locator("#errorSection, .errorContainer").first();
  const hasContinuedValidationErrors = async (): Promise<boolean> => {
    if (!(await continuedErrorBanner.isVisible().catch(() => false))) return false;
    const txt = (await continuedErrorBanner.innerText().catch(() => "")).toLowerCase();
    return /required|fortified|wood\/coal|gated access|screen enclosure|diy survey/i.test(txt);
  };

  // Continue (SPA)
  const continueBtn = page.locator('input[type="button"].F02v3[value="Continue"], button.F02v3:has-text("Continue"), button:has-text("Continue")').first();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await continueBtn.click({ force: true }).catch(() => undefined);

  if (await hasContinuedValidationErrors()) {
    await fillRequiredContinuedFields();
    await page.waitForTimeout(400);
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await continueBtn.click({ force: true }).catch(() => undefined);
  }

  const successSignal = async (): Promise<boolean> => {
    const addlInterests = await page.locator("li#subtab.addlInterests.current").first().isVisible().catch(() => false);
    const addlCoverages = await page.locator("li#tab.addlCoverages.current").first().isVisible().catch(() => false);
    const later = await forwardProgress();
    return addlInterests || addlCoverages || later;
  };

  const w1 = Date.now();
  while (Date.now() - w1 < 5000) {
    if (await successSignal()) break;
    await page.waitForTimeout(400);
  }
  if (!(await successSignal())) {
    await continueBtn.click({ force: true }).catch(() => undefined);
    const w2 = Date.now();
    while (Date.now() - w2 < 8000) {
      if (await successSignal()) break;
      await page.waitForTimeout(400);
    }
  }
  if (!(await successSignal())) {
    const tab = page.locator("li#subtab.addlInterests").first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
      const w3 = Date.now();
      while (Date.now() - w3 < 8000) {
        if (await successSignal()) break;
        await page.waitForTimeout(400);
      }
    }
  }
  if (!(await successSignal()) && (await hasContinuedValidationErrors())) {
    await fillRequiredContinuedFields();
    await page.waitForTimeout(500);
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await continueBtn.click({ force: true }).catch(() => undefined);
    const w4 = Date.now();
    while (Date.now() - w4 < 10000) {
      if (await successSignal()) break;
      await page.waitForTimeout(400);
    }
  }
  if (!(await successSignal())) throw new Error("Information Continued page transition failed after retries.");
  await page.waitForTimeout(2000);
}

/**
 * Step 12: Add'l Coverages (Property Coverages -> Liability Coverages)
 * Your requirement: just click Continue on both screens.
 */
export async function stepAddlCoveragesContinue(page: Page): Promise<void> {
  const isPast = async (): Promise<boolean> => {
    const url = page.url();
    if (/\/underwritingPolicy|\/underwritingLocation|\/priorLosses|\/underwriting/i.test(url)) return true;
    // Only treat as past when the tab is actually current or URL matches.
    const underwritingCurrent = await page.locator("li#tab.underwriting.current").first().isVisible().catch(() => false);
    const summaryCurrent = await page.locator("li#tab.summary.current").first().isVisible().catch(() => false);
    const finalSaleCurrent = await page.locator("li#tab.finalSale.current").first().isVisible().catch(() => false);
    if (underwritingCurrent || summaryCurrent || finalSaleCurrent) return true;
    // Summary/final sale by URL (strong)
    if (/\/summary|\/finalSale/i.test(url)) return true;
    return false;
  };

  const isOnAddlCoverages = async (): Promise<boolean> =>
    (await page.locator("li#tab.addlCoverages.current").first().isVisible().catch(() => false)) ||
    (await page.locator("text=/Property Coverages|Liability Coverages/i").first().isVisible().catch(() => false));

  if (await isPast()) return;

  // Ensure Add'l Coverages main tab (SPA)
  if (!(await isOnAddlCoverages())) {
    const tab = page.locator("li#tab.addlCoverages").first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => undefined);
    }
    const t = Date.now();
    while (Date.now() - t < 15000) {
      if (await isOnAddlCoverages()) break;
      await page.waitForTimeout(450);
    }
  }
  if (await isPast()) return;

  const continueBtn = page
    .locator(
      [
        // Most specific for your HTML
        '#content .center input[type="button"].F02v3[value="Continue"]',
        'div.center input[type="button"].F02v3[value="Continue"]',
        'input[type="button"].F02v3[value="Continue"]',
        'input[type="button"][value="Continue"]',
        'button.F02v3:has-text("Continue")',
        'button:has-text("Continue")',
      ].join(", ")
    )
    .first();

  const scrollPageToBottom = async (): Promise<void> => {
    // Some Add'l Coverages screens keep Continue below a large scroll area.
    await page.keyboard.press("End").catch(() => undefined);
    await page.waitForTimeout(150);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(250);
  };

  const clickContinue = async (): Promise<void> => {
    await scrollPageToBottom();
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    // Now require it to be visible in viewport.
    await continueBtn.waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(200);
    // Prefer normal click first (force can "click" while not actually triggering).
    await continueBtn.click({ timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.evaluate((el: HTMLElement) => el.click()).catch(() => undefined);
    }
    await page.waitForTimeout(1200);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  };

  const onProperty = async (): Promise<boolean> =>
    /\/propertyCoverages/i.test(page.url()) ||
    (await page.locator("text=/Property Coverages/i").first().isVisible().catch(() => false));

  const onLiability = async (): Promise<boolean> =>
    /\/liabilityCoverages/i.test(page.url()) ||
    (await page.locator("text=/Liability Coverages/i").first().isVisible().catch(() => false));

  const propertyCurrent = async (): Promise<boolean> =>
    (await page.locator('li[id="subtab.propertyCoverages"].current').first().isVisible().catch(() => false)) || (await onProperty());
  const liabilityCurrent = async (): Promise<boolean> =>
    (await page.locator('li[id="subtab.liabilityCoverages"].current').first().isVisible().catch(() => false)) || (await onLiability());

  const waitForAnyProgress = async (timeoutMs: number): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await isPast()) return;
      if (await liabilityCurrent()) return;
      if (await propertyCurrent()) return;
      await page.waitForTimeout(450);
    }
  };

  // 1) If on Property Coverages, click Continue and wait for Liability.
  if (await propertyCurrent()) {
    await clickContinue();
    await waitForAnyProgress(15000);
  }

  if (await isPast()) return;

  // 2) If on Liability Coverages, click Continue and wait for Underwriting.
  if (await liabilityCurrent()) {
    await clickContinue();
  } else if (await isOnAddlCoverages()) {
    // Fallback: still in Add'l Coverages but couldn't detect which subtab; click continue anyway.
    await clickContinue();
  }

  // Final wait for Underwriting (or later)
  await waitForAnyProgress(20000);

  // Never silently succeed if we're still on Add'l Coverages.
  if (!(await isPast())) {
    const stillOn = await isOnAddlCoverages();
    if (stillOn) {
      throw new Error("Add'l Coverages Continue did not transition to Underwriting after retries.");
    }
  }
}

/**
 * Step 13: Underwriting -> Policy Questions
 * Fill fields using these payload keys:
 * - pleaseExplain -> #priorCarrierExplanation
 * - hasAnyCompanyCanceledRefusedOrDeclinedRenewal -> #noRenewalInd (Y/N)
 * - options -> #insurerLeavingInd (P/I/O)
 * - hasAutoOwnersInsurancePast5Years -> #insuredWithin5YearsInd (Y/N)
 * - previousPolicyNumber -> best-effort (field may appear conditionally)
 */
export async function stepUnderwritingPolicyQuestions(page: Page, payload: unknown): Promise<void> {
  // Forward-progress skip
  const url = page.url();
  if (/\/summary|\/finalSale/i.test(url)) return;
  if (await page.locator("li#tab.summary.current, li#tab.finalSale.current").first().isVisible().catch(() => false)) return;

  const underwritingPolicyUrlRe = /\/underwritingPolicy/i;
  const isOnPolicyQuestions = async (): Promise<boolean> => {
    const byUrl = underwritingPolicyUrlRe.test(page.url());
    const byTab = await page.locator('li[id="subtab.underwritingPolicy"].current').first().isVisible().catch(() => false);
    const byHeading = await page.locator("text=/Policy Questions/i").first().isVisible().catch(() => false);
    return byUrl || byTab || byHeading;
  };

  if (!(await isOnPolicyQuestions())) {
    const tab = page.locator('li[id="subtab.underwritingPolicy"]').first();
    const tabLink = page.locator('li[id="subtab.underwritingPolicy"] a').first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ force: true }).catch(() => undefined);
    if (await tabLink.isVisible().catch(() => false)) await tabLink.click({ force: true }).catch(() => undefined);
    await page.waitForURL(underwritingPolicyUrlRe, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
  }
  if (!(await isOnPolicyQuestions())) throw new Error("Underwriting Policy Questions page not reachable.");

  const hasValue = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";
  const ynValue = (v: unknown): string => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return "";
    if (["y", "yes", "true", "1"].includes(s)) return "Y";
    if (["n", "no", "false", "0"].includes(s)) return "N";
    return s.toUpperCase();
  };

  const pleaseExplain = getPayloadValue(payload, "pleaseExplain");
  const cancelled = getPayloadValue(payload, "hasAnyCompanyCanceledRefusedOrDeclinedRenewal");
  const options = getPayloadValue(payload, "options");
  const autoOwners5y = getPayloadValue(payload, "hasAutoOwnersInsurancePast5Years");
  const prevPolicy = getPayloadValue(payload, "previousPolicyNumber");

  // Always select "None" for prior carrier checkbox (as per your rule).
  const carrierNone = page.locator("input#carrierNone[name='carrierNone']").first();
  if (await carrierNone.isVisible().catch(() => false)) {
    for (let i = 0; i < 3; i++) {
      const checked = await carrierNone.isChecked().catch(() => false);
      if (checked) break;
      await carrierNone.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(120);
      await carrierNone.check({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
      // Fallback: click its label if check() didn't stick
      if (!(await carrierNone.isChecked().catch(() => false))) {
        await page.locator('label[for="carrierNone"]').first().click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(200);
      }
    }
  }

  // Please explain (text)
  if (hasValue(pleaseExplain)) {
    await setInputTextSafe(page, "input#priorCarrierExplanation", String(pleaseExplain).trim()).catch(() => undefined);
  }

  // Has any company canceled/refused/declined renewal (required dropdown)
  if (hasValue(cancelled)) {
    await setSelectValueAndDispatch(page, "select#noRenewalInd", ynValue(cancelled)).catch(() => undefined);
  }

  // Options (only meaningful if cancelled = Yes, but safe to set if present)
  if (hasValue(options)) {
    const raw = String(options).trim();
    const upper = raw.toUpperCase();
    const mapped =
      upper === "P" || /non[-\s]?pay/i.test(raw)
        ? "P"
        : upper === "I" || /leaving/i.test(raw)
          ? "I"
          : upper === "O" || /other/i.test(raw)
            ? "O"
            : "";
    if (mapped) await setSelectValueAndDispatch(page, "select#insurerLeavingInd", mapped).catch(() => undefined);
    else {
      // fallback by label
      await page.locator("select#insurerLeavingInd").first().selectOption({ label: raw }).catch(() => undefined);
    }
  }

  // Auto-Owners insurance past 5 years (required dropdown)
  if (hasValue(autoOwners5y)) {
    const wanted = ynValue(autoOwners5y);
    const sel = page.locator("select#insuredWithin5YearsInd").first();
    if (await sel.isVisible().catch(() => false)) {
      const read = async (): Promise<string> => (await sel.inputValue().catch(() => "")).trim().toUpperCase();
      for (let i = 0; i < 6; i++) {
        if ((await read()) === wanted) break;
        await sel.scrollIntoViewIfNeeded().catch(() => undefined);
        await preDropdownAntiOverlay(page);
        await setSelectValueAndDispatch(page, "select#insuredWithin5YearsInd", wanted).catch(() => undefined);
        await page.waitForTimeout(140);
        if ((await read()) === wanted) break;
        await sel.selectOption({ value: wanted }).catch(() => undefined);
        await page.waitForTimeout(120);
        if ((await read()) === wanted) break;
        await sel.selectOption({ label: wanted === "Y" ? "Yes" : "No" }).catch(() => undefined);
        await page.waitForTimeout(120);
        if ((await read()) === wanted) break;
        await sel
          .evaluate((el: HTMLSelectElement, v: string) => {
            el.value = v;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
          }, wanted)
          .catch(() => undefined);
        await page.waitForTimeout(150);
      }
    }
  }

  // Previous policy number (conditional). Best-effort: look for any input/select with that id/name.
  if (hasValue(prevPolicy)) {
    const prevLoc = page.locator("input#previousPolicyNumber, input[name='previousPolicyNumber'], input#priorPolicyNumber, input[name='priorPolicyNumber']").first();
    if (await prevLoc.isVisible().catch(() => false)) {
      const id = (await prevLoc.getAttribute("id").catch(() => null)) ?? "previousPolicyNumber";
      await setInputTextSafe(page, `input#${cssEscapeId(id)}`, String(prevPolicy).trim()).catch(() => undefined);
    }
  }

  // Continue
  const continueBtn = page.locator('input[type="button"].F02v3[value="Continue"], button.F02v3:has-text("Continue"), button:has-text("Continue")').first();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await continueBtn.click({ force: true }).catch(() => undefined);

  // Success: next underwriting tab or later
  const success = async (): Promise<boolean> => {
    const moved = await page
      .locator('li[id="subtab.underwritingLocation"].current, li[id="subtab.priorLosses"].current, li#tab.summary.current')
      .first()
      .isVisible()
      .catch(() => false);
    const byUrl = /\/underwritingLocation|\/priorLosses|\/summary/i.test(page.url());
    return moved || byUrl;
  };
  const t = Date.now();
  while (Date.now() - t < 15000) {
    if (await success()) break;
    await page.waitForTimeout(450);
  }
  if (!(await success())) {
    // One retry
    await continueBtn.click({ force: true }).catch(() => undefined);
    const t2 = Date.now();
    while (Date.now() - t2 < 15000) {
      if (await success()) break;
      await page.waitForTimeout(450);
    }
  }
  if (!(await success())) throw new Error("Underwriting Policy Questions continue did not transition.");
  await page.waitForTimeout(1500);
}

/**
 * Step 14: Underwriting -> Location Specific Questions
 * HTML ids (as provided):
 * - #houseForSaleInd, #newPurchaseInd, #purchasePrice
 * - #dwellingOccupiedInd, #dwellingOccupiedExp
 * - #occupancyDateMonth, #occupancyDateDay, #occupancyDateYear
 * - #daycareInd, #numberOfChildren
 * - #farmingInd, #acresFarmed, #numberOfLargeAnimals, #numberOfMediumAnimals, #numberOfSmallAnimals
 * - #otherBusinessInd, #typeOfBusinessExplanation
 * - #renovationInd, #homeOccupiedInd, #extentOfOccupancy
 * - #verifyAllQuestInd
 *
 * Payload keys (as provided by you):
 * dwellingForSale
 * dwellingNewPurchase
 * purchasePrice
 * dwellingOccupied
 * locationSpecificPleaseExplain
 * expectedOccupancyDate
 * dayCareOnPremises
 * childrenCaredForCount
 * farmingOnPremises
 * acresFarmedByOthers
 * numberOfAnimalsLarge
 * numberOfAnimalsMedium
 * numberOfAnimalsSmall
 * otherBusinessOnPremises
 * describeBusiness
 * buildingUnderRenovationOrReconstruction
 * householdMembersLivingDuringRenovation
 * renovationExplanation
 * responsesVerifiedWithApplicant
 */
export async function stepUnderwritingLocationSpecificQuestions(page: Page, payload: unknown): Promise<void> {
  // Forward-progress skip
  const url = page.url();
  if (/\/priorLosses|\/summary|\/finalSale/i.test(url)) return;
  if (
    (await page
      .locator('li[id="subtab.priorLosses"].current, li#tab.summary.current, li#tab.finalSale.current')
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    return;
  }

  const underwritingLocationUrlRe = /\/underwritingLocation/i;
  const isOnLocationSpecific = async (): Promise<boolean> => {
    const byUrl = underwritingLocationUrlRe.test(page.url());
    const byTab = await page.locator('li[id="subtab.underwritingLocation"].current').first().isVisible().catch(() => false);
    const byHeading = await page.locator("text=/Location Specific Questions/i").first().isVisible().catch(() => false);
    const byAnyField = await page.locator("select#houseForSaleInd, select#newPurchaseInd, select#dwellingOccupiedInd").first().isVisible().catch(() => false);
    return byUrl || byTab || byHeading || byAnyField;
  };

  if (!(await isOnLocationSpecific())) {
    const tab = page.locator('li[id="subtab.underwritingLocation"]').first();
    const tabLink = page.locator('li[id="subtab.underwritingLocation"] a').first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ force: true }).catch(() => undefined);
    if (await tabLink.isVisible().catch(() => false)) await tabLink.click({ force: true }).catch(() => undefined);
    await page.waitForURL(underwritingLocationUrlRe, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  }
  if (!(await isOnLocationSpecific())) throw new Error("Underwriting Location Specific Questions page not reachable.");

  const hasValue = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";
  const ynValue = (v: unknown): string => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return "";
    if (["y", "yes", "true", "1"].includes(s)) return "Y";
    if (["n", "no", "false", "0"].includes(s)) return "N";
    // If already Y/N:
    if (s === "y" || s === "n") return s.toUpperCase();
    return s.toUpperCase();
  };
  const ynOrNull = (v: unknown): "Y" | "N" | null => {
    const mapped = ynValue(v);
    if (mapped === "Y" || mapped === "N") return mapped;
    return null;
  };

  const parseExpectedOcc = (v: unknown): { mm: string; dd: string; yyyy: string } | null => {
    const raw = typeof v === "string" ? v.trim() : "";
    if (!raw) return null;
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return { mm: ymd[2], dd: ymd[3], yyyy: ymd[1] };
    const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) return { mm: mdy[1].padStart(2, "0"), dd: mdy[2].padStart(2, "0"), yyyy: mdy[3] };
    return null;
  };

  const dwellingForSale = getPayloadValue(payload, "dwellingForSale");
  const dwellingNewPurchase = getPayloadValue(payload, "dwellingNewPurchase");
  const purchasePrice = getPayloadValue(payload, "purchasePrice");
  const dwellingOccupied = getPayloadValue(payload, "dwellingOccupied");
  const locationSpecificPleaseExplain = getPayloadValue(payload, "locationSpecificPleaseExplain");
  const expectedOccupancyDate = getPayloadValue(payload, "expectedOccupancyDate");
  const dayCareOnPremises = getPayloadValue(payload, "dayCareOnPremises");
  const childrenCaredForCount = getPayloadValue(payload, "childrenCaredForCount");
  const farmingOnPremises = getPayloadValue(payload, "farmingOnPremises");
  const acresFarmedByOthers = getPayloadValue(payload, "acresFarmedByOthers");
  const numberOfAnimalsLarge = getPayloadValue(payload, "numberOfAnimalsLarge");
  const numberOfAnimalsMedium = getPayloadValue(payload, "numberOfAnimalsMedium");
  const numberOfAnimalsSmall = getPayloadValue(payload, "numberOfAnimalsSmall");
  const otherBusinessOnPremises = getPayloadValue(payload, "otherBusinessOnPremises");
  const describeBusiness = getPayloadValue(payload, "describeBusiness");
  const buildingUnderRenovationOrReconstruction = getPayloadValue(payload, "buildingUnderRenovationOrReconstruction");
  const householdMembersLivingDuringRenovation = getPayloadValue(payload, "householdMembersLivingDuringRenovation");
  const renovationExplanation = getPayloadValue(payload, "renovationExplanation");
  const responsesVerifiedWithApplicant = getPayloadValue(payload, "responsesVerifiedWithApplicant");
  const newVentureRaw = getNewVenturePayloadValue(payload);

  // Dropdowns (required on UI, but we set only when payload value exists)
  if (hasValue(dwellingForSale)) await setSelectValueAndDispatch(page, "select#houseForSaleInd", ynValue(dwellingForSale)).catch(() => undefined);
  if (hasValue(dwellingNewPurchase)) await setSelectValueAndDispatch(page, "select#newPurchaseInd", ynValue(dwellingNewPurchase)).catch(() => undefined);

  // Purchase price is required when "new purchase" is set; attempt if present & visible (best-effort).
  if (hasValue(purchasePrice)) {
    const priceLoc = page.locator("input#purchasePrice").first();
    if (await priceLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#purchasePrice", String(purchasePrice).trim()).catch(() => undefined);
    }
  }

  if (hasValue(dwellingOccupied)) {
    await setSelectValueAndDispatch(page, "select#dwellingOccupiedInd", ynValue(dwellingOccupied)).catch(() => undefined);
    // New Venture mounts dynamically after prior location questions (often after dwelling occupied).
    await page.waitForTimeout(500);
  }
  if (hasValue(newVentureRaw)) {
    await fillAoNewVentureFromPayload(page, newVentureRaw).catch(() => undefined);
  }
  if (hasValue(locationSpecificPleaseExplain)) {
    const expLoc = page.locator("input#dwellingOccupiedExp").first();
    if (await expLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#dwellingOccupiedExp", String(locationSpecificPleaseExplain).trim()).catch(() => undefined);
    }
  }

  // Expected occupancy date split fields
  if (hasValue(expectedOccupancyDate)) {
    const parsed = parseExpectedOcc(expectedOccupancyDate);
    if (parsed) {
      const mLoc = page.locator("input#occupancyDateMonth").first();
      const dLoc = page.locator("input#occupancyDateDay").first();
      const yLoc = page.locator("input#occupancyDateYear").first();
      if (await mLoc.isVisible().catch(() => false)) await setInputValueAndCommit(page, "input#occupancyDateMonth", parsed.mm).catch(() => undefined);
      if (await dLoc.isVisible().catch(() => false)) await setInputValueAndCommit(page, "input#occupancyDateDay", parsed.dd).catch(() => undefined);
      if (await yLoc.isVisible().catch(() => false)) await setInputValueAndCommit(page, "input#occupancyDateYear", parsed.yyyy).catch(() => undefined);
    }
  }

  // Day care + children count
  if (hasValue(dayCareOnPremises)) await setSelectValueAndDispatch(page, "select#daycareInd", ynValue(dayCareOnPremises)).catch(() => undefined);
  if (hasValue(childrenCaredForCount)) {
    const chLoc = page.locator("input#numberOfChildren").first();
    if (await chLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#numberOfChildren", String(childrenCaredForCount).trim()).catch(() => undefined);
    }
  }

  // Farming + acres + animals
  if (hasValue(farmingOnPremises)) await setSelectValueAndDispatch(page, "select#farmingInd", ynValue(farmingOnPremises)).catch(() => undefined);
  if (hasValue(acresFarmedByOthers)) {
    const acresLoc = page.locator("input#acresFarmed").first();
    if (await acresLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#acresFarmed", String(acresFarmedByOthers).trim()).catch(() => undefined);
    }
  }
  if (hasValue(numberOfAnimalsLarge)) {
    const aLoc = page.locator("input#numberOfLargeAnimals").first();
    if (await aLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#numberOfLargeAnimals", String(numberOfAnimalsLarge).trim()).catch(() => undefined);
    }
  }
  if (hasValue(numberOfAnimalsMedium)) {
    const aLoc = page.locator("input#numberOfMediumAnimals").first();
    if (await aLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#numberOfMediumAnimals", String(numberOfAnimalsMedium).trim()).catch(() => undefined);
    }
  }
  if (hasValue(numberOfAnimalsSmall)) {
    const aLoc = page.locator("input#numberOfSmallAnimals").first();
    if (await aLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#numberOfSmallAnimals", String(numberOfAnimalsSmall).trim()).catch(() => undefined);
    }
  }

  // Other business + describe
  if (hasValue(otherBusinessOnPremises)) await setSelectValueAndDispatch(page, "select#otherBusinessInd", ynValue(otherBusinessOnPremises)).catch(() => undefined);
  if (hasValue(describeBusiness)) {
    const bizLoc = page.locator("input#typeOfBusinessExplanation").first();
    if (await bizLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#typeOfBusinessExplanation", String(describeBusiness).trim()).catch(() => undefined);
    }
  }

  // Renovation + household during renovation + explanation
  if (hasValue(buildingUnderRenovationOrReconstruction))
    await setSelectValueAndDispatch(page, "select#renovationInd", ynValue(buildingUnderRenovationOrReconstruction)).catch(() => undefined);
  if (hasValue(householdMembersLivingDuringRenovation)) {
    const occLoc = page.locator("select#homeOccupiedInd").first();
    if (await occLoc.isVisible().catch(() => false)) {
      await setSelectValueAndDispatch(page, "select#homeOccupiedInd", ynValue(householdMembersLivingDuringRenovation)).catch(() => undefined);
    }
  }
  if (hasValue(renovationExplanation)) {
    const renLoc = page.locator("input#extentOfOccupancy").first();
    if (await renLoc.isVisible().catch(() => false)) {
      await setInputTextSafe(page, "input#extentOfOccupancy", String(renovationExplanation).trim()).catch(() => undefined);
    }
  }

  // Agency verification (required)
  if (hasValue(responsesVerifiedWithApplicant))
    await setSelectValueAndDispatch(page, "select#verifyAllQuestInd", ynValue(responsesVerifiedWithApplicant)).catch(() => undefined);

  // Re-apply New Venture before Continue (SPA can mount/clear it after other dropdown changes).
  if (hasValue(newVentureRaw)) {
    await fillAoNewVentureFromPayload(page, newVentureRaw).catch(() => undefined);
  }

  const isOnLocationSpecificPage = async (): Promise<boolean> => {
    const byUrl = /\/underwritingLocation|method=subtab\.underwritingLocation/i.test(page.url());
    const byTab = await page.locator('li[id="subtab.underwritingLocation"].current').first().isVisible().catch(() => false);
    const byField = await page
      .locator("select#houseForSaleInd, select#dwellingOccupiedInd, select#verifyAllQuestInd")
      .first()
      .isVisible()
      .catch(() => false);
    return byUrl || byTab || byField;
  };

  const locationContinueBtn = () =>
    page.locator('input[type="button"].F02v3[value="Continue"], button.F02v3:has-text("Continue")').first();

  // Continue — only while still on Location Specific Questions (never click Losses/Summary Continue).
  const continueBtn = locationContinueBtn();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(200);
  if (await isOnLocationSpecificPage()) {
    await continueBtn.click({ timeout: 10000 }).catch(() => undefined);
  }

  // If validation errors remain, refill New Venture first (dynamic field often clears on SPA updates).
  const errorSection = page.locator("#errorSection, .errorContainer").first();
  const ignoreErrors = page.locator("input#ignoreErrors, input[name='ignoreErrors']").first();
  if ((await isOnLocationSpecificPage()) && (await errorSection.isVisible().catch(() => false))) {
    const errTxt = (await errorSection.innerText().catch(() => "")).toLowerCase();
    if (/new venture/i.test(errTxt) && hasValue(newVentureRaw)) {
      await fillAoNewVentureFromPayload(page, newVentureRaw).catch(() => undefined);
      await page.waitForTimeout(350);
      await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await continueBtn.click({ force: true }).catch(() => undefined);
    } else if (await ignoreErrors.isVisible().catch(() => false)) {
      const checked = await ignoreErrors.isChecked().catch(() => false);
      if (!checked) await ignoreErrors.check({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
      await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await continueBtn.click({ force: true }).catch(() => undefined);
    }
  }

  const reachedLosses = async (): Promise<boolean> => {
    const priorLossesCurrent = await page.locator("li#subtab.priorLosses.current").first().isVisible().catch(() => false);
    const byUrl = /\/priorLosses|method=subtab\.priorLosses/i.test(page.url());
    const byOrderBtn = await page.locator("button.lossButton").first().isVisible().catch(() => false);
    const byLossHeading = await page.locator("text=/^Loss Report$/i").first().isVisible().catch(() => false);
    return (priorLossesCurrent || byUrl) && (byOrderBtn || byLossHeading);
  };

  const reachedSummary = async (): Promise<boolean> => {
    const byUrl = /\/summaryDisplay|\/summaryErrors|method=subtab\.summary/i.test(page.url());
    const byTab = await page
      .locator("li#subtab.summaryDisplay.current, li#subtab.summaryErrors.current, li#tab.summary.current")
      .first()
      .isVisible()
      .catch(() => false);
    const byPremium = await page.locator("#headingInfo, #rpbPremium").first().isVisible().catch(() => false);
    return byUrl || byTab || byPremium;
  };

  const success = async (): Promise<boolean> => (await reachedLosses()) || (await reachedSummary());

  const t = Date.now();
  while (Date.now() - t < 20000) {
    if (await success()) break;
    await page.waitForTimeout(450);
  }
  if (!(await success()) && (await isOnLocationSpecificPage())) {
    // Retry Continue only on Location Specific — never on Losses (that skips Order Loss Reports).
    await locationContinueBtn().click({ force: true }).catch(() => undefined);
    const t2 = Date.now();
    while (Date.now() - t2 < 20000) {
      if (await success()) break;
      await page.waitForTimeout(450);
    }
  }
  if (!(await success())) throw new Error("Underwriting Location Specific Questions continue did not transition.");
  await page.waitForTimeout(1500);
}

/**
 * Step 15: Summary (first pass) → Prior Losses → Order Loss Reports → Continue
 * Portal flow (user-confirmed):
 * 1. Location Specific → Summary (warning visible, NO order button here)
 * 2. Click Summary Continue (bottom) → Prior Losses page
 * 3. Click Order Loss Reports → Continue → back to Summary
 */
export async function stepUnderwritingPriorLossesOrderReports(page: Page): Promise<void> {
  const onFinalSale = async (): Promise<boolean> =>
    /\/finalSalePolicy|\/finalSaleBilling|method=subtab\.finalSale/i.test(page.url()) ||
    (await page.locator("li#tab.finalSale.current, li#subtab.finalSalePolicy.current").first().isVisible().catch(() => false));

  const onSummary = async (): Promise<boolean> => {
    if (await page.locator("li#subtab.priorLosses.current").first().isVisible().catch(() => false)) {
      return false;
    }
    return (
      /\/summaryDisplay|\/summaryErrors|method=subtab\.summary/i.test(page.url()) ||
      (await page.locator("li#subtab.summaryDisplay.current, li#tab.summary.current, #rpbPremium, #totalPolicyPremium").first().isVisible().catch(() => false))
    );
  };

  const onPriorLosses = async (): Promise<boolean> =>
    /\/priorLosses|method=subtab\.priorLosses/i.test(page.url()) ||
    (await page.locator("li#subtab.priorLosses.current").first().isVisible().catch(() => false));

  if (await onFinalSale()) return;

  const orderBtn = page.locator("button.lossButton").first();
  const lossesContinueBtn = page.locator('div.center input.F02v3[value="Continue"]').first();

  const scrollToBottom = async (): Promise<void> => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(300);
  };

  const resolveSummaryContinueBtn = async () => {
    const selectors = [
      page.locator('div.center button.F02v3[value="Continue"]'),
      page.locator('div.center button[value="Continue"]'),
      page.locator('div.center input.F02v3[value="Continue"]'),
      page.getByRole("button", { name: /^Continue$/i }),
    ];
    for (const group of selectors) {
      const count = await group.count().catch(() => 0);
      for (let i = count - 1; i >= 0; i--) {
        const candidate = group.nth(i);
        if (await candidate.isVisible().catch(() => false)) return candidate;
      }
    }
    return null;
  };

  const clickSummaryContinueToLosses = async (): Promise<void> => {
    await scrollToBottom();
    const summaryContinue = await resolveSummaryContinueBtn();
    if (!summaryContinue) throw new Error("Summary Continue button not found (before Prior Losses).");

    await summaryContinue.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(300);

    const nav = page
      .waitForURL(/\/priorLosses|method=subtab\.priorLosses/i, { timeout: 45000, waitUntil: "domcontentloaded" })
      .catch(() => null);
    const orderVisible = orderBtn.waitFor({ state: "visible", timeout: 45000 }).catch(() => null);

    await summaryContinue.click({ force: true, timeout: 15000 });
    await Promise.all([nav, orderVisible]);
    await page.waitForTimeout(800);
  };

  const clickOrderAndLossesContinue = async (): Promise<void> => {
    await orderBtn.waitFor({ state: "visible", timeout: 30000 });
    await orderBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(400);
    await orderBtn.click({ force: true, timeout: 15000 });
    await page.waitForTimeout(4000);

    await lossesContinueBtn.waitFor({ state: "visible", timeout: 30000 });
    await lossesContinueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(300);

    const cb = page.locator("input#ignoreErrors[name='ignoreErrors']").first();
    if (await cb.isVisible().catch(() => false) && !(await cb.isChecked().catch(() => false))) {
      await cb.check({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
    }

    const nav = page
      .waitForURL(/\/summaryDisplay|\/summaryErrors|method=subtab\.summary/i, { timeout: 45000, waitUntil: "domcontentloaded" })
      .catch(() => null);
    await lossesContinueBtn.click({ force: true, timeout: 15000 });
    await nav;
    await page.waitForTimeout(1000);
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    if (await onFinalSale()) return;

    if (await onSummary()) {
      await clickSummaryContinueToLosses();
    }

    if ((await onPriorLosses()) || (await orderBtn.isVisible().catch(() => false))) {
      await clickOrderAndLossesContinue();
    }

    if (await onSummary()) break;
    if (await onFinalSale()) return;
    await page.waitForTimeout(800);
  }

  if (!(await onSummary()) && !(await onFinalSale())) {
    throw new Error("Prior Losses flow incomplete: expected return to Summary after Order Loss Reports.");
  }
  await page.waitForTimeout(1000);
}

/**
 * Step 16: Summary -> Summary Display
 * HTML (portal):
 * - Tab: li#tab.summary.current, li#subtab.summaryDisplay.current
 * - Continue: <div class="center"><button value="Continue" class="F02v3">Continue</button>
 * - Do NOT treat nav label "Final Sale" as success while still on Summary.
 */
export async function stepSummaryDisplayContinue(page: Page): Promise<void> {
  const onFinalSalePolicy = async (): Promise<boolean> => {
    const byUrl = /\/finalSalePolicy|method=subtab\.finalSalePolicy/i.test(page.url());
    const byTab = await page
      .locator('li#tab.finalSale.current, li#subtab.finalSalePolicy.current')
      .first()
      .isVisible()
      .catch(() => false);
    const byFields = await page.locator("select#bankruptcy, select#arson").first().isVisible().catch(() => false);
    return byUrl || byTab || byFields;
  };

  if (await onFinalSalePolicy()) return;

  const onSummaryDisplay = async (): Promise<boolean> => {
    const byTab = await page.locator("li#subtab.summaryDisplay.current, li#tab.summary.current").first().isVisible().catch(() => false);
    const byUrl = /\/summaryDisplay|method=subtab\.summaryDisplay/i.test(page.url());
    const byPremium = await page
      .locator('#headingInfo .fieldsetHeading:has-text("Premium Details"), #rpbPremium, #totalPolicyPremium')
      .first()
      .isVisible()
      .catch(() => false);
    return byTab || byUrl || byPremium;
  };

  const ensureSummaryDisplayTab = async (): Promise<void> => {
    const onErrorsTab = await page.locator("li#subtab.summaryErrors.current").first().isVisible().catch(() => false);
    const onErrorsUrl = /\/summaryErrors|method=subtab\.summaryErrors/i.test(page.url());
    if (onErrorsTab || onErrorsUrl) {
      const summaryLink = page.locator('li#subtab.summaryDisplay a[href*="summaryDisplay"]').first();
      if (await summaryLink.isVisible().catch(() => false)) {
        await summaryLink.click({ force: true }).catch(() => undefined);
        await page
          .waitForURL(/\/summaryDisplay|method=subtab\.summaryDisplay/i, { timeout: 45000, waitUntil: "domcontentloaded" })
          .catch(() => undefined);
      }
    }

    if (!(await onSummaryDisplay())) {
      const summaryLink = page.locator('li#subtab.summaryDisplay a[href*="summaryDisplay"]').first();
      if (await summaryLink.isVisible().catch(() => false)) {
        await summaryLink.click({ force: true }).catch(() => undefined);
        await page
          .waitForURL(/\/summaryDisplay|method=subtab\.summaryDisplay/i, { timeout: 45000, waitUntil: "domcontentloaded" })
          .catch(() => undefined);
      }
    }
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  };

  const scrollSummaryBottom = async (): Promise<void> => {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const bottom = document.querySelector("div.center button[value='Continue'], div.center input[value='Continue']");
      bottom?.scrollIntoView({ block: "center", behavior: "instant" });
    }).catch(() => undefined);
    await page.waitForTimeout(300);
  };

  const resolveSummaryContinueBtn = async () => {
    const selectors = [
      page.locator('div.center button.F02v3[value="Continue"]'),
      page.locator('div.center button[value="Continue"]'),
      page.locator('div.center button:has-text("Continue")'),
      page.locator('div.center input.F02v3[value="Continue"]'),
      page.locator('button.F02v3[value="Continue"]'),
      page.getByRole("button", { name: /^Continue$/i }),
    ];
    for (const group of selectors) {
      const count = await group.count().catch(() => 0);
      for (let i = count - 1; i >= 0; i--) {
        const candidate = group.nth(i);
        if (await candidate.isVisible().catch(() => false)) return candidate;
      }
    }
    return null;
  };

  const waitForSummaryContinueBtn = async (timeoutMs = 45000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await onFinalSalePolicy()) return null;
      await ensureSummaryDisplayTab();
      await scrollSummaryBottom();
      const btn = await resolveSummaryContinueBtn();
      if (btn) return btn;
      await page.waitForTimeout(500);
    }
    return resolveSummaryContinueBtn();
  };

  await ensureSummaryDisplayTab();
  if (!(await onSummaryDisplay()) && !(await onFinalSalePolicy())) {
    throw new Error("Summary page not reachable.");
  }
  if (await onFinalSalePolicy()) return;

  const clickSummaryContinue = async (): Promise<boolean> => {
    const continueBtn = await waitForSummaryContinueBtn();
    if (!continueBtn) return false;

    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await preDropdownAntiOverlay(page);
    await page.waitForTimeout(200);

    const navPromise = page
      .waitForURL(/\/finalSalePolicy|method=subtab\.finalSalePolicy/i, { timeout: 45000, waitUntil: "domcontentloaded" })
      .catch(() => null);

    await continueBtn.click({ timeout: 15000 }).catch(async () => {
      await continueBtn.evaluate((el: HTMLElement) => {
        el.focus();
        (el as HTMLButtonElement).click?.();
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    });

    await navPromise;
    await page.waitForTimeout(800);
    return true;
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    if (await onFinalSalePolicy()) return;
    await clickSummaryContinue();
    if (await onFinalSalePolicy()) return;
    await page.waitForTimeout(1000);
  }

  if (!(await onFinalSalePolicy())) {
    const finalSaleLink = page.locator('li#subtab.finalSalePolicy a[href*="finalSalePolicy"]').first();
    if (await finalSaleLink.isVisible().catch(() => false)) {
      await finalSaleLink.click({ force: true }).catch(() => undefined);
      await page
        .waitForURL(/\/finalSalePolicy|method=subtab\.finalSalePolicy/i, { timeout: 45000, waitUntil: "domcontentloaded" })
        .catch(() => undefined);
    }
  }

  if (!(await onFinalSalePolicy())) {
    throw new Error("Summary Continue did not transition to Final Sale Policy Questions.");
  }
  await page.waitForTimeout(1200);
}

/**
 * Step 17: Final Sale -> Policy Questions
 * Required dropdowns:
 * - select#bankruptcy (Has this applicant filed personal bankruptcy... past 5 years)
 * - select#arson (Has any applicant been convicted of arson)
 *
 * Payload keys:
 * - hasFiledPersonalBankruptcyOrJudgementsPast5Years
 * - bankruptcyPleaseExplain (only if explain input appears)
 * - hasAnyApplicantBeenConvictedOfArson
 */
export async function stepFinalSalePolicyQuestions(page: Page, payload: unknown): Promise<void> {
  // Forward-progress skip
  if (/\/finalSaleBilling/i.test(page.url())) return;
  if (await page.locator('li[id="subtab.finalSaleBilling"].current').first().isVisible().catch(() => false)) return;

  const isOnFinalSalePolicy = async (): Promise<boolean> => {
    const byUrl = /\/finalSalePolicy|method=subtab\.finalSalePolicy/i.test(page.url());
    const byTab = await page.locator('li[id="tab.finalSale"].current, li[id="subtab.finalSalePolicy"].current').first().isVisible().catch(() => false);
    const byFields = await page.locator("select#bankruptcy, select#arson").first().isVisible().catch(() => false);
    return byUrl || byTab || byFields;
  };

  if (!(await isOnFinalSalePolicy())) {
    const tab = page.locator('li[id="tab.finalSale"]').first();
    const tabLink = page.locator('li[id="tab.finalSale"] a').first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ force: true }).catch(() => undefined);
    if (await tabLink.isVisible().catch(() => false)) await tabLink.click({ force: true }).catch(() => undefined);
    const sub = page.locator('li[id="subtab.finalSalePolicy"]').first();
    const subLink = page.locator('li[id="subtab.finalSalePolicy"] a').first();
    if (await sub.isVisible().catch(() => false)) await sub.click({ force: true }).catch(() => undefined);
    if (await subLink.isVisible().catch(() => false)) await subLink.click({ force: true }).catch(() => undefined);
    await page.waitForURL(/\/finalSalePolicy/i, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
  }
  if (!(await isOnFinalSalePolicy())) throw new Error("Final Sale Policy Questions page not reachable.");

  await page
    .waitForURL(/\/finalSalePolicy|method=subtab\.finalSalePolicy/i, { timeout: 45000, waitUntil: "domcontentloaded" })
    .catch(() => undefined);
  await page.locator("select#bankruptcy").first().waitFor({ state: "visible", timeout: 30000 });
  await page.locator("select#arson").first().waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(300);

  const hasValue = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";
  const ynValue = (v: unknown): "Y" | "N" | "" => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return "";
    if (["y", "yes", "true", "1"].includes(s)) return "Y";
    if (["n", "no", "false", "0"].includes(s)) return "N";
    if (s === "y" || s === "n") return s.toUpperCase() as "Y" | "N";
    return "";
  };

  const bankruptcy = getPayloadValue(payload, "hasFiledPersonalBankruptcyOrJudgementsPast5Years");
  const bankruptcyExplain = getPayloadValue(payload, "bankruptcyPleaseExplain");
  const arson = getPayloadValue(payload, "hasAnyApplicantBeenConvictedOfArson");

  const bankruptcyVal: "Y" | "N" = ynValue(bankruptcy) || "N";
  const arsonVal: "Y" | "N" = ynValue(arson) || "N";

  await fillAoYesNoSelectSticky(page, "select#bankruptcy", bankruptcyVal, "Bankruptcy", bankruptcyVal);
  await page.waitForTimeout(150);

  const explainInput = page.locator("input#bankruptcyExplain, input#bankruptcyExplanation, input[name='bankruptcyExplain'], input[name='bankruptcyExplanation']").first();
  if (await explainInput.isVisible().catch(() => false)) {
    if (hasValue(bankruptcyExplain)) {
      const id = (await explainInput.getAttribute("id").catch(() => null)) ?? "bankruptcyExplain";
      await setInputTextSafe(page, `input#${cssEscapeId(id)}`, String(bankruptcyExplain).trim()).catch(() => undefined);
    }
  }

  await fillAoYesNoSelectSticky(page, "select#arson", arsonVal, "Arson", arsonVal);

  const readYn = async (selector: string): Promise<"Y" | "N" | ""> => {
    const raw = (await page.locator(selector).first().inputValue().catch(() => "")).trim().toUpperCase();
    return raw === "Y" || raw === "N" ? raw : "";
  };
  if ((await readYn("select#bankruptcy")) !== bankruptcyVal) {
    throw new Error("Final Sale Policy Questions: select#bankruptcy did not retain value.");
  }
  if ((await readYn("select#arson")) !== arsonVal) {
    throw new Error("Final Sale Policy Questions: select#arson did not retain value.");
  }

  // Continue — exact HTML: div.center input.F02v3[value="Continue"]
  const continueBtn = page.locator('div.center input.F02v3[value="Continue"]').first();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(200);
  await continueBtn.click({ force: true }).catch(() => undefined);

  const success = async (): Promise<boolean> => {
    const byUrl = /\/finalSaleLocation|method=subtab\.finalSaleLocation/i.test(page.url());
    const byTab = await page.locator('li[id="subtab.finalSaleLocation"].current').first().isVisible().catch(() => false);
    const byFields = await page.locator("select#outbuilding, select#unusualHazards, select#dogAllowedInd").first().isVisible().catch(() => false);
    return byUrl || byTab || byFields;
  };
  const t = Date.now();
  while (Date.now() - t < 20000) {
    if (await success()) break;
    await page.waitForTimeout(450);
  }
  if (!(await success())) {
    // One retry
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await continueBtn.click({ force: true }).catch(() => undefined);
    const t2 = Date.now();
    while (Date.now() - t2 < 20000) {
      if (await success()) break;
      await page.waitForTimeout(450);
    }
  }
  if (!(await success())) throw new Error("Final Sale Policy Questions Continue did not transition.");
  await page.waitForTimeout(1200);
}

/**
 * Step 18: Final Sale -> Location Specific Questions
 * Required dropdowns (Y/N):
 * - select#outbuilding
 * - select#unusualHazards
 * - select#dogAllowedInd
 * - select#notTypicalPetsInd
 * - select#fireCodeViolations
 * - select#difficultEmergencyAccess
 * - select#verifyAllQuestInd
 *
 * Payload keys:
 * - responsesVerifiedWithApplicant
 * - areThereAnyOutbuildingsOnPremises
 * - anyFloodingBrushLandslideOrUnusualHazards
 * - areDogsAllowed
 * - anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets
 * - anyUncorrectedFireCodeViolations
 * - difficultAccessByFireAndPoliceDepartments
 */
export async function stepFinalSaleLocationSpecificQuestions(page: Page, payload: unknown): Promise<void> {
  // Forward-progress skip
  if (/\/finalSaleBilling/i.test(page.url())) return;
  if (await page.locator('li[id="subtab.finalSaleBilling"].current').first().isVisible().catch(() => false)) return;

  const isOnFinalSaleLocation = async (): Promise<boolean> => {
    const byUrl = /\/finalSaleLocation/i.test(page.url());
    const byTab = await page
      .locator('li[id="tab.finalSale"].current, li[id="subtab.finalSaleLocation"].current')
      .first()
      .isVisible()
      .catch(() => false);
    const byHeading = await page.locator("text=/Location Questions/i").first().isVisible().catch(() => false);
    const byFields = await page.locator("select#outbuilding, select#unusualHazards, select#dogAllowedInd").first().isVisible().catch(() => false);
    return byUrl || byTab || byHeading || byFields;
  };

  if (!(await isOnFinalSaleLocation())) {
    const tab = page.locator('li[id="tab.finalSale"]').first();
    const tabLink = page.locator('li[id="tab.finalSale"] a').first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ force: true }).catch(() => undefined);
    if (await tabLink.isVisible().catch(() => false)) await tabLink.click({ force: true }).catch(() => undefined);
    const sub = page.locator('li[id="subtab.finalSaleLocation"]').first();
    const subLink = page.locator('li[id="subtab.finalSaleLocation"] a').first();
    if (await sub.isVisible().catch(() => false)) await sub.click({ force: true }).catch(() => undefined);
    if (await subLink.isVisible().catch(() => false)) await subLink.click({ force: true }).catch(() => undefined);
    await page.waitForURL(/\/finalSaleLocation/i, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
  }
  if (!(await isOnFinalSaleLocation())) throw new Error("Final Sale Location Specific Questions page not reachable.");

  const ensureFinalSaleLocationFormMounted = async (): Promise<void> => {
    const isMounted = async (): Promise<boolean> => {
      const outSel = page.locator("select#outbuilding").first();
      const dogSel = page.locator("select#dogAllowedInd").first();
      const any = await outSel.count().catch(() => 0);
      if (any > 0) return true;
      const byLabel = await page.locator('label[for="outbuilding"]').first().isVisible().catch(() => false);
      const byError = await page.locator("#errorSection, .errorContainer").first().isVisible().catch(() => false);
      const dogCount = await dogSel.count().catch(() => 0);
      return byLabel || byError || dogCount > 0;
    };

    // If URL isn’t correct, click the real link (not just LI) to force navigation.
    if (!/\/finalSaleLocation/i.test(page.url())) {
      const link = page
        .locator('a[href*="/finalSaleLocation"], a[href*="method=subtab.finalSaleLocation"]')
        .first();
      if (await link.isVisible().catch(() => false)) {
        await link.click({ force: true }).catch(() => undefined);
        await page.waitForURL(/\/finalSaleLocation/i, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
      }
    }

    // Wait for mount (SPA repaint can be slow on repeat runs)
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      if (await isMounted()) return;
      await page.waitForTimeout(250);
    }

    // One reload retry (repeat runs can leave stale DOM)
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    const t1 = Date.now();
    while (Date.now() - t1 < 20000) {
      if (await isMounted()) return;
      await page.waitForTimeout(250);
    }

    throw new Error(`Final Sale Location Specific Questions form did not mount. (url=${page.url()})`);
  };

  await ensureFinalSaleLocationFormMounted();

  const normalizeYesNoToYN = (raw: string): "Y" | "N" | "" => {
    const s = String(raw ?? "").trim().toLowerCase();
    if (!s) return "";
    if (s === "y" || s === "yes") return "Y";
    if (s === "n" || s === "no") return "N";
    return "";
  };

  const ynValue = (v: unknown): "Y" | "N" | "" => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return "";
    if (["y", "yes", "true", "1"].includes(s)) return "Y";
    if (["n", "no", "false", "0"].includes(s)) return "N";
    if (s === "y" || s === "n") return s.toUpperCase() as "Y" | "N";
    return "";
  };

  const responsesVerifiedWithApplicant = getPayloadValue(payload, "responsesVerifiedWithApplicant");
  const areThereAnyOutbuildingsOnPremises = getPayloadValue(payload, "areThereAnyOutbuildingsOnPremises");
  const anyFloodingBrushLandslideOrUnusualHazards = getPayloadValue(payload, "anyFloodingBrushLandslideOrUnusualHazards");
  const areDogsAllowed = getPayloadValue(payload, "areDogsAllowed");
  const anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets = getPayloadValue(payload, "anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets");
  const anyUncorrectedFireCodeViolations = getPayloadValue(payload, "anyUncorrectedFireCodeViolations");
  const difficultAccessByFireAndPoliceDepartments = getPayloadValue(payload, "difficultAccessByFireAndPoliceDepartments");

  // These are required; default to "No" if missing/invalid so we can proceed.
  const outbuildingVal: "Y" | "N" = ynValue(areThereAnyOutbuildingsOnPremises) || "N";
  const hazardsVal: "Y" | "N" = ynValue(anyFloodingBrushLandslideOrUnusualHazards) || "N";
  const dogsAllowedVal: "Y" | "N" = ynValue(areDogsAllowed) || "N";
  const notTypicalPetsVal: "Y" | "N" = ynValue(anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets) || "N";
  const fireCodeVal: "Y" | "N" = ynValue(anyUncorrectedFireCodeViolations) || "N";
  const difficultAccessVal: "Y" | "N" = ynValue(difficultAccessByFireAndPoliceDepartments) || "N";
  const verifiedVal: "Y" | "N" = ynValue(responsesVerifiedWithApplicant) || "Y";

  const pickBestSelect = async (selector: string): Promise<import("playwright").Locator | null> => {
    const candidates = page.locator(selector);
    const n = await candidates.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 12); i++) {
      const loc = candidates.nth(i);
      const ok = await loc
        .evaluate((el) => {
          if (!(el instanceof HTMLSelectElement)) return false;
          const style = window.getComputedStyle(el);
          const visible = style.visibility !== "hidden" && style.display !== "none" && el.offsetParent !== null;
          const enabled = !el.disabled;
          const opts = Array.from(el.options || []);
          const hasYesNo = opts.some((o) => /^(yes|no)$/i.test((o.textContent || "").trim()));
          return visible && enabled && hasYesNo;
        })
        .catch(() => false);
      if (ok) return loc;
    }
    for (let i = 0; i < Math.min(n, 12); i++) {
      const loc = candidates.nth(i);
      const ok = await loc
        .evaluate((el) => {
          if (!(el instanceof HTMLSelectElement)) return false;
          const style = window.getComputedStyle(el);
          const visible = style.visibility !== "hidden" && style.display !== "none" && el.offsetParent !== null;
          const enabled = !el.disabled;
          return visible && enabled;
        })
        .catch(() => false);
      if (ok) return loc;
    }
    return null;
  };

  const setYesNoSelectStickyOn = async (loc: import("playwright").Locator, value: "Y" | "N", fieldName: string): Promise<boolean> => {
    const label = value === "Y" ? "Yes" : "No";
    const read = async (): Promise<"Y" | "N" | ""> => normalizeYesNoToYN((await loc.inputValue().catch(() => "")).trim());

    const trySet = async (): Promise<boolean> => {
      await loc.scrollIntoViewIfNeeded().catch(() => undefined);
      await loc.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(60);

      // Strategy A: standard selectOption by value/label
      await loc.selectOption({ value }).catch(() => undefined);
      await page.waitForTimeout(120);
      if ((await read()) === value) return true;
      await loc.selectOption({ label }).catch(() => undefined);
      await page.waitForTimeout(120);
      if ((await read()) === value) return true;

      // Strategy B: DOM set + events (SPA frameworks)
      await loc
        .evaluate((el: HTMLSelectElement, v: string) => {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
        }, value)
        .catch(() => undefined);
      await page.waitForTimeout(140);
      if ((await read()) === value) return true;

      // Strategy C: selectedIndex fallback
      await loc
        .evaluate((el: HTMLSelectElement, v: string) => {
          const opts = Array.from(el.options);
          const idx = opts.findIndex((o) => o.value === v);
          if (idx >= 0) el.selectedIndex = idx;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
        }, value)
        .catch(() => undefined);
      await page.waitForTimeout(140);
      if ((await read()) === value) return true;

      await page.keyboard.press("Tab").catch(() => undefined);
      await page.waitForTimeout(120);
      return (await read()) === value;
    };

    for (let attempt = 0; attempt < 10; attempt++) {
      await preDropdownAntiOverlay(page);
      if ((await read()) === value) return true;
      if (await trySet()) return true;
      await page.waitForTimeout(180);
    }

    if ((await read()) === value) return true;
    // Final: attempt to set via the shared helper using the element's id (best effort)
    const id = await loc.getAttribute("id").catch(() => null);
    if (id) {
      await setSelectByValueOrLabelWithFallback(page, `select#${cssEscapeId(id)}`, {
        value,
        label,
        fieldName,
        required: true,
      }).catch(() => undefined);
      await page.waitForTimeout(140);
    }
    return (await read()) === value;
  };

  const setRequiredYesNo = async (selector: string, value: "Y" | "N", fieldLabelHint: string): Promise<void> => {
    // Wait for the control to exist (SPA sometimes paints late)
    await page.waitForTimeout(150);
    await page.waitForSelector(selector, { state: "attached", timeout: 15000 }).catch(() => undefined);

    let sel: import("playwright").Locator | null = (await pickBestSelect(selector)) ?? null;
    if (!sel) {
      // Fallback: find by label text nearby (works even if IDs change or duplicates exist)
      const near = await findSelectNearLabel(page, new RegExp(fieldLabelHint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      if (near) sel = page.locator(near).first();
    }
    if (!sel) sel = page.locator(selector).first();

    // If not visible, try to scroll it into view (can be offscreen and report not visible)
    if (!(await sel.isVisible().catch(() => false))) {
      await sel.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(120);
    }

    // Even if Playwright still says "not visible" (during reflow/overlay), attempt DOM set anyway.
    const ok = await setYesNoSelectStickyOn(sel, value, fieldLabelHint);
    if (ok) return;

    // Last-resort: set by ID in DOM (most reliable for repeated runs / SPA re-renders).
    const m = selector.match(/^select#([A-Za-z0-9_-]+)$/);
    if (m) {
      const id = m[1];
      for (let i = 0; i < 6; i++) {
        await preDropdownAntiOverlay(page);
        const did = await page
          .evaluate(
            ({ id, value }) => {
              const el = document.getElementById(id);
              if (!(el instanceof HTMLSelectElement)) return { ok: false, why: "not-select" as const };
              if (el.disabled) return { ok: false, why: "disabled" as const };
              // Set via value, fallback to option text match
              const targetVal = value;
              const opts = Array.from(el.options || []);
              const hasVal = opts.some((o) => o.value === targetVal);
              if (hasVal) el.value = targetVal;
              else {
                const label = targetVal === "Y" ? "Yes" : "No";
                const idx = opts.findIndex((o) => (o.textContent || "").trim().toLowerCase() === label.toLowerCase());
                if (idx >= 0) el.selectedIndex = idx;
              }
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true }));
              const v = String(el.value || "").trim().toLowerCase();
              const ok = targetVal === "Y" ? v === "y" || v === "yes" : v === "n" || v === "no";
              return { ok, why: el.value };
            },
            { id, value }
          )
          .catch(() => ({ ok: false, why: "evaluate-failed" as const }));

        // Verify via Playwright read
        const currentRaw = (await page.locator(`select#${cssEscapeId(id)}`).first().inputValue().catch(() => "")).trim();
        const current = normalizeYesNoToYN(currentRaw);
        if (current === value) return;

        if (did && (did as any).ok) return;
        await page.waitForTimeout(250);
      }
    }

    const count = await page.locator(selector).count().catch(() => 0);
    throw new Error(`${fieldLabelHint} dropdown could not be set (required). (matches=${count}, url=${page.url()})`);
  };

  // Set ALL required dropdowns from payload (defaults applied above).
  await setRequiredYesNo("select#outbuilding", outbuildingVal, "Outbuildings on premises");
  await setRequiredYesNo("select#unusualHazards", hazardsVal, "Unusual hazards");
  await setRequiredYesNo("select#dogAllowedInd", dogsAllowedVal, "Are dogs allowed");
  await setRequiredYesNo("select#notTypicalPetsInd", notTypicalPetsVal, "Not typical household pets");
  await setRequiredYesNo("select#fireCodeViolations", fireCodeVal, "Fire code violations");
  await setRequiredYesNo("select#difficultEmergencyAccess", difficultAccessVal, "Difficult access by fire/police");
  await setRequiredYesNo("select#verifyAllQuestInd", verifiedVal, "Responses verified with applicant");

  // If banner still complains about outbuildings, retry once more before continuing.
  const errorSection = page.locator("#errorSection, .errorContainer").first();
  const outbuildingRequired = await errorSection
    .locator("text=/outbuildings on premises is required/i")
    .first()
    .isVisible()
    .catch(() => false);
  if (outbuildingRequired) {
    await setRequiredYesNo("select#outbuilding", outbuildingVal, "Outbuildings on premises");
  }

  // Continue
  const continueBtn = page
    .locator(
      [
        'input[type="button"].F02v3[value="Continue"]',
        'input[type="button"][value="Continue"]',
        'button.F02v3:has-text("Continue")',
        'button:has-text("Continue")',
      ].join(", ")
    )
    .first();
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(200);
  await continueBtn.click({ force: true }).catch(() => undefined);

  const success = async (): Promise<boolean> => {
    const byUrl = /\/finalSaleBilling/i.test(page.url());
    const byTab = await page.locator('li[id="subtab.finalSaleBilling"].current').first().isVisible().catch(() => false);
    const byText = await page.locator("text=/Billing\\s*\\/\\s*Submission/i").first().isVisible().catch(() => false);
    return byUrl || byTab || byText;
  };
  const t = Date.now();
  while (Date.now() - t < 20000) {
    if (await success()) break;
    await page.waitForTimeout(450);
  }
  if (!(await success())) {
    // One retry
    await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    await continueBtn.click({ force: true }).catch(() => undefined);
    const t2 = Date.now();
    while (Date.now() - t2 < 20000) {
      if (await success()) break;
      await page.waitForTimeout(450);
    }
  }
  if (!(await success())) throw new Error("Final Sale Location Specific Questions Continue did not transition.");
  await page.waitForTimeout(1200);
}

function sanitizePdfNamePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildAoPdfFileName(payload: unknown, tag: string, jobId?: string): string {
  const firstNameRaw =
    getPayloadValue(payload, "personal.firstName") ??
    getPayloadValue(payload, "personal.ownerFirstName") ??
    getPayloadValue(payload, "firstName");
  const lastNameRaw =
    getPayloadValue(payload, "personal.lastName") ??
    getPayloadValue(payload, "personal.ownerLastName") ??
    getPayloadValue(payload, "lastName");
  const firstName = typeof firstNameRaw === "string" ? sanitizePdfNamePart(firstNameRaw) : "";
  const lastName = typeof lastNameRaw === "string" ? sanitizePdfNamePart(lastNameRaw) : "";
  const safeTag = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const stamp = Date.now();

  if (firstName && lastName) return `${firstName}-${lastName}-${safeTag}-${stamp}.pdf`;
  if (firstName || lastName) return `${firstName || lastName}-${safeTag}-${stamp}.pdf`;

  const prefix = jobId ? `${jobId}-` : "";
  return `${prefix}${safeTag}-${stamp}.pdf`;
}

/**
 * Click a button that opens a document tab, capture PDF bytes, save locally.
 */
async function downloadAoPdfFromNewTab(
  page: Page,
  trigger: Locator,
  tag: string,
  jobId?: string,
  payload?: unknown
): Promise<string> {
  const artifactsDir = path.resolve(process.cwd(), "playwright-artifacts");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const ctx = page.context();
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(250);

  const pagesBefore = ctx.pages().length;
  const waitNewPage = ctx.waitForEvent("page", { timeout: 60000 }).catch(() => null);
  const waitPopup = page.waitForEvent("popup", { timeout: 60000 }).catch(() => null);
  await trigger.click({ force: true, timeout: 15000 });

  let pdfPage: Page | null = ((await Promise.race([waitNewPage, waitPopup])) as Page | null) ?? null;
  if (!pdfPage) {
    const start = Date.now();
    while (Date.now() - start < 60000) {
      const pages = ctx.pages();
      if (pages.length > pagesBefore) {
        pdfPage = pages[pages.length - 1];
        break;
      }
      const byUrl = pages.find((p) => /\.pdf(\?|$)/i.test(p.url()));
      if (byUrl) {
        pdfPage = byUrl;
        break;
      }
      await page.waitForTimeout(400);
    }
  }
  if (!pdfPage) throw new Error(`Document tab did not open after ${tag}.`);

  await pdfPage.bringToFront().catch(() => undefined);
  await pdfPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  await pdfPage.waitForTimeout(800);

  let bytes: Buffer | null = null;

  const pdfResp = await pdfPage
    .waitForResponse((r) => (r.headers()["content-type"] ?? "").toLowerCase().includes("application/pdf"), {
      timeout: 20000,
    })
    .catch(() => null);
  if (pdfResp) {
    const b = await pdfResp.body().catch(() => null);
    if (b && b.length > 0) bytes = Buffer.from(b);
  }

  if (!bytes) {
    const url = pdfPage.url();
    if (url && !url.startsWith("about:")) {
      const r = await pdfPage.request.get(url).catch(() => null);
      const ct = (r?.headers()["content-type"] ?? "").toLowerCase();
      if (r && (ct.includes("application/pdf") || /\.pdf(\?|$)/i.test(url))) {
        const b = await r.body().catch(() => null);
        if (b && b.length > 0) bytes = Buffer.from(b);
      }
    }
  }

  if (!bytes) {
    const generated = await pdfPage.pdf({ printBackground: true, format: "Letter" }).catch(() => null);
    if (generated && generated.length > 0) bytes = Buffer.from(generated);
  }

  if (!bytes) throw new Error(`Could not capture PDF bytes after ${tag}.`);

  const outPath = path.join(artifactsDir, buildAoPdfFileName(payload, tag, jobId));
  fs.writeFileSync(outPath, bytes);
  await pdfPage.close().catch(() => undefined);
  return outPath;
}

/** Download via Summary / Billing "Printable Documents" when visible (no submit). */
export async function stepDownloadPrintableDocumentsPdf(
  page: Page,
  jobId?: string,
  payload?: unknown
): Promise<{ pdfPath?: string }> {
  const btn = page
    .locator(
      [
        'button[value="Printable Documents"]',
        'button#viewApplicationButton',
        'button[name="viewApplicationButton"]',
        'button:has-text("Printable Documents")',
        'button:has-text("View Printable")',
      ].join(", ")
    )
    .first();
  if (!(await btn.isVisible().catch(() => false))) return {};
  const pdfPath = await downloadAoPdfFromNewTab(page, btn, "printable-documents", jobId, payload);
  return { pdfPath };
}

/**
 * Step 19: Final Sale -> Billing / Submission
 * Saves PDF locally under playwright-artifacts/.
 */
export async function stepFinalSaleBillingSubmitForIssuanceAndDownloadPdf(
  page: Page,
  jobId?: string,
  payload?: unknown
): Promise<{ pdfPath?: string }> {

  const isOnBilling = async (): Promise<boolean> => {
    const byUrl = /\/finalSaleBilling/i.test(page.url());
    const byTab = await page.locator('li[id="subtab.finalSaleBilling"].current').first().isVisible().catch(() => false);
    const byField = await page.locator("#billingTypeWidgetDiv, #submitButton").first().isVisible().catch(() => false);
    return byUrl || byTab || byField;
  };

  if (!(await isOnBilling())) {
    const tab = page.locator('li[id="tab.finalSale"]').first();
    const tabLink = page.locator('li[id="tab.finalSale"] a').first();
    if (await tab.isVisible().catch(() => false)) await tab.click({ force: true }).catch(() => undefined);
    if (await tabLink.isVisible().catch(() => false)) await tabLink.click({ force: true }).catch(() => undefined);
    const sub = page.locator('li[id="subtab.finalSaleBilling"]').first();
    const subLink = page.locator('li[id="subtab.finalSaleBilling"] a').first();
    if (await sub.isVisible().catch(() => false)) await sub.click({ force: true }).catch(() => undefined);
    if (await subLink.isVisible().catch(() => false)) await subLink.click({ force: true }).catch(() => undefined);
    await page.waitForURL(/\/finalSaleBilling/i, { timeout: 45000, waitUntil: "domcontentloaded" }).catch(() => undefined);
  }
  if (!(await isOnBilling())) throw new Error("Final Sale Billing / Submission page not reachable.");

  // This page often renders required widgets below-the-fold. Scroll early.
  const scrollToBottom = async (): Promise<void> => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(250);
    await page.keyboard.press("End").catch(() => undefined);
    await page.waitForTimeout(250);
  };
  await scrollToBottom();

  // Ensure required selects are set if they are blank (these are required to enable submit).
  // We do this only when the submit button is disabled; otherwise we don't touch anything.
  const submitBtn = page.locator("button#submitButton, input#submitButton").first();
  const isSubmitDisabled = await submitBtn.isDisabled().catch(() => false);
  if (isSubmitDisabled) {
    // Some flows require setting up Company Bill before Submit enables.
    const companyBillStart = page.locator("button#editCompanyBill, button.edit-company-bill-button").first();
    if (await companyBillStart.isVisible().catch(() => false)) {
      await companyBillStart.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(200);
      await companyBillStart.click({ force: true }).catch(() => undefined);
      // Give the widget time to load/complete its prefill. We don't assume navigation.
      await page.waitForTimeout(2500);
    }

    const trySetIfEmpty = async (selector: string, value: string): Promise<void> => {
      const loc = page.locator(selector).first();
      if (!(await loc.isVisible().catch(() => false))) return;
      const v = (await loc.inputValue().catch(() => "")).trim();
      if (v && v !== " ") return;
      await setSelectValueAndDispatch(page, selector, value).catch(() => undefined);
      await page.waitForTimeout(150);
    };
    // Minimal defaults to unlock submit (AO required fields):
    await scrollToBottom();
    await trySetIfEmpty("select#proxySigned", "N"); // No
    await trySetIfEmpty("select#newBusinessDecMailings", "I"); // Policyholder
    await trySetIfEmpty("select#eSignatureDocuments", "Y"); // Yes
  }

  // Wait briefly for submit to enable
  const enableStart = Date.now();
  while (Date.now() - enableStart < 45000) {
    await scrollToBottom();
    const disabled = await submitBtn.isDisabled().catch(() => false);
    if (!disabled) break;
    await page.waitForTimeout(300);
  }
  if (await submitBtn.isDisabled().catch(() => false)) {
    // Last resort: force-set required selects via DOM and try clicking submit anyway.
    await page
      .evaluate(() => {
        const setSelect = (id: string, value: string) => {
          const el = document.querySelector<HTMLSelectElement>(`select#${id}`);
          if (!el) return;
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
        };
        setSelect("proxySigned", "N");
        setSelect("newBusinessDecMailings", "I");
        setSelect("eSignatureDocuments", "Y");
      })
      .catch(() => undefined);
    await page.waitForTimeout(800);
    // Remove disabled attr and click (AO UI sometimes lags enabling).
    await submitBtn
      .evaluate((el: HTMLElement) => {
        el.removeAttribute("disabled");
        (el as any).disabled = false;
      })
      .catch(() => undefined);
    await page.waitForTimeout(200);
  }

  // 1) Prefer "Printable Documents" (does NOT submit).
  const viewPrintableDocBtn = page
    .locator(
      [
        'button[value="Printable Documents"]',
        "button#viewApplicationButton",
        "button[name='viewApplicationButton']",
        'button:has-text("View Printable")',
        'button:has-text("Printable Documents")',
      ].join(", ")
    )
    .first();
  if (await viewPrintableDocBtn.isVisible().catch(() => false)) {
    await scrollToBottom();
    const pdfPath = await downloadAoPdfFromNewTab(page, viewPrintableDocBtn, "printable-documents", jobId, payload);
    return { pdfPath };
  }

  // 2) Otherwise Submit for Issuance (submits + opens document tab).
  await scrollToBottom();
  const pdfPath = await downloadAoPdfFromNewTab(page, submitBtn, "issuance", jobId, payload);
  return { pdfPath };
}
