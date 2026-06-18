/**
 * Quote Validation Utilities
 * Transforms extraction data into UI validation format and validates fields
 * Supports both Home and Auto insurance extraction data structures
 *
 * This module dynamically maps ALL extracted fields to the UI validation format,
 * using field configurations from the extraction type definitions.
 */

import type {
  ExtractionField,
  ExtractionResult,
  HomeApiExtractionResult,
  AutoApiExtractionResult,
  CombinedExtractionData,
  ExtractionBooleanField,
} from '@/types/extraction'
import type { HomeExtractionResult, HomeFieldConfig } from '@/types/home-extraction'
import type { AutoExtractionResult, AutoFieldConfig } from '@/types/auto-extraction'
import type {
  QuoteType,
  UIFieldValidation,
  UIValidationResult,
  FieldValidationStatus,
  ConfidenceLevel,
} from '@/types/quote'

// Import field configurations from type definitions
import {
  HOME_PERSONAL_FIELDS,
  HOME_PROPERTY_FIELDS,
  HOME_HOUSEHOLD_MEMBER_FIELDS,
  HOME_OCCUPANCY_FIELDS,
  HOME_SAFETY_RISK_FIELDS,
  HOME_COVERAGE_FIELDS,
  HOME_INSURANCE_DETAILS_FIELDS,
  HOME_UPDATES_FIELDS,
} from '@/types/home-extraction'

import {
  AUTO_PERSONAL_FIELDS,
  AUTO_DRIVER_FIELDS,
  AUTO_VEHICLE_FIELDS,
  AUTO_COVERAGE_FIELDS,
  AUTO_DEDUCTIBLE_FIELDS,
  AUTO_LIENHOLDER_FIELDS,
  AUTO_PRIOR_INSURANCE_FIELDS,
  AUTO_ACCIDENT_TICKET_FIELDS,
} from '@/types/auto-extraction'

// Field definitions for each quote type
export interface FieldDefinition {
  key: string
  label: string
  category: string
  inputType: 'text' | 'select' | 'date' | 'tel' | 'email' | 'number'
  required: boolean
  extractionPath: string // e.g., 'personal.firstName'
  options?: string[]
}

// =============================================================================
// Utility function to convert field config to field definition
// =============================================================================

function convertInputType(inputType: string): 'text' | 'select' | 'date' | 'tel' | 'email' | 'number' {
  switch (inputType) {
    case 'date': return 'date'
    case 'tel': return 'tel'
    case 'email': return 'email'
    case 'number': return 'number'
    case 'select':
    case 'checkbox': return 'select'
    case 'textarea':
    default: return 'text'
  }
}

function createFieldDefinitionsFromConfig(
  config: Record<string, HomeFieldConfig | AutoFieldConfig>,
  category: string,
  sectionPath: string
): FieldDefinition[] {
  return Object.entries(config).map(([key, fieldConfig]) => ({
    key: `${sectionPath}.${key}`,
    label: fieldConfig.label,
    category,
    inputType: convertInputType(fieldConfig.inputType),
    required: fieldConfig.required,
    extractionPath: `${sectionPath}.${key}`,
    options: fieldConfig.options,
  }))
}

// =============================================================================
// Home Insurance Field Definitions - Dynamically Generated
// =============================================================================

/**
 * Gets dynamically generated field definitions from Home extraction type configs.
 * Use this for comprehensive field mapping that stays in sync with extraction types.
 */
export function getHomeFieldDefinitions(): { required: FieldDefinition[], optional: FieldDefinition[] } {
  const allFields: FieldDefinition[] = [
    // Personal Information
    ...createFieldDefinitionsFromConfig(HOME_PERSONAL_FIELDS, 'Personal Information', 'personal'),
    // Property Information
    ...createFieldDefinitionsFromConfig(HOME_PROPERTY_FIELDS, 'Property Information', 'property'),
    // Household Information
    ...createFieldDefinitionsFromConfig(HOME_HOUSEHOLD_MEMBER_FIELDS, 'Household Information', 'householdMember'),
    // Occupancy & Use
    ...createFieldDefinitionsFromConfig(HOME_OCCUPANCY_FIELDS, 'Occupancy & Use', 'occupancy'),
    // Safety & Risk
    ...createFieldDefinitionsFromConfig(HOME_SAFETY_RISK_FIELDS, 'Safety & Risk', 'safetyRisk'),
    // Coverage
    ...createFieldDefinitionsFromConfig(HOME_COVERAGE_FIELDS, 'Coverage', 'coverage'),
    // Insurance Details
    ...createFieldDefinitionsFromConfig(HOME_INSURANCE_DETAILS_FIELDS, 'Insurance Details', 'insuranceDetails'),
    // Updates
    ...createFieldDefinitionsFromConfig(HOME_UPDATES_FIELDS, 'Home Updates', 'updates'),
  ]

  const required = allFields.filter(f => f.required)
  const optional = allFields.filter(f => !f.required)

  return { required, optional }
}

