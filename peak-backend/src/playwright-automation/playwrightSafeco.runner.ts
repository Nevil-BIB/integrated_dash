import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page } from "playwright";
import { logger } from "../utils/logger";
import { playwrightSafecoJobStore } from "./playwrightSafeco.job-store";
import type {
  PlaywrightSafecoRunRequest,
  PlaywrightSafecoWebhookOtpPayload,
} from "./playwrightSafeco.types";

type GenericFieldEntry = { key?: unknown; value?: unknown };

type SafecoQuoteSetup = {
  ratingState: string;
  policyForm: string;
  agentNumber: string;
  quoteDate: string;
  effectiveDate: string;
  agencyCustomerId?: string;
  quoteDescription?: string;
};

type SafecoApplicant = {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  maritalStatus: string;
  coApplicantPresent: "Yes" | "No";
  coApplicantFirstName?: string;
  coApplicantLastName?: string;
  coApplicantBirthDate?: string;
  coApplicantMaritalStatus?: string;
  applicantSSN?: string;
  relationshipToInsured?: string;
  coApplicantSSN?: string;
  primaryPhone: string;
  email?: string;
  reasonForPolicy: string;
  additionalInterestsPresent: "Yes" | "No";
};

type SafecoAddress = {
  mailingAddressLine1: string;
  mailingAddressLine2?: string;
  mailingCity: string;
  mailingState: string;
  mailingZipCode: string;
  locationSameAsMailing: "Yes" | "No";
  locationAddressLine1?: string;
  locationAddressLine2?: string;
  locationCity?: string;
  locationState?: string;
  locationZipCode?: string;
};

type SafecoUnderwriting = {
  underConstruction: "Yes" | "No";
  constructionCompletedWithin12Months?: "Yes" | "No";
  licensedContractor?: "Yes" | "No";
  contractorNamedInsured?: "Yes" | "No";
  businessOnPremises: "Yes" | "No";
  businessType?: string;
  businessExplanation?: string;
  businessIncidental?: "Yes" | "No";
  businessEmployees?: string;
  rentedToOthers: "Yes" | "No";
  undesirableAnimal: "Yes" | "No";
  dogsOwned: string;
  dogBreed?: "Yes" | "No";
  horsesLivestock: "Yes" | "No";
  monthsOccupied: string;
  currentlyInsured: string;
  currentCarrier?: string;
  dwellingHazards: "Yes" | "No";
  dwellingHazardDetails?: string[];
  occupants: string;
  insuranceCancelled: "Yes" | "No";
  insuranceCancellationExplanation?: string;
  lossesLastFiveYears: string;
  ownershipMonth: string;
  ownershipYear: string;
  hasOtherSafecoPolicy?: "Yes" | "No";
  policyType?: string;
  policyNumber?: string;
  notYetIssued?: "Yes" | "No";
};

type SafecoDwellingInformation = {
  outdatedElectrical: "Yes" | "No";
  dwellingLocatedIn: string;
  roofMaterial?: string;
  roofRenovation: string;
  roofRenovationYear?: string;
  plumbingRenovation: string;
  plumbingRenovationYear?: string;
  fireSprinkler?: string;
};

type SafecoPayload = {
  quoteSetup: SafecoQuoteSetup;
  applicant: SafecoApplicant;
  address: SafecoAddress;
  underwriting: SafecoUnderwriting;
  dwellingInformation: SafecoDwellingInformation;
};

const SAFECO_POLICY_INFO_URL = "https://personal.safeco.com/Personal/home/PolicyInfo.aspx?ModeID=2";

const STATE_NAME_BY_CODE: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

async function launchChromiumWithFallback(options: LaunchOptions): Promise<Browser> {
  const preferredPath = String(process.env.PLAYWRIGHT_CHROME_PATH ?? "").trim();
  const attempts: Array<{ label: string; opts: LaunchOptions }> = [];

  if (preferredPath) {
    attempts.push({ label: `executablePath=${preferredPath}`, opts: { ...options, executablePath: preferredPath } });
  }
  attempts.push({ label: "channel=chrome", opts: { ...options, channel: "chrome" } });
  attempts.push({ label: "bundled-chromium", opts: options });

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await chromium.launch(attempt.opts);
    } catch (err) {
      lastError = err;
      logger.warn("[Safeco] Browser launch attempt failed", {
        attempt: attempt.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function unwrapFieldValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  if (Object.prototype.hasOwnProperty.call(value, "value")) {
    return (value as { value?: unknown }).value;
  }
  return value;
}

function getPathValue(source: unknown, pathKey: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  return pathKey.split(".").reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, source);
}

function toStringOrUndefined(value: unknown): string | undefined {
  const next = unwrapFieldValue(value);
  if (next == null) return undefined;
  const text = String(next).trim();
  return text.length > 0 ? text : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  const next = unwrapFieldValue(value);
  if (next == null) return undefined;
  if (Array.isArray(next)) {
    const values = next
      .map((item) => String(unwrapFieldValue(item) ?? "").trim())
      .filter((item) => item.length > 0);
    return values.length ? values : undefined;
  }
  const text = String(next).trim();
  if (!text) return undefined;
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const values = parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
        return values.length ? values : undefined;
      }
    } catch {
      // ignore parse failure and fall through to split
    }
  }
  const split = text.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
  return split.length ? split : [text];
}

function toYesNoOrUndefined(value: unknown): "Yes" | "No" | undefined {
  const raw = toStringOrUndefined(value);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) return "Yes";
  if (["no", "n", "false", "0"].includes(normalized)) return "No";
  if (raw === "Yes" || raw === "No") return raw;
  return undefined;
}

function normalizeStateLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  if (clean.includes(" - ")) {
    return clean.split(" - ").at(-1)?.trim() || clean;
  }
  const maybeCode = clean.toUpperCase();
  if (STATE_NAME_BY_CODE[maybeCode]) return STATE_NAME_BY_CODE[maybeCode];
  return clean;
}

