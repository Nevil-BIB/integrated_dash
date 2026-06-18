import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright";
import { logger } from "../utils/logger";
import type { PlaywrightNationalGeneralRunRequest } from "./playwrightNationalGeneral.types";

type NatGenNamedInsuredPage = {
  effectiveDate?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  middleName?: string;
  suffix?: "Jr" | "Sr" | "II" | "III" | "IV" | "V" | "VI" | "Rd";
  phone?: { areaCode: string; exchange: string; number: string; type?: "1" | "2" | "3" };
  email?: string;
  socialSecurity?: { part1: string; part2: string; part3: string };
  mailingAddress: string;
  city: string;
  zipCode: string;
  mailingAddress2?: string;
  state?: string;
  zipCode2?: string;
  movedInLast60Days?: boolean;
  previousAddress?: string;
  previousCity?: string;
  previousState?: string;
  previousZip?: string;
};

type NatGenDriver = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "M" | "F";
  maritalStatus: "M" | "S" | "D" | "H" | "P" | "W";
  relationship?: "Named Insured" | "Spouse" | "Child" | "Parent" | "Other";
  driverStatus?: "Excluded Driver" | "Listed Driver" | "Non Driver" | "Other Insurance" | "Rated Driver";
  licenseStatus?: "Valid" | "Suspended" | "PermanentlyRevokedLicense" | "Permit" | "Surrendered" | "Revoked" | "RevokedNotPerm" | "Cancelled" | "Expired" | "NotNeverLicensed" | "UnknownLicense" | "InternationalLicense";
  hasCDL?: boolean;
  dynamicDrive: boolean;
  licenseState?: string;
  middleName?: string;
  suffix?: "Jr" | "Sr" | "II" | "III" | "IV" | "V" | "VI" | "Rd";
  stateFiling?: "None" | "SR22";
  dlNumber?: string;
  addViolations?: boolean;
  military?: boolean;
  email?: string;
  cellPhone?: { areaCode: string; exchange: string; number: string };
};

type NatGenVehicle = {
  modelYear: string;
  make: string;
  model: string;
  style: string;
  ownershipStatus: "FIN" | "LSE" | "OWN";
  titleLength?: "1" | "3" | "6" | "9";
  brandedTitle?: boolean;
  accident?: boolean;
  primaryUse?: "Artisan" | "Business" | "Pleasure/Commute";
  antiTheft?: "None" | "Factory-Installed AT & Recov Disc" | "Recovery Device";
  inStorage?: boolean;
  garagingState?: string;
  garagingZip?: string;
  garagingZip2?: string;
  settlementOption?: "ACV" | "ACVOEM" | "Replace" | "ReplaceOEM";
  annualMileage?: string;
  originalOwner?: boolean;
};

type NatGenCoverageVehicle = {
  comp?: string;
  coll?: string;
  rent?: string;
  tow?: string;
  cust?: string;
  ppmx?: boolean;
  dimDed?: boolean;
};

type NatGenCoverages = {
  termMonths?: "6" | "12";
  payMethod?: "D" | "AS" | "AC";
  payPlan?: string;
  bi?: string;
  pd?: string;
  med?: string;
  umuimbi?: string;
  add?: string;
  accidentForgiveness?: boolean;
  vehicles?: NatGenCoverageVehicle[];
};

type NatGenUnderwriting = {
  priorCarrier?: "0" | "540" | "380";
  monthsWithPrior?: "0" | "179" | "330" | "1050" | "1100";
  priorBI?: string;
  priorExpDate?: string;
  residenceStatus: "HCO" | "MHO" | "Rent" | "Other";
  inAgencyTransfer?: boolean;
  goPaperless?: boolean;
  multiPolicy?: "0" | "1" | "2" | "3" | "8";
  prohibitedRisk?: boolean;
  rideSharing?: boolean;
  insuranceFraud?: boolean;
  notListedHousehold?: boolean;
  notListedVehicle?: boolean;
  rentersInterest?: boolean;
};

type NatGenPayload = {
  namedInsured: NatGenNamedInsuredPage;
  drivers: NatGenDriver[];
  vehicles: NatGenVehicle[];
  underwriting: NatGenUnderwriting;
  coverages?: NatGenCoverages;
};

