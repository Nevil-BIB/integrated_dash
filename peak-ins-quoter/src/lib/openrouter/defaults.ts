/**
 * Default field creators and default extraction results
 *
 * These functions create properly initialized extraction results with default values
 * for all fields. Used when extraction fails or as a base for merging partial results.
 */

import {
  ExtractionResult,
  ExtractionField,
  ExtractionBooleanField,
  HomeApiExtractionResult,
  HomePersonalInfo,
  HomePropertyInfo,
  HomeSafetyInfo,
  HomeCoverageInfo,
  HomeClaimsHistory,
  HomeLienholderInfo,
  HomeUpdatesInfo,
  HomeApiHouseholdMemberInfo,
  HomeApiLocationDetailInfo,
  HomeApiLocationInformationInfo,
  HomeApiPolicyQuestionsInfo,
  HomeApiLocationSpecificQuestionsInfo,
  AutoApiExtractionResult,
  AutoPersonalInfo,
  AutoCoverageInfo,
  AutoPriorInsurance,
} from '@/types/extraction'

// =============================================================================
// Base Field Creators
// =============================================================================

/**
 * Create a default text extraction field
 */
export function createDefaultField(value: string | null = null): ExtractionField {
  return {
    value,
    confidence: 'low',
    flagged: true,
    rawText: undefined,
  }
}

/**
 * Create a default boolean extraction field
 */
export function createDefaultBooleanField(value: boolean | null = null): ExtractionBooleanField {
  return {
    value,
    confidence: 'low',
    flagged: true,
    rawText: undefined,
  }
}

// =============================================================================
// Home Insurance Default Creators
// =============================================================================

/**
 * Create default HomePersonalInfo
 */
export function createDefaultHomePersonalInfo(): HomePersonalInfo {
  return {
    firstName: createDefaultField(),
    lastName: createDefaultField(),
    dateOfBirth: createDefaultField(),
    ssn: createDefaultField(),
    spouseFirstName: createDefaultField(),
    spouseLastName: createDefaultField(),
    spouseDateOfBirth: createDefaultField(),
    spouseSsn: createDefaultField(),
    streetAddress: createDefaultField(),
    city: createDefaultField(),
    state: createDefaultField(),
    zipCode: createDefaultField(),
    priorStreetAddress: createDefaultField(),
    priorCity: createDefaultField(),
    priorState: createDefaultField(),
    priorZipCode: createDefaultField(),
    yearsAtCurrentAddress: createDefaultField(),
    phone: createDefaultField(),
    email: createDefaultField(),
  }
}

/**
 * Create default HomePropertyInfo
 */
export function createDefaultHomePropertyInfo(): HomePropertyInfo {
  return {
    purchaseDate: createDefaultField(),
    yearBuilt: createDefaultField(),
    squareFootage: createDefaultField(),
    numberOfStories: createDefaultField(),
    numberOfKitchens: createDefaultField(),
    kitchenStyle: createDefaultField(),
    numberOfBathrooms: createDefaultField(),
    bathroomStyle: createDefaultField(),
    flooringPercentage: createDefaultField(),
    heatType: createDefaultField(),
    exteriorConstruction: createDefaultField(),
    exteriorFeatures: createDefaultField(),
    roofAge: createDefaultField(),
    roofConstruction: createDefaultField(),
    foundationType: createDefaultField(),
    hasFinishedBasement: createDefaultBooleanField(),
    garageType: createDefaultField(),
    numberOfCarGarage: createDefaultField(),
    numberOfFireplaces: createDefaultField(),
    fireplaceType: createDefaultField(),
    deckPatioDetails: createDefaultField(),
    isCondoOrTownhouse: createDefaultBooleanField(),
    specialFeatures: createDefaultField(),
  }
}

/**
 * Create default HomeSafetyInfo
 */
export function createDefaultHomeSafetyInfo(): HomeSafetyInfo {
  return {
    hasAlarmSystem: createDefaultBooleanField(),
    isAlarmMonitored: createDefaultBooleanField(),
    hasPool: createDefaultBooleanField(),
    hasTrampoline: createDefaultBooleanField(),
    hasEnclosedYard: createDefaultBooleanField(),
    hasDog: createDefaultBooleanField(),
    dogBreed: createDefaultField(),
  }
}

/**
 * Create default HomeCoverageInfo
 */
