/**
 * Webhook Transform Utilities
 *
 * Transforms quote data from the database format to the webhook payload format
 * for sending to the RPA system.
 */

import type {
  WebhookPayload,
  WebhookMetadata,
  WebhookPersonal,
  WebhookAddress,
  WebhookHomeData,
  WebhookAutoData,
  WebhookDriver,
  WebhookVehicle,
} from '@/types/webhook';
import type { QuoteType } from '@/types/quote';

// Helper to safely get a string value
function getString(data: Record<string, unknown>, key: string, defaultValue = ''): string {
  const value = data[key];
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

// Helper to safely get a number value
function getNumber(data: Record<string, unknown>, key: string, defaultValue = 0): number {
  const value = data[key];
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

// Helper to safely get a boolean value
function getBoolean(data: Record<string, unknown>, key: string, defaultValue = false): boolean {
  const value = data[key];
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

// Transform address from flat fields to structured address
function transformAddress(
  data: Record<string, unknown>,
  prefix: string = ''
): WebhookAddress | undefined {
  const streetKey = prefix ? `${prefix}Address` : 'address';
  const cityKey = prefix ? `${prefix}City` : 'city';
  const stateKey = prefix ? `${prefix}State` : 'state';
  const zipKey = prefix ? `${prefix}ZipCode` : 'zipCode';

  const street = getString(data, streetKey) || getString(data, `${prefix}StreetAddress`);
  const city = getString(data, cityKey);
  const state = getString(data, stateKey);
  const zipCode = getString(data, zipKey);

  if (!street && !city) return undefined;

  return { street, city, state, zipCode };
}

// Transform personal information
function transformPersonal(
  data: Record<string, unknown>,
  quoteType: QuoteType
): WebhookPersonal {
  const personal = (data.personal as Record<string, unknown>) || {};

  // Build address from personal data
  const address: WebhookAddress = {
    street: getString(personal, 'address') || getString(personal, 'streetAddress'),
    city: getString(personal, 'city'),
    state: getString(personal, 'state'),
    zipCode: getString(personal, 'zipCode'),
  };

  // Build prior address if available
  const priorAddress = transformAddress(personal, 'prior');

  return {
    firstName: getString(personal, 'firstName') || getString(personal, 'ownerFirstName'),
    lastName: getString(personal, 'lastName') || getString(personal, 'ownerLastName'),
    dateOfBirth: getString(personal, 'applicantDOB') || getString(personal, 'ownerDOB'),
    ssn: getString(personal, 'applicantSSN'),
    phone: getString(personal, 'phone'),
    email: getString(personal, 'email'),
    maritalStatus: getString(personal, 'maritalStatus'),
    occupation: getString(personal, 'occupation') || getString(personal, 'ownerOccupation'),

    // Spouse info
    spouseFirstName: getString(personal, 'spouseFirstName'),
    spouseLastName: getString(personal, 'spouseLastName'),
    spouseDateOfBirth: getString(personal, 'spouseDOB'),
    spouseSsn: getString(personal, 'spouseSSN'),
    spouseOccupation: getString(personal, 'spouseOccupation'),

    address,
    yearsAtCurrentAddress: getNumber(personal, 'yearsAtCurrentAddress'),
    priorAddress,
  };
}

// Transform home insurance data
function transformHomeData(data: Record<string, unknown>): WebhookHomeData | undefined {
  const property = (data.property as Record<string, unknown>) || {};
  const occupancy = (data.occupancy as Record<string, unknown>) || {};
  const safetyRisk = (data.safetyRisk as Record<string, unknown>) || {};
  const coverage = (data.coverage as Record<string, unknown>) || {};
  const insuranceDetails = (data.insuranceDetails as Record<string, unknown>) || {};
  const scheduledItems = (data.scheduledItems as Record<string, unknown>) || {};

  // Check if we have home data
  if (!property.yearBuilt && !coverage.dwellingCoverage) {
    return undefined;
  }

  return {
    property: {
      yearBuilt: getNumber(property, 'yearBuilt'),
      squareFootage: getNumber(property, 'squareFootage'),
      numberOfStories: getNumber(property, 'numberOfStories'),
      bedroomCount: getNumber(property, 'bedroomCount'),
      bathroomCount: getString(property, 'bathroomCount'),
      dwellingType: getString(property, 'dwellingType'),
      constructionStyle: getString(property, 'constructionStyle'),
      exteriorConstruction: getString(property, 'exteriorConstruction'),
      roofAge: getNumber(property, 'roofAge'),
      roofConstruction: getString(property, 'roofConstruction'),
      roofShape: getString(property, 'roofShape'),
      foundation: getString(property, 'foundation'),
      heatType: getString(property, 'heatType'),
      garageType: getString(property, 'garageType'),
      garageLocation: getString(property, 'garageLocation'),
      purchaseDate: getString(property, 'purchaseDate'),
      condoOrTownhouse: getBoolean(property, 'condoOrTownhouse'),
      specialFeatures: getString(property, 'specialFeatures'),
    },
    occupancy: {
      dwellingOccupancy: getString(occupancy, 'dwellingOccupancy'),
      businessOnPremises: getBoolean(occupancy, 'businessOnPremises'),
      shortTermRental: getBoolean(occupancy, 'shortTermRental'),
      numberOfFamilies: getNumber(occupancy, 'numberOfFamilies', 1),
    },
    safety: {
      alarmSystem: getBoolean(safetyRisk, 'alarmSystem'),
      monitoredAlarm: getBoolean(safetyRisk, 'monitoredAlarm'),
      pool: getBoolean(safetyRisk, 'pool'),
      trampoline: getBoolean(safetyRisk, 'trampoline'),
      dog: getBoolean(safetyRisk, 'dog'),
      dogBreed: getString(safetyRisk, 'dogBreed'),
    },
    coverage: {
      dwellingCoverage: getString(coverage, 'dwellingCoverage'),
      liabilityCoverage: getString(coverage, 'liabilityCoverage'),
      medicalPayments: getString(coverage, 'medicalPayments'),
      deductible: getString(coverage, 'deductible'),
    },
    scheduledItems: {
      jewelry: Array.isArray(scheduledItems.jewelry)
        ? (scheduledItems.jewelry as Array<Record<string, unknown>>).map(item => ({
            description: getString(item, 'description'),
            value: getString(item, 'value'),
          }))
        : undefined,
      otherValuables: Array.isArray(scheduledItems.otherValuables)
        ? (scheduledItems.otherValuables as Array<Record<string, unknown>>).map(item => ({
            description: getString(item, 'description'),
            value: getString(item, 'value'),
          }))
        : undefined,
    },
    insurance: {
      effectiveDate: getString(insuranceDetails, 'effectiveDate'),
      reasonForPolicy: getString(insuranceDetails, 'reasonForPolicy'),
      currentlyInsured: getString(insuranceDetails, 'currentlyInsured'),
      currentInsuranceCompany: getString(insuranceDetails, 'currentInsuranceCompany'),
      currentPolicyNumber: getString(insuranceDetails, 'policyNumber'),
      escrowed: getBoolean(insuranceDetails, 'escrowed'),
      lienholder: getString(insuranceDetails, 'lienholderName')
        ? {
            name: getString(insuranceDetails, 'lienholderName'),
            address: getString(insuranceDetails, 'lienholderAddress'),
            city: getString(insuranceDetails, 'lienholderCity'),
            state: getString(insuranceDetails, 'lienholderState'),
            zipCode: getString(insuranceDetails, 'lienholderZip'),
          }
        : undefined,
    },
  };
}

// Transform auto insurance data
function transformAutoData(
  data: Record<string, unknown>,
  personal: WebhookPersonal
): WebhookAutoData | undefined {
  const personalData = (data.personal as Record<string, unknown>) || {};
  const coverageData = (data.coverage as Record<string, unknown>) || {};
  const vehiclesData = (data.vehicles as Array<Record<string, unknown>>) || [];
  const driversData = (data.additionalDrivers as Array<Record<string, unknown>>) || [];
  const priorInsuranceData = (data.priorInsurance as Record<string, unknown>) || {};
  const incidentsData = (data.accidentsOrTickets as Array<Record<string, unknown>>) || [];
  const lienholdersData = (data.lienholders as Array<Record<string, unknown>>) || [];

  // Check if we have auto data
  if (vehiclesData.length === 0 && !coverageData.bodilyInjury) {
    return undefined;
  }

  // Build garaging address (same as mailing if flag is set)
  const garagingSameAsMailing = getBoolean(personalData, 'garagingAddressSameAsMailing', true);
  const garagingAddress: WebhookAddress = garagingSameAsMailing
    ? personal.address
    : {
        street: getString(personalData, 'garagingStreetAddress'),
        city: getString(personalData, 'garagingCity'),
        state: getString(personalData, 'garagingState'),
        zipCode: getString(personalData, 'garagingZipCode'),
      };

  // Build drivers list - always include primary insured and spouse
  const drivers: WebhookDriver[] = [];

  // Primary insured driver
  drivers.push({
    firstName: personal.firstName,
    lastName: personal.lastName,
    dateOfBirth: personal.dateOfBirth,
    driversLicense: getString(personalData, 'ownerDriversLicense'),
    licenseState: getString(personalData, 'ownerLicenseState'),
    relationship: 'Primary Insured',
    occupation: personal.occupation,
    education: getString(personalData, 'ownerEducation'),
  });

  // Spouse driver (if present)
  if (personal.spouseFirstName) {
    drivers.push({
      firstName: personal.spouseFirstName,
      lastName: personal.spouseLastName || personal.lastName,
      dateOfBirth: personal.spouseDateOfBirth || '',
      driversLicense: getString(personalData, 'spouseDriversLicense'),
      licenseState: getString(personalData, 'spouseLicenseState'),
      relationship: 'Spouse',
      occupation: personal.spouseOccupation,
      education: getString(personalData, 'spouseEducation'),
    });
  }

  // Additional drivers
  for (const driver of driversData) {
    drivers.push({
      firstName: getString(driver, 'firstName'),
      lastName: getString(driver, 'lastName'),
      dateOfBirth: getString(driver, 'dateOfBirth'),
      driversLicense: getString(driver, 'licenseNumber'),
      licenseState: getString(driver, 'licenseState'),
      relationship: getString(driver, 'relationship'),
      goodStudentDiscount: getBoolean(driver, 'goodStudentDiscount'),
    });
  }

  // Build vehicles list with deductibles
  const vehicles: WebhookVehicle[] = vehiclesData.map((vehicle, index) => {
    // Find matching lienholder
    const lienholder = lienholdersData.find(lh =>
      getString(lh, 'vehicleReference').includes(`Vehicle ${index + 1}`)
    );

    return {
      year: getNumber(vehicle, 'year'),
      make: getString(vehicle, 'make'),
      model: getString(vehicle, 'model'),
      vin: getString(vehicle, 'vin'),
      usage: getString(vehicle, 'vehicleUsage'),
      estimatedMileage: getNumber(vehicle, 'estimatedMileage'),
      ownership: getString(vehicle, 'ownership'),
      comprehensiveDeductible: getString(vehicle, 'comprehensiveDeductible'),
      collisionDeductible: getString(vehicle, 'collisionDeductible'),
      lienholder: lienholder
        ? {
            name: getString(lienholder, 'lienholderName'),
            address: getString(lienholder, 'lienholderAddress'),
            city: getString(lienholder, 'lienholderCity'),
            state: getString(lienholder, 'lienholderState'),
            zipCode: getString(lienholder, 'lienholderZip'),
          }
        : undefined,
    };
  });

  return {
    effectiveDate: getString(personalData, 'effectiveDate'),
    garagingAddress,
    garagingAddressSameAsMailing: garagingSameAsMailing,
    rideShare: getBoolean(personalData, 'rideShare'),
    delivery: getBoolean(personalData, 'delivery'),
    drivers,
    vehicles,
    coverage: {
      bodilyInjury: getString(coverageData, 'bodilyInjury'),
      propertyDamage: getString(coverageData, 'propertyDamage'),
      uninsuredMotorist: getString(coverageData, 'uninsuredMotorist'),
      underinsuredMotorist: getString(coverageData, 'underinsuredMotorist'),
      medicalPayments: getString(coverageData, 'medicalPayments'),
      towing: getBoolean(coverageData, 'towing'),
      rental: getBoolean(coverageData, 'rental'),
    },
    priorInsurance: getString(priorInsuranceData, 'insuranceCompany')
      ? {
          company: getString(priorInsuranceData, 'insuranceCompany'),
          premium: getString(priorInsuranceData, 'premium'),
          policyNumber: getString(priorInsuranceData, 'policyNumber'),
          expirationDate: getString(priorInsuranceData, 'expirationDate'),
        }
      : undefined,
    incidents: incidentsData.map(incident => ({
      type: getString(incident, 'type'),
      date: getString(incident, 'date'),
      description: getString(incident, 'description'),
      driverName: getString(incident, 'driver'),
    })),
  };
}

/**
 * Transform quote data to webhook payload format
 *
 * @param quoteId - The quote ID
 * @param extractionId - The extraction ID
 * @param userId - The user ID
 * @param filename - Original PDF filename
 * @param quoteData - The stored quote data from the database
 * @returns WebhookPayload ready to send to RPA system
 */
export function transformToWebhookPayload(
  quoteId: string,
  extractionId: string,
  userId: string,
  filename: string,
  quoteData: Record<string, unknown>
): WebhookPayload {
  const quoteType = (quoteData.quoteType as QuoteType) || 'both';
  const data = (quoteData.data as Record<string, unknown>) || quoteData;
  const submittedAt = (quoteData.submittedAt as string) || new Date().toISOString();

  // Build metadata
  const metadata: WebhookMetadata = {
    quoteId,
    extractionId,
    userId,
    filename,
    submittedAt,
    quoteType,
    version: '1.0.0',
  };

  // Transform personal information
  const personal = transformPersonal(data, quoteType);

  // Transform home data if applicable
  const home = quoteType === 'home' || quoteType === 'both'
    ? transformHomeData(data)
    : undefined;

  // Transform auto data if applicable
  const auto = quoteType === 'auto' || quoteType === 'both'
    ? transformAutoData(data, personal)
    : undefined;

  return {
    metadata,
    personal,
    home,
    auto,
  };
}

/**
 * Placeholder function for sending webhook
 * TODO: Implement actual webhook sending when URL is available
 */
export async function sendToWebhook(
  payload: WebhookPayload,
  webhookUrl?: string
): Promise<{ success: boolean; message: string; payload: WebhookPayload }> {
  // For now, just log and return the payload
  console.log('[Webhook] Payload prepared for submission:', JSON.stringify(payload, null, 2));

  if (!webhookUrl) {
    return {
      success: true,
      message: 'Webhook payload prepared (no webhook URL configured)',
      payload,
    };
  }

  // TODO: Implement actual POST to webhook URL when available
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return {
    success: true,
    message: 'Webhook payload prepared',
    payload,
  };
}