type GenericFieldEntry = { key?: unknown; value?: unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function toBooleanOrUndefined(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const raw = toStringOrUndefined(value);
  if (!raw) return undefined;
  const lowered = raw.toLowerCase();
  if (["yes", "true", "1", "y"].includes(lowered)) return true;
  if (["no", "false", "0", "n"].includes(lowered)) return false;
  return undefined;
}

function setIndexedValue(target: Record<string, unknown>, pathKey: string, value: unknown): void {
  const segments = pathKey.split(".");
  let cursor: Record<string, unknown> = target;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const match = /^([^\[]+)\[(\d+)\]$/.exec(segment);
    const isLast = i === segments.length - 1;

    if (match) {
      const arrKey = match[1];
      const arrIndex = Number(match[2]);
      const existingArray = cursor[arrKey];
      const arr = Array.isArray(existingArray) ? existingArray : [];
      if (!Array.isArray(existingArray)) {
        cursor[arrKey] = arr;
      }
      if (isLast) {
        arr[arrIndex] = value;
      } else {
        const nextValue = arr[arrIndex];
        const nextObj =
          nextValue && typeof nextValue === "object" && !Array.isArray(nextValue)
            ? (nextValue as Record<string, unknown>)
            : {};
        arr[arrIndex] = nextObj;
        cursor = nextObj;
      }
      continue;
    }

    if (isLast) {
      cursor[segment] = value;
      continue;
    }

    const next = cursor[segment];
    const nextObj =
      next && typeof next === "object" && !Array.isArray(next)
        ? (next as Record<string, unknown>)
        : {};
    cursor[segment] = nextObj;
    cursor = nextObj;
  }
}

function normalizeNatGenPayload(raw: unknown): NatGenPayload {
  const obj = asRecord(raw);
  if (obj.namedInsured && Array.isArray(obj.drivers) && Array.isArray(obj.vehicles) && obj.underwriting) {
    return obj as NatGenPayload;
  }

  const fieldEntries: GenericFieldEntry[] = Array.isArray(obj.fields)
    ? (obj.fields as GenericFieldEntry[])
    : [];
  const fieldMap = new Map<string, unknown>();
  for (const entry of fieldEntries) {
    const key = toStringOrUndefined(entry?.key);
    if (!key) continue;
    fieldMap.set(key, entry?.value);
  }

  const indexed = asRecord({});
  for (const [key, value] of fieldMap.entries()) {
    if (!key.includes("[") || !key.includes("]")) continue;
    setIndexedValue(indexed, key, value);
  }

  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      if (fieldMap.has(key)) return toStringOrUndefined(fieldMap.get(key));
      const direct = toStringOrUndefined(obj[key]);
      if (direct) return direct;
    }
    return undefined;
  };

  const pickBool = (...keys: string[]): boolean | undefined => {
    for (const key of keys) {
      if (fieldMap.has(key)) {
        const parsed = toBooleanOrUndefined(fieldMap.get(key));
        if (parsed !== undefined) return parsed;
      }
      const parsedDirect = toBooleanOrUndefined(obj[key]);
      if (parsedDirect !== undefined) return parsedDirect;
    }
    return undefined;
  };

  const namedInsuredObj = asRecord(obj.namedInsured);
  const namedInsured: NatGenNamedInsuredPage = {
    firstName:
      toStringOrUndefined(namedInsuredObj.firstName) ??
      pick("namedInsured.firstName", "personal.ownerFirstName", "personal.firstName", "firstName") ??
      "",
    lastName:
      toStringOrUndefined(namedInsuredObj.lastName) ??
      pick("namedInsured.lastName", "personal.ownerLastName", "personal.lastName", "lastName") ??
      "",
    dateOfBirth:
      toStringOrUndefined(namedInsuredObj.dateOfBirth) ??
      pick("namedInsured.dateOfBirth", "personal.ownerDOB", "personal.dateOfBirth", "dateOfBirth") ??
      "",
    email: toStringOrUndefined(namedInsuredObj.email) ?? pick("namedInsured.email", "personal.email", "email"),
    mailingAddress:
      toStringOrUndefined(namedInsuredObj.mailingAddress) ??
      pick("namedInsured.mailingAddress", "personal.address", "personal.streetAddress", "address") ??
      "",
    city: toStringOrUndefined(namedInsuredObj.city) ?? pick("namedInsured.city", "personal.city", "city") ?? "",
    zipCode:
      toStringOrUndefined(namedInsuredObj.zipCode) ??
      pick("namedInsured.zipCode", "personal.zipCode", "zipCode", "zip") ??
      "",
  };

  const payloadDrivers = Array.isArray(obj.drivers) ? (obj.drivers as Array<Record<string, unknown>>) : [];
  const indexedDrivers = Array.isArray(indexed.drivers)
    ? (indexed.drivers as Array<Record<string, unknown>>).filter(
        (entry) => entry && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
  const sourceDrivers = payloadDrivers.length > 0 ? payloadDrivers : indexedDrivers;

  const mapDriver = (driver: Record<string, unknown>, index: number): NatGenDriver => ({
    firstName: toStringOrUndefined(driver.firstName) ?? namedInsured.firstName,
    lastName: toStringOrUndefined(driver.lastName) ?? namedInsured.lastName,
    dateOfBirth: toStringOrUndefined(driver.dateOfBirth) ?? namedInsured.dateOfBirth,
    gender: (toStringOrUndefined(driver.gender) as NatGenDriver["gender"]) ?? "M",
    maritalStatus:
      (toStringOrUndefined(driver.maritalStatus) as NatGenDriver["maritalStatus"]) ?? "S",
    dynamicDrive: toBooleanOrUndefined(driver.dynamicDrive) ?? false,
    driverStatus:
      (toStringOrUndefined(driver.driverStatus) as NatGenDriver["driverStatus"]) ?? "Rated Driver",
    relationship:
      (toStringOrUndefined(driver.relationship) as NatGenDriver["relationship"]) ??
      (index === 0 ? "Named Insured" : "Spouse"),
    licenseStatus:
      (toStringOrUndefined(driver.licenseStatus) as NatGenDriver["licenseStatus"]) ?? "Valid",
  });

  const drivers: NatGenDriver[] =
    sourceDrivers.length > 0
      ? sourceDrivers.map((driver, index) => mapDriver(driver, index))
      : [
          {
            firstName: namedInsured.firstName,
            lastName: namedInsured.lastName,
            dateOfBirth: namedInsured.dateOfBirth,
            gender: (pick("drivers[0].gender", "gender") as NatGenDriver["gender"]) ?? "M",
            maritalStatus: (pick("drivers[0].maritalStatus", "maritalStatus") as NatGenDriver["maritalStatus"]) ?? "S",
            dynamicDrive: pickBool("drivers[0].dynamicDrive", "dynamicDrive") ?? false,
            driverStatus: "Rated Driver",
            relationship: "Named Insured",
            licenseStatus: "Valid",
          },
        ];

  const payloadVehicles = Array.isArray(obj.vehicles) ? (obj.vehicles as Array<Record<string, unknown>>) : [];
  const indexedVehicles = Array.isArray(indexed.vehicles)
    ? (indexed.vehicles as Array<Record<string, unknown>>).filter(
        (entry) => entry && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
  const sourceVehicles = payloadVehicles.length > 0 ? payloadVehicles : indexedVehicles;

  const mapVehicle = (vehicle: Record<string, unknown>): NatGenVehicle => {
    const rawModel =
      toStringOrUndefined(vehicle.model) ??
      toStringOrUndefined(vehicle.modelName) ??
      toStringOrUndefined(vehicle.vehicleModel) ??
      "";
    const rawStyle =
      toStringOrUndefined(vehicle.style) ??
      toStringOrUndefined(vehicle.trim) ??
      toStringOrUndefined(vehicle.trimCode) ??
      toStringOrUndefined(vehicle.bodyStyle) ??
      toStringOrUndefined(vehicle.series) ??
      "";
    const normalizedModel = rawModel.trim();
    const normalizedStyle = rawStyle.trim();
    const shortCode = /^[A-Za-z0-9]{1,4}$/.test(normalizedModel);

    return {
      modelYear: toStringOrUndefined(vehicle.modelYear) ?? "",
      make: toStringOrUndefined(vehicle.make) ?? "",
      model: normalizedModel,
      // If model arrives as a short trim code and style is empty, carry it into style fallback.
      style: normalizedStyle || (shortCode ? normalizedModel : ""),
      ownershipStatus:
        (toStringOrUndefined(vehicle.ownershipStatus) as NatGenVehicle["ownershipStatus"]) ?? "OWN",
      annualMileage: toStringOrUndefined(vehicle.annualMileage),
      titleLength:
        (toStringOrUndefined(vehicle.titleLength) as NatGenVehicle["titleLength"]) ?? undefined,
    };
  };

  const vehicles: NatGenVehicle[] =
    sourceVehicles.length > 0
      ? sourceVehicles.map(mapVehicle)
      : [
          {
            modelYear: pick("vehicles[0].modelYear", "vehicle.modelYear") ?? "",
            make: pick("vehicles[0].make", "vehicle.make") ?? "",
            model: pick("vehicles[0].model", "vehicle.model", "vehicles[0].modelName", "vehicle.modelName") ?? "",
            style:
              pick(
                "vehicles[0].style",
                "vehicle.style",
                "vehicles[0].trim",
                "vehicle.trim",
                "vehicles[0].trimCode",
                "vehicle.trimCode",
                "vehicles[0].bodyStyle",
                "vehicle.bodyStyle",
              ) ?? "",
            ownershipStatus: (pick("vehicles[0].ownershipStatus", "vehicle.ownershipStatus") as NatGenVehicle["ownershipStatus"]) ?? "OWN",
            annualMileage: pick("vehicles[0].annualMileage", "vehicle.annualMileage"),
            titleLength: (pick("vehicles[0].titleLength", "vehicle.titleLength") as NatGenVehicle["titleLength"]) ?? undefined,
          },
        ];

  const underwritingObj = asRecord(obj.underwriting);
  const underwriting: NatGenUnderwriting = {
    residenceStatus:
      (toStringOrUndefined(underwritingObj.residenceStatus) as NatGenUnderwriting["residenceStatus"]) ??
      (pick("underwriting.residenceStatus", "residenceStatus") as NatGenUnderwriting["residenceStatus"]) ??
      "HCO",
    priorCarrier:
      (toStringOrUndefined(underwritingObj.priorCarrier) as NatGenUnderwriting["priorCarrier"]) ??
      (pick("underwriting.priorCarrier", "priorCarrier") as NatGenUnderwriting["priorCarrier"]) ??
      "0",
    goPaperless:
      toBooleanOrUndefined(underwritingObj.goPaperless) ??
      pickBool("underwriting.goPaperless", "goPaperless") ??
      true,
    multiPolicy:
      (toStringOrUndefined(underwritingObj.multiPolicy) as NatGenUnderwriting["multiPolicy"]) ??
      (pick("underwriting.multiPolicy", "multiPolicy") as NatGenUnderwriting["multiPolicy"]) ??
      "0",
    insuranceFraud:
      toBooleanOrUndefined(underwritingObj.insuranceFraud) ??
      pickBool("underwriting.insuranceFraud", "insuranceFraud") ??
      false,
    notListedHousehold:
      toBooleanOrUndefined(underwritingObj.notListedHousehold) ??
      pickBool("underwriting.notListedHousehold", "notListedHousehold") ??
      false,
    notListedVehicle:
      toBooleanOrUndefined(underwritingObj.notListedVehicle) ??
      pickBool("underwriting.notListedVehicle", "notListedVehicle") ??
      false,
    rideSharing:
      toBooleanOrUndefined(underwritingObj.rideSharing) ??
      pickBool("underwriting.rideSharing", "rideSharing") ??
      false,
    rentersInterest:
      toBooleanOrUndefined(underwritingObj.rentersInterest) ??
      pickBool("underwriting.rentersInterest", "rentersInterest") ??
      false,
  };

  const coveragesObj = asRecord(obj.coverages);
  const coverages: NatGenCoverages = {
    payMethod:
      (toStringOrUndefined(coveragesObj.payMethod) as NatGenCoverages["payMethod"]) ??
      (pick("coverages.payMethod", "payMethod") as NatGenCoverages["payMethod"]) ??
      "AS",
    payPlan: toStringOrUndefined(coveragesObj.payPlan) ?? pick("coverages.payPlan", "payPlan") ?? "7076",
  };

  return {
    namedInsured,
    drivers,
    vehicles,
    underwriting,
    coverages,
  };
}

function effectiveDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function yearsExperience(dob: string): string {
  const parts = dob.split("/");
  const dobYear = Number(parts[2] ?? 0);
  return String(Math.max(0, new Date().getFullYear() - dobYear - 18));
}

async function fetchOtpAfter(webhookUrl: string, clickedAt: number, retries = 20, delayMs = 3000): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const { data } = await axios.get<{ otp?: string; time?: number }>(webhookUrl);
    const otp = String(data?.otp ?? "").trim();
    const time = Number(data?.time ?? 0);
    if (otp && time > clickedAt) return otp;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("[NationalGeneral] Timed out waiting for fresh OTP");
}