function toMmDdYyyy(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const yyyy = slashMatch[3];
    if (first > 12 && second >= 1 && second <= 12) {
      // dd/mm/yyyy -> mm/dd/yyyy
      return `${String(second).padStart(2, "0")}/${String(first).padStart(2, "0")}/${yyyy}`;
    }
    // mm/dd/yyyy
    return `${String(first).padStart(2, "0")}/${String(second).padStart(2, "0")}/${yyyy}`;
  }

  const dashDmyMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (dashDmyMatch) {
    const dd = Number(dashDmyMatch[1]);
    const mm = Number(dashDmyMatch[2]);
    const yyyy = dashDmyMatch[3];
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${String(mm).padStart(2, "0")}/${String(dd).padStart(2, "0")}/${yyyy}`;
    }
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const yyyy = String(parsed.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  }

  return fallback;
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  return `${mm}/${dd}/${yyyy}`;
}

function parseMmDdYyyy(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const m = Number(match[1]);
  const d = Number(match[2]);
  const y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function clampMmDdYyyyToMax(value: string, maxValue: string): string {
  const a = parseMmDdYyyy(value);
  const b = parseMmDdYyyy(maxValue);
  if (!a || !b) return value;
  if (a.y > b.y) return maxValue;
  if (a.y < b.y) return value;
  if (a.m > b.m) return maxValue;
  if (a.m < b.m) return value;
  if (a.d > b.d) return maxValue;
  return value;
}

function formatToday(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function formatTodayPlusDays(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function normalizeSafecoPayload(raw: unknown): SafecoPayload {
  const obj = asRecord(raw);
  const fieldEntries: GenericFieldEntry[] = Array.isArray(obj.fields) ? (obj.fields as GenericFieldEntry[]) : [];
  const fieldMap = new Map<string, unknown>();
  for (const entry of fieldEntries) {
    const key = toStringOrUndefined(entry?.key);
    if (!key) continue;
    fieldMap.set(key, unwrapFieldValue(entry?.value));
  }

  const pickRaw = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (fieldMap.has(key)) return fieldMap.get(key);
      const direct = getPathValue(obj, key);
      if (direct !== undefined) return direct;
    }
    return undefined;
  };

  const pickString = (...keys: string[]): string | undefined => {
    return toStringOrUndefined(pickRaw(...keys));
  };

  const pickYesNo = (...keys: string[]): "Yes" | "No" | undefined => {
    return toYesNoOrUndefined(pickRaw(...keys));
  };
  const pickStringArray = (...keys: string[]): string[] | undefined => {
    return toStringArray(pickRaw(...keys));
  };

  const safecoTodayEt = formatDateInTimeZone(new Date(), "America/New_York");
  const fallbackQuoteDate = safecoTodayEt;
  const fallbackEffectiveDate = formatTodayPlusDays(7);
  const fallbackOwnershipDate = new Date();
  const defaultOwnershipMonth = fallbackOwnershipDate.toLocaleString("en-US", { month: "long" });
  const defaultOwnershipYear = String(fallbackOwnershipDate.getFullYear());

  const quoteSetup: SafecoQuoteSetup = {
    ratingState:
      normalizeStateLabel(pickString("quoteSetup.ratingState", "address.mailingState", "personal.state")) ??
      "Alabama",
    policyForm: pickString("quoteSetup.policyForm") ?? "Homeowners",
    agentNumber:
      pickString("quoteSetup.agentNumber") ??
      toStringOrUndefined(process.env.SAFECO_AGENT_NUMBER) ??
      "40-0591",
    quoteDate: clampMmDdYyyyToMax(
      toMmDdYyyy(pickString("quoteSetup.quoteDate"), fallbackQuoteDate),
      safecoTodayEt,
    ),
    effectiveDate: toMmDdYyyy(
      pickString("quoteSetup.effectiveDate", "insuranceDetails.effectiveDate"),
      fallbackEffectiveDate,
    ),
    agencyCustomerId: pickString("quoteSetup.agencyCustomerId"),
    quoteDescription: pickString("quoteSetup.quoteDescription"),
  };

  const applicant: SafecoApplicant = {
    firstName: pickString("applicant.firstName", "personal.firstName") ?? "",
    middleName: pickString("applicant.middleName", "personal.middleName"),
    lastName: pickString("applicant.lastName", "personal.lastName") ?? "",
    birthDate: toMmDdYyyy(pickString("applicant.birthDate", "personal.dateOfBirth"), ""),
    maritalStatus: pickString("applicant.maritalStatus", "personal.maritalStatus") ?? "Married",
    coApplicantPresent: pickYesNo("applicant.coApplicantPresent") ?? "No",
    coApplicantFirstName: pickString("applicant.coApplicantFirstName", "personal.spouseFirstName"),
    coApplicantLastName: pickString("applicant.coApplicantLastName", "personal.spouseLastName"),
    coApplicantBirthDate: toMmDdYyyy(pickString("applicant.coApplicantBirthDate", "personal.spouseDateOfBirth"), ""),
    coApplicantMaritalStatus: pickString("applicant.coApplicantMaritalStatus", "personal.spouseMaritalStatus"),
    applicantSSN: pickString("applicant.applicantSSN", "personal.ssn"),
    relationshipToInsured: pickString("applicant.relationshipToInsured", "personal.relationshipToInsured"),
    coApplicantSSN: pickString("applicant.coApplicantSSN", "personal.spouseSsn"),
    primaryPhone: pickString("applicant.primaryPhone", "personal.phone") ?? "",
    email: pickString("applicant.email", "personal.email"),
    reasonForPolicy:
      pickString("applicant.reasonForPolicy", "insuranceDetails.reasonForPolicy") ??
      "New property customer to Safeco",
    additionalInterestsPresent: pickYesNo("applicant.additionalInterestsPresent") ?? "No",
  };
  if (applicant.coApplicantPresent === "Yes" && !applicant.relationshipToInsured) {
    // Carrier requires this when a co-applicant exists; default safely if omitted in payload.
    applicant.relationshipToInsured = "Spouse";
  }

  const addressState = normalizeStateLabel(
    pickString("address.mailingState", "personal.address.state", "personal.state"),
  );
  const address: SafecoAddress = {
    mailingAddressLine1:
      pickString("address.mailingAddressLine1", "personal.address.street", "personal.address") ?? "",
    mailingAddressLine2: pickString("address.mailingAddressLine2"),
    mailingCity: pickString("address.mailingCity", "personal.address.city", "personal.city") ?? "",
    mailingState: addressState ?? "Alabama",
    mailingZipCode: pickString("address.mailingZipCode", "personal.address.zipCode", "personal.zipCode") ?? "",
    locationSameAsMailing: pickYesNo("address.locationSameAsMailing", "insuranceDetails.propertySameAsMailing") ?? "Yes",
    locationAddressLine1: pickString("address.locationAddressLine1"),
    locationAddressLine2: pickString("address.locationAddressLine2"),
    locationCity: pickString("address.locationCity"),
    locationState: normalizeStateLabel(pickString("address.locationState")),
    locationZipCode: pickString("address.locationZipCode"),
  };

  const underwriting: SafecoUnderwriting = {
    underConstruction: pickYesNo("underwriting.underConstruction", "home.property.homeUnderConstruction") ?? "No",
    constructionCompletedWithin12Months: pickYesNo("underwriting.constructionCompletedWithin12Months"),
    licensedContractor: pickYesNo("underwriting.licensedContractor"),
    contractorNamedInsured: pickYesNo("underwriting.contractorNamedInsured"),
    businessOnPremises: pickYesNo("underwriting.businessOnPremises", "home.occupancy.businessOnPremises") ?? "No",
    businessType: pickString("underwriting.businessType"),
    businessExplanation: pickString("underwriting.businessExplanation"),
    businessIncidental: pickYesNo("underwriting.businessIncidental"),
    businessEmployees: pickString("underwriting.businessEmployees"),
    rentedToOthers: pickYesNo("underwriting.rentedToOthers", "home.occupancy.shortTermRental") ?? "No",
    undesirableAnimal: pickYesNo("underwriting.undesirableAnimal", "home.safety.dog") ?? "No",
    dogsOwned: pickString("underwriting.dogsOwned") ?? "0",
    dogBreed: pickYesNo("underwriting.dogBreed", "home.safety.dogBreed"),
    horsesLivestock: pickYesNo("underwriting.horsesLivestock", "home.occupancy.horsesOrLivestock") ?? "No",
    monthsOccupied: pickString("underwriting.monthsOccupied") ?? "12 (Primary)",
    currentlyInsured:
      pickString("underwriting.currentlyInsured", "insuranceDetails.currentlyInsured") ?? "No, Unknown Reason",
    currentCarrier: pickString("underwriting.currentCarrier", "insuranceDetails.currentInsuranceCompany"),
    dwellingHazards: pickYesNo("underwriting.dwellingHazards") ?? "No",
    dwellingHazardDetails: pickStringArray(
      "underwriting.dwellingHazardDetails",
      "underwriting.dwellingHazardsDetails",
      "underwriting.hazardDetails",
      "underwriting.hazardTypes",
      "underwriting.testField",
    ),
    occupants: pickString("underwriting.occupants", "home.occupancy.numberOfDrivers") ?? "2",
    insuranceCancelled: pickYesNo("underwriting.insuranceCancelled", "insuranceDetails.insuranceCancelledDeclined") ?? "No",
    insuranceCancellationExplanation: pickString(
      "underwriting.insuranceCancellationExplanation",
      "insuranceDetails.cancelDeclineDetails",
    ),
    lossesLastFiveYears: pickString("underwriting.lossesLastFiveYears", "insuranceDetails.numberOfLosses5Years") ?? "0",
    ownershipMonth: pickString("underwriting.ownershipMonth") ?? defaultOwnershipMonth,
    ownershipYear: pickString("underwriting.ownershipYear") ?? defaultOwnershipYear,
    hasOtherSafecoPolicy: pickYesNo("underwriting.hasOtherSafecoPolicy"),
    policyType: pickString("underwriting.policyType"),
    policyNumber: pickString("underwriting.policyNumber"),
    notYetIssued: pickYesNo("underwriting.notYetIssued"),
  };

  const dwellingInformation: SafecoDwellingInformation = {
    outdatedElectrical: pickYesNo("dwellingInformation.outdatedElectrical") ?? "No",
    dwellingLocatedIn: pickString("dwellingInformation.dwellingLocatedIn", "home.property.dwellingLocatedIn") ?? "Suburb",
    roofMaterial: pickString("dwellingInformation.roofMaterial", "home.property.roofMaterial"),
    roofRenovation: pickString("dwellingInformation.roofRenovation", "home.updates.roofUpdate") ?? "None",
    roofRenovationYear: pickString("dwellingInformation.roofRenovationYear", "home.updates.roofYear"),
    plumbingRenovation: pickString("dwellingInformation.plumbingRenovation", "home.updates.plumbingUpdate") ?? "None",
    plumbingRenovationYear: pickString("dwellingInformation.plumbingRenovationYear", "home.updates.plumbingYear"),
    fireSprinkler: pickString("dwellingInformation.fireSprinkler"),
  };

  return {
    quoteSetup,
    applicant,
    address,
    underwriting,
    dwellingInformation,
  };
}

function hasQuoteDateFutureValidation(items: string[]): boolean {
  return items.some((item) => /quote date.*cannot be in the future/i.test(item));
}

async function forceSafecoQuoteDateToToday(page: Page): Promise<void> {
  const todayEt = formatDateInTimeZone(new Date(), "America/New_York");
  const quoteDateSelectors = ["#PolicyQuoteDate", 'input[id*="PolicyQuoteDate"]', 'input[id*="QuoteDate"]'];
  for (const selector of quoteDateSelectors) {
    const input = page.locator(selector).first();
    if (!(await input.count().catch(() => 0))) continue;
    const editable = await input
      .evaluate((el) => {
        const node = el as HTMLInputElement;
        return !node.disabled && !node.readOnly;
      })
      .catch(() => false);
    if (!editable) continue;
    await input.fill(todayEt).catch(() => undefined);
    await input.dispatchEvent("input").catch(() => undefined);
    await input.dispatchEvent("change").catch(() => undefined);
    await input.dispatchEvent("blur").catch(() => undefined);
    const current = await input.inputValue().catch(() => "");
    if (current.trim()) return;
  }
}

async function closeSafecoModal(page: Page): Promise<void> {
  const modal = page.locator(".modalDialog, .ecdev-MessageModal, .ui-dialog").first();
  const modalVisible = await modal.isVisible().catch(() => false);
  if (!modalVisible) return;

  const closeCandidates = [
    ".ui-dialog-titlebar-close",
    "button.ui-dialog-titlebar-close",
    ".modalDialog .ui-dialog-titlebar-close",
    ".ecdev-MessageModal .ui-dialog-titlebar-close",
    'button[aria-label*="Close"]',
    'button[title*="Close"]',
    'button:has-text("Close")',
    'a:has-text("Close")',
  ];

  for (const selector of closeCandidates) {
    const closeButton = page.locator(selector).first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ force: true }).catch(() => undefined);
      return;
    }
  }

  await page.keyboard.press("Escape").catch(() => undefined);
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function exists(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count().catch(() => 0)) > 0;
}

async function waitForAnyAttached(
  page: Page,
  selectors: string[],
  timeoutMs = 8000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      if (await exists(page, selector)) return selector;
    }
    await page.waitForTimeout(100).catch(() => undefined);
  }
  return null;
}

async function fillIfPresent(page: Page, selector: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const locator = page.locator(selector).first();
  if (!(await locator.count().catch(() => 0))) return;
  await locator.fill(value).catch(() => undefined);
}

async function selectByLabelOrValue(page: Page, selector: string, rawValue: string | undefined): Promise<void> {
  if (!rawValue) return;
  const value = rawValue.trim();
  if (!value) return;
  const locator = page.locator(selector).first();
  if (!(await locator.count().catch(() => 0))) return;

  const attempts: Array<() => Promise<unknown>> = [
    () => locator.selectOption({ label: value }),
    () => locator.selectOption({ value }),
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch {
      // Try next strategy.
    }
  }

  const optionValues = await locator.locator("option").evaluateAll((options) =>
    options.map((opt) => ({
      value: (opt as HTMLOptionElement).value,
      label: (opt as HTMLOptionElement).label || opt.textContent || "",
    })),
  );

  const normalized = value.toLowerCase();
  const match = optionValues.find((opt) => opt.label.trim().toLowerCase() === normalized)
    ?? optionValues.find((opt) => opt.value.trim().toLowerCase() === normalized)
    ?? optionValues.find((opt) => opt.label.trim().toLowerCase().includes(normalized));

  if (!match) {
    throw new Error(`Could not select ${selector} with value "${value}"`);
  }

  await locator.selectOption(match.value);
}

function yesNoSuffix(value: "Yes" | "No"): "Y" | "N" {
  return value === "Yes" ? "Y" : "N";
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<void> {
  await closeSafecoModal(page);
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true }).catch(() => undefined);
      await closeSafecoModal(page);
      return;
    }
  }
  throw new Error(`None of the selectors were visible: ${selectors.join(" | ")}`);
}

async function requestSafecoOtp(page: Page): Promise<void> {
  const otpInputSelectors = ["#passcode", "input[name='passcode']", "input[id*='passcode']"];
  const otpTriggerSelectors = [
    '[data-id="tile-selector-button-pingoneAuth"]',
    "[id^='email_icon_container'] svg",
    "#loginWith2faEmail",
    '[data-id*="email"]',
    '[id*="email_icon_container"]',
    'button:has-text("Email")',
    'a:has-text("Email")',
    'button:has-text("Send code")',
    'a:has-text("Send code")',
    'button:has-text("Get code")',
    'a:has-text("Get code")',
  ];
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    for (const selector of otpInputSelectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        return;
      }
    }

    for (const selector of otpTriggerSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(700).catch(() => undefined);
      }
    }

    const semanticLocators = [
      page.getByRole("button", { name: /email|send code|get code|verification code|passcode/i }).first(),
      page.getByRole("link", { name: /email|send code|get code|verification code|passcode/i }).first(),
      page.getByText(/email.*code|send.*code|verification code|one[-\s]?time code/i).first(),
    ];
    for (const locator of semanticLocators) {
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(700).catch(() => undefined);
      }
    }

    await page.waitForTimeout(600).catch(() => undefined);
  }

  throw new Error(
    `Could not request Safeco OTP. None of the selectors became visible: ${otpTriggerSelectors.join(" | ")}`,
  );
}

async function clickYesNo(page: Page, baseIds: string[], value: "Yes" | "No"): Promise<void> {
  const suffix = yesNoSuffix(value);
  for (let attempt = 0; attempt < 3; attempt++) {
    await closeSafecoModal(page);
    for (const base of baseIds) {
      const inputSelectors = [
        `#${base}${suffix}`,
        `input[id^="${base}"][id$="${suffix}"]`,
        `input[name="${base}"][value="${suffix}"]`,
        `input[name^="${base}"][value="${suffix}"]`,
        `input[id*="${base}"][value="${suffix}"]`,
      ];
      const labelSelectors = [
        `label[for="${base}${suffix}"]`,
        `label[for^="${base}"][for$="${suffix}"]`,
      ];

      let clicked = false;
      for (const labelSelector of labelSelectors) {
        const label = page.locator(labelSelector).first();
        if (await label.isVisible().catch(() => false)) {
          await label.click({ force: true }).catch(() => undefined);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        for (const inputSelector of inputSelectors) {
          const input = page.locator(inputSelector).first();
          if (await input.isVisible().catch(() => false)) {
            await input.check({ force: true }).catch(() => input.click({ force: true }).catch(() => undefined));
            clicked = true;
            break;
          }
        }
      }
      if (!clicked) {
        continue;
      }

      await closeSafecoModal(page);
      const checked = await page
        .locator(
          [
            `#${base}${suffix}`,
            `input[id^="${base}"][id$="${suffix}"]`,
            `input[name="${base}"][value="${suffix}"]`,
            `input[name^="${base}"][value="${suffix}"]`,
            `input[id*="${base}"][value="${suffix}"]`,
          ].join(", "),
        )
        .first()
        .isChecked()
        .catch(() => false);
      if (checked) {
        return;
      }
    }
    await page.waitForTimeout(350).catch(() => undefined);
  }

  const selectors = baseIds.map((base) => `label[for="${base}${suffix}"]`).join(" | ");
  throw new Error(`Could not select Yes/No radio for value "${value}". Tried: ${selectors}`);
}

