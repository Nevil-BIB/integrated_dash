/**
 * Auto Insurance Extraction Types
 * Type definitions for auto insurance quote data extraction
 *
 * This file provides UI-friendly types and field configurations that align with
 * the API types defined in extraction.ts (AutoApiExtractionResult and related interfaces).
 */

import {
  ExtractionField,
  ExtractionBooleanField,
  AutoPersonalInfo,
  AutoAdditionalDriver,
  AutoVehicle,
  AutoCoverageInfo,
  AutoVehicleDeductible,
  AutoVehicleLienholder,
  AutoPriorInsurance,
  AutoAccidentOrTicket,
  AutoApiExtractionResult,
} from './extraction'

// =============================================================================
// Field Configuration Types
// =============================================================================

export type AutoFieldInputType = 'text' | 'select' | 'date' | 'tel' | 'email' | 'number' | 'textarea' | 'checkbox'

export interface AutoFieldConfig {
  label: string
  inputType: AutoFieldInputType
  required: boolean
  options?: string[]
  placeholder?: string
  maxLength?: number
  pattern?: string
  validation?: {
    pattern?: RegExp
    minLength?: number
    maxLength?: number
    message?: string
  }
}

// =============================================================================
// US States Constant
// =============================================================================

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
] as const

// =============================================================================
// Re-export API types for convenience
// =============================================================================

export type {
  AutoPersonalInfo,
  AutoAdditionalDriver,
  AutoVehicle,
  AutoCoverageInfo,
  AutoVehicleDeductible,
  AutoVehicleLienholder,
  AutoPriorInsurance,
  AutoAccidentOrTicket,
  AutoApiExtractionResult,
}

// =============================================================================
// UI Extraction Result Type (mirrors API type for UI usage)
// =============================================================================

/**
 * UI-friendly Auto Extraction Result
 * Note: Deductibles are now embedded in each vehicle in the vehicles array.
 */
export interface AutoExtractionResult {
  personal: AutoPersonalInfo
  additionalDrivers: AutoAdditionalDriver[]
  vehicles: AutoVehicle[]
  coverage: AutoCoverageInfo
  lienholders: AutoVehicleLienholder[]
  priorInsurance: AutoPriorInsurance
  accidentsOrTickets: AutoAccidentOrTicket[]
}

// =============================================================================
// Field Configuration Maps - Personal Information
// =============================================================================

export const MARITAL_STATUS_OPTIONS = [
  'Single',
  'Married',
  'Divorced',
  'Widowed',
  'Separated',
  'Domestic Partner',
] as const

