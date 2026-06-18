import type { ExtractionField } from '@/types'
import {
  createEmptyExtractionField,
  type HomeExtractionResult,
} from '@/types/home-extraction'
import {
  getCarrierFieldsMap,
  isMultiCarrierWorkflow,
  setCarrierFieldInMap,
  type CarrierAwareHomeData,
} from './carrier-field-storage'
import type { CarrierOptionId } from './types'

/** Schema keys that map to a different UI path than their dotted name */
export const SCHEMA_KEY_TO_UI_PATH: Record<string, string> = {
  'property.streetAddress': 'personal.address',
  'personal.ssn': 'personal.applicantSSN',
  'hasHomeownersLossesPast7Years': 'insuranceDetails.numberOfLosses5Years',
  locationSpecificPleaseExplain: 'locationSpecificQuestions.pleaseExplain',
  roofYear: 'locationInformation.roofUpdateYear',
  entity: 'personal.entity',
}

/** When a value is set on the primary path, also mirror to these UI paths */
export const SECONDARY_UI_PATHS: Record<string, string[]> = {
  'chubbHomeCoverageEstimator.livingAreaSqFt': ['homeownersInformations.squareFootage'],
}

const CHUBB_FLAT_KEYS = new Set([
  'buildingType',
  'livingAreaSqFt',
  'yearBuilt',
  'classification',
  'renovated',
  'percentRenovated',
  'residenceDeductible',
  'contentsAmount',
  'contentsPercentage',
  'typeOfContents',
  'otherPermanentStructuresAmount',
  'otherPermanentStructuresPercentage',
  'deductibleWaiverOption',
])

const AUTO_OWNERS_PERSONAL_FLAT_KEYS = new Set(['termLength', 'agentProducerName'])

const AUTO_OWNERS_LOCATION_DETAIL_KEYS = new Set([
  'locationOccupancy',
  'ownerOccupied',
  'vacant',
  'liabilityCoverageOnly',
  'personalPropertyOnly',
])

const AUTO_OWNERS_LOCATION_INFORMATION_KEYS = new Set([
  'program',
  'type',
  'coverageA',
  'coverageF',
  'personalInjury',
  'coverageG',
  'allOtherPerilsDeductible',
  'windHailDeductible',
  'hurricaneDeductible',
  'constructionYear',
  'construction',
  'foundation',
  'finishedLivingArea',
  'numberOfFamiliesUnits',
  'replacementCost100',
  'roofLossSettlementWindstormHail',
  'marketValue',
  'isStudentRental',
  'boardingOrLodgingOrStudentRentals',
  'visibleFromOtherDwellings',
  'locatedOnIsland',
  'conditionOfDwelling',
  'roofUpdateYear',
  'hasMortgageeContractHolderOrSecuredLineOfCredit',
  'dogsOwnedOrKept',
  'specificBreed',
  'biteHistoryAggressiveBehavior',
  'within1000FeetOfHydrant',
  'bridgeAccess',
  'dwellingConstructedWithAsbestos',
  'fortifiedHome',
  'woodCoalHeating',
  'woodCoalHeatingLocation',
  'woodCoalHeatingQuantity',
  'gatedAccessToDwelling',
  'applicantWillingToCompleteDiySurvey',
  'screenedEnclosure',
  'fireplace',
  'swimmingPool',
  'roofMaterial',
  'roofShape',
  'heatingType',
  'plumbingType',
  'electricalType',
  'numberOfStories',
  'garageType',
  'burglarAlarm',
  'fireAlarm',
  'sprinklerSystem',
  'gatedCommunity',
])

const AUTO_OWNERS_POLICY_QUESTION_KEYS = new Set([
  'pleaseExplain',
  'hasAnyCompanyCanceledRefusedOrDeclinedRenewal',
  'hasAutoOwnersInsurancePast5Years',
  'options',
  'previousPolicyNumber',
  'hasFiledPersonalBankruptcyOrJudgementsPast5Years',
  'bankruptcyPleaseExplain',
  'hasAnyApplicantBeenConvictedOfArson',
])

