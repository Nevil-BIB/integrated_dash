/**
 * Data transformation utilities for extraction results
 *
 * Handles conversion between different extraction data formats:
 * - API format (HomeApiExtractionResult/AutoApiExtractionResult) -> UI format (HomeExtractionResult/AutoExtractionResult)
 * - Legacy ExtractionResult -> HomeExtractionResult/AutoExtractionResult
 * - Detection of extraction data types
 *
 * ## Auto Insurance Field Mapping (API -> UI)
 *
 * For Auto insurance, the API types and UI types are STRUCTURALLY IDENTICAL.
 * Both use the same interface names and field structures. The transformation
 * is primarily about ensuring data integrity and handling edge cases.
 *
 * ### Personal Info (AutoPersonalInfo - identical structure)
 * API Field Path                    | UI Field Path                      | Type Conversion
 * ----------------------------------|------------------------------------|-----------------
 * personal.ownerFirstName           | personal.ownerFirstName            | ExtractionField (pass-through)
 * personal.ownerLastName            | personal.ownerLastName             | ExtractionField (pass-through)
 * personal.ownerDOB                 | personal.ownerDOB                  | ExtractionField (pass-through)
 * personal.spouseFirstName          | personal.spouseFirstName           | ExtractionField (pass-through)
 * personal.spouseLastName           | personal.spouseLastName            | ExtractionField (pass-through)
 * personal.spouseDOB                | personal.spouseDOB                 | ExtractionField (pass-through)
 * personal.streetAddress            | personal.streetAddress             | ExtractionField (pass-through)
 * personal.city                     | personal.city                      | ExtractionField (pass-through)
 * personal.state                    | personal.state                     | ExtractionField (pass-through)
 * personal.zipCode                  | personal.zipCode                   | ExtractionField (pass-through)
 * personal.priorStreetAddress       | personal.priorStreetAddress        | ExtractionField (pass-through)
 * personal.priorCity                | personal.priorCity                 | ExtractionField (pass-through)
 * personal.priorState               | personal.priorState                | ExtractionField (pass-through)
 * personal.priorZipCode             | personal.priorZipCode              | ExtractionField (pass-through)
 * personal.yearsAtCurrentAddress    | personal.yearsAtCurrentAddress     | ExtractionField (pass-through)
 * personal.phone                    | personal.phone                     | ExtractionField (pass-through)
 * personal.email                    | personal.email                     | ExtractionField (pass-through)
 * personal.ownerDriversLicense      | personal.ownerDriversLicense       | ExtractionField (pass-through)
 * personal.ownerLicenseState        | personal.ownerLicenseState         | ExtractionField (pass-through)
 * personal.spouseDriversLicense     | personal.spouseDriversLicense      | ExtractionField (pass-through)
 * personal.spouseLicenseState       | personal.spouseLicenseState        | ExtractionField (pass-through)
 * personal.ownerOccupation          | personal.ownerOccupation           | ExtractionField (pass-through)
 * personal.spouseOccupation         | personal.spouseOccupation          | ExtractionField (pass-through)
 * personal.ownerEducation           | personal.ownerEducation            | ExtractionField (pass-through)
 * personal.spouseEducation          | personal.spouseEducation           | ExtractionField (pass-through)
 * personal.rideShare                | personal.rideShare                 | ExtractionBooleanField (pass-through)
 * personal.delivery                 | personal.delivery                  | ExtractionBooleanField (pass-through)
 *
 * ### Additional Drivers (AutoAdditionalDriver[] - array, identical structure)
 * API Field Path                    | UI Field Path                      | Type Conversion
 * ----------------------------------|------------------------------------|-----------------
 * additionalDrivers[n].firstName    | additionalDrivers[n].firstName     | ExtractionField (pass-through)
 * additionalDrivers[n].lastName     | additionalDrivers[n].lastName      | ExtractionField (pass-through)
 * additionalDrivers[n].dateOfBirth  | additionalDrivers[n].dateOfBirth   | ExtractionField (pass-through)
 * additionalDrivers[n].licenseNumber| additionalDrivers[n].licenseNumber | ExtractionField (pass-through)
 * additionalDrivers[n].licenseState | additionalDrivers[n].licenseState  | ExtractionField (pass-through)
 * additionalDrivers[n].relationship | additionalDrivers[n].relationship  | ExtractionField (pass-through)
 * additionalDrivers[n].goodStudentDiscount | additionalDrivers[n].goodStudentDiscount | ExtractionBooleanField (pass-through)
 * additionalDrivers[n].vehicleAssigned | additionalDrivers[n].vehicleAssigned | ExtractionField (pass-through)
 *
 * ### Vehicles (AutoVehicle[] - array, identical structure)
 * API Field Path                    | UI Field Path                      | Type Conversion
 * ----------------------------------|------------------------------------|-----------------
 * vehicles[n].year                  | vehicles[n].year                   | ExtractionField (pass-through)
 * vehicles[n].make                  | vehicles[n].make                   | ExtractionField (pass-through)
 * vehicles[n].model                 | vehicles[n].model                  | ExtractionField (pass-through)
 * vehicles[n].vin                   | vehicles[n].vin                    | ExtractionField (pass-through)
 * vehicles[n].estimatedMileage      | vehicles[n].estimatedMileage       | ExtractionField (pass-through)
 * vehicles[n].vehicleUsage          | vehicles[n].vehicleUsage           | ExtractionField (pass-through)
 * vehicles[n].ownership             | vehicles[n].ownership              | ExtractionField (pass-through)
 *
 * ### Coverage (AutoCoverageInfo - identical structure)
 * API Field Path                    | UI Field Path                      | Type Conversion
 * ----------------------------------|------------------------------------|-----------------
 * coverage.bodilyInjury             | coverage.bodilyInjury              | ExtractionField (pass-through)
 * coverage.propertyDamage           | coverage.propertyDamage            | ExtractionField (pass-through)
 * coverage.uninsuredMotorist        | coverage.uninsuredMotorist         | ExtractionField (pass-through)
 * coverage.underinsuredMotorist     | coverage.underinsuredMotorist      | ExtractionField (pass-through)
 * coverage.medicalPayments          | coverage.medicalPayments           | ExtractionField (pass-through)
 * coverage.towing                   | coverage.towing                    | ExtractionBooleanField (pass-through)
 * coverage.rental                   | coverage.rental                    | ExtractionBooleanField (pass-through)
 *
 * ### Vehicle Deductibles (now part of vehicles[] array)
 * API Field Path                           | UI Field Path                            | Type Conversion
 * -----------------------------------------|------------------------------------------|-----------------
 * vehicles[n].comprehensiveDeductible      | vehicles[n].comprehensiveDeductible      | ExtractionField (pass-through)
 * vehicles[n].collisionDeductible          | vehicles[n].collisionDeductible          | ExtractionField (pass-through)
 * vehicles[n].roadTroubleService           | vehicles[n].roadTroubleService           | ExtractionField (pass-through)
 * vehicles[n].limitedTNCCoverage           | vehicles[n].limitedTNCCoverage           | ExtractionBooleanField (pass-through)
 * vehicles[n].additionalExpenseCoverage    | vehicles[n].additionalExpenseCoverage    | ExtractionField (pass-through)
 *
 * ### Lienholders (AutoVehicleLienholder[] - array, identical structure)
 * API Field Path                    | UI Field Path                      | Type Conversion
 * ----------------------------------|------------------------------------|-----------------
 * lienholders[n].vehicleReference   | lienholders[n].vehicleReference    | ExtractionField (pass-through)
 * lienholders[n].lienholderName     | lienholders[n].lienholderName      | ExtractionField (pass-through)
 * lienholders[n].lienholderAddress  | lienholders[n].lienholderAddress   | ExtractionField (pass-through)
 * lienholders[n].lienholderCity     | lienholders[n].lienholderCity      | ExtractionField (pass-through)
 * lienholders[n].lienholderState    | lienholders[n].lienholderState     | ExtractionField (pass-through)
 * lienholders[n].lienholderZip      | lienholders[n].lienholderZip       | ExtractionField (pass-through)
 *
 * ### Prior Insurance (AutoPriorInsurance - identical structure)
 * API Field Path                    | UI Field Path                      | Type Conversion
 * ----------------------------------|------------------------------------|-----------------
 * priorInsurance.insuranceCompany   | priorInsurance.insuranceCompany    | ExtractionField (pass-through)
 * priorInsurance.premium            | priorInsurance.premium             | ExtractionField (pass-through)
 * priorInsurance.policyNumber       | priorInsurance.policyNumber        | ExtractionField (pass-through)
 * priorInsurance.expirationDate     | priorInsurance.expirationDate      | ExtractionField (pass-through)
 *
 * ### Accidents/Tickets (AutoAccidentOrTicket[] - array, identical structure)
 * API Field Path                    | UI Field Path                      | Type Conversion
 * ----------------------------------|------------------------------------|-----------------
 * accidentsOrTickets[n].driverName  | accidentsOrTickets[n].driverName   | ExtractionField (pass-through)
 * accidentsOrTickets[n].date        | accidentsOrTickets[n].date         | ExtractionField (pass-through)
 * accidentsOrTickets[n].type        | accidentsOrTickets[n].type         | ExtractionField (pass-through)
 * accidentsOrTickets[n].description | accidentsOrTickets[n].description  | ExtractionField (pass-through)
 * accidentsOrTickets[n].amount      | accidentsOrTickets[n].amount       | ExtractionField (pass-through)
 * accidentsOrTickets[n].atFault     | accidentsOrTickets[n].atFault      | ExtractionField (pass-through)
 */