export function createDefaultHomeCoverageInfo(): HomeCoverageInfo {
  return {
    dwellingCoverage: createDefaultField(),
    liabilityCoverage: createDefaultField(),
    medicalPayments: createDefaultField(),
    deductible: createDefaultField(),
    personalPropertyCoverage: createDefaultField(),
    lossOfUseCoverage: createDefaultField(),
  }
}

/**
 * Create default HomeClaimsHistory
 */
export function createDefaultHomeClaimsHistory(): HomeClaimsHistory {
  return {
    claimsInLast5Years: createDefaultField(),
    numberOfClaims: createDefaultField(),
    claimDetails: createDefaultField(),
  }
}

/**
 * Create default HomeLienholderInfo
 */
export function createDefaultHomeLienholderInfo(): HomeLienholderInfo {
  return {
    lienholderName: createDefaultField(),
    lienholderAddress: createDefaultField(),
    loanNumber: createDefaultField(),
    currentInsuranceCompany: createDefaultField(),
    currentPolicyNumber: createDefaultField(),
    currentEffectiveDate: createDefaultField(),
    currentPremium: createDefaultField(),
    isEscrowed: createDefaultBooleanField(),
    hasBeenCancelledOrDeclined: createDefaultBooleanField(),
    cancelDeclineDetails: createDefaultField(),
    referredBy: createDefaultField(),
  }
}

/**
 * Create default HomeUpdatesInfo
 */
export function createDefaultHomeUpdatesInfo(): HomeUpdatesInfo {
  return {
    hvacUpdateYear: createDefaultField(),
    plumbingUpdateYear: createDefaultField(),
    roofUpdateYear: createDefaultField(),
    electricalUpdateYear: createDefaultField(),
    hasCircuitBreakers: createDefaultBooleanField(),
  }
}

export function createDefaultHomeHouseholdMemberInfo(): HomeApiHouseholdMemberInfo {
  return {
    firstName: createDefaultField(),
    lastName: createDefaultField(),
    suffix: createDefaultField(),
    dob: createDefaultField(),
    ssn: createDefaultField(),
    relationship: createDefaultField(),
    maritalStatus: createDefaultField(),
    dlState: createDefaultField(),
    dlNumber: createDefaultField(),
  }
}

export function createDefaultHomeLocationDetailInfo(): HomeApiLocationDetailInfo {
  return {
    locationOccupancy: createDefaultField(),
    ownerOccupied: createDefaultField(),
    vacant: createDefaultField(),
    liabilityCoverageOnly: createDefaultField(),
    personalPropertyOnly: createDefaultField(),
  }
}

export function createDefaultHomeLocationInformationInfo(): HomeApiLocationInformationInfo {
  return {
    program: createDefaultField(),
    type: createDefaultField(),
    coverageA: createDefaultField(),
    coverageF: createDefaultField(),
    personalInjury: createDefaultField(),
    coverageG: createDefaultField(),
    constructionYear: createDefaultField(),
    construction: createDefaultField(),
    foundation: createDefaultField(),
    finishedLivingArea: createDefaultField(),
    numberOfFamiliesUnits: createDefaultField(),
    replacementCost100: createDefaultField(),
    roofLossSettlementWindstormHail: createDefaultField(),
    roofingMaterial: createDefaultField(),
    roofUpdateYear: createDefaultField(),
    marketValue: createDefaultField(),
    hasMortgageeContractHolderOrSecuredLineOfCredit: createDefaultField(),
    boardingOrLodgingOrStudentRentals: createDefaultField(),
    isStudentRental: createDefaultField(),
    visibleFromOtherDwellings: createDefaultField(),
    fortifiedHome: createDefaultField(),
    woodCoalHeating: createDefaultField(),
    woodCoalHeatingLocation: createDefaultField(),
    woodCoalHeatingQuantity: createDefaultField(),
    gatedAccessToDwelling: createDefaultField(),
    applicantWillingToCompleteDiySurvey: createDefaultField(),
    screenedEnclosure: createDefaultField(),
    dwellingConstructedWithAsbestos: createDefaultField(),
    floodZone: createDefaultField(),
    coastalStormRiskArea: createDefaultField(),
    locatedOnIsland: createDefaultField(),
    conditionOfDwelling: createDefaultField(),
    dogsOwnedOrKept: createDefaultField(),
    specificBreed: createDefaultField(),
    biteHistoryAggressiveBehavior: createDefaultField(),
    isLocationWithinCity: createDefaultField(),
    respondingFireDepartment: createDefaultField(),
    communityName: createDefaultField(),
    within1000FeetOfHydrant: createDefaultField(),
    bridgeAccess: createDefaultField(),
    windHailDeductible: createDefaultField(),
    hurricaneDeductible: createDefaultField(),
    county: createDefaultField(),
    locationInformationOccupancy: createDefaultField(),
    territory: createDefaultField(),
    ownership: createDefaultField(),
    allOtherPerilsDeductible: createDefaultField(),
    distanceToHydrantFeet: createDefaultField(),
    distanceToFireStationMiles: createDefaultField(),
    protectionClass: createDefaultField(),
  }
}