async function requestNatGenOtp(page: Page): Promise<number> {
  const otpInput = page.locator("input#TwoFactorCode, input[name='TwoFactorCode']").first();
  if (await otpInput.isVisible().catch(() => false)) {
    return 0;
  }

  const requestSelectors = [
    "a#loginWith2faEmail",
    "button#loginWith2faEmail",
    "a[href*='LoginWithTwoFactorEmail']",
    "button:has-text('Email')",
    "a:has-text('Email')",
    "button:has-text('Send')",
    "a:has-text('Send')",
  ];

  for (const selector of requestSelectors) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      const requestedAt = Date.now();
      await el.click({ force: true }).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await otpInput.waitFor({ state: "visible", timeout: 15000 }).catch(() => undefined);
      return requestedAt;
    }
  }

  await otpInput.waitFor({ state: "visible", timeout: 20000 });
  return 0;
}

async function fillNamedInsured(page: Page, data: NatGenNamedInsuredPage): Promise<void> {
  await page.fill("input[id$='txtDateEff']", data.effectiveDate ?? effectiveDatePlusDays(7));
  await page.fill("input[id$='txtInsFirstName']", data.firstName);
  if (data.middleName) await page.fill("input[id$='txtInsMiddleName']", data.middleName);
  await page.fill("input[id$='txtInsLastName']", data.lastName);
  if (data.suffix) await page.selectOption("select[id$='ddlInsSuffix']", data.suffix);
  if (data.phone) {
    await page.fill("input[id$='PhoneNumber1_txtPhone1']", data.phone.areaCode);
    await page.fill("input[id$='PhoneNumber1_txtPhone2']", data.phone.exchange);
    await page.fill("input[id$='PhoneNumber1_txtPhone3']", data.phone.number);
    if (data.phone.type) await page.selectOption("select[id$='PhoneNumber1_ddlPhoneType']", data.phone.type);
  }
  if (data.email) await page.fill("input[id$='txtInsEmail']", data.email);
  await page.fill("input[id$='txtInsDOB']", data.dateOfBirth);
  await page.fill("input[id$='txtInsAdr']", data.mailingAddress);
  if (data.mailingAddress2) await page.fill("input[id$='txtInsAdr2']", data.mailingAddress2);
  await page.fill("input[id$='txtInsCity']", data.city);
  if (data.state) await page.selectOption("select[id$='ddlInsState']", data.state);
  await page.fill("input[id$='txtInsZip']", data.zipCode);
  if (data.zipCode2) await page.fill("input[id$='txtInsZip2']", data.zipCode2);
  const beforeUrl = page.url();
  const continueSelectors = [
    "a[id$='btnContinue']",
    "a#ctl00_MainContent_btnContinue",
    "button[id$='btnContinue']",
    "a:has-text('Continue')",
    "button:has-text('Continue')",
    "input[value='Continue']",
  ];
  for (let i = 0; i < 4; i++) {
    await clickFirstVisible(page, continueSelectors);
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    const nowUrl = page.url();
    if (!/QuoteNamedInsured\.aspx/i.test(nowUrl) || nowUrl !== beforeUrl) {
      break;
    }
    await page.waitForTimeout(800).catch(() => undefined);
  }
}