import {
  ExtractionField,
  ExtractionBooleanField,
  ExtractionResult,
  CombinedExtractionData,
  HomeApiExtractionResult,
  AutoApiExtractionResult,
  AutoAdditionalDriver,
  AutoVehicle,
  AutoVehicleLienholder,
  AutoAccidentOrTicket,
  AutoSpecificPersonalInfo,
} from '@/types/extraction'
import {
  HomeExtractionResult,
  createEmptyHomeExtraction,
  createEmptyExtractionField as createEmptyHomeField,
} from '@/types/home-extraction'
import {
  AutoExtractionResult,
  createEmptyAutoExtraction,
  createEmptyExtractionField as createEmptyAutoField,
  createEmptyBooleanField,
} from '@/types/auto-extraction'
import { CombinedUiExtractionData } from '@/types/database'

export type DetectedQuoteType = 'home' | 'auto' | 'both' | 'legacy' | 'unknown' | 'home_api' | 'auto_api'

/**
 * Detect the type of extraction data based on its structure
 */
export function detectExtractionType(data: unknown): DetectedQuoteType {
  if (!data || typeof data !== 'object') {
    console.log('[Transform] detectExtractionType: data is null or not an object')
    return 'unknown'
  }

  const record = data as Record<string, unknown>
  console.log('[Transform] detectExtractionType: keys =', Object.keys(record))

  // Check for CombinedExtractionData (API format with shared)
  if ('quoteType' in record && 'shared' in record) {
    console.log('[Transform] detectExtractionType: CombinedExtractionData detected')
    return record.quoteType as 'home' | 'auto' | 'both'
  }

  // Check for CombinedUiExtractionData (UI format with home/auto objects)
  if ('quoteType' in record && record.quoteType === 'both' && ('home' in record || 'auto' in record)) {
    console.log('[Transform] detectExtractionType: CombinedUiExtractionData detected')
    return 'both'
  }

  // Check for HomeExtractionResult (UI format)
  // Has: personal, property, safetyRisk, coverage, scheduledItems, claimsHistory, insuranceDetails, updates
  if (
    'property' in record &&
    'safetyRisk' in record &&
    'scheduledItems' in record &&
    'claimsHistory' in record &&
    'insuranceDetails' in record &&
    'updates' in record
  ) {
    console.log('[Transform] detectExtractionType: HomeExtractionResult (UI format) detected')
    return 'home'
  }

  // Check for HomeApiExtractionResult (API format)
  // Has: personal, property, safety, coverage, claims, lienholder, updates
  if (
    'personal' in record &&
    'property' in record &&
    'safety' in record &&
    'coverage' in record &&
    'claims' in record &&
    'lienholder' in record &&
    'updates' in record
  ) {
    console.log('[Transform] detectExtractionType: HomeApiExtractionResult (API format) detected')
    return 'home_api'
  }

  // Check for AutoExtractionResult (UI format) or AutoApiExtractionResult (API format).
  // Top-level `deductibles` is optional/legacy; newer flows keep deductibles on each vehicle.
  if (
    'personal' in record &&
    'coverage' in record &&
    'additionalDrivers' in record &&
    'vehicles' in record &&
    'lienholders' in record &&
    'priorInsurance' in record &&
    'accidentsOrTickets' in record
  ) {
    console.log('[Transform] detectExtractionType: AutoExtractionResult detected')
    // Auto API and UI formats have the same structure, return 'auto' for both
    return 'auto'
  }

  // Check for legacy ExtractionResult
  // Has: personal, employment, coverage, beneficiary, health, policies, financials
  if (
    'employment' in record &&
    'beneficiary' in record &&
    'health' in record &&
    'policies' in record &&
    'financials' in record
  ) {
    console.log('[Transform] detectExtractionType: Legacy ExtractionResult detected')
    return 'legacy'
  }

  console.log('[Transform] detectExtractionType: unknown format')
  return 'unknown'
}

