/** CHUBB payload helpers (same resolution pattern as Travelers / Auto-Owners). */

import {
  CHUBB_DEFAULT_PRODUCER_CODE,
  CHUBB_DEFAULT_SUB_PRODUCER_CODE,
} from "./playwrightChubb.constants";

type ChubbPayloadKV = { key?: unknown; value?: unknown };

function chubbHasMeaningfulPayloadValue(v: unknown): boolean {
  return chubbTrimmedString(v) !== undefined;
}

export function chubbPayloadFieldEntries(payload: unknown): ChubbPayloadKV[] {
  if (!payload || typeof payload !== "object") return [];

  const out: ChubbPayloadKV[] = [];
  const pushEntries = (raw: unknown): void => {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item === "object" && "key" in (item as Record<string, unknown>)) {
          out.push(item as ChubbPayloadKV);
        }
      }
      return;
    }
    if (raw && typeof raw === "object") {
      for (const value of Object.values(raw as Record<string, unknown>)) {
        if (value && typeof value === "object" && "key" in (value as Record<string, unknown>)) {
          out.push(value as ChubbPayloadKV);
        }
      }
    }
  };

  if (Array.isArray(payload)) {
    pushEntries(payload);
    return out;
  }

  const obj = payload as Record<string, unknown>;
  pushEntries(obj.fields);
  if (Object.prototype.hasOwnProperty.call(obj, "fields")) return out;

  pushEntries(payload);
  return out;
}

function chubbLooksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function chubbIsCustomerEmailKey(key: string): boolean {
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

export function getChubbPayloadValue(payload: unknown, key: string): unknown {
  if (!payload) return undefined;

  if (Array.isArray(payload)) {
    const found = (payload as ChubbPayloadKV[]).find((it) => String(it?.key ?? "") === key);
    if (found && chubbHasMeaningfulPayloadValue(found.value)) return found.value;
    return undefined;
  }

  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(obj, "fields")) {
      const inner = obj.fields;
      const innerVal = getChubbPayloadValue(inner, key);
      if (chubbHasMeaningfulPayloadValue(innerVal)) return innerVal;
    }

    const keys = Object.keys(obj);
    const looksArrayLike =
      keys.length > 0 &&
      keys.slice(0, Math.min(keys.length, 5)).every((k) => /^[0-9]+$/.test(k)) &&
      typeof obj[keys[0]] === "object" &&
      obj[keys[0]] !== null &&
      Object.prototype.hasOwnProperty.call(obj[keys[0]] as Record<string, unknown>, "key");
    if (looksArrayLike) {
      const values = Object.values(obj) as ChubbPayloadKV[];
      const found = values.find((it) => String(it?.key ?? "") === key);
      if (found && chubbHasMeaningfulPayloadValue(found.value)) return found.value;
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

export function chubbTrimmedString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>)) {
    return chubbTrimmedString((v as Record<string, unknown>).value);
  }
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export function chubbPayloadFirstString(payload: unknown, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = chubbTrimmedString(getChubbPayloadValue(payload, key));
    if (v) return v;
  }

  for (const key of keys) {
    const shortKey = key.includes(".") ? key.split(".").pop() ?? key : key;
    for (const entry of chubbPayloadFieldEntries(payload)) {
      const entryKey = String(entry?.key ?? "").trim();
      if (
        entryKey === key ||
        entryKey === shortKey ||
        entryKey.endsWith(`.${shortKey}`) ||
        entryKey.endsWith(`.${key}`)
      ) {
        const entryVal = chubbTrimmedString(entry?.value);
        if (entryVal) return entryVal;
      }
    }
  }

  return undefined;
}

/** Resolve a string from payload using dotted keys and flat `fields[]` entries. */
export function chubbPayloadOptionalString(payload: unknown, keys: string[]): string | undefined {
  const expanded = keys.flatMap((k) => {
    if (k.includes(".")) return [k];
    const short = k;
    return [
      k,
      `property.${short}`,
      `chubbHomeCoverageEstimator.${short}`,
      `homeownersInformations.${short}`,
      `locationDetail.${short}`,
    ];
  });
  return chubbPayloadFirstString(payload, expanded);
}