export const AUTO_PERSONAL_FIELDS: Record<keyof AutoPersonalInfo, AutoFieldConfig> = {
  // Policy effective date
  effectiveDate: { label: 'Policy Effective Date', inputType: 'date', required: true, placeholder: 'MM/DD/YYYY' },

  // Owner basic info
  ownerFirstName: { label: 'Owner First Name', inputType: 'text', required: true },
  ownerLastName: { label: 'Owner Last Name', inputType: 'text', required: true },
  ownerDOB: { label: 'Owner Date of Birth', inputType: 'date', required: true },
  maritalStatus: { label: 'Marital Status', inputType: 'select', required: true, options: [...MARITAL_STATUS_OPTIONS] },

  // Spouse info (conditional: only if maritalStatus is Married or Domestic Partner)
  spouseFirstName: { label: 'Spouse First Name', inputType: 'text', required: false },
  spouseLastName: { label: 'Spouse Last Name', inputType: 'text', required: false },
  spouseDOB: { label: 'Spouse Date of Birth', inputType: 'date', required: false },

  // Current Address
  streetAddress: { label: 'Street Address', inputType: 'text', required: true },
  city: { label: 'City', inputType: 'text', required: true },
  state: { label: 'State', inputType: 'select', required: true, options: [...US_STATES] },
  zipCode: { label: 'ZIP Code', inputType: 'text', required: true, pattern: '^\\d{5}(-\\d{4})?$' },

  // Garaging address (conditional: if different from mailing)
  garagingAddressSameAsMailing: { label: 'Garaging Address Same as Mailing', inputType: 'select', required: true, options: ['Yes', 'No'] },
  garagingStreetAddress: { label: 'Garaging Street Address', inputType: 'text', required: false },
  garagingCity: { label: 'Garaging City', inputType: 'text', required: false },
  garagingState: { label: 'Garaging State', inputType: 'select', required: false, options: [...US_STATES] },
  garagingZipCode: { label: 'Garaging ZIP Code', inputType: 'text', required: false, pattern: '^\\d{5}(-\\d{4})?$' },

  // Prior Address (conditional: required if < 5 years at current)
  yearsAtCurrentAddress: { label: 'Years at Current Address', inputType: 'number', required: false },
  priorStreetAddress: { label: 'Prior Street Address', inputType: 'text', required: false, placeholder: 'Required if less than 5 years at current' },
  priorCity: { label: 'Prior City', inputType: 'text', required: false },
  priorState: { label: 'Prior State', inputType: 'select', required: false, options: [...US_STATES] },
  priorZipCode: { label: 'Prior ZIP Code', inputType: 'text', required: false },

  // Contact info
  phone: { label: 'Phone', inputType: 'tel', required: true, placeholder: '(XXX) XXX-XXXX' },
  email: { label: 'Email', inputType: 'email', required: false },

  // Auto-specific personal fields
  ownerDriversLicense: { label: "Owner Driver's License", inputType: 'text', required: true },
  ownerLicenseState: { label: 'Owner License State', inputType: 'select', required: false, options: [...US_STATES] },
  spouseDriversLicense: { label: "Spouse Driver's License", inputType: 'text', required: false },
  spouseLicenseState: { label: 'Spouse License State', inputType: 'select', required: false, options: [...US_STATES] },
  ownerOccupation: { label: 'Owner Occupation', inputType: 'text', required: false },
  spouseOccupation: { label: 'Spouse Occupation', inputType: 'text', required: false },
  ownerEducation: { label: 'Owner Education', inputType: 'select', required: false, options: [
    'Less than High School', 'High School', 'Some College', 'Associate\'s Degree',
    'Bachelor\'s Degree', 'Master\'s Degree', 'Doctorate', 'Other'
  ]},
  spouseEducation: { label: 'Spouse Education', inputType: 'select', required: false, options: [
    'Less than High School', 'High School', 'Some College', 'Associate\'s Degree',
    'Bachelor\'s Degree', 'Master\'s Degree', 'Doctorate', 'Other'
  ]},
  rideShare: { label: 'Ride Share Driver (Uber/Lyft)', inputType: 'select', required: true, options: ['Yes', 'No'] },
  delivery: { label: 'Delivery Driver (DoorDash/Instacart)', inputType: 'select', required: true, options: ['Yes', 'No'] },
}

// =============================================================================
// Field Configuration Maps - Additional Drivers
// =============================================================================

export const AUTO_DRIVER_FIELDS: Record<keyof AutoAdditionalDriver, AutoFieldConfig> = {
  firstName: { label: 'First Name', inputType: 'text', required: true },
  lastName: { label: 'Last Name', inputType: 'text', required: true },
  dateOfBirth: { label: 'Date of Birth', inputType: 'date', required: true },
  licenseNumber: { label: 'License Number', inputType: 'text', required: true },
  licenseState: { label: 'License State', inputType: 'select', required: false, options: [...US_STATES] },
  relationship: { label: 'Relationship', inputType: 'select', required: false, options: [
    'Spouse', 'Child', 'Parent', 'Sibling', 'Other Relative', 'Employee', 'Other'
  ]},
  goodStudentDiscount: { label: 'Good Student Discount (GSD)', inputType: 'select', required: false, options: ['Yes', 'No'] },
  vehicleAssigned: { label: 'Vehicle Assigned', inputType: 'text', required: false, placeholder: 'e.g., Vehicle 1' },
}