async function ensureDriverPageReady(page: Page): Promise<void> {
  const driverFirstName = page.locator(
    [
      "input[id$='ucInsuredDriver_txtFirstName']",
      "input[id*='InsuredDriver'][id*='FirstName']",
      "input[name*='InsuredDriver'][name*='FirstName']",
      "input[id*='Driver'][id*='FirstName']",
    ].join(", "),
  ).first();

  for (let i = 0; i < 4; i++) {
    if (await driverFirstName.isVisible().catch(() => false)) return;

    const url = page.url().toLowerCase();
    if (url.includes("/quote/quoteprefill2.aspx")) {
      const continueSelectors = [
        "a[id$='btnContinue']",
        "a#ctl00_MainContent_btnContinue",
        "button[id$='btnContinue']",
        "a:has-text('Continue')",
        "button:has-text('Continue')",
      ];
      for (const selector of continueSelectors) {
        const btn = page.locator(selector).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true }).catch(() => undefined);
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
          break;
        }
      }
    } else {
      await page.waitForTimeout(800).catch(() => undefined);
    }
  }

  await driverFirstName.waitFor({ state: "visible", timeout: 45000 });
}

function isNatGenUnderwritingOrPastUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("/quote/quoteuw.aspx") ||
    lower.includes("/quote/quoteunderwriting.aspx") ||
    lower.includes("/quote/quoteautohistory.aspx")
  );
}

