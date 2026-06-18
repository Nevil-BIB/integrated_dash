/**
 * Home Insurance Extraction Types
 * Type definitions for home insurance quote data extraction
 *
 * Carrier Requirements Covered: Safeco, Auto-Owners, Cincinnati
 *
 * CONDITIONAL LOGIC NOTES:
 * - Spouse fields (spouseFirstName, spouseLastName, spouseDOB, spouseSSN) only shown if coApplicantPresent = 'Yes'
 * - Prior address fields (priorAddress, priorCity, priorState, priorZipCode) required if yearsAtCurrentAddress < 5
 * - dogBreed required if dog = 'Yes'
 * - wiringYear required if wiringUpdate = 'Yes'
 * - All update year fields required if corresponding update flag = 'Yes'
 * - daysRentedToOthers only shown if shortTermRental = 'Yes'
 * - windMitigation, stormShutters, impactGlass typically required for coastal/hurricane-prone areas
 */

import { ExtractionField } from './extraction'

// =============================================================================
// Field Configuration Types
// =============================================================================

export type HomeFieldInputType = 'text' | 'select' | 'date' | 'tel' | 'email' | 'number' | 'textarea' | 'checkbox'

export interface HomeFieldConfig {
  label: string
  inputType: HomeFieldInputType
  required: boolean
  options?: string[]
  placeholder?: string
  /** Field that controls whether this field is shown */
  conditionalOn?: string
  /** Value the conditional field must have to show this field */
  conditionalValue?: string | string[]
}

// =============================================================================
// Shared Options Constants
// =============================================================================

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]

const YES_NO_OPTIONS = ['Yes', 'No']

// =============================================================================
// Home Extraction Result Type - Personal Section
// =============================================================================

