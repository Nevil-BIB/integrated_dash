/**
 * Extraction Types for Insurance Fact Finder Documents
 *
 * This module defines the structured data types for extracting information
 * from scanned insurance fact finder documents using AI vision.
 */

// ============================================================================
// Core Field Types
// ============================================================================

/**
 * Represents a single extracted field with confidence metadata
 */
export interface ExtractionField {
  /** The extracted and normalized value, null if not found */
  value: string | null;
  /** AI confidence level in the extraction */
  confidence: 'high' | 'medium' | 'low';
  /** True if this field needs human review (illegible, ambiguous, missing) */
  flagged: boolean;
  /** Original text as it appeared in the document, if different from normalized value */
  rawText?: string;
}

/**
 * Boolean field variant for yes/no questions
 */
export interface ExtractionBooleanField {
  /** The extracted boolean value, null if not found */
  value: boolean | null;
  /** AI confidence level in the extraction */
  confidence: 'high' | 'medium' | 'low';
  /** True if this field needs human review */
  flagged: boolean;
  /** Original text as it appeared in the document */
  rawText?: string;
}

/**
 * Numeric field variant for amounts, counts, etc.
 */
export interface ExtractionNumberField {
  /** The extracted numeric value, null if not found */
  value: number | null;
  /** AI confidence level in the extraction */
  confidence: 'high' | 'medium' | 'low';
  /** True if this field needs human review */
  flagged: boolean;
  /** Original text as it appeared in the document */
  rawText?: string;
}

// ============================================================================
// SHARED PERSONAL INFO (Used by both Home and Auto)
// ============================================================================

/**
 * Shared personal information collected once and used for both Home and Auto quotes
 * Contains owner, spouse, address, and contact information
 */
export interface SharedPersonalInfo {
  // Owner Information
  ownerFirstName: ExtractionField;
  ownerLastName: ExtractionField;
  ownerDOB: ExtractionField;                 // Format: YYYY-MM-DD

  // Spouse Information
  spouseFirstName: ExtractionField;
  spouseLastName: ExtractionField;
  spouseDOB: ExtractionField;                // Format: YYYY-MM-DD

  // Current Address
  streetAddress: ExtractionField;
  city: ExtractionField;
  state: ExtractionField;                    // 2-letter abbreviation
  zipCode: ExtractionField;

  // Prior Address (conditional - if less than 5 years at current)
  priorStreetAddress: ExtractionField;
  priorCity: ExtractionField;
  priorState: ExtractionField;
  priorZipCode: ExtractionField;
  yearsAtCurrentAddress: ExtractionField;

  // Contact Information
  phone: ExtractionField;                    // Format: (XXX) XXX-XXXX
  email: ExtractionField;
}

/**
 * Auto-specific personal fields that are NOT shared with Home insurance
 * These are stored separately in CombinedExtractionData when quoteType is 'both'
 */
export interface AutoSpecificPersonalInfo {
  // Policy effective date
  effectiveDate: ExtractionField;            // REQUIRED* - Policy effective date, Format: YYYY-MM-DD

  // Marital status
  maritalStatus: ExtractionField;            // REQUIRED* - Single, Married, Divorced, Widowed, Domestic Partner

  // Garaging address (conditional: only if different from mailing)
  garagingAddressSameAsMailing: ExtractionBooleanField; // REQUIRED* - Is garaging address same as mailing?
  garagingStreetAddress: ExtractionField;    // Conditional: Only if garagingAddressSameAsMailing is false
  garagingCity: ExtractionField;             // Conditional: Only if garagingAddressSameAsMailing is false
  garagingState: ExtractionField;            // Conditional: Only if garagingAddressSameAsMailing is false
  garagingZipCode: ExtractionField;          // Conditional: Only if garagingAddressSameAsMailing is false

  // Driver's license info
  ownerDriversLicense: ExtractionField;      // REQUIRED* - License number
  ownerLicenseState: ExtractionField;        // 2-letter abbreviation
  spouseDriversLicense: ExtractionField;     // Conditional: Only if maritalStatus is Married/Domestic Partner
  spouseLicenseState: ExtractionField;       // Conditional: Only if maritalStatus is Married/Domestic Partner

  // Employment/Education
  ownerOccupation: ExtractionField;
  spouseOccupation: ExtractionField;         // Conditional: Only if maritalStatus is Married/Domestic Partner
  ownerEducation: ExtractionField;           // High School, Some College, Bachelor's, etc.
  spouseEducation: ExtractionField;          // Conditional: Only if maritalStatus is Married/Domestic Partner

  // Commercial usage
  rideShare: ExtractionBooleanField;         // REQUIRED* - Uber, Lyft, etc.
  delivery: ExtractionBooleanField;          // REQUIRED* - DoorDash, Instacart, etc.
}

// ============================================================================
// Home Insurance Field Categories
// ============================================================================

/**
 * Personal Information - Applicant and spouse details (extends shared with SSN)
 */
export interface HomePersonalInfo {
  // Primary Applicant
  firstName: ExtractionField;
  lastName: ExtractionField;
  dateOfBirth: ExtractionField;  // Format: YYYY-MM-DD
  ssn: ExtractionField;          // Format: XXX-XX-XXXX

  // Spouse Information
  spouseFirstName: ExtractionField;
  spouseLastName: ExtractionField;
  spouseDateOfBirth: ExtractionField;  // Format: YYYY-MM-DD
  spouseSsn: ExtractionField;           // Format: XXX-XX-XXXX

  // Current Address
  streetAddress: ExtractionField;
  city: ExtractionField;
  state: ExtractionField;       // 2-letter abbreviation
  zipCode: ExtractionField;

  // Prior Address (if less than 5 years at current)
  priorStreetAddress: ExtractionField;
  priorCity: ExtractionField;
  priorState: ExtractionField;
  priorZipCode: ExtractionField;
  yearsAtCurrentAddress: ExtractionField;