async function clickContinue(page: Page): Promise<void> {
  const candidateSelectors = [
    "#Continue",
    "a#Continue",
    "input#Continue",
    "button#Continue",
    '[name="Continue"]',
    '[id*="Continue"]',
    'button:has-text("Continue")',
    'a:has-text("Continue")',
    'button:has-text("Next")',
    'a:has-text("Next")',
    'input[type="submit"][value*="Continue"]',
    'input[type="button"][value*="Continue"]',
    'input[type="submit"][value*="Next"]',
    'input[type="button"][value*="Next"]',
  ];

  const semanticLocators = [
    page.getByRole("button", { name: /continue|next|save\s*&?\s*continue/i }).first(),
    page.getByRole("link", { name: /continue|next|save\s*&?\s*continue/i }).first(),
  ];

  for (let retry = 0; retry < 2; retry++) {
    for (const selector of candidateSelectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({ force: true }).catch(() => undefined);
        const blockedItems = await readSafecoRequiredModalItems(page);
        if (!blockedItems.length) return;
        if (retry === 0 && hasQuoteDateFutureValidation(blockedItems)) {
          await forceSafecoQuoteDateToToday(page);
          await closeSafecoModal(page);
          continue;
        }
        throw new Error(`[Safeco] Continue blocked by required fields: ${blockedItems.join(" | ")}`);
      }
    }

    for (const locator of semanticLocators) {
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({ force: true }).catch(() => undefined);
        const blockedItems = await readSafecoRequiredModalItems(page);
        if (!blockedItems.length) return;
        if (retry === 0 && hasQuoteDateFutureValidation(blockedItems)) {
          await forceSafecoQuoteDateToToday(page);
          await closeSafecoModal(page);
          continue;
        }
        throw new Error(`[Safeco] Continue blocked by required fields: ${blockedItems.join(" | ")}`);
      }
    }
  }

  throw new Error("Could not find a visible Continue/Next control to advance the Safeco flow.");
}

async function readSafecoRequiredModalItems(page: Page): Promise<string[]> {
  const modal = page.locator(".ui-dialog:visible, .modalDialog:visible, .ecdev-MessageModal:visible").first();
  if (!(await modal.isVisible().catch(() => false))) {
    return [];
  }

  const title = await modal.locator("#errorTitle, .floatboxTitle").first().textContent().catch(() => "");
  const bodyText = await modal.textContent().catch(() => "");
  const combined = `${title ?? ""} ${bodyText ?? ""}`.replace(/\s+/g, " ").trim();
  const isValidation =
    /please make the following change/i.test(combined) ||
    /policy information screen/i.test(combined) ||
    /cannot be in the future/i.test(combined);
  if (!isValidation) {
    return [];
  }

  const items = await modal
    .locator(".floatboxItem, #errorItem")
    .allTextContents()
    .catch(() => []);
  const parsed = items
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12);
  if (parsed.length) return parsed;
  return [combined].filter(Boolean);
}

async function advanceUntilVisible(page: Page, selector: string, maxContinueClicks: number): Promise<void> {
  if (await isVisible(page, selector)) return;
  if (maxContinueClicks > 0) await clickContinue(page);
  if (await isVisible(page, selector)) return;
  throw new Error(`Expected selector was not visible after continuing: ${selector}`);
}

async function advanceUntilAnyVisible(
  page: Page,
  selectors: string[],
  maxContinueClicks: number,
): Promise<string> {
  const firstAttached = await waitForAnyAttached(page, selectors, 2500);
  if (firstAttached) return firstAttached;

  const firstVisible = await waitForAnyVisible(page, selectors, 2500);
  if (firstVisible) return firstVisible;

  const attempts = Math.max(0, Math.min(maxContinueClicks, 2));
  for (let i = 0; i < attempts; i++) {
    await clickContinue(page);
    const blocked = await readSafecoRequiredModalItems(page);
    if (blocked.length) {
      throw new Error(`[Safeco] Continue blocked by required fields: ${blocked.join(" | ")}`);
    }
    const attachedAfterContinue = await waitForAnyAttached(page, selectors, 5000);
    if (attachedAfterContinue) return attachedAfterContinue;
    const visibleAfterContinue = await waitForAnyVisible(page, selectors, 4000);
    if (visibleAfterContinue) return visibleAfterContinue;
  }
  throw new Error(`Expected selectors were not visible after continuing: ${selectors.join(" | ")}`);
}

async function waitForAnyVisible(
  page: Page,
  selectors: string[],
  timeoutMs = 8000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      if (await isVisible(page, selector)) return selector;
    }
    await page.waitForTimeout(120).catch(() => undefined);
  }
  return null;
}

async function ensureApplicantSectionReady(page: Page): Promise<void> {
  const applicantSelectors = [
    "#PolicyClientPersonFirstName",
    "#PolicyClientPersonLastName",
    "#PolicyClientPersonBirthdate",
    "#PolicyClientEmailAddress",
  ];

  for (const selector of applicantSelectors) {
    if (await isVisible(page, selector)) return;
  }
  await clickContinue(page).catch(() => undefined);
}

async function ensureUnderwritingSectionReady(page: Page): Promise<void> {
  const underwritingSelectors = [
    "#SPUI_UnderwritingContainer",
    "label[for='PolicyDwellingCourseConstructionYNY']",
    "label[for='PolicyDwellingCourseConstructionYNN']",
    "#PolicyDwellingMonthsOfYearOccupied",
    "#PolicyCurrentlyInsured",
    "#PolicyDwellingNumberOfOccupants",
  ];

  for (const selector of underwritingSelectors) {
    if (await isVisible(page, selector)) return;
  }
  await clickContinue(page).catch(() => undefined);
}

async function fillFirstPresent(page: Page, selectors: string[], value: string | undefined): Promise<void> {
  if (!value) return;
  for (const selector of selectors) {
    await closeSafecoModal(page);
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }
}

async function selectFirstPresent(page: Page, selectors: string[], value: string | undefined): Promise<void> {
  if (!value) return;
  for (const selector of selectors) {
    await closeSafecoModal(page);
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await selectByLabelOrValue(page, selector, value);
      return;
    }
  }
}

async function selectRequiredField(
  page: Page,
  selectors: string[],
  value: string | undefined,
  fieldName: string,
): Promise<void> {
  let seenVisible = false;
  for (const selector of selectors) {
    await closeSafecoModal(page);
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      seenVisible = true;
      const existing = await locator.inputValue().catch(() => "");
      if (existing && existing.trim()) {
        return;
      }
      if (value) {
        await selectByLabelOrValue(page, selector, value);
      }
      const selected = await locator.inputValue().catch(() => existing);
      if (selected && selected.trim()) {
        return;
      }
    }
  }
  if (!value) {
    throw new Error(`[Safeco] Missing value for required field: ${fieldName}`);
  }
  if (seenVisible) {
    throw new Error(`[Safeco] Required field "${fieldName}" is visible but remains empty.`);
  }
  throw new Error(`[Safeco] Could not select required field "${fieldName}" using selectors: ${selectors.join(" | ")}`);
}

async function fillRequiredField(
  page: Page,
  selectors: string[],
  value: string | undefined,
  fieldName: string,
): Promise<void> {
  let seenVisible = false;
  for (const selector of selectors) {
    await closeSafecoModal(page);
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      seenVisible = true;
      const existing = await locator.inputValue().catch(() => "");
      if (existing.trim()) {
        return;
      }
      if (value) {
        await locator.fill(value);
      }
      const current = await locator.inputValue().catch(() => existing);
      if (current.trim()) {
        return;
      }
    }
  }
  if (!value) {
    throw new Error(`[Safeco] Missing value for required field: ${fieldName}`);
  }
  if (seenVisible) {
    throw new Error(`[Safeco] Required field "${fieldName}" is visible but remains empty.`);
  }
  throw new Error(`[Safeco] Could not fill required field "${fieldName}" using selectors: ${selectors.join(" | ")}`);
}

async function selectByNearbyLabelText(
  page: Page,
  labelPattern: RegExp,
  value: string,
): Promise<boolean> {
  await closeSafecoModal(page);
  const label = page.getByText(labelPattern).first();
  if (!(await label.isVisible().catch(() => false))) return false;

  const container = label.locator("xpath=ancestor::*[self::div or self::tr][1]");
  const dropdown = container.locator("select").first();
  if (!(await dropdown.isVisible().catch(() => false))) return false;

  await dropdown.selectOption({ label: value }).catch(() => undefined);
  await dropdown.selectOption({ value }).catch(() => undefined);
  if (!(await dropdown.inputValue().catch(() => ""))) {
    const options = await dropdown.locator("option").allTextContents().catch(() => []);
    const candidate = options.find((opt) => opt.toLowerCase().includes(value.toLowerCase()));
    if (candidate) {
      await dropdown.selectOption({ label: candidate }).catch(() => undefined);
    }
  }
  const selected = await dropdown.inputValue().catch(() => "");
  return !!selected;
}

async function selectMonthsOccupiedRequired(
  page: Page,
  value: string | undefined,
): Promise<void> {
  if (!value) {
    throw new Error("[Safeco] Missing value for required field: How many months of the year will the applicant occupy the location");
  }

  const selectors = [
    "#PolicyDwellingMonthsOfYearOccupied",
    "#PolicyDwellingMonthsOccupied",
    '[id*="MonthsOfYearOccupied"]',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.isVisible().catch(() => false))) {
      continue;
    }
    await locator.selectOption({ value }).catch(() => undefined);
    await locator.selectOption({ label: value }).catch(() => undefined);

    const selected = await locator.inputValue().catch(() => "");
    if (selected && selected.trim()) {
      return;
    }
  }

  const selectedByLabel = await selectByNearbyLabelText(
    page,
    /how many months of the year will the applicant.*occupy the location/i,
    value,
  ).catch(() => false);
  if (selectedByLabel) {
    return;
  }

  throw new Error(
    "[Safeco] Could not select required field \"How many months of the year will the applicant occupy the location\".",
  );
}