/**
 * Helper to create a field from a legacy field or default
 */
function createFieldFromLegacy(
  legacyField: ExtractionField | undefined
): ExtractionField {
  if (legacyField) {
    return { ...legacyField }
  }
  return createEmptyHomeField()
}

/**
 * Transform legacy ExtractionResult to HomeExtractionResult
 */
export function legacyToHomeExtraction(
  legacy: ExtractionResult
): HomeExtractionResult {
  const result = createEmptyHomeExtraction()

  // Map personal info
  if (legacy.personal) {
    result.personal.firstName = createFieldFromLegacy(legacy.personal.firstName)
    result.personal.lastName = createFieldFromLegacy(legacy.personal.lastName)
    result.personal.applicantDOB = createFieldFromLegacy(legacy.personal.dateOfBirth)
    result.personal.applicantSSN = createFieldFromLegacy(legacy.personal.ssn)
    result.personal.address = createFieldFromLegacy(legacy.personal.address)
    result.personal.city = createFieldFromLegacy(legacy.personal.city)
    result.personal.state = createFieldFromLegacy(legacy.personal.state)
    result.personal.zipCode = createFieldFromLegacy(legacy.personal.zipCode)
    result.personal.phone = createFieldFromLegacy(legacy.personal.phone)
    result.personal.email = createFieldFromLegacy(legacy.personal.email)
  }

  // Map coverage info
  if (legacy.coverage) {
    // Legacy coverage.types might contain coverage details
    if (legacy.coverage.types?.value) {
      result.coverage.dwellingCoverage = createFieldFromLegacy(legacy.coverage.types)
    }
    if (legacy.coverage.amounts?.value) {
      result.coverage.liabilityCoverage = createFieldFromLegacy(legacy.coverage.amounts)
    }
  }

  return result
}

/**
 * Transform legacy ExtractionResult to AutoExtractionResult
 */
export function legacyToAutoExtraction(
  legacy: ExtractionResult
): AutoExtractionResult {
  const result = createEmptyAutoExtraction()

  // Map personal info
  if (legacy.personal) {
    result.personal.ownerFirstName = createFieldFromLegacy(legacy.personal.firstName)
    result.personal.ownerLastName = createFieldFromLegacy(legacy.personal.lastName)
    result.personal.ownerDOB = createFieldFromLegacy(legacy.personal.dateOfBirth)
    result.personal.streetAddress = createFieldFromLegacy(legacy.personal.address)
    result.personal.city = createFieldFromLegacy(legacy.personal.city)
    result.personal.state = createFieldFromLegacy(legacy.personal.state)
    result.personal.zipCode = createFieldFromLegacy(legacy.personal.zipCode)
    result.personal.phone = createFieldFromLegacy(legacy.personal.phone)
    result.personal.email = createFieldFromLegacy(legacy.personal.email)
  }

  // Map employment info to occupation
  if (legacy.employment?.occupation) {
    result.personal.ownerOccupation = createFieldFromLegacy(legacy.employment.occupation)
  }

  return result
}

/**
 * Helper to convert boolean field to string field for UI
 */
function booleanFieldToStringField(
  field: ExtractionBooleanField | undefined
): ExtractionField {
  if (!field) {
    return createEmptyHomeField()
  }
  return {
    value: field.value === null ? null : field.value ? 'Yes' : 'No',
    confidence: field.confidence,
    flagged: field.flagged,
    rawText: field.rawText,
  }
}

/**
 * Transform HomeApiExtractionResult (API format) to HomeExtractionResult (UI format)
 */