  // Contact
  phone: ExtractionField;       // Format: (XXX) XXX-XXXX
  email: ExtractionField;
}

/**
 * Property Information - Physical characteristics of the home
 */
export interface HomePropertyInfo {
  // Basic Details
  purchaseDate: ExtractionField;           // Format: YYYY-MM-DD
  yearBuilt: ExtractionField;              // REQUIRED*
  squareFootage: ExtractionField;
  numberOfStories: ExtractionField;

  // Interior Details
  numberOfKitchens: ExtractionField;
  kitchenStyle: ExtractionField;           // Standard, Custom, etc.
  numberOfBathrooms: ExtractionField;
  bathroomStyle: ExtractionField;          // Standard, Custom, etc.
  flooringPercentage: ExtractionField;     // Percentage breakdown by type

  // Heating/Utilities
  heatType: ExtractionField;               // Gas, Electric, Oil, etc.

  // Exterior
  exteriorConstruction: ExtractionField;   // REQUIRED* - Brick, Siding, Stucco, etc.
  exteriorFeatures: ExtractionField;       // Notable exterior features

  // Roof
  roofAge: ExtractionField;                // REQUIRED* - Age in years
  roofConstruction: ExtractionField;       // Shingle, Metal, Tile, etc.

  // Foundation/Structure
  foundationType: ExtractionField;         // REQUIRED* - Slab, Basement, Crawl, etc.
  hasFinishedBasement: ExtractionBooleanField;

  // Garage
  garageType: ExtractionField;             // Attached, Detached, Carport, None
  numberOfCarGarage: ExtractionField;

  // Outdoor Features
  numberOfFireplaces: ExtractionField;     // REQUIRED*
  fireplaceType: ExtractionField;          // Wood, Gas, Electric, etc.
  deckPatioDetails: ExtractionField;       // Description of deck/patio/porch

  // Property Type
  isCondoOrTownhouse: ExtractionBooleanField;
  specialFeatures: ExtractionField;        // Pool house, guest house, etc.
}

/**
 * Safety & Risk Features - Security and liability factors
 */
export interface HomeSafetyInfo {
  hasAlarmSystem: ExtractionBooleanField;
  isAlarmMonitored: ExtractionBooleanField;
  hasPool: ExtractionBooleanField;
  hasTrampoline: ExtractionBooleanField;
  hasEnclosedYard: ExtractionBooleanField;
  hasDog: ExtractionBooleanField;
  dogBreed: ExtractionField;               // If has dog
}

/**
 * Coverage Information - Desired insurance coverage
 */
export interface HomeCoverageInfo {
  dwellingCoverage: ExtractionField;       // REQUIRED* - Coverage A amount
  liabilityCoverage: ExtractionField;      // REQUIRED* - Liability limit
  medicalPayments: ExtractionField;        // REQUIRED* - Med Pay limit
  deductible: ExtractionField;             // REQUIRED* - Deductible amount
  personalPropertyCoverage: ExtractionField;  // Coverage C amount
  lossOfUseCoverage: ExtractionField;      // Coverage D amount
}

/**
 * Claims History - Past insurance claims
 */
export interface HomeClaimsHistory {
  claimsInLast5Years: ExtractionField;     // REQUIRED* - Description of claims
  numberOfClaims: ExtractionField;
  claimDetails: ExtractionField;           // Type, date, amount for each claim
}

/**
 * Lienholder & Current Insurance - Mortgage and existing policy details
 */
export interface HomeLienholderInfo {
  // Lienholder/Mortgagee
  lienholderName: ExtractionField;
  lienholderAddress: ExtractionField;
  loanNumber: ExtractionField;

  // Current Insurance
  currentInsuranceCompany: ExtractionField;
  currentPolicyNumber: ExtractionField;
  currentEffectiveDate: ExtractionField;   // REQUIRED* - Format: YYYY-MM-DD
  currentPremium: ExtractionField;
  isEscrowed: ExtractionBooleanField;

  // Insurance History
  hasBeenCancelledOrDeclined: ExtractionBooleanField;
  cancelDeclineDetails: ExtractionField;

  // Referral
  referredBy: ExtractionField;
}

/**
 * Home Updates/Renovations - Recent improvements to systems
 */
export interface HomeUpdatesInfo {
  hvacUpdateYear: ExtractionField;         // REQUIRED* - Year of HVAC update
  plumbingUpdateYear: ExtractionField;     // REQUIRED* - Year of plumbing update
  roofUpdateYear: ExtractionField;         // REQUIRED* - Year of roof update
  electricalUpdateYear: ExtractionField;   // REQUIRED* - Year of electrical update
  hasCircuitBreakers: ExtractionBooleanField;  // REQUIRED* - vs fuse box
}

export interface HomeApiHouseholdMemberInfo {
  firstName: ExtractionField;
  lastName: ExtractionField;
  suffix: ExtractionField;
  dob: ExtractionField;
  ssn: ExtractionField;
  relationship: ExtractionField;
  maritalStatus: ExtractionField;
  dlState: ExtractionField;
  dlNumber: ExtractionField;
}

export interface HomeApiLocationDetailInfo {
  locationOccupancy: ExtractionField;
  ownerOccupied: ExtractionField;
  vacant: ExtractionField;
  liabilityCoverageOnly: ExtractionField;
  personalPropertyOnly: ExtractionField;
}

