import { BrowserContext, chromium, Frame, Locator, Page } from "playwright";
import { playwrightTravelerJobStore } from "./playwrightTraveler.job-store";
import { pollTravelersWebhookOtp } from "./playwrightTraveler.otp";
import type { PlaywrightTravelerRunRequest } from "./playwrightTraveler.types";

type TravelersFormRoot = Page | Frame;

/** Travelers DOM ids are often numeric — `#123` is invalid CSS; use attribute selector. */
function travelersLocatorByElementId(root: TravelersFormRoot, elementId: string): Locator {
  const escaped = elementId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return root.locator(`[id="${escaped}"]`).first();
}

const TRAVELERS_HOME_COVERAGE_PANEL = "#homeCoverageContainer";
const TRAVELERS_COVERAGE_LIMITS_PANEL = "#q2coverageLimits";
const TRAVELERS_COVERAGE_LEVEL_PANEL = "#q2coverageLevel";
const TRAVELERS_PORTFOLIO_PANEL = "#portfolioPanelContainer";
const TRAVELERS_SIMPLE_QUOTE_CONTAINER = "#simpleQuoteContainer";
const TRAVELERS_DIGITAL_QUOTE_EMAIL_DEFAULT = "hiload123@gmail.com";
const TRAVELERS_SIMPLE_QUOTE_CONTACT_EMAIL_RADIO_ID = "1323009963_email";
const TRAVELERS_SIMPLE_QUOTE_AGENT_EMAIL_ID = "2635407051";
const TRAVELERS_SIMPLE_QUOTE_CUSTOMER_EMAIL_ID = "2519166701";

const TRAVELERS_BASE_COVERAGE_LEVEL_OPTIONS = [
  { value: "PROTECT", label: "Travelers Protect®" },
  { value: "PROTPLUS", label: "Travelers Protect Plus®" },
  { value: "PROTPRMR", label: "Travelers Protect Premier®" },
] as const;

/**
 * Hard rule for this automation flow: never use Calculate Estimate (MS).
 * Always Quote W/Out Estimate (WE) — skips the Home Replacement Cost Estimator grid.
 */
const TRAVELERS_REPLACEMENT_COST_METHOD_QUOTE_WITHOUT_ESTIMATE = {
  value: "WE",
  label: "Quote W/Out Estimate",
} as const;

type TravelersPayloadKV = { key?: unknown; value?: unknown };

/**
 * Same resolution strategy as Auto-Owners `getPayloadValue` (array-of-kv, `fields`, dotted paths).
 * Kept local so Travelers does not import Auto-Owners modules.
 */
