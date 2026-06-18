/**
 * Zod schemas for runtime validation of OpenRouter extraction responses
 *
 * These schemas validate the JSON response from Claude Vision to ensure
 * the extracted data conforms to expected structure before processing.
 */

import { z } from 'zod'

// =============================================================================
// Base Field Schemas
// =============================================================================

/**
 * Schema for confidence levels
 */
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low'])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>

/**
 * Schema for a standard extraction field with string value
 */
export const ExtractionFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: ConfidenceLevelSchema,
  flagged: z.boolean(),
  rawText: z.string().optional(),
})
export type ExtractionFieldType = z.infer<typeof ExtractionFieldSchema>

/**
 * Schema for a boolean extraction field
 */
export const ExtractionBooleanFieldSchema = z.object({
  value: z.boolean().nullable(),
  confidence: ConfidenceLevelSchema,
  flagged: z.boolean(),
  rawText: z.string().optional(),
})
export type ExtractionBooleanFieldType = z.infer<typeof ExtractionBooleanFieldSchema>

/**
 * Schema for a numeric extraction field
 */
export const ExtractionNumberFieldSchema = z.object({
  value: z.number().nullable(),
  confidence: ConfidenceLevelSchema,
  flagged: z.boolean(),
  rawText: z.string().optional(),
})
export type ExtractionNumberFieldType = z.infer<typeof ExtractionNumberFieldSchema>

// =============================================================================
// Home Insurance Schemas
// =============================================================================

/**
 * Schema for HomePersonalInfo
 */
export const HomePersonalInfoSchema = z.object({
  firstName: ExtractionFieldSchema,
  lastName: ExtractionFieldSchema,
  dateOfBirth: ExtractionFieldSchema,
  ssn: ExtractionFieldSchema,
  spouseFirstName: ExtractionFieldSchema,
  spouseLastName: ExtractionFieldSchema,
  spouseDateOfBirth: ExtractionFieldSchema,
  spouseSsn: ExtractionFieldSchema,
  streetAddress: ExtractionFieldSchema,
  city: ExtractionFieldSchema,
  state: ExtractionFieldSchema,
  zipCode: ExtractionFieldSchema,
  priorStreetAddress: ExtractionFieldSchema,
  priorCity: ExtractionFieldSchema,
  priorState: ExtractionFieldSchema,
  priorZipCode: ExtractionFieldSchema,
  yearsAtCurrentAddress: ExtractionFieldSchema,
  phone: ExtractionFieldSchema,
  email: ExtractionFieldSchema,
})

/**
 * Schema for HomePropertyInfo
 */
export const HomePropertyInfoSchema = z.object({
  purchaseDate: ExtractionFieldSchema,
  yearBuilt: ExtractionFieldSchema,
  squareFootage: ExtractionFieldSchema,
  numberOfStories: ExtractionFieldSchema,
  numberOfKitchens: ExtractionFieldSchema,
  kitchenStyle: ExtractionFieldSchema,
  numberOfBathrooms: ExtractionFieldSchema,
  bathroomStyle: ExtractionFieldSchema,
  flooringPercentage: ExtractionFieldSchema,
  heatType: ExtractionFieldSchema,
  exteriorConstruction: ExtractionFieldSchema,
  exteriorFeatures: ExtractionFieldSchema,
  roofAge: ExtractionFieldSchema,
  roofConstruction: ExtractionFieldSchema,
  foundationType: ExtractionFieldSchema,
  hasFinishedBasement: ExtractionBooleanFieldSchema,
  garageType: ExtractionFieldSchema,
  numberOfCarGarage: ExtractionFieldSchema,
  numberOfFireplaces: ExtractionFieldSchema,
  fireplaceType: ExtractionFieldSchema,
  deckPatioDetails: ExtractionFieldSchema,
  isCondoOrTownhouse: ExtractionBooleanFieldSchema,
  specialFeatures: ExtractionFieldSchema,
})

/**
 * Schema for HomeSafetyInfo
 */