export interface HomeApiLocationInformationInfo {
  program: ExtractionField;
  type: ExtractionField;
  coverageA: ExtractionField;
  coverageF: ExtractionField;
  personalInjury: ExtractionField;
  coverageG: ExtractionField;
  constructionYear: ExtractionField;
  construction: ExtractionField;
  foundation: ExtractionField;
  finishedLivingArea: ExtractionField;
  numberOfFamiliesUnits: ExtractionField;
  replacementCost100: ExtractionField;
  roofLossSettlementWindstormHail: ExtractionField;
  roofingMaterial: ExtractionField;
  roofUpdateYear: ExtractionField;
  marketValue: ExtractionField;
  hasMortgageeContractHolderOrSecuredLineOfCredit: ExtractionField;
  boardingOrLodgingOrStudentRentals: ExtractionField;
  isStudentRental: ExtractionField;
  visibleFromOtherDwellings: ExtractionField;
  fortifiedHome: ExtractionField;
  woodCoalHeating: ExtractionField;
  woodCoalHeatingLocation: ExtractionField;
  woodCoalHeatingQuantity: ExtractionField;
  gatedAccessToDwelling: ExtractionField;
  applicantWillingToCompleteDiySurvey: ExtractionField;
  screenedEnclosure: ExtractionField;
  dwellingConstructedWithAsbestos: ExtractionField;
  floodZone: ExtractionField;
  coastalStormRiskArea: ExtractionField;
  locatedOnIsland: ExtractionField;
  conditionOfDwelling: ExtractionField;
  dogsOwnedOrKept: ExtractionField;
  specificBreed: ExtractionField;
  biteHistoryAggressiveBehavior: ExtractionField;
  isLocationWithinCity: ExtractionField;
  respondingFireDepartment: ExtractionField;
  communityName: ExtractionField;
  within1000FeetOfHydrant: ExtractionField;
  bridgeAccess: ExtractionField;
  windHailDeductible: ExtractionField;
  hurricaneDeductible: ExtractionField;
  county: ExtractionField;
  locationInformationOccupancy: ExtractionField;
  territory: ExtractionField;
  ownership: ExtractionField;
  allOtherPerilsDeductible: ExtractionField;
  distanceToHydrantFeet: ExtractionField;
  distanceToFireStationMiles: ExtractionField;
  protectionClass: ExtractionField;
}

export interface HomeApiPolicyQuestionsInfo {
  pleaseExplain: ExtractionField;
  hasAnyCompanyCanceledRefusedOrDeclinedRenewal: ExtractionField;
  hasAutoOwnersInsurancePast5Years: ExtractionField;
  options: ExtractionField;
  previousPolicyNumber: ExtractionField;
  hasFiledPersonalBankruptcyOrJudgementsPast5Years: ExtractionField;
  bankruptcyPleaseExplain: ExtractionField;
  hasAnyApplicantBeenConvictedOfArson: ExtractionField;
}

export interface HomeApiLocationSpecificQuestionsInfo {
  dwellingForSale: ExtractionField;
  isNewVentureNoPreviousLandlordOrRentalPropertyExperience: ExtractionField;
  areThereAnyOutbuildingsOnPremises: ExtractionField;
  anyFloodingBrushLandslideOrUnusualHazards: ExtractionField;
  areDogsAllowed: ExtractionField;
  anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets: ExtractionField;
  anyUncorrectedFireCodeViolations: ExtractionField;
  difficultAccessByFireAndPoliceDepartments: ExtractionField;
  dwellingNewPurchase: ExtractionField;
  purchasePrice: ExtractionField;
  dwellingOccupied: ExtractionField;
  pleaseExplain: ExtractionField;
  expectedOccupancyDate: ExtractionField;
  dayCareOnPremises: ExtractionField;
  childrenCaredForCount: ExtractionField;
  farmingOnPremises: ExtractionField;
  acresFarmedByOthers: ExtractionField;
  numberOfAnimalsLarge: ExtractionField;
  numberOfAnimalsMedium: ExtractionField;
  numberOfAnimalsSmall: ExtractionField;
  otherBusinessOnPremises: ExtractionField;
  describeBusiness: ExtractionField;
  buildingUnderRenovationOrReconstruction: ExtractionField;
  householdMembersLivingDuringRenovation: ExtractionField;
  renovationExplanation: ExtractionField;
  responsesVerifiedWithApplicant: ExtractionField;
}

// ============================================================================
// Complete Home Extraction Result
// ============================================================================

/**
 * Complete extraction result for Home insurance fact finder
 * Note: This is the API extraction result format. For UI forms, see HomeExtractionResult in home-extraction.ts
 */
export interface HomeApiExtractionResult {
  personal: HomePersonalInfo;
  property: HomePropertyInfo;
  householdMember: HomeApiHouseholdMemberInfo;
  locationDetail: HomeApiLocationDetailInfo;
  locationInformation: HomeApiLocationInformationInfo;
  policyQuestions: HomeApiPolicyQuestionsInfo;
  locationSpecificQuestions: HomeApiLocationSpecificQuestionsInfo;
  safety: HomeSafetyInfo;
  coverage: HomeCoverageInfo;
  claims: HomeClaimsHistory;
  lienholder: HomeLienholderInfo;
  updates: HomeUpdatesInfo;
}

/**
 * Scheduled items for Home insurance (jewelry, valuables)
 */
export interface HomeScheduledItem {
  description: ExtractionField;
  value: ExtractionField;
}

/**
 * Individual Home claim entry
 */
export interface HomeClaimEntry {
  date: ExtractionField;                     // Format: YYYY-MM-DD
  type: ExtractionField;                     // water, fire, theft, etc.
  amountPaid: ExtractionField;
}

// ============================================================================
// AUTO INSURANCE FIELD CATEGORIES
// ============================================================================

/**
 * Auto Personal Information - extends shared with driver-specific fields
 *
 * CONDITIONAL LOGIC:
 * - spouseFirstName, spouseLastName, spouseDOB, spouseDriversLicense, spouseLicenseState,
 *   spouseOccupation, spouseEducation: Only shown/required if maritalStatus is 'Married' or 'Domestic Partner'
 * - priorStreetAddress, priorCity, priorState, priorZipCode: Required if yearsAtCurrentAddress < 5
 * - garagingAddress fields: Only shown if garagingAddressSameAsMailing is false (No)
 */