async function selectRelationshipToInsuredRequired(
  page: Page,
  value: string | undefined,
): Promise<void> {
  const desired = (value ?? "Spouse").trim() || "Spouse";
  const selectors = [
    "#PolicyDwellingCoApplicantRelationshipToInsured",
    "select[id*='CoApplicantRelationshipToInsured']",
    "select[name*='CoApplicantRelationshipToInsured']",
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.count().catch(() => 0))) {
      continue;
    }

    await selectByLabelOrValue(page, selector, desired).catch(() => undefined);
    // Fallback for hidden/non-standard selects: set directly and trigger change handlers.
    await locator
      .evaluate((el, targetLabel) => {
        const select = el as HTMLSelectElement;
        const options = Array.from(select.options || []);
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = norm(targetLabel);
        const match = options.find(
          (o) => norm(o.label || o.text || "") === target || norm(o.value || "") === target,
        ) ?? options.find((o) => norm(o.label || o.text || "").includes(target));
        if (match) {
          select.value = match.value;
        } else if (!select.value) {
          const firstNonEmpty = options.find((o) => (o.value || "").trim().length > 0);
          if (firstNonEmpty) select.value = firstNonEmpty.value;
        }
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }, desired)
      .catch(() => undefined);

    const selected = await locator.inputValue().catch(() => "");
    if (selected && selected.trim()) {
      return;
    }

    const firstNonEmpty = await locator
      .locator("option")
      .evaluateAll((nodes) => {
        const option = nodes.find((n) => ((n as HTMLOptionElement).value ?? "").trim().length > 0);
        return option ? (option as HTMLOptionElement).value : "";
      })
      .catch(() => "");
    if (firstNonEmpty) {
      await locator.selectOption({ value: firstNonEmpty }).catch(() => undefined);
      const fallbackSelected = await locator.inputValue().catch(() => "");
      if (fallbackSelected && fallbackSelected.trim()) {
        return;
      }
    }
  }

  const selectedByLabel = await selectByNearbyLabelText(page, /relationship to insured/i, desired).catch(() => false);
  if (selectedByLabel) {
    return;
  }

  throw new Error("[Safeco] Could not set required field: Relationship to Insured");
}

async function selectRelationshipToInsuredIfVisible(
  page: Page,
  value: string | undefined,
): Promise<void> {
  const selectors = [
    "#PolicyDwellingCoApplicantRelationshipToInsured",
    "select[id*='CoApplicantRelationshipToInsured']",
    "select[name*='CoApplicantRelationshipToInsured']",
  ];
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      await selectRelationshipToInsuredRequired(page, value);
      return;
    }
  }
}

function toCurrentlyInsuredOptionValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return "1";
  if (normalized.includes("first time home buyer") || normalized.includes("first time")) return "2";
  if (normalized.includes("prior policy lapsed") || normalized.includes("not active") || normalized.includes("lapsed")) {
    return "3";
  }
  if (normalized.includes("unknown reason")) return "4";
  if (["1", "2", "3", "4"].includes(value.trim())) return value.trim();
  return undefined;
}

async function selectCurrentlyInsuredRequired(page: Page, value: string | undefined): Promise<void> {
  const normalized = normalizeCurrentlyInsuredValue(value);
  if (!normalized) {
    throw new Error("[Safeco] Missing value for required field: Do you currently have property insurance coverage");
  }

  const selectors = ["#PolicyCurrentlyInsured", "#PolicyDwellingCurrentlyInsured", '[id*="CurrentlyInsured"]'];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.isVisible().catch(() => false))) continue;

    const byValue = toCurrentlyInsuredOptionValue(normalized);
    if (byValue) {
      await locator.selectOption({ value: byValue }).catch(() => undefined);
    }
    await locator.selectOption({ label: normalized }).catch(() => undefined);

    const selected = await locator.inputValue().catch(() => "");
    if (selected && selected.trim()) return;
  }

  throw new Error("[Safeco] Could not select required field: Do you currently have property insurance coverage");
}

async function clickYesNoByQuestionText(page: Page, questionPattern: RegExp, value: "Yes" | "No"): Promise<boolean> {
  const question = page.getByText(questionPattern).first();
  if (!(await question.isVisible().catch(() => false))) return false;

  const container = question.locator("xpath=ancestor::*[self::div or self::tr][1]");
  const desired = value.toLowerCase();
  const byRole = container.getByRole("radio", { name: new RegExp(`^${value}$`, "i") }).first();
  if (await byRole.isVisible().catch(() => false)) {
    await byRole.check({ force: true }).catch(() => byRole.click({ force: true }).catch(() => undefined));
    return true;
  }

  const byLabel = container.getByText(new RegExp(`^${value}$`, "i")).first();
  if (await byLabel.isVisible().catch(() => false)) {
    await byLabel.click({ force: true }).catch(() => undefined);
    return true;
  }

  const radio = container.locator(`input[type="radio"][value="${desired === "yes" ? "Y" : "N"}"]`).first();
  if (await radio.isVisible().catch(() => false)) {
    await radio.check({ force: true }).catch(() => radio.click({ force: true }).catch(() => undefined));
    return true;
  }

  return false;
}

async function clickYesNoByNameFragments(
  page: Page,
  fragments: string[],
  value: "Yes" | "No",
): Promise<boolean> {
  const suffix = value === "Yes" ? "Y" : "N";
  const radioValue = suffix;

  for (const fragment of fragments) {
    const selector = [
      `input[type="radio"][name*="${fragment}"][value="${radioValue}"]`,
      `input[type="radio"][id*="${fragment}"][value="${radioValue}"]`,
      `input[type="radio"][name*="${fragment}"][id$="${suffix}"]`,
      `input[type="radio"][id*="${fragment}"][id$="${suffix}"]`,
    ].join(", ");

    const input = page.locator(selector).first();
    if (!(await input.count().catch(() => 0))) {
      continue;
    }

    const alreadyChecked = await input.isChecked().catch(async () =>
      input.evaluate((el) => Boolean((el as HTMLInputElement).checked)).catch(() => false),
    );
    if (alreadyChecked) {
      return true;
    }

    await input.scrollIntoViewIfNeeded().catch(() => undefined);
    await input.check({ force: true }).catch(() => input.click({ force: true }).catch(() => undefined));
    await input.dispatchEvent("input").catch(() => undefined);
    await input.dispatchEvent("change").catch(() => undefined);

    const checked = await input.isChecked().catch(async () =>
      input.evaluate((el) => Boolean((el as HTMLInputElement).checked)).catch(() => false),
    );
    if (checked) {
      return true;
    }
  }

  return false;
}

async function anyChecked(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const radio = page.locator(selector).first();
    if (!(await radio.count().catch(() => 0))) {
      continue;
    }
    const checked = await radio.isChecked().catch(async () =>
      radio.evaluate((el) => Boolean((el as HTMLInputElement).checked)).catch(() => false),
    );
    if (checked) {
      return true;
    }
  }
  return false;
}

async function forceSelectAdditionalInterestsExact(page: Page, value: "Yes" | "No"): Promise<boolean> {
  const suffix = value === "Yes" ? "Y" : "N";
  const inputId = `#PolicyAdditionalInterestsYN${suffix}`;
  const namedInput = `input[name='PolicyAdditionalInterestsYN'][value='${suffix}']`;
  const labelFor = `label[for='PolicyAdditionalInterestsYN${suffix}']`;

  const inputs = [page.locator(inputId).first(), page.locator(namedInput).first()];
  for (const input of inputs) {
    if (!(await input.count().catch(() => 0))) {
      continue;
    }
    await input
      .evaluate((el) => {
        const radio = el as HTMLInputElement;
        radio.click();
        radio.dispatchEvent(new Event("input", { bubbles: true }));
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      })
      .catch(() => undefined);

    const checked = await input.isChecked().catch(async () =>
      input.evaluate((el) => Boolean((el as HTMLInputElement).checked)).catch(() => false),
    );
    if (checked) return true;
  }

  const label = page.locator(labelFor).first();
  if (await label.isVisible().catch(() => false)) {
    await label.scrollIntoViewIfNeeded().catch(() => undefined);
    await label.click({ force: true }).catch(() => undefined);
    const verifyById = page.locator(inputId).first();
    const verifyByName = page.locator(namedInput).first();
    const checkedById = await verifyById.isChecked().catch(async () =>
      verifyById.evaluate((el) => Boolean((el as HTMLInputElement).checked)).catch(() => false),
    );
    const checkedByName = await verifyByName.isChecked().catch(async () =>
      verifyByName.evaluate((el) => Boolean((el as HTMLInputElement).checked)).catch(() => false),
    );
    if (checkedById || checkedByName) return true;
  }

  return false;
}

async function isAdditionalInterestsValueSelected(page: Page, value: "Yes" | "No"): Promise<boolean> {
  const suffix = value === "Yes" ? "Y" : "N";
  const checks = [
    `#PolicyAdditionalInterestsYN${suffix}`,
    `input[name='PolicyAdditionalInterestsYN'][value='${suffix}']`,
  ];
  return anyChecked(page, checks);
}

async function selectAdditionalInterests(page: Page, value: "Yes" | "No"): Promise<void> {
  if (await isAdditionalInterestsValueSelected(page, value)) return;
  await closeSafecoModal(page);
  if (await forceSelectAdditionalInterestsExact(page, value).catch(() => false)) return;

  const suffix = value === "Yes" ? "Y" : "N";
  const input = page.locator(`input[name='PolicyAdditionalInterestsYN'][value='${suffix}']`).first();
  if (await input.count().catch(() => 0)) {
    await input
      .evaluate((el) => {
        const radio = el as HTMLInputElement;
        radio.click();
        radio.dispatchEvent(new Event("input", { bubbles: true }));
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      })
      .catch(() => undefined);
  }
  if (await isAdditionalInterestsValueSelected(page, value)) return;

  const textClicked = await clickYesNoByQuestionText(
    page,
    /does the home have a mortgage|additional owners|additional interest/i,
    value,
  ).catch(() => false);
  if (textClicked && (await isAdditionalInterestsValueSelected(page, value))) return;

  await forceSelectAdditionalInterestsExact(page, value).catch(() => undefined);
  if (await isAdditionalInterestsValueSelected(page, value)) return;

  throw new Error(`[Safeco] Could not select Additional Interests as "${value}".`);
}

function parsePhoneParts(phoneRaw: string): { area: string; prefix: string; suffix: string } | null {
  const digits = phoneRaw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const normalized = digits.slice(-10);
  return {
    area: normalized.slice(0, 3),
    prefix: normalized.slice(3, 6),
    suffix: normalized.slice(6, 10),
  };
}

function toDwellingLocatedValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("city")) return "C";
  if (normalized.includes("suburb")) return "S";
  if (normalized.includes("district")) return "D";
  return value;
}

function toRoofRenovationValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes" || normalized === "full") return "F";
  if (normalized === "no" || normalized === "none") return "N";
  return value;
}

function toPlumbingRenovationValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "full") return "F";
  if (normalized === "partial") return "P";
  if (normalized === "none" || normalized === "no") return "N";
  return value;
}

function toFireSprinklerValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("fully")) return "7";
  if (normalized.includes("partially")) return "6";
  return value;
}

function toReasonForPolicyOptionValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "n" || normalized.includes("new property customer")) return "N";
  if (normalized === "l" || normalized.includes("lapsed > 60") || normalized.includes("lapsed >60")) return "L";
  if (normalized === "c" || normalized.includes("lapsed < 60") || normalized.includes("lapsed <60")) return "C";
  if (normalized === "r" || normalized.includes("moving to new location") || normalized.includes("secondary")) return "R";
  if (normalized === "i" || normalized.includes("other reason")) return "I";
  if (normalized === "a" || normalized.includes("carrier consolidation") || normalized.includes("book transfer")) return "A";
  if (normalized === "t" || normalized.includes("loyalty rewrite")) return "T";
  return undefined;
}

async function selectReasonForPolicyRequired(page: Page, value: string | undefined): Promise<void> {
  if (!value || !value.trim()) {
    throw new Error('[Safeco] Missing value for required field: Reason for Policy');
  }

  const selectors = ["#PolicyBusinessType", "#PolicyReasonForPolicy", 'select[id*="ReasonForPolicy"]'];
  const desiredValue = toReasonForPolicyOptionValue(value) ?? "N";

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.count().catch(() => 0))) continue;

    await locator.selectOption({ value: desiredValue }).catch(() => undefined);
    await locator.selectOption({ label: value }).catch(() => undefined);
    await locator.selectOption({ value }).catch(() => undefined);
    await locator.dispatchEvent("input").catch(() => undefined);
    await locator.dispatchEvent("change").catch(() => undefined);

    const selected = await locator.inputValue().catch(() => "");
    if (selected && selected.trim()) return;

    const selectedViaDom = await locator
      .evaluate((el, payload) => {
        const select = el as HTMLSelectElement;
        const options = Array.from(select.options || []);
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const desired = normalize(payload.desiredText);
        const byExactText = options.find((o) => normalize(o.label || o.text || "") === desired);
        const byContainsText = options.find((o) => normalize(o.label || o.text || "").includes(desired));
        const byValue =
          options.find((o) => (o.value || "").trim().toUpperCase() === payload.desiredValue) ??
          options.find((o) => (o.value || "").trim() === payload.rawValue);
        const fallback =
          byExactText ??
          byContainsText ??
          byValue ??
          options.find((o) => (o.value || "").trim().length > 0);
        if (!fallback) return "";
        select.value = fallback.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return select.value || "";
      }, { desiredText: value, desiredValue, rawValue: value.trim() })
      .catch(() => "");

    if (selectedViaDom && selectedViaDom.trim()) return;
  }

  const selectedByLabel = await selectByNearbyLabelText(page, /reason for policy/i, value).catch(() => false);
  if (selectedByLabel) return;

  throw new Error(
    `[Safeco] Could not select required field: Reason for Policy (input="${value}", mapped="${desiredValue}")`,
  );
}

function normalizeMonthsOccupiedValue(value: string | undefined): string | undefined {
  if (!value) return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "p1" || normalized === "12 (primary)" || normalized === "12") return "P1";
  if (normalized === "p2" || normalized.includes("9-11") || normalized.includes("9-12")) return "P2";
  if (normalized === "p3" || normalized.includes("6-8")) return "P3";
  if (normalized === "s1" || normalized.includes("4-5")) return "S1";
  if (normalized === "s2" || normalized.includes("1-3")) return "S2";
  if (normalized === "s3" || normalized.includes("< 1") || normalized.includes("less than 1")) return "S3";
  if (normalized === "v1" || normalized.includes("vacant") || normalized.includes("unoccupied")) return "V1";
  if (normalized === "r1" || normalized.includes("rented")) return "R1";
  if (normalized.includes("owner occupied - primary") || normalized === "primary") return "P1";
  if (normalized.includes("owner occupied - secondary") || normalized === "secondary") return "S1";
  const numeric = Number(normalized);
  if (!Number.isNaN(numeric)) {
    if (numeric >= 12) return "P1";
    if (numeric >= 9) return "P2";
    if (numeric >= 6) return "P3";
    if (numeric >= 4) return "S1";
    if (numeric >= 1) return "S2";
    return "S3";
  }
  return value;
}

function normalizeCurrentlyInsuredValue(value: string | undefined): string | undefined {
  if (!value) return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  if (normalized.includes("no, unknown reason")) return "No, Unknown Reason";
  if (normalized.includes("lapse in coverage") || normalized.includes("lapsed") || normalized.includes("not active")) {
    return "No, Prior Policy Lapsed/Not Active";
  }
  if (normalized.includes("first time") || normalized.includes("no prior insurance")) {
    return "No, First Time Home Buyer or Renter";
  }
  return value;
}

function normalizeDwellingHazardDetails(details: string[] | undefined): string[] {
  if (!details?.length) return [];
  const values = new Set<string>();
  for (const item of details) {
    const text = item.trim().toLowerCase();
    if (!text || ["none", "n/a", "na", "no", "false", "0"].includes(text)) continue;
    if (text.includes("unrepaired") || text.includes("prior loss") || text.includes("water claim")) {
      values.add("unrepaired_damages");
    }
    if (text.includes("in-ground pool") || text.includes("inground pool") || /\bpool\b/.test(text)) {
      values.add("inground_pool");
    }
    if (text.includes("wood") || text.includes("coal") || text.includes("pellet") || text.includes("solid fuel")) {
      values.add("wood_stove");
    }
    if (text.includes("trampoline")) {
      values.add("trampoline");
    }
    if (text.includes("code") || text.includes("fire violation") || text.includes("slip") || text.includes("railing")) {
      values.add("code_violations");
    }
    if (text.includes("permit")) {
      values.add("no_permits");
    }
    if (text.includes("roof") || text.includes("overhang") || text.includes("shingle") || text.includes("leak")) {
      values.add("roof_issues");
    }
  }
  return Array.from(values);
}

async function checkOptionByLabel(page: Page, labelPattern: RegExp): Promise<boolean> {
  const label = page.locator("label", { hasText: labelPattern }).first();
  if (await label.isVisible().catch(() => false)) {
    await label.click({ force: true }).catch(() => undefined);
    return true;
  }

  const text = page.getByText(labelPattern).first();
  if (await text.isVisible().catch(() => false)) {
    const row = text.locator("xpath=ancestor::*[self::div or self::tr or self::li][1]");
    const checkbox = row.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check({ force: true }).catch(() => checkbox.click({ force: true }).catch(() => undefined));
      return true;
    }
    await text.click({ force: true }).catch(() => undefined);
    return true;
  }

  return false;
}

async function selectDwellingHazardDetails(page: Page, details: string[] | undefined): Promise<number> {
  const normalized = normalizeDwellingHazardDetails(details);
  if (!normalized.length) return 0;

  const selectedKeys = new Set<string>();
  for (const key of normalized) {
    if (selectedKeys.has(key)) continue;
    let selected = false;
    if (key === "unrepaired_damages") {
      selected = await checkOptionByLabel(page, /unrepaired damages from a prior loss/i);
    } else if (key === "inground_pool") {
      selected = await checkOptionByLabel(page, /in-ground pool/i);
    } else if (key === "wood_stove") {
      selected = await checkOptionByLabel(page, /wood,\s*coal,\s*or\s*pellet stove|solid fuel/i);
    } else if (key === "trampoline") {
      selected = await checkOptionByLabel(page, /above-ground trampoline/i);
    } else if (key === "code_violations") {
      selected = await checkOptionByLabel(page, /uncorrected code|fire violations|slip\/fall hazards/i);
    } else if (key === "no_permits") {
      selected = await checkOptionByLabel(page, /without the required permits/i);
    } else if (key === "roof_issues") {
      selected = await checkOptionByLabel(page, /roof with excessive tree overhang|leaks|shingles/i);
    }
    if (selected) selectedKeys.add(key);
  }

  return selectedKeys.size;
}

function normalizeOwnershipMonthValue(value: string | undefined): string | undefined {
  if (!value) return value;
  const text = value.trim();
  if (!text) return value;
  const monthNumber = Number(text);
  if (!Number.isNaN(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
    return new Date(2000, monthNumber - 1, 1).toLocaleString("en-US", { month: "long" });
  }
  return value;
}

function normalizeLossCount(value: string | undefined): string {
  if (!value) return "0";
  const text = value.trim();
  if (!text) return "0";

  const numeric = Number(text);
  if (!Number.isNaN(numeric)) {
    return String(Math.max(0, Math.floor(numeric)));
  }

  const matches = text.match(/\b\d+\b/g);
  if (matches && matches.length) {
    const candidate = Number(matches[matches.length - 1]);
    if (!Number.isNaN(candidate) && candidate >= 0 && candidate <= 20) {
      return String(Math.floor(candidate));
    }
  }

  return "1";
}

async function setLossCountRequired(page: Page, value: string): Promise<void> {
  const selectors = ["#PolicyDwellingNumberOfLosses", '[id*="NumberOfLosses"]'];
  let seenVisible = false;

  for (const selector of selectors) {
    await closeSafecoModal(page);
    const locator = page.locator(selector).first();
    if (!(await locator.isVisible().catch(() => false))) {
      continue;
    }

    seenVisible = true;
    const tagName = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    if (tagName === "select") {
      await selectByLabelOrValue(page, selector, value);
    } else {
      await locator.fill(value).catch(() => undefined);
      await locator.dispatchEvent("input").catch(() => undefined);
      await locator.dispatchEvent("change").catch(() => undefined);
      await locator.dispatchEvent("blur").catch(() => undefined);
    }

    const current = await locator.inputValue().catch(() => "");
    if (current.trim()) {
      await page.waitForTimeout(250).catch(() => undefined);
      return;
    }
  }

  if (seenVisible) {
    throw new Error('[Safeco] Required field "Number of losses incurred in last 5 years" is visible but remains empty.');
  }
  throw new Error(
    '[Safeco] Could not set required field "Number of losses incurred in last 5 years" using selectors: #PolicyDwellingNumberOfLosses | [id*="NumberOfLosses"]',
  );
}

function normalizeLossDateToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const clean = token.trim();
  if (!clean) return undefined;
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(clean);
  if (!match) return undefined;
  const mm = Number(match[1]);
  const dd = Number(match[2]);
  let yyyy = Number(match[3]);
  if (yyyy < 100) yyyy += 2000;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  return `${String(mm).padStart(2, "0")}/${String(dd).padStart(2, "0")}/${String(yyyy)}`;
}

function deriveLossCauseLabel(raw: string | undefined): string {
  const text = (raw ?? "").toLowerCase();
  if (text.includes("water") || text.includes("leak") || text.includes("pipe")) return "Water";
  if (text.includes("fire") || text.includes("burn")) return "Fire";
  if (text.includes("smoke")) return "Smoke (no fire)";
  if (text.includes("wind") || text.includes("storm")) return "Wind";
  if (text.includes("hail")) return "Hail";
  if (text.includes("lightning")) return "Lightning";
  if (text.includes("theft") || text.includes("burgl")) return "Theft";
  if (text.includes("liab")) return "Liability - Property Damage";
  return "All other property";
}