async function ensureVehiclePageReady(page: Page): Promise<boolean> {
  const modelYearField = page.locator("input[id$='ucInsuredAuto_txtModelYear'], input[id*='InsuredAuto'][id*='ModelYear']").first();

  for (let i = 0; i < 5; i++) {
    if (await modelYearField.isVisible().catch(() => false)) return true;

    const url = page.url().toLowerCase();
    if (isNatGenUnderwritingOrPastUrl(url)) {
      return false;
    }
    if (url.includes("/quote/quotedriverv2.aspx") || url.includes("/quote/quoteprefill2.aspx")) {
      await clickFirstVisible(page, [
        "a#ctl00_MainContent_btnContinue",
        "a[id$='btnContinue']",
        "button[id$='btnContinue']",
        "a:has-text('Continue')",
        "button:has-text('Continue')",
        "input[value='Continue']",
      ]);
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    } else {
      await page.waitForTimeout(800).catch(() => undefined);
    }
  }

  if (isNatGenUnderwritingOrPastUrl(page.url())) {
    return false;
  }
  await modelYearField.waitFor({ state: "visible", timeout: 45000 });
  return true;
}

async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }
  throw new Error(`No visible field matched selectors: ${selectors.join(" | ")}`);
}

async function selectFirstVisible(page: Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.selectOption(value).catch(async () => locator.selectOption({ label: value }));
      return;
    }
  }
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true }).catch(() => undefined);
      return true;
    }
  }
  return false;
}

async function fillDriver(page: Page, driver: NatGenDriver, isLast: boolean): Promise<void> {
  await ensureDriverPageReady(page);

  await fillFirstVisible(page, [
    "input[id$='ucInsuredDriver_txtFirstName']",
    "input[id*='InsuredDriver'][id*='FirstName']",
    "input[name*='InsuredDriver'][name*='FirstName']",
    "input[id*='Driver'][id*='FirstName']",
  ], driver.firstName);
  if (driver.middleName) {
    await fillFirstVisible(page, [
      "input[id$='ucInsuredDriver_txtMiddleName']",
      "input[id*='InsuredDriver'][id*='MiddleName']",
      "input[name*='InsuredDriver'][name*='MiddleName']",
    ], driver.middleName);
  }
  await fillFirstVisible(page, [
    "input[id$='ucInsuredDriver_txtLastName']",
    "input[id*='InsuredDriver'][id*='LastName']",
    "input[name*='InsuredDriver'][name*='LastName']",
  ], driver.lastName);
  if (driver.suffix) {
    await selectFirstVisible(page, [
      "select[id$='ucInsuredDriver_ddlSuffix']",
      "select[id*='InsuredDriver'][id*='Suffix']",
    ], driver.suffix);
  }
  await fillFirstVisible(page, [
    "input[id$='ucInsuredDriver_txtDateOfBirth']",
    "input[id*='InsuredDriver'][id*='DateOfBirth']",
    "input[name*='InsuredDriver'][name*='DateOfBirth']",
  ], driver.dateOfBirth);
  await selectFirstVisible(page, [
    "select[id$='ucInsuredDriver_ddlGender']",
    "select[id*='InsuredDriver'][id*='Gender']",
  ], driver.gender);
  await selectFirstVisible(page, [
    "select[id$='ucInsuredDriver_ddlMaritalStatus']",
    "select[id*='InsuredDriver'][id*='MaritalStatus']",
  ], driver.maritalStatus);
  if (driver.driverStatus) {
    await selectFirstVisible(page, [
      "select[id$='ucInsuredDriver_ddlDriverStatus']",
      "select[id*='InsuredDriver'][id*='DriverStatus']",
    ], driver.driverStatus);
  }
  const expField = page.locator("input[id$='ucInsuredDriver_txtYearsExperience'], input[id*='InsuredDriver'][id*='YearsExperience']").first();
  await expField.clear();
  await expField.fill(yearsExperience(driver.dateOfBirth));
  if (isLast) {
    await clickFirstVisible(page, [
      "a[id$='ucInsuredDriver_btnSave']",
      "button[id$='ucInsuredDriver_btnSave']",
      "a:has-text('Save')",
      "button:has-text('Save')",
    ]);
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    const movedPastDriver = !/QuoteDriverV2\.aspx/i.test(page.url());
    if (!movedPastDriver) {
      const clicked = await clickFirstVisible(page, [
        "a#ctl00_MainContent_btnContinue",
        "a[id$='btnContinue']",
        "button[id$='btnContinue']",
        "a:has-text('Continue')",
        "button:has-text('Continue')",
        "input[value='Continue']",
      ]);
      if (clicked) {
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      }
    }
  } else {
    await clickFirstVisible(page, [
      "a[id$='ucInsuredDriver_btnAdd']",
      "button[id$='ucInsuredDriver_btnAdd']",
      "a:has-text('Add')",
      "button:has-text('Add')",
    ]);
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  }
}