export interface AutoPersonalInfo {
  // From Shared (will be populated from SharedPersonalInfo)
  ownerFirstName: ExtractionField;
  ownerLastName: ExtractionField;
  ownerDOB: ExtractionField;                 // Format: YYYY-MM-DD
  maritalStatus: ExtractionField;            // REQUIRED* - Single, Married, Divorced, Widowed, Domestic Partner
  spouseFirstName: ExtractionField;          // Conditional: Only if maritalStatus is Married/Domestic Partner
  spouseLastName: ExtractionField;           // Conditional: Only if maritalStatus is Married/Domestic Partner
  spouseDOB: ExtractionField;                // Format: YYYY-MM-DD, Conditional: Only if maritalStatus is Married/Domestic Partner
  streetAddress: ExtractionField;
  city: ExtractionField;
  state: ExtractionField;                    // 2-letter abbreviation
  zipCode: ExtractionField;
  garagingAddressSameAsMailing: ExtractionBooleanField; // REQUIRED* - Is garaging address same as mailing?
  garagingStreetAddress: ExtractionField;    // Conditional: Only if garagingAddressSameAsMailing is false
  garagingCity: ExtractionField;             // Conditional: Only if garagingAddressSameAsMailing is false
  garagingState: ExtractionField;            // Conditional: Only if garagingAddressSameAsMailing is false
  garagingZipCode: ExtractionField;          // Conditional: Only if garagingAddressSameAsMailing is false
  priorStreetAddress: ExtractionField;       // Conditional: Required if yearsAtCurrentAddress < 5
  priorCity: ExtractionField;                // Conditional: Required if yearsAtCurrentAddress < 5
  priorState: ExtractionField;               // Conditional: Required if yearsAtCurrentAddress < 5
  priorZipCode: ExtractionField;             // Conditional: Required if yearsAtCurrentAddress < 5
  yearsAtCurrentAddress: ExtractionField;
  phone: ExtractionField;                    // Format: (XXX) XXX-XXXX
  email: ExtractionField;
  effectiveDate: ExtractionField;            // REQUIRED* - Policy effective date, Format: YYYY-MM-DD

  // Auto-specific personal info
  ownerDriversLicense: ExtractionField;      // REQUIRED* - License number
  ownerLicenseState: ExtractionField;        // 2-letter abbreviation
  spouseDriversLicense: ExtractionField;     // Conditional: Only if maritalStatus is Married/Domestic Partner
  spouseLicenseState: ExtractionField;       // Conditional: Only if maritalStatus is Married/Domestic Partner
  ownerOccupation: ExtractionField;
  spouseOccupation: ExtractionField;         // Conditional: Only if maritalStatus is Married/Domestic Partner
  ownerEducation: ExtractionField;           // High School, Some College, Bachelor's, etc.
  spouseEducation: ExtractionField;          // Conditional: Only if maritalStatus is Married/Domestic Partner
  rideShare: ExtractionBooleanField;         // REQUIRED* - Uber, Lyft, etc.
  delivery: ExtractionBooleanField;          // REQUIRED* - DoorDash, Instacart, etc.
}

/**
 * Additional Driver for Auto Insurance
 */
export interface AutoAdditionalDriver {
  firstName: ExtractionField;                // REQUIRED*
  lastName: ExtractionField;                 // REQUIRED*
  dateOfBirth: ExtractionField;              // REQUIRED* - Format: YYYY-MM-DD
  licenseNumber: ExtractionField;            // REQUIRED*
  licenseState: ExtractionField;             // 2-letter abbreviation
  relationship: ExtractionField;             // Spouse, Child, Other
  goodStudentDiscount: ExtractionBooleanField; // GSD eligible
  vehicleAssigned: ExtractionField;          // Vehicle reference (e.g., "Vehicle 1")
}

/**
 * Automobile/Vehicle Information
 * Includes vehicle details AND deductibles (per-vehicle coverage options)
 */
export interface AutoVehicle {
  // Vehicle identification
  year: ExtractionField;                     // REQUIRED* - 4-digit year
  make: ExtractionField;                     // REQUIRED*
  model: ExtractionField;                    // REQUIRED*
  vin: ExtractionField;                      // REQUIRED* - 17 characters
  estimatedMileage: ExtractionField;
  vehicleUsage: ExtractionField;             // pleasure, commute, business
  ownership: ExtractionField;                // owned, financed, leased

  // Deductibles (per-vehicle)
  comprehensiveDeductible: ExtractionField;  // Dollar amount or "Liability Only"
  collisionDeductible: ExtractionField;      // Dollar amount or "Liability Only"
  roadTroubleService: ExtractionField;       // None, $25, $50, $75, $100
  limitedTNCCoverage: ExtractionBooleanField; // Transportation Network Company coverage (Yes/No)
  additionalExpenseCoverage: ExtractionField; // None, $15/day, $20/day, $25/day, $30/day
}

/**
 * Auto Coverage Information
 */
export interface AutoCoverageInfo {
  bodilyInjury: ExtractionField;             // REQUIRED* - e.g., "250/500"
  propertyDamage: ExtractionField;           // REQUIRED* - e.g., "100"
  uninsuredMotorist: ExtractionField;        // UM - e.g., "250/500"
  underinsuredMotorist: ExtractionField;     // UIM - e.g., "250/500"
  medicalPayments: ExtractionField;          // MED - e.g., "5000"
  towing: ExtractionBooleanField;
  rental: ExtractionBooleanField;
  offRoadVehicleLiability: ExtractionBooleanField; // Off-road vehicle liability coverage (Yes/No)
}