/** CHUBB Occupancy dropdown: Principal, Secondary, Seasonal. */
export function chubbMapLocationOccupancyPortalValue(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim().toLowerCase();
  if (t === "primary" || t === "principal") return "Principal";
  if (t === "secondary") return "Secondary";
  if (t === "seasonal") return "Seasonal";
  return raw.trim();
}

/** CHUBB Usage dropdown: Owner Occupied, Rented, Vacant. */
export function chubbNormalizeUsagePortalValue(raw: string): string {
  const t = raw.trim().toLowerCase();
  if ((t.includes("owner") && t.includes("occup")) || t === "owner occupied") return "Owner Occupied";
  if (t.includes("rent")) return "Rented";
  if (t.includes("vacant")) return "Vacant";
  return raw.trim();
}

export function chubbResolveUsageValue(payload: unknown): string | undefined {
  const direct = chubbPayloadOptionalString(payload, ["chubbHomeCoverageEstimator.usage", "usage"]);
  if (direct) return chubbNormalizeUsagePortalValue(direct);

  const vacant = chubbPayloadOptionalString(payload, ["locationDetail.vacant", "vacant"]);
  if (vacant && /^yes$/i.test(vacant.trim())) return "Vacant";

  const ownerOccupied = chubbPayloadOptionalString(payload, ["locationDetail.ownerOccupied", "ownerOccupied"]);
  if (ownerOccupied && /^yes$/i.test(ownerOccupied.trim())) return "Owner Occupied";

  return undefined;
}

export function chubbPayloadTruthy(value: string | undefined): boolean | undefined {
  if (value == null || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["yes", "true", "1", "y", "checked", "on"].includes(normalized)) return true;
  if (["no", "false", "0", "n", "unchecked", "off"].includes(normalized)) return false;
  return undefined;
}

/** CHUBB Basement Type dropdown: Unfinished | Partially Finished | Fully Finished */
export function chubbMapBasementTypePortalValue(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;

  const t = raw.trim().toLowerCase().replace(/%/g, "");

  if (t === "unfinished" || t.startsWith("unfinished")) return "Unfinished";
  if (t === "partially finished" || t.includes("partially")) return "Partially Finished";
  if (t === "fully finished" || t.startsWith("fully")) return "Fully Finished";

  if (["no", "n", "false", "0", "none"].includes(t)) return "Unfinished";
  if (["yes", "y", "true", "1", "100"].includes(t)) return "Fully Finished";
  if (["partial", "part", "partially", "50"].includes(t)) return "Partially Finished";

  return raw.trim();
}

export function chubbResidenceBasementType(payload: unknown): string | undefined {
  return chubbMapBasementTypePortalValue(
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.basementFinished",
      "basementFinished",
    ])
  );
}

/** Under Construction/Renovation? dropdown uses Yes / No. */
export function chubbMapYesNoPortalLabel(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(t)) return "Yes";
  if (["no", "n", "false", "0"].includes(t)) return "No";
  return raw.trim();
}

export function chubbResidenceUnderConstructionRenovation(payload: unknown): string | undefined {
  return chubbMapYesNoPortalLabel(
    chubbPayloadOptionalString(payload, [
      "homeownersInformations.underConstructionRenovation",
      "property.homeUnderConstruction",
      "homeUnderConstruction",
      "underConstructionRenovation",
    ])
  );
}

function formatChubbDateStringToMmDdYyyy(raw: string, fieldLabel: string): string {
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

  throw new Error(`CHUBB ${fieldLabel} could not be parsed: ${raw}`);
}

/** Format payload effective date as MM/DD/YYYY for Masterpiece forms. */
export function formatChubbEffectiveDateMmDdYyyy(payload: unknown): string {
  const raw = chubbPayloadFirstString(payload, [
    "insuranceDetails.effectiveDate",
    "personal.effectiveDate",
    "effectiveDate",
    "policy.effectiveDate",
  ]);

  if (!raw) {
    throw new Error(
      "CHUBB policy information requires effective date in payload (e.g. insuranceDetails.effectiveDate)."
    );
  }

  return formatChubbDateStringToMmDdYyyy(raw, "effective date");
}