function getTravelersPayloadValue(payload: unknown, key: string): unknown {
  if (!payload) return undefined;

  if (Array.isArray(payload)) {
    const found = (payload as TravelersPayloadKV[]).find((it) => String(it?.key ?? "") === key);
    return found?.value;
  }

  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(obj, "fields")) {
      const inner = (obj as Record<string, unknown>).fields;
      const innerVal = getTravelersPayloadValue(inner, key);
      if (innerVal !== undefined) return innerVal;
    }

    const keys = Object.keys(obj);
    const looksArrayLike =
      keys.length > 0 &&
      keys.slice(0, Math.min(keys.length, 5)).every((k) => /^[0-9]+$/.test(k)) &&
      typeof obj[keys[0]] === "object" &&
      obj[keys[0]] !== null &&
      Object.prototype.hasOwnProperty.call(obj[keys[0]] as Record<string, unknown>, "key");
    if (looksArrayLike) {
      const values = Object.values(obj) as TravelersPayloadKV[];
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

function travelersTrimmedString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>)) {
    return travelersTrimmedString((v as Record<string, unknown>).value);
  }
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function formatTravelersEffectiveDateMmDdYyyy(input: unknown): string {
  const raw = travelersTrimmedString(input);
  if (!raw) {
    throw new Error("Travelers Initiate Quote requires effective date in payload (insuranceDetails.effectiveDate).");
  }

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[2]}/${ymd[3]}/${ymd[1]}`;

  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[1].padStart(2, "0")}/${mdy[2].padStart(2, "0")}/${mdy[3]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const yyyy = parsed.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  throw new Error(`Travelers effective date could not be parsed: ${raw}`);
}

function splitTravelersZip(zipRaw: string): { base: string; ext?: string } {
  const z = zipRaw.replace(/\s/g, "");
  const m = z.match(/^(\d{5})(?:-(\d{1,4}))?$/);
  if (m) return { base: m[1], ext: m[2] };
  return { base: z.slice(0, 5), ext: z.length > 5 ? z.slice(5, 9) : undefined };
}

function travelersPayloadFirstString(payload: unknown, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = travelersTrimmedString(getTravelersPayloadValue(payload, key));
    if (v) return v;
  }
  return undefined;
}

/** Maps payload Yes/No (or boolean) to Travelers radio value `1` / `0`. */
function parseTravelersYesNoPayload(payload: unknown, keys: string[], label: string): "0" | "1" {
  const raw = travelersPayloadFirstString(payload, keys);
  if (!raw) {
    throw new Error(`Travelers Report Information requires ${label} in payload (${keys.join(" or ")}).`);
  }
  const n = raw.trim().toLowerCase();
  if (n === "yes" || n === "y" || n === "true" || n === "1") return "1";
  if (n === "no" || n === "n" || n === "false" || n === "0") return "0";
  throw new Error(`Travelers ${label} must be Yes or No, got: ${raw}`);
}

function travelersPayloadKeyVariants(key: string): string[] {
  return [key, `homeownersInformations.${key}`, `occupancy.${key}`];
}

/** Strategic UI underwriting radios use YES / NO (not 0 / 1). */
function parseTravelersUwYesNoPayload(payload: unknown, keys: string[], label: string): "YES" | "NO" {
  const paths = keys.flatMap((k) => travelersPayloadKeyVariants(k));
  const raw = travelersPayloadFirstString(payload, paths);
  if (!raw) {
    throw new Error(`Travelers Home Underwriting requires ${label} in payload (${paths.join(" or ")}).`);
  }
  const n = raw.trim().toLowerCase();
  if (n === "yes" || n === "y" || n === "true" || n === "1") return "YES";
  if (n === "no" || n === "n" || n === "false" || n === "0") return "NO";
  throw new Error(`Travelers ${label} must be Yes or No, got: ${raw}`);
}

function travelersUwYesNoToPortalBinary(value: "YES" | "NO"): "0" | "1" {
  return value === "YES" ? "1" : "0";
}

function mapTravelersNumberOfFamiliesPortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (/^1\b|1\s*family|^1$/.test(t)) return { value: "1", label: "1 Family" };
  if (/^2\b|2\s*family|^2$/.test(t)) return { value: "2", label: "2 Family" };
  if (/^3\b|3\s*family|^3$/.test(t)) return { value: "3", label: "3 Family" };
  if (/^4\b|4\s*\+|4\+|4\s*family|^4$/.test(t)) return { value: "4", label: "4 Family" };
  if (/5\s*\+|5plus|5\+\s*family|^5/.test(t)) return { value: "5PLUS", label: "5+ Family" };
  throw new Error(`Travelers numberOfFamilies not recognized: ${raw}`);
}

function mapTravelersPrimarySourceOfHeatPortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (t === "g" || t.includes("central - gas") || (t.includes("gas") && !t.includes("propane"))) {
    return { value: "G", label: "Central - Gas" };
  }
  if (t.includes("central - electric") || t.includes("electric") || t === "electric") {
    return { value: "ELECTRIC", label: "Central - Electric" };
  }
  if (t.includes("central - oil") || t.includes("oil") || t === "oil") {
    return { value: "OIL", label: "Central - Oil" };
  }
  if (t.includes("none")) return { value: "NONE", label: "None" };
  if (
    t.includes("propane") ||
    t.includes("heat pump") ||
    t.includes("radiant") ||
    t.includes("wood") ||
    t.includes("coal") ||
    t.includes("pellet") ||
    t === "ot" ||
    t.includes("other")
  ) {
    return { value: "OT", label: "Other" };
  }
  throw new Error(`Travelers primarySourceOfHeat not recognized: ${raw}`);
}

function mapTravelersResidenceTypeRadioValue(raw: string): "1" | "2" {
  const t = raw.trim().toLowerCase();
  if (t.includes("secondary")) return "2";
  if (t.includes("primary")) return "1";
  throw new Error(`Travelers residenceType must be Primary or Secondary, got: ${raw}`);
}

/** Travelers portal expects MM/YYYY (e.g. 12/2024) — not MM/YY. */
function formatTravelersPurchaseMonthYear(raw: string): string {
  const trimmed = raw.trim();

  const mmyyyy = trimmed.match(/^(\d{1,2})\s*[/-]\s*(\d{4})$/);
  if (mmyyyy) {
    return `${mmyyyy[1].padStart(2, "0")}/${mmyyyy[2]}`;
  }

  const mmyy = trimmed.match(/^(\d{1,2})\s*[/-]\s*(\d{2})$/);
  if (mmyy) {
    const yy = Number.parseInt(mmyy[2], 10);
    const pivot = new Date().getFullYear() % 100;
    const yyyy = yy <= pivot ? 2000 + yy : 1900 + yy;
    return `${mmyy[1].padStart(2, "0")}/${yyyy}`;
  }

  const ymd = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (ymd) {
    return `${ymd[2]}/${ymd[1]}`;
  }

  return trimmed.replace(/\s*\/\s*/, "/");
}

function mapTravelersBuildingConstructionTypePortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (t.includes("frame")) return { value: "FRAME", label: "Frame" };
  if (t.includes("masonry")) return { value: "M", label: "Masonry" };
  if (t.includes("concrete")) return { value: "CONCRETE", label: "Concrete" };
  if (t.includes("steel")) return { value: "STEEL", label: "Steel" };
  if (t.includes("modular")) return { value: "P", label: "Modular" };
  if (t.includes("log")) return { value: "L", label: "Log Home" };
  if (t.includes("mobile") || t.includes("manufactured")) {
    return { value: "MOBILE", label: "Mobile or Manufactured" };
  }
  throw new Error(`Travelers buildingConstructionType not recognized: ${raw}`);
}

function mapTravelersSidingTypePortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (t.includes("vinyl")) return { value: "I", label: "Vinyl" };
  if (t.includes("aluminum")) return { value: "A", label: "Aluminum/Steel" };
  if (t.includes("wood")) return { value: "WOOD", label: "Wood" };
  if (t.includes("brick")) return { value: "BRICKMSN", label: "Brick/Masonry Veneer" };
  if (t.includes("stone")) return { value: "StoneVen", label: "Stone Veneer" };
  if (t.includes("stucco")) return { value: "S", label: "Stucco" };
  if (t.includes("fiber") || t.includes("cement")) return { value: "CementF", label: "Cement Fiber" };
  if (t.includes("other")) return { value: "OT", label: "All Other" };
  throw new Error(`Travelers sidingType not recognized: ${raw}`);
}

function mapTravelersPrimaryFoundationTypePortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (t === "basement" || t.includes("basement")) return { value: "BS", label: "Basement" };
  if (t.includes("crawl")) return { value: "CRAWL", label: "Crawl Space" };
  if (t.includes("slab")) return { value: "SLAB", label: "Slab" };
  if (t.includes("open") || t.includes("raised") || t.includes("pier") || t.includes("post")) {
    return { value: "OPENRAIS", label: "Open/Raised" };
  }
  if (t.includes("other")) return { value: "OPENRAIS", label: "Open/Raised" };
  throw new Error(`Travelers primaryFoundationType not recognized: ${raw}`);
}

function mapTravelersGarageTypePortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (t === "none" || t === "n") return { value: "NONE", label: "None" };
  if (t.includes("attached")) return { value: "AT", label: "Attached" };
  if (t.includes("detached")) return { value: "DT", label: "Detached" };
  if (t.includes("carport")) return { value: "CP", label: "Carport" };
  if (t.includes("basement")) return { value: "BS", label: "Basement" };
  throw new Error(`Travelers garageType not recognized: ${raw}`);
}

function mapTravelersGarageSizePortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (/^5\s*\+|5plus|5\+/.test(t)) return { value: "5PLUS", label: "5+" };
  if (t === "1" || t === "one") return { value: "1", label: "1" };
  if (t === "2" || t === "two") return { value: "2", label: "2" };
  if (t === "3" || t === "three") return { value: "3", label: "3" };
  if (t === "4" || t === "four") return { value: "4", label: "4" };
  throw new Error(`Travelers garageSizeNumberOfCars not recognized: ${raw}`);
}

function mapTravelersNumberOfStoriesPortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (/^4\s*\+|4plus|4\+/.test(t)) return { value: "4PLUS", label: "4+" };
  if (t === "3" || t === "three") return { value: "3", label: "3" };
  if (t === "2" || t === "two") return { value: "2", label: "2" };
  if (t === "1" || t === "one") return { value: "1", label: "1" };
  if (t === "1.5") return { value: "1.5", label: "1.5" };
  if (t === "2.5") return { value: "2.5", label: "2.5" };
  throw new Error(`Travelers numberOfStories not recognized: ${raw}`);
}

function mapTravelersRoofShapePortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (t.includes("gable")) return { value: "GABLE", label: "Gable" };
  if (t.includes("hip")) return { value: "HIP", label: "Hip" };
  if (t.includes("gambrel")) return { value: "GAMBREL", label: "Gambrel" };
  if (t.includes("flat")) return { value: "FLAT", label: "Flat" };
  if (t.includes("shed")) return { value: "SHED", label: "Shed" };
  if (t.includes("complex")) return { value: "COMPLEX", label: "Complex" };
  if (t.includes("other")) return { value: "OTHER", label: "Other" };
  throw new Error(`Travelers roofShape not recognized: ${raw}`);
}

function mapTravelersRoofTypePortal(raw: string): { value: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (t.includes("architectural")) return { value: "ARCH", label: "Architectural Shingle" };
  if (t.includes("asphalt") || t.includes("fiberglass")) return { value: "ASPHS", label: "Asphalt-Fiberglass" };
  if (t.includes("clay") || t.includes("concrete") || t.includes("tile")) {
    return { value: "CLAY", label: "Clay or Concrete Tile" };
  }
  if (t.includes("slate")) return { value: "SLAT", label: "Slate" };
  if (t.includes("metal")) return { value: "METL", label: "Metal" };
  if (t.includes("comp") && t.includes("wood")) return { value: "COMPW", label: "Comp Over Wood" };
  if (t.includes("wood")) return { value: "WOODSS", label: "Wood" };
  if (t.includes("polymer") || t.includes("modified")) return { value: "PLAS", label: "Modified Polymer" };
  if (t.includes("foam")) return { value: "FOAM", label: "Foam Composite" };
  if (t.includes("roll")) return { value: "ROLL", label: "Rolled Material" };
  if (t.includes("rubber") || t.includes("membrane")) return { value: "RUBB", label: "Rubber/Membrane" };
  if (t.includes("tar") || t.includes("gravel")) return { value: "TARGRB", label: "Tar & Gravel" };
  if (t.includes("t-lock") || t.includes("tlock")) return { value: "TLOCK", label: "T-Lock" };
  if (t.includes("asbestos")) return { value: "ASBO", label: "Asbestos" };
  if (t.includes("other")) return { value: "OT", label: "Other" };
  throw new Error(`Travelers roofType not recognized: ${raw}`);
}

function mapTravelersBasementFinishedPercentValue(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "yes" || t === "y" || t === "true" || t === "100" || t === "100%") return "100";
  if (t === "no" || t === "n" || t === "false" || t === "0" || t === "0%") return "0";
  const pct = raw.replace(/[^\d.]/g, "");
  if (pct) return pct;
  throw new Error(`Travelers basementFinished must be Yes, No, or a percent value, got: ${raw}`);
}

function travelersBasementFinishedOptionCandidates(raw: string): string[] {
  const percent = mapTravelersBasementFinishedPercentValue(raw);
  return [...new Set([percent, `${percent}%`, raw.trim()].filter(Boolean))];
}

/** Garage size is hidden on the portal when garage type is None. */
function travelersGarageTypeRequiresSize(garagePortalValue: string): boolean {
  return garagePortalValue !== "NONE";
}

/** Basement finished % appears only when foundation type is Basement (BS). */
function travelersFoundationIsBasement(foundationPortalValue: string): boolean {
  return foundationPortalValue === "BS";
}

function mapTravelersInsuranceStatusPortal(raw: string): { value: string; label: string } {
  const n = raw.trim().toLowerCase();
  if (n === "currentlyinsured" || n.includes("currently insured") || n === "currently insured") {
    return { value: "CURRENTLYINSURED", label: "Currently Insured" };
  }
  if (n === "noinsurance" || n.includes("no current insurance") || n.includes("no current")) {
    return { value: "NOINSURANCE", label: "No Current Insurance" };
  }
  throw new Error(
    `Travelers Insurance Status must be "Currently Insured" or "No Current Insurance", got: ${raw}`
  );
}

function mapTravelersBurglarAlarmValue(raw: string): string {
  const n = raw.trim().toLowerCase();
  if (n === "lo" || n === "local") return "LO";
  if (n === "s" || n === "smart") return "S";
  if (n === "cn" || n === "central") return "CN";
  if (n === "n" || n === "none") return "N";
  throw new Error(`Travelers Burglar Alarm could not be mapped: ${raw}`);
}

const TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS = [
  { value: "A", label: "Less than or Equal to 25/50 (CSL 75)" },
  { value: "B", label: "Greater than 25/50 (CSL 75)" },
  { value: "N", label: "No Car" },
  { value: "G", label: "Car in Storage" },
  { value: "M", label: "Military" },
  { value: "NP", label: "Car Without Insurance" },
] as const;

function normalizeTravelersDropdownText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\u00ae|\u2122/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function travelersTrailingPortalCode(raw: string): string | undefined {
  const match = raw.trim().match(/\(([A-Z]{1,2})\)\s*$/i);
  return match ? match[1].toUpperCase() : undefined;
}

function travelersStripTrailingPortalCode(raw: string): string {
  return raw.replace(/\s*\([A-Z]{1,2}\)\s*$/i, "").trim();
}

function mapTravelersCurrentAutoPolicyBodilyInjuryLimitPortal(raw: string): { value: string; label: string } {
  const trimmed = raw.trim();
  const trailingCode = travelersTrailingPortalCode(trimmed);
  if (trailingCode) {
    const byCode = TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS.find(
      (opt) => opt.value.toUpperCase() === trailingCode
    );
    if (byCode) return { ...byCode };
  }

  const target = normalizeTravelersDropdownText(travelersStripTrailingPortalCode(trimmed));

  for (const opt of TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS) {
    if (normalizeTravelersDropdownText(opt.label) === target) return { ...opt };
    if (normalizeTravelersDropdownText(opt.value) === target) return { ...opt };
  }

  const code = trailingCode ?? trimmed.toUpperCase();
  const n = target;
  if (code === "A" || n.includes("less than") || n.includes("equal to 25") || n === "25/50") {
    return { value: "A", label: TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS[0].label };
  }
  if (code === "B" || n.includes("greater than 25") || (n.includes("greater than") && n.includes("25/50"))) {
    return { value: "B", label: TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS[1].label };
  }
  if (code === "N" || n === "no car" || n.includes("no car")) {
    return { value: "N", label: TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS[2].label };
  }
  if (code === "G" || n.includes("car in storage") || n === "storage") {
    return { value: "G", label: TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS[3].label };
  }
  if (code === "M" || n.includes("military")) {
    return { value: "M", label: TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS[4].label };
  }
  if (code === "NP" || n.includes("without insurance") || n.includes("car without insurance")) {
    return { value: "NP", label: TRAVELERS_AUTO_POLICY_BI_LIMIT_OPTIONS[5].label };
  }

  throw new Error(
    `Travelers Current Auto Policy Bodily Injury Limit could not be mapped: ${raw}. Send exact dropdown text (e.g. "No Car") or portal code (N, A, B, G, M, NP).`
  );
}

async function resolveTravelersLossesAutoPolicyLimitChoice(
  root: TravelersFormRoot,
  raw: string
): Promise<{ value: string; label: string }> {
  const trimmed = raw.trim();
  const target = normalizeTravelersDropdownText(trimmed);

  const fromDom = await root.evaluate(({ optionText, targetNorm }) => {
    const dataLabel = "Current Auto Policy Bodily Injury Limit";
    let bestSelect: HTMLSelectElement | null = null;
    let bestArea = 0;

    const consider = (candidate: HTMLSelectElement) => {
      const style = window.getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = candidate.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestSelect = candidate;
      }
    };

    document.querySelector("#autoPolicyLimits")?.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
      consider(el as HTMLSelectElement);
    });
    if (!bestSelect) {
      document.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
        consider(el as HTMLSelectElement);
      });
    }

    const selectEl = bestSelect as HTMLSelectElement | null;
    if (!selectEl) return null;

    for (const opt of Array.from(selectEl.options)) {
      const label = (opt.textContent ?? "").trim();
      const value = (opt.value ?? "").trim();
      if (!value) continue;
      const labelNorm = label.toLowerCase().replace(/\s+/g, " ");
      const valueNorm = value.toLowerCase().replace(/\s+/g, " ");
      if (
        labelNorm === targetNorm ||
        valueNorm === targetNorm ||
        label.toLowerCase() === optionText.trim().toLowerCase() ||
        value.toLowerCase() === optionText.trim().toLowerCase()
      ) {
        return { value, label };
      }
    }
    return null;
  }, { optionText: trimmed, targetNorm: target });

  if (fromDom?.value) return fromDom;
  return mapTravelersCurrentAutoPolicyBodilyInjuryLimitPortal(trimmed);
}

function travelersInsuranceStatusOptionIndex(value: string): number {
  return value === "NOINSURANCE" ? 2 : 1;
}

async function applyTravelersInsuranceStatusInDom(
  root: TravelersFormRoot,
  mapped: { value: string; label: string }
): Promise<{ value: string; selectId: string }> {
  return root.evaluate((choice) => {
    const panelSelectors = ["#homeUnderwritingInsuranceHistory", "#underwritingInsuranceHistory"];
    let bestSelect: HTMLSelectElement | null = null;
    let bestArea = 0;

    const considerSelect = (candidate: HTMLSelectElement | null) => {
      if (!candidate) return;
      const style = window.getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = candidate.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestSelect = candidate;
      }
    };

    for (const panelSel of panelSelectors) {
      const panel = document.querySelector(panelSel);
      if (!panel) continue;
      panel.querySelectorAll('select[data-label="Insurance Status"]').forEach((el) => {
        considerSelect(el as HTMLSelectElement);
      });
    }

    if (!bestSelect) {
      document.querySelectorAll('select[data-label="Insurance Status"]').forEach((el) => {
        considerSelect(el as HTMLSelectElement);
      });
    }

    if (!bestSelect) return { value: "", selectId: "" };
    const selectEl: HTMLSelectElement = bestSelect;

    let matched: HTMLOptionElement | null = null;
    for (const opt of Array.from(selectEl.options)) {
      const text = (opt.textContent ?? "").trim();
      if (opt.value === choice.value || text === choice.label) {
        matched = opt;
        break;
      }
    }
    if (!matched) return { value: "", selectId: selectEl.id ?? "" };

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) {
      setter.call(selectEl, matched.value);
    } else {
      selectEl.value = matched.value;
    }
    matched.selected = true;
    selectEl.selectedIndex = matched.index;

    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

    const jq = (window as { $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown } }).$;
    if (jq) {
      const chain = jq(selectEl);
      chain.val(matched.value);
      chain.trigger("change");
    }

    return { value: selectEl.value, selectId: selectEl.id ?? "" };
  }, mapped);
}

async function setTravelersInsuranceStatus(root: TravelersFormRoot, raw: string): Promise<void> {
  const mapped = mapTravelersInsuranceStatusPortal(raw);
  const optionIndex = travelersInsuranceStatusOptionIndex(mapped.value);

  await scrollTravelersHomeUnderwritingPage(root);

  let result = await applyTravelersInsuranceStatusInDom(root, mapped);

  const selectByPanel = root
    .locator(
      '#homeUnderwritingInsuranceHistory select[data-label="Insurance Status"], #underwritingInsuranceHistory select[data-label="Insurance Status"]'
    )
    .first();

  if (!result.value) {
    await selectByPanel.scrollIntoViewIfNeeded().catch(() => undefined);
    await selectByPanel.click({ timeout: 10_000 }).catch(() => undefined);
    await selectByPanel.selectOption({ index: optionIndex }).catch(async () => {
      await selectByPanel.selectOption({ value: mapped.value });
    });
    await selectByPanel.press("Tab").catch(() => undefined);
    result = await applyTravelersInsuranceStatusInDom(root, mapped);
  }

  if (!result.value) {
    const select =
      result.selectId.length > 0
        ? travelersLocatorByElementId(root, result.selectId)
        : selectByPanel;

    await select.scrollIntoViewIfNeeded().catch(() => undefined);
    await select.focus().catch(() => undefined);
    await select.click({ timeout: 10_000 }).catch(() => undefined);
    for (let i = 0; i < optionIndex; i++) {
      await select.press("ArrowDown");
    }
    await select.press("Enter");
    await select.press("Tab").catch(() => undefined);
    result = await applyTravelersInsuranceStatusInDom(root, mapped);
  }

  if (!result.value) {
    throw new Error(
      `Travelers Insurance Status was not set (still blank). expected=${mapped.value} (${mapped.label}).`
    );
  }
}

async function scrollTravelersHomeUnderwritingPage(root: TravelersFormRoot): Promise<void> {
  await root
    .evaluate(() => {
      const main = document.querySelector("#main");
      if (main) main.scrollTop = main.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    })
    .catch(() => undefined);
  await new Promise<void>((r) => {
    setTimeout(r, 350);
  });
}

async function setTravelersSmRadioByDataLabel(
  root: TravelersFormRoot,
  dataLabel: string,
  value: "YES" | "NO"
): Promise<void> {
  const container = root.locator(`span.sm-answer-radio[data-label="${dataLabel}"]`).first();
  await container.waitFor({ state: "attached", timeout: 60_000 });
  await container.scrollIntoViewIfNeeded().catch(() => undefined);

  const radio = container.locator(`input[type="radio"][value="${value}"]`).first();
  await radio.waitFor({ state: "attached", timeout: 15_000 });

  const radioId = await radio.getAttribute("id");
  const label = radioId
    ? container.locator(`label[for="${radioId}"]`).first()
    : container.locator("label").nth(value === "YES" ? 0 : 1);

  await label.click({ force: true, timeout: 10_000 }).catch(() => undefined);
  await radio.evaluate((el: HTMLInputElement) => {
    el.checked = true;
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  if (!(await radio.isChecked().catch(() => false))) {
    await radio.click({ force: true });
  }

  if (!(await radio.isChecked().catch(() => false))) {
    throw new Error(`Travelers could not select "${dataLabel}" value=${value}.`);
  }

  await new Promise<void>((r) => {
    setTimeout(r, 400);
  });
}

async function setTravelersSmSelectByDataLabel(
  root: TravelersFormRoot,
  dataLabel: string,
  optionText: string
): Promise<void> {
  const select = root.locator(`select[data-label="${dataLabel}"]`).first();
  await select.waitFor({ state: "visible", timeout: 60_000 });
  await select.scrollIntoViewIfNeeded().catch(() => undefined);

  const picked = await select
    .evaluate((el: HTMLSelectElement, text: string) => {
      const target = text.trim().toLowerCase();
      for (const opt of Array.from(el.options)) {
        const label = (opt.textContent ?? "").trim();
        const value = (opt.value ?? "").trim();
        if (
          label.toLowerCase() === target ||
          value.toLowerCase() === target ||
          label.toLowerCase().includes(target) ||
          target.includes(label.toLowerCase())
        ) {
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
      }
      return false;
    }, optionText)
    .catch(() => false);

  if (!picked) {
    await select.selectOption({ label: optionText }).catch(async () => {
      throw new Error(`Travelers could not select "${dataLabel}" option: ${optionText}`);
    });
    await select.evaluate((el: HTMLSelectElement) => {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

async function setTravelersSmBurglarAlarm(root: TravelersFormRoot, valueCode: string): Promise<void> {
  const container = root.locator('span.sm-answer-radio[data-label="Burglar Alarm"]').first();
  await container.waitFor({ state: "attached", timeout: 60_000 });
  await container.scrollIntoViewIfNeeded().catch(() => undefined);

  const radio = container.locator(`input[type="radio"][value="${valueCode}"]`).first();
  await radio.waitFor({ state: "attached", timeout: 15_000 });
  const radioId = await radio.getAttribute("id");
  const label = radioId ? container.locator(`label[for="${radioId}"]`).first() : container.locator("label").first();

  await label.click({ force: true }).catch(() => undefined);
  await radio.evaluate((el: HTMLInputElement) => {
    el.checked = true;
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function waitForTravelersHomeUnderwritingPage(
  context: BrowserContext,
  preferredPage: Page,
  timeoutMs: number
): Promise<Page> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pages = [...context.pages()];
    if (!pages.includes(preferredPage)) pages.unshift(preferredPage);

    for (const p of pages) {
      await p.bringToFront().catch(() => undefined);
      await p
        .locator("#loaderContainer")
        .waitFor({ state: "hidden", timeout: 5_000 })
        .catch(() => undefined);

      const uw = p.locator("#homeUnderwritingContainer").first();
      const misc = p.locator("#uwEligibilityQuestionsContainer").first();
      if (
        (await uw.isVisible().catch(() => false)) &&
        (await misc.isVisible().catch(() => false))
      ) {
        return p;
      }
    }

    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
  }

  throw new Error("Travelers Home Underwriting page did not load after Report Information.");
}

async function findTravelersReportInformationRoot(
  context: BrowserContext,
  preferredPage: Page
): Promise<TravelersFormRoot> {
  const pages = [...context.pages()];
  if (!pages.includes(preferredPage)) pages.unshift(preferredPage);

  for (const p of pages) {
    await p.bringToFront().catch(() => undefined);
    const roots: TravelersFormRoot[] = [p, ...p.frames()];
    for (const root of roots) {
      const title = root.locator("#overlayTitle").filter({ hasText: /Report Information/i });
      if (await title.isVisible().catch(() => false)) return root;
    }
  }

  throw new Error("Travelers Report Information modal not found on any page or frame.");
}

async function scrollTravelersReportModal(root: TravelersFormRoot): Promise<void> {
  const body = root.locator("#overlayBody").first();
  if ((await body.count().catch(() => 0)) > 0) {
    await body.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await new Promise<void>((r) => {
      setTimeout(r, 400);
    });
  }
  await root
    .evaluate(() => {
      const footer = document.querySelector("#overlayFooter");
      footer?.scrollIntoView({ block: "end" });
    })
    .catch(() => undefined);
}

async function setTravelersOverlayRadioByDataLabel(
  root: TravelersFormRoot,
  dataLabel: string,
  value: "0" | "1"
): Promise<void> {
  await scrollTravelersReportModal(root);

  const container = root
    .locator(`span.t-radio-container[data-label="${dataLabel}"]`)
    .first();
  await container.waitFor({ state: "attached", timeout: 60_000 });
  await container.scrollIntoViewIfNeeded().catch(() => undefined);

  const radio = container.locator(`input[type="radio"][value="${value}"]`).first();
  await radio.waitFor({ state: "attached", timeout: 15_000 });

  const radioId = await radio.getAttribute("id");
  const label = radioId ? container.locator(`label[for="${radioId}"]`).first() : container.locator("label").nth(value === "1" ? 0 : 1);

  await label.click({ force: true, timeout: 10_000 }).catch(() => undefined);
  await radio.evaluate((el: HTMLInputElement) => {
    el.checked = true;
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  if (!(await radio.isChecked().catch(() => false))) {
    await radio.click({ force: true });
  }

  if (!(await radio.isChecked().catch(() => false))) {
    throw new Error(`Travelers could not select radio "${dataLabel}" value=${value}.`);
  }
}

function formatTravelersPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)})${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return input.trim();
}

function normalizeTravelersStateCode(input: string): string {
  const s = input.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(s)) return s;
  return s;
}

function formatTravelersZipForInput(zipRaw: string): string {
  const { base, ext } = splitTravelersZip(zipRaw);
  return ext ? `${base}-${ext}` : base;
}

function travelersFeetFromHydrantLocator(root: TravelersFormRoot): Locator {
  return root.locator(
    '#residenceAdditionalLocationContainer input[data-label="Feet from Hydrant"], .residence-additional-location_ResidenceAdditionalLocation__Duzs4 input[data-label="Feet from Hydrant"], #residenceContainer input[data-label="Feet from Hydrant"]'
  );
}

async function resolveTravelersVisibleFeetFromHydrantInput(root: TravelersFormRoot): Promise<Locator> {
  const candidates = travelersFeetFromHydrantLocator(root);
  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    if (
      (await candidate.isVisible().catch(() => false)) &&
      !(await candidate.isDisabled().catch(() => true))
    ) {
      return candidate;
    }
  }

  const foundId = await root.evaluate(() => {
    const selectors = [
      '#residenceAdditionalLocationContainer input[data-label="Feet from Hydrant"]',
      '.residence-additional-location_ResidenceAdditionalLocation__Duzs4 input[data-label="Feet from Hydrant"]',
      '#residenceContainer input[data-label="Feet from Hydrant"]',
      'input[data-label="Feet from Hydrant"]',
    ];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const input = el as HTMLInputElement;
        const style = window.getComputedStyle(input);
        const rect = input.getBoundingClientRect();
        if (
          !input.disabled &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          return input.id || "";
        }
      }
    }
    return "";
  });

  if (foundId) {
    const byId = travelersLocatorByElementId(root, foundId);
    if (await byId.isVisible().catch(() => false)) return byId;
  }

  throw new Error("Travelers Feet from Hydrant input is not visible on the Residence page.");
}

async function expandTravelersResidenceAdditionalLocationPanel(root: TravelersFormRoot): Promise<void> {
  const rootPage = root as Page;
  if (await isTravelersFeetFromHydrantReady(rootPage)) return;

  const header = root
    .locator(
      '#residenceAdditionalLocationContainer .t-column-header, .residence-additional-location_ResidenceAdditionalLocation__Duzs4 .t-column-header'
    )
    .filter({ hasText: /Additional Location Information/i })
    .first();
  if (await header.isVisible().catch(() => false)) {
    await header.click({ timeout: 10_000 }).catch(() => undefined);
    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
  }
}

async function fillTravelersFeetFromHydrant(root: TravelersFormRoot, raw: string): Promise<void> {
  const digits = raw.replace(/\D/g, "").trim() || raw.trim();
  if (!digits) {
    throw new Error("Travelers feetFromHydrant must be a non-empty number.");
  }

  await expandTravelersResidenceAdditionalLocationPanel(root);

  const loc = await resolveTravelersVisibleFeetFromHydrantInput(root);
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  if (await loc.isDisabled().catch(() => false)) {
    throw new Error('Travelers "Feet from Hydrant" is disabled and cannot be filled.');
  }

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click({ timeout: 10_000, force: true });
  await loc.press("Control+A").catch(() => undefined);
  await loc.press("Backspace").catch(() => undefined);
  await loc.fill(digits).catch(() => undefined);
  await loc.pressSequentially(digits, { delay: 40 });
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) {
      setter.call(el, v);
    } else {
      el.value = v;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    const jq = (window as { $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown } }).$;
    if (jq) {
      const chain = jq(el);
      chain.val(v);
      chain.trigger("change");
    }
  }, digits);
  await loc.press("Tab").catch(() => undefined);

  const actual = (await loc.inputValue().catch(() => "")).trim();
  if (actual !== digits) {
    throw new Error(`Travelers Feet from Hydrant did not retain value. expected="${digits}" actual="${actual}"`);
  }
}

function travelersHomeCharacteristicsPanel(root: TravelersFormRoot): Locator {
  return root.locator("#residenceHomeCharacteristicsContainer").first();
}

async function scrollTravelersHomeCharacteristicsIntoView(root: TravelersFormRoot): Promise<void> {
  const panel = travelersHomeCharacteristicsPanel(root);
  await panel.scrollIntoViewIfNeeded().catch(() => undefined);
  await root
    .evaluate(() => {
      const el = document.querySelector("#residenceHomeCharacteristicsContainer");
      el?.scrollIntoView({ block: "center", behavior: "instant" });
      const main = document.querySelector("#main");
      if (main) main.scrollTop = Math.min(main.scrollHeight, main.scrollTop + 500);
    })
    .catch(() => undefined);
  await new Promise<void>((r) => {
    setTimeout(r, 350);
  });
}

async function isTravelersHomeCharacteristicsReady(page: Page): Promise<boolean> {
  const panel = page.locator("#residenceHomeCharacteristicsContainer").first();
  const yearBuilt = panel.locator('input[data-label="Year Built"]').first();
  return (
    (await panel.isVisible().catch(() => false)) && (await yearBuilt.isVisible().catch(() => false))
  );
}

async function resolveTravelersHomeCharacteristicsVisibleInputId(
  root: TravelersFormRoot,
  dataLabel: string
): Promise<string> {
  const inputId = await root.evaluate((label) => {
    const panel = document.querySelector("#residenceHomeCharacteristicsContainer");
    if (!panel) return "";

    let bestInput: HTMLInputElement | null = null;
    let bestArea = 0;
    panel.querySelectorAll(`input[data-label="${label}"]`).forEach((el) => {
      const input = el as HTMLInputElement;
      const style = window.getComputedStyle(input);
      if (input.disabled || style.display === "none" || style.visibility === "hidden") return;
      const rect = input.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestInput = input;
      }
    });

    if (!bestInput) return "";
    const inputEl: HTMLInputElement = bestInput;
    return inputEl.id ?? "";
  }, dataLabel);

  if (!inputId) {
    throw new Error(`Travelers Home Characteristics visible input not found for "${dataLabel}".`);
  }
  return inputId;
}

function travelersPurchaseMonthYearDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function travelersPurchaseMonthYearMatches(expected: string, actual: string): boolean {
  const e = expected.trim();
  const a = actual.trim();
  if (!a) return false;
  if (e === a) return true;
  const eDigits = travelersPurchaseMonthYearDigits(e);
  const aDigits = travelersPurchaseMonthYearDigits(a);
  if (eDigits.length >= 6 && aDigits.length >= 6) {
    return eDigits.slice(0, 6) === aDigits.slice(0, 6);
  }
  return eDigits === aDigits;
}

async function fillTravelersHomeCharacteristicsPurchaseMonthYear(
  root: TravelersFormRoot,
  raw: string
): Promise<void> {
  const fillValue = formatTravelersPurchaseMonthYear(raw);
  if (!fillValue) {
    throw new Error("Travelers Home Characteristics requires purchaseMonthYear in payload.");
  }
  const digitsOnly = travelersPurchaseMonthYearDigits(fillValue);
  if (digitsOnly.length !== 6) {
    throw new Error(
      `Travelers Home Characteristics purchaseMonthYear must be MM/YYYY (6 digits), got: ${raw}`
    );
  }

  await scrollTravelersHomeCharacteristicsIntoView(root);
  const inputId = await resolveTravelersHomeCharacteristicsVisibleInputId(root, "Purchase Month/Year");
  const loc = travelersLocatorByElementId(root, inputId);
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  if (await loc.isDisabled().catch(() => false)) {
    throw new Error('Travelers Home Characteristics "Purchase Month/Year" is disabled and cannot be filled.');
  }

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);

  const readDom = (): Promise<string> => readTravelersStructureInputValueInDom(root, inputId);

  let actual = await applyTravelersStructureInputInDom(root, inputId, fillValue);
  if (!travelersPurchaseMonthYearMatches(fillValue, actual)) {
    await loc.click({ timeout: 10_000, force: true });
    await loc.press("Control+A").catch(() => undefined);
    await loc.press("Backspace").catch(() => undefined);
    // Masked MM/YYYY — type digits only; portal inserts the slash.
    await loc.pressSequentially(digitsOnly, { delay: 80 });
    actual = await readDom();
  }

  if (!travelersPurchaseMonthYearMatches(fillValue, actual)) {
    actual = await applyTravelersStructureInputInDom(root, inputId, fillValue);
  }

  if (!travelersPurchaseMonthYearMatches(fillValue, actual)) {
    await loc.click({ timeout: 10_000, force: true });
    await loc.pressSequentially(fillValue, { delay: 80 });
    actual = await readDom();
  }

  await loc.press("Tab").catch(() => undefined);
  await new Promise<void>((r) => {
    setTimeout(r, 350);
  });

  const afterBlur = await readDom();
  const retained = travelersPurchaseMonthYearMatches(fillValue, afterBlur)
    ? afterBlur
    : travelersPurchaseMonthYearMatches(fillValue, actual)
      ? actual
      : afterBlur;

  if (!travelersPurchaseMonthYearMatches(fillValue, retained)) {
    throw new Error(
      `Travelers Home Characteristics "Purchase Month/Year" did not retain value. expected="${fillValue}" actual="${retained}"`
    );
  }
}

async function fillTravelersHomeCharacteristicsInput(
  root: TravelersFormRoot,
  dataLabel: string,
  value: string
): Promise<void> {
  const panel = travelersHomeCharacteristicsPanel(root);
  const loc = panel.locator(`input[data-label="${dataLabel}"]`).first();
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  if (await loc.isDisabled().catch(() => false)) return;

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click();
  await loc.press("Control+A").catch(() => undefined);
  await loc.fill(value);
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
  await loc.press("Tab").catch(() => undefined);
}

async function applyTravelersHomeCharacteristicsSelectInDom(
  root: TravelersFormRoot,
  dataLabel: string,
  choice: { value: string; label: string }
): Promise<{ value: string; selectId: string }> {
  return root.evaluate(
    ({ dataLabel, choice }) => {
      const panel = document.querySelector("#residenceHomeCharacteristicsContainer");
      if (!panel) return { value: "", selectId: "" };

      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;

      panel.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
        const select = el as HTMLSelectElement;
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      });

      if (!bestSelect) return { value: "", selectId: "" };
      const selectEl: HTMLSelectElement = bestSelect;

      let matched: HTMLOptionElement | null = null;
      for (const opt of Array.from(selectEl.options)) {
        const text = (opt.textContent ?? "").trim();
        if (
          opt.value === choice.value ||
          text === choice.label ||
          text.toLowerCase() === choice.label.toLowerCase()
        ) {
          matched = opt;
          break;
        }
      }
      if (!matched?.value) return { value: "", selectId: selectEl.id ?? "" };

      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (setter) {
        setter.call(selectEl, matched.value);
      } else {
        selectEl.value = matched.value;
      }
      matched.selected = true;
      selectEl.selectedIndex = matched.index;

      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

      const jq = (window as {
        $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
      }).$;
      if (jq) {
        const chain = jq(selectEl);
        chain.val(matched.value);
        chain.trigger("change");
      }

      return { value: selectEl.value, selectId: selectEl.id ?? "" };
    },
    { dataLabel, choice }
  );
}

async function resolveTravelersHomeCharacteristicsSelectChoice(
  root: TravelersFormRoot,
  dataLabel: string,
  optionText: string
): Promise<{ value: string; label: string }> {
  const resolved = await root.evaluate(
    ({ dataLabel, optionText }) => {
      const panel = document.querySelector("#residenceHomeCharacteristicsContainer");
      if (!panel) return null;

      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;
      panel.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
        const select = el as HTMLSelectElement;
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      });
      if (!bestSelect) return null;
      const selectEl: HTMLSelectElement = bestSelect;

      const target = optionText.trim().toLowerCase();
      for (const opt of Array.from(selectEl.options)) {
        const label = (opt.textContent ?? "").trim();
        const value = (opt.value ?? "").trim();
        if (!value) continue;
        if (
          label.toLowerCase() === target ||
          value.toLowerCase() === target ||
          label.toLowerCase().includes(target) ||
          target.includes(label.toLowerCase())
        ) {
          return { value, label };
        }
      }
      return null;
    },
    { dataLabel, optionText }
  );
  if (!resolved?.value) {
    throw new Error(`Travelers could not resolve "${dataLabel}" option: ${optionText}`);
  }
  return resolved;
}

async function setTravelersHomeCharacteristicsSelect(
  root: TravelersFormRoot,
  dataLabel: string,
  choice: { value: string; label: string }
): Promise<void> {
  await scrollTravelersHomeCharacteristicsIntoView(root);

  const panel = travelersHomeCharacteristicsPanel(root);
  const selectByLabel = panel.locator(`select[data-label="${dataLabel}"]`).first();
  await selectByLabel.waitFor({ state: "visible", timeout: 60_000 });
  await selectByLabel.scrollIntoViewIfNeeded().catch(() => undefined);

  let result = await applyTravelersHomeCharacteristicsSelectInDom(root, dataLabel, choice);

  const selectLocator = result.selectId
    ? travelersLocatorByElementId(root, result.selectId)
    : panel.locator(`select[data-label="${dataLabel}"]`).first();

  if (!result.value) {
    await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);
    await selectLocator
      .selectOption({ value: choice.value })
      .catch(async () => {
        await selectLocator.selectOption({ label: choice.label });
      });
    await selectLocator.press("Tab").catch(() => undefined);
    result = await applyTravelersHomeCharacteristicsSelectInDom(root, dataLabel, choice);
  }

  if (!result.value) {
    const optionIndex = await selectLocator.evaluate((el: HTMLSelectElement, mappedValue: string) => {
      for (let i = 0; i < el.options.length; i++) {
        if (el.options[i]?.value === mappedValue) return i;
      }
      return -1;
    }, choice.value);

    if (optionIndex >= 0) {
      await selectLocator.focus().catch(() => undefined);
      for (let i = 0; i < optionIndex; i++) {
        await selectLocator.press("ArrowDown");
      }
      await selectLocator.press("Enter");
      await selectLocator.press("Tab").catch(() => undefined);
      result = await applyTravelersHomeCharacteristicsSelectInDom(root, dataLabel, choice);
    }
  }

  if (!result.value) {
    throw new Error(
      `Travelers could not select "${dataLabel}" (${choice.label} / ${choice.value}).`
    );
  }

  await new Promise<void>((r) => {
    setTimeout(r, 400);
  });
}

async function setTravelersHomeCharacteristicsSelectByOptionText(
  root: TravelersFormRoot,
  dataLabel: string,
  optionText: string
): Promise<void> {
  const choice = await resolveTravelersHomeCharacteristicsSelectChoice(root, dataLabel, optionText);
  await setTravelersHomeCharacteristicsSelect(root, dataLabel, choice);
}

async function setTravelersHomeCharacteristicsRadio(
  root: TravelersFormRoot,
  dataLabel: string,
  value: string
): Promise<void> {
  const panel = travelersHomeCharacteristicsPanel(root);
  const container = panel.locator(`span.sm-answer-radio[data-label="${dataLabel}"]`).first();
  await container.waitFor({ state: "attached", timeout: 60_000 });
  await container.scrollIntoViewIfNeeded().catch(() => undefined);

  const radio = container.locator(`input[type="radio"][value="${value}"]`).first();
  await radio.waitFor({ state: "attached", timeout: 15_000 });

  const radioId = await radio.getAttribute("id");
  const label = radioId
    ? container.locator(`label[for="${radioId}"]`).first()
    : container.locator("label").first();

  await label.click({ force: true, timeout: 10_000 }).catch(() => undefined);
  await radio.evaluate((el: HTMLInputElement) => {
    el.checked = true;
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  if (!(await radio.isChecked().catch(() => false))) {
    await radio.click({ force: true });
  }

  if (!(await radio.isChecked().catch(() => false))) {
    throw new Error(`Travelers could not select "${dataLabel}" value=${value}.`);
  }

  await new Promise<void>((r) => {
    setTimeout(r, 400);
  });
}

async function runTravelersResidenceHomeCharacteristics(
  root: TravelersFormRoot,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string,
  page?: Page
): Promise<void> {
  updateStep("travelers_residence_home_characteristics_loading");
  await scrollTravelersHomeCharacteristicsIntoView(root);

  const panel = travelersHomeCharacteristicsPanel(root);
  await panel.waitFor({ state: "visible", timeout: 60_000 });
  await panel.locator('input[data-label="Year Built"]').first().waitFor({ state: "visible", timeout: 60_000 });

  const yearBuilt = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("yearBuilt"));
  if (!yearBuilt) {
    throw new Error("Travelers Home Characteristics requires yearBuilt in payload.");
  }

  const purchaseMonthYear = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("purchaseMonthYear")
  );
  if (!purchaseMonthYear) {
    throw new Error("Travelers Home Characteristics requires purchaseMonthYear in payload.");
  }

  const numberOfFamiliesRaw = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("numberOfFamilies")
  );
  if (!numberOfFamiliesRaw) {
    throw new Error("Travelers Home Characteristics requires numberOfFamilies in payload.");
  }

  const primarySourceOfHeatRaw = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("primarySourceOfHeat")
  );
  if (!primarySourceOfHeatRaw) {
    throw new Error("Travelers Home Characteristics requires primarySourceOfHeat in payload.");
  }

  const residenceTypeRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("residenceType"));
  if (!residenceTypeRaw) {
    throw new Error("Travelers Home Characteristics requires residenceType in payload.");
  }

  const seasonalDwelling = parseTravelersUwYesNoPayload(
    payload,
    travelersPayloadKeyVariants("seasonalDwelling"),
    "seasonalDwelling"
  );
  const swimmingPool = parseTravelersUwYesNoPayload(
    payload,
    travelersPayloadKeyVariants("swimmingPool"),
    "swimmingPool"
  );
  const woodCoalPelletStove = parseTravelersUwYesNoPayload(
    payload,
    travelersPayloadKeyVariants("woodCoalPelletStove"),
    "woodCoalPelletStove"
  );

  updateStep("travelers_residence_home_characteristics_fill");

  await fillTravelersHomeCharacteristicsInput(root, "Year Built", yearBuilt.replace(/\D/g, "") || yearBuilt);
  await setTravelersHomeCharacteristicsRadio(
    root,
    "Residence Type",
    mapTravelersResidenceTypeRadioValue(residenceTypeRaw)
  );
  await setTravelersHomeCharacteristicsRadio(
    root,
    "Seasonal Dwelling",
    travelersUwYesNoToPortalBinary(seasonalDwelling)
  );
  await setTravelersHomeCharacteristicsRadio(
    root,
    "Swimming Pool",
    travelersUwYesNoToPortalBinary(swimmingPool)
  );

  if (swimmingPool === "YES") {
    const poolTypeRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("swimmingPoolType"));
    if (!poolTypeRaw) {
      throw new Error(
        "Travelers Home Characteristics requires swimmingPoolType when swimmingPool is Yes."
      );
    }
    await setTravelersHomeCharacteristicsSelectByOptionText(root, "Swimming Pool Type", poolTypeRaw);

    const poolSafetyRaw = travelersPayloadFirstString(
      payload,
      travelersPayloadKeyVariants("swimmingPoolSafetyFeature")
    );
    if (!poolSafetyRaw) {
      throw new Error(
        "Travelers Home Characteristics requires swimmingPoolSafetyFeature when swimming pool type is set."
      );
    }
    await setTravelersHomeCharacteristicsSelectByOptionText(
      root,
      "Swimming Pool Safety Feature",
      poolSafetyRaw
    );
  }

  await setTravelersHomeCharacteristicsRadio(
    root,
    "Wood/Coal/Pellet Stove",
    travelersUwYesNoToPortalBinary(woodCoalPelletStove)
  );

  if (woodCoalPelletStove === "YES") {
    const stoveInstalled = parseTravelersUwYesNoPayload(
      payload,
      travelersPayloadKeyVariants("stoveProfessionallyInstalledOrInspected"),
      "stoveProfessionallyInstalledOrInspected"
    );
    const chimneyCleaned = parseTravelersUwYesNoPayload(
      payload,
      travelersPayloadKeyVariants("chimneyCleanedAnnually"),
      "chimneyCleanedAnnually"
    );
    const ulListed = parseTravelersUwYesNoPayload(payload, travelersPayloadKeyVariants("ulListed"), "ulListed");

    await setTravelersHomeCharacteristicsRadio(
      root,
      "Stove Professionally Installed/Inspected",
      travelersUwYesNoToPortalBinary(stoveInstalled)
    );
    await setTravelersHomeCharacteristicsRadio(
      root,
      "Chimney Cleaned Annually",
      travelersUwYesNoToPortalBinary(chimneyCleaned)
    );
    await setTravelersHomeCharacteristicsRadio(root, "UL Listed", travelersUwYesNoToPortalBinary(ulListed));
  }

  // Fill mandatory dropdowns last — radio clicks can clear earlier select values on this panel.
  await setTravelersHomeCharacteristicsSelect(
    root,
    "Number of Families",
    mapTravelersNumberOfFamiliesPortal(numberOfFamiliesRaw)
  );
  await setTravelersHomeCharacteristicsSelect(
    root,
    "Primary Source of Heat",
    mapTravelersPrimarySourceOfHeatPortal(primarySourceOfHeatRaw)
  );

  // Fill masked MM/YYYY last — other radio/select interactions on this panel can clear it.
  await fillTravelersHomeCharacteristicsPurchaseMonthYear(root, purchaseMonthYear);

  if (page) {
  }
}

function travelersStructurePanel(root: TravelersFormRoot): Locator {
  return root.locator("#q2ResidenceStructure").first();
}

async function scrollTravelersStructureIntoView(root: TravelersFormRoot): Promise<void> {
  const panel = travelersStructurePanel(root);
  await panel.scrollIntoViewIfNeeded().catch(() => undefined);
  await root
    .evaluate(() => {
      const el = document.querySelector("#q2ResidenceStructure");
      el?.scrollIntoView({ block: "center", behavior: "instant" });
      const main = document.querySelector("#main");
      if (main) main.scrollTop = Math.min(main.scrollHeight, main.scrollTop + 600);
    })
    .catch(() => undefined);
  await new Promise<void>((r) => {
    setTimeout(r, 350);
  });
}

async function resolveTravelersStructureVisibleInputId(
  root: TravelersFormRoot,
  dataLabel: string
): Promise<string> {
  const inputId = await root.evaluate((label) => {
    const panel = document.querySelector("#q2ResidenceStructure");
    if (!panel) return "";

    let bestInput: HTMLInputElement | null = null;
    let bestArea = 0;
    panel.querySelectorAll(`input[data-label="${label}"]`).forEach((el) => {
      const input = el as HTMLInputElement;
      const style = window.getComputedStyle(input);
      if (input.disabled || style.display === "none" || style.visibility === "hidden") return;
      const rect = input.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestInput = input;
      }
    });
    if (!bestInput) return "";
    const inputEl: HTMLInputElement = bestInput;
    return inputEl.id ?? "";
  }, dataLabel);

  if (!inputId) {
    throw new Error(`Travelers Structure visible input not found for "${dataLabel}".`);
  }
  return inputId;
}

async function resolveTravelersStructureVisibleInput(
  root: TravelersFormRoot,
  dataLabel: string
): Promise<Locator> {
  const inputId = await resolveTravelersStructureVisibleInputId(root, dataLabel);
  const byId = travelersLocatorByElementId(root, inputId);
  if (await byId.isVisible().catch(() => false)) return byId;
  return travelersStructurePanel(root).locator(`input[data-label="${dataLabel}"]`).first();
}

async function readTravelersStructureInputValueInDom(
  root: TravelersFormRoot,
  inputId: string
): Promise<string> {
  return root.evaluate((id) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return "";
    return (el.value ?? "").trim();
  }, inputId);
}

async function applyTravelersStructureInputInDom(
  root: TravelersFormRoot,
  inputId: string,
  value: string
): Promise<string> {
  return root.evaluate(
    ({ id, v }) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (!el) return "";

      el.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(el, v);
      } else {
        el.value = v;
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));

      const jq = (window as {
        $?: (target: HTMLElement) => {
          val: (v: string) => unknown;
          trigger: (n: string) => unknown;
        };
      }).$;
      if (jq) {
        const chain = jq(el);
        chain.val(v);
        chain.trigger("input");
        chain.trigger("change");
      }

      return (el.value ?? "").trim();
    },
    { id: inputId, v: value }
  );
}

async function fillTravelersStructureInput(
  root: TravelersFormRoot,
  dataLabel: string,
  value: string,
  opts?: { blurWithTab?: boolean }
): Promise<void> {
  const fillValue = value.trim();
  if (!fillValue) {
    throw new Error(`Travelers Structure "${dataLabel}" must be a non-empty value.`);
  }

  await scrollTravelersStructureIntoView(root);
  const inputId = await resolveTravelersStructureVisibleInputId(root, dataLabel);
  const loc = travelersLocatorByElementId(root, inputId);
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  if (await loc.isDisabled().catch(() => false)) {
    throw new Error(`Travelers Structure "${dataLabel}" is disabled and cannot be filled.`);
  }

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);

  let actual = await applyTravelersStructureInputInDom(root, inputId, fillValue);
  if (actual !== fillValue) {
    await loc.click({ timeout: 10_000, force: true });
    await loc.press("Control+A").catch(() => undefined);
    await loc.press("Backspace").catch(() => undefined);
    await loc.pressSequentially(fillValue, { delay: 60 });
    actual = await readTravelersStructureInputValueInDom(root, inputId);
  }

  if (actual !== fillValue) {
    actual = await applyTravelersStructureInputInDom(root, inputId, fillValue);
  }

  if (opts?.blurWithTab !== false) {
    await loc.press("Tab").catch(() => undefined);
  } else {
    await loc.evaluate((el: HTMLInputElement) => {
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    });
    await new Promise<void>((r) => {
      setTimeout(r, 350);
    });
  }

  const afterBlur = await readTravelersStructureInputValueInDom(root, inputId);
  if (afterBlur === fillValue) return;

  if (actual === fillValue && !afterBlur) {
    throw new Error(
      `Travelers Structure "${dataLabel}" was set to "${fillValue}" but the portal cleared it on blur (value may be invalid or below minimum).`
    );
  }

  throw new Error(
    `Travelers Structure "${dataLabel}" did not retain value. expected="${fillValue}" actual="${afterBlur || actual}"`
  );
}

async function readTravelersStructureInputConstraints(
  root: TravelersFormRoot,
  inputId: string
): Promise<{ min?: number; max?: number }> {
  return root.evaluate((id) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return {};

    const parseBound = (v: string | null | undefined): number | undefined => {
      if (!v) return undefined;
      const n = Number(String(v).replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      min: parseBound(el.min) ?? parseBound(el.getAttribute("data-min")),
      max: parseBound(el.max) ?? parseBound(el.getAttribute("data-max")),
    };
  }, inputId);
}

function assertTravelersSquareFootagePayload(
  numeric: number,
  raw: string,
  portalMin: number | undefined
): void {
  if (portalMin !== undefined && numeric < portalMin) {
    throw new Error(
      `Travelers squareFootage "${raw}" (${numeric}) is below the portal minimum (${portalMin}). Update payload squareFootage to a valid value (e.g. 1500).`
    );
  }
  // Travelers commonly rejects very small values even when min is not exposed on the input.
  if (numeric < 100) {
    throw new Error(
      `Travelers squareFootage "${raw}" (${numeric}) is too small to accept. Use the home's actual square footage in the payload (typically 500+).`
    );
  }
}