export function homeApiToUiExtraction(
  api: HomeApiExtractionResult
): HomeExtractionResult {
  console.log('[Transform] homeApiToUiExtraction: transforming API format to UI format')
  const result = createEmptyHomeExtraction()

  // Map personal info - API uses firstName/lastName, UI uses same
  if (api.personal) {
    result.personal.firstName = createFieldFromLegacy(api.personal.firstName)
    result.personal.lastName = createFieldFromLegacy(api.personal.lastName)
    result.personal.spouseFirstName = createFieldFromLegacy(api.personal.spouseFirstName)
    result.personal.spouseLastName = createFieldFromLegacy(api.personal.spouseLastName)
    result.personal.address = createFieldFromLegacy(api.personal.streetAddress)
    result.personal.city = createFieldFromLegacy(api.personal.city)
    result.personal.state = createFieldFromLegacy(api.personal.state)
    result.personal.zipCode = createFieldFromLegacy(api.personal.zipCode)
    result.personal.priorAddress = createFieldFromLegacy(api.personal.priorStreetAddress)
    result.personal.priorCity = createFieldFromLegacy(api.personal.priorCity)
    result.personal.priorState = createFieldFromLegacy(api.personal.priorState)
    result.personal.priorZipCode = createFieldFromLegacy(api.personal.priorZipCode)
    result.personal.yearsAtCurrentAddress = createFieldFromLegacy(api.personal.yearsAtCurrentAddress)
    result.personal.phone = createFieldFromLegacy(api.personal.phone)
    result.personal.email = createFieldFromLegacy(api.personal.email)
    result.personal.applicantDOB = createFieldFromLegacy(api.personal.dateOfBirth)
    result.personal.spouseDOB = createFieldFromLegacy(api.personal.spouseDateOfBirth)
    result.personal.applicantSSN = createFieldFromLegacy(api.personal.ssn)
    result.personal.spouseSSN = createFieldFromLegacy(api.personal.spouseSsn)
  }

  // Map property info
  if (api.property) {
    result.property.purchaseDate = createFieldFromLegacy(api.property.purchaseDate)
    result.property.yearBuilt = createFieldFromLegacy(api.property.yearBuilt)
    result.property.squareFootage = createFieldFromLegacy(api.property.squareFootage)
    result.property.numberOfStories = createFieldFromLegacy(api.property.numberOfStories)
    result.property.kitchenCount = createFieldFromLegacy(api.property.numberOfKitchens)
    result.property.kitchenStyle = createFieldFromLegacy(api.property.kitchenStyle)
    result.property.bathroomCount = createFieldFromLegacy(api.property.numberOfBathrooms)
    result.property.bathroomStyle = createFieldFromLegacy(api.property.bathroomStyle)
    result.property.flooringPercentage = createFieldFromLegacy(api.property.flooringPercentage)
    result.property.heatType = createFieldFromLegacy(api.property.heatType)
    result.property.exteriorConstruction = createFieldFromLegacy(api.property.exteriorConstruction)
    result.property.exteriorFeatures = createFieldFromLegacy(api.property.exteriorFeatures)
    result.property.fireplaceCount = createFieldFromLegacy(api.property.numberOfFireplaces)
    result.property.fireplaceType = createFieldFromLegacy(api.property.fireplaceType)
    result.property.roofAge = createFieldFromLegacy(api.property.roofAge)
    result.property.roofConstruction = createFieldFromLegacy(api.property.roofConstruction)
    result.property.foundation = createFieldFromLegacy(api.property.foundationType)
    result.property.finishedBasement = booleanFieldToStringField(api.property.hasFinishedBasement)
    result.property.garageType = createFieldFromLegacy(api.property.garageType)
    result.property.garageLocation = createFieldFromLegacy(api.property.numberOfCarGarage)
    result.property.deckPatioDetails = createFieldFromLegacy(api.property.deckPatioDetails)
    result.property.condoOrTownhouse = booleanFieldToStringField(api.property.isCondoOrTownhouse)
    result.property.specialFeatures = createFieldFromLegacy(api.property.specialFeatures)
  }

  if (api.householdMember) {
    result.householdMember.firstName = createFieldFromLegacy(api.householdMember.firstName)
    result.householdMember.lastName = createFieldFromLegacy(api.householdMember.lastName)
    result.householdMember.suffix = createFieldFromLegacy(api.householdMember.suffix)
    result.householdMember.dob = createFieldFromLegacy(api.householdMember.dob)
    result.householdMember.ssn = createFieldFromLegacy(api.householdMember.ssn)
    result.householdMember.relationship = createFieldFromLegacy(api.householdMember.relationship)
    result.householdMember.maritalStatus = createFieldFromLegacy(api.householdMember.maritalStatus)
    result.householdMember.dlState = createFieldFromLegacy(api.householdMember.dlState)
    result.householdMember.dlNumber = createFieldFromLegacy(api.householdMember.dlNumber)
  }

  if (api.locationDetail) {
    result.locationDetail.locationOccupancy = createFieldFromLegacy(api.locationDetail.locationOccupancy)
    result.locationDetail.ownerOccupied = createFieldFromLegacy(api.locationDetail.ownerOccupied)
    result.locationDetail.vacant = createFieldFromLegacy(api.locationDetail.vacant)
    result.locationDetail.liabilityCoverageOnly = createFieldFromLegacy(api.locationDetail.liabilityCoverageOnly)
    result.locationDetail.personalPropertyOnly = createFieldFromLegacy(api.locationDetail.personalPropertyOnly)
  }

  if (api.locationInformation) {
    const source = api.locationInformation
    const target = result.locationInformation
    for (const key of Object.keys(source) as Array<keyof typeof source>) {
      if (key in target) {
        target[key] = createFieldFromLegacy(source[key])
      }
    }
  }

  if (api.policyQuestions) {
    const source = api.policyQuestions
    const target = result.policyQuestions
    for (const key of Object.keys(source) as Array<keyof typeof source>) {
      if (key in target) {
        target[key] = createFieldFromLegacy(source[key])
      }
    }
  }

  if (api.locationSpecificQuestions) {
    const source = api.locationSpecificQuestions
    const target = result.locationSpecificQuestions
    for (const key of Object.keys(source) as Array<keyof typeof source>) {
      if (key in target) {
        target[key] = createFieldFromLegacy(source[key])
      }
    }
  }

  // Map safety info (API: safety -> UI: safetyRisk)
  if (api.safety) {
    result.safetyRisk.alarmSystem = booleanFieldToStringField(api.safety.hasAlarmSystem)
    result.safetyRisk.monitoredAlarm = booleanFieldToStringField(api.safety.isAlarmMonitored)
    result.safetyRisk.pool = booleanFieldToStringField(api.safety.hasPool)
    result.safetyRisk.trampoline = booleanFieldToStringField(api.safety.hasTrampoline)
    result.safetyRisk.enclosedYard = booleanFieldToStringField(api.safety.hasEnclosedYard)
    result.safetyRisk.dog = booleanFieldToStringField(api.safety.hasDog)
    result.safetyRisk.dogBreed = createFieldFromLegacy(api.safety.dogBreed)
  }

  // Map coverage info
  if (api.coverage) {
    result.coverage.dwellingCoverage = createFieldFromLegacy(api.coverage.dwellingCoverage)
    result.coverage.liabilityCoverage = createFieldFromLegacy(api.coverage.liabilityCoverage)
    result.coverage.medicalPayments = createFieldFromLegacy(api.coverage.medicalPayments)
    result.coverage.deductible = createFieldFromLegacy(api.coverage.deductible)
  }

  // Map claims info (API: claims -> UI: claimsHistory)
  // Note: API has a simple structure, UI expects array of claims
  // For now, create a single claim entry if data exists
  if (api.claims) {
    // The API claims structure is different - it has claimsInLast5Years, numberOfClaims, claimDetails
    // We'll parse this into the UI format as best we can
    if (api.claims.claimDetails?.value) {
      // Try to create claim entries from the details
      result.claimsHistory.claims = [{
        date: createEmptyHomeField(),
        type: createFieldFromLegacy(api.claims.claimsInLast5Years),
        description: createFieldFromLegacy(api.claims.claimDetails),
        amount: createEmptyHomeField(),
      }]
    }
  }

  // Map lienholder info (API: lienholder -> UI: insuranceDetails)
  if (api.lienholder) {
    result.insuranceDetails.lienholderName = createFieldFromLegacy(api.lienholder.lienholderName)
    result.insuranceDetails.lienholderAddress = createFieldFromLegacy(api.lienholder.lienholderAddress)
    // Note: API has loanNumber, UI has lienholderCity/State/Zip split differently
    result.insuranceDetails.currentInsuranceCompany = createFieldFromLegacy(api.lienholder.currentInsuranceCompany)
    result.insuranceDetails.policyNumber = createFieldFromLegacy(api.lienholder.currentPolicyNumber)
    result.insuranceDetails.effectiveDate = createFieldFromLegacy(api.lienholder.currentEffectiveDate)
    result.insuranceDetails.currentPremium = createFieldFromLegacy(api.lienholder.currentPremium)
    result.insuranceDetails.escrowed = booleanFieldToStringField(api.lienholder.isEscrowed)
    result.insuranceDetails.insuranceCancelledDeclined = booleanFieldToStringField(api.lienholder.hasBeenCancelledOrDeclined)
    result.insuranceDetails.referredBy = createFieldFromLegacy(api.lienholder.referredBy)
  }

  // Map updates info
  if (api.updates) {
    result.updates.hvacYear = createFieldFromLegacy(api.updates.hvacUpdateYear)
    result.updates.plumbingYear = createFieldFromLegacy(api.updates.plumbingUpdateYear)
    result.updates.roofYear = createFieldFromLegacy(api.updates.roofUpdateYear)
    result.updates.electricalYear = createFieldFromLegacy(api.updates.electricalUpdateYear)
    result.updates.circuitBreakers = booleanFieldToStringField(api.updates.hasCircuitBreakers)
    // Create implied update flags based on year values
    result.updates.hvacUpdate = api.updates.hvacUpdateYear?.value ? { value: 'Yes', confidence: 'high', flagged: false } : createEmptyHomeField()
    result.updates.plumbingUpdate = api.updates.plumbingUpdateYear?.value ? { value: 'Yes', confidence: 'high', flagged: false } : createEmptyHomeField()
    result.updates.roofUpdate = api.updates.roofUpdateYear?.value ? { value: 'Yes', confidence: 'high', flagged: false } : createEmptyHomeField()
    result.updates.electricalUpdate = api.updates.electricalUpdateYear?.value ? { value: 'Yes', confidence: 'high', flagged: false } : createEmptyHomeField()
  }

  console.log('[Transform] homeApiToUiExtraction: transformation complete')
  return result
}