// =============================================================================
// Field Configuration Maps - Vehicles (includes deductibles)
// =============================================================================

export const AUTO_VEHICLE_FIELDS: Record<keyof AutoVehicle, AutoFieldConfig> = {
  // Vehicle identification
  year: { label: 'Year', inputType: 'number', required: true, placeholder: 'YYYY' },
  make: { label: 'Make', inputType: 'text', required: true, placeholder: 'e.g., Toyota' },
  model: { label: 'Model', inputType: 'text', required: true, placeholder: 'e.g., Camry' },
  vin: { label: 'VIN', inputType: 'text', required: true, maxLength: 17, placeholder: '17 characters', validation: {
    pattern: /^[A-HJ-NPR-Z0-9]{17}$/i,
    minLength: 17,
    maxLength: 17,
    message: 'VIN must be exactly 17 characters (letters and numbers, excluding I, O, Q)'
  }},
  estimatedMileage: { label: 'Estimated Annual Mileage', inputType: 'number', required: false },
  vehicleUsage: { label: 'Vehicle Usage', inputType: 'select', required: false, options: [
    'Pleasure', 'Commute', 'Business', 'Farm'
  ]},
  ownership: { label: 'Ownership', inputType: 'select', required: false, options: [
    'Owned', 'Financed', 'Leased'
  ]},
  // Deductibles (per-vehicle)
  comprehensiveDeductible: { label: 'Comprehensive Deductible', inputType: 'select', required: true, options: [
    'Liability Only', '0', '100', '250', '500', '1000', '2500'
  ]},
  collisionDeductible: { label: 'Collision Deductible', inputType: 'select', required: true, options: [
    'Liability Only', '0', '100', '250', '500', '1000', '2500'
  ]},
  roadTroubleService: { label: 'Road Trouble Service', inputType: 'select', required: false, options: [
    'None', '$25', '$50', '$75', '$100'
  ]},
  limitedTNCCoverage: { label: 'Limited TNC Coverage', inputType: 'select', required: false, options: ['Yes', 'No'] },
  additionalExpenseCoverage: { label: 'Additional Expense Coverage', inputType: 'select', required: false, options: [
    'None', '$15/day', '$20/day', '$25/day', '$30/day'
  ]},
}

// =============================================================================
// Field Configuration Maps - Coverage
// =============================================================================

export const AUTO_COVERAGE_FIELDS: Record<keyof AutoCoverageInfo, AutoFieldConfig> = {
  bodilyInjury: { label: 'Bodily Injury (BI)', inputType: 'select', required: true, options: [
    '15/30', '25/50', '50/100', '100/300', '250/500', '300/300', '500/500', '1000/1000'
  ]},
  propertyDamage: { label: 'Property Damage (PD)', inputType: 'select', required: true, options: [
    '10', '15', '25', '50', '100', '250', '500'
  ]},
  uninsuredMotorist: { label: 'Uninsured Motorist (UM)', inputType: 'select', required: false, options: [
    'Reject', '15/30', '25/50', '50/100', '100/300', '250/500'
  ]},
  underinsuredMotorist: { label: 'Underinsured Motorist (UIM)', inputType: 'select', required: false, options: [
    'Reject', '15/30', '25/50', '50/100', '100/300', '250/500'
  ]},
  medicalPayments: { label: 'Medical Payments (MED)', inputType: 'select', required: false, options: [
    'Reject', '500', '1000', '2500', '5000', '10000', '25000', '50000', '100000'
  ]},
  offRoadVehicleLiability: { label: 'Off-Road Vehicle Liability', inputType: 'select', required: false, options: ['Yes', 'No'] },
  towing: { label: 'Towing', inputType: 'select', required: false, options: ['Yes', 'No'] },
  rental: { label: 'Rental Reimbursement', inputType: 'select', required: false, options: ['Yes', 'No'] },
}