const AUTO_OWNERS_LOCATION_SPECIFIC_KEYS = new Set([
  'dwellingForSale',
  'isNewVentureNoPreviousLandlordOrRentalPropertyExperience',
  'areThereAnyOutbuildingsOnPremises',
  'anyFloodingBrushLandslideOrUnusualHazards',
  'areDogsAllowed',
  'anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets',
  'anyUncorrectedFireCodeViolations',
  'difficultAccessByFireAndPoliceDepartments',
  'dwellingNewPurchase',
  'purchasePrice',
  'dwellingOccupied',
  'expectedOccupancyDate',
  'dayCareOnPremises',
  'childrenCaredForCount',
  'farmingOnPremises',
  'acresFarmedByOthers',
  'numberOfAnimalsLarge',
  'numberOfAnimalsMedium',
  'numberOfAnimalsSmall',
  'otherBusinessOnPremises',
  'describeBusiness',
  'buildingUnderRenovationOrReconstruction',
  'householdMembersLivingDuringRenovation',
  'renovationExplanation',
  'responsesVerifiedWithApplicant',
])

const TRAVELERS_FLAT_KEYS = new Set([
  'homeownersInsuranceCancelledDeclinedNonrenewedLast3Years',
  'homeVacantOrUnoccupied',
  'occupiedInNext30Days',
  'businessConductedOnPremises',
  'businessProvidesProfessionalAdviceOrOpinions',
  'businessHasEmployeesOtherThanResidenceRelatives',
  'businessMoreThanFourClientVisitsPerWeek',
  'homeAvailableForRentIncludingShortTermOrHomeSharing',
  'portionOfHomeAvailableForRent',
  'basisHomeAvailableForRent',
  'homeInDesignatedHighRiskFloodZone',
  'hasFloodPolicy',
  'petsOrAnimalsBittenOrInjuredAnyone',
  'ownsRestrictedDogBreedsOrMix',
  'insuranceStatus',
  'burglarAlarm',
  'feetFromHydrant',
  'yearBuilt',
  'purchaseMonthYear',
  'numberOfFamilies',
  'primarySourceOfHeat',
  'residenceType',
  'seasonalDwelling',
  'swimmingPool',
  'swimmingPoolType',
  'swimmingPoolSafetyFeature',
  'woodCoalPelletStove',
  'stoveProfessionallyInstalledOrInspected',
  'chimneyCleanedAnnually',
  'ulListed',
  'squareFootage',
  'buildingConstructionType',
  'sidingType',
  'primaryFoundationType',
  'basementFinished',
  'numberOfBathrooms',
  'garageType',
  'garageSizeNumberOfCars',
  'numberOfStories',
  'roofShape',
  'roofType',
  'yearRoofingReplaced',
  'numberOfSolarPanelsOnRoof',
  'currentAutoPolicyBodilyInjuryLimit',
  'baseCoverageLevel',
  'replacementCost',
  'aDwellingLimit',
  'ePersonalLiability',
  'fMedicalPayments',
  'deductible',
  'livedAtDifferentAddressPast6Months',
  'accountSearchCriteria',
  'policyNumber',
  'ccfNumber',
  'absNumber',
])