async function fillVehicle(page: Page, vehicle: NatGenVehicle, isLast: boolean): Promise<void> {
  const vehiclePageReady = await ensureVehiclePageReady(page);
  if (!vehiclePageReady) {
    return;
  }
  const delay = () => page.waitForTimeout(1200);
  const isLikelyTrimCode = (value: string): boolean => /^[A-Za-z0-9]{1,4}$/.test((value ?? "").trim());
  const pickFirstNonEmptyOptionValue = async (selector: string): Promise<string | undefined> => {
    const locator = page.locator(selector).first();
    const options = await locator.locator("option").evaluateAll((nodes) =>
      nodes.map((n) => ({ value: (n as HTMLOptionElement).value ?? "", label: (n.textContent ?? "").trim() })),
    );
    const first = options.find((o) => (o.value || "").trim().length > 0);
    return first?.value;
  };

  const selectBestOption = async (selector: string, requested: string): Promise<void> => {
    const raw = (requested ?? "").trim();
    if (!raw) return;
    let lastErr: unknown;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const locator = page.locator(selector).first();
        await locator.waitFor({ state: "visible", timeout: 20000 });

        try {
          await page.selectOption(selector, raw);
          return;
        } catch {
          // continue to next strategy
        }
        try {
          await page.selectOption(selector, { label: raw });
          return;
        } catch {
          // continue to option introspection
        }

        const options = await locator.locator("option").evaluateAll((nodes) =>
          nodes.map((n) => ({ value: (n as HTMLOptionElement).value ?? "", label: (n.textContent ?? "").trim() })),
        );
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = norm(raw);
        const byExact = options.find((o) => norm(o.value) === target || norm(o.label) === target);
        const byContains = options.find((o) => norm(o.label).includes(target) || target.includes(norm(o.label)));
        const chosen = byExact ?? byContains;
        if (!chosen) {
          throw new Error(`[NationalGeneral] No matching option for "${raw}" in ${selector}`);
        }
        await page.selectOption(selector, chosen.value).catch(async () => page.selectOption(selector, { label: chosen.label }));
        return;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const contextReset =
          msg.includes("Execution context was destroyed") ||
          msg.includes("Target page, context or browser has been closed");
        if (!contextReset || attempt === 3) break;
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        await page.waitForTimeout(400 + attempt * 250).catch(() => undefined);
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };

  const waitForNonEmptyOptions = async (selector: string, timeout = 20000): Promise<void> => {
    const dropdown = page.locator(selector).first();
    await dropdown.waitFor({ state: "visible", timeout });
    await page
      .waitForFunction(
        (sel) => {
          const el = document.querySelector(sel) as HTMLSelectElement | null;
          if (!el) return false;
          const options = Array.from(el.options || []);
          return options.some((o) => (o.value || "").trim().length > 0);
        },
        selector,
        { timeout },
      )
      .catch(() => undefined);
  };

  const yearField = "input[id$='ucInsuredAuto_txtModelYear']";
  const makeSelect = "select[id$='ucInsuredAuto_ddlMake']";
  const modelSelect = "select[id$='ucInsuredAuto_ddlModel']";
  const styleSelect = "select[id$='ucInsuredAuto_ddlStyle']";

  await page.fill(yearField, vehicle.modelYear);
  const makeResponse = page
    .waitForResponse((r) => r.url().includes("GetVehicleMakeDropDownOptions"), { timeout: 12000 })
    .catch(() => null);
  await page.locator(yearField).press("Tab");
  await Promise.race([makeResponse, waitForNonEmptyOptions(makeSelect, 12000)]).catch(() => undefined);
  if (isNatGenUnderwritingOrPastUrl(page.url())) {
    return;
  }
  await waitForNonEmptyOptions(makeSelect);
  await delay();

  const modelResponse = page
    .waitForResponse((r) => r.url().includes("GetVehicleModelDropDownOptions"), { timeout: 12000 })
    .catch(() => null);
  await selectBestOption(makeSelect, vehicle.make);
  await Promise.race([modelResponse, waitForNonEmptyOptions(modelSelect, 12000)]).catch(() => undefined);
  if (isNatGenUnderwritingOrPastUrl(page.url())) {
    return;
  }
  await waitForNonEmptyOptions(modelSelect);
  await delay();

  const styleResponse = page
    .waitForResponse((r) => r.url().includes("GetVehicleStyleDropDownOptions"), { timeout: 12000 })
    .catch(() => null);
  let styleRequested = vehicle.style;
  try {
    await selectBestOption(modelSelect, vehicle.model);
  } catch {
    const fallbackModelValue = await pickFirstNonEmptyOptionValue(modelSelect);
    if (!fallbackModelValue) {
      if (isNatGenUnderwritingOrPastUrl(page.url())) {
        return;
      }
      throw new Error(
        `[NationalGeneral] Model dropdown has no selectable options (make="${vehicle.make}", requestedModel="${vehicle.model}")`,
      );
    }
    await page.selectOption(modelSelect, fallbackModelValue).catch(() => undefined);
    if (!styleRequested && isLikelyTrimCode(vehicle.model)) {
      styleRequested = vehicle.model;
    }
  }
  await Promise.race([styleResponse, waitForNonEmptyOptions(styleSelect, 12000)]).catch(() => undefined);
  if (isNatGenUnderwritingOrPastUrl(page.url())) {
    return;
  }
  await waitForNonEmptyOptions(styleSelect);
  await delay();

  if (!styleRequested || !styleRequested.trim()) {
    const firstStyle = await pickFirstNonEmptyOptionValue(styleSelect);
    if (firstStyle) {
      await page.selectOption(styleSelect, firstStyle).catch(() => undefined);
    } else {
      throw new Error(
        `[NationalGeneral] Style dropdown has no selectable options (make="${vehicle.make}", model="${vehicle.model}")`,
      );
    }
  } else {
    try {
      await selectBestOption("select[id$='ucInsuredAuto_ddlStyle']", styleRequested);
    } catch {
      const firstStyle = await pickFirstNonEmptyOptionValue(styleSelect);
      if (firstStyle) {
        await page.selectOption(styleSelect, firstStyle).catch(() => undefined);
      } else {
        throw new Error(
          `[NationalGeneral] Could not resolve style "${styleRequested}" and no fallback style exists.`,
        );
      }
    }
  }
  await page.selectOption("select[id$='ucInsuredAuto_ddlOwnershipStatus']", vehicle.ownershipStatus);
  if (vehicle.annualMileage) await page.fill("input[id$='ucInsuredAuto_txtAnnualMileage']", vehicle.annualMileage);
  if (isLast) {
    await page.click("a[id$='ucInsuredAuto_btnSave']");
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await page.click("a#ctl00_MainContent_btnContinue");
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  } else {
    await page.click("a[id$='ucInsuredAuto_btnAdd']");
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  }
}