export function createDefaultHomePolicyQuestionsInfo(): HomeApiPolicyQuestionsInfo {
  return {
    pleaseExplain: createDefaultField(),
    hasAnyCompanyCanceledRefusedOrDeclinedRenewal: createDefaultField(),
    hasAutoOwnersInsurancePast5Years: createDefaultField(),
    options: createDefaultField(),
    previousPolicyNumber: createDefaultField(),
    hasFiledPersonalBankruptcyOrJudgementsPast5Years: createDefaultField(),
    bankruptcyPleaseExplain: createDefaultField(),
    hasAnyApplicantBeenConvictedOfArson: createDefaultField(),
  }
}

export function createDefaultHomeLocationSpecificQuestionsInfo(): HomeApiLocationSpecificQuestionsInfo {
  return {
    dwellingForSale: createDefaultField(),
    isNewVentureNoPreviousLandlordOrRentalPropertyExperience: createDefaultField(),
    areThereAnyOutbuildingsOnPremises: createDefaultField(),
    anyFloodingBrushLandslideOrUnusualHazards: createDefaultField(),
    areDogsAllowed: createDefaultField(),
    anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets: createDefaultField(),
    anyUncorrectedFireCodeViolations: createDefaultField(),
    difficultAccessByFireAndPoliceDepartments: createDefaultField(),
    dwellingNewPurchase: createDefaultField(),
    purchasePrice: createDefaultField(),
    dwellingOccupied: createDefaultField(),
    pleaseExplain: createDefaultField(),
    expectedOccupancyDate: createDefaultField(),
    dayCareOnPremises: createDefaultField(),
    childrenCaredForCount: createDefaultField(),
    farmingOnPremises: createDefaultField(),
    acresFarmedByOthers: createDefaultField(),
    numberOfAnimalsLarge: createDefaultField(),
    numberOfAnimalsMedium: createDefaultField(),
    numberOfAnimalsSmall: createDefaultField(),
    otherBusinessOnPremises: createDefaultField(),
    describeBusiness: createDefaultField(),
    buildingUnderRenovationOrReconstruction: createDefaultField(),
    householdMembersLivingDuringRenovation: createDefaultField(),
    renovationExplanation: createDefaultField(),
    responsesVerifiedWithApplicant: createDefaultField(),
  }
}

/**
 * Create a complete default HomeApiExtractionResult
 */
export function createDefaultHomeApiExtractionResult(): HomeApiExtractionResult {
  return {
    personal: createDefaultHomePersonalInfo(),
    property: createDefaultHomePropertyInfo(),
    householdMember: createDefaultHomeHouseholdMemberInfo(),
    locationDetail: createDefaultHomeLocationDetailInfo(),
    locationInformation: createDefaultHomeLocationInformationInfo(),
    policyQuestions: createDefaultHomePolicyQuestionsInfo(),
    locationSpecificQuestions: createDefaultHomeLocationSpecificQuestionsInfo(),
    safety: createDefaultHomeSafetyInfo(),
    coverage: createDefaultHomeCoverageInfo(),
    claims: createDefaultHomeClaimsHistory(),
    lienholder: createDefaultHomeLienholderInfo(),
    updates: createDefaultHomeUpdatesInfo(),
  }
}

// =============================================================================
// Auto Insurance Default Creators
// =============================================================================

/**
 * Create default AutoPersonalInfo
 *
 * CONDITIONAL LOGIC:
 * - spouseFirstName, spouseLastName, spouseDOB, spouseDriversLicense, spouseLicenseState,
 *   spouseOccupation, spouseEducation: Only shown/required if maritalStatus is 'Married' or 'Domestic Partner'
 * - priorStreetAddress, priorCity, priorState, priorZipCode: Required if yearsAtCurrentAddress < 5
 * - garagingAddress fields: Only shown if garagingAddressSameAsMailing is false (No)
 */