// =============================================================================
// Field Configuration Maps - Deductibles (DEPRECATED)
// =============================================================================

/**
 * @deprecated Deductible fields are now part of AUTO_VEHICLE_FIELDS.
 * This constant is kept for backward compatibility only.
 */
export const AUTO_DEDUCTIBLE_FIELDS: Record<keyof AutoVehicleDeductible, AutoFieldConfig> = {
  vehicleReference: { label: 'Vehicle', inputType: 'text', required: true, placeholder: 'e.g., Vehicle 1 or 2023 Toyota Camry' },
  comprehensiveDeductible: { label: 'Comprehensive Deductible', inputType: 'select', required: true, options: [
    'Liability Only', '0', '100', '250', '500', '1000', '2500'
  ]},
  collisionDeductible: { label: 'Collision Deductible', inputType: 'select', required: true, options: [
    'Liability Only', '0', '100', '250', '500', '1000', '2500'
  ]},
  roadTroubleService: { label: 'Road Trouble Service', inputType: 'select', required: false, options: [
    'None', '$25', '$50', '$75', '$100'
  ]},
  limitedTNCCoverage: { label: 'Limited TNC Coverage', inputType: 'select', required: false, options: ['Yes', 'No'] },
  additionalExpenseCoverage: { label: 'Additional Expense Coverage', inputType: 'select', required: false, options: [
    'None', '$15/day', '$20/day', '$25/day', '$30/day'
  ]},
}

// =============================================================================
// Field Configuration Maps - Lienholders
// =============================================================================

export const AUTO_LIENHOLDER_FIELDS: Record<keyof AutoVehicleLienholder, AutoFieldConfig> = {
  vehicleReference: { label: 'Vehicle', inputType: 'text', required: true, placeholder: 'Which vehicle' },
  lienholderName: { label: 'Lienholder Name', inputType: 'text', required: false, placeholder: 'Bank/Finance Company' },
  lienholderAddress: { label: 'Lienholder Address', inputType: 'text', required: false },
  lienholderCity: { label: 'Lienholder City', inputType: 'text', required: false },
  lienholderState: { label: 'Lienholder State', inputType: 'select', required: false, options: [...US_STATES] },
  lienholderZip: { label: 'Lienholder ZIP', inputType: 'text', required: false },
}

// =============================================================================
// Field Configuration Maps - Prior Insurance
// =============================================================================

export const AUTO_PRIOR_INSURANCE_FIELDS: Record<keyof AutoPriorInsurance, AutoFieldConfig> = {
  insuranceCompany: { label: 'Prior Insurance Company', inputType: 'text', required: false },
  premium: { label: 'Prior Premium', inputType: 'text', required: false, placeholder: 'e.g., $1,200' },
  policyNumber: { label: 'Prior Policy Number', inputType: 'text', required: false },
  expirationDate: { label: 'Policy Expiration Date', inputType: 'date', required: false },
}

// =============================================================================
// Field Configuration Maps - Accidents & Tickets
// =============================================================================

export const AUTO_ACCIDENT_TICKET_FIELDS: Record<keyof AutoAccidentOrTicket, AutoFieldConfig> = {
  driverName: { label: 'Driver Name', inputType: 'text', required: true },
  date: { label: 'Date', inputType: 'date', required: true },
  type: { label: 'Type', inputType: 'select', required: true, options: [
    'At-Fault Collision', 'Not-At-Fault Collision', 'Comprehensive', 'Speeding Ticket',
    'Other Moving Violation', 'DUI/DWI', 'License Suspension', 'Other'
  ]},
  description: { label: 'Description', inputType: 'text', required: false },
  amount: { label: 'Claim Amount', inputType: 'text', required: false, placeholder: 'e.g., $5,000' },
  atFault: { label: 'At Fault', inputType: 'select', required: true, options: ['Yes', 'No', 'NAF'] },
}