export const HomeSafetyInfoSchema = z.object({
  hasAlarmSystem: ExtractionBooleanFieldSchema,
  isAlarmMonitored: ExtractionBooleanFieldSchema,
  hasPool: ExtractionBooleanFieldSchema,
  hasTrampoline: ExtractionBooleanFieldSchema,
  hasEnclosedYard: ExtractionBooleanFieldSchema,
  hasDog: ExtractionBooleanFieldSchema,
  dogBreed: ExtractionFieldSchema,
})

/**
 * Schema for HomeCoverageInfo
 */
export const HomeCoverageInfoSchema = z.object({
  dwellingCoverage: ExtractionFieldSchema,
  liabilityCoverage: ExtractionFieldSchema,
  medicalPayments: ExtractionFieldSchema,
  deductible: ExtractionFieldSchema,
  personalPropertyCoverage: ExtractionFieldSchema,
  lossOfUseCoverage: ExtractionFieldSchema,
})

/**
 * Schema for HomeClaimsHistory
 */
export const HomeClaimsHistorySchema = z.object({
  claimsInLast5Years: ExtractionFieldSchema,
  numberOfClaims: ExtractionFieldSchema,
  claimDetails: ExtractionFieldSchema,
})

/**
 * Schema for HomeLienholderInfo
 */
export const HomeLienholderInfoSchema = z.object({
  lienholderName: ExtractionFieldSchema,
  lienholderAddress: ExtractionFieldSchema,
  loanNumber: ExtractionFieldSchema,
  currentInsuranceCompany: ExtractionFieldSchema,
  currentPolicyNumber: ExtractionFieldSchema,
  currentEffectiveDate: ExtractionFieldSchema,
  currentPremium: ExtractionFieldSchema,
  isEscrowed: ExtractionBooleanFieldSchema,
  hasBeenCancelledOrDeclined: ExtractionBooleanFieldSchema,
  cancelDeclineDetails: ExtractionFieldSchema,
  referredBy: ExtractionFieldSchema,
})

/**
 * Schema for HomeUpdatesInfo
 */
export const HomeUpdatesInfoSchema = z.object({
  hvacUpdateYear: ExtractionFieldSchema,
  plumbingUpdateYear: ExtractionFieldSchema,
  roofUpdateYear: ExtractionFieldSchema,
  electricalUpdateYear: ExtractionFieldSchema,
  hasCircuitBreakers: ExtractionBooleanFieldSchema,
})

export const HomeHouseholdMemberInfoSchema = z.object({
  firstName: ExtractionFieldSchema,
  lastName: ExtractionFieldSchema,
  suffix: ExtractionFieldSchema,
  dob: ExtractionFieldSchema,
  ssn: ExtractionFieldSchema,
  relationship: ExtractionFieldSchema,
  maritalStatus: ExtractionFieldSchema,
  dlState: ExtractionFieldSchema,
  dlNumber: ExtractionFieldSchema,
})

export const HomeLocationDetailInfoSchema = z.object({
  locationOccupancy: ExtractionFieldSchema,
  ownerOccupied: ExtractionFieldSchema,
  vacant: ExtractionFieldSchema,
  liabilityCoverageOnly: ExtractionFieldSchema,
  personalPropertyOnly: ExtractionFieldSchema,
})