/**
 * Vehicle Deductibles - specific to each vehicle
 * @deprecated Deductibles are now part of AutoVehicle interface.
 * This interface is kept for backward compatibility with existing data.
 */
export interface AutoVehicleDeductible {
  vehicleReference: ExtractionField;         // REQUIRED* - "Vehicle 1", "2023 Toyota Camry", etc.
  comprehensiveDeductible: ExtractionField;  // Dollar amount or "Liability Only"
  collisionDeductible: ExtractionField;      // Dollar amount or "Liability Only"
  roadTroubleService: ExtractionField;       // None, $25, $50, $75, $100
  limitedTNCCoverage: ExtractionBooleanField; // Transportation Network Company coverage (Yes/No)
  additionalExpenseCoverage: ExtractionField; // None, $15/day, $20/day, $25/day, $30/day
}

/**
 * Lienholder Information for a Vehicle
 */
export interface AutoVehicleLienholder {
  vehicleReference: ExtractionField;         // REQUIRED* - Which vehicle this applies to
  lienholderName: ExtractionField;           // Conditional - required if financed/leased
  lienholderAddress: ExtractionField;        // Conditional - required if financed/leased
  lienholderCity: ExtractionField;
  lienholderState: ExtractionField;
  lienholderZip: ExtractionField;
}

/**
 * Prior Auto Insurance Information
 */
export interface AutoPriorInsurance {
  insuranceCompany: ExtractionField;
  premium: ExtractionField;
  policyNumber: ExtractionField;
  expirationDate: ExtractionField;           // Format: YYYY-MM-DD
}

/**
 * Accident or Ticket Entry - Last 5 Years
 */
export interface AutoAccidentOrTicket {
  driverName: ExtractionField;               // REQUIRED* - Which driver
  date: ExtractionField;                     // REQUIRED* - Format: YYYY-MM-DD
  type: ExtractionField;                     // REQUIRED* - collision, ticket, comprehensive
  description: ExtractionField;              // Details of incident
  amount: ExtractionField;                   // Claim amount if applicable
  atFault: ExtractionField;                  // REQUIRED* - Yes, No, NAF (Not At Fault)
}

/**
 * Complete Auto Extraction Result
 * Note: Deductibles are now embedded in each vehicle in the vehicles array.
 */
export interface AutoApiExtractionResult {
  personal: AutoPersonalInfo;
  additionalDrivers: AutoAdditionalDriver[];
  vehicles: AutoVehicle[];
  coverage: AutoCoverageInfo;
  lienholders: AutoVehicleLienholder[];
  priorInsurance: AutoPriorInsurance;
  accidentsOrTickets: AutoAccidentOrTicket[];
}

// ============================================================================
// COMBINED EXTRACTION RESULT (for Home + Auto)
// ============================================================================

/**
 * Combined extraction data when both Home and Auto quotes are needed
 * Shared fields are stored once and referenced by both
 */
export interface CombinedExtractionData {
  /** Shared personal info (collected once, used by both) */
  shared: SharedPersonalInfo;
  /** Auto-specific personal fields (driver's license, occupation, etc.) */
  autoPersonal: AutoSpecificPersonalInfo;
  /** Home-specific extraction data (null if auto-only) */
  home: Omit<HomeApiExtractionResult, 'personal'> | null;
  /** Auto-specific extraction data (null if home-only) */
  auto: Omit<AutoApiExtractionResult, 'personal'> | null;
  /** Quote type indicator */
  quoteType: 'home' | 'auto' | 'both';
}

// ============================================================================
// Legacy/Generic Extraction Types (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use HomeExtractionResult for Home insurance
 * Generic extraction result maintained for backward compatibility
 */
export interface ExtractionResult {
  personal: {
    firstName: ExtractionField;
    lastName: ExtractionField;
    dateOfBirth: ExtractionField;
    ssn: ExtractionField;
    address: ExtractionField;
    city: ExtractionField;
    state: ExtractionField;
    zipCode: ExtractionField;
    phone: ExtractionField;
    email: ExtractionField;
  };
  employment: {
    employer: ExtractionField;
    occupation: ExtractionField;
    income: ExtractionField;
    yearsEmployed: ExtractionField;
  };
  coverage: {
    types: ExtractionField;
    amounts: ExtractionField;
  };
  beneficiary: {
    primaryName: ExtractionField;
    primaryRelationship: ExtractionField;
    contingentName: ExtractionField;
    contingentRelationship: ExtractionField;
  };
  health: {
    conditions: ExtractionField;
    medications: ExtractionField;
    tobaccoUse: ExtractionField;
  };
  policies: {
    existingPolicies: ExtractionField;
    replacementIntent: ExtractionField;
  };
  financials: {
    assets: ExtractionField;
    liabilities: ExtractionField;
    netWorth: ExtractionField;
  };
}

// ============================================================================
// Extraction Status and Database Types
// ============================================================================

export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'quoted';

export type InsuranceType = 'home' | 'auto' | 'both' | 'life' | 'health' | 'generic';

/**
 * Database extraction record
 */