/** Format payload date of birth as MM/DD/YYYY for client info. */
export function formatChubbDateOfBirthMmDdYyyy(payload: unknown): string {
  const raw = chubbPayloadFirstString(payload, [
    "personal.applicantDOB",
    "personal.dateOfBirth",
    "personal.ownerDOB",
    "dateOfBirth",
    "applicantDOB",
  ]);

  if (!raw) {
    throw new Error(
      "CHUBB client info requires date of birth in payload (e.g. personal.applicantDOB or personal.dateOfBirth)."
    );
  }

  return formatChubbDateStringToMmDdYyyy(raw, "date of birth");
}

export function chubbClientFirstName(payload: unknown): string {
  const v = chubbPayloadFirstString(payload, [
    "personal.firstName",
    "personal.ownerFirstName",
    "firstName",
  ]);
  if (!v) {
    throw new Error("CHUBB client info requires firstName (e.g. personal.firstName).");
  }
  return v;
}

export function chubbClientLastName(payload: unknown): string {
  const v = chubbPayloadFirstString(payload, [
    "personal.lastName",
    "personal.ownerLastName",
    "lastName",
  ]);
  if (!v) {
    throw new Error("CHUBB client info requires lastName (e.g. personal.lastName).");
  }
  return v;
}

/** Insured email when present in payload; optional on CHUBB client info form. */
export function chubbClientEmail(payload: unknown): string | undefined {
  const explicitKeys = [
    "personal.email",
    "personal.emailAddress",
    "shared.email",
    "email",
    "contactEmail",
    "customerEmail",
    "emailAddress",
  ];

  for (const key of explicitKeys) {
    const value = chubbTrimmedString(getChubbPayloadValue(payload, key));
    if (value && chubbLooksLikeEmail(value)) return value;
  }

  for (const entry of chubbPayloadFieldEntries(payload)) {
    const key = String(entry?.key ?? "").trim();
    if (!key || !chubbIsCustomerEmailKey(key)) continue;
    const value = chubbTrimmedString(entry?.value);
    if (value && chubbLooksLikeEmail(value)) return value;
  }

  for (const entry of chubbPayloadFieldEntries(payload)) {
    const key = String(entry?.key ?? "").trim();
    if (!key || !/email/i.test(key) || key.toLowerCase().includes("confirm")) continue;
    const value = chubbTrimmedString(entry?.value);
    if (value && chubbLooksLikeEmail(value)) return value;
  }

  const personal = getChubbPayloadValue(payload, "personal");
  if (personal && typeof personal === "object" && !Array.isArray(personal)) {
    const nested = chubbTrimmedString((personal as Record<string, unknown>).email);
    if (nested && chubbLooksLikeEmail(nested)) return nested;
  }

  const fromEnv = String(process.env.CHUBB_INSURED_EMAIL ?? "").trim();
  if (fromEnv && chubbLooksLikeEmail(fromEnv)) return fromEnv;

  return undefined;
}

/** Nine-digit SSN for masked input; returns undefined if not in payload. */
export function chubbClientSocialSecurityDigits(payload: unknown): string | undefined {
  const raw = chubbPayloadFirstString(payload, [
    "personal.ssn",
    "personal.applicantSSN",
    "personal.socialSecurity",
    "ssn",
    "socialSecurity",
  ]);
  if (!raw) return undefined;

  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) {
    throw new Error(`CHUBB client info SSN must be 9 digits (got ${digits.length}).`);
  }
  return digits;
}

export function chubbProducerCode(): string {
  return String(process.env.CHUBB_PRODUCER_CODE ?? CHUBB_DEFAULT_PRODUCER_CODE).trim() || CHUBB_DEFAULT_PRODUCER_CODE;
}

export function chubbSubProducerCode(): string {
  return (
    String(process.env.CHUBB_SUB_PRODUCER_CODE ?? CHUBB_DEFAULT_SUB_PRODUCER_CODE).trim() ||
    CHUBB_DEFAULT_SUB_PRODUCER_CODE
  );
}