export const HomeLocationInformationInfoSchema = z.object({
  program: ExtractionFieldSchema,
  type: ExtractionFieldSchema,
  coverageA: ExtractionFieldSchema,
  coverageF: ExtractionFieldSchema,
  personalInjury: ExtractionFieldSchema,
  coverageG: ExtractionFieldSchema,
  constructionYear: ExtractionFieldSchema,
  construction: ExtractionFieldSchema,
  foundation: ExtractionFieldSchema,
  finishedLivingArea: ExtractionFieldSchema,
  numberOfFamiliesUnits: ExtractionFieldSchema,
  replacementCost100: ExtractionFieldSchema,
  roofLossSettlementWindstormHail: ExtractionFieldSchema,
  roofingMaterial: ExtractionFieldSchema,
  roofUpdateYear: ExtractionFieldSchema,
  marketValue: ExtractionFieldSchema,
  hasMortgageeContractHolderOrSecuredLineOfCredit: ExtractionFieldSchema,
  boardingOrLodgingOrStudentRentals: ExtractionFieldSchema,
  isStudentRental: ExtractionFieldSchema,
  visibleFromOtherDwellings: ExtractionFieldSchema,
  fortifiedHome: ExtractionFieldSchema,
  woodCoalHeating: ExtractionFieldSchema,
  woodCoalHeatingLocation: ExtractionFieldSchema,
  woodCoalHeatingQuantity: ExtractionFieldSchema,
  gatedAccessToDwelling: ExtractionFieldSchema,
  applicantWillingToCompleteDiySurvey: ExtractionFieldSchema,
  screenedEnclosure: ExtractionFieldSchema,
  dwellingConstructedWithAsbestos: ExtractionFieldSchema,
  floodZone: ExtractionFieldSchema,
  coastalStormRiskArea: ExtractionFieldSchema,
  locatedOnIsland: ExtractionFieldSchema,
  conditionOfDwelling: ExtractionFieldSchema,
  dogsOwnedOrKept: ExtractionFieldSchema,
  specificBreed: ExtractionFieldSchema,
  biteHistoryAggressiveBehavior: ExtractionFieldSchema,
  isLocationWithinCity: ExtractionFieldSchema,
  respondingFireDepartment: ExtractionFieldSchema,
  communityName: ExtractionFieldSchema,
  within1000FeetOfHydrant: ExtractionFieldSchema,
  bridgeAccess: ExtractionFieldSchema,
  windHailDeductible: ExtractionFieldSchema,
  hurricaneDeductible: ExtractionFieldSchema,
  county: ExtractionFieldSchema,
  locationInformationOccupancy: ExtractionFieldSchema,
  territory: ExtractionFieldSchema,
  ownership: ExtractionFieldSchema,
  allOtherPerilsDeductible: ExtractionFieldSchema,
  distanceToHydrantFeet: ExtractionFieldSchema,
  distanceToFireStationMiles: ExtractionFieldSchema,
  protectionClass: ExtractionFieldSchema,
})

export const HomePolicyQuestionsInfoSchema = z.object({
  pleaseExplain: ExtractionFieldSchema,
  hasAnyCompanyCanceledRefusedOrDeclinedRenewal: ExtractionFieldSchema,
  hasAutoOwnersInsurancePast5Years: ExtractionFieldSchema,
  options: ExtractionFieldSchema,
  previousPolicyNumber: ExtractionFieldSchema,
  hasFiledPersonalBankruptcyOrJudgementsPast5Years: ExtractionFieldSchema,
  bankruptcyPleaseExplain: ExtractionFieldSchema,
  hasAnyApplicantBeenConvictedOfArson: ExtractionFieldSchema,
})

export const HomeLocationSpecificQuestionsInfoSchema = z.object({
  dwellingForSale: ExtractionFieldSchema,
  isNewVentureNoPreviousLandlordOrRentalPropertyExperience: ExtractionFieldSchema,
  areThereAnyOutbuildingsOnPremises: ExtractionFieldSchema,
  anyFloodingBrushLandslideOrUnusualHazards: ExtractionFieldSchema,
  areDogsAllowed: ExtractionFieldSchema,
  anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets: ExtractionFieldSchema,
  anyUncorrectedFireCodeViolations: ExtractionFieldSchema,
  difficultAccessByFireAndPoliceDepartments: ExtractionFieldSchema,
  dwellingNewPurchase: ExtractionFieldSchema,
  purchasePrice: ExtractionFieldSchema,
  dwellingOccupied: ExtractionFieldSchema,
  pleaseExplain: ExtractionFieldSchema,
  expectedOccupancyDate: ExtractionFieldSchema,
  dayCareOnPremises: ExtractionFieldSchema,
  childrenCaredForCount: ExtractionFieldSchema,
  farmingOnPremises: ExtractionFieldSchema,
  acresFarmedByOthers: ExtractionFieldSchema,
  numberOfAnimalsLarge: ExtractionFieldSchema,
  numberOfAnimalsMedium: ExtractionFieldSchema,
  numberOfAnimalsSmall: ExtractionFieldSchema,
  otherBusinessOnPremises: ExtractionFieldSchema,
  describeBusiness: ExtractionFieldSchema,
  buildingUnderRenovationOrReconstruction: ExtractionFieldSchema,
  householdMembersLivingDuringRenovation: ExtractionFieldSchema,
  renovationExplanation: ExtractionFieldSchema,
  responsesVerifiedWithApplicant: ExtractionFieldSchema,
})