export function resolveUiPath(
  schemaKey: string,
  carrierOptionId: CarrierOptionId = 'chubb-home',
): string {
  if (SCHEMA_KEY_TO_UI_PATH[schemaKey]) {
    return SCHEMA_KEY_TO_UI_PATH[schemaKey]
  }
  if (schemaKey.includes('.')) {
    return schemaKey
  }
  if (carrierOptionId === 'auto-owners-home') {
    if (AUTO_OWNERS_PERSONAL_FLAT_KEYS.has(schemaKey)) {
      return `personal.${schemaKey}`
    }
    if (AUTO_OWNERS_LOCATION_DETAIL_KEYS.has(schemaKey)) {
      return `locationDetail.${schemaKey}`
    }
    if (AUTO_OWNERS_LOCATION_INFORMATION_KEYS.has(schemaKey)) {
      return `locationInformation.${schemaKey}`
    }
    if (AUTO_OWNERS_POLICY_QUESTION_KEYS.has(schemaKey)) {
      return `policyQuestions.${schemaKey}`
    }
    if (AUTO_OWNERS_LOCATION_SPECIFIC_KEYS.has(schemaKey)) {
      return `locationSpecificQuestions.${schemaKey}`
    }
    if (schemaKey === 'trampoline') {
      return 'safetyRisk.trampoline'
    }
    return `locationInformation.${schemaKey}`
  }
  if (carrierOptionId === 'travelers-home' && TRAVELERS_FLAT_KEYS.has(schemaKey)) {
    return `homeownersInformations.${schemaKey}`
  }
  if (carrierOptionId === 'chubb-home' && CHUBB_FLAT_KEYS.has(schemaKey)) {
    return `chubbHomeCoverageEstimator.${schemaKey}`
  }
  if (carrierOptionId === 'travelers-home') {
    return `homeownersInformations.${schemaKey}`
  }
  return `chubbHomeCoverageEstimator.${schemaKey}`
}

export function getFieldAtUiPath(
  data: HomeExtractionResult,
  uiPath: string,
): ExtractionField {
  const [section, fieldName] = uiPath.split('.')
  if (!section || !fieldName) return createEmptyExtractionField()
  const container = data[section as keyof HomeExtractionResult]
  if (!container || typeof container !== 'object') return createEmptyExtractionField()
  const field = (container as unknown as Record<string, ExtractionField>)[fieldName]
  return field ?? createEmptyExtractionField()
}

export function getFieldBySchemaKey(
  data: CarrierAwareHomeData,
  schemaKey: string,
  carrierOptionId: CarrierOptionId,
): ExtractionField {
  const carrierMap = getCarrierFieldsMap(data, carrierOptionId)
  const fromCarrier = carrierMap?.[schemaKey]
  if (fromCarrier) {
    return fromCarrier
  }

  if (isMultiCarrierWorkflow(data)) {
    return createEmptyExtractionField()
  }

  const legacy = carrierMap?.[schemaKey]
  if (legacy?.value != null && String(legacy.value).trim() !== '') {
    return legacy
  }

  return getFieldAtUiPath(data, resolveUiPath(schemaKey, carrierOptionId))
}

export function setFieldAtUiPath(
  data: HomeExtractionResult,
  uiPath: string,
  field: ExtractionField,
): HomeExtractionResult {
  const [section, fieldName] = uiPath.split('.')
  if (!section || !fieldName) return data
  const container = data[section as keyof HomeExtractionResult]
  if (!container || typeof container !== 'object' || !(fieldName in container)) {
    return data
  }
  return {
    ...data,
    [section]: {
      ...(container as object),
      [fieldName]: field,
    },
  }
}

export function updateFieldBySchemaKey(
  data: CarrierAwareHomeData,
  schemaKey: string,
  value: string,
  carrierOptionId: CarrierOptionId,
): CarrierAwareHomeData {
  const updatedField: ExtractionField = {
    ...getFieldBySchemaKey(data, schemaKey, carrierOptionId),
    value,
    confidence: 'high',
    flagged: false,
  }

  let next = setCarrierFieldInMap(data, carrierOptionId, schemaKey, updatedField)

  if (!isMultiCarrierWorkflow(data)) {
    const uiPath = resolveUiPath(schemaKey, carrierOptionId)
    next = setFieldAtUiPath(next, uiPath, updatedField)

    for (const mirrorPath of SECONDARY_UI_PATHS[uiPath] ?? []) {
      next = setFieldAtUiPath(next, mirrorPath, updatedField)
    }
  }

  return next
}