/** Street line for residence address autocomplete. */
export function chubbResidenceStreetAddress(payload: unknown): string {
  const v = chubbPayloadFirstString(payload, [
    "property.address",
    "property.streetAddress",
    "personal.address",
    "personal.streetAddress",
    "streetAddress",
    "address",
    "personal.mailingAddress",
    "mailingAddress",
  ]);
  if (!v) {
    throw new Error(
      "CHUBB residence address requires street in payload (e.g. personal.address or property.address)."
    );
  }
  return v;
}

export type ChubbAttachedStructurePayload = {
  attachedStructureType: string;
  squareFeet: string;
};

export type ChubbConstructionTypePayload = {
  constructionType: string;
  percentage: string;
};

function chubbPayloadIndexedObjects(
  payload: unknown,
  arrayPrefix: string,
  fields: string[]
): Record<string, string>[] {
  const byIndex = new Map<number, Record<string, string>>();

  for (const entry of chubbPayloadFieldEntries(payload)) {
    const key = String(entry?.key ?? "").trim();
    const match = key.match(
      new RegExp(`^${arrayPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\[(\\d+)\\]\\.(.+)$`)
    );
    if (!match) continue;
    const idx = Number(match[1]);
    const field = match[2];
    if (!fields.includes(field)) continue;
    const value = chubbTrimmedString(entry.value);
    if (!value) continue;
    const row = byIndex.get(idx) ?? {};
    row[field] = value;
    byIndex.set(idx, row);
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row);
}

function chubbPayloadObjectsFromValue(
  payload: unknown,
  keys: string[],
  fields: string[]
): Record<string, string>[] {
  for (const key of keys) {
    const raw = getChubbPayloadValue(payload, key);
    if (!Array.isArray(raw)) continue;
    const rows: Record<string, string>[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row: Record<string, string> = {};
      for (const field of fields) {
        const value = chubbTrimmedString((item as Record<string, unknown>)[field]);
        if (value) row[field] = value;
      }
      if (Object.keys(row).length > 0) rows.push(row);
    }
    if (rows.length > 0) return rows;
  }
  return [];
}

export function chubbResidencePayloadString(
  payload: unknown,
  keys: string[],
  label: string,
  required = true
): string | undefined {
  const withProperty = keys.flatMap((k) => (k.startsWith("property.") ? [k] : [k, `property.${k}`]));
  const v = chubbPayloadFirstString(payload, withProperty);
  if (v) return v;

  for (const key of keys) {
    for (const entry of chubbPayloadFieldEntries(payload)) {
      const entryKey = String(entry?.key ?? "").trim();
      if (entryKey === key || entryKey.endsWith(`.${key}`)) {
        const entryVal = chubbTrimmedString(entry?.value);
        if (entryVal) return entryVal;
      }
    }
  }

  if (required) {
    throw new Error(`CHUBB residence info requires ${label} in payload (e.g. ${keys[0]}).`);
  }
  return undefined;
}

export function chubbResidenceBuildingType(payload: unknown): string {
  return chubbResidencePayloadString(payload, ["buildingType"], "buildingType")!;
}

export function chubbResidenceLivingAreaSqFt(payload: unknown): string {
  return chubbResidencePayloadString(payload, ["livingAreaSqFt"], "livingAreaSqFt")!;
}

export function chubbResidenceYearBuilt(payload: unknown): string {
  return chubbResidencePayloadString(payload, ["yearBuilt"], "yearBuilt")!;
}

export function chubbResidenceClassification(payload: unknown): string {
  return chubbResidencePayloadString(payload, ["classification"], "classification")!;
}

export function chubbResidenceRenovated(payload: unknown): string {
  return chubbResidencePayloadString(payload, ["renovated"], "renovated")!;
}

/** HCE Renovated dropdown uses Yes / No. */
export function chubbMapRenovatedPortalValue(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(t)) return "Yes";
  if (["no", "n", "false", "0"].includes(t)) return "No";
  if (/^yes$/i.test(raw.trim())) return "Yes";
  if (/^no$/i.test(raw.trim())) return "No";
  return raw.trim();
}