async function fillVehicleHistory(page: Page, vehicles: NatGenVehicle[]): Promise<void> {
  if (isNatGenUnderwritingOrPastUrl(page.url())) {
    return;
  }
  const titleLengthSelects = await page.locator("select[id*='ddlTitleLength']").all();
  if (!titleLengthSelects.length) {
    return;
  }
  for (let i = 0; i < titleLengthSelects.length; i++) {
    const vehicle = vehicles[i];
    if (!vehicle) continue;
    await titleLengthSelects[i].selectOption(vehicle.titleLength ?? "1");
  }
  await page.click("a#ctl00_MainContent_btnContinue");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
}

async function ensureUnderwritingPageReady(page: Page): Promise<void> {
  const carrierSelect = page.locator("select[id$='PriorPolicy_ddlCurrentCarrier']").first();
  for (let i = 0; i < 5; i++) {
    if (await carrierSelect.isVisible().catch(() => false)) return;

    const url = page.url().toLowerCase();
    if (url.includes("/quote/quoteautohistory.aspx") || url.includes("/quote/quoteautov2.aspx")) {
      await clickFirstVisible(page, [
        "a#ctl00_MainContent_btnContinue",
        "a[id$='btnContinue']",
        "button[id$='btnContinue']",
        "a:has-text('Continue')",
        "button:has-text('Continue')",
        "input[value='Continue']",
      ]);
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    } else {
      await page.waitForTimeout(800).catch(() => undefined);
    }
  }
  await carrierSelect.waitFor({ state: "visible", timeout: 45000 });
}

async function selectByQuestionName(page: Page, questionName: string, value: string): Promise<void> {
  const hf = page.locator(`input[id*="hfQuestionName"][value="${questionName}"]`);
  const hfId = await hf.getAttribute("id").catch(() => null);
  if (!hfId) return;
  const prefix = hfId.replace("_hfQuestionName", "");
  await page.selectOption(`select[id$="${prefix}_ddlAnswer"]`, value).catch(() => {});
}

async function fillUnderwriting(page: Page, uw: NatGenUnderwriting): Promise<void> {
  await ensureUnderwritingPageReady(page);
  await page.selectOption("select[id$='PriorPolicy_ddlCurrentCarrier']", uw.priorCarrier ?? "0");
  await selectByQuestionName(page, "ResidenceStatus", uw.residenceStatus);
  await selectByQuestionName(page, "InAgencyTransfer", (uw.inAgencyTransfer ?? false) ? "True" : "False");
  await selectByQuestionName(page, "DocumentDeliveryMethodV2", (uw.goPaperless ?? true) ? "EMAIL" : "USPS");
  await selectByQuestionName(page, "MultiPolicy", uw.multiPolicy ?? "0");
  await selectByQuestionName(page, "InsuranceFraud", (uw.insuranceFraud ?? false) ? "True" : "False");
  await selectByQuestionName(page, "NotListedHouseHold", (uw.notListedHousehold ?? false) ? "True" : "False");
  await selectByQuestionName(page, "NotListedVehicle", (uw.notListedVehicle ?? false) ? "True" : "False");
  await selectByQuestionName(page, "RideSharing", (uw.rideSharing ?? false) ? "True" : "False");
  await selectByQuestionName(page, "rent_interest", (uw.rentersInterest ?? false) ? "True" : "False");
  await page.click("a#ctl00_MainContent_btnContinue");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
}