async function fillTravelersStructureSquareFootage(root: TravelersFormRoot, raw: string): Promise<void> {
  const digits = raw.replace(/\D/g, "").trim() || raw.trim();
  if (!digits) {
    throw new Error("Travelers Structure squareFootage must be a non-empty number.");
  }

  const numeric = Number(digits);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Travelers Structure squareFootage must be a positive number, got: ${raw}`);
  }

  await scrollTravelersStructureIntoView(root);
  const inputId = await resolveTravelersStructureVisibleInputId(root, "Square Footage");
  const constraints = await readTravelersStructureInputConstraints(root, inputId);
  assertTravelersSquareFootagePayload(numeric, raw, constraints.min);

  const loc = travelersLocatorByElementId(root, inputId);
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  if (await loc.isDisabled().catch(() => false)) {
    throw new Error('Travelers Structure "Square Footage" is disabled and cannot be filled.');
  }

  let bathroomsInputId = "";
  try {
    bathroomsInputId = await resolveTravelersStructureVisibleInputId(root, "Number of Bathrooms");
  } catch {
    bathroomsInputId = "";
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await loc.scrollIntoViewIfNeeded().catch(() => undefined);
    await loc.click({ timeout: 10_000, force: true });
    await loc.press("Control+A").catch(() => undefined);
    await loc.press("Backspace").catch(() => undefined);
    await loc.pressSequentially(digits, { delay: 80 });
    await loc.press("Enter").catch(() => undefined);

    let actual = await readTravelersStructureInputValueInDom(root, inputId);
    if (actual !== digits) {
      actual = await applyTravelersStructureInputInDom(root, inputId, digits);
    }

    if (bathroomsInputId) {
      await travelersLocatorByElementId(root, bathroomsInputId)
        .click({ timeout: 5000 })
        .catch(() => undefined);
    } else {
      await loc.press("Tab").catch(() => undefined);
    }

    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });

    actual = await readTravelersStructureInputValueInDom(root, inputId);
    if (actual === digits) return;
  }

  const minHint =
    constraints.min !== undefined
      ? ` Portal minimum is ${constraints.min}.`
      : " Values under ~500 sq ft are usually rejected.";
  throw new Error(
    `Travelers Structure Square Footage did not retain "${digits}".${minHint} Update payload squareFootage.`
  );
}

async function applyTravelersStructureSelectInDom(
  root: TravelersFormRoot,
  dataLabel: string,
  choice: { value: string; label: string }
): Promise<{ value: string; selectId: string }> {
  return root.evaluate(
    ({ dataLabel, choice }) => {
      const panel = document.querySelector("#q2ResidenceStructure");
      if (!panel) return { value: "", selectId: "" };

      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;

      panel.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
        const select = el as HTMLSelectElement;
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      });

      if (!bestSelect) return { value: "", selectId: "" };
      const selectEl: HTMLSelectElement = bestSelect;

      let matched: HTMLOptionElement | null = null;
      for (const opt of Array.from(selectEl.options)) {
        const text = (opt.textContent ?? "").trim();
        if (
          opt.value === choice.value ||
          text === choice.label ||
          text.toLowerCase() === choice.label.toLowerCase()
        ) {
          matched = opt;
          break;
        }
      }
      if (!matched?.value) return { value: "", selectId: selectEl.id ?? "" };

      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (setter) {
        setter.call(selectEl, matched.value);
      } else {
        selectEl.value = matched.value;
      }
      matched.selected = true;
      selectEl.selectedIndex = matched.index;

      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

      const jq = (window as {
        $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
      }).$;
      if (jq) {
        const chain = jq(selectEl);
        chain.val(matched.value);
        chain.trigger("change");
      }

      return { value: selectEl.value, selectId: selectEl.id ?? "" };
    },
    { dataLabel, choice }
  );
}

async function resolveTravelersStructureSelectChoice(
  root: TravelersFormRoot,
  dataLabel: string,
  optionText: string
): Promise<{ value: string; label: string }> {
  const resolved = await root.evaluate(
    ({ dataLabel, optionText }) => {
      const panel = document.querySelector("#q2ResidenceStructure");
      if (!panel) return null;

      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;
      panel.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
        const select = el as HTMLSelectElement;
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      });
      if (!bestSelect) return null;
      const selectEl: HTMLSelectElement = bestSelect;

      const target = optionText.trim().toLowerCase();
      for (const opt of Array.from(selectEl.options)) {
        const label = (opt.textContent ?? "").trim();
        const value = (opt.value ?? "").trim();
        if (!value) continue;
        if (
          label.toLowerCase() === target ||
          value.toLowerCase() === target ||
          label.toLowerCase().includes(target) ||
          target.includes(label.toLowerCase())
        ) {
          return { value, label };
        }
      }
      return null;
    },
    { dataLabel, optionText }
  );
  if (!resolved?.value) {
    throw new Error(`Travelers could not resolve "${dataLabel}" option: ${optionText}`);
  }
  return resolved;
}

async function setTravelersStructureSelect(
  root: TravelersFormRoot,
  dataLabel: string,
  choice: { value: string; label: string }
): Promise<void> {
  await scrollTravelersStructureIntoView(root);

  const panel = travelersStructurePanel(root);
  const selectByLabel = panel.locator(`select[data-label="${dataLabel}"]`).first();
  await selectByLabel.waitFor({ state: "visible", timeout: 60_000 });
  await selectByLabel.scrollIntoViewIfNeeded().catch(() => undefined);

  let result = await applyTravelersStructureSelectInDom(root, dataLabel, choice);

  const selectLocator = result.selectId
    ? travelersLocatorByElementId(root, result.selectId)
    : panel.locator(`select[data-label="${dataLabel}"]`).first();

  if (!result.value) {
    await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);
    await selectLocator
      .selectOption({ value: choice.value })
      .catch(async () => {
        await selectLocator.selectOption({ label: choice.label });
      });
    await selectLocator.press("Tab").catch(() => undefined);
    result = await applyTravelersStructureSelectInDom(root, dataLabel, choice);
  }

  if (!result.value) {
    const optionIndex = await selectLocator.evaluate((el: HTMLSelectElement, mappedValue: string) => {
      for (let i = 0; i < el.options.length; i++) {
        if (el.options[i]?.value === mappedValue) return i;
      }
      return -1;
    }, choice.value);

    if (optionIndex >= 0) {
      await selectLocator.focus().catch(() => undefined);
      for (let i = 0; i < optionIndex; i++) {
        await selectLocator.press("ArrowDown");
      }
      await selectLocator.press("Enter");
      await selectLocator.press("Tab").catch(() => undefined);
      result = await applyTravelersStructureSelectInDom(root, dataLabel, choice);
    }
  }

  if (!result.value) {
    throw new Error(
      `Travelers could not select "${dataLabel}" (${choice.label} / ${choice.value}).`
    );
  }

  await new Promise<void>((r) => {
    setTimeout(r, 400);
  });
}

async function setTravelersStructureSelectByOptionText(
  root: TravelersFormRoot,
  dataLabel: string,
  optionText: string
): Promise<void> {
  const choice = await resolveTravelersStructureSelectChoice(root, dataLabel, optionText);
  await setTravelersStructureSelect(root, dataLabel, choice);
}

async function readTravelersStructureSelectValueInDom(
  root: TravelersFormRoot,
  dataLabel: string
): Promise<string> {
  return root.evaluate((label) => {
    const panel = document.querySelector("#q2ResidenceStructure");
    if (!panel) return "";

    let bestSelect: HTMLSelectElement | null = null;
    let bestArea = 0;
    panel.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
      const select = el as HTMLSelectElement;
      const style = window.getComputedStyle(select);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = select.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestSelect = select;
      }
    });
    if (!bestSelect) return "";
    const selectEl: HTMLSelectElement = bestSelect;
    return selectEl.value ?? "";
  }, dataLabel);
}

async function ensureTravelersStructurePrimaryFoundation(
  root: TravelersFormRoot,
  choice: { value: string; label: string }
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await setTravelersStructureSelect(root, "Primary Foundation Type", choice);
    await new Promise<void>((r) => {
      setTimeout(r, 600);
    });

    const actual = await readTravelersStructureSelectValueInDom(root, "Primary Foundation Type");
    if (actual === choice.value) return;
  }

  const actual = await readTravelersStructureSelectValueInDom(root, "Primary Foundation Type");
  throw new Error(
    `Travelers Structure Primary Foundation Type was not set to ${choice.label} (${choice.value}). actual=${actual || "(blank)"}`
  );
}

type TravelersStructureBasementFinishedField = {
  dataLabel: string;
  tagName: "select" | "input";
};

async function waitForTravelersStructureBasementFinishedField(
  root: TravelersFormRoot,
  timeoutMs = 45_000
): Promise<TravelersStructureBasementFinishedField> {
  const exactLabels = ["Basement Finished %", "Basement Finished", "Basement Finished Percent"];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const label of exactLabels) {
      const found = await root.evaluate((dataLabel) => {
        const panel = document.querySelector("#q2ResidenceStructure");
        if (!panel) return null;

        const elements = panel.querySelectorAll(
          `select[data-label="${dataLabel}"], input[data-label="${dataLabel}"]`
        );
        for (const el of elements) {
          const question = el.closest(".sm-question") as HTMLElement | null;
          const checkEl = question ?? (el as HTMLElement);
          const style = window.getComputedStyle(checkEl);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const rect = checkEl.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          return {
            dataLabel,
            tagName: el.tagName.toLowerCase() === "input" ? "input" : "select",
          } as TravelersStructureBasementFinishedField;
        }
        return null;
      }, label);
      if (found) return found;
    }

    const fuzzy = await root.evaluate(() => {
      const panel = document.querySelector("#q2ResidenceStructure");
      if (!panel) return null;

      for (const el of panel.querySelectorAll("select[data-label], input[data-label]")) {
        const dataLabel = el.getAttribute("data-label") ?? "";
        if (!/basement/i.test(dataLabel) || !/finish/i.test(dataLabel)) continue;

        const question = el.closest(".sm-question") as HTMLElement | null;
        const checkEl = question ?? (el as HTMLElement);
        const style = window.getComputedStyle(checkEl);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const rect = checkEl.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;

        return {
          dataLabel,
          tagName: el.tagName.toLowerCase() === "input" ? "input" : "select",
        } as TravelersStructureBasementFinishedField;
      }
      return null;
    });
    if (fuzzy) return fuzzy;

    await new Promise<void>((r) => {
      setTimeout(r, 400);
    });
  }

  const foundationValue = await readTravelersStructureSelectValueInDom(root, "Primary Foundation Type");
  throw new Error(
    `Travelers Structure "Basement Finished" field did not appear after selecting Basement foundation. foundationValue=${foundationValue || "(blank)"}`
  );
}

async function setTravelersStructureBasementFinished(
  root: TravelersFormRoot,
  raw: string
): Promise<void> {
  const field = await waitForTravelersStructureBasementFinishedField(root);
  await scrollTravelersStructureIntoView(root);

  if (field.tagName === "input") {
    const percent = mapTravelersBasementFinishedPercentValue(raw);
    await fillTravelersStructureInput(root, field.dataLabel, percent);
    return;
  }

  const candidates = travelersBasementFinishedOptionCandidates(raw);
  let lastError: Error | undefined;
  for (const optionText of candidates) {
    try {
      await setTravelersStructureSelectByOptionText(root, field.dataLabel, optionText);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw (
    lastError ??
    new Error(`Travelers Structure could not set basementFinished from payload: ${raw}`)
  );
}

async function runTravelersResidenceStructure(
  root: TravelersFormRoot,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string,
  page?: Page
): Promise<void> {
  updateStep("travelers_residence_structure_loading");
  await scrollTravelersStructureIntoView(root);

  const panel = travelersStructurePanel(root);
  await panel.waitFor({ state: "visible", timeout: 60_000 });
  await panel.locator('input[data-label="Square Footage"]').first().waitFor({ state: "visible", timeout: 60_000 });

  const squareFootage = travelersPayloadFirstString(payload, [
    ...travelersPayloadKeyVariants("squareFootage"),
    "property.squareFootage",
  ]);
  if (!squareFootage) {
    throw new Error("Travelers Structure requires squareFootage in payload.");
  }

  const buildingConstructionTypeRaw = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("buildingConstructionType")
  );
  if (!buildingConstructionTypeRaw) {
    throw new Error("Travelers Structure requires buildingConstructionType in payload.");
  }

  const sidingTypeRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("sidingType"));
  if (!sidingTypeRaw) {
    throw new Error("Travelers Structure requires sidingType in payload.");
  }

  const primaryFoundationTypeRaw = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("primaryFoundationType")
  );
  if (!primaryFoundationTypeRaw) {
    throw new Error("Travelers Structure requires primaryFoundationType in payload.");
  }

  const numberOfBathrooms = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("numberOfBathrooms")
  );
  if (!numberOfBathrooms) {
    throw new Error("Travelers Structure requires numberOfBathrooms in payload.");
  }

  const garageTypeRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("garageType"));
  if (!garageTypeRaw) {
    throw new Error("Travelers Structure requires garageType in payload.");
  }

  const numberOfStoriesRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("numberOfStories"));
  if (!numberOfStoriesRaw) {
    throw new Error("Travelers Structure requires numberOfStories in payload.");
  }

  const foundationChoice = mapTravelersPrimaryFoundationTypePortal(primaryFoundationTypeRaw);
  const garageChoice = mapTravelersGarageTypePortal(garageTypeRaw);
  const needsBasementFinished = travelersFoundationIsBasement(foundationChoice.value);
  const needsGarageSize = travelersGarageTypeRequiresSize(garageChoice.value);

  let garageSizeChoice: { value: string; label: string } | undefined;
  if (needsGarageSize) {
    const garageSizeRaw = travelersPayloadFirstString(
      payload,
      travelersPayloadKeyVariants("garageSizeNumberOfCars")
    );
    if (!garageSizeRaw) {
      throw new Error(
        "Travelers Structure requires garageSizeNumberOfCars when garageType is not None."
      );
    }
    garageSizeChoice = mapTravelersGarageSizePortal(garageSizeRaw);
  }

  updateStep("travelers_residence_structure_fill");

  const squareFootageDigits = squareFootage.replace(/\D/g, "") || squareFootage.trim();
  const numberOfBathroomsDigits = numberOfBathrooms.replace(/\D/g, "") || numberOfBathrooms.trim();

  await fillTravelersStructureInput(root, "Number of Bathrooms", numberOfBathroomsDigits);

  // primaryFoundationType → basementFinished % (text input, only when Basement).
  await ensureTravelersStructurePrimaryFoundation(root, foundationChoice);
  if (needsBasementFinished) {
    const basementFinishedRaw = travelersPayloadFirstString(
      payload,
      travelersPayloadKeyVariants("basementFinished")
    );
    if (!basementFinishedRaw) {
      throw new Error(
        "Travelers Structure requires basementFinished when primaryFoundationType is Basement."
      );
    }
    await setTravelersStructureBasementFinished(root, basementFinishedRaw);
  }

  // Standalone dropdowns.
  await setTravelersStructureSelect(
    root,
    "Building Construction Type",
    mapTravelersBuildingConstructionTypePortal(buildingConstructionTypeRaw)
  );
  await setTravelersStructureSelect(root, "Siding Type", mapTravelersSidingTypePortal(sidingTypeRaw));
  await setTravelersStructureSelect(
    root,
    "Number of Stories",
    mapTravelersNumberOfStoriesPortal(numberOfStoriesRaw)
  );

  // garageType → garageSizeNumberOfCars (skipped when None — field is hidden).
  await setTravelersStructureSelect(root, "Garage Type", garageChoice);
  if (needsGarageSize && garageSizeChoice) {
    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
    await setTravelersStructureSelect(root, "Garage Size (Number of Cars)", garageSizeChoice);
  }

  // Square footage last — other dropdown changes can clear this text field.
  await fillTravelersStructureSquareFootage(root, squareFootage);

  if (page) {
  }
}

function travelersRoofPanel(root: TravelersFormRoot): Locator {
  return root.locator("#q2ResidenceRoof").first();
}

async function scrollTravelersRoofIntoView(root: TravelersFormRoot): Promise<void> {
  const panel = travelersRoofPanel(root);
  await panel.scrollIntoViewIfNeeded().catch(() => undefined);
  await root
    .evaluate(() => {
      const el = document.querySelector("#q2ResidenceRoof");
      el?.scrollIntoView({ block: "center", behavior: "instant" });
      const main = document.querySelector("#main");
      if (main) main.scrollTop = Math.min(main.scrollHeight, main.scrollTop + 600);
    })
    .catch(() => undefined);
  await new Promise<void>((r) => {
    setTimeout(r, 350);
  });
}

async function resolveTravelersRoofVisibleInputId(
  root: TravelersFormRoot,
  dataLabel: string
): Promise<string> {
  const inputId = await root.evaluate((label) => {
    const panel = document.querySelector("#q2ResidenceRoof");
    if (!panel) return "";

    let bestInput: HTMLInputElement | null = null;
    let bestArea = 0;
    panel.querySelectorAll(`input[data-label="${label}"]`).forEach((el) => {
      const input = el as HTMLInputElement;
      const style = window.getComputedStyle(input);
      if (input.disabled || style.display === "none" || style.visibility === "hidden") return;
      const rect = input.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestInput = input;
      }
    });
    if (!bestInput) return "";
    const inputEl: HTMLInputElement = bestInput;
    return inputEl.id ?? "";
  }, dataLabel);

  if (!inputId) {
    throw new Error(`Travelers Roof visible input not found for "${dataLabel}".`);
  }
  return inputId;
}

async function readTravelersRoofInputValueInDom(
  root: TravelersFormRoot,
  inputId: string
): Promise<string> {
  return root.evaluate((id) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return "";
    return (el.value ?? "").trim();
  }, inputId);
}

async function fillTravelersRoofInput(
  root: TravelersFormRoot,
  dataLabel: string,
  value: string
): Promise<void> {
  const fillValue = value.trim();
  if (fillValue.length === 0) {
    throw new Error(`Travelers Roof "${dataLabel}" must be a non-empty value.`);
  }

  await scrollTravelersRoofIntoView(root);
  const inputId = await resolveTravelersRoofVisibleInputId(root, dataLabel);
  const loc = travelersLocatorByElementId(root, inputId);
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  if (await loc.isDisabled().catch(() => false)) {
    throw new Error(`Travelers Roof "${dataLabel}" is disabled and cannot be filled.`);
  }

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click({ timeout: 10_000, force: true });
  await loc.press("Control+A").catch(() => undefined);
  await loc.press("Backspace").catch(() => undefined);
  await loc.pressSequentially(fillValue, { delay: 60 });
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    const jq = (window as {
      $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
    }).$;
    if (jq) {
      const chain = jq(el);
      chain.val(v);
      chain.trigger("change");
    }
  }, fillValue);
  await loc.press("Tab").catch(() => undefined);

  const actual = await readTravelersRoofInputValueInDom(root, inputId);
  if (actual !== fillValue) {
    throw new Error(
      `Travelers Roof "${dataLabel}" did not retain value. expected="${fillValue}" actual="${actual}"`
    );
  }
}

async function applyTravelersRoofSelectInDom(
  root: TravelersFormRoot,
  dataLabel: string,
  choice: { value: string; label: string }
): Promise<{ value: string; selectId: string }> {
  return root.evaluate(
    ({ dataLabel, choice }) => {
      const panel = document.querySelector("#q2ResidenceRoof");
      if (!panel) return { value: "", selectId: "" };

      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;

      panel.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
        const select = el as HTMLSelectElement;
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      });

      if (!bestSelect) return { value: "", selectId: "" };
      const selectEl: HTMLSelectElement = bestSelect;

      let matched: HTMLOptionElement | null = null;
      for (const opt of Array.from(selectEl.options)) {
        const text = (opt.textContent ?? "").trim();
        if (
          opt.value === choice.value ||
          text === choice.label ||
          text.toLowerCase() === choice.label.toLowerCase()
        ) {
          matched = opt;
          break;
        }
      }
      if (!matched?.value) return { value: "", selectId: selectEl.id ?? "" };

      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (setter) {
        setter.call(selectEl, matched.value);
      } else {
        selectEl.value = matched.value;
      }
      matched.selected = true;
      selectEl.selectedIndex = matched.index;

      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

      const jq = (window as {
        $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
      }).$;
      if (jq) {
        const chain = jq(selectEl);
        chain.val(matched.value);
        chain.trigger("change");
      }

      return { value: selectEl.value, selectId: selectEl.id ?? "" };
    },
    { dataLabel, choice }
  );
}

async function setTravelersRoofSelect(
  root: TravelersFormRoot,
  dataLabel: string,
  choice: { value: string; label: string }
): Promise<void> {
  await scrollTravelersRoofIntoView(root);

  const panel = travelersRoofPanel(root);
  const selectByLabel = panel.locator(`select[data-label="${dataLabel}"]`).first();
  await selectByLabel.waitFor({ state: "visible", timeout: 60_000 });
  await selectByLabel.scrollIntoViewIfNeeded().catch(() => undefined);

  let result = await applyTravelersRoofSelectInDom(root, dataLabel, choice);

  const selectLocator = result.selectId
    ? travelersLocatorByElementId(root, result.selectId)
    : panel.locator(`select[data-label="${dataLabel}"]`).first();

  if (!result.value) {
    await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);
    await selectLocator
      .selectOption({ value: choice.value })
      .catch(async () => {
        await selectLocator.selectOption({ label: choice.label });
      });
    await selectLocator.press("Tab").catch(() => undefined);
    result = await applyTravelersRoofSelectInDom(root, dataLabel, choice);
  }

  if (!result.value) {
    const optionIndex = await selectLocator.evaluate((el: HTMLSelectElement, mappedValue: string) => {
      for (let i = 0; i < el.options.length; i++) {
        if (el.options[i]?.value === mappedValue) return i;
      }
      return -1;
    }, choice.value);

    if (optionIndex >= 0) {
      await selectLocator.focus().catch(() => undefined);
      for (let i = 0; i < optionIndex; i++) {
        await selectLocator.press("ArrowDown");
      }
      await selectLocator.press("Enter");
      await selectLocator.press("Tab").catch(() => undefined);
      result = await applyTravelersRoofSelectInDom(root, dataLabel, choice);
    }
  }

  if (!result.value) {
    throw new Error(
      `Travelers could not select Roof "${dataLabel}" (${choice.label} / ${choice.value}).`
    );
  }

  await new Promise<void>((r) => {
    setTimeout(r, 400);
  });
}

async function runTravelersResidenceRoof(
  root: TravelersFormRoot,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string,
  page?: Page
): Promise<void> {
  updateStep("travelers_residence_roof_loading");
  await scrollTravelersRoofIntoView(root);

  const panel = travelersRoofPanel(root);
  await panel.waitFor({ state: "visible", timeout: 60_000 });
  await panel.locator('select[data-label="Roof Shape"]').first().waitFor({ state: "visible", timeout: 60_000 });

  const roofShapeRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("roofShape"));
  if (!roofShapeRaw) {
    throw new Error("Travelers Roof requires roofShape in payload.");
  }

  const roofTypeRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("roofType"));
  if (!roofTypeRaw) {
    throw new Error("Travelers Roof requires roofType in payload.");
  }

  const yearRoofingReplaced = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("yearRoofingReplaced")
  );
  if (!yearRoofingReplaced) {
    throw new Error("Travelers Roof requires yearRoofingReplaced in payload.");
  }

  const numberOfSolarPanelsOnRoof = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("numberOfSolarPanelsOnRoof")
  );
  if (numberOfSolarPanelsOnRoof === undefined) {
    throw new Error("Travelers Roof requires numberOfSolarPanelsOnRoof in payload.");
  }

  updateStep("travelers_residence_roof_fill");

  const yearDigits = yearRoofingReplaced.replace(/\D/g, "") || yearRoofingReplaced.trim();
  const solarDigits = numberOfSolarPanelsOnRoof.replace(/\D/g, "");
  const solarValue = solarDigits !== "" ? solarDigits : numberOfSolarPanelsOnRoof.trim();

  await fillTravelersRoofInput(root, "Year Roofing Replaced", yearDigits);
  await fillTravelersRoofInput(root, "Number of Solar Panels on Roof", solarValue);

  await setTravelersRoofSelect(root, "Roof Shape", mapTravelersRoofShapePortal(roofShapeRaw));
  await setTravelersRoofSelect(root, "Roof Type", mapTravelersRoofTypePortal(roofTypeRaw));

  if (page) {
  }
}

async function applyTravelersReplacementCostMethodInDom(
  root: TravelersFormRoot,
  choice: { value: string; label: string }
): Promise<{ value: string; selectId: string }> {
  return root.evaluate((mapped) => {
    let bestSelect: HTMLSelectElement | null = null;
    let bestArea = 0;

    document.querySelectorAll('select[data-label="Replacement Cost Calculation Method"]').forEach((el) => {
      const select = el as HTMLSelectElement;
      const style = window.getComputedStyle(select);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = select.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestSelect = select;
      }
    });

    if (!bestSelect) return { value: "", selectId: "" };
    const selectEl: HTMLSelectElement = bestSelect;

    let matched: HTMLOptionElement | null = null;
    for (const opt of Array.from(selectEl.options)) {
      const text = (opt.textContent ?? "").trim();
      if (
        opt.value === mapped.value ||
        text === mapped.label ||
        text.toLowerCase() === mapped.label.toLowerCase()
      ) {
        matched = opt;
        break;
      }
    }
    if (!matched?.value) return { value: "", selectId: selectEl.id ?? "" };

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) {
      setter.call(selectEl, matched.value);
    } else {
      selectEl.value = matched.value;
    }
    matched.selected = true;
    selectEl.selectedIndex = matched.index;

    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

    const jq = (window as {
      $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
    }).$;
    if (jq) {
      const chain = jq(selectEl);
      chain.val(matched.value);
      chain.trigger("change");
    }

    return { value: selectEl.value, selectId: selectEl.id ?? "" };
  }, choice);
}

async function setTravelersReplacementCostCalculationMethod(root: TravelersFormRoot): Promise<void> {
  const choice = TRAVELERS_REPLACEMENT_COST_METHOD_QUOTE_WITHOUT_ESTIMATE;
  await scrollTravelersReplacementCostIntoView(root);
  const select = root.locator('select[data-label="Replacement Cost Calculation Method"]').first();
  await select.waitFor({ state: "visible", timeout: 120_000 });
  await select.scrollIntoViewIfNeeded().catch(() => undefined);

  let result = await applyTravelersReplacementCostMethodInDom(root, choice);

  const selectLocator = result.selectId
    ? travelersLocatorByElementId(root, result.selectId)
    : select;

  if (result.value !== choice.value) {
    await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);
    await selectLocator.selectOption({ value: choice.value }).catch(async () => {
      await selectLocator.selectOption({ label: choice.label });
    });
    await selectLocator.press("Tab").catch(() => undefined);
    result = await applyTravelersReplacementCostMethodInDom(root, choice);
  }

  if (result.value !== choice.value) {
    throw new Error(
      `Travelers Replacement Cost Calculation Method was not set to "${choice.label}" (${choice.value}). actual=${result.value || "(blank)"}`
    );
  }

  await new Promise<void>((r) => {
    setTimeout(r, 400);
  });
}

async function scrollTravelersReplacementCostIntoView(root: TravelersFormRoot): Promise<void> {
  await root
    .evaluate(() => {
      const select = document.querySelector('select[data-label="Replacement Cost Calculation Method"]');
      select?.closest(".sm-panel")?.scrollIntoView({ block: "center", behavior: "instant" });
      const main = document.querySelector("#main");
      if (main) main.scrollTop = Math.min(main.scrollHeight, main.scrollTop + 400);
    })
    .catch(() => undefined);
  await new Promise<void>((r) => {
    setTimeout(r, 350);
  });
}

async function waitForTravelersReplacementCostCalculationMethod(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const select = page.locator('select[data-label="Replacement Cost Calculation Method"]').first();
    if (await select.isVisible().catch(() => false)) return;
    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
  }
  throw new Error("Travelers Replacement Cost Calculation Method dropdown did not appear.");
}

/** Replacement Cost Report Information modal — fast path; order reports only on No Hit. */
const TRAVELERS_RC_REPORT_MODAL_MS = 20_000;
const TRAVELERS_RC_REPORT_ORDER_MS = 30_000;

async function isTravelersReportModalOpen(root: TravelersFormRoot): Promise<boolean> {
  return root
    .locator("#overlayTitle")
    .filter({ hasText: /Report Information/i })
    .isVisible()
    .catch(() => false);
}

async function waitForTravelersReplacementCostReportModalFast(root: TravelersFormRoot): Promise<void> {
  await root
    .locator("#overlayTitle")
    .filter({ hasText: /Report Information/i })
    .waitFor({ state: "visible", timeout: TRAVELERS_RC_REPORT_MODAL_MS });
  await root
    .locator("#overlayFooter #overlayButton-reports-dynamicContinue")
    .first()
    .waitFor({ state: "visible", timeout: TRAVELERS_RC_REPORT_MODAL_MS });
  await root
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 5000 })
    .catch(() => undefined);
}

async function waitForTravelersReportModalClosed(root: TravelersFormRoot, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isTravelersReportModalOpen(root))) return;
    await new Promise<void>((r) => {
      setTimeout(r, 100);
    });
  }
}

async function tryClickTravelersReportContinue(root: TravelersFormRoot): Promise<boolean> {
  const continueBtn = root.locator("#overlayButton-reports-dynamicContinue").first();
  if (!(await continueBtn.isVisible().catch(() => false))) return false;

  await root
    .evaluate(() => {
      document.querySelector("#overlayFooter")?.scrollIntoView({ block: "end", behavior: "instant" });
    })
    .catch(() => undefined);

  await continueBtn.click({ force: true, timeout: 5000 }).catch(async () => {
    await root.evaluate(() => {
      const btn = document.querySelector(
        "#overlayButton-reports-dynamicContinue"
      ) as HTMLButtonElement | null;
      if (!btn) return;
      btn.removeAttribute("disabled");
      btn.style.display = "";
      btn.click();
    });
  });

  await new Promise<void>((r) => {
    setTimeout(r, 150);
  });
  return !(await isTravelersReportModalOpen(root));
}

async function ensureTravelersReportRadiosFast(
  root: TravelersFormRoot,
  livedElsewhere: "0" | "1"
): Promise<void> {
  await root.evaluate((lived) => {
    const pick = (dataLabel: string, value: string) => {
      const container = document.querySelector(
        `span.t-radio-container[data-label="${dataLabel}"]`
      );
      const radio = container?.querySelector(
        `input[type="radio"][value="${value}"]`
      ) as HTMLInputElement | null;
      if (!radio || radio.checked) return;
      radio.checked = true;
      radio.dispatchEvent(new Event("click", { bubbles: true }));
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      radio.dispatchEvent(new Event("input", { bubbles: true }));
    };
    pick("Mailing Address differs from Residence", "0");
    pick("Have you lived at a different address in the past 6 months?", lived);
    pick("Quote with Assumed Score", "0");
  }, livedElsewhere);
}

async function waitForTravelersReportOrderProcessing(
  root: TravelersFormRoot,
  maxMs: number
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isTravelersReportContinueEnabled(root)) return;
    if (await tryClickTravelersReportContinue(root)) return;
    const loading = await root.locator("#loaderContainer").isVisible().catch(() => false);
    if (loading) {
      await root
        .locator("#loaderContainer")
        .waitFor({ state: "hidden", timeout: 2000 })
        .catch(() => undefined);
    }
    await new Promise<void>((r) => {
      setTimeout(r, 150);
    });
  }
}

async function isTravelersReportInformationNoHit(root: TravelersFormRoot): Promise<boolean> {
  return root
    .locator("#overlayMessage.overlayError, #info-list-container .error-list")
    .filter({ hasText: /No Hit|reorder the report/i })
    .first()
    .isVisible()
    .catch(() => false);
}

async function clickTravelersReportOrderReports(root: TravelersFormRoot): Promise<boolean> {
  const orderBtn = root.locator("#overlayButton-reports-dynamicOrderReport").first();
  await root
    .evaluate(() => {
      document.querySelector("#overlayFooter")?.scrollIntoView({ block: "end", behavior: "instant" });
    })
    .catch(() => undefined);

  if (await orderBtn.isVisible().catch(() => false) && (await orderBtn.isEnabled().catch(() => false))) {
    await orderBtn.click({ timeout: 5000 }).catch(async () => {
      await orderBtn.evaluate((el: HTMLButtonElement) => el.click());
    });
  } else {
    const clicked = await root.evaluate(() => {
      const btn = document.querySelector(
        "#overlayButton-reports-dynamicOrderReport"
      ) as HTMLButtonElement | null;
      if (!btn) return false;
      btn.style.display = "";
      btn.removeAttribute("disabled");
      btn.click();
      return true;
    });
    if (!clicked) return false;
  }

  await waitForTravelersReportOrderProcessing(root, TRAVELERS_RC_REPORT_ORDER_MS);
  return true;
}

async function waitForTravelersAfterReplacementCostReportModal(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modalOpen = await page
      .locator("#overlayTitle")
      .filter({ hasText: /Report Information/i })
      .isVisible()
      .catch(() => false);
    if (!modalOpen) {
      await page
        .locator("#loaderContainer")
        .waitFor({ state: "hidden", timeout: 10_000 })
        .catch(() => undefined);
      return;
    }
    await new Promise<void>((r) => {
      setTimeout(r, 100);
    });
  }
  throw new Error("Travelers did not advance after Replacement Cost Report Information modal.");
}

async function runTravelersReplacementCostSection(
  context: BrowserContext,
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_replacement_cost_loading");
  await page.bringToFront().catch(() => undefined);
  await waitForTravelersReplacementCostCalculationMethod(page, 120_000);

  updateStep("travelers_replacement_cost_select_quote_without_estimate");
  const root: TravelersFormRoot = page;
  await setTravelersReplacementCostCalculationMethod(root);

  updateStep("travelers_replacement_cost_continue");
  await clickTravelersPortfolioContinue(root, page);

  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);

  updateStep("travelers_replacement_cost_report_modal");
  const reportRoot = await waitForTravelersReportInformationModal(context, page, 30_000);
  await completeTravelersReplacementCostReportInformationModal(reportRoot, payload);

  await waitForTravelersAfterReplacementCostReportModal(page, 20_000);
}

function travelersLossesAutoPolicyLimitSelect(root: TravelersFormRoot): Locator {
  return root
    .locator(
      '#autoPolicyLimits select[data-label="Current Auto Policy Bodily Injury Limit"]'
    )
    .first();
}

async function isTravelersLossesAutoPolicyLimitReady(page: Page): Promise<boolean> {
  return travelersLossesAutoPolicyLimitSelect(page).isVisible().catch(() => false);
}

async function ensureTravelersLossesView(page: Page): Promise<void> {
  if (await isTravelersLossesAutoPolicyLimitReady(page)) return;

  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);

  await clickTravelersSubnav(page, "subnav_losses");

  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);
}

async function waitForTravelersLossesAutoPolicyLimitPage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await ensureTravelersLossesView(page);
    if (await isTravelersLossesAutoPolicyLimitReady(page)) return;
    await new Promise<void>((r) => {
      setTimeout(r, 300);
    });
  }
  throw new Error("Travelers LOSSES — Current Auto Policy Bodily Injury Limit dropdown did not appear.");
}

async function scrollTravelersLossesAutoPolicyLimitsIntoView(root: TravelersFormRoot): Promise<void> {
  await root
    .evaluate(() => {
      document.querySelector("#autoPolicyLimits")?.scrollIntoView({ block: "center", behavior: "instant" });
      const main = document.querySelector("#main");
      if (main) main.scrollTop = Math.min(main.scrollHeight, main.scrollTop + 320);
    })
    .catch(() => undefined);
  await new Promise<void>((r) => {
    setTimeout(r, 300);
  });
}

async function resolveTravelersVisibleLossesAutoPolicyLimitSelect(
  root: TravelersFormRoot
): Promise<Locator> {
  const dataLabel = "Current Auto Policy Bodily Injury Limit";
  const elementId = await root.evaluate((label) => {
    let bestSelect: HTMLSelectElement | null = null;
    let bestArea = 0;

    const consider = (candidate: HTMLSelectElement | null) => {
      if (!candidate) return;
      const style = window.getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = candidate.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestSelect = candidate;
      }
    };

    const panel = document.querySelector("#autoPolicyLimits");
    panel?.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
      consider(el as HTMLSelectElement);
    });
    if (!bestSelect) {
      document.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
        consider(el as HTMLSelectElement);
      });
    }

    const chosen = bestSelect as HTMLSelectElement | null;
    return chosen?.id ?? "";
  }, dataLabel);

  if (elementId) return travelersLocatorByElementId(root, elementId);
  return travelersLossesAutoPolicyLimitSelect(root);
}

async function readTravelersLossesAutoPolicyLimitValue(root: TravelersFormRoot): Promise<string> {
  return root.evaluate(() => {
    const label = "Current Auto Policy Bodily Injury Limit";
    let bestValue = "";
    let bestArea = 0;

    const consider = (select: HTMLSelectElement) => {
      const style = window.getComputedStyle(select);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = select.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestValue = select.value ?? "";
      }
    };

    document.querySelector("#autoPolicyLimits")?.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
      consider(el as HTMLSelectElement);
    });
    if (!bestValue) {
      document.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
        consider(el as HTMLSelectElement);
      });
    }
    return bestValue;
  });
}

async function travelersLossesAutoPolicyLimitOptionIndex(
  root: TravelersFormRoot,
  value: string
): Promise<number> {
  return root.evaluate((targetValue) => {
    const label = "Current Auto Policy Bodily Injury Limit";
    let bestSelect: HTMLSelectElement | null = null;
    let bestArea = 0;

    const consider = (candidate: HTMLSelectElement) => {
      const style = window.getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = candidate.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestSelect = candidate;
      }
    };

    document.querySelector("#autoPolicyLimits")?.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
      consider(el as HTMLSelectElement);
    });
    const selectEl = bestSelect as HTMLSelectElement | null;
    if (!selectEl) return -1;

    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i]?.value === targetValue) return i;
    }
    return -1;
  }, value);
}

async function applyTravelersLossesAutoPolicyLimitInDom(
  root: TravelersFormRoot,
  choice: { value: string; label: string }
): Promise<{ value: string; selectId: string }> {
  return root.evaluate((mapped) => {
    const label = "Current Auto Policy Bodily Injury Limit";
    let bestSelect: HTMLSelectElement | null = null;
    let bestArea = 0;

    const consider = (candidate: HTMLSelectElement | null) => {
      if (!candidate) return;
      const style = window.getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = candidate.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestSelect = candidate;
      }
    };

    document.querySelector("#autoPolicyLimits")?.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
      consider(el as HTMLSelectElement);
    });
    if (!bestSelect) {
      document.querySelectorAll(`select[data-label="${label}"]`).forEach((el) => {
        consider(el as HTMLSelectElement);
      });
    }

    if (!bestSelect) return { value: "", selectId: "" };
    const selectEl: HTMLSelectElement = bestSelect;

    let matched: HTMLOptionElement | null = null;
    for (const opt of Array.from(selectEl.options)) {
      const text = (opt.textContent ?? "").trim();
      if (
        opt.value === mapped.value ||
        text === mapped.label ||
        text.toLowerCase() === mapped.label.toLowerCase()
      ) {
        matched = opt;
        break;
      }
    }
    if (matched == null) return { value: "", selectId: selectEl.id ?? "" };

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(selectEl, matched.value);
    else selectEl.value = matched.value;
    matched.selected = true;
    selectEl.selectedIndex = matched.index;

    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

    const jq = (window as {
      $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
    }).$;
    if (jq) {
      const chain = jq(selectEl);
      chain.val(matched.value);
      chain.trigger("change");
    }

    return { value: selectEl.value, selectId: selectEl.id ?? "" };
  }, choice);
}

async function setTravelersLossesAutoPolicyBodilyInjuryLimit(
  root: TravelersFormRoot,
  raw: string
): Promise<void> {
  const trimmed = raw.trim();
  const choice = await resolveTravelersLossesAutoPolicyLimitChoice(root, trimmed);
  const optionIndex = await travelersLossesAutoPolicyLimitOptionIndex(root, choice.value);

  await scrollTravelersLossesAutoPolicyLimitsIntoView(root);
  const select = await resolveTravelersVisibleLossesAutoPolicyLimitSelect(root);
  await select.waitFor({ state: "visible", timeout: 45_000 });
  await select.scrollIntoViewIfNeeded().catch(() => undefined);

  let actual = await readTravelersLossesAutoPolicyLimitValue(root);
  if (actual === choice.value) return;

  let result = await applyTravelersLossesAutoPolicyLimitInDom(root, choice);
  actual = await readTravelersLossesAutoPolicyLimitValue(root);
  if (actual === choice.value) return;

  const selectLocator =
    result.selectId.length > 0
      ? travelersLocatorByElementId(root, result.selectId)
      : select;

  await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);
  const labelCandidates = [trimmed, choice.label];
  let selected = false;
  for (const label of labelCandidates) {
    const picked = await selectLocator.selectOption({ label }).catch(() => null);
    if (picked && picked.length > 0) {
      selected = true;
      break;
    }
  }
  if (!selected) {
    await selectLocator.selectOption({ value: choice.value }).catch(() => undefined);
  }
  await selectLocator.press("Tab").catch(() => undefined);

  actual = await readTravelersLossesAutoPolicyLimitValue(root);
  if (actual === choice.value) return;

  result = await applyTravelersLossesAutoPolicyLimitInDom(root, choice);
  actual = await readTravelersLossesAutoPolicyLimitValue(root);
  if (actual === choice.value) return;

  if (optionIndex >= 0) {
    await selectLocator.focus().catch(() => undefined);
    await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);
    for (let i = 0; i < optionIndex; i++) {
      await selectLocator.press("ArrowDown");
    }
    await selectLocator.press("Enter");
    await selectLocator.press("Tab").catch(() => undefined);
  }

  actual = await readTravelersLossesAutoPolicyLimitValue(root);
  if (actual !== choice.value) {
    throw new Error(
      `Travelers Current Auto Policy Bodily Injury Limit was not set to "${choice.label}" (${choice.value}). actual=${actual || "(blank)"}`
    );
  }
}

async function waitForTravelersAfterLossesContinue(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isTravelersLossesAutoPolicyLimitReady(page))) {
      await page
        .locator("#loaderContainer")
        .waitFor({ state: "hidden", timeout: 15_000 })
        .catch(() => undefined);
      return;
    }
    await new Promise<void>((r) => {
      setTimeout(r, 250);
    });
  }
}

async function runTravelersLossesAutoPolicyLimitsSection(
  context: BrowserContext,
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_losses_loading");
  await page.bringToFront().catch(() => undefined);
  await waitForTravelersLossesAutoPolicyLimitPage(page, 45_000);

  const raw = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("currentAutoPolicyBodilyInjuryLimit")
  );
  if (!raw) {
    throw new Error("Travelers LOSSES requires currentAutoPolicyBodilyInjuryLimit in payload.");
  }

  updateStep("travelers_losses_fill");
  const root: TravelersFormRoot = page;
  await setTravelersLossesAutoPolicyBodilyInjuryLimit(root, raw);

  updateStep("travelers_losses_continue");
  await clickTravelersPortfolioContinue(root, page);
  await waitForTravelersAfterLossesContinue(page, 45_000);
}

function normalizeTravelersCoverageAmount(raw: string): string {
  return raw.replace(/,/g, "").replace(/\$/g, "").trim();
}

function mapTravelersBaseCoverageLevelPortal(raw: string): { value: string; label: string } {
  const target = normalizeTravelersDropdownText(raw);
  for (const opt of TRAVELERS_BASE_COVERAGE_LEVEL_OPTIONS) {
    if (normalizeTravelersDropdownText(opt.label) === target) return { ...opt };
    if (normalizeTravelersDropdownText(opt.value) === target) return { ...opt };
  }
  const code = raw.trim().toUpperCase();
  if (code === "PROTPRMR" || target.includes("premier")) {
    return { ...TRAVELERS_BASE_COVERAGE_LEVEL_OPTIONS[2] };
  }
  if (code === "PROTPLUS" || (target.includes("plus") && !target.includes("premier"))) {
    return { ...TRAVELERS_BASE_COVERAGE_LEVEL_OPTIONS[1] };
  }
  if (code === "PROTECT" || target.includes("protect")) {
    return { ...TRAVELERS_BASE_COVERAGE_LEVEL_OPTIONS[0] };
  }
  throw new Error(`Travelers Base Coverage Level could not be mapped: ${raw}`);
}

async function resolveTravelersCoverageSelectChoice(
  root: TravelersFormRoot,
  panelSelector: string,
  dataLabel: string,
  raw: string
): Promise<{ value: string; label: string }> {
  const trimmed = raw.trim();
  const target = normalizeTravelersDropdownText(trimmed);

  if (dataLabel === "Base Coverage Level") {
    try {
      return mapTravelersBaseCoverageLevelPortal(trimmed);
    } catch {
      /* fall through to DOM */
    }
  }

  const panelSelectors = travelersCoveragePanelSelectors(panelSelector);
  const fromDom = await root.evaluate(
    ({ panelSelectors, dataLabel, optionText, targetNorm }) => {
      const norm = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/\u00ae|\u2122/g, "")
          .replace(/,/g, "")
          .replace(/\$/g, "")
          .replace(/\s+/g, " ")
          .trim();

      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;
      const consider = (select: HTMLSelectElement) => {
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      };

      for (const ps of panelSelectors) {
        const panel = document.querySelector(ps);
        panel?.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
          consider(el as HTMLSelectElement);
        });
      }

      const selectEl = bestSelect as HTMLSelectElement | null;
      if (!selectEl) return null;

      const amountNorm = norm(optionText);
      for (const opt of Array.from(selectEl.options)) {
        const label = (opt.textContent ?? "").trim();
        const value = (opt.value ?? "").trim();
        if (!value) continue;
        if (
          norm(label) === targetNorm ||
          norm(value) === targetNorm ||
          norm(value) === amountNorm ||
          norm(label) === amountNorm ||
          value === optionText.trim()
        ) {
          return { value, label };
        }
      }
      return null;
    },
    { panelSelectors, dataLabel, optionText: trimmed, targetNorm: target }
  );

  if (fromDom?.value) return fromDom;
  if (dataLabel === "Base Coverage Level") {
    return mapTravelersBaseCoverageLevelPortal(trimmed);
  }
  throw new Error(`Travelers could not resolve "${dataLabel}" option: ${raw}`);
}

function travelersCoveragePanelSelectors(panelSelector: string): string[] {
  return [panelSelector, TRAVELERS_HOME_COVERAGE_PANEL];
}

async function resolveTravelersVisibleCoverageSelect(
  root: TravelersFormRoot,
  panelSelector: string,
  dataLabel: string
): Promise<Locator> {
  const panelSelectors = travelersCoveragePanelSelectors(panelSelector);
  const elementId = await root.evaluate(
    ({ panelSelectors, dataLabel }) => {
      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;

      const consider = (select: HTMLSelectElement) => {
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      };

      for (const ps of panelSelectors) {
        const panel = document.querySelector(ps);
        panel?.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
          consider(el as HTMLSelectElement);
        });
      }
      if (!bestSelect) {
        document.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
          consider(el as HTMLSelectElement);
        });
      }

      const chosen = bestSelect as HTMLSelectElement | null;
      return chosen?.id ?? "";
    },
    { panelSelectors, dataLabel }
  );

  if (elementId) return travelersLocatorByElementId(root, elementId);
  return root.locator(`${panelSelector} select[data-label="${dataLabel}"]`).first();
}

async function readTravelersCoverageSelectValue(
  root: TravelersFormRoot,
  panelSelector: string,
  dataLabel: string
): Promise<string> {
  const panelSelectors = travelersCoveragePanelSelectors(panelSelector);
  return root.evaluate(
    ({ panelSelectors, dataLabel }) => {
      let bestValue = "";
      let bestArea = 0;

      const consider = (select: HTMLSelectElement) => {
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestValue = select.value ?? "";
        }
      };

      for (const ps of panelSelectors) {
        const panel = document.querySelector(ps);
        panel?.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
          consider(el as HTMLSelectElement);
        });
      }
      return bestValue;
    },
    { panelSelectors, dataLabel }
  );
}

async function travelersCoverageSelectOptionIndex(
  root: TravelersFormRoot,
  panelSelector: string,
  dataLabel: string,
  value: string
): Promise<number> {
  const panelSelectors = travelersCoveragePanelSelectors(panelSelector);
  return root.evaluate(
    ({ panelSelectors, dataLabel, targetValue }) => {
      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;

      const consider = (select: HTMLSelectElement) => {
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      };

      for (const ps of panelSelectors) {
        const panel = document.querySelector(ps);
        panel?.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
          consider(el as HTMLSelectElement);
        });
      }

      const selectEl = bestSelect as HTMLSelectElement | null;
      if (!selectEl) return -1;
      for (let i = 0; i < selectEl.options.length; i++) {
        if (selectEl.options[i]?.value === targetValue) return i;
      }
      return -1;
    },
    { panelSelectors, dataLabel, targetValue: value }
  );
}

async function applyTravelersCoverageSelectInDom(
  root: TravelersFormRoot,
  panelSelector: string,
  dataLabel: string,
  choice: { value: string; label: string }
): Promise<{ value: string; selectId: string }> {
  const panelSelectors = travelersCoveragePanelSelectors(panelSelector);
  return root.evaluate(
    ({ panelSelectors, dataLabel, choice }) => {
      const norm = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/\u00ae|\u2122/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const choiceLabelNorm = norm(choice.label);
      const choiceValueNorm = norm(choice.value);

      let bestSelect: HTMLSelectElement | null = null;
      let bestArea = 0;

      const consider = (select: HTMLSelectElement) => {
        const style = window.getComputedStyle(select);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = select.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          bestSelect = select;
        }
      };

      for (const ps of panelSelectors) {
        const panel = document.querySelector(ps);
        panel?.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
          consider(el as HTMLSelectElement);
        });
      }
      if (!bestSelect) {
        document.querySelectorAll(`select[data-label="${dataLabel}"]`).forEach((el) => {
          consider(el as HTMLSelectElement);
        });
      }

      if (!bestSelect) return { value: "", selectId: "" };
      const selectEl: HTMLSelectElement = bestSelect;

      let matched: HTMLOptionElement | null = null;
      for (const opt of Array.from(selectEl.options)) {
        const text = (opt.textContent ?? "").trim();
        const textNorm = norm(text);
        if (
          opt.value === choice.value ||
          textNorm === choiceLabelNorm ||
          norm(opt.value) === choiceValueNorm
        ) {
          matched = opt;
          break;
        }
      }
      if (matched == null) return { value: "", selectId: selectEl.id ?? "" };

      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (setter) setter.call(selectEl, matched.value);
      else selectEl.value = matched.value;
      matched.selected = true;
      selectEl.selectedIndex = matched.index;
      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

      const jq = (window as {
        $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
      }).$;
      if (jq) {
        jq(selectEl).val(matched.value);
        jq(selectEl).trigger("change");
      }

      return { value: selectEl.value, selectId: selectEl.id ?? "" };
    },
    { panelSelectors, dataLabel, choice }
  );
}

async function setTravelersHomeCoverageSelect(
  root: TravelersFormRoot,
  panelSelector: string,
  dataLabel: string,
  raw: string
): Promise<void> {
  const trimmed = raw.trim();
  const choice = await resolveTravelersCoverageSelectChoice(root, panelSelector, dataLabel, trimmed);
  const optionIndex = await travelersCoverageSelectOptionIndex(
    root,
    panelSelector,
    dataLabel,
    choice.value
  );

  const select = await resolveTravelersVisibleCoverageSelect(root, panelSelector, dataLabel);
  await select.waitFor({ state: "visible", timeout: 45_000 });
  await select.scrollIntoViewIfNeeded().catch(() => undefined);

  const readActual = () => readTravelersCoverageSelectValue(root, panelSelector, dataLabel);

  let actual = await readActual();
  if (actual === choice.value) return;

  let result = await applyTravelersCoverageSelectInDom(root, panelSelector, dataLabel, choice);
  actual = await readActual();
  if (actual === choice.value) return;

  const selectLocator =
    result.selectId.length > 0
      ? travelersLocatorByElementId(root, result.selectId)
      : select;

  await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);

  const pickedValue = await selectLocator.selectOption({ value: choice.value }).catch(() => null);
  if (!pickedValue?.length) {
    for (const label of [trimmed, choice.label]) {
      const picked = await selectLocator.selectOption({ label }).catch(() => null);
      if (picked?.length) break;
    }
  }
  await selectLocator.press("Tab").catch(() => undefined);

  actual = await readActual();
  if (actual === choice.value) return;

  result = await applyTravelersCoverageSelectInDom(root, panelSelector, dataLabel, choice);
  actual = await readActual();
  if (actual === choice.value) return;

  if (optionIndex >= 0) {
    await selectLocator.focus().catch(() => undefined);
    await selectLocator.click({ timeout: 10_000 }).catch(() => undefined);
    for (let i = 0; i < optionIndex; i++) {
      await selectLocator.press("ArrowDown");
    }
    await selectLocator.press("Enter");
    await selectLocator.press("Tab").catch(() => undefined);
  }

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    actual = await readActual();
    if (actual === choice.value) return;
    await root
      .locator("#loaderContainer")
      .waitFor({ state: "hidden", timeout: 3000 })
      .catch(() => undefined);
    await new Promise<void>((r) => {
      setTimeout(r, 300);
    });
  }

  if (actual !== choice.value) {
    throw new Error(
      `Travelers "${dataLabel}" was not set to "${choice.label}" (${choice.value}). actual=${actual || "(blank)"}`
    );
  }
}

function resolveTravelersDeductibleChoice(
  raw: string
): { value: string; label: string } | null {
  const trimmed = raw.trim();
  const amountNorm = normalizeTravelersCoverageAmount(trimmed);

  const deductibleOptions = [
    { value: "1000", label: "1,000" },
    { value: "1500", label: "1,500" },
    { value: "2000", label: "2,000" },
    { value: "2500", label: "2,500" },
    { value: "5000", label: "5,000" },
    { value: "7500", label: "7,500" },
    { value: "10000", label: "10,000" },
    { value: "25000", label: "25,000" },
    { value: "50000", label: "50,000" },
    { value: "0.0100", label: "1%" },
    { value: "0.0200", label: "2%" },
  ];

  for (const opt of deductibleOptions) {
    if (opt.value === trimmed || opt.value === amountNorm) return opt;
    if (normalizeTravelersCoverageAmount(opt.label) === amountNorm) return opt;
    if (opt.label === trimmed) return opt;
  }
  return null;
}

async function resolveTravelersDeductibleSelect(root: TravelersFormRoot): Promise<Locator> {
  const elementId = await root.evaluate((limitsPanel) => {
    const panel =
      document.querySelector("#homeCoverageContainer")?.querySelector(limitsPanel) ??
      document.querySelector(limitsPanel);
    const label = panel?.querySelector(".sm-label-deductible");
    const select = label?.closest(".sm-question")?.querySelector("select") as HTMLSelectElement | null;
    return select?.id ?? "";
  }, TRAVELERS_COVERAGE_LIMITS_PANEL);

  if (elementId) return travelersLocatorByElementId(root, elementId);
  return root
    .locator(
      `${TRAVELERS_HOME_COVERAGE_PANEL} ${TRAVELERS_COVERAGE_LIMITS_PANEL} .sm-question:has(.sm-label-deductible) select`
    )
    .first();
}

async function readTravelersDeductibleValue(root: TravelersFormRoot): Promise<string> {
  return root.evaluate((limitsPanel) => {
    const panel =
      document.querySelector("#homeCoverageContainer")?.querySelector(limitsPanel) ??
      document.querySelector(limitsPanel);
    const label = panel?.querySelector(".sm-label-deductible");
    const select = label?.closest(".sm-question")?.querySelector("select") as HTMLSelectElement | null;
    return select?.value ?? "";
  }, TRAVELERS_COVERAGE_LIMITS_PANEL);
}

async function applyTravelersDeductibleInDom(
  root: TravelersFormRoot,
  choice: { value: string; label: string }
): Promise<string> {
  return root.evaluate(
    ({ limitsPanel, mapped }) => {
    const panel =
      document.querySelector("#homeCoverageContainer")?.querySelector(limitsPanel) ??
      document.querySelector(limitsPanel);
    const label = panel?.querySelector(".sm-label-deductible");
    const selectEl = label?.closest(".sm-question")?.querySelector("select") as HTMLSelectElement | null;
    if (!selectEl) return "";

    let matched: HTMLOptionElement | null = null;
    for (const opt of Array.from(selectEl.options)) {
      if (opt.value === mapped.value) {
        matched = opt;
        break;
      }
    }
    if (!matched) return selectEl.value ?? "";

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(selectEl, matched.value);
    else selectEl.value = matched.value;
    matched.selected = true;
    selectEl.selectedIndex = matched.index;
    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

    const jq = (window as {
      $?: (target: HTMLElement) => { val: (v: string) => unknown; trigger: (n: string) => unknown };
    }).$;
    if (jq) {
      jq(selectEl).val(matched.value);
      jq(selectEl).trigger("change");
    }
    return selectEl.value ?? "";
  },
    { limitsPanel: TRAVELERS_COVERAGE_LIMITS_PANEL, mapped: choice }
  );
}

async function setTravelersHomeCoverageDeductible(root: TravelersFormRoot, raw: string): Promise<void> {
  const trimmed = raw.trim();
  const choice = resolveTravelersDeductibleChoice(trimmed);
  if (!choice) {
    throw new Error(`Travelers Deductible could not be mapped: ${raw}`);
  }

  const select = await resolveTravelersDeductibleSelect(root);
  await select.waitFor({ state: "visible", timeout: 45_000 });

  let actual = await readTravelersDeductibleValue(root);
  if (actual === choice.value) return;

  actual = await applyTravelersDeductibleInDom(root, choice);
  if (actual === choice.value) return;

  await select.scrollIntoViewIfNeeded().catch(() => undefined);
  await select.click({ timeout: 10_000 }).catch(() => undefined);
  await select.selectOption({ value: choice.value }).catch(async () => {
    await select.selectOption({ label: choice.label });
  });
  await select.press("Tab").catch(() => undefined);

  actual = await readTravelersDeductibleValue(root);
  if (actual !== choice.value) {
    throw new Error(
      `Travelers Deductible was not set to "${choice.label}" (${choice.value}). actual=${actual || "(blank)"}`
    );
  }
}

function travelersHomeCoverageInputLocator(root: TravelersFormRoot, dataLabel: string): Locator {
  return root
    .locator(
      `${TRAVELERS_HOME_COVERAGE_PANEL} ${TRAVELERS_COVERAGE_LIMITS_PANEL} input[data-label="${dataLabel}"]`
    )
    .first();
}

async function scrollTravelersHomeCoverageIntoView(root: TravelersFormRoot): Promise<void> {
  await root
    .evaluate(() => {
      document.querySelector("#homeCoverageContainer")?.scrollIntoView({ block: "start", behavior: "instant" });
      document.querySelector("#q2coverageLimits")?.scrollIntoView({ block: "center", behavior: "instant" });
    })
    .catch(() => undefined);
}

async function fillTravelersHomeCoverageInput(
  root: TravelersFormRoot,
  dataLabel: string,
  value: string
): Promise<void> {
  const loc = travelersHomeCoverageInputLocator(root, dataLabel);
  await loc.waitFor({ state: "visible", timeout: 45_000 });

  const normalized = normalizeTravelersCoverageAmount(value);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && (await loc.isDisabled().catch(() => false))) {
    await new Promise<void>((r) => {
      setTimeout(r, 200);
    });
  }
  if (await loc.isDisabled().catch(() => false)) {
    throw new Error(`Travelers "${dataLabel}" is disabled and could not be filled.`);
  }

  const current = normalizeTravelersCoverageAmount((await loc.inputValue().catch(() => "")) || "");
  if (current === normalized) return;

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click();
  await loc.press("Control+A").catch(() => undefined);
  await loc.fill(normalized);
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, normalized);
  await loc.press("Tab").catch(() => undefined);

  const actual = normalizeTravelersCoverageAmount((await loc.inputValue().catch(() => "")) || "");
  if (actual !== normalized) {
    throw new Error(
      `Travelers "${dataLabel}" was not set to "${normalized}". actual=${actual || "(blank)"}`
    );
  }
}

async function isTravelersHomeCoverageReady(page: Page): Promise<boolean> {
  return page
    .locator(`${TRAVELERS_HOME_COVERAGE_PANEL} select[data-label="Base Coverage Level"]`)
    .first()
    .isVisible()
    .catch(() => false);
}

async function ensureTravelersCoverageView(page: Page): Promise<void> {
  if (await isTravelersHomeCoverageReady(page)) return;
  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => undefined);
  await clickTravelersSubnav(page, "subnav_coverage");
  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);
}

async function waitForTravelersHomeCoveragePage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await ensureTravelersCoverageView(page);
    if (await isTravelersHomeCoverageReady(page)) return;
    await new Promise<void>((r) => {
      setTimeout(r, 300);
    });
  }
  throw new Error("Travelers Coverage section did not load.");
}

function travelersCoveragePremiumTopButton(root: TravelersFormRoot, page: Page): Locator {
  return root
    .locator(`${TRAVELERS_HOME_COVERAGE_PANEL} #dynamicContinueButtonTop`)
    .or(page.locator(`${TRAVELERS_HOME_COVERAGE_PANEL} #displayPremium button[name="dynamicContinueButton"]`))
    .first();
}