export function chubbResidenceRenovatedOptional(payload: unknown): string | undefined {
  const raw = chubbPayloadOptionalString(payload, [
    "renovated",
    "chubbHomeCoverageEstimator.renovated",
    "property.renovated",
  ]);
  return chubbMapRenovatedPortalValue(raw);
}

export function chubbResidencePercentRenovated(payload: unknown): string | undefined {
  return chubbResidencePayloadString(payload, ["percentRenovated"], "percentRenovated", false);
}

export function chubbResidenceDeductible(payload: unknown): string | undefined {
  return chubbResidencePayloadString(payload, ["residenceDeductible"], "residenceDeductible", false);
}

export function chubbResidenceContentsAmount(payload: unknown): string | undefined {
  return chubbPayloadOptionalString(payload, [
    "contentsAmount",
    "chubbHomeCoverageEstimator.contentsAmount",
    "property.contentsAmount",
  ]);
}

export function chubbResidenceContentsPercentage(payload: unknown): string | undefined {
  return chubbResidencePayloadString(payload, ["contentsPercentage"], "contentsPercentage", false);
}

export function chubbResidenceTypeOfContents(payload: unknown): string | undefined {
  return chubbResidencePayloadString(payload, ["typeOfContents"], "typeOfContents", false);
}

export function chubbResidenceOtherPermanentStructuresAmount(payload: unknown): string | undefined {
  return chubbPayloadOptionalString(payload, [
    "otherPermanentStructuresAmount",
    "property.otherPermanentStructuresAmount",
    "chubbHomeCoverageEstimator.otherPermanentStructuresAmount",
  ]);
}

export function chubbResidenceOtherPermanentStructuresPercentage(payload: unknown): string | undefined {
  return chubbResidencePayloadString(
    payload,
    ["otherPermanentStructuresPercentage"],
    "otherPermanentStructuresPercentage",
    false
  );
}

export function chubbResidenceDeductibleWaiverOption(payload: unknown): string | undefined {
  return chubbResidencePayloadString(payload, ["deductibleWaiverOption"], "deductibleWaiverOption", false);
}

export function chubbResidenceAttachedStructures(payload: unknown): ChubbAttachedStructurePayload[] {
  const fromArray = chubbPayloadObjectsFromValue(
    payload,
    ["attachedStructures", "property.attachedStructures"],
    ["attachedStructureType", "squareFeet"]
  );
  if (fromArray.length > 0) {
    return fromArray.map((row) => ({
      attachedStructureType: row.attachedStructureType,
      squareFeet: row.squareFeet,
    }));
  }

  const indexed = chubbPayloadIndexedObjects(payload, "attachedStructures", [
    "attachedStructureType",
    "squareFeet",
  ]);
  return indexed.map((row) => ({
    attachedStructureType: row.attachedStructureType,
    squareFeet: row.squareFeet,
  }));
}

function chubbNormalizeConstructionTypeRows(
  rows: Record<string, string>[]
): ChubbConstructionTypePayload[] {
  const normalized: ChubbConstructionTypePayload[] = [];
  for (const row of rows) {
    const constructionType = row.constructionType?.trim() ?? "";
    const percentage = (row.percentage ?? "").replace(/%/g, "").trim();
    if (!constructionType || !percentage) continue;
    normalized.push({ constructionType, percentage });
  }
  return normalized;
}

export function chubbResidenceConstructionTypes(payload: unknown): ChubbConstructionTypePayload[] {
  const fromArray = chubbPayloadObjectsFromValue(
    payload,
    [
      "constructionTypes",
      "property.constructionTypes",
      "chubbHomeCoverageEstimator.constructionTypes",
      "property.chubbHomeCoverageEstimator.constructionTypes",
    ],
    ["constructionType", "percentage"]
  );
  const fromArrayNormalized = chubbNormalizeConstructionTypeRows(fromArray);
  if (fromArrayNormalized.length > 0) return fromArrayNormalized;

  const indexed = [
    ...chubbPayloadIndexedObjects(payload, "constructionTypes", [
      "constructionType",
      "percentage",
    ]),
    ...chubbPayloadIndexedObjects(payload, "property.constructionTypes", [
      "constructionType",
      "percentage",
    ]),
  ];
  return chubbNormalizeConstructionTypeRows(indexed);
}