// Legacy static definitions for backward compatibility
const homeRequiredFields: FieldDefinition[] = [
  // Personal
  { key: 'personal.firstName', label: 'First Name', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.firstName' },
  { key: 'personal.lastName', label: 'Last Name', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.lastName' },
  { key: 'personal.address', label: 'Street Address', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.address' },
  { key: 'personal.city', label: 'City', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.city' },
  { key: 'personal.state', label: 'State', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.state' },
  { key: 'personal.zipCode', label: 'ZIP Code', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.zipCode' },
  { key: 'personal.phone', label: 'Phone', category: 'Personal Information', inputType: 'tel', required: true, extractionPath: 'personal.phone' },
  { key: 'personal.applicantDOB', label: 'Applicant Date of Birth', category: 'Personal Information', inputType: 'date', required: true, extractionPath: 'personal.applicantDOB' },
  { key: 'personal.maritalStatus', label: 'Marital Status', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.maritalStatus' },
  { key: 'personal.coApplicantPresent', label: 'Co-Applicant/Spouse Present', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.coApplicantPresent' },
  {
    key: 'personal.livedAtDifferentAddressPast6Months',
    label: 'Have you lived at a different address in the past 6 months?',
    category: 'Personal Information',
    inputType: 'select',
    required: true,
    extractionPath: 'personal.livedAtDifferentAddressPast6Months',
    options: ['Yes', 'No'],
  },

  // Property - Required
  { key: 'property.yearBuilt', label: 'Year Built', category: 'Property Information', inputType: 'number', required: true, extractionPath: 'property.yearBuilt' },
  { key: 'property.squareFootage', label: 'Square Footage', category: 'Property Information', inputType: 'number', required: true, extractionPath: 'property.squareFootage' },
  { key: 'property.numberOfStories', label: 'Number of Stories', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.numberOfStories' },
  { key: 'property.bedroomCount', label: 'Number of Bedrooms', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.bedroomCount' },
  { key: 'property.bathroomCount', label: 'Number of Bathrooms', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.bathroomCount' },
  { key: 'property.exteriorConstruction', label: 'Exterior Construction', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.exteriorConstruction' },
  { key: 'property.roofAge', label: 'Roof Age', category: 'Property Information', inputType: 'number', required: true, extractionPath: 'property.roofAge' },
  { key: 'property.roofConstruction', label: 'Roof Construction', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.roofConstruction' },
  { key: 'property.foundation', label: 'Foundation Type', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.foundation' },
  { key: 'property.heatType', label: 'Heat Type', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.heatType' },
  { key: 'property.dwellingType', label: 'Dwelling Type', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.dwellingType' },
  { key: 'property.constructionStyle', label: 'Construction Style', category: 'Property Information', inputType: 'select', required: true, extractionPath: 'property.constructionStyle' },

  // Household Member - Required
  { key: 'householdMember.firstName', label: 'Household Member First Name', category: 'Household Information', inputType: 'text', required: true, extractionPath: 'householdMember.firstName' },
  { key: 'householdMember.lastName', label: 'Household Member Last Name', category: 'Household Information', inputType: 'text', required: true, extractionPath: 'householdMember.lastName' },
  { key: 'householdMember.suffix', label: 'Suffix', category: 'Household Information', inputType: 'text', required: true, extractionPath: 'householdMember.suffix' },
  { key: 'householdMember.dob', label: 'Date of Birth', category: 'Household Information', inputType: 'date', required: true, extractionPath: 'householdMember.dob' },
  { key: 'householdMember.ssn', label: 'SSN', category: 'Household Information', inputType: 'text', required: true, extractionPath: 'householdMember.ssn' },
  {
    key: 'householdMember.relationship',
    label: 'Relationship to Insured',
    category: 'Household Information',
    inputType: 'select',
    required: true,
    extractionPath: 'householdMember.relationship',
    options: ['Self/Named Insured', 'Spouse', 'Resident Relative', 'Child', 'Other'],
  },
  { key: 'householdMember.maritalStatus', label: 'Marital Status', category: 'Household Information', inputType: 'select', required: true, extractionPath: 'householdMember.maritalStatus' },
  { key: 'householdMember.dlState', label: "Driver's License State", category: 'Household Information', inputType: 'select', required: true, extractionPath: 'householdMember.dlState' },
  { key: 'householdMember.dlNumber', label: "Driver's License Number", category: 'Household Information', inputType: 'text', required: true, extractionPath: 'householdMember.dlNumber' },

  // Occupancy - Required
  { key: 'occupancy.dwellingOccupancy', label: 'Dwelling Occupancy', category: 'Occupancy & Use', inputType: 'select', required: true, extractionPath: 'occupancy.dwellingOccupancy' },
  { key: 'occupancy.businessOnPremises', label: 'Business on Premises', category: 'Occupancy & Use', inputType: 'select', required: true, extractionPath: 'occupancy.businessOnPremises' },
  { key: 'occupancy.shortTermRental', label: 'Short-Term Rental', category: 'Occupancy & Use', inputType: 'select', required: true, extractionPath: 'occupancy.shortTermRental' },
  { key: 'occupancy.numberOfFamilies', label: 'Number of Families', category: 'Occupancy & Use', inputType: 'select', required: true, extractionPath: 'occupancy.numberOfFamilies' },

  // Coverage - Required
  { key: 'coverage.dwellingCoverage', label: 'Dwelling Coverage', category: 'Coverage', inputType: 'text', required: true, extractionPath: 'coverage.dwellingCoverage' },
  { key: 'coverage.liabilityCoverage', label: 'Liability Coverage', category: 'Coverage', inputType: 'select', required: true, extractionPath: 'coverage.liabilityCoverage' },
  { key: 'coverage.deductible', label: 'Deductible', category: 'Coverage', inputType: 'select', required: true, extractionPath: 'coverage.deductible' },

  // Insurance Details - Required
  { key: 'insuranceDetails.effectiveDate', label: 'Effective Date', category: 'Insurance Details', inputType: 'date', required: true, extractionPath: 'insuranceDetails.effectiveDate' },
  { key: 'insuranceDetails.reasonForPolicy', label: 'Reason for Policy', category: 'Insurance Details', inputType: 'select', required: true, extractionPath: 'insuranceDetails.reasonForPolicy' },
  { key: 'insuranceDetails.currentlyInsured', label: 'Currently Insured', category: 'Insurance Details', inputType: 'select', required: true, extractionPath: 'insuranceDetails.currentlyInsured' },
]

const homeOptionalFields: FieldDefinition[] = [
  // Personal - Optional
  { key: 'personal.email', label: 'Email', category: 'Personal Information', inputType: 'email', required: false, extractionPath: 'personal.email' },
  { key: 'personal.spouseFirstName', label: 'Spouse First Name', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.spouseFirstName' },
  { key: 'personal.spouseLastName', label: 'Spouse Last Name', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.spouseLastName' },
  { key: 'personal.spouseDOB', label: 'Spouse Date of Birth', category: 'Personal Information', inputType: 'date', required: false, extractionPath: 'personal.spouseDOB' },
  { key: 'personal.applicantSSN', label: 'Applicant SSN', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.applicantSSN' },
  { key: 'personal.spouseSSN', label: 'Spouse SSN', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.spouseSSN' },
  { key: 'personal.occupation', label: 'Occupation', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.occupation' },
  { key: 'personal.priorAddress', label: 'Prior Address', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.priorAddress' },
  { key: 'personal.priorCity', label: 'Prior City', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.priorCity' },
  { key: 'personal.priorState', label: 'Prior State', category: 'Personal Information', inputType: 'select', required: false, extractionPath: 'personal.priorState' },
  { key: 'personal.priorZipCode', label: 'Prior ZIP Code', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.priorZipCode' },
  { key: 'personal.yearsAtCurrentAddress', label: 'Years at Current Address', category: 'Personal Information', inputType: 'number', required: false, extractionPath: 'personal.yearsAtCurrentAddress' },

  // Property - Optional
  { key: 'property.purchaseDate', label: 'Purchase Date', category: 'Property Information', inputType: 'date', required: false, extractionPath: 'property.purchaseDate' },
  { key: 'property.kitchenCount', label: 'Number of Kitchens', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.kitchenCount' },
  { key: 'property.kitchenStyle', label: 'Kitchen Style', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.kitchenStyle' },
  { key: 'property.bathroomStyle', label: 'Bathroom Style', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.bathroomStyle' },
  { key: 'property.flooringPercentage', label: 'Flooring Percentage', category: 'Property Information', inputType: 'text', required: false, extractionPath: 'property.flooringPercentage' },
  { key: 'property.constructionQuality', label: 'Construction Quality', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.constructionQuality' },
  { key: 'property.homeUnderConstruction', label: 'Home Under Construction', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.homeUnderConstruction' },
  { key: 'property.exteriorFeatures', label: 'Exterior Features', category: 'Property Information', inputType: 'text', required: false, extractionPath: 'property.exteriorFeatures' },
  { key: 'property.fireplaceCount', label: 'Number of Fireplaces', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.fireplaceCount' },
  { key: 'property.fireplaceType', label: 'Fireplace Type', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.fireplaceType' },
  { key: 'property.roofShape', label: 'Roof Shape', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.roofShape' },
  { key: 'property.finishedBasement', label: 'Finished Basement', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.finishedBasement' },
  { key: 'property.garageType', label: 'Garage Type', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.garageType' },
  { key: 'property.garageLocation', label: 'Garage Location', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.garageLocation' },
  { key: 'property.deckPatioDetails', label: 'Deck/Patio Details', category: 'Property Information', inputType: 'text', required: false, extractionPath: 'property.deckPatioDetails' },
  { key: 'property.condoOrTownhouse', label: 'Condo or Townhouse', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.condoOrTownhouse' },
  { key: 'property.specialFeatures', label: 'Special Features', category: 'Property Information', inputType: 'text', required: false, extractionPath: 'property.specialFeatures' },
  { key: 'property.distanceToFireDepartment', label: 'Distance to Fire Department', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.distanceToFireDepartment' },
  { key: 'property.waterSupplyType', label: 'Water Supply Type', category: 'Property Information', inputType: 'select', required: false, extractionPath: 'property.waterSupplyType' },

  // Occupancy - Optional
  { key: 'occupancy.daysRentedToOthers', label: 'Days Rented to Others', category: 'Occupancy & Use', inputType: 'select', required: false, extractionPath: 'occupancy.daysRentedToOthers' },
  { key: 'occupancy.horsesOrLivestock', label: 'Horses or Livestock', category: 'Occupancy & Use', inputType: 'select', required: false, extractionPath: 'occupancy.horsesOrLivestock' },

  // Safety & Risk
  { key: 'safetyRisk.alarmSystem', label: 'Alarm System', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.alarmSystem' },
  { key: 'safetyRisk.monitoredAlarm', label: 'Monitored Alarm', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.monitoredAlarm' },
  { key: 'safetyRisk.pool', label: 'Pool', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.pool' },
  { key: 'safetyRisk.trampoline', label: 'Trampoline', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.trampoline' },
  { key: 'safetyRisk.enclosedYard', label: 'Enclosed Yard', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.enclosedYard' },
  { key: 'safetyRisk.dog', label: 'Dog', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.dog' },
  { key: 'safetyRisk.dogBreed', label: 'Dog Breed', category: 'Safety & Risk', inputType: 'text', required: false, extractionPath: 'safetyRisk.dogBreed' },
  { key: 'safetyRisk.windMitigation', label: 'Wind Mitigation', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.windMitigation' },
  { key: 'safetyRisk.stormShutters', label: 'Storm Shutters', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.stormShutters' },
  { key: 'safetyRisk.impactGlass', label: 'Impact-Resistant Glass', category: 'Safety & Risk', inputType: 'select', required: false, extractionPath: 'safetyRisk.impactGlass' },

  // Coverage - Optional
  { key: 'coverage.medicalPayments', label: 'Medical Payments', category: 'Coverage', inputType: 'select', required: false, extractionPath: 'coverage.medicalPayments' },

  // Insurance Details - Optional
  { key: 'insuranceDetails.propertySameAsMailing', label: 'Property Same as Mailing', category: 'Insurance Details', inputType: 'select', required: false, extractionPath: 'insuranceDetails.propertySameAsMailing' },
  { key: 'insuranceDetails.currentInsuranceCompany', label: 'Current Insurance Company', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.currentInsuranceCompany' },
  { key: 'insuranceDetails.policyNumber', label: 'Policy Number', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.policyNumber' },
  { key: 'insuranceDetails.currentPremium', label: 'Current Premium', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.currentPremium' },
  { key: 'insuranceDetails.lienholderName', label: 'Lienholder Name', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.lienholderName' },
  { key: 'insuranceDetails.lienholderAddress', label: 'Lienholder Address', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.lienholderAddress' },
  { key: 'insuranceDetails.lienholderCity', label: 'Lienholder City', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.lienholderCity' },
  { key: 'insuranceDetails.lienholderState', label: 'Lienholder State', category: 'Insurance Details', inputType: 'select', required: false, extractionPath: 'insuranceDetails.lienholderState' },
  { key: 'insuranceDetails.lienholderZip', label: 'Lienholder ZIP', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.lienholderZip' },
  { key: 'insuranceDetails.escrowed', label: 'Escrowed', category: 'Insurance Details', inputType: 'select', required: false, extractionPath: 'insuranceDetails.escrowed' },
  { key: 'insuranceDetails.insuranceCancelledDeclined', label: 'Insurance Cancelled/Declined', category: 'Insurance Details', inputType: 'select', required: false, extractionPath: 'insuranceDetails.insuranceCancelledDeclined' },
  { key: 'insuranceDetails.maintenanceCondition', label: 'Maintenance Condition', category: 'Insurance Details', inputType: 'select', required: false, extractionPath: 'insuranceDetails.maintenanceCondition' },
  { key: 'insuranceDetails.numberOfLosses5Years', label: 'Number of Losses (5 Years)', category: 'Insurance Details', inputType: 'select', required: true, extractionPath: 'insuranceDetails.numberOfLosses5Years' },
  { key: 'insuranceDetails.referredBy', label: 'Referred By', category: 'Insurance Details', inputType: 'text', required: false, extractionPath: 'insuranceDetails.referredBy' },

  // Updates - Optional
  { key: 'updates.hvacUpdate', label: 'HVAC Updated', category: 'Home Updates', inputType: 'select', required: false, extractionPath: 'updates.hvacUpdate' },
  { key: 'updates.hvacYear', label: 'HVAC Update Year', category: 'Home Updates', inputType: 'number', required: false, extractionPath: 'updates.hvacYear' },
  { key: 'updates.plumbingUpdate', label: 'Plumbing Updated', category: 'Home Updates', inputType: 'select', required: false, extractionPath: 'updates.plumbingUpdate' },
  { key: 'updates.plumbingYear', label: 'Plumbing Update Year', category: 'Home Updates', inputType: 'number', required: false, extractionPath: 'updates.plumbingYear' },
  { key: 'updates.roofUpdate', label: 'Roof Updated', category: 'Home Updates', inputType: 'select', required: false, extractionPath: 'updates.roofUpdate' },
  { key: 'updates.roofYear', label: 'Roof Update Year', category: 'Home Updates', inputType: 'number', required: false, extractionPath: 'updates.roofYear' },
  { key: 'updates.electricalUpdate', label: 'Electrical Updated', category: 'Home Updates', inputType: 'select', required: false, extractionPath: 'updates.electricalUpdate' },
  { key: 'updates.electricalYear', label: 'Electrical Update Year', category: 'Home Updates', inputType: 'number', required: false, extractionPath: 'updates.electricalYear' },
  { key: 'updates.circuitBreakers', label: 'Circuit Breakers', category: 'Home Updates', inputType: 'select', required: false, extractionPath: 'updates.circuitBreakers' },
  { key: 'updates.wiringUpdate', label: 'Wiring Updated', category: 'Home Updates', inputType: 'select', required: false, extractionPath: 'updates.wiringUpdate' },
  { key: 'updates.wiringYear', label: 'Wiring Update Year', category: 'Home Updates', inputType: 'number', required: false, extractionPath: 'updates.wiringYear' },
]

// =============================================================================
// Auto Insurance Field Definitions - Comprehensive
// =============================================================================

/**
 * Gets dynamically generated field definitions from Auto extraction type configs.
 * Use this for comprehensive field mapping that stays in sync with extraction types.
 */
export function getAutoFieldDefinitions(): { required: FieldDefinition[], optional: FieldDefinition[] } {
  const allFields: FieldDefinition[] = [
    // Personal Information
    ...createFieldDefinitionsFromConfig(AUTO_PERSONAL_FIELDS, 'Personal Information', 'personal'),
    // Coverage
    ...createFieldDefinitionsFromConfig(AUTO_COVERAGE_FIELDS, 'Coverage', 'coverage'),
    // Prior Insurance
    ...createFieldDefinitionsFromConfig(AUTO_PRIOR_INSURANCE_FIELDS, 'Prior Insurance', 'priorInsurance'),
  ]

  const required = allFields.filter(f => f.required)
  const optional = allFields.filter(f => !f.required)

  return { required, optional }
}

const autoRequiredFields: FieldDefinition[] = [
  // Personal - Owner Info
  { key: 'personal.effectiveDate', label: 'Policy Effective Date', category: 'Personal Information', inputType: 'date', required: true, extractionPath: 'personal.effectiveDate' },
  { key: 'personal.ownerFirstName', label: 'Owner First Name', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.ownerFirstName' },
  { key: 'personal.ownerLastName', label: 'Owner Last Name', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.ownerLastName' },
  { key: 'personal.ownerDOB', label: 'Owner Date of Birth', category: 'Personal Information', inputType: 'date', required: true, extractionPath: 'personal.ownerDOB' },
  { key: 'personal.maritalStatus', label: 'Marital Status', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.maritalStatus' },
  { key: 'personal.streetAddress', label: 'Street Address', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.streetAddress' },
  { key: 'personal.city', label: 'City', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.city' },
  { key: 'personal.state', label: 'State', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.state' },
  { key: 'personal.zipCode', label: 'ZIP Code', category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.zipCode' },
  { key: 'personal.phone', label: 'Phone', category: 'Personal Information', inputType: 'tel', required: true, extractionPath: 'personal.phone' },
  { key: 'personal.ownerDriversLicense', label: "Owner Driver's License", category: 'Personal Information', inputType: 'text', required: true, extractionPath: 'personal.ownerDriversLicense' },
  { key: 'personal.garagingAddressSameAsMailing', label: 'Garaging Address Same as Mailing', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.garagingAddressSameAsMailing', options: ['Yes', 'No'] },
  { key: 'personal.rideShare', label: 'Ride Share Driver (Uber/Lyft)', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.rideShare', options: ['Yes', 'No'] },
  { key: 'personal.delivery', label: 'Delivery Driver (DoorDash/Instacart)', category: 'Personal Information', inputType: 'select', required: true, extractionPath: 'personal.delivery', options: ['Yes', 'No'] },

  // Coverage - Required
  { key: 'coverage.bodilyInjury', label: 'Bodily Injury (BI)', category: 'Coverage', inputType: 'select', required: true, extractionPath: 'coverage.bodilyInjury' },
  { key: 'coverage.propertyDamage', label: 'Property Damage (PD)', category: 'Coverage', inputType: 'select', required: true, extractionPath: 'coverage.propertyDamage' },
]

const autoOptionalFields: FieldDefinition[] = [
  // Personal - Spouse Info (Conditional)
  { key: 'personal.spouseFirstName', label: 'Spouse First Name', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.spouseFirstName' },
  { key: 'personal.spouseLastName', label: 'Spouse Last Name', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.spouseLastName' },
  { key: 'personal.spouseDOB', label: 'Spouse Date of Birth', category: 'Personal Information', inputType: 'date', required: false, extractionPath: 'personal.spouseDOB' },
  { key: 'personal.spouseDriversLicense', label: "Spouse Driver's License", category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.spouseDriversLicense' },
  { key: 'personal.spouseLicenseState', label: 'Spouse License State', category: 'Personal Information', inputType: 'select', required: false, extractionPath: 'personal.spouseLicenseState' },
  { key: 'personal.spouseOccupation', label: 'Spouse Occupation', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.spouseOccupation' },
  { key: 'personal.spouseEducation', label: 'Spouse Education', category: 'Personal Information', inputType: 'select', required: false, extractionPath: 'personal.spouseEducation' },

  // Personal - Optional
  { key: 'personal.email', label: 'Email', category: 'Personal Information', inputType: 'email', required: false, extractionPath: 'personal.email' },
  { key: 'personal.ownerLicenseState', label: 'Owner License State', category: 'Personal Information', inputType: 'select', required: false, extractionPath: 'personal.ownerLicenseState' },
  { key: 'personal.ownerOccupation', label: 'Owner Occupation', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.ownerOccupation' },
  { key: 'personal.ownerEducation', label: 'Owner Education', category: 'Personal Information', inputType: 'select', required: false, extractionPath: 'personal.ownerEducation' },
  { key: 'personal.yearsAtCurrentAddress', label: 'Years at Current Address', category: 'Personal Information', inputType: 'number', required: false, extractionPath: 'personal.yearsAtCurrentAddress' },

  // Garaging Address (Conditional)
  { key: 'personal.garagingStreetAddress', label: 'Garaging Street Address', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.garagingStreetAddress' },
  { key: 'personal.garagingCity', label: 'Garaging City', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.garagingCity' },
  { key: 'personal.garagingState', label: 'Garaging State', category: 'Personal Information', inputType: 'select', required: false, extractionPath: 'personal.garagingState' },
  { key: 'personal.garagingZipCode', label: 'Garaging ZIP Code', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.garagingZipCode' },

  // Prior Address (Conditional)
  { key: 'personal.priorStreetAddress', label: 'Prior Street Address', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.priorStreetAddress' },
  { key: 'personal.priorCity', label: 'Prior City', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.priorCity' },
  { key: 'personal.priorState', label: 'Prior State', category: 'Personal Information', inputType: 'select', required: false, extractionPath: 'personal.priorState' },
  { key: 'personal.priorZipCode', label: 'Prior ZIP Code', category: 'Personal Information', inputType: 'text', required: false, extractionPath: 'personal.priorZipCode' },

  // Coverage - Optional
  { key: 'coverage.uninsuredMotorist', label: 'Uninsured Motorist (UM)', category: 'Coverage', inputType: 'select', required: false, extractionPath: 'coverage.uninsuredMotorist' },
  { key: 'coverage.underinsuredMotorist', label: 'Underinsured Motorist (UIM)', category: 'Coverage', inputType: 'select', required: false, extractionPath: 'coverage.underinsuredMotorist' },
  { key: 'coverage.medicalPayments', label: 'Medical Payments (MED)', category: 'Coverage', inputType: 'select', required: false, extractionPath: 'coverage.medicalPayments' },
  { key: 'coverage.offRoadVehicleLiability', label: 'Off-Road Vehicle Liability', category: 'Coverage', inputType: 'select', required: false, extractionPath: 'coverage.offRoadVehicleLiability', options: ['Yes', 'No'] },
  { key: 'coverage.towing', label: 'Towing', category: 'Coverage', inputType: 'select', required: false, extractionPath: 'coverage.towing', options: ['Yes', 'No'] },
  { key: 'coverage.rental', label: 'Rental Reimbursement', category: 'Coverage', inputType: 'select', required: false, extractionPath: 'coverage.rental', options: ['Yes', 'No'] },

  // Prior Insurance
  { key: 'priorInsurance.insuranceCompany', label: 'Prior Insurance Company', category: 'Prior Insurance', inputType: 'text', required: false, extractionPath: 'priorInsurance.insuranceCompany' },
  { key: 'priorInsurance.policyNumber', label: 'Prior Policy Number', category: 'Prior Insurance', inputType: 'text', required: false, extractionPath: 'priorInsurance.policyNumber' },
  { key: 'priorInsurance.premium', label: 'Prior Premium', category: 'Prior Insurance', inputType: 'text', required: false, extractionPath: 'priorInsurance.premium' },
  { key: 'priorInsurance.expirationDate', label: 'Policy Expiration Date', category: 'Prior Insurance', inputType: 'date', required: false, extractionPath: 'priorInsurance.expirationDate' },
]

// Legacy field definitions for backward compatibility
const legacyRequiredFields: FieldDefinition[] = [
  { key: 'firstName', label: 'First Name', category: 'Personal', inputType: 'text', required: true, extractionPath: 'personal.firstName' },
  { key: 'lastName', label: 'Last Name', category: 'Personal', inputType: 'text', required: true, extractionPath: 'personal.lastName' },
  { key: 'dateOfBirth', label: 'Date of Birth', category: 'Personal', inputType: 'date', required: true, extractionPath: 'personal.dateOfBirth' },
  { key: 'address', label: 'Street Address', category: 'Personal', inputType: 'text', required: true, extractionPath: 'personal.address' },
  { key: 'city', label: 'City', category: 'Personal', inputType: 'text', required: true, extractionPath: 'personal.city' },
  { key: 'state', label: 'State', category: 'Personal', inputType: 'text', required: true, extractionPath: 'personal.state' },
  { key: 'zipCode', label: 'ZIP Code', category: 'Personal', inputType: 'text', required: true, extractionPath: 'personal.zipCode' },
  { key: 'phone', label: 'Phone', category: 'Personal', inputType: 'tel', required: true, extractionPath: 'personal.phone' },
  { key: 'email', label: 'Email', category: 'Personal', inputType: 'email', required: true, extractionPath: 'personal.email' },
]

const legacyOptionalFields: FieldDefinition[] = [
  { key: 'ssn', label: 'SSN', category: 'Personal', inputType: 'text', required: false, extractionPath: 'personal.ssn' },
  { key: 'employer', label: 'Employer', category: 'Employment', inputType: 'text', required: false, extractionPath: 'employment.employer' },
  { key: 'occupation', label: 'Occupation', category: 'Employment', inputType: 'text', required: false, extractionPath: 'employment.occupation' },
  { key: 'income', label: 'Annual Income', category: 'Employment', inputType: 'number', required: false, extractionPath: 'employment.income' },
  { key: 'yearsEmployed', label: 'Years Employed', category: 'Employment', inputType: 'number', required: false, extractionPath: 'employment.yearsEmployed' },
]

// =============================================================================
// Type Detection Utilities
// =============================================================================

/**
 * Detects the type of extraction data structure
 */
export type ExtractedDataType = 'home' | 'auto' | 'combined' | 'combined_ui' | 'legacy'

export function detectExtractionType(
  data: HomeExtractionResult | AutoExtractionResult | ExtractionResult | CombinedExtractionData | HomeApiExtractionResult | AutoApiExtractionResult | unknown
): ExtractedDataType {
  if (!data || typeof data !== 'object') {
    return 'legacy'
  }

  const obj = data as Record<string, unknown>

  // Check for CombinedUiExtractionData (UI format with home/auto objects, NOT shared)
  // This must be checked BEFORE the API combined format
  if ('quoteType' in obj && obj.quoteType === 'both' && ('home' in obj || 'auto' in obj) && !('shared' in obj)) {
    return 'combined_ui'
  }

  // Check for CombinedExtractionData (API format with shared object)
  if ('quoteType' in obj && 'shared' in obj) {
    return 'combined'
  }

  // Check for Home extraction structure (has property, safetyRisk, updates)
  if ('property' in obj && 'safetyRisk' in obj && 'insuranceDetails' in obj) {
    return 'home'
  }

  // Check for Auto extraction structure (has vehicles, additionalDrivers, priorInsurance)
  if ('vehicles' in obj && 'additionalDrivers' in obj && 'priorInsurance' in obj) {
    return 'auto'
  }

  // Check for API home structure
  if ('property' in obj && 'safety' in obj && 'lienholder' in obj) {
    return 'home'
  }

  // Check for API auto structure
  if ('vehicles' in obj && 'deductibles' in obj && 'lienholders' in obj) {
    return 'auto'
  }

  // Default to legacy
  return 'legacy'
}

// =============================================================================
// Field Definition Getters
// =============================================================================

function getFieldDefinitions(
  quoteType: QuoteType,
  extractedDataType: ExtractedDataType
): {
  required: FieldDefinition[]
  optional: FieldDefinition[]
} {
  // For 'both' quote type, combine home and auto
  if (quoteType === 'both') {
    return {
      required: [...homeRequiredFields, ...autoRequiredFields.filter(f =>
        !homeRequiredFields.some(hf => hf.key === f.key)
      )],
      optional: [...homeOptionalFields, ...autoOptionalFields.filter(f =>
        !homeOptionalFields.some(hf => hf.key === f.key)
      )],
    }
  }

  // Use appropriate field definitions based on extracted data type
  if (extractedDataType === 'home' || quoteType === 'home') {
    return { required: homeRequiredFields, optional: homeOptionalFields }
  }

  if (extractedDataType === 'auto' || quoteType === 'auto') {
    return { required: autoRequiredFields, optional: autoOptionalFields }
  }

  // Legacy fallback
  return { required: legacyRequiredFields, optional: legacyOptionalFields }
}

// =============================================================================
// Field Extraction Utilities
// =============================================================================

function getFieldFromExtraction(
  extractionData: Record<string, unknown>,
  path: string
): ExtractionField | null {
  const parts = path.split('.')
  let current: unknown = extractionData

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return null
    }
  }

  // Handle boolean fields (convert to string representation)
  if (current && typeof current === 'object' && 'value' in current) {
    const field = current as ExtractionField | { value: boolean | null; confidence: string; flagged: boolean }
    if (typeof field.value === 'boolean') {
      return {
        value: field.value ? 'Yes' : 'No',
        confidence: field.confidence as 'high' | 'medium' | 'low',
        flagged: field.flagged,
        rawText: (field as ExtractionField).rawText,
      }
    }
    return current as ExtractionField
  }

  return null
}

function determineFieldStatus(
  field: ExtractionField | null,
  required: boolean
): FieldValidationStatus {
  if (!field || field.value === null || field.value === '') {
    return required ? 'missing' : 'valid'
  }
  // Could add more validation logic here
  return 'valid'
}

function transformToUIField(
  definition: FieldDefinition,
  extractionData: Record<string, unknown>
): UIFieldValidation {
  const extractedField = getFieldFromExtraction(extractionData, definition.extractionPath)

  return {
    key: definition.key,
    label: definition.label,
    value: extractedField?.value || null,
    status: determineFieldStatus(extractedField, definition.required),
    confidence: (extractedField?.confidence || 'low') as ConfidenceLevel,
    flagged: extractedField?.flagged || false,
    rawText: extractedField?.rawText,
    inputType: definition.inputType,
    options: definition.options,
    required: definition.required,
    category: definition.category,
  }
}

// =============================================================================
// Array Field Extraction Helpers
// =============================================================================

interface ArrayFieldConfig {
  arrayPath: string
  category: string
  itemLabel: string
  fields: Record<string, AutoFieldConfig>
}

const AUTO_ARRAY_CONFIGS: ArrayFieldConfig[] = [
  {
    arrayPath: 'vehicles',
    category: 'Vehicles',
    itemLabel: 'Vehicle',
    fields: AUTO_VEHICLE_FIELDS,
  },
  {
    arrayPath: 'additionalDrivers',
    category: 'Additional Drivers',
    itemLabel: 'Driver',
    fields: AUTO_DRIVER_FIELDS,
  },
  {
    arrayPath: 'deductibles',
    category: 'Deductibles',
    itemLabel: 'Deductible',
    fields: AUTO_DEDUCTIBLE_FIELDS,
  },
  {
    arrayPath: 'lienholders',
    category: 'Lienholders',
    itemLabel: 'Lienholder',
    fields: AUTO_LIENHOLDER_FIELDS,
  },
  {
    arrayPath: 'accidentsOrTickets',
    category: 'Accidents & Tickets',
    itemLabel: 'Incident',
    fields: AUTO_ACCIDENT_TICKET_FIELDS,
  },
]

function extractArrayFields(
  data: Record<string, unknown>,
  config: ArrayFieldConfig
): UIFieldValidation[] {
  const array = data[config.arrayPath] as Array<Record<string, ExtractionField | ExtractionBooleanField>> | undefined
  if (!array || !Array.isArray(array) || array.length === 0) {
    return []
  }

  const fields: UIFieldValidation[] = []

  array.forEach((item, index) => {
    const itemNumber = index + 1
    Object.entries(config.fields).forEach(([fieldKey, fieldConfig]) => {
      const extractedField = item[fieldKey]
      let value: string | null = null
      let confidence: ConfidenceLevel = 'low'
      let flagged = false
      let rawText: string | undefined

      if (extractedField && typeof extractedField === 'object' && 'value' in extractedField) {
        const ef = extractedField as ExtractionField | ExtractionBooleanField
        if (typeof ef.value === 'boolean') {
          value = ef.value ? 'Yes' : 'No'
        } else {
          value = ef.value
        }
        confidence = ef.confidence as ConfidenceLevel
        flagged = ef.flagged
        rawText = (ef as ExtractionField).rawText
      }

      fields.push({
        key: `${config.arrayPath}[${index}].${fieldKey}`,
        label: `${config.itemLabel} ${itemNumber} - ${fieldConfig.label}`,
        value,
        status: determineFieldStatus(extractedField ? { value, confidence, flagged } as ExtractionField : null, fieldConfig.required),
        confidence,
        flagged,
        rawText,
        inputType: convertInputType(fieldConfig.inputType),
        options: fieldConfig.options,
        required: fieldConfig.required,
        category: `${config.category} - ${config.itemLabel} ${itemNumber}`,
      })
    })
  })

  return fields
}

// =============================================================================
// Main Transform Function
// =============================================================================

export function transformExtractionToValidation(
  extractionData: HomeExtractionResult | AutoExtractionResult | ExtractionResult | CombinedExtractionData | unknown,
  quoteType: QuoteType
): UIValidationResult {
  const dataType = detectExtractionType(extractionData)
  const { required, optional } = getFieldDefinitions(quoteType, dataType)

  // Cast to Record for field access
  const rawData = extractionData as Record<string, unknown>

  // For combined_ui data type, we need to access fields from home/auto sub-objects
  // based on the field's category (home fields from data.home, auto fields from data.auto)
  let homeData: Record<string, unknown> | undefined
  let autoData: Record<string, unknown> | undefined

  if (dataType === 'combined_ui') {
    homeData = rawData.home as Record<string, unknown>
    autoData = rawData.auto as Record<string, unknown>
  }

  // Pre-compute sets of field keys for quick lookup
  const homeFieldKeys = new Set([
    ...homeRequiredFields.map(f => f.key),
    ...homeOptionalFields.map(f => f.key)
  ])
  const autoFieldKeys = new Set([
    ...autoRequiredFields.map(f => f.key),
    ...autoOptionalFields.map(f => f.key)
  ])

  // Helper function to get the correct data source for a field based on its key
  const getDataForField = (def: FieldDefinition): Record<string, unknown> => {
    if (dataType === 'combined_ui') {
      // Check if this field belongs to home or auto based on field definition lists
      if (autoFieldKeys.has(def.key) && autoData) {
        return autoData
      }
      if (homeFieldKeys.has(def.key) && homeData) {
        return homeData
      }
      // Fallback: try to infer from extraction path patterns
      // Auto-specific patterns: ownerFirstName, vehicles, additionalDrivers, etc.
      const path = def.extractionPath
      const isAutoPath =
        path.includes('ownerFirstName') ||
        path.includes('ownerLastName') ||
        path.includes('ownerDOB') ||
        path.includes('ownerDriversLicense') ||
        path.includes('garagingAddress') ||
        path.includes('rideShare') ||
        path.includes('delivery') ||
        path.startsWith('vehicles') ||
        path.startsWith('additionalDrivers') ||
        path.startsWith('lienholders') ||
        path.startsWith('accidentsOrTickets') ||
        path.startsWith('priorInsurance')

      if (isAutoPath && autoData) {
        return autoData
      }
      if (!isAutoPath && homeData) {
        return homeData
      }
    }
    return rawData
  }

  // Transform scalar fields
  const requiredFields = required.map((def) =>
    transformToUIField(def, getDataForField(def))
  )
  let optionalFields = optional.map((def) =>
    transformToUIField(def, getDataForField(def))
  )

  // For auto extractions, also extract array fields (vehicles, drivers, etc.)
  // Use autoData for combined_ui type, or rawData otherwise
  const autoSource = dataType === 'combined_ui' && autoData ? autoData : rawData
  if (dataType === 'auto' || dataType === 'combined_ui' || quoteType === 'auto' || quoteType === 'both') {
    const arrayFields: UIFieldValidation[] = []
    for (const config of AUTO_ARRAY_CONFIGS) {
      const extracted = extractArrayFields(autoSource, config)
      arrayFields.push(...extracted)
    }
    // Separate required and optional array fields
    const requiredArrayFields = arrayFields.filter(f => f.required)
    const optionalArrayFields = arrayFields.filter(f => !f.required)

    // Add to the respective lists
    requiredFields.push(...requiredArrayFields)
    optionalFields = [...optionalFields, ...optionalArrayFields]
  }

  // For home extractions, extract claims history and scheduled items if present
  // Use homeData for combined_ui type, or rawData otherwise
  const homeSource = dataType === 'combined_ui' && homeData ? homeData : rawData
  if (dataType === 'home' || dataType === 'combined_ui' || quoteType === 'home' || quoteType === 'both') {
    const claimsHistory = homeSource.claimsHistory as { claims?: Array<Record<string, ExtractionField>> } | undefined
    if (claimsHistory?.claims && Array.isArray(claimsHistory.claims)) {
      claimsHistory.claims.forEach((claim, index) => {
        const claimNumber = index + 1
        Object.entries(claim).forEach(([fieldKey, field]) => {
          if (field && typeof field === 'object' && 'value' in field) {
            optionalFields.push({
              key: `claimsHistory.claims[${index}].${fieldKey}`,
              label: `Claim ${claimNumber} - ${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}`,
              value: field.value,
              status: determineFieldStatus(field, false),
              confidence: (field.confidence || 'low') as ConfidenceLevel,
              flagged: field.flagged || false,
              rawText: field.rawText,
              inputType: 'text',
              required: false,
              category: `Claims History - Claim ${claimNumber}`,
            })
          }
        })
      })
    }

    // Extract scheduled items (jewelry, valuables)
    const scheduledItems = homeSource.scheduledItems as {
      jewelry?: Array<Record<string, ExtractionField>>,
      otherValuables?: Array<Record<string, ExtractionField>>
    } | undefined
    if (scheduledItems?.jewelry && Array.isArray(scheduledItems.jewelry)) {
      scheduledItems.jewelry.forEach((item, index) => {
        const itemNumber = index + 1
        Object.entries(item).forEach(([fieldKey, field]) => {
          if (field && typeof field === 'object' && 'value' in field) {
            optionalFields.push({
              key: `scheduledItems.jewelry[${index}].${fieldKey}`,
              label: `Jewelry ${itemNumber} - ${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}`,
              value: field.value,
              status: determineFieldStatus(field, false),
              confidence: (field.confidence || 'low') as ConfidenceLevel,
              flagged: field.flagged || false,
              rawText: field.rawText,
              inputType: 'text',
              required: false,
              category: `Scheduled Items - Jewelry ${itemNumber}`,
            })
          }
        })
      })
    }
    if (scheduledItems?.otherValuables && Array.isArray(scheduledItems.otherValuables)) {
      scheduledItems.otherValuables.forEach((item, index) => {
        const itemNumber = index + 1
        Object.entries(item).forEach(([fieldKey, field]) => {
          if (field && typeof field === 'object' && 'value' in field) {
            optionalFields.push({
              key: `scheduledItems.otherValuables[${index}].${fieldKey}`,
              label: `Valuable ${itemNumber} - ${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}`,
              value: field.value,
              status: determineFieldStatus(field, false),
              confidence: (field.confidence || 'low') as ConfidenceLevel,
              flagged: field.flagged || false,
              rawText: field.rawText,
              inputType: 'text',
              required: false,
              category: `Scheduled Items - Valuable ${itemNumber}`,
            })
          }
        })
      })
    }
  }

  // Flagged fields from all sources
  const flaggedFields = [...requiredFields, ...optionalFields].filter(
    (field) => field.flagged || field.confidence === 'low'
  )

  const completedRequired = requiredFields.filter(
    (field) => field.status === 'valid' && field.value !== null
  ).length
  const totalRequired = requiredFields.length

  return {
    isValid: completedRequired === totalRequired,
    requiredFields,
    optionalFields,
    flaggedFields,
    totalRequired,
    completedRequired,
    completionPercentage: totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 100,
  }
}

export function updateFieldInValidation(
  validationResult: UIValidationResult,
  fieldKey: string,
  newValue: string
): UIValidationResult {
  const updateField = (fields: UIFieldValidation[]): UIFieldValidation[] =>
    fields.map((field) =>
      field.key === fieldKey
        ? {
            ...field,
            value: newValue,
            status: newValue.trim() ? 'valid' : field.required ? 'missing' : 'valid',
            confidence: 'high' as ConfidenceLevel,
            flagged: false,
          }
        : field
    )

  const newRequiredFields = updateField(validationResult.requiredFields)
  const newOptionalFields = updateField(validationResult.optionalFields)

  // Recalculate flagged fields
  const newFlaggedFields = [...newRequiredFields, ...newOptionalFields].filter(
    (field) => field.flagged || field.confidence === 'low'
  )

  const completedRequired = newRequiredFields.filter(
    (field) => field.status === 'valid' && field.value !== null && field.value.trim() !== ''
  ).length

  return {
    ...validationResult,
    requiredFields: newRequiredFields,
    optionalFields: newOptionalFields,
    flaggedFields: newFlaggedFields,
    completedRequired,
    isValid: completedRequired === validationResult.totalRequired,
    completionPercentage: validationResult.totalRequired > 0
      ? Math.round((completedRequired / validationResult.totalRequired) * 100)
      : 100,
  }
}

// =============================================================================
// Array Field Helpers (for Vehicles, Drivers, etc.)
// =============================================================================

export interface VehicleValidationItem {
  index: number
  displayName: string
  year: string | null
  make: string | null
  model: string | null
  vin: string | null
  isComplete: boolean
  hasErrors: boolean
}

export interface DriverValidationItem {
  index: number
  displayName: string
  firstName: string | null
  lastName: string | null
  dateOfBirth: string | null
  licenseNumber: string | null
  isComplete: boolean
  hasErrors: boolean
}

export function extractVehicles(
  data: AutoExtractionResult | Record<string, unknown>
): VehicleValidationItem[] {
  const vehicles = (data as { vehicles?: Array<Record<string, ExtractionField>> }).vehicles || []

  return vehicles.map((vehicle, index) => {
    const year = vehicle.year?.value || null
    const make = vehicle.make?.value || null
    const model = vehicle.model?.value || null
    const vin = vehicle.vin?.value || null

    const displayName = [year, make, model].filter(Boolean).join(' ') || `Vehicle ${index + 1}`
    const isComplete = Boolean(year && make && model && vin)
    const hasErrors = Boolean(
      vehicle.year?.flagged ||
      vehicle.make?.flagged ||
      vehicle.model?.flagged ||
      vehicle.vin?.flagged
    )

    return {
      index,
      displayName,
      year,
      make,
      model,
      vin,
      isComplete,
      hasErrors,
    }
  })
}

export function extractDrivers(
  data: AutoExtractionResult | Record<string, unknown>
): DriverValidationItem[] {
  const drivers = (data as { additionalDrivers?: Array<Record<string, ExtractionField>> }).additionalDrivers || []

  return drivers.map((driver, index) => {
    const firstName = driver.firstName?.value || null
    const lastName = driver.lastName?.value || null
    const dateOfBirth = driver.dateOfBirth?.value || null
    const licenseNumber = driver.licenseNumber?.value || null

    const displayName = [firstName, lastName].filter(Boolean).join(' ') || `Driver ${index + 1}`
    const isComplete = Boolean(firstName && lastName && dateOfBirth && licenseNumber)
    const hasErrors = Boolean(
      driver.firstName?.flagged ||
      driver.lastName?.flagged ||
      driver.dateOfBirth?.flagged ||
      driver.licenseNumber?.flagged
    )

    return {
      index,
      displayName,
      firstName,
      lastName,
      dateOfBirth,
      licenseNumber,
      isComplete,
      hasErrors,
    }
  })
}