async function travelersCoveragePremiumTopButtonLabel(
  root: TravelersFormRoot,
  page: Page
): Promise<string> {
  const btn = travelersCoveragePremiumTopButton(root, page);
  return (await btn.innerText().catch(() => "")).trim();
}

async function clickTravelersCoveragePremiumTopButton(root: TravelersFormRoot, page: Page): Promise<void> {
  const btn = travelersCoveragePremiumTopButton(root, page);
  await btn.waitFor({ state: "visible", timeout: 45_000 });
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);

  const start = Date.now();
  while (Date.now() - start < 20_000) {
    if (await btn.isEnabled().catch(() => false)) break;
    await new Promise<void>((r) => {
      setTimeout(r, 150);
    });
  }

  await btn.click({ timeout: 10_000 }).catch(async () => {
    await btn.evaluate((el: HTMLButtonElement) => el.click());
  });
}

async function clickTravelersCoverageRateButton(root: TravelersFormRoot, page: Page): Promise<void> {
  const label = await travelersCoveragePremiumTopButtonLabel(root, page);
  if (!/rate/i.test(label)) return;
  await clickTravelersCoveragePremiumTopButton(root, page);
}

async function waitForTravelersCoverageContinueAfterRate(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page
      .locator("#loaderContainer")
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => undefined);

    const label = await travelersCoveragePremiumTopButtonLabel(page, page);
    const premiumVisible = await page
      .locator(`${TRAVELERS_HOME_COVERAGE_PANEL} #displayPremium .current, ${TRAVELERS_HOME_COVERAGE_PANEL} #displayPremium .child`)
      .first()
      .isVisible()
      .catch(() => false);
    const pleaseRate = await page
      .locator(`${TRAVELERS_HOME_COVERAGE_PANEL} #displayPremium`)
      .getByText(/Please click the Rate button/i)
      .isVisible()
      .catch(() => false);

    if (/continue/i.test(label) && premiumVisible && !pleaseRate) return;

    await new Promise<void>((r) => {
      setTimeout(r, 200);
    });
  }
  throw new Error("Travelers Continue did not appear after Rate on Coverage.");
}