/**
 * Helper to ensure an ExtractionField exists or create a default
 */
function ensureField(field: ExtractionField | undefined): ExtractionField {
  if (field && field.value !== undefined) {
    return { ...field }
  }
  return createEmptyAutoField()
}

/**
 * Helper to ensure an ExtractionBooleanField exists or create a default
 */
function ensureBooleanField(field: ExtractionBooleanField | undefined): ExtractionBooleanField {
  if (field && field.value !== undefined) {
    return { ...field }
  }
  return createEmptyBooleanField()
}

/**
 * Transform AutoApiExtractionResult (API format) to AutoExtractionResult (UI format)
 * While the structures are identical, this ensures all fields are properly initialized
 * and handles any missing/null values gracefully.
 */
export function autoApiToUiExtraction(
  api: AutoApiExtractionResult
): AutoExtractionResult {
  console.log('[Transform] autoApiToUiExtraction: transforming API format to UI format')
  console.log('[Transform] autoApiToUiExtraction: API personal data:', api.personal ? Object.keys(api.personal) : 'null')
  console.log('[Transform] autoApiToUiExtraction: API vehicles count:', api.vehicles?.length ?? 0)
  console.log('[Transform] autoApiToUiExtraction: API additionalDrivers count:', api.additionalDrivers?.length ?? 0)

  const result = createEmptyAutoExtraction()

  // Transform personal info - ensure all fields exist
  if (api.personal) {
    const p = api.personal
    result.personal = {
      // Policy effective date
      effectiveDate: ensureField(p.effectiveDate),
      // Owner info
      ownerFirstName: ensureField(p.ownerFirstName),
      ownerLastName: ensureField(p.ownerLastName),
      ownerDOB: ensureField(p.ownerDOB),
      maritalStatus: ensureField(p.maritalStatus),
      // Spouse fields (conditional: only if maritalStatus is Married or Domestic Partner)
      spouseFirstName: ensureField(p.spouseFirstName),
      spouseLastName: ensureField(p.spouseLastName),
      spouseDOB: ensureField(p.spouseDOB),
      // Mailing address
      streetAddress: ensureField(p.streetAddress),
      city: ensureField(p.city),
      state: ensureField(p.state),
      zipCode: ensureField(p.zipCode),
      // Garaging address (conditional: only if garagingAddressSameAsMailing is No)
      garagingAddressSameAsMailing: ensureBooleanField(p.garagingAddressSameAsMailing),
      garagingStreetAddress: ensureField(p.garagingStreetAddress),
      garagingCity: ensureField(p.garagingCity),
      garagingState: ensureField(p.garagingState),
      garagingZipCode: ensureField(p.garagingZipCode),
      // Prior address (conditional: required if yearsAtCurrentAddress < 5)
      priorStreetAddress: ensureField(p.priorStreetAddress),
      priorCity: ensureField(p.priorCity),
      priorState: ensureField(p.priorState),
      priorZipCode: ensureField(p.priorZipCode),
      yearsAtCurrentAddress: ensureField(p.yearsAtCurrentAddress),
      // Contact
      phone: ensureField(p.phone),
      email: ensureField(p.email),
      // Auto-specific fields
      ownerDriversLicense: ensureField(p.ownerDriversLicense),
      ownerLicenseState: ensureField(p.ownerLicenseState),
      spouseDriversLicense: ensureField(p.spouseDriversLicense),
      spouseLicenseState: ensureField(p.spouseLicenseState),
      ownerOccupation: ensureField(p.ownerOccupation),
      spouseOccupation: ensureField(p.spouseOccupation),
      ownerEducation: ensureField(p.ownerEducation),
      spouseEducation: ensureField(p.spouseEducation),
      rideShare: ensureBooleanField(p.rideShare),
      delivery: ensureBooleanField(p.delivery),
    }
    console.log('[Transform] autoApiToUiExtraction: personal.ownerFirstName =', result.personal.ownerFirstName)
  }

  // Transform additional drivers - ensure array and all fields
  if (api.additionalDrivers && Array.isArray(api.additionalDrivers)) {
    result.additionalDrivers = api.additionalDrivers.map((driver: AutoAdditionalDriver, idx: number) => {
      console.log(`[Transform] autoApiToUiExtraction: processing driver ${idx}:`, driver.firstName?.value)
      return {
        firstName: ensureField(driver.firstName),
        lastName: ensureField(driver.lastName),
        dateOfBirth: ensureField(driver.dateOfBirth),
        licenseNumber: ensureField(driver.licenseNumber),
        licenseState: ensureField(driver.licenseState),
        relationship: ensureField(driver.relationship),
        goodStudentDiscount: ensureBooleanField(driver.goodStudentDiscount),
        vehicleAssigned: ensureField(driver.vehicleAssigned),
      }
    })
  }

  // Transform vehicles - ensure array and all fields (now includes deductibles)
  if (api.vehicles && Array.isArray(api.vehicles)) {
    result.vehicles = api.vehicles.map((vehicle: AutoVehicle, idx: number) => {
      console.log(`[Transform] autoApiToUiExtraction: processing vehicle ${idx}:`, vehicle.year?.value, vehicle.make?.value, vehicle.model?.value)
      return {
        // Vehicle identification
        year: ensureField(vehicle.year),
        make: ensureField(vehicle.make),
        model: ensureField(vehicle.model),
        vin: ensureField(vehicle.vin),
        estimatedMileage: ensureField(vehicle.estimatedMileage),
        vehicleUsage: ensureField(vehicle.vehicleUsage),
        ownership: ensureField(vehicle.ownership),
        // Deductibles (per-vehicle)
        comprehensiveDeductible: ensureField(vehicle.comprehensiveDeductible),
        collisionDeductible: ensureField(vehicle.collisionDeductible),
        roadTroubleService: ensureField(vehicle.roadTroubleService),
        limitedTNCCoverage: ensureBooleanField(vehicle.limitedTNCCoverage),
        additionalExpenseCoverage: ensureField(vehicle.additionalExpenseCoverage),
      }
    })
  }

  // Transform coverage info
  if (api.coverage) {
    const c = api.coverage
    result.coverage = {
      bodilyInjury: ensureField(c.bodilyInjury),
      propertyDamage: ensureField(c.propertyDamage),
      uninsuredMotorist: ensureField(c.uninsuredMotorist),
      underinsuredMotorist: ensureField(c.underinsuredMotorist),
      medicalPayments: ensureField(c.medicalPayments),
      towing: ensureBooleanField(c.towing),
      rental: ensureBooleanField(c.rental),
      offRoadVehicleLiability: ensureBooleanField(c.offRoadVehicleLiability),
    }
    console.log('[Transform] autoApiToUiExtraction: coverage.bodilyInjury =', result.coverage.bodilyInjury)
  }

  // Note: Deductibles are now part of vehicles, no longer a separate transformation

  // Transform lienholders
  if (api.lienholders && Array.isArray(api.lienholders)) {
    result.lienholders = api.lienholders.map((lien: AutoVehicleLienholder, idx: number) => {
      console.log(`[Transform] autoApiToUiExtraction: processing lienholder ${idx}:`, lien.lienholderName?.value)
      return {
        vehicleReference: ensureField(lien.vehicleReference),
        lienholderName: ensureField(lien.lienholderName),
        lienholderAddress: ensureField(lien.lienholderAddress),
        lienholderCity: ensureField(lien.lienholderCity),
        lienholderState: ensureField(lien.lienholderState),
        lienholderZip: ensureField(lien.lienholderZip),
      }
    })
  }

  // Transform prior insurance
  if (api.priorInsurance) {
    const pi = api.priorInsurance
    result.priorInsurance = {
      insuranceCompany: ensureField(pi.insuranceCompany),
      premium: ensureField(pi.premium),
      policyNumber: ensureField(pi.policyNumber),
      expirationDate: ensureField(pi.expirationDate),
    }
    console.log('[Transform] autoApiToUiExtraction: priorInsurance.insuranceCompany =', result.priorInsurance.insuranceCompany)
  }

  // Transform accidents/tickets
  if (api.accidentsOrTickets && Array.isArray(api.accidentsOrTickets)) {
    result.accidentsOrTickets = api.accidentsOrTickets.map((incident: AutoAccidentOrTicket, idx: number) => {
      console.log(`[Transform] autoApiToUiExtraction: processing incident ${idx}:`, incident.type?.value)
      return {
        driverName: ensureField(incident.driverName),
        date: ensureField(incident.date),
        type: ensureField(incident.type),
        description: ensureField(incident.description),
        amount: ensureField(incident.amount),
        atFault: ensureField(incident.atFault),
      }
    })
  }

  console.log('[Transform] autoApiToUiExtraction: transformation complete')
  console.log('[Transform] autoApiToUiExtraction: result personal.ownerFirstName =', result.personal.ownerFirstName)
  console.log('[Transform] autoApiToUiExtraction: result vehicles count =', result.vehicles.length)
  return result
}