export function createDefaultAutoPersonalInfo(): AutoPersonalInfo {
  return {
    effectiveDate: createDefaultField(),
    ownerFirstName: createDefaultField(),
    ownerLastName: createDefaultField(),
    ownerDOB: createDefaultField(),
    maritalStatus: createDefaultField(),
    spouseFirstName: createDefaultField(),
    spouseLastName: createDefaultField(),
    spouseDOB: createDefaultField(),
    streetAddress: createDefaultField(),
    city: createDefaultField(),
    state: createDefaultField(),
    zipCode: createDefaultField(),
    garagingAddressSameAsMailing: createDefaultBooleanField(),
    garagingStreetAddress: createDefaultField(),
    garagingCity: createDefaultField(),
    garagingState: createDefaultField(),
    garagingZipCode: createDefaultField(),
    priorStreetAddress: createDefaultField(),
    priorCity: createDefaultField(),
    priorState: createDefaultField(),
    priorZipCode: createDefaultField(),
    yearsAtCurrentAddress: createDefaultField(),
    phone: createDefaultField(),
    email: createDefaultField(),
    ownerDriversLicense: createDefaultField(),
    ownerLicenseState: createDefaultField(),
    spouseDriversLicense: createDefaultField(),
    spouseLicenseState: createDefaultField(),
    ownerOccupation: createDefaultField(),
    spouseOccupation: createDefaultField(),
    ownerEducation: createDefaultField(),
    spouseEducation: createDefaultField(),
    rideShare: createDefaultBooleanField(),
    delivery: createDefaultBooleanField(),
  }
}

/**
 * Create default AutoCoverageInfo
 */
export function createDefaultAutoCoverageInfo(): AutoCoverageInfo {
  return {
    bodilyInjury: createDefaultField(),
    propertyDamage: createDefaultField(),
    uninsuredMotorist: createDefaultField(),
    underinsuredMotorist: createDefaultField(),
    medicalPayments: createDefaultField(),
    towing: createDefaultBooleanField(),
    rental: createDefaultBooleanField(),
    offRoadVehicleLiability: createDefaultBooleanField(),
  }
}

/**
 * Create default AutoPriorInsurance
 */
export function createDefaultAutoPriorInsurance(): AutoPriorInsurance {
  return {
    insuranceCompany: createDefaultField(),
    premium: createDefaultField(),
    policyNumber: createDefaultField(),
    expirationDate: createDefaultField(),
  }
}

/**
 * Create a complete default AutoApiExtractionResult
 * Note: Deductibles are now embedded in each vehicle, not a separate array.
 */
export function createDefaultAutoApiExtractionResult(): AutoApiExtractionResult {
  return {
    personal: createDefaultAutoPersonalInfo(),
    additionalDrivers: [],
    vehicles: [],
    coverage: createDefaultAutoCoverageInfo(),
    lienholders: [],
    priorInsurance: createDefaultAutoPriorInsurance(),
    accidentsOrTickets: [],
  }
}

// =============================================================================
// Legacy Default Result (backward compatibility)
// =============================================================================

/**
 * Create a complete default ExtractionResult (legacy)
 * @deprecated Use createDefaultHomeApiExtractionResult for Home insurance
 */
export function createDefaultExtractionResult(): ExtractionResult {
  return {
    personal: {
      firstName: createDefaultField(),
      lastName: createDefaultField(),
      dateOfBirth: createDefaultField(),
      ssn: createDefaultField(),
      address: createDefaultField(),
      city: createDefaultField(),
      state: createDefaultField(),
      zipCode: createDefaultField(),
      phone: createDefaultField(),
      email: createDefaultField(),
    },
    employment: {
      employer: createDefaultField(),
      occupation: createDefaultField(),
      income: createDefaultField(),
      yearsEmployed: createDefaultField(),
    },
    coverage: {
      types: createDefaultField(),
      amounts: createDefaultField(),
    },
    beneficiary: {
      primaryName: createDefaultField(),
      primaryRelationship: createDefaultField(),
      contingentName: createDefaultField(),
      contingentRelationship: createDefaultField(),
    },
    health: {
      conditions: createDefaultField(),
      medications: createDefaultField(),
      tobaccoUse: createDefaultField(),
    },
    policies: {
      existingPolicies: createDefaultField(),
      replacementIntent: createDefaultField(),
    },
    financials: {
      assets: createDefaultField(),
      liabilities: createDefaultField(),
      netWorth: createDefaultField(),
    },
  }
}