async function clickTravelersCoverageContinueAfterRate(root: TravelersFormRoot, page: Page): Promise<void> {
  await waitForTravelersCoverageContinueAfterRate(page, 90_000);
  const label = await travelersCoveragePremiumTopButtonLabel(root, page);
  if (!/continue/i.test(label)) {
    throw new Error(`Travelers Coverage expected Continue button after Rate, got: "${label || "(blank)"}"`);
  }
  await clickTravelersCoveragePremiumTopButton(root, page);
}

async function waitForTravelersAfterCoverageContinue(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page
      .locator("#loaderContainer")
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => undefined);

    const payIssueStep = await page
      .locator('[data-analytics-click="mainnav_payissue"], [data-analytics-click="mainnav_pay"]')
      .first()
      .isVisible()
      .catch(() => false);
    const portfolioContinue = await page.locator("#dynamicContinueButton").first().isVisible().catch(() => false);
    const portfolioSendDigitalQuote = await page.locator("#interactiveQP").first().isVisible().catch(() => false);
    const premiumContinue = await page
      .locator(`${TRAVELERS_HOME_COVERAGE_PANEL} #displayPremium #dynamicContinueButtonTop`)
      .isVisible()
      .catch(() => false);
    const premiumLabel = premiumContinue
      ? await travelersCoveragePremiumTopButtonLabel(page, page)
      : "";

    if (
      payIssueStep ||
      portfolioContinue ||
      portfolioSendDigitalQuote ||
      (premiumContinue && !/continue/i.test(premiumLabel))
    ) {
      return;
    }

    await new Promise<void>((r) => {
      setTimeout(r, 200);
    });
  }
  throw new Error("Travelers did not advance after Coverage Continue.");
}