function toLossCauseOptionValue(label: string): string | undefined {
  const normalized = label.trim().toLowerCase();
  if (normalized === "water") return "P12";
  if (normalized === "wind") return "P4";
  if (normalized === "hail") return "P2";
  if (normalized === "fire") return "P9";
  if (normalized === "lightning") return "P3";
  if (normalized === "theft") return "P13";
  if (normalized === "smoke (no fire)") return "P11";
  if (normalized === "liability - property damage") return "L2";
  if (normalized === "all other property") return "P16";
  return undefined;
}

function parseLossDetails(raw: string | undefined): { date?: string; amount?: string; causeLabel?: string } {
  const text = (raw ?? "").trim();
  if (!text) return {};

  const dateMatch = text.match(/\b\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b/);
  const date = normalizeLossDateToken(dateMatch?.[0]);

  const amountCandidates = Array.from(text.matchAll(/\$?\s*(\d{2,6})(?:\.\d{2})?\b/g)).map((m) => Number(m[1]));
  const amount =
    amountCandidates.length > 0
      ? String(Math.max(1, Math.floor(amountCandidates[amountCandidates.length - 1])))
      : undefined;

  const stripped = text
    .replace(dateMatch?.[0] ?? "", " ")
    .replace(/\$?\s*\d{2,6}(?:\.\d{2})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    date,
    amount,
    causeLabel: deriveLossCauseLabel(stripped || text),
  };
}

async function fillLossDetailFields(page: Page, rawLossText: string | undefined, lossCount: number): Promise<void> {
  if (lossCount <= 0) return;
  const detailReady = await waitForAnyVisible(
    page,
    ["#PolicySPILosses1LossDate", "#PolicySPILosses1LossAmount", "#PolicySPILosses1LossCategory"],
    15000,
  );
  if (!detailReady) {
    throw new Error(
      '[Safeco] Loss detail fields did not become visible after setting "Number of losses incurred in the last 5 years".',
    );
  }

  const parsed = parseLossDetails(rawLossText);

  const dateValue = parsed.date ?? formatTodayPlusDays(-365);
  const amountValue = parsed.amount ?? "1000";
  const causeLabel = parsed.causeLabel ?? "All other property";
  const causeValue = toLossCauseOptionValue(causeLabel);

  await fillRequiredField(
    page,
    [
      "#PolicySPILosses1LossDate",
      "#PolicyDwellingLosses1DateOfLoss",
      "#PolicyDwellingLosses1Date",
      "#PolicyLosses1DateOfLoss",
      'input[id*="SPILosses"][id*="LossDate"]',
      'input[id*="Losses"][id*="Date"]',
      'input[name*="Losses"][name*="Date"]',
    ],
    dateValue,
    "Date of Loss",
  );

  await fillRequiredField(
    page,
    [
      "#PolicySPILosses1LossAmount",
      "#PolicyDwellingLosses1AmountOfLoss",
      "#PolicyDwellingLosses1Amount",
      "#PolicyLosses1AmountOfLoss",
      'input[id*="SPILosses"][id*="LossAmount"]',
      'input[id*="Losses"][id*="Amount"]',
      'input[name*="Losses"][name*="Amount"]',
    ],
    amountValue,
    "Amount of Loss",
  );

  if (causeValue) {
    await selectRequiredField(
      page,
      [
        "#PolicySPILosses1LossCategory",
        "#PolicyDwellingLosses1CauseOfLoss",
        "#PolicyDwellingLosses1Cause",
        "#PolicyLosses1CauseOfLoss",
        'select[id*="SPILosses"][id*="LossCategory"]',
        'select[id*="Losses"][id*="Cause"]',
        'select[name*="Losses"][name*="Cause"]',
      ],
      causeValue,
      "Cause of Loss",
    );
  } else {
    await selectRequiredField(
      page,
      [
        "#PolicySPILosses1LossCategory",
        "#PolicyDwellingLosses1CauseOfLoss",
        "#PolicyDwellingLosses1Cause",
        "#PolicyLosses1CauseOfLoss",
        'select[id*="SPILosses"][id*="LossCategory"]',
        'select[id*="Losses"][id*="Cause"]',
        'select[name*="Losses"][name*="Cause"]',
      ],
      causeLabel,
      "Cause of Loss",
    );
  }

  await fillFirstPresent(
    page,
    [
      "#PolicySPILosses1LossDescription",
      'input[id*="SPILosses"][id*="LossDescription"]',
      'input[name*="SPILosses"][name*="LossDescription"]',
    ],
    rawLossText?.trim() || `${causeLabel} loss`,
  );
}

async function fetchOtpAfter(
  webhookUrl: string,
  requestedAt: number,
  retries = 25,
  delayMs = 3000,
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const { data } = await axios.get<PlaywrightSafecoWebhookOtpPayload | PlaywrightSafecoWebhookOtpPayload[]>(webhookUrl);
    const latest = Array.isArray(data) ? data[0] ?? {} : data ?? {};
    const otp = String(latest.otp ?? "").trim();
    const timestamp = Number(latest.time ?? 0);
    if (otp && timestamp > requestedAt) {
      return otp;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("[Safeco] Timed out waiting for fresh OTP.");
}

function looksLikePdfUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith(".pdf") || lower.includes("displaypdf") || lower.includes("report");
}

async function writePdfBytes(bytes: Buffer, jobId?: string): Promise<string> {
  const artifactDir = path.resolve(process.cwd(), "playwright-artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  const pdfPath = path.join(artifactDir, `safeco-home-${jobId ?? Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, bytes);
  return pdfPath;
}

async function generateSafecoPdf(context: BrowserContext, quotePage: Page, jobId?: string): Promise<string | undefined> {
  await quotePage.locator("#btnPrint").first().waitFor({ state: "visible", timeout: 120000 });

  const popupPromise = context.waitForEvent("page", { timeout: 15000 }).catch(() => null);
  await quotePage.locator("#btnPrint").first().click({ force: true });
  const reportPage = (await popupPromise) ?? quotePage;

  await reportPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  await closeSafecoModal(reportPage);

  const reportCheckboxes = [
    "#PolicyReportsQuoteSummary",
    "#PolicyReportsPaymentOptions",
    "#PolicyReportsApplication",
    "#PolicyReportsPackageSelection",
    "#PolicyReportsPrintWithoutHouseImageYN",
  ];
  for (const selector of reportCheckboxes) {
    const checkbox = reportPage.locator(selector).first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check().catch(() => checkbox.click({ force: true }).catch(() => undefined));
    }
  }

  const downloadPromise = reportPage.waitForEvent("download", { timeout: 20000 }).catch(() => null);
  const pdfResponsePromise = reportPage
    .waitForResponse((response) => {
      const contentType = response.headers()["content-type"] ?? "";
      return contentType.toLowerCase().includes("pdf");
    }, { timeout: 20000 })
    .catch(() => null);
  const pdfPopupPromise = context.waitForEvent("page", { timeout: 20000 }).catch(() => null);

  await reportPage.locator("#btnPrint").first().click({ force: true });

  const download = await downloadPromise;
  if (download) {
    const artifactDir = path.resolve(process.cwd(), "playwright-artifacts");
    fs.mkdirSync(artifactDir, { recursive: true });
    const pdfPath = path.join(artifactDir, `safeco-home-${jobId ?? Date.now()}.pdf`);
    await download.saveAs(pdfPath);
    return pdfPath;
  }

  const pdfResponse = await pdfResponsePromise;
  if (pdfResponse) {
    const bytes = await pdfResponse.body();
    return writePdfBytes(bytes, jobId);
  }

  const pdfPopup = await pdfPopupPromise;
  if (pdfPopup) {
    await pdfPopup.waitForLoadState("domcontentloaded").catch(() => undefined);
    const popupUrl = pdfPopup.url();
    if (looksLikePdfUrl(popupUrl)) {
      const popupResponse = await pdfPopup.request.get(popupUrl);
      const bytes = await popupResponse.body();
      return writePdfBytes(bytes, jobId);
    }
  }

  const reportUrl = reportPage.url();
  if (looksLikePdfUrl(reportUrl)) {
    const reportResponse = await reportPage.request.get(reportUrl);
    const bytes = await reportResponse.body();
    return writePdfBytes(bytes, jobId);
  }

  return undefined;
}

function isErrAborted(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("ERR_ABORTED") || msg.includes("Target page, context or browser has been closed");
}

function pickActivePage(context: BrowserContext, fallback: Page): Page {
  if (!fallback.isClosed()) return fallback;
  const active = context.pages().filter((p) => !p.isClosed());
  return active.at(-1) ?? fallback;
}

async function completePingAuthIfPresent(page: Page): Promise<void> {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await closeSafecoModal(page);
    const url = page.url();
    const onPing = /lmidp\.libertymutual\.com|authorization\.ping/i.test(url);
    const passcodeVisible = await page.locator("#passcode").first().isVisible().catch(() => false);
    if (!onPing && !passcodeVisible) {
      return;
    }

    // If passcode is still visible, try submitting once more in case the page did not advance.
    if (passcodeVisible) {
      await clickFirstVisible(page, ["#sign-on", "button#sign-on", "button[type='submit']"]).catch(() => undefined);
      await page.waitForTimeout(600).catch(() => undefined);
      continue;
    }

    await clickFirstVisible(page, [
      "#sign-on",
      "button#sign-on",
      "button[type='submit']",
      'button:has-text("Continue")',
      'a:has-text("Continue")',
      'button:has-text("Yes")',
      'a:has-text("Yes")',
      'button:has-text("Trust")',
      'a:has-text("Trust")',
    ]).catch(() => undefined);

    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(700).catch(() => undefined);
  }
}

async function detectSafecoQuoteStart(page: Page): Promise<boolean> {
  const candidateSelectors = [
    "#PolicyRatingState",
    "#PolicyProduct",
    "#PolicyAgentNumber",
    "#PolicyQuoteDate",
    "#PolicyClientPersonFirstName",
  ];
  for (const selector of candidateSelectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function ensureSafecoQuoteStart(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await closeSafecoModal(page);
    if (await detectSafecoQuoteStart(page)) {
      return;
    }
    await completePingAuthIfPresent(page);
    await page.waitForTimeout(500).catch(() => undefined);
  }

  const currentUrl = page.url();
  throw new Error(`[Safeco] Quote start page not reached. Current URL: ${currentUrl}`);
}

async function tryLaunchQuoteFromDashboard(page: Page): Promise<void> {
  const launchSelectors = [
    'a:has-text("New Quote")',
    'button:has-text("New Quote")',
    'a:has-text("Start Quote")',
    'button:has-text("Start Quote")',
    'a:has-text("Homeowners")',
    'button:has-text("Homeowners")',
    'a:has-text("Property")',
    'button:has-text("Property")',
    "#PolicyInfoLink",
    "a[href*='PolicyInfo.aspx']",
    "a[href*='ModeID=2']",
  ];

  await closeSafecoModal(page);
  for (const selector of launchSelectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true }).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(600).catch(() => undefined);
      return;
    }
  }
}