/**
 * Check if data is a HomeApiExtractionResult
 */
export function isHomeApiExtractionResult(data: unknown): data is HomeApiExtractionResult {
  return detectExtractionType(data) === 'home_api'
}

/**
 * Check if data is a valid HomeExtractionResult
 */
export function isHomeExtractionResult(data: unknown): data is HomeExtractionResult {
  return detectExtractionType(data) === 'home'
}

/**
 * Check if data is a valid AutoExtractionResult
 */
export function isAutoExtractionResult(data: unknown): data is AutoExtractionResult {
  return detectExtractionType(data) === 'auto'
}

/**
 * Check if data is a CombinedExtractionData
 */
export function isCombinedExtractionData(data: unknown): data is CombinedExtractionData {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  return 'quoteType' in record && 'shared' in record
}

/**
 * Check if data is legacy ExtractionResult
 */
export function isLegacyExtractionResult(data: unknown): data is ExtractionResult {
  return detectExtractionType(data) === 'legacy'
}

/**
 * Check if data is CombinedUiExtractionData (UI format)
 */
export function isCombinedUiExtractionData(data: unknown): data is CombinedUiExtractionData {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  return 'quoteType' in record && record.quoteType === 'both' && ('home' in record || 'auto' in record) && !('shared' in record)
}