async function waitForTravelersCoverageRateFinished(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page
      .locator("#loaderContainer")
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => undefined);

    const pleaseRate = await page
      .locator("#displayPremium")
      .getByText(/Please click the Rate button/i)
      .isVisible()
      .catch(() => false);
    if (!pleaseRate) return;

    await new Promise<void>((r) => {
      setTimeout(r, 400);
    });
  }
}

async function waitForTravelersPostCoverageRateScreen(page: Page, timeoutMs: number): Promise<void> {
  await waitForTravelersCoverageRateFinished(page, timeoutMs);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pleaseRate = await page
      .locator(`${TRAVELERS_HOME_COVERAGE_PANEL} #displayPremium`)
      .getByText(/Please click the Rate button/i)
      .isVisible()
      .catch(() => false);
    const premiumCalculated = await page
      .locator(`${TRAVELERS_HOME_COVERAGE_PANEL} #displayPremium`)
      .getByText(/Home Premium|12 months|\$\d/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!pleaseRate && premiumCalculated) {
      await page
        .locator("#loaderContainer")
        .waitFor({ state: "hidden", timeout: 15_000 })
        .catch(() => undefined);
      return;
    }
    await new Promise<void>((r) => {
      setTimeout(r, 200);
    });
  }
  throw new Error("Travelers premium did not calculate after Rate on Coverage.");
}

async function waitForTravelersPortfolioPage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page
      .locator("#loaderContainer")
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => undefined);

    const portfolioNav = await page
      .locator('[data-analytics-click="mainnav_portfolio"], #ubertab-PORTFOLIO-')
      .first()
      .isVisible()
      .catch(() => false);
    const portfolioPanel = await page.locator(TRAVELERS_PORTFOLIO_PANEL).first().isVisible().catch(() => false);
    const sendDigitalQuote = await page.locator("#interactiveQP").first().isVisible().catch(() => false);

    if (portfolioNav && portfolioPanel && sendDigitalQuote) return;

    await new Promise<void>((r) => {
      setTimeout(r, 200);
    });
  }
  throw new Error("Travelers Portfolio page did not load.");
}

async function clickTravelersSendDigitalQuoteButton(page: Page): Promise<void> {
  const btn = page.locator("#interactiveQP").first();
  await btn.waitFor({ state: "visible", timeout: 45_000 });
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);
  await btn.click({ timeout: 15_000 }).catch(async () => {
    await btn.evaluate((el: HTMLButtonElement) => el.click());
  });
}

async function waitForTravelersSimpleQuoteModal(page: Page, timeoutMs: number): Promise<void> {
  await page
    .locator("#overlayTitle")
    .filter({ hasText: /Email or Text Quote Proposal/i })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  await page
    .locator(`${TRAVELERS_SIMPLE_QUOTE_CONTAINER} #simpleQuoteFormPanel`)
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });
  await page
    .locator("#simpleQuoteOverlaySpinner")
    .waitFor({ state: "hidden", timeout: timeoutMs })
    .catch(() => undefined);
}

async function clickTravelersSimpleQuoteSendButton(page: Page): Promise<void> {
  const btn = page.locator("#overlayButton-simpleQuote-sendButton").first();
  await btn.waitFor({ state: "visible", timeout: 45_000 });
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);

  const start = Date.now();
  while (Date.now() - start < 30_000) {
    if (await btn.isEnabled().catch(() => false)) break;
    await new Promise<void>((r) => {
      setTimeout(r, 150);
    });
  }

  await btn.click({ timeout: 15_000 }).catch(async () => {
    await btn.evaluate((el: HTMLButtonElement) => el.click());
  });
}

async function waitForTravelersSimpleQuoteSendFinished(page: Page, timeoutMs: number): Promise<void> {
  await page
    .locator("#simpleQuoteOverlaySpinner")
    .waitFor({ state: "visible", timeout: 5000 })
    .catch(() => undefined);
  await page
    .locator("#simpleQuoteOverlaySpinner")
    .waitFor({ state: "hidden", timeout: timeoutMs })
    .catch(() => undefined);
  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: timeoutMs })
    .catch(() => undefined);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const overlayError = await page
      .locator("#overlayMessage.overlayError")
      .evaluate((el) => (el.textContent ?? "").trim().length > 0)
      .catch(() => false);
    if (overlayError) {
      const msg = (await page.locator("#overlayMessage").innerText().catch(() => "")).trim();
      throw new Error(`Travelers Digital Quote send failed: ${msg || "(unknown)"}`);
    }

    const modalOpen = await page
      .locator("#overlayTitle")
      .filter({ hasText: /Email or Text Quote Proposal/i })
      .first()
      .isVisible()
      .catch(() => false);
    const sendVisible = await page
      .locator("#overlayButton-simpleQuote-sendButton")
      .first()
      .isVisible()
      .catch(() => false);
    const sentMessage = await page
      .locator("#overlayMessage, #overlayBody")
      .getByText(/sent|success|email has been|quote proposal/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (!modalOpen || !sendVisible || sentMessage) return;

    await new Promise<void>((r) => {
      setTimeout(r, 250);
    });
  }

  throw new Error("Travelers Digital Quote Send did not complete.");
}

async function setTravelersRadioCheckedByElementId(root: TravelersFormRoot, elementId: string): Promise<void> {
  const radio = travelersLocatorByElementId(root, elementId);
  await radio.waitFor({ state: "attached", timeout: 45_000 });
  await radio.scrollIntoViewIfNeeded().catch(() => undefined);

  const escapedId = elementId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const label = root.locator(`label[for="${escapedId}"]`).first();
  if ((await label.count().catch(() => 0)) > 0) {
    await label.click({ force: true, timeout: 10_000 }).catch(() => undefined);
  }

  await radio.evaluate((el: HTMLInputElement) => {
    el.checked = true;
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  if (!(await radio.isChecked().catch(() => false))) {
    await radio.click({ force: true });
  }

  if (!(await radio.isChecked().catch(() => false))) {
    throw new Error(`Travelers could not select radio id=${elementId}.`);
  }
}

async function fillTravelersInputByElementId(
  root: TravelersFormRoot,
  elementId: string,
  value: string
): Promise<void> {
  const loc = travelersLocatorByElementId(root, elementId);
  await loc.waitFor({ state: "visible", timeout: 45_000 });
  if (await loc.isDisabled().catch(() => false)) return;

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click();
  await loc.press("Control+A").catch(() => undefined);
  await loc.press("Backspace").catch(() => undefined);
  await loc.fill(value);
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
}

function travelersDigitalQuoteAgentEmail(): string {
  const fromEnv = String(process.env.TRAVELERS_DIGITAL_QUOTE_AGENT_EMAIL ?? "").trim();
  return fromEnv || TRAVELERS_DIGITAL_QUOTE_EMAIL_DEFAULT;
}

function travelersLooksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function travelersPayloadFieldEntries(payload: unknown): TravelersPayloadKV[] {
  if (!payload || typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;
  const out: TravelersPayloadKV[] = [];

  const pushEntries = (raw: unknown): void => {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item === "object" && "key" in (item as Record<string, unknown>)) {
          out.push(item as TravelersPayloadKV);
        }
      }
      return;
    }
    if (raw && typeof raw === "object") {
      for (const value of Object.values(raw as Record<string, unknown>)) {
        if (value && typeof value === "object" && "key" in (value as Record<string, unknown>)) {
          out.push(value as TravelersPayloadKV);
        }
      }
    }
  };

  if (Array.isArray(payload)) {
    pushEntries(payload);
    return out;
  }

  pushEntries(obj.fields);
  if (Object.prototype.hasOwnProperty.call(obj, "fields")) {
    return out;
  }

  pushEntries(payload);
  return out;
}

function travelersIsExplicitCustomerEmailKey(key: string): boolean {
  const keyLower = key.toLowerCase();
  if (keyLower.includes("confirm")) return false;
  return (
    key === "personal.email" ||
    key === "email" ||
    key === "shared.email" ||
    keyLower.endsWith(".email") ||
    keyLower === "emailaddress"
  );
}

function travelersEmailFromPayloadFields(payload: unknown): string | undefined {
  const agentEmail = travelersDigitalQuoteAgentEmail().toLowerCase();
  const entries = travelersPayloadFieldEntries(payload);

  for (const entry of entries) {
    const key = String(entry?.key ?? "").trim();
    if (!key || !travelersIsExplicitCustomerEmailKey(key)) continue;
    const value = travelersTrimmedString(entry?.value);
    if (!value || !travelersLooksLikeEmail(value)) continue;
    return value;
  }

  for (const entry of entries) {
    const key = String(entry?.key ?? "").trim();
    if (!key || !/email/i.test(key)) continue;
    const keyLower = key.toLowerCase();
    if (keyLower.includes("confirm")) continue;
    const value = travelersTrimmedString(entry?.value);
    if (!value || !travelersLooksLikeEmail(value)) continue;
    if (value.toLowerCase() === agentEmail) continue;
    return value;
  }

  return undefined;
}

function travelersEmailFromPayloadObject(payload: unknown): string | undefined {
  const explicitKeys = [
    "personal.email",
    "email",
    "shared.email",
    "contactEmail",
    "customerEmail",
    "digitalQuoteEmail",
    "personal.emailAddress",
    "emailAddress",
  ];

  for (const key of explicitKeys) {
    const value = travelersTrimmedString(getTravelersPayloadValue(payload, key));
    if (value && travelersLooksLikeEmail(value)) return value;
  }

  const agentEmail = travelersDigitalQuoteAgentEmail().toLowerCase();
  for (const key of travelersPayloadKeyVariants("email")) {
    if (explicitKeys.includes(key)) continue;
    const value = travelersTrimmedString(getTravelersPayloadValue(payload, key));
    if (value && travelersLooksLikeEmail(value) && value.toLowerCase() !== agentEmail) {
      return value;
    }
  }

  const personal = getTravelersPayloadValue(payload, "personal");
  if (personal && typeof personal === "object" && !Array.isArray(personal)) {
    const emailValue = travelersTrimmedString(
      (personal as Record<string, unknown>).email
    );
    if (emailValue && travelersLooksLikeEmail(emailValue)) return emailValue;
  }

  return undefined;
}

function travelersTryDigitalQuoteCustomerEmail(payload: unknown): string | undefined {
  return (
    travelersEmailFromPayloadObject(payload) ??
    travelersEmailFromPayloadFields(payload) ??
    undefined
  );
}

function travelersShouldStopForPayloadDebug(): boolean {
  const raw = String(process.env.TRAVELERS_DEBUG_PAYLOAD ?? "0").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

function travelersLogPayloadForDebug(payload: unknown): void {
  const entries = travelersPayloadFieldEntries(payload);
  const resolvedCustomerEmail = travelersTryDigitalQuoteCustomerEmail(payload);

  console.log("\n========== TRAVELERS PAYLOAD DEBUG ==========");
  console.log("Full payload JSON:");
  try {
    console.log(JSON.stringify(payload, null, 2));
  } catch {
    console.log(payload);
  }

  console.log("\nFields array entries (key → value):");
  if (entries.length === 0) {
    console.log("  (no { key, value } entries found)");
  } else {
    for (const entry of entries) {
      const key = String(entry?.key ?? "");
      const value = travelersTrimmedString(entry?.value) ?? entry?.value;
      console.log(`  ${key}:`, value);
    }
  }

  const emailEntries = entries.filter((e) => /email/i.test(String(e?.key ?? "")));
  console.log("\nEmail-related field keys:");
  if (emailEntries.length === 0) {
    console.log("  (none)");
  } else {
    for (const entry of emailEntries) {
      console.log(`  ${String(entry?.key ?? "")}:`, travelersTrimmedString(entry?.value) ?? entry?.value);
    }
  }

  console.log("\nResolved customer email:", resolvedCustomerEmail ?? "(none)");
  console.log("Agent email (static):", travelersDigitalQuoteAgentEmail());
  console.log("==============================================\n");
}

async function travelersReadPrefilledCustomerEmail(page: Page): Promise<string | undefined> {
  const agentEmail = travelersDigitalQuoteAgentEmail().toLowerCase();
  const selectors = [
    '#accountDetailsCustomerInformation input[data-label="Email Address"]',
    '#accountDetailsCustomerInformation input[data-label="Confirm Email Address"]',
    `${TRAVELERS_SIMPLE_QUOTE_CONTAINER} input[data-label="Customer Email Address"]`,
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible().catch(() => false))) continue;
    const value = (await loc.inputValue().catch(() => "")).trim();
    if (!travelersLooksLikeEmail(value)) continue;
    if (value.toLowerCase() === agentEmail) continue;
    return value;
  }

  return undefined;
}

async function runTravelersPortfolioDigitalQuoteSection(
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_portfolio_loading");
  await page.bringToFront().catch(() => undefined);
  await waitForTravelersPortfolioPage(page, 90_000);

  const agentEmail = travelersDigitalQuoteAgentEmail();
  let customerEmail = travelersTryDigitalQuoteCustomerEmail(payload);

  updateStep("travelers_portfolio_send_digital_quote");
  await clickTravelersSendDigitalQuoteButton(page);
  await waitForTravelersSimpleQuoteModal(page, 90_000);

  if (!customerEmail) {
    customerEmail = await travelersReadPrefilledCustomerEmail(page);
  }
  if (!customerEmail) {
    throw new Error(
      "Travelers Digital Quote requires customer email in payload (e.g. personal.email in fields) or on the Account Details form."
    );
  }

  updateStep("travelers_portfolio_digital_quote_fill");
  const root: TravelersFormRoot = page;
  await setTravelersRadioCheckedByElementId(root, TRAVELERS_SIMPLE_QUOTE_CONTACT_EMAIL_RADIO_ID);
  await fillTravelersInputByElementId(root, TRAVELERS_SIMPLE_QUOTE_AGENT_EMAIL_ID, agentEmail);
  await fillTravelersInputByElementId(root, TRAVELERS_SIMPLE_QUOTE_CUSTOMER_EMAIL_ID, customerEmail);


  updateStep("travelers_portfolio_digital_quote_send");
  await clickTravelersSimpleQuoteSendButton(page);
  await waitForTravelersSimpleQuoteSendFinished(page, 120_000);
}

async function runTravelersHomeCoverageSection(
  context: BrowserContext,
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_coverage_loading");
  await page.bringToFront().catch(() => undefined);
  await waitForTravelersHomeCoveragePage(page, 45_000);

  const baseCoverageLevel = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("baseCoverageLevel")
  );
  const replacementCost = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("replacementCost")
  );
  const aDwellingLimit = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("aDwellingLimit")
  );
  const ePersonalLiability = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("ePersonalLiability")
  );
  const fMedicalPayments = travelersPayloadFirstString(
    payload,
    travelersPayloadKeyVariants("fMedicalPayments")
  );
  const deductible = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("deductible"));

  if (!baseCoverageLevel) {
    throw new Error("Travelers Coverage requires baseCoverageLevel in payload.");
  }
  if (!replacementCost) {
    throw new Error("Travelers Coverage requires replacementCost in payload.");
  }
  if (!aDwellingLimit) {
    throw new Error("Travelers Coverage requires aDwellingLimit in payload.");
  }
  if (!ePersonalLiability) {
    throw new Error("Travelers Coverage requires ePersonalLiability in payload.");
  }
  if (!fMedicalPayments) {
    throw new Error("Travelers Coverage requires fMedicalPayments in payload.");
  }
  if (!deductible) {
    throw new Error("Travelers Coverage requires deductible in payload.");
  }

  updateStep("travelers_coverage_fill");
  const root: TravelersFormRoot = page;
  await scrollTravelersHomeCoverageIntoView(root);

  await setTravelersHomeCoverageSelect(
    root,
    TRAVELERS_COVERAGE_LEVEL_PANEL,
    "Base Coverage Level",
    baseCoverageLevel
  );
  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);

  await fillTravelersHomeCoverageInput(root, "Replacement Cost", replacementCost);
  await fillTravelersHomeCoverageInput(root, "A - Dwelling Limit", aDwellingLimit);
  await setTravelersHomeCoverageSelect(
    root,
    TRAVELERS_COVERAGE_LIMITS_PANEL,
    "E - Personal Liability",
    ePersonalLiability
  );
  await setTravelersHomeCoverageSelect(
    root,
    TRAVELERS_COVERAGE_LIMITS_PANEL,
    "F - Medical Payments",
    fMedicalPayments
  );
  await setTravelersHomeCoverageDeductible(root, deductible);


  updateStep("travelers_coverage_rate");
  await clickTravelersCoverageRateButton(root, page);
  await waitForTravelersPostCoverageRateScreen(page, 90_000);

  updateStep("travelers_coverage_continue");
  await clickTravelersCoverageContinueAfterRate(root, page);
  await waitForTravelersAfterCoverageContinue(page, 90_000);

  await runTravelersPortfolioDigitalQuoteSection(page, payload, updateStep, jobId);
}

async function isTravelersResidenceViewDisplayed(page: Page): Promise<boolean> {
  return page
    .locator("#residenceContainer")
    .first()
    .evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    })
    .catch(() => false);
}

async function isTravelersFeetFromHydrantReady(page: Page): Promise<boolean> {
  try {
    const loc = await resolveTravelersVisibleFeetFromHydrantInput(page);
    return await loc.isVisible().catch(() => false);
  } catch {
    return false;
  }
}

async function clickTravelersSubnav(page: Page, analyticsClick: string): Promise<void> {
  const nav = page.locator(`span[data-analytics-click="${analyticsClick}"]`).first();
  if (await nav.isVisible().catch(() => false)) {
    await nav.click({ timeout: 10_000 }).catch(async () => {
      await nav.evaluate((el: HTMLElement) => el.click());
    });
    return;
  }

  await page
    .evaluate((attr) => {
      const el = document.querySelector(`span[data-analytics-click="${attr}"]`) as HTMLElement | null;
      el?.click();
    }, analyticsClick)
    .catch(() => undefined);
}

async function ensureTravelersResidenceView(page: Page): Promise<void> {
  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);

  if (await isTravelersFeetFromHydrantReady(page)) return;

  if (!(await isTravelersResidenceViewDisplayed(page))) {
    const homeTab = page
      .locator('[data-analytics-click="mainnav_home"], .uber-nav-tab.lob-tab.active, .uber-nav-tab.lob-tab')
      .first();
    if (await homeTab.isVisible().catch(() => false)) {
      await homeTab.click({ timeout: 10_000 }).catch(() => undefined);
      await new Promise<void>((r) => {
        setTimeout(r, 800);
      });
    }
  }

  await clickTravelersSubnav(page, "subnav_residence");

  await page
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => undefined);

  await expandTravelersResidenceAdditionalLocationPanel(page);
}

async function waitForTravelersResidenceAdditionalLocationPage(
  context: BrowserContext,
  preferredPage: Page,
  timeoutMs: number
): Promise<Page> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pages = [...context.pages()];
    if (!pages.includes(preferredPage)) pages.unshift(preferredPage);

    for (const p of pages) {
      await p.bringToFront().catch(() => undefined);
      await ensureTravelersResidenceView(p);
      if (await isTravelersFeetFromHydrantReady(p)) {
        return p;
      }
    }

    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
  }
  throw new Error("Travelers Residence Additional Location section did not load.");
}

async function runTravelersResidenceAdditionalLocation(
  context: BrowserContext,
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_residence_additional_location_loading");
  const residencePage = await waitForTravelersResidenceAdditionalLocationPage(context, page, 120_000);
  await residencePage.bringToFront().catch(() => undefined);
  const root: TravelersFormRoot = residencePage;

  const feetFromHydrant = travelersPayloadFirstString(payload, [
    "feetFromHydrant",
    "property.feetFromHydrant",
    "residence.feetFromHydrant",
  ]);
  if (!feetFromHydrant) {
    throw new Error("Travelers Residence requires feetFromHydrant in payload.");
  }

  updateStep("travelers_residence_additional_location_fill");
  await fillTravelersFeetFromHydrant(root, feetFromHydrant);

  await runTravelersResidenceHomeCharacteristics(root, payload, updateStep, jobId, residencePage);
  await runTravelersResidenceStructure(root, payload, updateStep, jobId, residencePage);
  await runTravelersResidenceRoof(root, payload, updateStep, jobId, residencePage);
  await runTravelersReplacementCostSection(context, residencePage, payload, updateStep, jobId);
  await runTravelersLossesAutoPolicyLimitsSection(context, residencePage, payload, updateStep, jobId);
  await runTravelersHomeCoverageSection(context, residencePage, payload, updateStep, jobId);
}

async function fillTravelersAiaInput(root: TravelersFormRoot, panelSelector: string, dataLabel: string, value: string): Promise<void> {
  const loc = root
    .locator(`${panelSelector} input.aiaForm-control[data-label="${dataLabel}"]`)
    .first();
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  if (await loc.isDisabled().catch(() => false)) return;

  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click();
  await loc.press("Control+A").catch(() => undefined);
  await loc.press("Backspace").catch(() => undefined);
  await loc.pressSequentially(value, { delay: 25 });
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
}

async function fillTravelersAiaSelect(
  root: TravelersFormRoot,
  panelSelector: string,
  dataLabel: string,
  value: string
): Promise<void> {
  const loc = root
    .locator(`${panelSelector} select.aiaForm-control[data-label="${dataLabel}"]`)
    .first();
  await loc.waitFor({ state: "visible", timeout: 60_000 });
  await loc.selectOption({ value: normalizeTravelersStateCode(value) });
}

async function waitForTravelersAccountDetailsPage(
  context: BrowserContext,
  preferredPage: Page,
  timeoutMs: number
): Promise<Page> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pages = [...context.pages()];
    if (!pages.includes(preferredPage)) pages.unshift(preferredPage);

    for (const p of pages) {
      await p.bringToFront().catch(() => undefined);
      const customerPanel = p.locator("#accountDetailsCustomerInformation").first();
      if (!(await customerPanel.isVisible().catch(() => false))) continue;

      await p
        .locator("#loaderContainer")
        .waitFor({ state: "hidden", timeout: 30_000 })
        .catch(() => undefined);

      return p;
    }

    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
  }

  const urls = context.pages().map((p) => p.url()).join(" | ");
  throw new Error(
    `Travelers Account Details (Strategic UI) did not load. URLs=${urls || "(none)"}`
  );
}

async function clickTravelersPortfolioContinue(root: TravelersFormRoot, page: Page): Promise<void> {
  let btn = root.locator("#dynamicContinueButton").first();
  if ((await btn.count()) === 0) {
    btn = page.locator("#dynamicContinueButton").first();
  }
  await btn.waitFor({ state: "visible", timeout: 60_000 });
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);

  const start = Date.now();
  while (Date.now() - start < 60_000) {
    if (await btn.isEnabled().catch(() => false)) break;
    await new Promise<void>((r) => {
      setTimeout(r, 300);
    });
  }

  await btn.click({ timeout: 15_000 }).catch(async () => {
    await btn.evaluate((el: HTMLButtonElement) => el.click());
  });
}

/** Address validation overlay after Account Details Continue — choose entered address. */
async function clickTravelersResidenceAddressUseOriginal(page: Page, timeoutMs: number): Promise<boolean> {
  const useOriginal = page
    .locator('#overlayButton-addressDifference-Use\\ Original, button[alias="Use Original"]')
    .or(page.getByRole("button", { name: "Use Original" }))
    .first();

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modalOpen =
      (await page.locator("#overlayTitle").filter({ hasText: /Residence Address/i }).isVisible().catch(() => false)) ||
      (await page.locator("#addressDifferencePanel").isVisible().catch(() => false));

    if (modalOpen && (await useOriginal.isVisible().catch(() => false))) {
      await useOriginal.scrollIntoViewIfNeeded().catch(() => undefined);
      await useOriginal.click({ timeout: 15_000 }).catch(async () => {
        await useOriginal.evaluate((el: HTMLButtonElement) => el.click());
      });
      await page
        .locator("#addressDifferencePanel, #overlayContainer")
        .first()
        .waitFor({ state: "hidden", timeout: 60_000 })
        .catch(() => undefined);
      return true;
    }

    await new Promise<void>((r) => {
      setTimeout(r, 300);
    });
  }

  return false;
}