// =============================================================================
// Section Configuration
// =============================================================================

export interface AutoSectionConfig {
  key: string
  title: string
  description: string
  isArray?: boolean
  arrayItemLabel?: string
  minItems?: number
  maxItems?: number
}

export const AUTO_SECTIONS: AutoSectionConfig[] = [
  {
    key: 'personal',
    title: 'Personal Information',
    description: 'Owner and spouse contact details, driver\'s licenses',
  },
  {
    key: 'additionalDrivers',
    title: 'Additional Drivers',
    description: 'Other household drivers to be covered',
    isArray: true,
    arrayItemLabel: 'Driver',
    minItems: 0,
    maxItems: 6,
  },
  {
    key: 'vehicles',
    title: 'Vehicles',
    description: 'Automobiles to be insured (includes deductibles per vehicle)',
    isArray: true,
    arrayItemLabel: 'Vehicle',
    minItems: 1,
    maxItems: 6,
  },
  {
    key: 'coverage',
    title: 'Coverage Information',
    description: 'Liability limits and optional coverages',
  },
  {
    key: 'lienholders',
    title: 'Lienholder Information',
    description: 'Finance company details for each financed/leased vehicle',
    isArray: true,
    arrayItemLabel: 'Lienholder',
    minItems: 0,
    maxItems: 6,
  },
  {
    key: 'priorInsurance',
    title: 'Prior Insurance',
    description: 'Current/expiring insurance policy details',
  },
  {
    key: 'accidentsOrTickets',
    title: 'Accidents & Tickets',
    description: 'Incidents in the last 5 years',
    isArray: true,
    arrayItemLabel: 'Incident',
    minItems: 0,
    maxItems: 10,
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

export function createEmptyBooleanField(value: boolean | null = null): ExtractionBooleanField {
  return {
    value,
    confidence: 'low',
    flagged: value === null,
    rawText: undefined,
  }
}

export function createEmptyAutoDriver(): AutoAdditionalDriver {
  return {
    firstName: createEmptyExtractionField(),
    lastName: createEmptyExtractionField(),
    dateOfBirth: createEmptyExtractionField(),
    licenseNumber: createEmptyExtractionField(),
    licenseState: createEmptyExtractionField(),
    relationship: createEmptyExtractionField(),
    goodStudentDiscount: createEmptyBooleanField(),
    vehicleAssigned: createEmptyExtractionField(),
  }
}

export function createEmptyAutoVehicle(): AutoVehicle {
  return {
    // Vehicle identification
    year: createEmptyExtractionField(),
    make: createEmptyExtractionField(),
    model: createEmptyExtractionField(),
    vin: createEmptyExtractionField(),
    estimatedMileage: createEmptyExtractionField(),
    vehicleUsage: createEmptyExtractionField(),
    ownership: createEmptyExtractionField(),
    // Deductibles (per-vehicle)
    comprehensiveDeductible: createEmptyExtractionField(),
    collisionDeductible: createEmptyExtractionField(),
    roadTroubleService: createEmptyExtractionField(),
    limitedTNCCoverage: createEmptyBooleanField(),
    additionalExpenseCoverage: createEmptyExtractionField(),
  }
}

/**
 * @deprecated Deductibles are now part of AutoVehicle. Use createEmptyAutoVehicle() instead.
 * This function is kept for backward compatibility only.
 */
export function createEmptyAutoDeductible(): AutoVehicleDeductible {
  return {
    vehicleReference: createEmptyExtractionField(),
    comprehensiveDeductible: createEmptyExtractionField(),
    collisionDeductible: createEmptyExtractionField(),
    roadTroubleService: createEmptyExtractionField(),
    limitedTNCCoverage: createEmptyBooleanField(),
    additionalExpenseCoverage: createEmptyExtractionField(),
  }
}

export function createEmptyAutoLienholder(): AutoVehicleLienholder {
  return {
    vehicleReference: createEmptyExtractionField(),
    lienholderName: createEmptyExtractionField(),
    lienholderAddress: createEmptyExtractionField(),
    lienholderCity: createEmptyExtractionField(),
    lienholderState: createEmptyExtractionField(),
    lienholderZip: createEmptyExtractionField(),
  }
}

export function createEmptyAutoPriorInsurance(): AutoPriorInsurance {
  return {
    insuranceCompany: createEmptyExtractionField(),
    premium: createEmptyExtractionField(),
    policyNumber: createEmptyExtractionField(),
    expirationDate: createEmptyExtractionField(),
  }
}

export function createEmptyAutoAccidentOrTicket(): AutoAccidentOrTicket {
  return {
    driverName: createEmptyExtractionField(),
    date: createEmptyExtractionField(),
    type: createEmptyExtractionField(),
    description: createEmptyExtractionField(),
    amount: createEmptyExtractionField(),
    atFault: createEmptyExtractionField(),
  }
}

export function createEmptyAutoPersonal(): AutoPersonalInfo {
  return {
    // Policy info
    effectiveDate: createEmptyExtractionField(),
    // Owner info
    ownerFirstName: createEmptyExtractionField(),
    ownerLastName: createEmptyExtractionField(),
    ownerDOB: createEmptyExtractionField(),
    maritalStatus: createEmptyExtractionField(),
    // Spouse info (conditional)
    spouseFirstName: createEmptyExtractionField(),
    spouseLastName: createEmptyExtractionField(),
    spouseDOB: createEmptyExtractionField(),
    // Current address
    streetAddress: createEmptyExtractionField(),
    city: createEmptyExtractionField(),
    state: createEmptyExtractionField(),
    zipCode: createEmptyExtractionField(),
    // Garaging address (conditional)
    garagingAddressSameAsMailing: createEmptyBooleanField(),
    garagingStreetAddress: createEmptyExtractionField(),
    garagingCity: createEmptyExtractionField(),
    garagingState: createEmptyExtractionField(),
    garagingZipCode: createEmptyExtractionField(),
    // Prior address (conditional)
    yearsAtCurrentAddress: createEmptyExtractionField(),
    priorStreetAddress: createEmptyExtractionField(),
    priorCity: createEmptyExtractionField(),
    priorState: createEmptyExtractionField(),
    priorZipCode: createEmptyExtractionField(),
    // Contact
    phone: createEmptyExtractionField(),
    email: createEmptyExtractionField(),
    // Auto-specific
    ownerDriversLicense: createEmptyExtractionField(),
    ownerLicenseState: createEmptyExtractionField(),
    spouseDriversLicense: createEmptyExtractionField(),
    spouseLicenseState: createEmptyExtractionField(),
    ownerOccupation: createEmptyExtractionField(),
    spouseOccupation: createEmptyExtractionField(),
    ownerEducation: createEmptyExtractionField(),
    spouseEducation: createEmptyExtractionField(),
    rideShare: createEmptyBooleanField(),
    delivery: createEmptyBooleanField(),
  }
}

export function createEmptyAutoCoverage(): AutoCoverageInfo {
  return {
    bodilyInjury: createEmptyExtractionField(),
    propertyDamage: createEmptyExtractionField(),
    uninsuredMotorist: createEmptyExtractionField(),
    underinsuredMotorist: createEmptyExtractionField(),
    medicalPayments: createEmptyExtractionField(),
    offRoadVehicleLiability: createEmptyBooleanField(),
    towing: createEmptyBooleanField(),
    rental: createEmptyBooleanField(),
  }
}

export function createEmptyAutoExtraction(): AutoExtractionResult {
  return {
    personal: createEmptyAutoPersonal(),
    additionalDrivers: [],
    vehicles: [],
    coverage: createEmptyAutoCoverage(),
    lienholders: [],
    priorInsurance: createEmptyAutoPriorInsurance(),
    accidentsOrTickets: [],
  }
}

// =============================================================================
// Vehicle Display Helper
// =============================================================================

export function getVehicleDisplayName(vehicle: AutoVehicle, index: number): string {
  const year = vehicle.year.value || ''
  const make = vehicle.make.value || ''
  const model = vehicle.model.value || ''

  if (year || make || model) {
    return `${year} ${make} ${model}`.trim() || `Vehicle ${index + 1}`
  }
  return `Vehicle ${index + 1}`
}

// =============================================================================
// Driver Display Helper
// =============================================================================

export function getDriverDisplayName(
  personal: AutoPersonalInfo,
  drivers: AutoAdditionalDriver[],
  index: number
): string {
  // Include owner and spouse as driver options
  const allDrivers: string[] = []

  const ownerName = [personal.ownerFirstName.value, personal.ownerLastName.value]
    .filter(Boolean)
    .join(' ')
  if (ownerName) {
    allDrivers.push(ownerName + ' (Owner)')
  }

  const spouseName = [personal.spouseFirstName.value, personal.spouseLastName.value]
    .filter(Boolean)
    .join(' ')
  if (spouseName) {
    allDrivers.push(spouseName + ' (Spouse)')
  }

  // Add additional drivers
  drivers.forEach((driver, i) => {
    const firstName = driver.firstName.value || ''
    const lastName = driver.lastName.value || ''
    const name = `${firstName} ${lastName}`.trim()
    if (name) {
      allDrivers.push(name)
    } else {
      allDrivers.push(`Driver ${i + 1}`)
    }
  })

  return allDrivers[index] || `Driver ${index + 1}`
}

// =============================================================================
// VIN Validation
// =============================================================================

export function validateVIN(vin: string): { isValid: boolean; message?: string } {
  if (!vin) {
    return { isValid: false, message: 'VIN is required' }
  }

  // Remove any whitespace
  const cleanVin = vin.replace(/\s/g, '').toUpperCase()

  if (cleanVin.length !== 17) {
    return { isValid: false, message: `VIN must be 17 characters (currently ${cleanVin.length})` }
  }

  // Check for invalid characters (I, O, Q are not used in VINs)
  if (/[IOQ]/i.test(cleanVin)) {
    return { isValid: false, message: 'VIN cannot contain letters I, O, or Q' }
  }

  // Check that it only contains valid characters
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(cleanVin)) {
    return { isValid: false, message: 'VIN contains invalid characters' }
  }

  return { isValid: true }
}

// =============================================================================
// Coverage Limit Parser
// =============================================================================

export function parseCoverageLimit(limit: string): { perPerson?: number; perAccident?: number; single?: number } {
  if (!limit) return {}

  // Handle split limits like "250/500"
  if (limit.includes('/')) {
    const [perPerson, perAccident] = limit.split('/').map(v => parseInt(v.replace(/[^0-9]/g, ''), 10) * 1000)
    return { perPerson, perAccident }
  }

  // Handle single limits like "100" (for PD)
  const single = parseInt(limit.replace(/[^0-9]/g, ''), 10) * 1000
  return { single }
}

// =============================================================================
// Conversion between API and UI types
// =============================================================================

export function apiToUiAutoExtraction(api: AutoApiExtractionResult): AutoExtractionResult {
  return {
    personal: api.personal,
    additionalDrivers: api.additionalDrivers,
    vehicles: api.vehicles,
    coverage: api.coverage,
    lienholders: api.lienholders,
    priorInsurance: api.priorInsurance,
    accidentsOrTickets: api.accidentsOrTickets,
  }
}

export function uiToApiAutoExtraction(ui: AutoExtractionResult): AutoApiExtractionResult {
  return {
    personal: ui.personal,
    additionalDrivers: ui.additionalDrivers,
    vehicles: ui.vehicles,
    coverage: ui.coverage,
    lienholders: ui.lienholders,
    priorInsurance: ui.priorInsurance,
    accidentsOrTickets: ui.accidentsOrTickets,
  }
}