async function gotoSafecoPolicyInfo(context: BrowserContext, page: Page, timeoutMs: number): Promise<Page> {
  const targetUrl = SAFECO_POLICY_INFO_URL;
  let currentPage = pickActivePage(context, page);

  for (let attempt = 0; attempt < 4; attempt++) {
    currentPage = pickActivePage(context, currentPage);
    try {
      await completePingAuthIfPresent(currentPage);
      await tryLaunchQuoteFromDashboard(currentPage);
      await currentPage.waitForLoadState("domcontentloaded").catch(() => undefined);
      await currentPage.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await completePingAuthIfPresent(currentPage);
      await tryLaunchQuoteFromDashboard(currentPage);
      await ensureSafecoQuoteStart(currentPage, Math.min(timeoutMs, 30000));
      return currentPage;
    } catch (err) {
      if (!isErrAborted(err) || attempt === 3) {
        throw err;
      }
      await currentPage.waitForTimeout(700 + attempt * 400).catch(() => undefined);
      currentPage = pickActivePage(context, currentPage);
    }
  }

  return currentPage;
}

export async function runSafecoPlaywright(
  input: PlaywrightSafecoRunRequest,
  opts?: { jobId?: string },
): Promise<{ pdfPath?: string }> {
  const payload = normalizeSafecoPayload(input.payload);
  const jobId = opts?.jobId;
  const headless = input.options?.headless ?? false;
  const slowMo = input.options?.slowMoMs ?? 0;
  // Used for navigation only (page.goto / multi-step page loads via gotoSafecoPolicyInfo).
  // Kept generous since real page loads + redirects can legitimately take a while.
  const timeoutMs = input.options?.timeoutMs ?? 90000;
  // Default *action* timeout for fill/click/selectOption/check/waitFor calls that
  // don't pass their own override. This used to be set to the same 90s as
  // navigation, which meant any single field that wasn't instantly clickable/
  // visible (a collapsed section, a field hidden until a prior selection takes
  // effect, a modal that closed half a second late) caused Playwright to silently
  // retry that one action for up to 90 seconds before the surrounding
  // `.catch(() => undefined)` swallowed it and moved on — that's the "stops for
  // 1-2 minutes" you're seeing. Failing fast here surfaces the real broken
  // selector immediately (and the existing required-fields modal check will throw
  // a clear error) instead of masking it behind a long silent hang.
  const actionTimeoutMs = 8000;

  const updateStep = (step: string): void => {
    if (jobId) {
      playwrightSafecoJobStore.update(jobId, { step });
    }
  };

  const browser = await launchChromiumWithFallback({
    headless,
    slowMo,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: { width: 1366, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });

    let page = await context.newPage();
    page.setDefaultTimeout(actionTimeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    updateStep("safeco_login");
    await page.goto(input.loginUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    await page.locator("#username").fill(input.credentials.username);
    await page.locator("#password").fill(input.credentials.password);
    await clickFirstVisible(page, ["#submit1", "#button", "button[type='submit']"]);

    updateStep("safeco_request_otp");
    const otpRequestedAt = Date.now();
    await requestSafecoOtp(page);

    const otp = await fetchOtpAfter(input.webhookUrl, otpRequestedAt);
    updateStep("safeco_submit_otp");
    await page.locator("#passcode").fill(otp);
    await page.locator("#passcode").dispatchEvent("input").catch(() => undefined);
    await clickFirstVisible(page, ["#sign-on", "button#sign-on", "button[type='submit']"]);

    updateStep("safeco_open_policy_info");
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(300).catch(() => undefined);
    page = await gotoSafecoPolicyInfo(context, page, timeoutMs);
    await closeSafecoModal(page);
    await ensureSafecoQuoteStart(page, 60000);

    updateStep("safeco_quote_setup");
    await selectByLabelOrValue(page, "#PolicyRatingState", normalizeStateLabel(payload.quoteSetup.ratingState));
    await selectByLabelOrValue(page, "#PolicyProduct", payload.quoteSetup.policyForm);
    await selectByLabelOrValue(page, "#PolicyAgentNumber", payload.quoteSetup.agentNumber);
    await fillIfPresent(page, "#PolicyQuoteDate", payload.quoteSetup.quoteDate);
    await fillIfPresent(page, "#PolicyEffectiveDate", payload.quoteSetup.effectiveDate);
    await fillIfPresent(page, "#PolicyClientAgentCustomerID", payload.quoteSetup.agencyCustomerId);
    await fillIfPresent(page, "#PolicyDescriptiveName", payload.quoteSetup.quoteDescription);
    await ensureApplicantSectionReady(page);

    updateStep("safeco_applicant");
    await fillIfPresent(page, "#PolicyClientPersonFirstName", payload.applicant.firstName);
    await fillIfPresent(page, "#PolicyClientPersonMiddleName", payload.applicant.middleName);
    await fillIfPresent(page, "#PolicyClientPersonLastName", payload.applicant.lastName);
    await fillIfPresent(page, "#PolicyClientPersonBirthdate", payload.applicant.birthDate);
    await selectByLabelOrValue(page, "#PolicyClientPersonMaritalStatus", payload.applicant.maritalStatus);

    await clickYesNo(page, ["PolicyDwellingCoApplicantYN"], payload.applicant.coApplicantPresent);
    await page.waitForTimeout(500).catch(() => undefined);
    if (payload.applicant.coApplicantPresent === "Yes") {
      await fillIfPresent(page, "#PolicyDwellingCoApplicantFirstName", payload.applicant.coApplicantFirstName);
      await fillIfPresent(page, "#PolicyDwellingCoApplicantLastName", payload.applicant.coApplicantLastName);
      await fillIfPresent(page, "#PolicyDwellingCoApplicantBirthdate", payload.applicant.coApplicantBirthDate);
      await selectByLabelOrValue(
        page,
        "#PolicyDwellingCoApplicantMaritalStatus",
        payload.applicant.coApplicantMaritalStatus,
      );
      await selectRelationshipToInsuredIfVisible(page, payload.applicant.relationshipToInsured).catch(() => undefined);
    }

    const phoneParts = parsePhoneParts(payload.applicant.primaryPhone);
    if (phoneParts) {
      await fillIfPresent(page, 'input[name="PolicyClientHomePhoneNumberAreaCode"]', phoneParts.area);
      await fillIfPresent(page, 'input[name="PolicyClientHomePhoneNumberPrefix"]', phoneParts.prefix);
      await fillIfPresent(page, 'input[name="PolicyClientHomePhoneNumberSuffix"]', phoneParts.suffix);
    }
    await fillFirstPresent(
      page,
      ["#PolicyClientEmailAddress", "#PolicyClientPersonEmailAddress", 'input[id*="EmailAddress"]'],
      payload.applicant.email,
    );
    await selectReasonForPolicyRequired(page, payload.applicant.reasonForPolicy);
    await selectAdditionalInterests(page, payload.applicant.additionalInterestsPresent);

    updateStep("safeco_address");
    await advanceUntilAnyVisible(
      page,
      [
        "#PolicyClientMailingLocationAddressLine1",
        "#PolicyHomeDataLocationAddressLine1",
        "#PolicyClientMailingAddressLine1",
        '[id*="MailingLocationAddressLine1"]',
        '[id*="LocationAddressLine1"]',
        "#PolicyClientMailingLocationCity",
        "#PolicyHomeDataLocationCity",
        "#PolicyClientMailingCity",
        '[id*="MailingLocationCity"]',
        '[id*="LocationCity"]',
        "#SPUI_UnderwritingContainer",
      ],
      6,
    );
    await fillRequiredField(
      page,
      [
        "#PolicyClientMailingLocationAddressLine1",
        "#PolicyHomeDataLocationAddressLine1",
        "#PolicyClientMailingAddressLine1",
        'input[name*="MailingLocationAddressLine1"]',
        'input[name*="MailingAddressLine1"]',
        '[id*="MailingLocationAddressLine1"]',
        '[id*="LocationAddressLine1"]',
      ],
      payload.address.mailingAddressLine1,
      "Mailing Address",
    );
    await fillIfPresent(page, "#PolicyClientMailingLocationAddressLine2", payload.address.mailingAddressLine2);
    await fillRequiredField(
      page,
      [
        "#PolicyClientMailingLocationCity",
        "#PolicyHomeDataLocationCity",
        "#PolicyClientMailingCity",
        'input[name*="MailingLocationCity"]',
        'input[name*="MailingCity"]',
        '[id*="MailingLocationCity"]',
        '[id*="LocationCity"]',
      ],
      payload.address.mailingCity,
      "City",
    );
    await selectRequiredField(
      page,
      [
        "#PolicyClientMailingLocationState",
        "#PolicyHomeDataLocationState",
        "#PolicyClientMailingState",
        'select[name*="MailingLocationState"]',
        'select[name*="MailingState"]',
        '[id*="MailingLocationState"]',
        '[id*="LocationState"]',
      ],
      normalizeStateLabel(payload.address.mailingState),
      "State",
    );
    await fillRequiredField(
      page,
      [
        "#PolicyClientMailingLocationZipCode",
        "#PolicyHomeDataLocationZipCode",
        "#PolicyClientMailingZipCode",
        'input[name*="MailingLocationZipCode"]',
        'input[name*="MailingZipCode"]',
        '[id*="MailingLocationZipCode"]',
        '[id*="LocationZipCode"]',
      ],
      payload.address.mailingZipCode,
      "ZIP Code",
    );

    const sameAsMailing = payload.address.locationSameAsMailing ?? "Yes";
    await clickYesNo(
      page,
      [
        "PolicyHomeDataLocationSameAsMailingYN",
        "PolicyDwellingLocationSameAsMailingYN",
        "PolicyLocationSameAsMailingYN",
      ],
      sameAsMailing,
    ).catch(async () => {
      const ok = await clickYesNoByQuestionText(
        page,
        /is the location address the same as the mailing address/i,
        sameAsMailing,
      ).catch(() => false);
      if (!ok) {
        throw new Error("[Safeco] Could not select required field: Is the location address the same as the mailing address?");
      }
    });
    if (sameAsMailing === "No") {
      await fillFirstPresent(
        page,
        ["#PolicyDwellingLocationAddressLine1", "#PolicyHomeDataLocationAddressLine1"],
        payload.address.locationAddressLine1,
      );
      await fillIfPresent(page, "#PolicyDwellingLocationAddressLine2", payload.address.locationAddressLine2);
      await fillFirstPresent(page, ["#PolicyDwellingLocationCity", "#PolicyHomeDataLocationCity"], payload.address.locationCity);
      await selectFirstPresent(
        page,
        ["#PolicyDwellingLocationState", "#PolicyHomeDataLocationState"],
        normalizeStateLabel(payload.address.locationState),
      );
      await fillFirstPresent(
        page,
        ["#PolicyDwellingLocationZipCode", "#PolicyHomeDataLocationZipCode"],
        payload.address.locationZipCode,
      );
    }

    updateStep("safeco_underwriting");
    await ensureUnderwritingSectionReady(page);

    await clickYesNo(
      page,
      ["PolicyDwellingCourseConstructionYN", "PolicyDwellingCourseConstruction", "PolicyDwellingUnderConstructionYN"],
      payload.underwriting.underConstruction,
    );
    if (payload.underwriting.underConstruction === "Yes") {
      if (payload.underwriting.constructionCompletedWithin12Months) {
        await clickYesNo(page, ["PolicyDwellingConstructionCompletedYN"], payload.underwriting.constructionCompletedWithin12Months);
      }
      if (payload.underwriting.licensedContractor) {
        await clickYesNo(page, ["PolicyDwellingLicensedConstructionYN"], payload.underwriting.licensedContractor);
      }
      if (payload.underwriting.contractorNamedInsured) {
        await clickYesNo(page, ["PolicyDwellingNameInsuredYN"], payload.underwriting.contractorNamedInsured);
      }
    }

    await clickYesNo(page, ["PolicyDwellingBusinessOnPremisesYN"], payload.underwriting.businessOnPremises);
    if (payload.underwriting.businessOnPremises === "Yes") {
      await selectByLabelOrValue(page, "#PolicyDwellingBusinessOnPremisesCategory", payload.underwriting.businessType);
      await fillIfPresent(page, "#PolicyDwellingBusinessOnPremisesExpl", payload.underwriting.businessExplanation);
      if (payload.underwriting.businessIncidental) {
        await clickYesNo(page, ["PolicyDwellingBusinessOnPremisesIncidentalYN"], payload.underwriting.businessIncidental);
      }
      await fillIfPresent(page, "#PolicyDwellingBusinessOnPremisesNumEmployees", payload.underwriting.businessEmployees);
    }

    await clickYesNo(page, ["PolicyDwellingRentedToOthersYN", "PolicyDwellingRentedToOthersSTB"], payload.underwriting.rentedToOthers);
    await clickYesNo(page, ["PolicyDwellingUndesirableAnimalYN"], payload.underwriting.undesirableAnimal);
    await selectRequiredField(
      page,
      ["#PolicyDwellingDogsOwned", '[id*="DogsOwned"]'],
      payload.underwriting.dogsOwned,
      "Number of dogs on premises",
    );
    if (payload.underwriting.dogsOwned !== "0") {
      await selectByLabelOrValue(page, "#PolicyDwellingDogBreedYN", payload.underwriting.dogBreed);
    }
    await clickYesNo(page, ["PolicyDwellingHorsesLivestockYN"], payload.underwriting.horsesLivestock);
    const normalizedMonthsOccupied = normalizeMonthsOccupiedValue(payload.underwriting.monthsOccupied);
    await selectMonthsOccupiedRequired(page, normalizedMonthsOccupied);
    const currentlyInsured = normalizeCurrentlyInsuredValue(payload.underwriting.currentlyInsured);
    await selectCurrentlyInsuredRequired(page, currentlyInsured);
    if (currentlyInsured === "Yes") {
      await selectFirstPresent(
        page,
        ["#PolicyPrevInsuranceCarrierValue", '[id*="PrevInsuranceCarrier"]'],
        payload.underwriting.currentCarrier,
      );
    }
    await clickYesNo(
      page,
      ["PolicyDwellingDwellingHazardsYN", "PolicyDwellingHazardsYN"],
      payload.underwriting.dwellingHazards,
    );
    if (payload.underwriting.dwellingHazards === "Yes") {
      const selectedHazards = await selectDwellingHazardDetails(page, payload.underwriting.dwellingHazardDetails);
      if (selectedHazards === 0) {
        const defaultSelected = await checkOptionByLabel(page, /unrepaired damages from a prior loss/i);
        if (!defaultSelected) {
          throw new Error(
            "[Safeco] dwellingHazards is Yes, but no hazard detail options were selectable. Provide underwriting.dwellingHazardDetails.",
          );
        }
      }
    }
    await selectRequiredField(
      page,
      [
        "#PolicyDwellingNumberOfOccupants",
        "#PolicyDwellingOccupants",
        '[id*="NumberOfOccupants"]',
      ],
      payload.underwriting.occupants,
      "Number of Occupants",
    );
    await clickYesNo(page, ["PolicyInsuranceCancelNonRenewYN"], payload.underwriting.insuranceCancelled);
    if (payload.underwriting.insuranceCancelled === "Yes") {
      await fillIfPresent(
        page,
        "#PolicyCancelDeclineNonRenewExpl",
        payload.underwriting.insuranceCancellationExplanation,
      );
    }
    const normalizedLossCount = normalizeLossCount(payload.underwriting.lossesLastFiveYears);
    const lossCountNum = Number(normalizedLossCount);
    const lossesAnswer: "Yes" | "No" = lossCountNum > 0 ? "Yes" : "No";
    try {
      await clickYesNo(
        page,
        [
          "PolicyDwellingLossesYN",
          "PolicyLossesYN",
          "PolicyDwellingAnyLossesYN",
          "PolicySPILossesYN",
          "PolicyDwellingPriorLossesYN",
        ],
        lossesAnswer,
      );
    } catch {
      const clickedByText = await clickYesNoByQuestionText(
        page,
        /number of losses incurred in the last 5 years|losses incurred in the last 5 years|loss(es)? in the last 5 years|prior losses/i,
        lossesAnswer,
      ).catch(() => false);
      if (!clickedByText) {
        const clickedByFragments = await clickYesNoByNameFragments(
          page,
          ["Losses", "SPILosses", "DwellingLosses", "PriorLosses", "AnyLosses"],
          lossesAnswer,
        );
        if (!clickedByFragments) {
          throw new Error(`[Safeco] Could not select losses Yes/No as "${lossesAnswer}" using known selectors and fallbacks.`);
        }
      }
    }
    await setLossCountRequired(page, normalizedLossCount);
    if (lossesAnswer === "Yes") {
      const lossDetailSelectors = ["#PolicySPILosses1LossDate", "#PolicySPILosses1LossAmount", "#PolicySPILosses1LossCategory"];
      let lossDetailVisible = await waitForAnyVisible(page, lossDetailSelectors, 10000);
      if (!lossDetailVisible) {
        await clickYesNoByQuestionText(
          page,
          /number of losses incurred in the last 5 years|losses incurred in the last 5 years/i,
          "Yes",
        ).catch(() => false);
        lossDetailVisible = await waitForAnyVisible(page, lossDetailSelectors, 7000);
      }
      if (!lossDetailVisible) {
        throw new Error(
          "[Safeco] Loss details section did not appear after selecting losses = Yes and setting Number of losses.",
        );
      }
    }
    await fillLossDetailFields(page, payload.underwriting.lossesLastFiveYears, Number(normalizedLossCount));
    await selectRequiredField(
      page,
      ["#PolicyDwellingOwnershipMonth", '[id*="OwnershipMonth"]'],
      normalizeOwnershipMonthValue(payload.underwriting.ownershipMonth),
      "Date applicant became owner - Month",
    );
    await fillRequiredField(
      page,
      ["#PolicyDwellingOwnershipYear", '[id*="OwnershipYear"]'],
      payload.underwriting.ownershipYear,
      "Date applicant became owner - Year",
    );
    if (payload.underwriting.hasOtherSafecoPolicy === "Yes") {
      await selectByLabelOrValue(page, "#PolicyXrefPolicies1PolicyType", payload.underwriting.policyType);
      await fillIfPresent(page, "#PolicyXrefPolicies1PolicyNumber", payload.underwriting.policyNumber);
      if (!payload.underwriting.policyNumber && payload.underwriting.notYetIssued === "Yes") {
        const notYetIssued = page.locator("#PolicyXrefPolicies1NotYetIssuedYN").first();
        if (await notYetIssued.isVisible().catch(() => false)) {
          await notYetIssued.check().catch(() => undefined);
        }
      }
    }

    updateStep("safeco_underwriting_continue");
    await selectRelationshipToInsuredIfVisible(page, payload.applicant.relationshipToInsured).catch(() => undefined);
    try {
      await advanceUntilVisible(page, "#PolicyDwellingApplicantFirstName", 2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/relationship to insured/i.test(msg)) {
        await selectRelationshipToInsuredRequired(page, payload.applicant.relationshipToInsured);
        await clickContinue(page);
        await advanceUntilVisible(page, "#PolicyDwellingApplicantFirstName", 1);
      } else {
        throw err;
      }
    }
    if (payload.applicant.applicantSSN) {
      const ssn = payload.applicant.applicantSSN.replace(/\D/g, "");
      if (ssn.length >= 9) {
        await fillIfPresent(page, 'input[name="PolicyDwellingApplicantSocialSecurityNumberFirstThree"]', ssn.slice(0, 3));
        await fillIfPresent(page, 'input[name="PolicyDwellingApplicantSocialSecurityNumberMiddleTwo"]', ssn.slice(3, 5));
        await fillIfPresent(page, 'input[name="PolicyDwellingApplicantSocialSecurityNumberLastFour"]', ssn.slice(5, 9));
      }
    }
    if (payload.applicant.coApplicantPresent === "Yes") {
      await selectRelationshipToInsuredRequired(page, payload.applicant.relationshipToInsured);
    }
    if (payload.applicant.coApplicantPresent === "Yes" && payload.applicant.coApplicantSSN) {
      const ssn = payload.applicant.coApplicantSSN.replace(/\D/g, "");
      if (ssn.length >= 9) {
        await fillIfPresent(page, 'input[name="PolicyDwellingCoApplicantSocialSecurityNumberFirstThree"]', ssn.slice(0, 3));
        await fillIfPresent(page, 'input[name="PolicyDwellingCoApplicantSocialSecurityNumberMiddleTwo"]', ssn.slice(3, 5));
        await fillIfPresent(page, 'input[name="PolicyDwellingCoApplicantSocialSecurityNumberLastFour"]', ssn.slice(5, 9));
      }
    }

    updateStep("safeco_dwelling_information");
    await advanceUntilVisible(page, 'label[for="PolicyDwellingOutdatedElectricalYNY"]', 2);
    await clickYesNo(page, ["PolicyDwellingOutdatedElectricalYN"], payload.dwellingInformation.outdatedElectrical);
    await selectByLabelOrValue(
      page,
      "#PolicyDwellingInCitySuburbDistrict",
      toDwellingLocatedValue(payload.dwellingInformation.dwellingLocatedIn),
    );
    await selectByLabelOrValue(
      page,
      "#PolicyDwellingRoofingRenovationType",
      toRoofRenovationValue(payload.dwellingInformation.roofRenovation),
    );
    if (payload.dwellingInformation.roofRenovationYear) {
      await fillIfPresent(page, "#PolicyDwellingRoofingRenovationYear", payload.dwellingInformation.roofRenovationYear);
    }
    await selectByLabelOrValue(
      page,
      "#PolicyDwellingPlumbingRenovationType",
      toPlumbingRenovationValue(payload.dwellingInformation.plumbingRenovation),
    );
    if (payload.dwellingInformation.plumbingRenovationYear) {
      await fillIfPresent(
        page,
        "#PolicyDwellingPlumbingRenovationYear",
        payload.dwellingInformation.plumbingRenovationYear,
      );
    }
    await selectByLabelOrValue(
      page,
      "#PolicyDwellingSprinklerCrType",
      toFireSprinklerValue(payload.dwellingInformation.fireSprinkler ?? ""),
    );

    updateStep("safeco_cost_guide");
    await advanceUntilVisible(page, "#PolicyDwellingGarages1ID", 2);
    await selectByLabelOrValue(page, "#PolicyDwellingGarages1ID", "20002");
    await fillIfPresent(page, "#PolicyDwellingGarages1Amount", "1");
    await selectByLabelOrValue(page, "#PolicyDwellingAirConditioningSystems1ID", "60014");
    await fillIfPresent(page, "#PolicyDwellingAirConditioningSystems1Amount", "100");

    updateStep("safeco_summary");
    await advanceUntilVisible(page, "#btnPrint", 6);

    updateStep("safeco_generate_pdf");
    const pdfPath = await generateSafecoPdf(context, page, jobId);
    updateStep("safeco_done");
    return { pdfPath };
  } catch (err) {
    logger.error("[Safeco] Flow failed", { err });
    throw err;
  } finally {
    await browser.close();
  }
}