async function runTravelersAccountDetails(
  context: BrowserContext,
  quotePage: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_account_details_loading");
  const accountPage = await waitForTravelersAccountDetailsPage(context, quotePage, 120_000);
  await accountPage.bringToFront();

  const phone = travelersPayloadFirstString(payload, ["personal.phone", "phone", "personal.homePhone"]);
  const dobRaw = travelersPayloadFirstString(payload, [
    "personal.applicantDOB",
    "personal.dateOfBirth",
    "dateOfBirth",
    "personal.ownerDOB",
  ]);
  const address = travelersPayloadFirstString(payload, [
    "personal.address",
    "personal.streetAddress",
    "streetAddress",
    "address",
  ]);
  const city = travelersPayloadFirstString(payload, ["personal.city", "city"]);
  const state = travelersPayloadFirstString(payload, ["personal.state", "state"]);
  const zip = travelersPayloadFirstString(payload, ["personal.zipCode", "zipCode", "zip"]);

  if (!phone) {
    throw new Error("Travelers Account Details requires Home Phone (personal.phone).");
  }
  if (!dobRaw) {
    throw new Error("Travelers Account Details requires Date of Birth (personal.applicantDOB).");
  }
  if (!address || !city || !state || !zip) {
    throw new Error(
      "Travelers Account Details requires address, city, state, and zip (personal.address, personal.city, personal.state, personal.zipCode)."
    );
  }

  const dob = formatTravelersEffectiveDateMmDdYyyy(dobRaw);
  const root: TravelersFormRoot = accountPage;

  updateStep("travelers_account_details_fill");
  await fillTravelersAiaInput(
    root,
    "#accountDetailsCustomerInformation",
    "Home Phone",
    formatTravelersPhone(phone)
  );
  await fillTravelersAiaInput(root, "#accountDetailsCustomerInformation", "Date of Birth", dob);
  await fillTravelersAiaInput(root, "#accountDetailsResidenceAddress", "Address", address);
  await fillTravelersAiaInput(root, "#accountDetailsResidenceAddress", "City", city);
  await fillTravelersAiaSelect(root, "#accountDetailsResidenceAddress", "State", state);
  await fillTravelersAiaInput(
    root,
    "#accountDetailsResidenceAddress",
    "ZIP Code",
    formatTravelersZipForInput(zip)
  );

  const mailingNo = root
    .locator('#accountDetailsResidenceAddress input[type="radio"][value="0"]')
    .first();
  if (await mailingNo.isVisible().catch(() => false)) {
    await mailingNo.check({ force: true }).catch(async () => {
      await mailingNo.click({ force: true });
    });
  }


  updateStep("travelers_account_details_continue");
  await clickTravelersPortfolioContinue(root, accountPage);

  updateStep("travelers_residence_address_modal");
  const usedOriginal = await clickTravelersResidenceAddressUseOriginal(accountPage, 60_000);
  if (!usedOriginal) {
    throw new Error(
      'Travelers "Residence Address" modal did not appear or "Use Original" could not be clicked.'
    );
  }

  await runTravelersAboutPolicy(context, accountPage, payload, updateStep, jobId);
}

async function waitForTravelersAboutPolicyPage(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const aboutPolicy = page.locator("#aboutPolicyContainer").first();
    if (await aboutPolicy.isVisible().catch(() => false)) {
      await page
        .locator("#includedQuoteContainer")
        .first()
        .waitFor({ state: "visible", timeout: 60_000 });
      return;
    }
    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
  }
  throw new Error("Travelers About Policy page did not load after Account Details.");
}

async function selectTravelersFirstAgentCode(page: Page): Promise<void> {
  const agentSelect = page.locator('#includedQuoteContainer select[data-label="Agent Code"]').first();
  await agentSelect.waitFor({ state: "visible", timeout: 60_000 });
  await agentSelect.scrollIntoViewIfNeeded().catch(() => undefined);

  const firstOption = agentSelect.locator('option[value]:not([value=""])').first();
  await firstOption.waitFor({ state: "attached", timeout: 15_000 });
  const value = await firstOption.getAttribute("value");
  if (!value) {
    throw new Error("Travelers Agent Code dropdown has no selectable options.");
  }
  await agentSelect.selectOption(value);
}

async function checkTravelersCompanionHomeowner(page: Page): Promise<void> {
  const homeowner = page.locator('#companionPolicies input[type="checkbox"][value="DWELLING"]').first();
  await homeowner.waitFor({ state: "visible", timeout: 60_000 });
  await homeowner.scrollIntoViewIfNeeded().catch(() => undefined);
  if (!(await homeowner.isChecked().catch(() => false))) {
    await homeowner.check({ force: true }).catch(async () => {
      await homeowner.click({ force: true });
    });
  }
}

async function waitForTravelersReportInformationModal(
  context: BrowserContext,
  preferredPage: Page,
  timeoutMs: number
): Promise<TravelersFormRoot> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      return await findTravelersReportInformationRoot(context, preferredPage);
    } catch {
      await new Promise<void>((r) => {
        setTimeout(r, 500);
      });
    }
  }
  throw new Error("Travelers Report Information modal did not load after About Policy.");
}

async function clickTravelersReportInformationSubmit(root: TravelersFormRoot): Promise<void> {
  await scrollTravelersReportModal(root);

  const continueBtn = root.locator("#overlayButton-reports-dynamicContinue").first();
  const orderBtn = root.locator("#overlayButton-reports-dynamicOrderReport").first();

  const start = Date.now();
  while (Date.now() - start < 90_000) {
    const modalOpen = await root
      .locator("#overlayTitle")
      .filter({ hasText: /Report Information/i })
      .isVisible()
      .catch(() => false);
    if (!modalOpen) return;

    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await continueBtn.click({ timeout: 15_000 }).catch(async () => {
        await continueBtn.evaluate((el: HTMLButtonElement) => el.click());
      });
      return;
    }

    if (await orderBtn.isVisible().catch(() => false) && (await orderBtn.isEnabled().catch(() => false))) {
      await orderBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await orderBtn.click({ timeout: 15_000 }).catch(async () => {
        await orderBtn.evaluate((el: HTMLButtonElement) => el.click());
      });
      await new Promise<void>((r) => {
        setTimeout(r, 2000);
      });
      continue;
    }

    await new Promise<void>((r) => {
      setTimeout(r, 300);
    });
  }

  throw new Error(
    'Travelers Report Information "Order Reports" / "Continue" did not become available after filling required fields.'
  );
}

async function isTravelersReportContinueEnabled(root: TravelersFormRoot): Promise<boolean> {
  const continueBtn = root.locator("#overlayButton-reports-dynamicContinue").first();
  return (
    (await continueBtn.isVisible().catch(() => false)) &&
    (await continueBtn.isEnabled().catch(() => false))
  );
}

function travelersReportLivedElsewhereValue(payload: unknown): "0" | "1" {
  const raw = travelersPayloadFirstString(payload, [
    "personal.livedAtDifferentAddressPast6Months",
    "livedAtDifferentAddressPast6Months",
  ]);
  if (!raw) return "0";
  const n = raw.trim().toLowerCase();
  if (n === "yes" || n === "y" || n === "true" || n === "1") return "1";
  if (n === "no" || n === "n" || n === "false" || n === "0") return "0";
  return "0";
}

/** Report Information after Replacement Cost — click Continue ASAP; order reports only on No Hit. */
async function completeTravelersReplacementCostReportInformationModal(
  root: TravelersFormRoot,
  payload: unknown
): Promise<void> {
  await waitForTravelersReplacementCostReportModalFast(root);

  const livedElsewhere = travelersReportLivedElsewhereValue(payload);
  let radiosSet = false;
  let orderAttempted = false;
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (!(await isTravelersReportModalOpen(root))) return;

    if (await tryClickTravelersReportContinue(root)) {
      await waitForTravelersReportModalClosed(root, 10_000);
      return;
    }

    if (!radiosSet) {
      await ensureTravelersReportRadiosFast(root, livedElsewhere);
      radiosSet = true;
      continue;
    }

    if (!orderAttempted && (await isTravelersReportInformationNoHit(root))) {
      orderAttempted = true;
      await clickTravelersReportOrderReports(root);
      continue;
    }

    if (await isTravelersReportContinueEnabled(root)) {
      if (await tryClickTravelersReportContinue(root)) {
        await waitForTravelersReportModalClosed(root, 10_000);
        return;
      }
    }

    await new Promise<void>((r) => {
      setTimeout(r, 100);
    });
  }

  if (await tryClickTravelersReportContinue(root)) {
    await waitForTravelersReportModalClosed(root, 10_000);
    return;
  }

  if (await isTravelersReportModalOpen(root)) {
    throw new Error(
      "Travelers Replacement Cost Report Information modal did not close (Continue / Order Reports)."
    );
  }
}

async function runTravelersReportInformation(
  context: BrowserContext,
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_report_information_loading");
  const reportRoot = await waitForTravelersReportInformationModal(context, page, 120_000);

  const livedElsewhere = parseTravelersYesNoPayload(
    payload,
    ["personal.livedAtDifferentAddressPast6Months", "livedAtDifferentAddressPast6Months"],
    "livedAtDifferentAddressPast6Months"
  );

  updateStep("travelers_report_information_fill");
  await setTravelersOverlayRadioByDataLabel(
    reportRoot,
    "Have you lived at a different address in the past 6 months?",
    livedElsewhere
  );
  await setTravelersOverlayRadioByDataLabel(
    reportRoot,
    "I affirm that I have reviewed this information with the customer as required by law.",
    "1"
  );

  updateStep("travelers_report_information_continue");
  await clickTravelersReportInformationSubmit(reportRoot);

  await runTravelersHomeUnderwriting(context, page, payload, updateStep, jobId);
}

async function runTravelersHomeUnderwriting(
  context: BrowserContext,
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_home_underwriting_loading");
  const uwPage = await waitForTravelersHomeUnderwritingPage(context, page, 120_000);
  await uwPage.bringToFront().catch(() => undefined);
  const root: TravelersFormRoot = uwPage;

  updateStep("travelers_home_underwriting_fill");

  await setTravelersSmRadioByDataLabel(
    root,
    "Has your homeowners insurance been cancelled/declined/nonrenewed in the last 3 years?",
    parseTravelersUwYesNoPayload(
      payload,
      travelersPayloadKeyVariants("homeownersInsuranceCancelledDeclinedNonrenewedLast3Years"),
      "homeownersInsuranceCancelledDeclinedNonrenewedLast3Years"
    )
  );

  const vacant = parseTravelersUwYesNoPayload(
    payload,
    travelersPayloadKeyVariants("homeVacantOrUnoccupied"),
    "homeVacantOrUnoccupied"
  );
  await setTravelersSmRadioByDataLabel(root, "Is the home vacant or unoccupied?", vacant);
  if (vacant === "YES") {
    await setTravelersSmRadioByDataLabel(
      root,
      "Will it be occupied in the next 30 days?",
      parseTravelersUwYesNoPayload(
        payload,
        travelersPayloadKeyVariants("occupiedInNext30Days"),
        "occupiedInNext30Days"
      )
    );
  }

  const business = parseTravelersUwYesNoPayload(
    payload,
    travelersPayloadKeyVariants("businessConductedOnPremises"),
    "businessConductedOnPremises"
  );
  await setTravelersSmRadioByDataLabel(root, "Do you conduct any type of business on the premises?", business);
  if (business === "YES") {
    await setTravelersSmRadioByDataLabel(
      root,
      "Does the Business provide professional advice and/or opinions (e.g. financial, legal) or include academic tutor, music lessons, or graphic design?",
      parseTravelersUwYesNoPayload(
        payload,
        travelersPayloadKeyVariants("businessProvidesProfessionalAdviceOrOpinions"),
        "businessProvidesProfessionalAdviceOrOpinions"
      )
    );
    await setTravelersSmRadioByDataLabel(
      root,
      "Are there any employees other than residence relatives?",
      parseTravelersUwYesNoPayload(
        payload,
        travelersPayloadKeyVariants("businessHasEmployeesOtherThanResidenceRelatives"),
        "businessHasEmployeesOtherThanResidenceRelatives"
      )
    );
    await setTravelersSmRadioByDataLabel(
      root,
      "Do you have more than four client visits per week at your residence premises?",
      parseTravelersUwYesNoPayload(
        payload,
        travelersPayloadKeyVariants("businessMoreThanFourClientVisitsPerWeek"),
        "businessMoreThanFourClientVisitsPerWeek"
      )
    );
  }

  const rent = parseTravelersUwYesNoPayload(
    payload,
    travelersPayloadKeyVariants("homeAvailableForRentIncludingShortTermOrHomeSharing"),
    "homeAvailableForRentIncludingShortTermOrHomeSharing"
  );
  await setTravelersSmRadioByDataLabel(
    root,
    "Is your entire home or any part of it available for rent, including short-term vacation rental or home sharing/swapping?",
    rent
  );
  if (rent === "YES") {
    const portion = travelersPayloadFirstString(
      payload,
      travelersPayloadKeyVariants("portionOfHomeAvailableForRent")
    );
    const basis = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("basisHomeAvailableForRent"));
    if (!portion || !basis) {
      throw new Error(
        "Travelers Home Underwriting requires portionOfHomeAvailableForRent and basisHomeAvailableForRent when home is available for rent."
      );
    }
    await scrollTravelersHomeUnderwritingPage(root);
    await setTravelersSmSelectByDataLabel(root, "What portion of your home is available for rent?", portion);
    await setTravelersSmSelectByDataLabel(root, "On what basis is your home available for rent?", basis);
  }

  const floodZone = parseTravelersUwYesNoPayload(
    payload,
    travelersPayloadKeyVariants("homeInDesignatedHighRiskFloodZone"),
    "homeInDesignatedHighRiskFloodZone"
  );
  await setTravelersSmRadioByDataLabel(
    root,
    "Is the home located in a designated high risk flood zone?",
    floodZone
  );
  if (floodZone === "YES") {
    await setTravelersSmRadioByDataLabel(
      root,
      "Do you have a flood policy?",
      parseTravelersUwYesNoPayload(
        payload,
        travelersPayloadKeyVariants("hasFloodPolicy"),
        "hasFloodPolicy"
      )
    );
  }

  await setTravelersSmRadioByDataLabel(
    root,
    "Do you or any household member have any pets or animals that have bitten or injured anyone?",
    parseTravelersUwYesNoPayload(
      payload,
      travelersPayloadKeyVariants("petsOrAnimalsBittenOrInjuredAnyone"),
      "petsOrAnimalsBittenOrInjuredAnyone"
    )
  );

  await setTravelersSmRadioByDataLabel(
    root,
    "Do you or any household member own one or more of the following breeds or a mix of one of these breeds of dogs?",
    parseTravelersUwYesNoPayload(
      payload,
      travelersPayloadKeyVariants("ownsRestrictedDogBreedsOrMix"),
      "ownsRestrictedDogBreedsOrMix"
    )
  );

  await scrollTravelersHomeUnderwritingPage(root);
  const insuranceStatusRaw = travelersPayloadFirstString(payload, [
    ...travelersPayloadKeyVariants("insuranceStatus"),
    "insuranceDetails.insuranceStatus",
  ]);
  if (!insuranceStatusRaw) {
    throw new Error("Travelers Home Underwriting requires insuranceStatus in payload.");
  }
  await setTravelersInsuranceStatus(root, insuranceStatusRaw);

  await scrollTravelersHomeUnderwritingPage(root);
  const burglarRaw = travelersPayloadFirstString(payload, travelersPayloadKeyVariants("burglarAlarm"));
  if (!burglarRaw) {
    throw new Error("Travelers Home Underwriting requires burglarAlarm in payload.");
  }
  await setTravelersSmBurglarAlarm(root, mapTravelersBurglarAlarmValue(burglarRaw));


  updateStep("travelers_home_underwriting_continue");
  await clickTravelersPortfolioContinue(root, uwPage);

  await uwPage
    .locator("#loaderContainer")
    .waitFor({ state: "hidden", timeout: 120_000 })
    .catch(() => undefined);

  await runTravelersResidenceAdditionalLocation(context, uwPage, payload, updateStep, jobId);
}

async function runTravelersAboutPolicy(
  context: BrowserContext,
  page: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  updateStep("travelers_about_policy_loading");
  await page.bringToFront().catch(() => undefined);
  await waitForTravelersAboutPolicyPage(page, 120_000);

  updateStep("travelers_about_policy_fill");
  await selectTravelersFirstAgentCode(page);
  await checkTravelersCompanionHomeowner(page);

  updateStep("travelers_about_policy_continue");
  await clickTravelersPortfolioContinue(page, page);

  await runTravelersReportInformation(context, page, payload, updateStep, jobId);
}

async function fillTravelersPiTextInput(page: Page, selector: string, value: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 30_000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click();
  await loc.press("Control+A").catch(() => undefined);
  await loc.press("Backspace").catch(() => undefined);
  await loc.pressSequentially(value, { delay: 35 });
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
  await loc.press("Tab").catch(() => undefined);
}

async function assertTravelersPiInputValue(page: Page, selector: string, expected: string, label: string): Promise<void> {
  const loc = page.locator(selector).first();
  const actual = (await loc.inputValue().catch(() => "")).trim();
  if (actual === expected.trim()) return;
  await fillTravelersPiTextInput(page, selector, expected);
  const retry = (await loc.inputValue().catch(() => "")).trim();
  if (retry !== expected.trim()) {
    throw new Error(
      `Travelers PI field "${label}" (${selector}) did not retain value. expected="${expected}" actual="${retry}"`
    );
  }
}

/** PI notification drawer (Alerts/Reports) can open over the page and block the legacy iframe. */
async function dismissTravelersNotificationDrawer(page: Page): Promise<void> {
  const closeSelectors = [
    ".drawer-panel button.close",
    ".drawer-header button.close",
    ".drawer-close",
    "button.drawer-close",
    '[aria-label="Close"]',
    '[aria-label="close"]',
    '[title="Close"]',
    ".notification-drawer .close",
  ];
  for (const sel of closeSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
      return;
    }
  }

  const activeDrawerIcon = page.locator("#PiAlerts-header.active, .drawer-icon.active").first();
  if (await activeDrawerIcon.isVisible().catch(() => false)) {
    await activeDrawerIcon.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(200);
}

async function throwIfTravelersPiSearchError(page: Page): Promise<void> {
  const err = page.getByText(/There was an error processing your request/i).first();
  if (!(await err.isVisible().catch(() => false))) return;
  const last = await page.locator("#lastName").inputValue().catch(() => "");
  const first = await page.locator("#firstName").inputValue().catch(() => "");
  throw new Error(
    `Travelers PI customer search error banner shown. lastName="${last}" firstName="${first}" url=${page.url()}`
  );
}

async function waitForTravelersFieldEnabled(
  root: Frame,
  selector: string,
  timeoutMs: number
): Promise<void> {
  const loc = root.locator(selector).first();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await loc.isEnabled().catch(() => false)) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 120);
    });
  }
  throw new Error(`Travelers field did not become enabled in time: ${selector}`);
}

/** After PI Search, Customer Selection loads in an iframe (~10–15s). Wait until it is visible. */
async function waitForTravelersCustomerSelectionFrame(context: BrowserContext, timeoutMs: number): Promise<Frame> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const p of context.pages()) {
      for (const frame of p.frames()) {
        try {
          const hasForm = (await frame.locator('form#frmSearch, form[name="frmSearch"]').count()) > 0;
          if (!hasForm) continue;

          const title = frame.locator("#lblTitle").first();
          const txtName = frame.locator("input#txtName").first();
          const btnSearch = frame.locator("input#btnSearch").first();

          const titleOk = (await title.count()) > 0 && (await title.isVisible().catch(() => false));
          const nameOk = (await txtName.count()) > 0 && (await txtName.isVisible().catch(() => false));
          const searchOk = (await btnSearch.count()) > 0 && (await btnSearch.isVisible().catch(() => false));

          if ((titleOk || nameOk) && searchOk) {
            return frame;
          }
        } catch {
          /* frame may detach while loading */
        }
      }
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error(
    "Travelers Customer Selection screen (frmSearch with visible Search) did not load in time after PI Search."
  );
}

async function clickTravelersLegacyInputButton(root: Frame, selector: string): Promise<void> {
  const btn = root.locator(selector).first();
  await btn.waitFor({ state: "attached", timeout: 15_000 });
  await btn.click({ force: true }).catch(async () => {
    await btn.evaluate((el: HTMLInputElement) => el.click());
  });
}

/**
 * Add Customer: Street uses address autocomplete. Initiate Quote stays disabled until
 * the site accepts a validated address (usually pick a suggestion, not free text).
 */
async function fillTravelersAddCustomerStreetOnly(
  frame: Frame,
  loc: Locator,
  value: string
): Promise<void> {
  const street = value.trim();
  if (!street) throw new Error("Travelers street value is empty.");

  await loc.waitFor({ state: "visible", timeout: 30_000 });
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click({ timeout: 10_000 });
  await loc.press("Control+A").catch(() => undefined);
  await loc.press("Backspace").catch(() => undefined);
  await loc.pressSequentially(street, { delay: 45 });
  await loc.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("keyup", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    const onkeyup = (el as HTMLInputElement & { onkeyup?: (ev: Event) => void }).onkeyup;
    if (typeof onkeyup === "function") {
      try {
        onkeyup.call(el, new Event("keyup", { bubbles: true }));
      } catch {
        /* legacy handler */
      }
    }
  }, street);

  const token = street.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, Math.min(12, street.length));
  const suggestionDeadline = Date.now() + 10_000;
  let pickedSuggestion = false;
  while (Date.now() < suggestionDeadline && !pickedSuggestion) {
    pickedSuggestion = await clickTravelersStreetAutocompleteSuggestion(frame, token);
    if (!pickedSuggestion) {
      await new Promise<void>((r) => {
        setTimeout(r, 250);
      });
    }
  }

  if (!pickedSuggestion) {
    await loc.press("ArrowDown").catch(() => undefined);
    await loc.press("Enter");
  }

  await loc.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  });

  const entered = (await loc.inputValue().catch(() => "")).trim();
  if (!entered) {
    throw new Error("Travelers Street field is empty after entry — autocomplete may not have committed.");
  }
}

async function clickTravelersStreetAutocompleteSuggestion(frame: Frame, token: string): Promise<boolean> {
  if (!token) return false;
  const re = new RegExp(token.slice(0, Math.max(3, Math.min(token.length, 8))), "i");
  const lists = [
    frame.locator('[id*="Street" i][id*="list" i], [id*="street" i][id*="List" i]').locator("tr, li, td, div, span"),
    frame.locator('[id*="AutoComplete" i], [class*="AutoComplete" i], [id*="autocomplete" i]').locator("tr, li, td, div"),
    frame.locator("table").filter({ has: frame.locator("tr") }).locator("tr"),
    frame.getByRole("option"),
    frame.locator("div").filter({ hasText: re }),
  ];
  for (const list of lists) {
    const item = list.filter({ hasText: re }).first();
    if ((await item.count()) === 0) continue;
    if (!(await item.isVisible().catch(() => false))) continue;
    await item.click({ timeout: 3_000 }).catch(() => undefined);
    return true;
  }
  return false;
}

type TravelersInitiateQuoteHit = { frame: Frame; selector: string; enabled: boolean; label: string };

const TRAVELERS_INITIATE_QUOTE_SELECTORS = [
  "input#btnInitiateQuote",
  'input[name="btnInitiateQuote"]',
  "input#btnInitQuote",
  'input[name="btnInitQuote"]',
  'input[id*="Initiate" i][type="image"]',
  'input[id*="Initiate" i]',
  'input[name*="Initiate" i]',
  'input[alt*="Initiate Quote" i]',
  'input[title*="Initiate Quote" i]',
  'a#ttInitiateQuote input',
  'a[title*="Initiate Quote" i] input',
];

function collectTravelersFrames(context: BrowserContext, preferredFrame: Frame): Frame[] {
  const frames: Frame[] = [];
  const add = (f: Frame | null) => {
    if (f && !frames.includes(f)) frames.push(f);
  };
  add(preferredFrame);
  let parent = preferredFrame.parentFrame();
  while (parent) {
    add(parent);
    parent = parent.parentFrame();
  }
  for (const child of preferredFrame.childFrames()) add(child);
  for (const p of context.pages()) {
    for (const f of p.frames()) add(f);
  }
  return frames;
}

async function scrollTravelersFramesForActionButtons(frames: Frame[]): Promise<void> {
  for (const frame of frames) {
    await frame
      .evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        const form = document.querySelector("form");
        if (form) form.scrollTop = form.scrollHeight;
      })
      .catch(() => undefined);
  }
}

function isTravelersLegacyInputEnabled(el: HTMLInputElement | null): boolean {
  if (!el) return false;
  if (el.disabled) return false;
  if (el.getAttribute("disabled") != null) return false;
  const aria = el.getAttribute("aria-disabled");
  if (aria === "true") return false;
  const cls = el.className ?? "";
  if (/\bdisabled\b/i.test(cls)) return false;
  return true;
}