/**
 * Get HomeExtractionResult from any extraction data format
 * Returns null if conversion is not possible
 */
export function getHomeExtractionData(
  data: unknown
): HomeExtractionResult | null {
  const type = detectExtractionType(data)
  console.log('[Transform] getHomeExtractionData: detected type =', type)

  switch (type) {
    case 'home':
      // Already in UI format
      return data as HomeExtractionResult
    case 'home_api':
      // Transform from API format to UI format
      console.log('[Transform] getHomeExtractionData: transforming home_api to home')
      return homeApiToUiExtraction(data as HomeApiExtractionResult)
    case 'legacy':
      return legacyToHomeExtraction(data as ExtractionResult)
    case 'both':
      // Check if it's UI format (CombinedUiExtractionData)
      if (isCombinedUiExtractionData(data)) {
        console.log('[Transform] getHomeExtractionData: returning home from CombinedUiExtractionData')
        return data.home
      }
      // For API combined data, transform using shared + home parts
      const combined = data as CombinedExtractionData
      if (combined.home) {
        console.log('[Transform] getHomeExtractionData: transforming CombinedExtractionData')
        // Reconstruct a HomeApiExtractionResult-like object from combined data
        return homeApiToUiExtraction({
          personal: {
            firstName: combined.shared.ownerFirstName,
            lastName: combined.shared.ownerLastName,
            dateOfBirth: combined.shared.ownerDOB,
            ssn: { value: null, confidence: 'low', flagged: true },
            spouseFirstName: combined.shared.spouseFirstName,
            spouseLastName: combined.shared.spouseLastName,
            spouseDateOfBirth: combined.shared.spouseDOB,
            spouseSsn: { value: null, confidence: 'low', flagged: true },
            streetAddress: combined.shared.streetAddress,
            city: combined.shared.city,
            state: combined.shared.state,
            zipCode: combined.shared.zipCode,
            priorStreetAddress: combined.shared.priorStreetAddress,
            priorCity: combined.shared.priorCity,
            priorState: combined.shared.priorState,
            priorZipCode: combined.shared.priorZipCode,
            yearsAtCurrentAddress: combined.shared.yearsAtCurrentAddress,
            phone: combined.shared.phone,
            email: combined.shared.email,
          },
          property: combined.home.property,
          householdMember: combined.home.householdMember,
          locationDetail: combined.home.locationDetail,
          locationInformation: combined.home.locationInformation,
          policyQuestions: combined.home.policyQuestions,
          locationSpecificQuestions: combined.home.locationSpecificQuestions,
          safety: combined.home.safety,
          coverage: combined.home.coverage,
          claims: combined.home.claims,
          lienholder: combined.home.lienholder,
          updates: combined.home.updates,
        } as HomeApiExtractionResult)
      }
      return null
    default:
      console.log('[Transform] getHomeExtractionData: returning null for type', type)
      return null
  }
}

/**
 * Get AutoExtractionResult from any extraction data format
 * Returns null if conversion is not possible
 */