/**
 * Complete schema for HomeApiExtractionResult
 */
export const HomeApiExtractionResultSchema = z.object({
  personal: HomePersonalInfoSchema,
  property: HomePropertyInfoSchema,
  householdMember: HomeHouseholdMemberInfoSchema,
  locationDetail: HomeLocationDetailInfoSchema,
  locationInformation: HomeLocationInformationInfoSchema,
  policyQuestions: HomePolicyQuestionsInfoSchema,
  locationSpecificQuestions: HomeLocationSpecificQuestionsInfoSchema,
  safety: HomeSafetyInfoSchema,
  coverage: HomeCoverageInfoSchema,
  claims: HomeClaimsHistorySchema,
  lienholder: HomeLienholderInfoSchema,
  updates: HomeUpdatesInfoSchema,
})
export type HomeApiExtractionResultType = z.infer<typeof HomeApiExtractionResultSchema>

// =============================================================================
// Auto Insurance Schemas
// =============================================================================

/**
 * Schema for AutoPersonalInfo
 */
export const AutoPersonalInfoSchema = z.object({
  effectiveDate: ExtractionFieldSchema,
  ownerFirstName: ExtractionFieldSchema,
  ownerLastName: ExtractionFieldSchema,
  ownerDOB: ExtractionFieldSchema,
  maritalStatus: ExtractionFieldSchema,
  spouseFirstName: ExtractionFieldSchema,
  spouseLastName: ExtractionFieldSchema,
  spouseDOB: ExtractionFieldSchema,
  streetAddress: ExtractionFieldSchema,
  city: ExtractionFieldSchema,
  state: ExtractionFieldSchema,
  zipCode: ExtractionFieldSchema,
  garagingAddressSameAsMailing: ExtractionBooleanFieldSchema,
  garagingStreetAddress: ExtractionFieldSchema,
  garagingCity: ExtractionFieldSchema,
  garagingState: ExtractionFieldSchema,
  garagingZipCode: ExtractionFieldSchema,
  priorStreetAddress: ExtractionFieldSchema,
  priorCity: ExtractionFieldSchema,
  priorState: ExtractionFieldSchema,
  priorZipCode: ExtractionFieldSchema,
  yearsAtCurrentAddress: ExtractionFieldSchema,
  phone: ExtractionFieldSchema,
  email: ExtractionFieldSchema,
  ownerDriversLicense: ExtractionFieldSchema,
  ownerLicenseState: ExtractionFieldSchema,
  spouseDriversLicense: ExtractionFieldSchema,
  spouseLicenseState: ExtractionFieldSchema,
  ownerOccupation: ExtractionFieldSchema,
  spouseOccupation: ExtractionFieldSchema,
  ownerEducation: ExtractionFieldSchema,
  spouseEducation: ExtractionFieldSchema,
  rideShare: ExtractionBooleanFieldSchema,
  delivery: ExtractionBooleanFieldSchema,
})

/**
 * Schema for AutoAdditionalDriver
 */
export const AutoAdditionalDriverSchema = z.object({
  firstName: ExtractionFieldSchema,
  lastName: ExtractionFieldSchema,
  dateOfBirth: ExtractionFieldSchema,
  licenseNumber: ExtractionFieldSchema,
  licenseState: ExtractionFieldSchema,
  relationship: ExtractionFieldSchema,
  goodStudentDiscount: ExtractionBooleanFieldSchema,
  vehicleAssigned: ExtractionFieldSchema,
})