async function scanFrameForInitiateQuoteControl(frame: Frame): Promise<TravelersInitiateQuoteHit | null> {
  const scanned = await frame
    .evaluate(() => {
      const matches: { selector: string; enabled: boolean; label: string }[] = [];
      const describe = (el: Element) =>
        [el.id, el.getAttribute("name"), el.getAttribute("alt"), el.getAttribute("title"), (el as HTMLInputElement).value]
          .filter(Boolean)
          .join(" ");

      for (const el of document.querySelectorAll("input, button")) {
        if (!/initiate\s*quote/i.test(describe(el))) continue;
        const input = el as HTMLInputElement;
        const selector = input.id
          ? `input#${CSS.escape(input.id)}`
          : input.name
            ? `input[name="${input.name.replace(/"/g, '\\"')}"]`
            : "";
        if (!selector) continue;
        matches.push({
          selector,
          enabled: !input.disabled && input.getAttribute("disabled") == null,
          label: describe(el),
        });
      }

      for (const a of document.querySelectorAll('a[title*="Initiate" i], a#ttInitiateQuote')) {
        const input = a.querySelector("input");
        if (!input) continue;
        const selector = input.id
          ? `input#${CSS.escape(input.id)}`
          : 'a[title*="Initiate Quote" i] input';
        matches.push({
          selector,
          enabled: !input.disabled && input.getAttribute("disabled") == null,
          label: describe(a),
        });
      }

      return matches[0] ?? null;
    })
    .catch(() => null);

  if (!scanned) return null;
  const btn = frame.locator(scanned.selector).first();
  if ((await btn.count()) === 0) return null;
  const enabled = await btn
    .evaluate((el: HTMLInputElement) => isTravelersLegacyInputEnabled(el))
    .catch(() => scanned.enabled);
  return { frame, selector: scanned.selector, enabled, label: scanned.label };
}

async function findTravelersInitiateQuoteControl(
  context: BrowserContext,
  preferredFrame: Frame,
  requireEnabled: boolean
): Promise<TravelersInitiateQuoteHit | null> {
  const frames = collectTravelersFrames(context, preferredFrame);
  await scrollTravelersFramesForActionButtons(frames);

  for (const frame of frames) {
    for (const sel of TRAVELERS_INITIATE_QUOTE_SELECTORS) {
      const btn = frame.locator(sel).first();
      if ((await btn.count()) === 0) continue;
      const enabled = await btn
        .evaluate((el: HTMLInputElement) => isTravelersLegacyInputEnabled(el))
        .catch(() => false);
      if (!requireEnabled || enabled) {
        return { frame, selector: sel, enabled, label: sel };
      }
    }

    const roleBtn = frame.getByRole("button", { name: /initiate\s*quote/i }).first();
    if ((await roleBtn.count()) > 0) {
      const enabled = await roleBtn.isEnabled().catch(() => false);
      if (!requireEnabled || enabled) {
        return { frame, selector: "role=button[name=/initiate quote/i]", enabled, label: "role button" };
      }
    }

    const scanned = await scanFrameForInitiateQuoteControl(frame);
    if (scanned && (!requireEnabled || scanned.enabled)) return scanned;
  }
  return null;
}

async function buildTravelersInitiateQuoteDebug(
  context: BrowserContext,
  preferredFrame: Frame
): Promise<string> {
  const frames = collectTravelersFrames(context, preferredFrame);
  const parts: string[] = [];
  for (const frame of frames) {
    const url = frame.url().slice(0, 80);
    const scanned = await scanFrameForInitiateQuoteControl(frame);
    if (scanned) {
      parts.push(`${url} → ${scanned.label} enabled=${scanned.enabled}`);
      continue;
    }
    const anyInitiate = await frame
      .evaluate(() => {
        const hits: string[] = [];
        for (const el of document.querySelectorAll("input, button, a")) {
          const text = [el.id, el.getAttribute("name"), el.getAttribute("title"), el.getAttribute("alt")]
            .filter(Boolean)
            .join(" ");
          if (/initiate/i.test(text)) hits.push(text.slice(0, 60));
        }
        return hits.slice(0, 5).join("; ");
      })
      .catch(() => "");
    parts.push(`${url} → ${anyInitiate || "no initiate control"}`);
  }
  return parts.join(" | ");
}

/** Add Customer screen loads in legacy iframe after btnAddCust. */
async function waitForTravelersAddCustomerFrame(context: BrowserContext, timeoutMs: number): Promise<Frame> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const p of context.pages()) {
      for (const frame of p.frames()) {
        try {
          const onAddCustomer =
            (await frame.getByText(/Add Customer/i).first().isVisible().catch(() => false)) ||
            (await frame.locator('#lblTitle:has-text("Add Customer")').first().isVisible().catch(() => false));
          const street = await resolveTravelersStreetLocator(frame);
          if (onAddCustomer && (await street.count()) > 0 && (await street.isVisible().catch(() => false))) {
            return frame;
          }
        } catch {
          /* frame may detach */
        }
      }
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error("Travelers Add Customer form did not load in time.");
}

async function resolveTravelersStreetLocator(root: Frame): Promise<Locator> {
  const preferred = [
    "input#txtStreet",
    'input[name="txtStreet"]',
    "input#txtStreetAddr",
    'input[name="txtStreetAddr"]',
  ];
  for (const sel of preferred) {
    const loc = root.locator(sel).first();
    if ((await loc.count()) > 0) return loc;
  }
  const byLabel = root.getByLabel(/^Street\s*\*?$/i).first();
  if ((await byLabel.count()) > 0) return byLabel;
  return root.locator("td.clsLabel").filter({ hasText: /^Street\s*\*?$/i }).locator("xpath=following::input[1]").first();
}

async function clickTravelersInitiateQuote(
  context: BrowserContext,
  addCustomerFrame: Frame,
  streetLoc: Locator,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastPresent: TravelersInitiateQuoteHit | null = null;

  while (Date.now() < deadline) {
    const present = await findTravelersInitiateQuoteControl(context, addCustomerFrame, false);
    if (present) lastPresent = present;

    const enabled = await findTravelersInitiateQuoteControl(context, addCustomerFrame, true);
    if (enabled) {
      if (enabled.selector.startsWith("role=")) {
        await enabled.frame.getByRole("button", { name: /initiate\s*quote/i }).first().click({ force: true });
      } else {
        const btn = enabled.frame.locator(enabled.selector).first();
        await btn.scrollIntoViewIfNeeded().catch(() => undefined);
        await clickTravelersLegacyInputButton(enabled.frame, enabled.selector);
      }
      return;
    }

    await streetLoc.click().catch(() => undefined);
    await streetLoc.press("ArrowDown").catch(() => undefined);
    await streetLoc.press("Enter").catch(() => undefined);
    await scrollTravelersFramesForActionButtons(collectTravelersFrames(context, addCustomerFrame));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 350);
    });
  }

  const streetVal = await streetLoc.inputValue().catch(() => "");
  const frameScan = await buildTravelersInitiateQuoteDebug(context, addCustomerFrame);

  if (!lastPresent) {
    throw new Error(
      `Travelers Initiate Quote control was not found in any frame after street was entered. ` +
        `street="${streetVal}". Scanned: ${frameScan}`
    );
  }

  throw new Error(
    `Travelers Initiate Quote control found but stayed disabled. ` +
      `street="${streetVal}" control="${lastPresent.label}" enabled=${lastPresent.enabled}. ` +
      `Pick a Street autocomplete suggestion. Scanned: ${frameScan}`
  );
}

async function pollForTravelersPlagtPopup(
  context: BrowserContext,
  pagesBefore: Set<Page>,
  timeoutMs: number
): Promise<Page> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const p of context.pages()) {
      if (pagesBefore.has(p)) continue;
      if (!/plagt\.travelers\.com/i.test(p.url())) continue;
      await p.bringToFront();
      return p;
    }
    for (const p of context.pages()) {
      if (!/plagt\.travelers\.com/i.test(p.url())) continue;
      await p.bringToFront();
      return p;
    }
    await new Promise<void>((r) => {
      setTimeout(r, 400);
    });
  }
  throw new Error(
    `Travelers plagt popup not found. URLs: ${context.pages().map((p) => p.url()).join(" | ")}`
  );
}

/** PQS Router.aspx (Initiate Quote) — form lives here, not on ENTESERV shell URL. */
async function waitForTravelersPqsRouterRoot(popup: Page, timeoutMs: number): Promise<TravelersFormRoot> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await popup.bringToFront().catch(() => undefined);

    const pageForm = popup.locator('form[action*="Router.aspx"] #LineOfBusinessValue').first();
    if (await pageForm.isVisible().catch(() => false)) {
      return popup;
    }

    for (const frame of popup.frames()) {
      if (!/Router\.aspx/i.test(frame.url())) continue;
      const lob = frame.locator("#LineOfBusinessValue").first();
      if (await lob.isVisible().catch(() => false)) {
        return frame;
      }
    }

    for (const frame of popup.frames()) {
      const lob = frame.locator("#FormContainer #LineOfBusinessValue, #LineOfBusinessValue").first();
      if (await lob.isVisible().catch(() => false)) {
        return frame;
      }
    }

    await new Promise<void>((r) => {
      setTimeout(r, 500);
    });
  }

  const frameUrls = popup.frames().map((f) => f.url()).join(" | ");
  throw new Error(
    `PQS Router form not found. Popup=${popup.url()} frames=${frameUrls || "(none)"}`
  );
}

async function clickInitiateQuoteAndWaitForNewWindow(
  context: BrowserContext,
  _hostPage: Page,
  addCustomerFrame: Frame,
  streetLoc: Locator,
  timeoutMs: number
): Promise<Page> {
  const pagesBefore = new Set(context.pages());
  await clickTravelersInitiateQuote(context, addCustomerFrame, streetLoc, 60_000);
  const popup = await pollForTravelersPlagtPopup(context, pagesBefore, timeoutMs);
  await popup.bringToFront();
  await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
  return popup;
}

async function fillTravelersPqsRouterForm(root: TravelersFormRoot, effectiveDate: string): Promise<void> {
  await root.locator("#LineOfBusinessValue").first().waitFor({ state: "visible", timeout: 90_000 });
  await root
    .locator("#EffectiveDate")
    .first()
    .waitFor({ state: "visible", timeout: 90_000 });

  const filled = await root.evaluate((effDate: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const $ = w.jQuery;
    if (!$) return { ok: false, reason: "jQuery not loaded" };

    const $lob = $("#LineOfBusinessValue");
    const $eff = $("#EffectiveDate");
    const $lobText = $("#LineOfBusinessText");
    if ($lob.length === 0 || $eff.length === 0) {
      return { ok: false, reason: "Router controls missing" };
    }

    const homeOpt = $lob.find("option").filter(function (this: HTMLElement) {
      return $(this).text().trim() === "HOME";
    });
    if (homeOpt.length === 0) {
      return { ok: false, reason: "HOME option missing" };
    }
    $lob.val(String(homeOpt.first().val()));
    $lobText.val("HOME");
    $lob.trigger("change");

    $eff.val(effDate).trigger("input").trigger("change").trigger("blur");

    if (w.routerJs) {
      if (typeof w.routerJs.OnLineOfBusinessChange === "function") {
        w.routerJs.OnLineOfBusinessChange();
      }
      if (typeof w.routerJs.EnableContinueButton === "function") {
        w.routerJs.EnableContinueButton();
      }
    }

    const $form = $lob.closest("form");
    if ($form.length && typeof $form.valid === "function") {
      $form.valid();
    }

    const lobOk = $lob.find("option:selected").text().trim() === "HOME";
    const dateOk = String($eff.val()) === effDate;
    return { ok: lobOk && dateOk, reason: lobOk && dateOk ? "ok" : `lob=${$lob.find("option:selected").text()} date=${$eff.val()}` };
  }, effectiveDate);

  if (!filled.ok) {
    const lob = root.locator("#LineOfBusinessValue").first();
    await lob.click();
    await lob.selectOption({ label: "HOME" });
    await root.locator("#LineOfBusinessText").evaluate((el: HTMLInputElement) => {
      el.value = "HOME";
    });
    const eff = root.locator("#EffectiveDate").first();
    await eff.click();
    await eff.fill(effectiveDate);
    await eff.press("Enter").catch(() => undefined);
    await eff.press("Tab").catch(() => undefined);

    const lobText = (await lob.locator("option:checked").textContent().catch(() => ""))?.trim() ?? "";
    const dateVal = await eff.inputValue().catch(() => "");
    if (!/^HOME$/i.test(lobText) || dateVal !== effectiveDate) {
      throw new Error(
        `PQS Router fill failed (${filled.reason}). lob="${lobText}" date="${dateVal}" expected="${effectiveDate}"`
      );
    }
  }
}

async function clickTravelersPqsRouterContinue(root: TravelersFormRoot, timeoutMs: number): Promise<void> {
  const btn = root.locator("#btnSubmit").first();
  await btn.waitFor({ state: "visible", timeout: 30_000 });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const enabled = await root.evaluate(() => {
      const el = document.querySelector("#btnSubmit") as HTMLInputElement | null;
      return !!el && !el.disabled;
    });
    if (enabled) {
      await btn.click({ timeout: 15_000 }).catch(async () => {
        await btn.evaluate((el: HTMLInputElement) => el.click());
      });
      return;
    }
    await root
      .evaluate(() => {
        const w = window as unknown as { jQuery?: (s: string) => { trigger: (e: string) => unknown } };
        w.jQuery?.("#LineOfBusinessValue").trigger("change");
        w.jQuery?.("#EffectiveDate").trigger("change");
      })
      .catch(() => undefined);
    await new Promise<void>((r) => {
      setTimeout(r, 300);
    });
  }
  throw new Error("PQS Router Continue (#btnSubmit) did not enable after HOME and effective date.");
}

async function runTravelersInitiateQuoteRouting(
  context: BrowserContext,
  quotePage: Page,
  payload: unknown,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  await quotePage.bringToFront();

  const effectiveDate = formatTravelersEffectiveDateMmDdYyyy(
    travelersPayloadFirstString(payload, [
      "insuranceDetails.effectiveDate",
      "personal.effectiveDate",
      "effectiveDate",
    ])
  );

  const routerRoot = await waitForTravelersPqsRouterRoot(quotePage, 90_000);
  const routerFrameUrl =
    routerRoot === quotePage
      ? quotePage.url()
      : (routerRoot as Frame).url();
  updateStep(`travelers_pqs_router:${routerFrameUrl.slice(0, 80)}`);

  updateStep("travelers_initiate_quote_fill");
  await fillTravelersPqsRouterForm(routerRoot, effectiveDate);

  updateStep("travelers_initiate_quote_continue");
  await clickTravelersPqsRouterContinue(routerRoot, 90_000);

  await runTravelersAccountDetails(context, quotePage, payload, updateStep, jobId);
}

async function runTravelersCustomerSearchAfterVerify(
  page: Page,
  payload: unknown,
  flowTimeoutMs: number,
  updateStep: (s: string) => void,
  jobId?: string
): Promise<void> {
  const lastName = travelersPayloadFirstString(payload, [
    "personal.lastName",
    "personal.ownerLastName",
    "lastName",
    "ownerLastName",
  ]);
  const firstName = travelersPayloadFirstString(payload, [
    "personal.firstName",
    "personal.ownerFirstName",
    "firstName",
    "ownerFirstName",
  ]);
  const stateCode = travelersTrimmedString(
    getTravelersPayloadValue(payload, "personal.state") ??
      getTravelersPayloadValue(payload, "state") ??
      getTravelersPayloadValue(payload, "stateCode")
  );
  const city = travelersTrimmedString(
    getTravelersPayloadValue(payload, "personal.city") ?? getTravelersPayloadValue(payload, "city")
  );
  const zipRaw = travelersTrimmedString(
    getTravelersPayloadValue(payload, "personal.zipCode") ??
      getTravelersPayloadValue(payload, "zipCode") ??
      getTravelersPayloadValue(payload, "zip")
  );
  const policyNumber = travelersTrimmedString(
    getTravelersPayloadValue(payload, "policyNumber") ?? getTravelersPayloadValue(payload, "insuranceDetails.policyNumber")
  );
  const absNumber = travelersTrimmedString(getTravelersPayloadValue(payload, "absNumber"));
  const ccfNumber = travelersTrimmedString(getTravelersPayloadValue(payload, "ccfNumber"));
  const ddOverride = travelersTrimmedString(getTravelersPayloadValue(payload, "accountSearchCriteria"));
  const ddCriteria: "01" | "02" | "04" | "05" =
    ddOverride === "01" || ddOverride === "02" || ddOverride === "04" || ddOverride === "05" ? ddOverride : "01";

  updateStep("travelers_customer_search_main");
  await page.locator("#customer-search-form, form#customer-search-form").first().waitFor({
    state: "visible",
    timeout: flowTimeoutMs,
  });
  await page.locator("#search-by-name").waitFor({ state: "visible", timeout: 30_000 });

  if (!lastName) {
    throw new Error(
      "Travelers name search requires lastName in payload (e.g. personal.lastName or lastName in fields array)."
    );
  }

  // Do not change "Search By" (#searchType). Fill state/location first — changing state can clear name fields on this form.
  if (stateCode) await page.selectOption("#stateCode", { value: stateCode });
  if (city) await fillTravelersPiTextInput(page, "#city", city);
  if (zipRaw) await fillTravelersPiTextInput(page, "#zip", zipRaw);

  await assertTravelersPiInputValue(page, "#lastName", lastName, "lastName");
  if (firstName) await assertTravelersPiInputValue(page, "#firstName", firstName, "firstName");

  await dismissTravelersNotificationDrawer(page);

  const ctx = page.context();
  updateStep("travelers_pi_search_click");
  await page.locator("#search-button-name").click();

  updateStep("travelers_dismiss_notification_drawer");
  await dismissTravelersNotificationDrawer(page);
  await throwIfTravelersPiSearchError(page);

  updateStep("travelers_customer_selection_loading");
  const legacyLoadTimeoutMs = Math.max(flowTimeoutMs, 120_000);
  const frame = await waitForTravelersCustomerSelectionFrame(ctx, legacyLoadTimeoutMs);
  const root = frame;

  updateStep("travelers_account_search_legacy");
  await root.locator("select#ddCriteria").waitFor({ state: "visible", timeout: 30_000 });
  await root.locator("select#ddCriteria").selectOption(ddCriteria);

  if (ddCriteria === "01") {
    if (lastName) await root.locator("input#txtName").fill(lastName);
    if (firstName) await root.locator("input#txtFstName").fill(firstName);
    if (stateCode) await root.locator("select#ddState").selectOption({ value: stateCode });
    if (city) await root.locator("input#txtCityName").fill(city);
    if (zipRaw) {
      const { base, ext } = splitTravelersZip(zipRaw);
      if (base) await root.locator("input#txtZipCode").fill(base);
      if (ext) await root.locator("input#txtZipExt").fill(ext);
    }
  } else if (ddCriteria === "02") {
    await waitForTravelersFieldEnabled(root, "input#txtPolicy", 20_000);
    if (policyNumber) await root.locator("input#txtPolicy").fill(policyNumber);
  } else if (ddCriteria === "04") {
    await waitForTravelersFieldEnabled(root, "input#txtCCF", 20_000);
    if (ccfNumber) await root.locator("input#txtCCF").fill(ccfNumber);
  } else if (ddCriteria === "05") {
    await waitForTravelersFieldEnabled(root, "input#txtABS", 20_000);
    if (absNumber) await root.locator("input#txtABS").fill(absNumber);
  }

  updateStep("travelers_legacy_search_click");
  await clickTravelersLegacyInputButton(root, "input#btnSearch");

  updateStep("travelers_legacy_search_results");
  const addCustBtn = root.locator('input#btnAddCust, input[name="btnAddCust"]').first();
  await addCustBtn
    .waitFor({ state: "visible", timeout: legacyLoadTimeoutMs })
    .catch(() => addCustBtn.waitFor({ state: "attached", timeout: 30_000 }));

  updateStep("travelers_add_customer_click");
  await clickTravelersLegacyInputButton(root, 'input#btnAddCust, input[name="btnAddCust"]');

  const street = travelersPayloadFirstString(payload, [
    "personal.address",
    "personal.streetAddress",
    "streetAddress",
    "address",
    "street",
  ]);
  if (!street) {
    throw new Error(
      "Travelers Add Customer requires street in payload (e.g. personal.address from Street Address field)."
    );
  }

  updateStep("travelers_add_customer_fill_street");
  const addCustomerRoot = await waitForTravelersAddCustomerFrame(ctx, legacyLoadTimeoutMs);
  const streetLoc = await resolveTravelersStreetLocator(addCustomerRoot);
  await fillTravelersAddCustomerStreetOnly(addCustomerRoot, streetLoc, street);

  updateStep("travelers_initiate_quote_click");
  const quotePage = await clickInitiateQuoteAndWaitForNewWindow(
    ctx,
    page,
    addCustomerRoot,
    streetLoc,
    legacyLoadTimeoutMs
  );

  updateStep("travelers_initiate_quote_routing");
  await runTravelersInitiateQuoteRouting(ctx, quotePage, payload, updateStep, jobId);

  updateStep("travelers_flow_complete");
}

/**
 * Travelers Okta sign-in + email MFA.
 * Order: login → Send Code → poll webhook on same flow for fresh OTP → enter code → Verify.
 * Login URL: TRAVELERS_LOGIN_URL
 */
export async function runTravelersPlaywright(
  input: PlaywrightTravelerRunRequest,
  opts?: { jobId?: string }
): Promise<Record<string, never>> {
  const jobId = opts?.jobId;

  if (travelersShouldStopForPayloadDebug()) {
    travelersLogPayloadForDebug(input.payload);
    console.log(
      "[Travelers] Payload debug only — browser automation skipped. Unset TRAVELERS_DEBUG_PAYLOAD to run the full flow."
    );
    return {};
  }

  const loginUrl = String(process.env.TRAVELERS_LOGIN_URL ?? "").trim();
  if (!loginUrl) {
    throw new Error("TRAVELERS_LOGIN_URL is required for Travelers automation.");
  }
  if (/aoins\.com/i.test(loginUrl)) {
    throw new Error(
      "TRAVELERS_LOGIN_URL points to Auto-Owners (aoins.com). Set it to the Travelers / Okta sign-in URL only."
    );
  }

  const headless = input.options?.headless ?? false;
  const slowMo = input.options?.slowMoMs ?? 80;
  const timeoutMs = input.options?.timeoutMs ?? 90_000;

  const { username, password } = input.credentials;
  const { webhookUrl } = input;

  const browser = await chromium.launch({
    headless,
    slowMo,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  let page: Page | undefined;

  try {
    const context = await browser.newContext({
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    const updateStep = (step: string): void => {
      if (jobId) playwrightTravelerJobStore.update(jobId, { step });
    };

    updateStep("travelers_navigate_login");
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    updateStep("travelers_fill_username_password");
    await page.locator("#okta-signin-username").waitFor({ state: "visible", timeout: timeoutMs });
    await page.locator("#okta-signin-username").fill(username);
    await page.locator("#okta-signin-password").fill(password);

    updateStep("travelers_click_sign_in");
    // Primary: custom element from Travelers HTML (shadow root may host inner button)
    const signInHost = page.locator("tds-button#signin").first();
    if (await signInHost.isVisible().catch(() => false)) {
      await signInHost.click({ force: true }).catch(() => undefined);
      await page.locator("tds-button#signin").evaluate((el: HTMLElement) => el.click()).catch(() => undefined);
    } else {
      await page.locator("#signin").click({ force: true }).catch(() => undefined);
    }
    await page.waitForTimeout(800);

    updateStep("travelers_mfa_send_code");
    const sendCode = page.locator('input[type="submit"][value="Send Code"]').first();
    await sendCode.waitFor({ state: "visible", timeout: timeoutMs });
    await sendCode.scrollIntoViewIfNeeded().catch(() => undefined);
    await sendCode.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(1000);

    // After Send Code, stay on MFA page and poll webhook until a valid (fresh) OTP arrives.
    updateStep("travelers_poll_webhook_otp");
    const otp = await pollTravelersWebhookOtp(webhookUrl);

    updateStep("travelers_mfa_enter_otp");
    const codeInput = page.locator('input#input10[name="answer"], input#input10, input[name="answer"]').first();
    await codeInput.waitFor({ state: "visible", timeout: timeoutMs });
    await codeInput.fill(otp);
    await page.waitForTimeout(200);

    updateStep("travelers_mfa_verify");
    const verifyBtn = page.locator('input[type="submit"][value="Verify"]').first();
    await verifyBtn.waitFor({ state: "visible", timeout: timeoutMs });
    await verifyBtn.click({ force: true }).catch(() => undefined);

    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(400).catch(() => undefined);

    const customerFlowTimeoutMs = Math.max(timeoutMs, 120_000);
    await runTravelersCustomerSearchAfterVerify(page, input.payload, customerFlowTimeoutMs, updateStep, jobId);

    updateStep("travelers_post_login");

    await context.close();
    return {};
  } catch (err) {
    throw err;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