export interface HomeExtractionPersonal {
  firstName: ExtractionField
  lastName: ExtractionField
  // Carrier requirement: Safeco, Auto-Owners, Cincinnati
  maritalStatus: ExtractionField
  // Carrier requirement: All carriers - determines if spouse fields are shown
  coApplicantPresent: ExtractionField
  // Conditional: Only shown if coApplicantPresent = 'Yes'
  spouseFirstName: ExtractionField
  spouseLastName: ExtractionField
  spouseDOB: ExtractionField
  spouseSSN: ExtractionField
  // Carrier requirement: Cincinnati
  occupation: ExtractionField
  address: ExtractionField
  city: ExtractionField
  state: ExtractionField
  zipCode: ExtractionField
  yearsAtCurrentAddress: ExtractionField
  livedAtDifferentAddressPast6Months: ExtractionField
  // Conditional: Required if yearsAtCurrentAddress < 5
  priorAddress: ExtractionField
  priorCity: ExtractionField
  priorState: ExtractionField
  priorZipCode: ExtractionField
  phone: ExtractionField
  email: ExtractionField
  mailingAddress: ExtractionField
  termLength: ExtractionField
  agentProducerName: ExtractionField
  country: ExtractionField
  entity: ExtractionField
  applicantDOB: ExtractionField
  applicantSSN: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Property Section
// =============================================================================

export interface HomeExtractionProperty {
  purchaseDate: ExtractionField
  yearBuilt: ExtractionField
  squareFootage: ExtractionField
  numberOfStories: ExtractionField
  // Carrier requirement: Safeco, Auto-Owners
  bedroomCount: ExtractionField
  kitchenCount: ExtractionField
  kitchenStyle: ExtractionField
  bathroomCount: ExtractionField
  bathroomStyle: ExtractionField
  flooringPercentage: ExtractionField
  heatType: ExtractionField
  // Carrier requirement: All carriers
  dwellingType: ExtractionField
  // Carrier requirement: Safeco, Cincinnati
  constructionStyle: ExtractionField
  // Carrier requirement: Auto-Owners, Cincinnati
  constructionQuality: ExtractionField
  // Carrier requirement: Safeco
  homeUnderConstruction: ExtractionField
  exteriorConstruction: ExtractionField
  exteriorFeatures: ExtractionField
  fireplaceCount: ExtractionField
  fireplaceType: ExtractionField
  roofAge: ExtractionField
  roofConstruction: ExtractionField
  // Carrier requirement: Safeco, Cincinnati
  roofShape: ExtractionField
  foundation: ExtractionField
  finishedBasement: ExtractionField
  garageType: ExtractionField
  garageLocation: ExtractionField
  deckPatioDetails: ExtractionField
  condoOrTownhouse: ExtractionField
  specialFeatures: ExtractionField
  // Carrier requirement: Safeco, Auto-Owners
  distanceToFireDepartment: ExtractionField
  // Carrier requirement: Cincinnati
  waterSupplyType: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Household Member Section
// =============================================================================

export interface HomeExtractionHouseholdMember {
  firstName: ExtractionField
  lastName: ExtractionField
  suffix: ExtractionField
  dob: ExtractionField
  ssn: ExtractionField
  relationship: ExtractionField
  maritalStatus: ExtractionField
  dlState: ExtractionField
  dlNumber: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Location Detail Section
// =============================================================================

export interface HomeExtractionLocationDetail {
  locationOccupancy: ExtractionField
  ownerOccupied: ExtractionField
  vacant: ExtractionField
  liabilityCoverageOnly: ExtractionField
  personalPropertyOnly: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Location Information Section
// =============================================================================

export interface HomeExtractionLocationInformation {
  program: ExtractionField
  type: ExtractionField
  coverageA: ExtractionField
  coverageF: ExtractionField
  personalInjury: ExtractionField
  coverageG: ExtractionField
  constructionYear: ExtractionField
  construction: ExtractionField
  foundation: ExtractionField
  finishedLivingArea: ExtractionField
  numberOfFamiliesUnits: ExtractionField
  replacementCost100: ExtractionField
  roofLossSettlementWindstormHail: ExtractionField
  roofingMaterial: ExtractionField
  roofUpdateYear: ExtractionField
  marketValue: ExtractionField
  hasMortgageeContractHolderOrSecuredLineOfCredit: ExtractionField
  boardingOrLodgingOrStudentRentals: ExtractionField
  isStudentRental: ExtractionField
  visibleFromOtherDwellings: ExtractionField
  fortifiedHome: ExtractionField
  woodCoalHeating: ExtractionField
  woodCoalHeatingLocation: ExtractionField
  woodCoalHeatingQuantity: ExtractionField
  gatedAccessToDwelling: ExtractionField
  applicantWillingToCompleteDiySurvey: ExtractionField
  screenedEnclosure: ExtractionField
  dwellingConstructedWithAsbestos: ExtractionField
  floodZone: ExtractionField
  coastalStormRiskArea: ExtractionField
  locatedOnIsland: ExtractionField
  conditionOfDwelling: ExtractionField
  dogsOwnedOrKept: ExtractionField
  specificBreed: ExtractionField
  biteHistoryAggressiveBehavior: ExtractionField
  isLocationWithinCity: ExtractionField
  respondingFireDepartment: ExtractionField
  communityName: ExtractionField
  within1000FeetOfHydrant: ExtractionField
  bridgeAccess: ExtractionField
  windHailDeductible: ExtractionField
  hurricaneDeductible: ExtractionField
  county: ExtractionField
  locationInformationOccupancy: ExtractionField
  territory: ExtractionField
  ownership: ExtractionField
  allOtherPerilsDeductible: ExtractionField
  distanceToHydrantFeet: ExtractionField
  distanceToFireStationMiles: ExtractionField
  protectionClass: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Policy Questions Section
// =============================================================================

export interface HomeExtractionPolicyQuestions {
  pleaseExplain: ExtractionField
  hasAnyCompanyCanceledRefusedOrDeclinedRenewal: ExtractionField
  hasAutoOwnersInsurancePast5Years: ExtractionField
  options: ExtractionField
  previousPolicyNumber: ExtractionField
  hasFiledPersonalBankruptcyOrJudgementsPast5Years: ExtractionField
  bankruptcyPleaseExplain: ExtractionField
  hasAnyApplicantBeenConvictedOfArson: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Location Specific Questions Section
// =============================================================================

export interface HomeExtractionLocationSpecificQuestions {
  dwellingForSale: ExtractionField
  isNewVentureNoPreviousLandlordOrRentalPropertyExperience: ExtractionField
  areThereAnyOutbuildingsOnPremises: ExtractionField
  anyFloodingBrushLandslideOrUnusualHazards: ExtractionField
  areDogsAllowed: ExtractionField
  anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets: ExtractionField
  anyUncorrectedFireCodeViolations: ExtractionField
  difficultAccessByFireAndPoliceDepartments: ExtractionField
  dwellingNewPurchase: ExtractionField
  purchasePrice: ExtractionField
  dwellingOccupied: ExtractionField
  pleaseExplain: ExtractionField
  expectedOccupancyDate: ExtractionField
  dayCareOnPremises: ExtractionField
  childrenCaredForCount: ExtractionField
  farmingOnPremises: ExtractionField
  acresFarmedByOthers: ExtractionField
  numberOfAnimalsLarge: ExtractionField
  numberOfAnimalsMedium: ExtractionField
  numberOfAnimalsSmall: ExtractionField
  otherBusinessOnPremises: ExtractionField
  describeBusiness: ExtractionField
  buildingUnderRenovationOrReconstruction: ExtractionField
  householdMembersLivingDuringRenovation: ExtractionField
  renovationExplanation: ExtractionField
  responsesVerifiedWithApplicant: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Homeowners Informations Section
// =============================================================================

export interface HomeExtractionHomeownersInformations {
  homeownersInsuranceCancelledDeclinedNonrenewedLast3Years: ExtractionField
  homeVacantOrUnoccupied: ExtractionField
  // Conditional: Only shown if homeVacantOrUnoccupied = 'Yes'
  occupiedInNext30Days: ExtractionField
  businessConductedOnPremises: ExtractionField
  // Conditional: Only shown if businessConductedOnPremises = 'Yes'
  businessProvidesProfessionalAdviceOrOpinions: ExtractionField
  businessHasEmployeesOtherThanResidenceRelatives: ExtractionField
  businessMoreThanFourClientVisitsPerWeek: ExtractionField
  homeAvailableForRentIncludingShortTermOrHomeSharing: ExtractionField
  // Conditional: Only shown if homeAvailableForRentIncludingShortTermOrHomeSharing = 'Yes'
  portionOfHomeAvailableForRent: ExtractionField
  basisHomeAvailableForRent: ExtractionField
  homeInDesignatedHighRiskFloodZone: ExtractionField
  // Conditional: Only shown if homeInDesignatedHighRiskFloodZone = 'Yes'
  hasFloodPolicy: ExtractionField
  petsOrAnimalsBittenOrInjuredAnyone: ExtractionField
  ownsRestrictedDogBreedsOrMix: ExtractionField
  insuranceStatus: ExtractionField
  burglarAlarm: ExtractionField
  feetFromHydrant: ExtractionField
  // Home characteristics
  yearBuilt: ExtractionField
  purchaseMonthYear: ExtractionField
  numberOfFamilies: ExtractionField
  primarySourceOfHeat: ExtractionField
  residenceType: ExtractionField
  seasonalDwelling: ExtractionField
  swimmingPool: ExtractionField
  // Conditional: swimmingPool = 'Yes'
  swimmingPoolType: ExtractionField
  // Conditional: swimmingPoolType selected (Above Ground / Inground)
  swimmingPoolSafetyFeature: ExtractionField
  woodCoalPelletStove: ExtractionField
  // Conditional: woodCoalPelletStove = 'Yes'
  stoveProfessionallyInstalledOrInspected: ExtractionField
  chimneyCleanedAnnually: ExtractionField
  ulListed: ExtractionField
  numberOfResidenceEmployees: ExtractionField
  // Structure
  squareFootage: ExtractionField
  buildingConstructionType: ExtractionField
  sidingType: ExtractionField
  primaryFoundationType: ExtractionField
  // Conditional: primaryFoundationType = 'Basement'
  basementFinished: ExtractionField
  numberOfBathrooms: ExtractionField
  garageType: ExtractionField
  // Conditional: garageType is not 'None'
  garageSizeNumberOfCars: ExtractionField
  numberOfStories: ExtractionField
  // Roof
  roofShape: ExtractionField
  roofType: ExtractionField
  yearRoofingReplaced: ExtractionField
  numberOfSolarPanelsOnRoof: ExtractionField
  currentAutoPolicyBodilyInjuryLimit: ExtractionField
  // Coverage
  baseCoverageLevel: ExtractionField
  replacementCost: ExtractionField
  aDwellingLimit: ExtractionField
  ePersonalLiability: ExtractionField
  fMedicalPayments: ExtractionField
  deductible: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Occupancy/Use Section
// Carrier requirement: Safeco, Auto-Owners, Cincinnati
// =============================================================================

export interface HomeExtractionOccupancy {
  // Carrier requirement: All carriers
  dwellingOccupancy: ExtractionField
  // Carrier requirement: All carriers
  businessOnPremises: ExtractionField
  // Carrier requirement: All carriers
  shortTermRental: ExtractionField
  // Conditional: Only shown if shortTermRental = 'Yes'
  daysRentedToOthers: ExtractionField
  // Carrier requirement: Safeco, Cincinnati
  horsesOrLivestock: ExtractionField
  // Carrier requirement: All carriers
  numberOfFamilies: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Safety & Risk Section
// =============================================================================

export interface HomeExtractionSafetyRisk {
  alarmSystem: ExtractionField
  monitoredAlarm: ExtractionField
  pool: ExtractionField
  trampoline: ExtractionField
  enclosedYard: ExtractionField
  dog: ExtractionField
  // Conditional: Only shown if dog = 'Yes'
  dogBreed: ExtractionField
  // Carrier requirement: Safeco, Cincinnati - coastal/wind mitigation
  windMitigation: ExtractionField
  stormShutters: ExtractionField
  impactGlass: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Coverage Section
// =============================================================================

export interface HomeExtractionCoverage {
  dwellingCoverage: ExtractionField
  liabilityCoverage: ExtractionField
  medicalPayments: ExtractionField
  deductible: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Claims History Section
// =============================================================================

export interface HomeExtractionClaim {
  date: ExtractionField
  type: ExtractionField
  description: ExtractionField
  amount: ExtractionField
}

export interface HomeExtractionClaimsHistory {
  claims: HomeExtractionClaim[]
}

// =============================================================================
// Scheduled Items Types (Jewelry and Other Valuables)
// =============================================================================

export interface HomeExtractionJewelryItem {
  description: ExtractionField
  value: ExtractionField
}

export interface HomeExtractionValuableItem {
  description: ExtractionField
  value: ExtractionField
}

export interface HomeExtractionScheduledItems {
  jewelry: HomeExtractionJewelryItem[]
  otherValuables: HomeExtractionValuableItem[]
}

// =============================================================================
// Home Extraction Result Type - Insurance Details Section
// =============================================================================

export interface HomeExtractionInsuranceDetails {
  // Carrier requirement: Safeco, Auto-Owners
  propertySameAsMailing: ExtractionField
  // Carrier requirement: All carriers
  reasonForPolicy: ExtractionField
  // Carrier requirement: All carriers
  currentlyInsured: ExtractionField
  lienholderName: ExtractionField
  lienholderAddress: ExtractionField
  lienholderCity: ExtractionField
  lienholderState: ExtractionField
  lienholderZip: ExtractionField
  currentInsuranceCompany: ExtractionField
  policyNumber: ExtractionField
  effectiveDate: ExtractionField
  currentPremium: ExtractionField
  escrowed: ExtractionField
  insuranceCancelledDeclined: ExtractionField
  // Carrier requirement: Auto-Owners, Cincinnati
  maintenanceCondition: ExtractionField
  // Carrier requirement: All carriers
  numberOfLosses5Years: ExtractionField
  referredBy: ExtractionField
}

// =============================================================================
// Home Extraction Result Type - Updates Section
// =============================================================================

export interface HomeExtractionUpdates {
  hvacUpdate: ExtractionField
  // Conditional: Only shown if hvacUpdate = 'Yes'
  hvacYear: ExtractionField
  plumbingUpdate: ExtractionField
  // Conditional: Only shown if plumbingUpdate = 'Yes'
  plumbingYear: ExtractionField
  roofUpdate: ExtractionField
  // Conditional: Only shown if roofUpdate = 'Yes'
  roofYear: ExtractionField
  electricalUpdate: ExtractionField
  // Conditional: Only shown if electricalUpdate = 'Yes'
  electricalYear: ExtractionField
  circuitBreakers: ExtractionField
  // Carrier requirement: Cincinnati, Safeco
  wiringUpdate: ExtractionField
  // Conditional: Only shown if wiringUpdate = 'Yes'
  wiringYear: ExtractionField
}

export const HOME_SIDING_TYPE_OPTIONS = [
  'Adobe',
  'Aluminum/Steel',
  'Brick/Masonry/Stone',
  'Cement Fiber',
  'Exterior Insulation Finishing System (EIFS)',
  'Log',
  'Stucco',
  'Vinyl',
  'Clapboard',
  'Wood',
  'Other',
] as const

export const HOME_USAGE_OPTIONS = ['Owner Occupied', 'Rented', 'Vacant'] as const

export const HOME_PRIOR_CARRIER_OPTIONS = [
  'ACE AMERICAN POOL',
  'AIU/AIG - PRIVATE CLIENT GROUP',
  'ALLSTATE INSURANCE GROUP',
  'AMERICAN INTERNATIONAL GROUP',
  'CHUBB GROUP OF INSURANCE COS.',
  'ENCOMPASS INSURANCE COMPANY',
  "FIREMAN'S FUND INSURANCE COS.",
  'PURE GROUP OF INS. COS.',
  'REGIONAL CARRIER',
  'SAFECO INSURANCE COMPANIES',
  'STATE FARM GROUP',
  'TRAVELERS GROUP',
  'UNKNOWN',
  'Progressive',
  'Liberty Mutual',
  'Farmers',
  'Nationwide',
  'USAA',
  'GEICO',
  'American Family',
  'Erie Insurance',
  'Auto-Owners Insurance',
  'The Hartford',
  'MetLife',
  'Mercury Insurance',
  'Amica Mutual',
  'Chubb',
  'Cincinnati Insurance',
  'Kemper',
  'National General',
  'Foremost',
  'Bristol West',
  'Plymouth Rock',
  'Selective Insurance',
  'Hanover Insurance',
  'MAPFRE Insurance',
  'CSAA Insurance Group',
  'Other',
] as const

// =============================================================================
// Chubb Home Coverage Estimator Section
// =============================================================================

export interface HomeChubbAttachedStructure {
  attachedStructureType: ExtractionField
  squareFeet: ExtractionField
}

export interface HomeChubbConstructionTypeEntry {
  constructionType: ExtractionField
  percentage: ExtractionField
}

export interface HomeExtractionChubbHomeCoverageEstimator {
  buildingType: ExtractionField
  livingAreaSqFt: ExtractionField
  yearBuilt: ExtractionField
  classification: ExtractionField
  renovated: ExtractionField
  percentRenovated: ExtractionField
  residenceDeductible: ExtractionField
  contentsAmount: ExtractionField
  contentsPercentage: ExtractionField
  typeOfContents: ExtractionField
  otherPermanentStructuresAmount: ExtractionField
  otherPermanentStructuresPercentage: ExtractionField
  deductibleWaiverOption: ExtractionField
  numberOfMortgages: ExtractionField
  usage: ExtractionField
  priorCarrier: ExtractionField
  // Conditional: priorCarrier = 'Other'
  priorCarrierOther: ExtractionField
  roofCoveringType: ExtractionField
  windProtection: ExtractionField
  hurricaneOrWindHailDeductibleType: ExtractionField
  hurricaneOrWindHailDeductiblePercentage: ExtractionField
  securityGatedCommunity: ExtractionField
  security24HourGuardMonitoring: ExtractionField
  securityGatedHouse: ExtractionField
  securityFullTimeCaretaker: ExtractionField
  detectorGasLeakage: ExtractionField
  detectorLightningProtection: ExtractionField
  detectorBackupGenerator: ExtractionField
  detectorSeismicShutOffValve: ExtractionField
  sprinklerResidentialSystem: ExtractionField
  alarmBurglar: ExtractionField
  alarmFire: ExtractionField
  waterLeakProtection: ExtractionField
  distanceFromFireStation: ExtractionField
  attachedStructures: HomeChubbAttachedStructure[]
  constructionTypes: HomeChubbConstructionTypeEntry[]
}

export const CHUBB_BUILDING_TYPE_OPTIONS = [
  'Dwelling',
  'Condo Townhome',
  'Condo High Rise/Mid Rise',
] as const

export const CHUBB_YEAR_BUILT_OPTIONS = [
  'Pre-1900',
  '1900 to 1919',
  '1920 to 1945',
  'Built Post 1946',
] as const

export const CHUBB_CLASSIFICATION_OPTIONS = [
  'Average',
  'Upgraded',
  'Upgraded Plus',
  'Custom',
  'Superior',
  'Distinctive',
] as const

export const CHUBB_ATTACHED_STRUCTURE_OPTIONS = [
  'Deck',
  'Open Porch',
  'Enclosed Porch',
  'Unfinished Basement',
  'Finished Basement Walk Out',
  'One Car Garage',
  'Two Car Garage',
  'Three Car Garage',
  'Covered Porch',
] as const

export const CHUBB_CONSTRUCTION_TYPE_OPTIONS = [
  'Frame',
  'Concrete Block',
  'Veneer',
  'Masonry',
  'Stone',
] as const

export const CHUBB_RESIDENCE_DEDUCTIBLE_OPTIONS = [
  '$1,000',
  '$2,500',
  '$5,000',
  '$7,500',
  '$10,000',
  '$25,000',
  '$50,000',
  '$100,000',
  '$250,000',
  '$500,000',
  '$750,000',
  '$10,000,000',
] as const

export const CHUBB_TYPE_OF_CONTENTS_OPTIONS = [
  'Deluxe',
  'Standard',
  'Fire',
  'None',
] as const

export const CHUBB_DEDUCTIBLE_WAIVER_OPTIONS = ['Waiver', 'No Waiver'] as const

export const CHUBB_ROOF_COVERING_TYPE_OPTIONS = [
  'Architectural Shingle',
  'Asphalt Shingle or Fiberglass Shingle',
  'Tile',
  'Composition over Wood',
  'Metal',
  'Modified Polymer',
  'Slate',
  'Wood',
  'Other',
  'Asbestos Shingles',
  'Rolled Asphalt',
] as const

export const CHUBB_WIND_PROTECTION_OPTIONS = ['None', 'Basic', 'Hurricane'] as const

export const CHUBB_HURRICANE_OR_WIND_HAIL_DEDUCTIBLE_TYPE_OPTIONS = [
  'No Wind or Hail',
  'All Wind or Hail',
] as const

export const CHUBB_HURRICANE_OR_WIND_HAIL_DEDUCTIBLE_PERCENTAGE_OPTIONS = [
  '0.2%',
  '0.5%',
  '1%',
  '2%',
  '3%',
  '5%',
  '10%',
] as const

export const CHUBB_WATER_LEAK_PROTECTION_OPTIONS = [
  'None',
  'Alarm',
  'Automatic Shut-Off',
  'Automatic Shut-Off and Alarm',
] as const

export const CHUBB_DISTANCE_FROM_FIRE_STATION_OPTIONS = [
  'less than 1 mile',
  '1 mile < 3 miles',
  '3 miles < 5 miles',
  '5 miles < 7 miles',
  '7 miles < 10 miles',
  '10 or more miles',
] as const

export const CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS: Record<
  Exclude<
    keyof HomeExtractionChubbHomeCoverageEstimator,
    'attachedStructures' | 'constructionTypes'
  >,
  HomeFieldConfig
> = {
  buildingType: {
    label: 'Building Type',
    inputType: 'select',
    required: false,
    options: [...CHUBB_BUILDING_TYPE_OPTIONS],
  },
  livingAreaSqFt: {
    label: 'Living Area (ft²)',
    inputType: 'number',
    required: false,
    placeholder: 'Enter square footage',
  },
  yearBuilt: {
    label: 'Year Built',
    inputType: 'select',
    required: false,
    options: [...CHUBB_YEAR_BUILT_OPTIONS],
  },
  classification: {
    label: 'Classification',
    inputType: 'select',
    required: false,
    options: [...CHUBB_CLASSIFICATION_OPTIONS],
  },
  renovated: {
    label: 'Renovated',
    inputType: 'select',
    required: false,
    options: [...YES_NO_OPTIONS],
  },
  percentRenovated: {
    label: 'Percent renovated',
    inputType: 'text',
    required: false,
    placeholder: 'e.g. 20%',
    conditionalOn: 'renovated',
    conditionalValue: 'Yes',
  },
  residenceDeductible: {
    label: 'Residence Deductible',
    inputType: 'select',
    required: false,
    options: [...CHUBB_RESIDENCE_DEDUCTIBLE_OPTIONS],
  },
  contentsAmount: {
    label: 'Contents Amount',
    inputType: 'text',
    required: false,
    placeholder: 'Enter contents amount',
  },
  contentsPercentage: {
    label: 'Contents Percentage',
    inputType: 'text',
    required: false,
    placeholder: 'e.g. 50%',
  },
  typeOfContents: {
    label: 'Type of Contents',
    inputType: 'select',
    required: false,
    options: [...CHUBB_TYPE_OF_CONTENTS_OPTIONS],
  },
  otherPermanentStructuresAmount: {
    label: 'Other Permanent Structures Amount',
    inputType: 'text',
    required: false,
    placeholder: 'Enter amount',
  },
  otherPermanentStructuresPercentage: {
    label: 'Other Permanent Structures Percentage',
    inputType: 'text',
    required: false,
    placeholder: 'e.g. 20%',
  },
  deductibleWaiverOption: {
    label: 'Deductible Waiver Option',
    inputType: 'select',
    required: false,
    options: [...CHUBB_DEDUCTIBLE_WAIVER_OPTIONS],
  },
  numberOfMortgages: {
    label: '# of Mortgages',
    inputType: 'number',
    required: false,
    placeholder: 'e.g. 1',
  },
  usage: {
    label: 'Usage',
    inputType: 'select',
    required: false,
    options: [...HOME_USAGE_OPTIONS],
  },
  priorCarrier: {
    label: 'Prior Carrier',
    inputType: 'select',
    required: false,
    options: [...HOME_PRIOR_CARRIER_OPTIONS],
  },
  priorCarrierOther: {
    label: 'Other Carrier',
    inputType: 'text',
    required: false,
    placeholder: 'Enter carrier name',
    conditionalOn: 'priorCarrier',
    conditionalValue: 'Other',
  },
  roofCoveringType: {
    label: 'Roof Covering Type',
    inputType: 'select',
    required: false,
    options: [...CHUBB_ROOF_COVERING_TYPE_OPTIONS],
  },
  windProtection: {
    label: 'Wind Protection',
    inputType: 'select',
    required: false,
    options: [...CHUBB_WIND_PROTECTION_OPTIONS],
  },
  hurricaneOrWindHailDeductibleType: {
    label: 'Hurricane or Wind/Hail Deductible Type',
    inputType: 'select',
    required: false,
    options: [...CHUBB_HURRICANE_OR_WIND_HAIL_DEDUCTIBLE_TYPE_OPTIONS],
  },
  hurricaneOrWindHailDeductiblePercentage: {
    label: 'Hurricane or Wind/Hail Deductible Percentage',
    inputType: 'select',
    required: true,
    options: [...CHUBB_HURRICANE_OR_WIND_HAIL_DEDUCTIBLE_PERCENTAGE_OPTIONS],
    conditionalOn: 'hurricaneOrWindHailDeductibleType',
    conditionalValue: 'All Wind or Hail',
  },
  securityGatedCommunity: {
    label: 'Gated Community',
    inputType: 'checkbox',
    required: false,
  },
  security24HourGuardMonitoring: {
    label: '24 Hour Guard / Security Monitoring',
    inputType: 'checkbox',
    required: false,
  },
  securityGatedHouse: {
    label: 'Gated House',
    inputType: 'checkbox',
    required: false,
  },
  securityFullTimeCaretaker: {
    label: 'Full-time Caretaker',
    inputType: 'checkbox',
    required: false,
  },
  detectorGasLeakage: {
    label: 'Gas Leakage Detector',
    inputType: 'checkbox',
    required: false,
  },
  detectorLightningProtection: {
    label: 'Lightning Protection',
    inputType: 'checkbox',
    required: false,
  },
  detectorBackupGenerator: {
    label: 'Back-up Generator',
    inputType: 'checkbox',
    required: false,
  },
  detectorSeismicShutOffValve: {
    label: 'Seismic Shut Off Valve',
    inputType: 'checkbox',
    required: false,
  },
  sprinklerResidentialSystem: {
    label: 'Residential Sprinkler System',
    inputType: 'checkbox',
    required: false,
  },
  alarmBurglar: {
    label: 'Burglar',
    inputType: 'checkbox',
    required: false,
  },
  alarmFire: {
    label: 'Fire',
    inputType: 'checkbox',
    required: false,
  },
  waterLeakProtection: {
    label: 'Water Leak Protection',
    inputType: 'select',
    required: false,
    options: [...CHUBB_WATER_LEAK_PROTECTION_OPTIONS],
  },
  distanceFromFireStation: {
    label: 'Distance from Fire Station',
    inputType: 'select',
    required: false,
    options: [...CHUBB_DISTANCE_FROM_FIRE_STATION_OPTIONS],
  },
}

export const CHUBB_ATTACHED_STRUCTURE_FIELDS: Record<
  keyof HomeChubbAttachedStructure,
  HomeFieldConfig
> = {
  attachedStructureType: {
    label: 'Attached Structure',
    inputType: 'select',
    required: false,
    options: [...CHUBB_ATTACHED_STRUCTURE_OPTIONS],
  },
  squareFeet: {
    label: 'ft²',
    inputType: 'number',
    required: false,
    placeholder: 'Square feet',
  },
}

export const CHUBB_CONSTRUCTION_TYPE_FIELDS: Record<
  keyof HomeChubbConstructionTypeEntry,
  HomeFieldConfig
> = {
  constructionType: {
    label: 'Construction Type',
    inputType: 'select',
    required: true,
    options: [...CHUBB_CONSTRUCTION_TYPE_OPTIONS],
  },
  percentage: {
    label: 'Percentage',
    inputType: 'text',
    required: true,
    placeholder: '0%',
  },
}

// =============================================================================
// Complete Home Extraction Result
// =============================================================================

export interface HomeExtractionResult {
  personal: HomeExtractionPersonal
  property: HomeExtractionProperty
  householdMember: HomeExtractionHouseholdMember
  locationDetail: HomeExtractionLocationDetail
  locationInformation: HomeExtractionLocationInformation
  policyQuestions: HomeExtractionPolicyQuestions
  locationSpecificQuestions: HomeExtractionLocationSpecificQuestions
  homeownersInformations: HomeExtractionHomeownersInformations
  chubbHomeCoverageEstimator: HomeExtractionChubbHomeCoverageEstimator
  occupancy: HomeExtractionOccupancy
  safetyRisk: HomeExtractionSafetyRisk
  coverage: HomeExtractionCoverage
  scheduledItems: HomeExtractionScheduledItems
  claimsHistory: HomeExtractionClaimsHistory
  insuranceDetails: HomeExtractionInsuranceDetails
  updates: HomeExtractionUpdates
}

// =============================================================================
// Field Configuration Maps
// =============================================================================

export const HOME_PERSONAL_FIELDS: Record<keyof HomeExtractionPersonal, HomeFieldConfig> = {
  // Primary applicant info
  firstName: { label: 'First Name', inputType: 'text', required: true },
  lastName: { label: 'Last Name', inputType: 'text', required: true },
  maritalStatus: {
    label: 'Marital Status',
    inputType: 'select',
    required: true,
    options: ['Single', 'Married', 'Divorced', 'Widowed', 'Domestic Partner']
  },
  applicantDOB: { label: 'Applicant Date of Birth', inputType: 'date', required: true },
  applicantSSN: { label: 'Applicant SSN', inputType: 'text', required: false, placeholder: 'XXX-XX-XXXX' },

  // Co-applicant/Spouse toggle and info
  coApplicantPresent: {
    label: 'Co-Applicant/Spouse Present',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS
  },
  // Conditional: Only shown if coApplicantPresent = 'Yes'
  spouseFirstName: {
    label: 'Spouse/Co-Applicant First Name',
    inputType: 'text',
    required: false,
    conditionalOn: 'coApplicantPresent',
    conditionalValue: 'Yes'
  },
  spouseLastName: {
    label: 'Spouse/Co-Applicant Last Name',
    inputType: 'text',
    required: false,
    conditionalOn: 'coApplicantPresent',
    conditionalValue: 'Yes'
  },
  spouseDOB: {
    label: 'Spouse/Co-Applicant Date of Birth',
    inputType: 'date',
    required: false,
    conditionalOn: 'coApplicantPresent',
    conditionalValue: 'Yes'
  },
  spouseSSN: {
    label: 'Spouse/Co-Applicant SSN',
    inputType: 'text',
    required: false,
    placeholder: 'XXX-XX-XXXX',
    conditionalOn: 'coApplicantPresent',
    conditionalValue: 'Yes'
  },

  // Occupation (Cincinnati requirement)
  occupation: {
    label: 'Occupation',
    inputType: 'text',
    required: false,
    placeholder: 'Cincinnati requires this field'
  },

  // Current address
  address: { label: 'Street Address', inputType: 'text', required: true },
  city: { label: 'City', inputType: 'text', required: true },
  state: { label: 'State', inputType: 'select', required: true, options: US_STATES },
  zipCode: { label: 'ZIP Code', inputType: 'text', required: true },
  yearsAtCurrentAddress: { label: 'Years at Current Address', inputType: 'number', required: false },
  livedAtDifferentAddressPast6Months: {
    label: 'Have you lived at a different address in the past 6 months?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },

  // Prior address (conditional - needed if yearsAtCurrentAddress < 5)
  priorAddress: {
    label: 'Prior Street Address',
    inputType: 'text',
    required: false,
    placeholder: 'Required if less than 5 years at current address',
    conditionalOn: 'yearsAtCurrentAddress',
    conditionalValue: ['0', '1', '2', '3', '4']
  },
  priorCity: {
    label: 'Prior City',
    inputType: 'text',
    required: false,
    conditionalOn: 'yearsAtCurrentAddress',
    conditionalValue: ['0', '1', '2', '3', '4']
  },
  priorState: {
    label: 'Prior State',
    inputType: 'select',
    required: false,
    options: US_STATES,
    conditionalOn: 'yearsAtCurrentAddress',
    conditionalValue: ['0', '1', '2', '3', '4']
  },
  priorZipCode: {
    label: 'Prior ZIP Code',
    inputType: 'text',
    required: false,
    conditionalOn: 'yearsAtCurrentAddress',
    conditionalValue: ['0', '1', '2', '3', '4']
  },

  // Contact info
  phone: { label: 'Phone', inputType: 'tel', required: true },
  email: { label: 'Email', inputType: 'email', required: false },
  mailingAddress: { label: 'Mailing Address', inputType: 'text', required: true },
  termLength: {
    label: 'Term length',
    inputType: 'select',
    required: true,
    options: ['Annually', 'Semi-Annually', 'Quarterly', 'Monthly']
  },
  agentProducerName: {
    label: 'Agent / Producer Name',
    inputType: 'select',
    required: true,
    options: [
      'ADAMS, HANNAH',
      'ADAMS, LAUREN H',
      'BOSWELL, MELISSA HOWARD',
      'DAVIS, JULIE ANN',
      'DERAMUS, MELANIE A',
      'ELLIS, BEVERLY L',
      'JONES, TIMOTHY L',
      'MAYNOR, SUZANNE P',
      'MITCHELL, PAMELA A',
      'PEAK, JERE D',
      'PEAK, OWEN',
      'SEWELL, RUTH EMILIE',
      'SWIFT, DONNA Q',
      'TWITCHELL, STACI T',
      'UTSEY III, JAMES C',
      'WEST, BLAKE E',
      'WHITAKER, LYN P',
      'WILLIAMS, AMBER N',
    ],
  },
  country: { label: 'Country', inputType: 'text', required: true },
  entity: {
    label: 'Entity',
    inputType: 'select',
    required: true,
    options: ['Corporation', 'Estate', 'Individual', 'Limited Liability Company', 'Other', 'Partnership', 'Trust']
  },
}

export const HOME_PROPERTY_FIELDS: Record<keyof HomeExtractionProperty, HomeFieldConfig> = {
  purchaseDate: { label: 'Purchase Date', inputType: 'date', required: false },
  yearBuilt: { label: 'Year Built', inputType: 'number', required: true },
  squareFootage: { label: 'Square Footage', inputType: 'number', required: true },
  numberOfStories: { label: 'Number of Stories', inputType: 'select', required: true, options: ['1', '1.5', '2', '2.5', '3', '3+'] },
  bedroomCount: {
    label: 'Number of Bedrooms',
    inputType: 'select',
    required: true,
    options: ['1', '2', '3', '4', '5+']
  },
  kitchenCount: { label: 'Number of Kitchens', inputType: 'select', required: false, options: ['1', '2', '3+'] },
  kitchenStyle: { label: 'Kitchen Style', inputType: 'select', required: false, options: ['Basic', 'Standard', 'Custom', 'Designer'] },
  bathroomCount: { label: 'Number of Bathrooms', inputType: 'select', required: true, options: ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4+'] },
  bathroomStyle: { label: 'Bathroom Style', inputType: 'select', required: false, options: ['Basic', 'Standard', 'Custom', 'Designer'] },
  flooringPercentage: { label: 'Flooring Percentage', inputType: 'text', required: false, placeholder: 'e.g., 60% hardwood, 40% carpet' },
  heatType: { label: 'Heat Type', inputType: 'select', required: true, options: ['Gas', 'Electric', 'Oil', 'Propane', 'Heat Pump', 'Radiant', 'Other'] },
  dwellingType: {
    label: 'Dwelling Type',
    inputType: 'select',
    required: true,
    options: ['Single Family', 'Condo', 'Townhouse', 'Mobile Home', 'Manufactured Home', 'Duplex', 'Triplex', 'Rowhouse', 'Other']
  },
  constructionStyle: {
    label: 'Construction Style',
    inputType: 'select',
    required: true,
    options: ['Ranch', 'Colonial', 'Cape Cod', 'Split Level', 'Contemporary', 'Victorian', 'Tudor', 'Craftsman', 'Mediterranean', 'Other']
  },
  constructionQuality: {
    label: 'Construction Quality',
    inputType: 'select',
    required: false,
    options: ['Economy', 'Standard', 'Custom', 'Premium']
  },
  homeUnderConstruction: {
    label: 'Home Under Construction',
    inputType: 'select',
    required: false,
    options: YES_NO_OPTIONS
  },
  exteriorConstruction: { label: 'Exterior Construction', inputType: 'select', required: true, options: ['Frame', 'Masonry', 'Frame/Masonry', 'Fire Resistive', 'Other'] },
  exteriorFeatures: { label: 'Exterior Features', inputType: 'textarea', required: false, placeholder: 'e.g., siding type, trim details' },
  fireplaceCount: { label: 'Number of Fireplaces', inputType: 'select', required: false, options: ['0', '1', '2', '3+'] },
  fireplaceType: { label: 'Fireplace Type', inputType: 'select', required: false, options: ['Wood Burning', 'Gas', 'Electric', 'Pellet', 'None'] },
  roofAge: { label: 'Age of Roof (Years)', inputType: 'number', required: true },
  roofConstruction: { label: 'Roof Construction', inputType: 'select', required: true, options: ['Asphalt Shingle', 'Wood Shingle', 'Metal', 'Tile', 'Slate', 'Flat/Built-up', 'Other'] },
  roofShape: {
    label: 'Roof Shape',
    inputType: 'select',
    required: false,
    options: ['Gable', 'Hip', 'Flat', 'Mansard', 'Gambrel', 'Shed', 'Other']
  },
  foundation: { label: 'Foundation Type', inputType: 'select', required: true, options: ['Basement/Crawlspace', 'Slab', 'Piers/Pilings'] },
  finishedBasement: { label: 'Finished Basement', inputType: 'select', required: false, options: ['Yes', 'No', 'Partial', 'N/A'] },
  garageType: { label: 'Garage Type', inputType: 'select', required: false, options: ['Attached', 'Detached', 'Built-in', 'Basement', 'Carport', 'Multiple', 'None'] },
  garageLocation: { label: 'Garage Location', inputType: 'select', required: false, options: ['Attached', 'Detached', 'Built-in', 'N/A'] },
  deckPatioDetails: { label: 'Deck/Patio/Porch Details', inputType: 'textarea', required: false },
  condoOrTownhouse: { label: 'Condo or Townhouse', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  specialFeatures: { label: 'Special Features', inputType: 'textarea', required: false, placeholder: 'e.g., hot tub, wine cellar, smart home' },
  distanceToFireDepartment: {
    label: 'Distance to Fire Department',
    inputType: 'select',
    required: false,
    options: ['Under 5 miles', '5-10 miles', 'Over 10 miles']
  },
  waterSupplyType: {
    label: 'Water Supply Type',
    inputType: 'select',
    required: false,
    options: ['Public', 'Well', 'Cistern']
  },
}

export const HOME_HOUSEHOLD_MEMBER_FIELDS: Record<keyof HomeExtractionHouseholdMember, HomeFieldConfig> = {
  firstName: { label: 'Household Member First Name', inputType: 'text', required: true },
  lastName: { label: 'Household Member Last Name', inputType: 'text', required: true },
  suffix: { label: 'Suffix', inputType: 'text', required: true, placeholder: 'e.g., Jr, Sr, III' },
  dob: { label: 'Date of Birth', inputType: 'date', required: true },
  ssn: { label: 'SSN', inputType: 'text', required: true, placeholder: 'XXX-XX-XXXX' },
  relationship: {
    label: 'Relationship to Insured',
    inputType: 'select',
    required: true,
    options: ['Self/Named Insured', 'Spouse', 'Resident Relative', 'Child', 'Other'],
  },
  maritalStatus: {
    label: 'Marital Status',
    inputType: 'select',
    required: true,
    options: ['Single', 'Married', 'Divorced', 'Widowed', 'Domestic Partner']
  },
  dlState: { label: "Driver's License State", inputType: 'select', required: true, options: US_STATES },
  dlNumber: { label: "Driver's License Number", inputType: 'text', required: true },
}

export const HOME_LOCATION_DETAIL_FIELDS: Record<keyof HomeExtractionLocationDetail, HomeFieldConfig> = {
  locationOccupancy: {
    label: 'Occupancy',
    inputType: 'select',
    required: true,
    options: ['Primary', 'Secondary', 'Seasonal', 'Tenant Occupied', 'Vacant', 'Principal'],
  },
  ownerOccupied: {
    label: 'Is the location Owner-Occupied',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  vacant: {
    label: 'Is the location Vacant',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  liabilityCoverageOnly: {
    label: 'Liability Coverage only',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  personalPropertyOnly: {
    label: 'Personal Property Only',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
}

export const HOME_LOCATION_INFORMATION_FIELDS: Record<keyof HomeExtractionLocationInformation, HomeFieldConfig> = {
  program: {
    label: 'Program',
    inputType: 'select',
    required: true,
    options: ['Special', 'Basic'],
  },
  type: {
    label: 'Type',
    inputType: 'select',
    required: false,
    options: ['Dwelling'],
  },
  coverageA: {
    label: 'Coverage A',
    inputType: 'text',
    required: true,
  },
  coverageF: {
    label: 'Coverage F',
    inputType: 'select',
    required: true,
    options: ['100,000', '200,000', '300,000', '500,000', '1,000,000'],
  },
  personalInjury: {
    label: 'Personal Injury',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  coverageG: {
    label: 'Coverage G',
    inputType: 'select',
    required: true,
    options: ['1,000', '5,000'],
  },
  constructionYear: {
    label: 'Construction Year',
    inputType: 'number',
    required: false,
  },
  construction: {
    label: 'Construction',
    inputType: 'select',
    required: true,
    options: [
      'Frame',
      'Masonry',
      'Masonry Veneer',
      'Log',
      'Fire Resistive',
      'Cement Fiber',
    ],
  },
  foundation: {
    label: 'Foundation',
    inputType: 'select',
    required: true,
    options: ['Open', 'Continuous'],
  },
  finishedLivingArea: {
    label: 'Finished Living Area',
    inputType: 'number',
    required: false,
  },
  numberOfFamiliesUnits: {
    label: 'Number Of Families/Units',
    inputType: 'number',
    required: true,
  },
  replacementCost100: {
    label: '100% Replacement Cost',
    inputType: 'text',
    required: false,
  },
  roofLossSettlementWindstormHail: {
    label: 'Roof Loss Settlement for Windstorm or Hail Losses',
    inputType: 'select',
    required: false,
    options: ['Actual Cash Value', 'Replacement Cost'],
  },
  roofingMaterial: {
    label: 'Roofing Material',
    inputType: 'select',
    required: true,
    options: [
      'Asphalt - Non-Hail Resistive',
      'Metal - Non-Hail Resistive',
      'Other - Non-Hail Resistive',
      'Wood',
      'Asphalt - Hail Resistive',
      'Concrete',
      'Metal - Hail Resistive',
      'Other - Hail Resistive',
      'Synthetic Polymer',
      'Tile',
    ],
  },
  roofUpdateYear: {
    label: 'Roof Update Year',
    inputType: 'text',
    required: true,
    placeholder: '(yyyy)',
  },
  marketValue: {
    label: 'Market Value',
    inputType: 'text',
    required: false,
  },
  hasMortgageeContractHolderOrSecuredLineOfCredit: {
    label:
      'Is there a Mortgagee, Contract Holder or secured line of credit for this Location?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  boardingOrLodgingOrStudentRentals: {
    label: 'Is the property used as a boarding or lodging house or for student rentals?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  isStudentRental: {
    label: 'Is this a student rental?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  visibleFromOtherDwellings: {
    label: 'Visible from other dwellings',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  fortifiedHome: {
    label: 'FORTIFIED Home™?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  woodCoalHeating: {
    label: 'Wood/Coal Heating',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  woodCoalHeatingLocation: {
    label: 'Where is this located',
    inputType: 'select',
    required: true,
    options: ['Dwelling', 'Outbuilding', 'Outside'],
  },
  woodCoalHeatingQuantity: {
    label: 'Quantity',
    inputType: 'number',
    required: true,
  },
  gatedAccessToDwelling: {
    label: 'Gated access to dwelling?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  applicantWillingToCompleteDiySurvey: {
    label: 'Is applicant willing to complete a DIY survey for this location?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  screenedEnclosure: {
    label: 'Screened Enclosure?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  dwellingConstructedWithAsbestos: {
    label: 'Is the dwelling constructed with material containing asbestos?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  floodZone: {
    label: 'Flood Zone',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  coastalStormRiskArea: {
    label: 'Coastal Storm Risk Area',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  locatedOnIsland: {
    label: 'Is the property located on an island',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  conditionOfDwelling: {
    label: 'Condition of dwelling',
    inputType: 'select',
    required: false,
    options: ['Excellent', 'Good', 'Average', 'Poor'],
  },
  dogsOwnedOrKept: {
    label: 'Any dogs owned by the insured around/ kept at the insured location(s)?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  specificBreed: {
    label: 'Specific Breed',
    inputType: 'select',
    required: true,
    options: [
      'Akita (Include hybrid/mixes)',
      'American Staffordshire Terrier (Include hybrid/mixes)',
      'Bullmastiff (Include hybrid/mixes)',
      'Chow Chow (Include hybrid/mixes)',
      'Doberman Pinscher (Include hybrid/mixes)',
      'German Shepherd (Include hybrid/mixes)',
      'Pit Bull (Include hybrid/mixes)',
      'Presa Canario (Include hybrid/mixes)',
      'Rottweiler (Include hybrid/mixes)',
      'Wolf Hybrid (Include hybrid/mixes)',
      'Other Breed',
    ],
  },
  biteHistoryAggressiveBehavior: {
    label: 'Any bite history or history of aggressive behavior?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  isLocationWithinCity: {
    label: 'Is Location Within A City?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  respondingFireDepartment: {
    label: 'Responding Fire Department',
    inputType: 'text',
    required: true,
  },
  communityName: {
    label: 'Community Name',
    inputType: 'text',
    required: true,
  },
  within1000FeetOfHydrant: {
    label: 'Within 1000 Feet Of Hydrant',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  bridgeAccess: {
    label: 'Is there bridge access',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  windHailDeductible: {
    label: 'Wind/Hail Deductible',
    inputType: 'select',
    required: true,
    options: ["1500", "2000", "2500", "5000", "10000"],
  },
  hurricaneDeductible: {
    label: 'Hurricane Deductible',
    inputType: 'select',
    required: true,
    options: ['5%'],
  },
  county: {
    label: 'County',
    inputType: 'text',
    required: true,
  },
  locationInformationOccupancy: {
    label: 'Occupancy',
    inputType: 'select',
    required: true,
    options: ['Primary', 'Secondary', 'Tenant Occupied', 'Vacant', 'Principal'],
  },
  territory: {
    label: 'Territory',
    inputType: 'text',
    required: true,
  },
  ownership: {
    label: 'Ownership',
    inputType: 'select',
    required: true,
    options: ['Married Property', 'Single Owner', 'Corporation'],
  },
  allOtherPerilsDeductible: {
    label: 'All Other Perils Deductible',
    inputType: 'select',
    required: true,
    options: [
      '250',
      '500',
      '750',
      '1,000',
      '1,500',
      '2,500',
      '5,000',
      '10,000',
      '15,000',
      '20,000',
    ],
  },
  distanceToHydrantFeet: {
    label: 'Distance to Hydrant (feet)',
    inputType: 'number',
    required: true,
  },
  distanceToFireStationMiles: {
    label: 'Distance to Fire Station (miles)',
    inputType: 'number',
    required: true,
  },
  protectionClass: {
    label: 'Protection Class',
    inputType: 'text',
    required: true,
  },
}

export const HOME_POLICY_QUESTIONS_FIELDS: Record<keyof HomeExtractionPolicyQuestions, HomeFieldConfig> = {
  pleaseExplain: {
    label: 'Please explain',
    inputType: 'text',
    required: true,
  },
  hasAnyCompanyCanceledRefusedOrDeclinedRenewal: {
    label: 'Has any company canceled, refused to write or declined renewal for this applicant',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  hasAutoOwnersInsurancePast5Years: {
    label: 'Has the applicant had insurance with any Auto-Owners Group Company within the past 5 years',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  options: {
    label: 'Options',
    inputType: 'select',
    required: true,
    options: ['Non-Pay', 'Previous insurer is leaving the market', 'Other'],
  },
  previousPolicyNumber: {
    label: 'Previous policy number',
    inputType: 'text',
    required: true,
  },
  hasFiledPersonalBankruptcyOrJudgementsPast5Years: {
    label:
      'Has this applicant filed personal bankruptcy, had repossessions, court judgements or substantially past due mortgage, utility or property tax payments within the past 5 years',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  bankruptcyPleaseExplain: {
    label: 'Please Explain',
    inputType: 'text',
    required: true,
  },
  hasAnyApplicantBeenConvictedOfArson: {
    label: 'Has any applicant been convicted of arson',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
}

export const HOME_LOCATION_SPECIFIC_QUESTIONS_FIELDS: Record<
  keyof HomeExtractionLocationSpecificQuestions,
  HomeFieldConfig
> = {
  dwellingForSale: {
    label: 'Is the dwelling for sale',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  isNewVentureNoPreviousLandlordOrRentalPropertyExperience: {
    label:
      'Is this a new venture (no previous landlord or rental property experience)?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  areThereAnyOutbuildingsOnPremises: {
    label: 'Are there any outbuildings on the premises:',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  anyFloodingBrushLandslideOrUnusualHazards: {
    label: 'Any flooding/brush/landslide or unusual hazards:',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  areDogsAllowed: {
    label: 'Are dogs allowed?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets: {
    label:
      'Any animals, other than livestock, not typically regarded as household pets kept on premises?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  anyUncorrectedFireCodeViolations: {
    label: 'Any uncorrected fire code violations:',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  difficultAccessByFireAndPoliceDepartments: {
    label: 'Difficult access by fire and police departments:',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  dwellingNewPurchase: {
    label: 'Is the dwelling a new purchase',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  purchasePrice: {
    label: 'Purchase price',
    inputType: 'text',
    required: true,
  },
  dwellingOccupied: {
    label: 'Is the dwelling occupied',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  pleaseExplain: {
    label: 'Please explain',
    inputType: 'text',
    required: true,
  },
  expectedOccupancyDate: {
    label: 'Expected occupancy date',
    inputType: 'date',
    required: true,
  },
  dayCareOnPremises: {
    label: 'Is there day care on the premises',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  childrenCaredForCount: {
    label: 'How many children are cared for (including household members)',
    inputType: 'number',
    required: true,
  },
  farmingOnPremises: {
    label: 'Is there farming on the premises',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  acresFarmedByOthers: {
    label: 'How many acres are farmed by someone other than insured',
    inputType: 'number',
    required: true,
  },
  numberOfAnimalsLarge: {
    label: 'Number of Animals (Large)',
    inputType: 'number',
    required: true,
  },
  numberOfAnimalsMedium: {
    label: 'Number of Animals (Medium)',
    inputType: 'number',
    required: true,
  },
  numberOfAnimalsSmall: {
    label: 'Number of Animals (Small)',
    inputType: 'number',
    required: true,
  },
  otherBusinessOnPremises: {
    label: 'Is there any other business on the premises',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  describeBusiness: {
    label: 'Describe Business',
    inputType: 'text',
    required: true,
  },
  buildingUnderRenovationOrReconstruction: {
    label: 'Is the building undergoing renovation or reconstruction',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  householdMembersLivingDuringRenovation: {
    label: 'Are any household members living at the home during renovation/reconstruction',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  renovationExplanation: {
    label: 'Please explain extent of the renovation or reconstruction',
    inputType: 'text',
    required: true,
  },
  responsesVerifiedWithApplicant: {
    label: 'Have all responses been verified with the applicant?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
}

export const HOME_HOMEOWNERS_INFORMATIONS_FIELDS: Record<
  keyof HomeExtractionHomeownersInformations,
  HomeFieldConfig
> = {
  homeownersInsuranceCancelledDeclinedNonrenewedLast3Years: {
    label:
      'Has your homeowners insurance been cancelled/declined/nonrenewed in the last 3 years?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  homeVacantOrUnoccupied: {
    label: 'Is the home vacant or unoccupied?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  occupiedInNext30Days: {
    label: 'Will it be occupied in the next 30 days?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'homeVacantOrUnoccupied',
    conditionalValue: 'Yes',
  },
  businessConductedOnPremises: {
    label: 'Do you conduct any type of business on the premises?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  businessProvidesProfessionalAdviceOrOpinions: {
    label:
      'Does the Business provide professional advice and/or opinions (e.g. financial, legal) or include academic tutor, music lessons, or graphic design?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'businessConductedOnPremises',
    conditionalValue: 'Yes',
  },
  businessHasEmployeesOtherThanResidenceRelatives: {
    label: 'Are there any employees other than residence relatives?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'businessConductedOnPremises',
    conditionalValue: 'Yes',
  },
  businessMoreThanFourClientVisitsPerWeek: {
    label:
      'Do you have more than four client visits per week at your residence premises?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'businessConductedOnPremises',
    conditionalValue: 'Yes',
  },
  homeAvailableForRentIncludingShortTermOrHomeSharing: {
    label:
      'Is your entire home or any part of it available for rent, including short-term vacation rental or home sharing/swapping?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  portionOfHomeAvailableForRent: {
    label: 'What portion of your home is available for rent?',
    inputType: 'select',
    required: true,
    options: [
      'Entire home',
      'Part of home / separate unit',
      'Room(s) only',
      'Other',
    ],
    conditionalOn: 'homeAvailableForRentIncludingShortTermOrHomeSharing',
    conditionalValue: 'Yes',
  },
  basisHomeAvailableForRent: {
    label: 'On what basis is your home available for rent?',
    inputType: 'select',
    required: true,
    options: [
      'Short-term vacation rental (Airbnb, VRBO, etc.)',
      'Home sharing / home swapping',
      'Long-term rental',
      'Other',
    ],
    conditionalOn: 'homeAvailableForRentIncludingShortTermOrHomeSharing',
    conditionalValue: 'Yes',
  },
  homeInDesignatedHighRiskFloodZone: {
    label: 'Is the home located in a designated high risk flood zone?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  hasFloodPolicy: {
    label: 'Do you have a flood policy?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'homeInDesignatedHighRiskFloodZone',
    conditionalValue: 'Yes',
  },
  petsOrAnimalsBittenOrInjuredAnyone: {
    label:
      'Do you or any household member have any pets or animals that have bitten or injured anyone?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  ownsRestrictedDogBreedsOrMix: {
    label:
      'Do you or any household member own one or more of the following breeds or a mix of one of these breeds of dogs?',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    placeholder:
      'Akita, Alaskan Malamute, American Bull Terrier, American Staffordshire Terrier, Mastiffs, Chow Chow, Doberman Pinscher, Pit Bull, Presa Canario, Rottweiler, Staffordshire Bull Terrier, Wolf Hybrid',
  },
  insuranceStatus: {
    label: 'Insurance Status',
    inputType: 'select',
    required: true,
    options: ['Currently Insured', 'No Current Insurance'],
  },
  burglarAlarm: {
    label: 'Burglar Alarm',
    inputType: 'select',
    required: true,
    options: ['Local', 'Smart', 'Central', 'None'],
  },
  feetFromHydrant: {
    label: 'Feet From Hydrant',
    inputType: 'number',
    required: true,
    placeholder: 'Enter distance in feet',
  },
  yearBuilt: {
    label: 'Year Built',
    inputType: 'number',
    required: true,
    placeholder: 'e.g. 1998',
  },
  purchaseMonthYear: {
    label: 'Purchase Month/Year',
    inputType: 'text',
    required: true,
    placeholder: 'MM / YYYY',
  },
  numberOfFamilies: {
    label: 'Number of Families',
    inputType: 'select',
    required: true,
    options: ['1 Family', '2 Family', '3 Family', '4 Family', '5+ Family'],
  },
  primarySourceOfHeat: {
    label: 'Primary Source of Heat',
    inputType: 'select',
    required: true,
    options: [
      'Central - Oil',
      'Central - Gas',
      'Central - Electric',
      'Other',
      'None',
    ],
  },
  residenceType: {
    label: 'Residence Type',
    inputType: 'select',
    required: true,
    options: ['Primary', 'Secondary'],
  },
  seasonalDwelling: {
    label: 'Seasonal Dwelling',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  swimmingPool: {
    label: 'Swimming Pool',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  swimmingPoolType: {
    label: 'Swimming Pool Type',
    inputType: 'select',
    required: true,
    options: ['Above Ground', 'Inground'],
    conditionalOn: 'swimmingPool',
    conditionalValue: 'Yes',
  },
  swimmingPoolSafetyFeature: {
    label: 'Swimming Pool Safety Feature',
    inputType: 'select',
    required: true,
    options: ['None', 'Fence or Locked Gate', 'Retractable Ladder', 'Other'],
    conditionalOn: 'swimmingPoolType',
    conditionalValue: ['Above Ground', 'Inground'],
  },
  woodCoalPelletStove: {
    label: 'Wood/Coal/Pellet Stove',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
  },
  stoveProfessionallyInstalledOrInspected: {
    label: 'Stove Professionally Installed/Inspected',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'woodCoalPelletStove',
    conditionalValue: 'Yes',
  },
  chimneyCleanedAnnually: {
    label: 'Chimney Cleaned Annually',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'woodCoalPelletStove',
    conditionalValue: 'Yes',
  },
  ulListed: {
    label: 'UL Listed',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'woodCoalPelletStove',
    conditionalValue: 'Yes',
  },
  numberOfResidenceEmployees: {
    label: 'Number of Residence Employees',
    inputType: 'number',
    required: false,
    placeholder: 'Optional',
  },
  squareFootage: {
    label: 'Square Footage',
    inputType: 'number',
    required: true,
    placeholder: 'Enter square footage',
  },
  buildingConstructionType: {
    label: 'Building Construction Type',
    inputType: 'select',
    required: true,
    options: [
      'Frame',
      'Masonry',
      'Concrete',
      'Steel',
      'Modular',
      'Mobile or Manufactured',
    ],
  },
  sidingType: {
    label: 'Siding Type',
    inputType: 'select',
    required: true,
    options: [...HOME_SIDING_TYPE_OPTIONS],
  },
  primaryFoundationType: {
    label: 'Primary Foundation Type',
    inputType: 'select',
    required: true,
    options: [
      'Basement/Crawlspace',
      'Slab',
      'Piers/Pilings',
    ],
  },
  basementFinished: {
    label: 'Basement Finished',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS,
    conditionalOn: 'primaryFoundationType',
    conditionalValue: 'Basement',
  },
  numberOfBathrooms: {
    label: 'Number of Bathrooms',
    inputType: 'number',
    required: true,
    placeholder: 'e.g. 2',
  },
  garageType: {
    label: 'Garage Type',
    inputType: 'select',
    required: true,
    options: ['Attached', 'Detached', 'Built-in', 'Basement', 'Carport', 'Multiple', 'None'],
  },
  garageSizeNumberOfCars: {
    label: 'Garage Size (Number of Cars)',
    inputType: 'select',
    required: true,
    options: ['1', '2', '3', '4', '5+'],
    conditionalOn: 'garageType',
    conditionalValue: ['Attached', 'Detached', 'Basement', 'Carport'],
  },
  numberOfStories: {
    label: 'Number of Stories',
    inputType: 'select',
    required: true,
    options: ['1', '2', '3', '4+'],
  },
  roofShape: {
    label: 'Roof Shape',
    inputType: 'select',
    required: true,
    options: ['Gable', 'Hip', 'Gambrel', 'Flat', 'Shed', 'Complex', 'Other'],
  },
  roofType: {
    label: 'Roof Type',
    inputType: 'select',
    required: true,
    options: [
      'Architectural Shingle',
      'Asphalt-Fiberglass',
      'Clay or Concrete Tile',
      'Slate',
      'Metal',
      'Wood',
      'Comp Over Wood',
      'Modified Polymer',
      'Foam Composite',
      'Rolled Material',
      'Rubber/Membrane',
      'Tar & Gravel',
      'T-Lock',
      'Asbestos',
    ],
  },
  yearRoofingReplaced: {
    label: 'Year Roofing Replaced',
    inputType: 'number',
    required: true,
    placeholder: 'e.g. 2022',
  },
  numberOfSolarPanelsOnRoof: {
    label: 'Number of Solar Panels on Roof',
    inputType: 'number',
    required: true,
    placeholder: 'Enter number of panels',
  },
  currentAutoPolicyBodilyInjuryLimit: {
    label: 'Current Auto Policy Bodily Injury Limit',
    inputType: 'select',
    required: true,
    options: [
      'Less than or Equal to 25/50 (CSL 75)',
      'Greater than 25/50 (CSL 75)',
      'No Car',
      'Car in Storage',
      'Military',
      'Car Without Insurance',
    ],
  },
  baseCoverageLevel: {
    label: 'Base Coverage Level',
    inputType: 'select',
    required: true,
    options: [
      'Travelers Protect®',
      'Travelers Protect Plus®',
      'Travelers Protect Premier®',
    ],
  },
  replacementCost: {
    label: 'Replacement Cost',
    inputType: 'number',
    required: true,
    placeholder: 'Enter replacement cost',
  },
  aDwellingLimit: {
    label: 'A - Dwelling Limit',
    inputType: 'number',
    required: true,
    placeholder: 'Enter dwelling limit',
  },
  ePersonalLiability: {
    label: 'E - Personal Liability',
    inputType: 'select',
    required: true,
    options: ['100,000', '300,000', '500,000'],
  },
  fMedicalPayments: {
    label: 'F - Medical Payments',
    inputType: 'select',
    required: true,
    options: ['1,000', '2,000', '5,000', '10,000'],
  },
  deductible: {
    label: 'Deductible',
    inputType: 'select',
    required: true,
    options: [
      '1,000',
      '1,500',
      '2,000',
      '2,500',
      '5,000',
      '7,500',
      '10,000',
      '25,000',
      '50,000',
      '1%',
      '2%',
    ],
  },
}

export const HOME_OCCUPANCY_FIELDS: Record<keyof HomeExtractionOccupancy, HomeFieldConfig> = {
  dwellingOccupancy: {
    label: 'Dwelling Occupancy',
    inputType: 'select',
    required: true,
    options: ['Owner Occupied', 'Tenant Occupied', 'Vacant', 'Secondary/Seasonal']
  },
  businessOnPremises: {
    label: 'Business Conducted on Premises',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS
  },
  shortTermRental: {
    label: 'Short-Term Rental (Airbnb, VRBO, etc.)',
    inputType: 'select',
    required: true,
    options: YES_NO_OPTIONS
  },
  // Conditional: Only shown if shortTermRental = 'Yes'
  daysRentedToOthers: {
    label: 'Days Rented to Others Per Year',
    inputType: 'select',
    required: false,
    options: ['None', '1-30', '31-90', '91-180', '181+'],
    conditionalOn: 'shortTermRental',
    conditionalValue: 'Yes'
  },
  horsesOrLivestock: {
    label: 'Horses or Livestock on Property',
    inputType: 'select',
    required: false,
    options: YES_NO_OPTIONS
  },
  numberOfFamilies: {
    label: 'Number of Families in Dwelling',
    inputType: 'select',
    required: true,
    options: ['1', '2', '3', '4+']
  },
}

export const HOME_SAFETY_RISK_FIELDS: Record<keyof HomeExtractionSafetyRisk, HomeFieldConfig> = {
  alarmSystem: { label: 'Alarm System', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  monitoredAlarm: { label: 'Monitored Alarm', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  pool: { label: 'Pool', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  trampoline: { label: 'Trampoline', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  enclosedYard: { label: 'Enclosed Yard', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  dog: { label: 'Dog', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  // Conditional: Only shown if dog = 'Yes'
  dogBreed: {
    label: 'Dog Breed',
    inputType: 'text',
    required: false,
    placeholder: 'Specify if Yes above',
    conditionalOn: 'dog',
    conditionalValue: 'Yes'
  },
  windMitigation: {
    label: 'Wind Mitigation Level',
    inputType: 'select',
    required: false,
    options: ['None', 'Basic', 'Moderate', 'Superior'],
    placeholder: 'Required for coastal/hurricane-prone areas'
  },
  stormShutters: {
    label: 'Storm Shutters',
    inputType: 'select',
    required: false,
    options: YES_NO_OPTIONS
  },
  impactGlass: {
    label: 'Impact-Resistant Glass',
    inputType: 'select',
    required: false,
    options: YES_NO_OPTIONS
  },
}

export const HOME_COVERAGE_FIELDS: Record<keyof HomeExtractionCoverage, HomeFieldConfig> = {
  dwellingCoverage: { label: 'Dwelling Coverage', inputType: 'text', required: true, placeholder: 'e.g., $350,000' },
  liabilityCoverage: { label: 'Liability Coverage', inputType: 'select', required: true, options: ['$100,000', '$300,000', '$500,000', '$1,000,000'] },
  medicalPayments: { label: 'Medical Payments (Med Pay)', inputType: 'select', required: false, options: ['$1,000', '$2,500', '$5,000', '$10,000'] },
  deductible: { label: 'Deductible', inputType: 'select', required: true, options: ['$500', '$1,000', '$2,500', '$5,000', '$10,000'] },
}

export const HOME_CLAIM_FIELDS: Record<keyof HomeExtractionClaim, HomeFieldConfig> = {
  date: { label: 'Claim Date', inputType: 'date', required: true },
  type: { label: 'Claim Type', inputType: 'select', required: true, options: [
    'Water Damage', 'Fire', 'Theft', 'Wind/Hail', 'Liability', 'Other'
  ]},
  description: { label: 'Description', inputType: 'text', required: false },
  amount: { label: 'Claim Amount', inputType: 'text', required: false, placeholder: 'e.g., $5,000' },
}

export const HOME_JEWELRY_FIELDS: Record<keyof HomeExtractionJewelryItem, HomeFieldConfig> = {
  description: { label: 'Item Description', inputType: 'text', required: true, placeholder: 'e.g., Diamond engagement ring' },
  value: { label: 'Appraised Value', inputType: 'text', required: true, placeholder: 'e.g., $5,000' },
}

export const HOME_VALUABLE_FIELDS: Record<keyof HomeExtractionValuableItem, HomeFieldConfig> = {
  description: { label: 'Item Description', inputType: 'text', required: true, placeholder: 'e.g., Antique grandfather clock' },
  value: { label: 'Appraised Value', inputType: 'text', required: true, placeholder: 'e.g., $3,000' },
}

export const HOME_INSURANCE_DETAILS_FIELDS: Record<keyof HomeExtractionInsuranceDetails, HomeFieldConfig> = {
  propertySameAsMailing: {
    label: 'Property Address Same as Mailing',
    inputType: 'select',
    required: false,
    options: YES_NO_OPTIONS
  },
  reasonForPolicy: {
    label: 'Reason for Policy',
    inputType: 'select',
    required: true,
    options: ['New Purchase', 'Existing Home', 'Refinance']
  },
  currentlyInsured: {
    label: 'Currently Insured',
    inputType: 'select',
    required: true,
    options: ['Yes - Same Carrier', 'Yes - Different Carrier', 'No - New Purchase', 'No - Lapse']
  },
  lienholderName: { label: 'Lienholder Name', inputType: 'text', required: false },
  lienholderAddress: { label: 'Lienholder Address', inputType: 'text', required: false },
  lienholderCity: { label: 'Lienholder City', inputType: 'text', required: false },
  lienholderState: { label: 'Lienholder State', inputType: 'select', required: false, options: US_STATES },
  lienholderZip: { label: 'Lienholder ZIP', inputType: 'text', required: false },
  currentInsuranceCompany: { label: 'Current Insurance Company', inputType: 'text', required: false },
  policyNumber: { label: 'Policy Number', inputType: 'text', required: false },
  effectiveDate: { label: 'Effective Date', inputType: 'date', required: true },
  currentPremium: { label: 'Current Premium', inputType: 'text', required: false, placeholder: 'e.g., $1,200/year' },
  escrowed: { label: 'Escrowed', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  insuranceCancelledDeclined: { label: 'Insurance Cancelled/Declined/Non-Renewed', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  maintenanceCondition: {
    label: 'Property Maintenance Condition',
    inputType: 'select',
    required: false,
    options: ['Excellent', 'Good', 'Average', 'Fair', 'Poor']
  },
  numberOfLosses5Years: {
    label: 'Number of Losses in Past 5 Years',
    inputType: 'select',
    required: true,
    options: ['0', '1', '2', '3', '4', '5+']
  },
  referredBy: { label: 'Referred By', inputType: 'text', required: false },
}

export const HOME_UPDATES_FIELDS: Record<keyof HomeExtractionUpdates, HomeFieldConfig> = {
  hvacUpdate: { label: 'HVAC Updated', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  hvacYear: {
    label: 'HVAC Update Year',
    inputType: 'number',
    required: false,
    conditionalOn: 'hvacUpdate',
    conditionalValue: 'Yes'
  },
  plumbingUpdate: { label: 'Plumbing Updated', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  plumbingYear: {
    label: 'Plumbing Update Year',
    inputType: 'number',
    required: false,
    conditionalOn: 'plumbingUpdate',
    conditionalValue: 'Yes'
  },
  roofUpdate: { label: 'Roof Updated', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  roofYear: {
    label: 'Roof Update Year',
    inputType: 'number',
    required: false,
    conditionalOn: 'roofUpdate',
    conditionalValue: 'Yes'
  },
  electricalUpdate: { label: 'Electrical Updated', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  electricalYear: {
    label: 'Electrical Update Year',
    inputType: 'number',
    required: false,
    conditionalOn: 'electricalUpdate',
    conditionalValue: 'Yes'
  },
  circuitBreakers: { label: 'Circuit Breakers', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  wiringUpdate: { label: 'Wiring Updated', inputType: 'select', required: false, options: YES_NO_OPTIONS },
  // Conditional: Only shown if wiringUpdate = 'Yes'
  wiringYear: {
    label: 'Wiring Update Year',
    inputType: 'number',
    required: false,
    conditionalOn: 'wiringUpdate',
    conditionalValue: 'Yes'
  },
}

// =============================================================================
// Section Configuration
// =============================================================================

export interface HomeSectionConfig {
  key: keyof HomeExtractionResult
  title: string
  description: string
  icon?: string
}

export const HOME_SECTIONS: HomeSectionConfig[] = [
  {
    key: 'personal',
    title: 'Personal Information',
    description: 'Applicant and co-applicant/spouse contact details',
  },
  {
    key: 'property',
    title: 'Property Information',
    description: 'Home construction, features, and characteristics',
  },
  {
    key: 'householdMember',
    title: 'Household Information',
    description: 'Household member identity, relationship, and license details',
  },
  {
    key: 'locationDetail',
    title: 'Location Detail',
    description: 'Location occupancy and liability-only indicators',
  },
  {
    key: 'locationInformation',
    title: 'Location Information',
    description: 'Basic location and rating information',
  },
  {
    key: 'policyQuestions',
    title: 'Policy Questions',
    description: 'Prior carrier and underwriting questions',
  },
  {
    key: 'locationSpecificQuestions',
    title: 'Location Specific Questions',
    description: 'Location-specific underwriting questions',
  },
  {
    key: 'homeownersInformations',
    title: 'Homeowners Informations',
    description: 'Homeowners underwriting, insurance history, and protective features',
  },
  {
    key: 'chubbHomeCoverageEstimator',
    title: 'Chubb Home Coverage Estimator',
    description:
      'Estimate home replacement cost with building details, attached structures, and construction types',
  },
  {
    key: 'occupancy',
    title: 'Occupancy & Use',
    description: 'Dwelling usage, rental status, and business activities',
  },
  {
    key: 'safetyRisk',
    title: 'Safety & Risk Features',
    description: 'Security systems, hazards, and wind mitigation',
  },
  {
    key: 'coverage',
    title: 'Coverage Information',
    description: 'Requested coverage amounts and limits',
  },
  {
    key: 'scheduledItems',
    title: 'Scheduled Items',
    description: 'Jewelry and other high-value personal property',
  },
  {
    key: 'claimsHistory',
    title: 'Claims History',
    description: 'Claims in the last 5 years',
  },
  {
    key: 'insuranceDetails',
    title: 'Lienholder & Insurance Details',
    description: 'Mortgage, current insurance, and property condition',
  },
  {
    key: 'updates',
    title: 'Home Updates',
    description: 'Recent system renovations and improvements',
  },
]

// =============================================================================
// Helper Functions
// =============================================================================

export function createEmptyExtractionField(value: string | null = null): ExtractionField {
  return {
    value,
    confidence: 'low',
    flagged: value === null,
    rawText: undefined,
  }
}

export function createEmptyHomeExtraction(): HomeExtractionResult {
  const createFieldsFromConfig = <T>(
    config: Record<string, HomeFieldConfig>
  ): T => {
    const result: Record<string, ExtractionField> = {}
    for (const key of Object.keys(config)) {
      result[key] = createEmptyExtractionField()
    }
    return result as unknown as T
  }

  return {
    personal: createFieldsFromConfig<HomeExtractionPersonal>(HOME_PERSONAL_FIELDS),
    property: createFieldsFromConfig<HomeExtractionProperty>(HOME_PROPERTY_FIELDS),
    householdMember: createFieldsFromConfig<HomeExtractionHouseholdMember>(HOME_HOUSEHOLD_MEMBER_FIELDS),
    locationDetail: createFieldsFromConfig<HomeExtractionLocationDetail>(HOME_LOCATION_DETAIL_FIELDS),
    locationInformation: createFieldsFromConfig<HomeExtractionLocationInformation>(HOME_LOCATION_INFORMATION_FIELDS),
    policyQuestions: createFieldsFromConfig<HomeExtractionPolicyQuestions>(HOME_POLICY_QUESTIONS_FIELDS),
    locationSpecificQuestions: createFieldsFromConfig<HomeExtractionLocationSpecificQuestions>(HOME_LOCATION_SPECIFIC_QUESTIONS_FIELDS),
    homeownersInformations: createFieldsFromConfig<HomeExtractionHomeownersInformations>(HOME_HOMEOWNERS_INFORMATIONS_FIELDS),
    chubbHomeCoverageEstimator: createEmptyChubbHomeCoverageEstimator(),
    occupancy: createFieldsFromConfig<HomeExtractionOccupancy>(HOME_OCCUPANCY_FIELDS),
    safetyRisk: createFieldsFromConfig<HomeExtractionSafetyRisk>(HOME_SAFETY_RISK_FIELDS),
    coverage: createFieldsFromConfig<HomeExtractionCoverage>(HOME_COVERAGE_FIELDS),
    scheduledItems: { jewelry: [], otherValuables: [] },
    claimsHistory: { claims: [] },
    insuranceDetails: createFieldsFromConfig<HomeExtractionInsuranceDetails>(HOME_INSURANCE_DETAILS_FIELDS),
    updates: createFieldsFromConfig<HomeExtractionUpdates>(HOME_UPDATES_FIELDS),
  }
}

export function createEmptyClaim(): HomeExtractionClaim {
  return {
    date: createEmptyExtractionField(),
    type: createEmptyExtractionField(),
    description: createEmptyExtractionField(),
    amount: createEmptyExtractionField(),
  }
}

export function createEmptyChubbAttachedStructure(): HomeChubbAttachedStructure {
  return {
    attachedStructureType: createEmptyExtractionField(),
    squareFeet: createEmptyExtractionField(),
  }
}

export function createEmptyChubbConstructionTypeEntry(): HomeChubbConstructionTypeEntry {
  return {
    constructionType: createEmptyExtractionField(),
    percentage: createEmptyExtractionField(),
  }
}

export function createEmptyChubbHomeCoverageEstimator(): HomeExtractionChubbHomeCoverageEstimator {
  const createFieldsFromConfig = <T>(
    config: Record<string, HomeFieldConfig>
  ): T => {
    const result: Record<string, ExtractionField> = {}
    for (const key of Object.keys(config)) {
      result[key] = createEmptyExtractionField()
    }
    return result as unknown as T
  }

  return {
    ...createFieldsFromConfig<
      Omit<HomeExtractionChubbHomeCoverageEstimator, 'attachedStructures' | 'constructionTypes'>
    >(CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS),
    attachedStructures: [createEmptyChubbAttachedStructure()],
    constructionTypes: [createEmptyChubbConstructionTypeEntry()],
  }
}

/** Scalar Chubb fields that were previously stored under homeownersInformations */
export const CHUBB_LEGACY_HOMEOWNERS_SCALAR_KEYS = [
  'numberOfMortgages',
  'usage',
  'priorCarrier',
  'priorCarrierOther',
] as const

export type ChubbLegacyHomeownersScalarKey =
  (typeof CHUBB_LEGACY_HOMEOWNERS_SCALAR_KEYS)[number]

export function mergeChubbWithLegacyHomeownersFields(
  chubb: HomeExtractionChubbHomeCoverageEstimator,
  legacyHomeowners?: HomeExtractionHomeownersInformations | null,
): HomeExtractionChubbHomeCoverageEstimator {
  if (!legacyHomeowners) return chubb

  const legacyRecord = legacyHomeowners as unknown as Record<
    string,
    ExtractionField | undefined
  >

  const updates: Partial<
    Pick<HomeExtractionChubbHomeCoverageEstimator, ChubbLegacyHomeownersScalarKey>
  > = {}

  for (const key of CHUBB_LEGACY_HOMEOWNERS_SCALAR_KEYS) {
    const current = chubb[key]
    const hasValue =
      current?.value != null && String(current.value).trim() !== ''
    const legacy = legacyRecord[key]
    const legacyHasValue =
      legacy?.value != null && String(legacy.value).trim() !== ''
    if (!hasValue && legacyHasValue && legacy) {
      updates[key] = legacy
    }
  }

  return Object.keys(updates).length > 0 ? { ...chubb, ...updates } : chubb
}

export function mergeChubbHomeCoverageEstimator(
  existing?: HomeExtractionChubbHomeCoverageEstimator | null
): HomeExtractionChubbHomeCoverageEstimator {
  const empty = createEmptyChubbHomeCoverageEstimator()
  if (!existing) return empty

  return {
    buildingType: existing.buildingType ?? empty.buildingType,
    livingAreaSqFt: existing.livingAreaSqFt ?? empty.livingAreaSqFt,
    yearBuilt: existing.yearBuilt ?? empty.yearBuilt,
    classification: existing.classification ?? empty.classification,
    renovated: existing.renovated ?? empty.renovated,
    percentRenovated: existing.percentRenovated ?? empty.percentRenovated,
    residenceDeductible: existing.residenceDeductible ?? empty.residenceDeductible,
    contentsAmount: existing.contentsAmount ?? empty.contentsAmount,
    contentsPercentage: existing.contentsPercentage ?? empty.contentsPercentage,
    typeOfContents: existing.typeOfContents ?? empty.typeOfContents,
    otherPermanentStructuresAmount:
      existing.otherPermanentStructuresAmount ?? empty.otherPermanentStructuresAmount,
    otherPermanentStructuresPercentage:
      existing.otherPermanentStructuresPercentage ?? empty.otherPermanentStructuresPercentage,
    deductibleWaiverOption: existing.deductibleWaiverOption ?? empty.deductibleWaiverOption,
    numberOfMortgages: existing.numberOfMortgages ?? empty.numberOfMortgages,
    usage: existing.usage ?? empty.usage,
    priorCarrier: existing.priorCarrier ?? empty.priorCarrier,
    priorCarrierOther: existing.priorCarrierOther ?? empty.priorCarrierOther,
    roofCoveringType: existing.roofCoveringType ?? empty.roofCoveringType,
    windProtection: existing.windProtection ?? empty.windProtection,
    hurricaneOrWindHailDeductibleType:
      existing.hurricaneOrWindHailDeductibleType ?? empty.hurricaneOrWindHailDeductibleType,
    hurricaneOrWindHailDeductiblePercentage:
      existing.hurricaneOrWindHailDeductiblePercentage ??
      empty.hurricaneOrWindHailDeductiblePercentage,
    securityGatedCommunity: existing.securityGatedCommunity ?? empty.securityGatedCommunity,
    security24HourGuardMonitoring:
      existing.security24HourGuardMonitoring ?? empty.security24HourGuardMonitoring,
    securityGatedHouse: existing.securityGatedHouse ?? empty.securityGatedHouse,
    securityFullTimeCaretaker:
      existing.securityFullTimeCaretaker ?? empty.securityFullTimeCaretaker,
    detectorGasLeakage: existing.detectorGasLeakage ?? empty.detectorGasLeakage,
    detectorLightningProtection:
      existing.detectorLightningProtection ?? empty.detectorLightningProtection,
    detectorBackupGenerator: existing.detectorBackupGenerator ?? empty.detectorBackupGenerator,
    detectorSeismicShutOffValve:
      existing.detectorSeismicShutOffValve ?? empty.detectorSeismicShutOffValve,
    sprinklerResidentialSystem:
      existing.sprinklerResidentialSystem ?? empty.sprinklerResidentialSystem,
    alarmBurglar: existing.alarmBurglar ?? empty.alarmBurglar,
    alarmFire: existing.alarmFire ?? empty.alarmFire,
    waterLeakProtection: existing.waterLeakProtection ?? empty.waterLeakProtection,
    distanceFromFireStation: existing.distanceFromFireStation ?? empty.distanceFromFireStation,
    attachedStructures:
      Array.isArray(existing.attachedStructures) && existing.attachedStructures.length > 0
        ? existing.attachedStructures
        : empty.attachedStructures,
    constructionTypes:
      Array.isArray(existing.constructionTypes) && existing.constructionTypes.length > 0
        ? existing.constructionTypes
        : empty.constructionTypes,
  }
}

export function createEmptyJewelryItem(): HomeExtractionJewelryItem {
  return {
    description: createEmptyExtractionField(),
    value: createEmptyExtractionField(),
  }
}

export function createEmptyValuableItem(): HomeExtractionValuableItem {
  return {
    description: createEmptyExtractionField(),
    value: createEmptyExtractionField(),
  }
}

/**
 * Utility function to check if a conditional field should be displayed
 * @param fieldConfig - The field configuration to check
 * @param sectionData - The current section's extraction data
 * @returns true if the field should be displayed, false otherwise
 */
export function shouldShowField(
  fieldConfig: HomeFieldConfig,
  sectionData: Record<string, ExtractionField>
): boolean {
  if (!fieldConfig.conditionalOn) {
    return true
  }

  const conditionalField = sectionData[fieldConfig.conditionalOn]
  if (!conditionalField || !conditionalField.value) {
    return false
  }

  const conditionalValue = fieldConfig.conditionalValue
  if (Array.isArray(conditionalValue)) {
    return conditionalValue.includes(conditionalField.value)
  }

  return conditionalField.value === conditionalValue
}

/**
 * Get all fields that should be visible based on current section data
 * @param fieldsConfig - The field configuration map for a section
 * @param sectionData - The current section's extraction data
 * @returns Array of field keys that should be displayed
 */
export function getVisibleFields<T extends Record<string, HomeFieldConfig>>(
  fieldsConfig: T,
  sectionData: Record<string, ExtractionField>
): (keyof T)[] {
  return (Object.keys(fieldsConfig) as (keyof T)[]).filter(key =>
    shouldShowField(fieldsConfig[key], sectionData)
  )
}