/**
 * Schema for AutoVehicle (includes deductibles per vehicle)
 */
export const AutoVehicleSchema = z.object({
  // Vehicle identification
  year: ExtractionFieldSchema,
  make: ExtractionFieldSchema,
  model: ExtractionFieldSchema,
  vin: ExtractionFieldSchema,
  estimatedMileage: ExtractionFieldSchema,
  vehicleUsage: ExtractionFieldSchema,
  ownership: ExtractionFieldSchema,
  // Deductibles (per-vehicle)
  comprehensiveDeductible: ExtractionFieldSchema,
  collisionDeductible: ExtractionFieldSchema,
  roadTroubleService: ExtractionFieldSchema,
  limitedTNCCoverage: ExtractionBooleanFieldSchema,
  additionalExpenseCoverage: ExtractionFieldSchema,
})

/**
 * Schema for AutoCoverageInfo
 */
export const AutoCoverageInfoSchema = z.object({
  bodilyInjury: ExtractionFieldSchema,
  propertyDamage: ExtractionFieldSchema,
  uninsuredMotorist: ExtractionFieldSchema,
  underinsuredMotorist: ExtractionFieldSchema,
  medicalPayments: ExtractionFieldSchema,
  towing: ExtractionBooleanFieldSchema,
  rental: ExtractionBooleanFieldSchema,
  offRoadVehicleLiability: ExtractionBooleanFieldSchema,
})

/**
 * Schema for AutoVehicleDeductible
 * @deprecated Deductibles are now part of AutoVehicleSchema.
 * This schema is kept for backward compatibility only.
 */
export const AutoVehicleDeductibleSchema = z.object({
  vehicleReference: ExtractionFieldSchema,
  comprehensiveDeductible: ExtractionFieldSchema,
  collisionDeductible: ExtractionFieldSchema,
  roadTroubleService: ExtractionFieldSchema,
  limitedTNCCoverage: ExtractionBooleanFieldSchema,
  additionalExpenseCoverage: ExtractionFieldSchema,
})

/**
 * Schema for AutoVehicleLienholder
 */
export const AutoVehicleLienholderSchema = z.object({
  vehicleReference: ExtractionFieldSchema,
  lienholderName: ExtractionFieldSchema,
  lienholderAddress: ExtractionFieldSchema,
  lienholderCity: ExtractionFieldSchema,
  lienholderState: ExtractionFieldSchema,
  lienholderZip: ExtractionFieldSchema,
})

/**
 * Schema for AutoPriorInsurance
 */
export const AutoPriorInsuranceSchema = z.object({
  insuranceCompany: ExtractionFieldSchema,
  premium: ExtractionFieldSchema,
  policyNumber: ExtractionFieldSchema,
  expirationDate: ExtractionFieldSchema,
})

/**
 * Schema for AutoAccidentOrTicket
 */
export const AutoAccidentOrTicketSchema = z.object({
  driverName: ExtractionFieldSchema,
  date: ExtractionFieldSchema,
  type: ExtractionFieldSchema,
  description: ExtractionFieldSchema,
  amount: ExtractionFieldSchema,
  atFault: ExtractionFieldSchema,
})

/**
 * Complete schema for AutoApiExtractionResult
 * Note: Deductibles are now embedded in each vehicle in the vehicles array.
 */
export const AutoApiExtractionResultSchema = z.object({
  personal: AutoPersonalInfoSchema,
  additionalDrivers: z.array(AutoAdditionalDriverSchema),
  vehicles: z.array(AutoVehicleSchema),
  coverage: AutoCoverageInfoSchema,
  lienholders: z.array(AutoVehicleLienholderSchema),
  priorInsurance: AutoPriorInsuranceSchema,
  accidentsOrTickets: z.array(AutoAccidentOrTicketSchema),
})
export type AutoApiExtractionResultType = z.infer<typeof AutoApiExtractionResultSchema>

// =============================================================================
// Partial Schemas (for incremental validation)
// =============================================================================