export interface Extraction {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  insurance_type?: InsuranceType;
  extracted_data: HomeApiExtractionResult | AutoApiExtractionResult | CombinedExtractionData | ExtractionResult | null;
  status: ExtractionStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Required Fields Registry
// ============================================================================

/**
 * List of required fields for Home insurance (marked with * in specs)
 * Used for validation and highlighting in review UI
 */
export const HOME_REQUIRED_FIELDS: string[] = [
  // Property
  'property.yearBuilt',
  'property.exteriorConstruction',
  'property.roofAge',
  'property.foundationType',
  'property.numberOfFireplaces',

  // Coverage
  'coverage.dwellingCoverage',
  'coverage.liabilityCoverage',
  'coverage.medicalPayments',
  'coverage.deductible',

  // Claims
  'claims.claimsInLast5Years',

  // Lienholder
  'lienholder.currentEffectiveDate',

  // Updates
  'updates.hvacUpdateYear',
  'updates.plumbingUpdateYear',
  'updates.roofUpdateYear',
  'updates.electricalUpdateYear',
  'updates.hasCircuitBreakers',
];

/**
 * Field metadata for UI labels and descriptions
 */
export const HOME_FIELD_LABELS: Record<string, { label: string; description?: string }> = {
  // Personal
  'personal.firstName': { label: 'First Name' },
  'personal.lastName': { label: 'Last Name' },
  'personal.dateOfBirth': { label: 'Date of Birth', description: 'Applicant DOB' },
  'personal.ssn': { label: 'SSN', description: 'Applicant Social Security Number' },
  'personal.spouseFirstName': { label: 'Spouse First Name' },
  'personal.spouseLastName': { label: 'Spouse Last Name' },
  'personal.spouseDateOfBirth': { label: 'Spouse DOB' },
  'personal.spouseSsn': { label: 'Spouse SSN' },
  'personal.streetAddress': { label: 'Street Address' },
  'personal.city': { label: 'City' },
  'personal.state': { label: 'State' },
  'personal.zipCode': { label: 'ZIP Code' },
  'personal.priorStreetAddress': { label: 'Prior Street Address', description: 'If less than 5 years at current' },
  'personal.priorCity': { label: 'Prior City' },
  'personal.priorState': { label: 'Prior State' },
  'personal.priorZipCode': { label: 'Prior ZIP Code' },
  'personal.yearsAtCurrentAddress': { label: 'Years at Current Address' },
  'personal.phone': { label: 'Phone Number' },
  'personal.email': { label: 'Email Address' },

  // Property
  'property.purchaseDate': { label: 'Purchase Date' },
  'property.yearBuilt': { label: 'Year Built', description: 'Required' },
  'property.squareFootage': { label: 'Square Footage' },
  'property.numberOfStories': { label: 'Number of Stories' },
  'property.numberOfKitchens': { label: 'Number of Kitchens' },
  'property.kitchenStyle': { label: 'Kitchen Style' },
  'property.numberOfBathrooms': { label: 'Number of Bathrooms' },
  'property.bathroomStyle': { label: 'Bathroom Style' },
  'property.flooringPercentage': { label: 'Flooring Breakdown', description: 'Percentage by type' },
  'property.heatType': { label: 'Heat Type', description: 'Gas, Electric, Oil, etc.' },
  'property.exteriorConstruction': { label: 'Exterior Construction', description: 'Required - Brick, Siding, etc.' },
  'property.exteriorFeatures': { label: 'Exterior Features' },
  'property.roofAge': { label: 'Roof Age', description: 'Required - Age in years' },
  'property.roofConstruction': { label: 'Roof Construction', description: 'Shingle, Metal, Tile, etc.' },
  'property.foundationType': { label: 'Foundation Type', description: 'Required - Slab, Basement, Crawl' },
  'property.hasFinishedBasement': { label: 'Finished Basement' },
  'property.garageType': { label: 'Garage Type', description: 'Attached, Detached, Carport' },
  'property.numberOfCarGarage': { label: 'Garage Size', description: 'Number of cars' },
  'property.numberOfFireplaces': { label: 'Number of Fireplaces', description: 'Required' },
  'property.fireplaceType': { label: 'Fireplace Type', description: 'Wood, Gas, Electric' },
  'property.deckPatioDetails': { label: 'Deck/Patio/Porch Details' },
  'property.isCondoOrTownhouse': { label: 'Condo or Townhouse' },
  'property.specialFeatures': { label: 'Special Features' },

  // Safety
  'safety.hasAlarmSystem': { label: 'Has Alarm System' },
  'safety.isAlarmMonitored': { label: 'Alarm is Monitored' },
  'safety.hasPool': { label: 'Has Pool' },
  'safety.hasTrampoline': { label: 'Has Trampoline' },
  'safety.hasEnclosedYard': { label: 'Has Enclosed Yard' },
  'safety.hasDog': { label: 'Has Dog' },
  'safety.dogBreed': { label: 'Dog Breed' },

  // Coverage
  'coverage.dwellingCoverage': { label: 'Dwelling Coverage', description: 'Required - Coverage A' },
  'coverage.liabilityCoverage': { label: 'Liability Coverage', description: 'Required' },
  'coverage.medicalPayments': { label: 'Medical Payments', description: 'Required - Med Pay' },
  'coverage.deductible': { label: 'Deductible', description: 'Required' },
  'coverage.personalPropertyCoverage': { label: 'Personal Property', description: 'Coverage C' },
  'coverage.lossOfUseCoverage': { label: 'Loss of Use', description: 'Coverage D' },

  // Claims
  'claims.claimsInLast5Years': { label: 'Claims in Last 5 Years', description: 'Required' },
  'claims.numberOfClaims': { label: 'Number of Claims' },
  'claims.claimDetails': { label: 'Claim Details' },

  // Lienholder
  'lienholder.lienholderName': { label: 'Lienholder Name' },
  'lienholder.lienholderAddress': { label: 'Lienholder Address' },
  'lienholder.loanNumber': { label: 'Loan Number' },
  'lienholder.currentInsuranceCompany': { label: 'Current Insurance Company' },
  'lienholder.currentPolicyNumber': { label: 'Current Policy Number' },
  'lienholder.currentEffectiveDate': { label: 'Policy Effective Date', description: 'Required' },
  'lienholder.currentPremium': { label: 'Current Premium' },
  'lienholder.isEscrowed': { label: 'Is Escrowed' },
  'lienholder.hasBeenCancelledOrDeclined': { label: 'Cancelled/Declined/Non-Renewed' },
  'lienholder.cancelDeclineDetails': { label: 'Cancel/Decline Details' },
  'lienholder.referredBy': { label: 'Referred By' },

  // Updates
  'updates.hvacUpdateYear': { label: 'HVAC Update Year', description: 'Required' },
  'updates.plumbingUpdateYear': { label: 'Plumbing Update Year', description: 'Required' },
  'updates.roofUpdateYear': { label: 'Roof Update Year', description: 'Required' },
  'updates.electricalUpdateYear': { label: 'Electrical Update Year', description: 'Required' },
  'updates.hasCircuitBreakers': { label: 'Has Circuit Breakers', description: 'Required - vs fuse box' },
};

// ============================================================================
// Auto Insurance Required Fields Registry
// ============================================================================

/**
 * List of required fields for Auto insurance (marked with * in specs)
 * Used for validation and highlighting in review UI
 *
 * CONDITIONAL REQUIREMENTS:
 * - Spouse fields: Required only if maritalStatus is 'Married' or 'Domestic Partner'
 * - Prior address fields: Required if yearsAtCurrentAddress < 5
 * - Garaging address fields: Required if garagingAddressSameAsMailing is false
 *
 * Note: Deductibles are now part of the vehicle object, not a separate array.
 */
export const AUTO_REQUIRED_FIELDS: string[] = [
  // Personal
  'personal.ownerDriversLicense',
  'personal.maritalStatus',
  'personal.garagingAddressSameAsMailing',
  'personal.effectiveDate',
  'personal.rideShare',
  'personal.delivery',

  // Vehicles (per vehicle) - includes vehicle info and deductibles
  'vehicles[].year',
  'vehicles[].make',
  'vehicles[].model',
  'vehicles[].vin',

  // Additional Drivers (per driver)
  'additionalDrivers[].firstName',
  'additionalDrivers[].lastName',
  'additionalDrivers[].dateOfBirth',
  'additionalDrivers[].licenseNumber',

  // Coverage
  'coverage.bodilyInjury',
  'coverage.propertyDamage',

  // Accidents/Tickets (per incident)
  'accidentsOrTickets[].driverName',
  'accidentsOrTickets[].date',
  'accidentsOrTickets[].type',
  'accidentsOrTickets[].atFault',
];

/**
 * Field metadata for Auto UI labels and descriptions
 */
export const AUTO_FIELD_LABELS: Record<string, { label: string; description?: string }> = {
  // Personal (shared fields)
  'personal.ownerFirstName': { label: 'Owner First Name' },
  'personal.ownerLastName': { label: 'Owner Last Name' },
  'personal.ownerDOB': { label: 'Owner Date of Birth', description: 'Format: MM/DD/YYYY' },
  'personal.maritalStatus': { label: 'Marital Status', description: 'Required - Single, Married, Divorced, Widowed, Domestic Partner' },
  'personal.spouseFirstName': { label: 'Spouse First Name', description: 'Only if Married or Domestic Partner' },
  'personal.spouseLastName': { label: 'Spouse Last Name', description: 'Only if Married or Domestic Partner' },
  'personal.spouseDOB': { label: 'Spouse Date of Birth', description: 'Only if Married or Domestic Partner' },
  'personal.streetAddress': { label: 'Street Address' },
  'personal.city': { label: 'City' },
  'personal.state': { label: 'State', description: '2-letter abbreviation' },
  'personal.zipCode': { label: 'ZIP Code' },
  'personal.garagingAddressSameAsMailing': { label: 'Garaging Address Same as Mailing', description: 'Required - Yes/No' },
  'personal.garagingStreetAddress': { label: 'Garaging Street Address', description: 'If different from mailing address' },
  'personal.garagingCity': { label: 'Garaging City', description: 'If different from mailing address' },
  'personal.garagingState': { label: 'Garaging State', description: 'If different from mailing address' },
  'personal.garagingZipCode': { label: 'Garaging ZIP Code', description: 'If different from mailing address' },
  'personal.priorStreetAddress': { label: 'Prior Street Address', description: 'If less than 5 years at current' },
  'personal.priorCity': { label: 'Prior City' },
  'personal.priorState': { label: 'Prior State' },
  'personal.priorZipCode': { label: 'Prior ZIP Code' },
  'personal.yearsAtCurrentAddress': { label: 'Years at Current Address' },
  'personal.phone': { label: 'Phone Number' },
  'personal.email': { label: 'Email Address' },
  'personal.effectiveDate': { label: 'Effective Date', description: 'Required - Policy start date' },

  // Auto-specific personal
  'personal.ownerDriversLicense': { label: 'Owner Driver\'s License', description: 'Required' },
  'personal.ownerLicenseState': { label: 'Owner License State' },
  'personal.spouseDriversLicense': { label: 'Spouse Driver\'s License', description: 'Only if Married or Domestic Partner' },
  'personal.spouseLicenseState': { label: 'Spouse License State', description: 'Only if Married or Domestic Partner' },
  'personal.ownerOccupation': { label: 'Owner Occupation' },
  'personal.spouseOccupation': { label: 'Spouse Occupation', description: 'Only if Married or Domestic Partner' },
  'personal.ownerEducation': { label: 'Owner Education Level' },
  'personal.spouseEducation': { label: 'Spouse Education Level', description: 'Only if Married or Domestic Partner' },
  'personal.rideShare': { label: 'Ride Share Driver', description: 'Required - Uber, Lyft, etc.' },
  'personal.delivery': { label: 'Delivery Driver', description: 'Required - DoorDash, Instacart, etc.' },

  // Additional Drivers
  'additionalDrivers[].firstName': { label: 'Driver First Name', description: 'Required' },
  'additionalDrivers[].lastName': { label: 'Driver Last Name', description: 'Required' },
  'additionalDrivers[].dateOfBirth': { label: 'Driver DOB', description: 'Required' },
  'additionalDrivers[].licenseNumber': { label: 'Driver License Number', description: 'Required' },
  'additionalDrivers[].licenseState': { label: 'Driver License State' },
  'additionalDrivers[].relationship': { label: 'Relationship to Owner' },
  'additionalDrivers[].goodStudentDiscount': { label: 'Good Student Discount (GSD)' },
  'additionalDrivers[].vehicleAssigned': { label: 'Vehicle Assigned' },

  // Vehicles (includes vehicle info AND deductibles)
  'vehicles[].year': { label: 'Vehicle Year', description: 'Required' },
  'vehicles[].make': { label: 'Vehicle Make', description: 'Required' },
  'vehicles[].model': { label: 'Vehicle Model', description: 'Required' },
  'vehicles[].vin': { label: 'VIN', description: 'Required - 17 characters' },
  'vehicles[].estimatedMileage': { label: 'Estimated Annual Mileage' },
  'vehicles[].vehicleUsage': { label: 'Vehicle Usage', description: 'Pleasure, Commute, Business' },
  'vehicles[].ownership': { label: 'Vehicle Ownership', description: 'Owned, Financed, Leased' },
  // Vehicle deductibles (per-vehicle)
  'vehicles[].comprehensiveDeductible': { label: 'Comprehensive Deductible', description: 'Or "Liability Only"' },
  'vehicles[].collisionDeductible': { label: 'Collision Deductible', description: 'Or "Liability Only"' },
  'vehicles[].roadTroubleService': { label: 'Road Trouble Service', description: 'None, $25, $50, $75, $100' },
  'vehicles[].limitedTNCCoverage': { label: 'Limited TNC Coverage', description: 'Transportation Network Company (Uber/Lyft driver) coverage' },
  'vehicles[].additionalExpenseCoverage': { label: 'Additional Expense Coverage', description: 'Daily rental reimbursement rate' },

  // Coverage
  'coverage.bodilyInjury': { label: 'Bodily Injury (BI)', description: 'Required - e.g., 250/500' },
  'coverage.propertyDamage': { label: 'Property Damage (PD)', description: 'Required - e.g., 100' },
  'coverage.uninsuredMotorist': { label: 'Uninsured Motorist (UM)' },
  'coverage.underinsuredMotorist': { label: 'Underinsured Motorist (UIM)' },
  'coverage.medicalPayments': { label: 'Medical Payments (MED)' },
  'coverage.towing': { label: 'Towing Coverage' },
  'coverage.rental': { label: 'Rental Reimbursement' },
  'coverage.offRoadVehicleLiability': { label: 'Off-Road Vehicle Liability', description: 'Coverage for ATVs, dirt bikes, etc.' },

  // Lienholders
  'lienholders[].vehicleReference': { label: 'Vehicle', description: 'Which vehicle' },
  'lienholders[].lienholderName': { label: 'Lienholder Name', description: 'Required if financed/leased' },
  'lienholders[].lienholderAddress': { label: 'Lienholder Address' },
  'lienholders[].lienholderCity': { label: 'Lienholder City' },
  'lienholders[].lienholderState': { label: 'Lienholder State' },
  'lienholders[].lienholderZip': { label: 'Lienholder ZIP' },

  // Prior Insurance
  'priorInsurance.insuranceCompany': { label: 'Prior Insurance Company' },
  'priorInsurance.premium': { label: 'Prior Premium' },
  'priorInsurance.policyNumber': { label: 'Prior Policy Number' },
  'priorInsurance.expirationDate': { label: 'Policy Expiration Date' },

  // Accidents/Tickets
  'accidentsOrTickets[].driverName': { label: 'Driver Name', description: 'Required' },
  'accidentsOrTickets[].date': { label: 'Incident Date', description: 'Required' },
  'accidentsOrTickets[].type': { label: 'Incident Type', description: 'Required - Collision, Ticket, Comprehensive' },
  'accidentsOrTickets[].description': { label: 'Description' },
  'accidentsOrTickets[].amount': { label: 'Claim Amount' },
  'accidentsOrTickets[].atFault': { label: 'At Fault', description: 'Required - Yes, No, NAF' },
};

// ============================================================================
// Shared Fields Registry
// ============================================================================

/**
 * Shared fields between Home and Auto (collected once)
 */
export const SHARED_REQUIRED_FIELDS: string[] = [
  'shared.ownerFirstName',
  'shared.ownerLastName',
  'shared.ownerDOB',
  'shared.streetAddress',
  'shared.city',
  'shared.state',
  'shared.zipCode',
  'shared.phone',
];

/**
 * Field metadata for shared fields UI labels
 */
export const SHARED_FIELD_LABELS: Record<string, { label: string; description?: string }> = {
  'shared.ownerFirstName': { label: 'Owner First Name' },
  'shared.ownerLastName': { label: 'Owner Last Name' },
  'shared.ownerDOB': { label: 'Owner Date of Birth' },
  'shared.spouseFirstName': { label: 'Spouse First Name' },
  'shared.spouseLastName': { label: 'Spouse Last Name' },
  'shared.spouseDOB': { label: 'Spouse Date of Birth' },
  'shared.streetAddress': { label: 'Street Address' },
  'shared.city': { label: 'City' },
  'shared.state': { label: 'State', description: '2-letter abbreviation' },
  'shared.zipCode': { label: 'ZIP Code' },
  'shared.priorStreetAddress': { label: 'Prior Street Address', description: 'Required if less than 5 years at current' },
  'shared.priorCity': { label: 'Prior City' },
  'shared.priorState': { label: 'Prior State' },
  'shared.priorZipCode': { label: 'Prior ZIP Code' },
  'shared.yearsAtCurrentAddress': { label: 'Years at Current Address' },
  'shared.phone': { label: 'Phone Number' },
  'shared.email': { label: 'Email Address' },
};