export function getAutoExtractionData(
  data: unknown
): AutoExtractionResult | null {
  const type = detectExtractionType(data)
  console.log('[Transform] getAutoExtractionData: detected type =', type)

  switch (type) {
    case 'auto':
      // Transform through autoApiToUiExtraction to ensure all fields are properly initialized
      console.log('[Transform] getAutoExtractionData: transforming Auto API format to UI format')
      return autoApiToUiExtraction(data as AutoApiExtractionResult)
    case 'legacy':
      console.log('[Transform] getAutoExtractionData: transforming legacy to Auto')
      return legacyToAutoExtraction(data as ExtractionResult)
    case 'both':
      // Check if it's UI format (CombinedUiExtractionData)
      if (isCombinedUiExtractionData(data)) {
        console.log('[Transform] getAutoExtractionData: returning auto from CombinedUiExtractionData')
        return data.auto
      }
      // For API combined data, reconstruct from shared + autoPersonal + auto parts using autoApiToUiExtraction
      const combined = data as CombinedExtractionData
      if (combined.auto) {
        console.log('[Transform] getAutoExtractionData: transforming CombinedExtractionData using autoApiToUiExtraction')
        console.log('[Transform] getAutoExtractionData: autoPersonal exists =', !!combined.autoPersonal)

        // Get auto-specific fields from autoPersonal or create defaults
        const autoPersonal: Partial<AutoSpecificPersonalInfo> = combined.autoPersonal || {}

        // Reconstruct an AutoApiExtractionResult from combined data and transform it
        return autoApiToUiExtraction({
          personal: {
            // Shared fields from shared personal info
            ownerFirstName: combined.shared.ownerFirstName,
            ownerLastName: combined.shared.ownerLastName,
            ownerDOB: combined.shared.ownerDOB,
            spouseFirstName: combined.shared.spouseFirstName,
            spouseLastName: combined.shared.spouseLastName,
            spouseDOB: combined.shared.spouseDOB,
            streetAddress: combined.shared.streetAddress,
            city: combined.shared.city,
            state: combined.shared.state,
            zipCode: combined.shared.zipCode,
            priorStreetAddress: combined.shared.priorStreetAddress,
            priorCity: combined.shared.priorCity,
            priorState: combined.shared.priorState,
            priorZipCode: combined.shared.priorZipCode,
            yearsAtCurrentAddress: combined.shared.yearsAtCurrentAddress,
            phone: combined.shared.phone,
            email: combined.shared.email,
            // Auto-specific fields from autoPersonal (with fallback to empty defaults)
            effectiveDate: autoPersonal.effectiveDate || createEmptyAutoField(),
            maritalStatus: autoPersonal.maritalStatus || createEmptyAutoField(),
            garagingAddressSameAsMailing: autoPersonal.garagingAddressSameAsMailing || createEmptyBooleanField(),
            garagingStreetAddress: autoPersonal.garagingStreetAddress || createEmptyAutoField(),
            garagingCity: autoPersonal.garagingCity || createEmptyAutoField(),
            garagingState: autoPersonal.garagingState || createEmptyAutoField(),
            garagingZipCode: autoPersonal.garagingZipCode || createEmptyAutoField(),
            ownerDriversLicense: autoPersonal.ownerDriversLicense || createEmptyAutoField(),
            ownerLicenseState: autoPersonal.ownerLicenseState || createEmptyAutoField(),
            spouseDriversLicense: autoPersonal.spouseDriversLicense || createEmptyAutoField(),
            spouseLicenseState: autoPersonal.spouseLicenseState || createEmptyAutoField(),
            ownerOccupation: autoPersonal.ownerOccupation || createEmptyAutoField(),
            spouseOccupation: autoPersonal.spouseOccupation || createEmptyAutoField(),
            ownerEducation: autoPersonal.ownerEducation || createEmptyAutoField(),
            spouseEducation: autoPersonal.spouseEducation || createEmptyAutoField(),
            rideShare: autoPersonal.rideShare || createEmptyBooleanField(),
            delivery: autoPersonal.delivery || createEmptyBooleanField(),
          },
          additionalDrivers: combined.auto.additionalDrivers || [],
          vehicles: combined.auto.vehicles || [],
          coverage: combined.auto.coverage,
          lienholders: combined.auto.lienholders || [],
          priorInsurance: combined.auto.priorInsurance,
          accidentsOrTickets: combined.auto.accidentsOrTickets || [],
        } as AutoApiExtractionResult)
      }
      return null
    default:
      console.log('[Transform] getAutoExtractionData: returning null for type', type)
      return null
  }
}

/**
 * Suggest the best quote type based on the extracted data
 * Analyzes the data to determine what type of insurance form was likely scanned
 */
export function suggestQuoteType(data: unknown): 'home' | 'auto' | 'both' {
  const type = detectExtractionType(data)

  // If we already know the type, use it
  if (type === 'home' || type === 'home_api') return 'home'
  if (type === 'auto' || type === 'auto_api') return 'auto'
  if (type === 'both') return 'both'

  // For legacy data, try to infer from content
  if (type === 'legacy') {
    const legacy = data as ExtractionResult

    // Check for home-related keywords in coverage types
    const coverageTypes = legacy.coverage?.types?.value?.toLowerCase() || ''
    const homeKeywords = ['dwelling', 'property', 'homeowner', 'home', 'house']
    const autoKeywords = ['vehicle', 'auto', 'car', 'liability', 'collision']

    const hasHomeIndicators = homeKeywords.some((k) => coverageTypes.includes(k))
    const hasAutoIndicators = autoKeywords.some((k) => coverageTypes.includes(k))

    if (hasHomeIndicators && hasAutoIndicators) return 'both'
    if (hasHomeIndicators) return 'home'
    if (hasAutoIndicators) return 'auto'
  }

  // Default to home as it's likely the most common
  return 'home'
}