async function postbackSelect(page: Page, selector: string, value: string): Promise<void> {
  const current = await page.locator(selector).inputValue().catch(() => "");
  if (current === value) return;
  await page.selectOption(selector, value);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(500).catch(() => undefined);
}

async function fillCoverages(page: Page, cov: NatGenCoverages): Promise<{ bytes: Buffer; iid: string }> {
  await postbackSelect(page, "select[id$='ctl00_ddlPayMethod']", cov.payMethod ?? "AS");
  await postbackSelect(page, "select[id$='ctl00_ddlPayPlan']", cov.payPlan ?? "7076");
  await page.waitForSelector("[id$='ctl09_lblRate']", { state: "visible", timeout: 10000 });
  await page.click("a[id$='ctl09_btnRate']");
  await page.waitForSelector("a#ctl00_MainContent_ctl09_btnViewPrint", { state: "visible", timeout: 30000 });
  const filePathPromise = page.waitForResponse((r) => r.url().includes("GetFilePathFromJob"), { timeout: 30000 });
  await page.click("a#ctl00_MainContent_ctl09_btnViewPrint");
  const filePathResp = await filePathPromise;
  const parsed = (await filePathResp.json()) as { d: string };
  const iid = parsed.d;
  const pdfUrl = `https://natgenagency.com/Policy/DisplayPDF.aspx?iid=${iid}`;
  const pdfResp = await page.request.get(pdfUrl);
  const bytes = await pdfResp.body();
  return { bytes, iid };
}

const LOGIN_URL = "https://natgenagency.com/Login.aspx";

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
      logger.warn("[NationalGeneral] Browser launch attempt failed", {
        attempt: attempt.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function runNationalGeneralPlaywright(
  input: PlaywrightNationalGeneralRunRequest,
  opts?: { jobId?: string },
): Promise<{ pdfPath?: string }> {
  const headless = input.options?.headless ?? false;
  const browser: Browser = await launchChromiumWithFallback({ headless, args: ["--start-maximized"] });
  const page: Page = await browser.newContext({ viewport: null }).then((ctx) => ctx.newPage());
  let currentStep = "initialize";
  const mark = (step: string) => {
    currentStep = step;
  };
  try {
    const payload = normalizeNatGenPayload(input.payload);
    mark("login_open");
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    mark("login_username");
    await page.fill("input#txtUserID", input.credentials.username);
    await page.click("a#btnLogin");
    mark("login_password");
    await page.fill("input#Password", input.credentials.password);
    await page.click("button[alt='SIGN IN']");
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});

    mark("otp_request");
    const clickedAt = await requestNatGenOtp(page);
    const otp = await fetchOtpAfter(input.webhookUrl, clickedAt);
    mark("otp_submit");
    await page.fill("input#TwoFactorCode, input[name='TwoFactorCode']", otp);
    await page.click("button#verifyButton");
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});

    mark("quote_start");
    await page.selectOption("select[name$='ddlState']", "AL");
    await page.selectOption("select[name$='ddlProduct']", "PPAMid");
    await page.click("a[id$='btnContinue']");
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});

    mark("named_insured");
    await fillNamedInsured(page, payload.namedInsured);
    for (let i = 0; i < payload.drivers.length; i++) {
      mark(`driver_${i + 1}`);
      await fillDriver(page, payload.drivers[i], i === payload.drivers.length - 1);
    }
    for (let i = 0; i < payload.vehicles.length; i++) {
      mark(`vehicle_${i + 1}`);
      await fillVehicle(page, payload.vehicles[i], i === payload.vehicles.length - 1);
    }
    mark("vehicle_history");
    await fillVehicleHistory(page, payload.vehicles);
    mark("underwriting");
    await fillUnderwriting(page, payload.underwriting);

    let pdfPath: string | undefined;
    if (payload.coverages) {
      mark("coverages");
      const { bytes } = await fillCoverages(page, payload.coverages);
      const artifactDir = path.resolve(process.cwd(), "playwright-artifacts");
      fs.mkdirSync(artifactDir, { recursive: true });
      pdfPath = path.join(artifactDir, `national-general-${opts?.jobId ?? Date.now()}.pdf`);
      fs.writeFileSync(pdfPath, bytes);
    }
    mark("done");
    return { pdfPath };
  } catch (err) {
    const base = err instanceof Error ? err.message : String(err);
    const url = page.url();
    const enriched = `[NationalGeneral][${currentStep}] ${base} (url=${url})`;
    logger.error("[NationalGeneral] Flow failed", { step: currentStep, url, err });
    throw new Error(enriched);
  } finally {
    await browser.close();
  }
}