/**
 * Partial schema for HomeApiExtractionResult
 * Used when merging partial results from multi-page extraction
 */
export const PartialHomeApiExtractionResultSchema = HomeApiExtractionResultSchema.partial()
export type PartialHomeApiExtractionResultType = z.infer<typeof PartialHomeApiExtractionResultSchema>

/**
 * Partial schema for AutoApiExtractionResult
 * Used when merging partial results from multi-page extraction
 */
export const PartialAutoApiExtractionResultSchema = AutoApiExtractionResultSchema.partial()
export type PartialAutoApiExtractionResultType = z.infer<typeof PartialAutoApiExtractionResultSchema>

// =============================================================================
// Legacy ExtractionResult Schema (for backward compatibility)
// =============================================================================

export const LegacyExtractionResultSchema = z.object({
  personal: z.object({
    firstName: ExtractionFieldSchema,
    lastName: ExtractionFieldSchema,
    dateOfBirth: ExtractionFieldSchema,
    ssn: ExtractionFieldSchema,
    address: ExtractionFieldSchema,
    city: ExtractionFieldSchema,
    state: ExtractionFieldSchema,
    zipCode: ExtractionFieldSchema,
    phone: ExtractionFieldSchema,
    email: ExtractionFieldSchema,
  }),
  employment: z.object({
    employer: ExtractionFieldSchema,
    occupation: ExtractionFieldSchema,
    income: ExtractionFieldSchema,
    yearsEmployed: ExtractionFieldSchema,
  }),
  coverage: z.object({
    types: ExtractionFieldSchema,
    amounts: ExtractionFieldSchema,
  }),
  beneficiary: z.object({
    primaryName: ExtractionFieldSchema,
    primaryRelationship: ExtractionFieldSchema,
    contingentName: ExtractionFieldSchema,
    contingentRelationship: ExtractionFieldSchema,
  }),
  health: z.object({
    conditions: ExtractionFieldSchema,
    medications: ExtractionFieldSchema,
    tobaccoUse: ExtractionFieldSchema,
  }),
  policies: z.object({
    existingPolicies: ExtractionFieldSchema,
    replacementIntent: ExtractionFieldSchema,
  }),
  financials: z.object({
    assets: ExtractionFieldSchema,
    liabilities: ExtractionFieldSchema,
    netWorth: ExtractionFieldSchema,
  }),
})
export type LegacyExtractionResultType = z.infer<typeof LegacyExtractionResultSchema>

export const PartialLegacyExtractionResultSchema = LegacyExtractionResultSchema.partial()
export type PartialLegacyExtractionResultType = z.infer<typeof PartialLegacyExtractionResultSchema>

// =============================================================================
// Validation Result Types
// =============================================================================

export interface ValidationSuccess<T> {
  success: true
  data: T
}

export interface ValidationFailure {
  success: false
  error: z.ZodError
  issues: z.ZodIssue[]
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate and parse a partial Home extraction result
 */
export function validatePartialHomeExtraction(
  data: unknown
): ValidationResult<PartialHomeApiExtractionResultType> {
  const result = PartialHomeApiExtractionResultSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error,
    issues: result.error.issues,
  }
}

/**
 * Validate and parse a partial Auto extraction result
 */
export function validatePartialAutoExtraction(
  data: unknown
): ValidationResult<PartialAutoApiExtractionResultType> {
  const result = PartialAutoApiExtractionResultSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error,
    issues: result.error.issues,
  }
}

/**
 * Validate and parse a partial legacy extraction result
 */
export function validatePartialLegacyExtraction(
  data: unknown
): ValidationResult<PartialLegacyExtractionResultType> {
  const result = PartialLegacyExtractionResultSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error,
    issues: result.error.issues,
  }
}

/**
 * Log validation errors in a human-readable format
 */
export function logValidationErrors(issues: z.ZodIssue[]): void {
  console.error('[Schema Validation] Validation failed with issues:')
  for (const issue of issues) {
    const path = issue.path.join('.')
    console.error(`  - ${path}: ${issue.message} (${issue.code})`)
  }
}
