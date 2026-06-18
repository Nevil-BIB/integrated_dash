/**
 * Cross-Field Validation Utilities
 * Validation functions for array field data including VIN, coverage limits, and more
 */

import type { ExtractionField } from '@/types/extraction'
import type {
  VehicleData,
  DriverData,
  DeductibleData,
  ClaimData,
  AccidentData,
  ScheduledItemData,
  ArrayFieldValidation,
  ArrayFieldValidationError,
} from './types'

// =============================================================================
// VIN Validation
// =============================================================================

/**
 * Characters not allowed in VINs (I, O, Q)
 */
const VIN_INVALID_CHARS = /[IOQ]/i

/**
 * Valid VIN character pattern (17 alphanumeric, no I/O/Q)
 */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i

/**
 * Validate VIN format
 * - Must be 17 characters
 * - Must be alphanumeric
 * - Cannot contain I, O, or Q
 */
export function validateVin(vin: string | null | undefined): {
  isValid: boolean
  error?: string
} {
  if (!vin) {
    return { isValid: true } // VIN is optional, empty is valid
  }

  const cleanVin = vin.toUpperCase().replace(/[\s-]/g, '')

  if (cleanVin.length !== 17) {
    return {
      isValid: false,
      error: `VIN must be 17 characters (got ${cleanVin.length})`,
    }
  }

  if (VIN_INVALID_CHARS.test(cleanVin)) {
    return {
      isValid: false,
      error: 'VIN cannot contain letters I, O, or Q',
    }
  }

  if (!VIN_PATTERN.test(cleanVin)) {
    return {
      isValid: false,
      error: 'VIN must contain only letters (A-Z, except I, O, Q) and numbers',
    }
  }

  return { isValid: true }
}

/**
 * Normalize a VIN to standard format
 */
export function normalizeVin(vin: string): string {
  return vin.toUpperCase().replace(/[\s-]/g, '')
}

// =============================================================================
// Coverage Limits Validation
// =============================================================================

/**
 * Pattern for split coverage limits (e.g., "250/500", "100/300/100")
 */
const COVERAGE_LIMITS_PATTERN = /^\d{1,4}\/\d{1,4}(\/\d{1,4})?$/

/**
 * Pattern for single coverage limits (e.g., "$500,000" or "500000")
 */
const SINGLE_LIMIT_PATTERN = /^\$?\d{1,3}(,\d{3})*$/

/**
 * Validate coverage limits format
 * Accepts: "250/500", "100/300/100", "$500,000", "500000"
 */
export function validateCoverageLimits(limits: string | null | undefined): {
  isValid: boolean
  error?: string
} {
  if (!limits) {
    return { isValid: true } // Empty is valid (optional field)
  }

  const cleanLimits = limits.replace(/\s/g, '')

  if (COVERAGE_LIMITS_PATTERN.test(cleanLimits)) {
    return { isValid: true }
  }

  if (SINGLE_LIMIT_PATTERN.test(cleanLimits)) {
    return { isValid: true }
  }

  return {
    isValid: false,
    error: 'Coverage limits must be in format "250/500" or "$500,000"',
  }
}

/**
 * Parse split coverage limits into individual values
 */
export function parseCoverageLimits(limits: string): {
  bodily?: number
  property?: number
  uninsured?: number
} {
  const parts = limits.split('/').map(p => parseInt(p, 10))

  if (parts.length === 2) {
    return {
      bodily: parts[0] * 1000,
      property: parts[1] * 1000,
    }
  }

  if (parts.length === 3) {
    return {
      bodily: parts[0] * 1000,
      property: parts[1] * 1000,
      uninsured: parts[2] * 1000,
    }
  }

  return {}
}

// =============================================================================
// Date Validation
// =============================================================================

/**
 * Pattern for MM/DD/YYYY date format
 */
const DATE_PATTERN_MMDDYYYY = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/

/**
 * Pattern for YYYY-MM-DD date format
 */
const DATE_PATTERN_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * Validate date format (accepts MM/DD/YYYY or YYYY-MM-DD)
 */
export function validateDate(date: string | null | undefined): {
  isValid: boolean
  error?: string
  parsedDate?: Date
} {
  if (!date) {
    return { isValid: true } // Empty is valid for optional fields
  }

  const cleanDate = date.trim()

  let year: number
  let month: number
  let day: number

  if (DATE_PATTERN_MMDDYYYY.test(cleanDate)) {
    const parts = cleanDate.split('/')
    month = parseInt(parts[0], 10)
    day = parseInt(parts[1], 10)
    year = parseInt(parts[2], 10)
  } else if (DATE_PATTERN_ISO.test(cleanDate)) {
    const parts = cleanDate.split('-')
    year = parseInt(parts[0], 10)
    month = parseInt(parts[1], 10)
    day = parseInt(parts[2], 10)
  } else {
    return {
      isValid: false,
      error: 'Date must be in MM/DD/YYYY or YYYY-MM-DD format',
    }
  }

  // Validate the actual date
  const parsedDate = new Date(year, month - 1, day)
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return {
      isValid: false,
      error: 'Invalid date',
    }
  }

  return { isValid: true, parsedDate }
}

/**
 * Validate that a date is not in the future
 */
export function validateDateNotFuture(date: string | null | undefined): {
  isValid: boolean
  error?: string
} {
  const result = validateDate(date)
  if (!result.isValid) return result

  if (result.parsedDate && result.parsedDate > new Date()) {
    return {
      isValid: false,
      error: 'Date cannot be in the future',
    }
  }

  return { isValid: true }
}

/**
 * Validate that a date is within a certain range (years ago)
 */
export function validateDateWithinYears(
  date: string | null | undefined,
  years: number
): {
  isValid: boolean
  error?: string
} {
  const result = validateDate(date)
  if (!result.isValid) return result

  if (result.parsedDate) {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - years)

    if (result.parsedDate < cutoff) {
      return {
        isValid: false,
        error: `Date must be within the last ${years} years`,
      }
    }
  }

  return { isValid: true }
}

// =============================================================================
// Required Field Validation
// =============================================================================

/**
 * Check if an extraction field has a value
 */
export function hasValue(field: ExtractionField): boolean {
  return field.value !== null && field.value !== undefined && field.value.trim() !== ''
}

/**
 * Validate required fields on a vehicle
 */
export function validateVehicleRequired(vehicle: VehicleData): {
  isValid: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []

  if (!hasValue(vehicle.year)) missingFields.push('year')
  if (!hasValue(vehicle.make)) missingFields.push('make')
  if (!hasValue(vehicle.model)) missingFields.push('model')

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Validate required fields on a driver
 */
export function validateDriverRequired(driver: DriverData): {
  isValid: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []

  if (!hasValue(driver.firstName)) missingFields.push('firstName')
  if (!hasValue(driver.lastName)) missingFields.push('lastName')
  if (!hasValue(driver.dateOfBirth)) missingFields.push('dateOfBirth')
  if (!hasValue(driver.licenseNumber)) missingFields.push('licenseNumber')

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}

// =============================================================================
// Array Minimum Requirements Validation
// =============================================================================

/**
 * Validate that at least one vehicle is present for auto quotes
 */
export function validateMinimumVehicles(
  vehicles: VehicleData[],
  minimum: number = 1
): {
  isValid: boolean
  error?: string
} {
  if (vehicles.length < minimum) {
    return {
      isValid: false,
      error: `At least ${minimum} vehicle${minimum > 1 ? 's' : ''} required`,
    }
  }

  return { isValid: true }
}

/**
 * Validate that at least one driver is present for auto quotes
 * Note: Owner/spouse count as drivers even if not in the drivers array
 */
export function validateMinimumDrivers(
  drivers: DriverData[],
  hasOwner: boolean = false,
  hasSpouse: boolean = false,
  minimum: number = 1
): {
  isValid: boolean
  error?: string
} {
  const totalDrivers = drivers.length + (hasOwner ? 1 : 0) + (hasSpouse ? 1 : 0)

  if (totalDrivers < minimum) {
    return {
      isValid: false,
      error: `At least ${minimum} driver${minimum > 1 ? 's' : ''} required`,
    }
  }

  return { isValid: true }
}

// =============================================================================
// Complete Array Field Validation
// =============================================================================

/**
 * Validate all items in a vehicle array
 */
export function validateVehicleArray(vehicles: VehicleData[]): ArrayFieldValidation {
  const errors: ArrayFieldValidationError[] = []
  let requiredFieldsComplete = 0
  let totalRequiredFields = 0

  vehicles.forEach(vehicle => {
    totalRequiredFields += 3 // year, make, model are required

    // Year validation
    if (!hasValue(vehicle.year)) {
      errors.push({
        itemId: vehicle.id,
        field: 'year',
        message: 'Year is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }

    // Make validation
    if (!hasValue(vehicle.make)) {
      errors.push({
        itemId: vehicle.id,
        field: 'make',
        message: 'Make is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }

    // Model validation
    if (!hasValue(vehicle.model)) {
      errors.push({
        itemId: vehicle.id,
        field: 'model',
        message: 'Model is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }

    // VIN validation (optional but must be valid if provided)
    if (vehicle.vin.value) {
      const vinResult = validateVin(vehicle.vin.value)
      if (!vinResult.isValid) {
        errors.push({
          itemId: vehicle.id,
          field: 'vin',
          message: vinResult.error || 'Invalid VIN',
          severity: 'warning',
        })
      }
    }
  })

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    requiredFieldsComplete,
    totalRequiredFields,
    completionPercentage: totalRequiredFields > 0
      ? Math.round((requiredFieldsComplete / totalRequiredFields) * 100)
      : 100,
  }
}

/**
 * Validate all items in a driver array
 */
export function validateDriverArray(drivers: DriverData[]): ArrayFieldValidation {
  const errors: ArrayFieldValidationError[] = []
  let requiredFieldsComplete = 0
  let totalRequiredFields = 0

  drivers.forEach(driver => {
    totalRequiredFields += 4 // firstName, lastName, dob, license are required

    // First name validation
    if (!hasValue(driver.firstName)) {
      errors.push({
        itemId: driver.id,
        field: 'firstName',
        message: 'First name is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }

    // Last name validation
    if (!hasValue(driver.lastName)) {
      errors.push({
        itemId: driver.id,
        field: 'lastName',
        message: 'Last name is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }

    // Date of birth validation
    if (!hasValue(driver.dateOfBirth)) {
      errors.push({
        itemId: driver.id,
        field: 'dateOfBirth',
        message: 'Date of birth is required',
        severity: 'error',
      })
    } else {
      const dobResult = validateDateNotFuture(driver.dateOfBirth.value)
      if (!dobResult.isValid) {
        errors.push({
          itemId: driver.id,
          field: 'dateOfBirth',
          message: dobResult.error || 'Invalid date of birth',
          severity: 'error',
        })
      } else {
        requiredFieldsComplete++
      }
    }

    // License number validation
    if (!hasValue(driver.licenseNumber)) {
      errors.push({
        itemId: driver.id,
        field: 'licenseNumber',
        message: 'License number is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }
  })

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    requiredFieldsComplete,
    totalRequiredFields,
    completionPercentage: totalRequiredFields > 0
      ? Math.round((requiredFieldsComplete / totalRequiredFields) * 100)
      : 100,
  }
}

/**
 * Validate deductible entries have valid vehicle references
 */
export function validateDeductibleArray(
  deductibles: DeductibleData[],
  validVehicleIds: Set<string>
): ArrayFieldValidation {
  const errors: ArrayFieldValidationError[] = []
  let requiredFieldsComplete = 0
  let totalRequiredFields = 0

  deductibles.forEach(deductible => {
    totalRequiredFields += 1 // vehicleRef is required

    // Vehicle reference validation
    const vehicleRef = deductible.vehicleRef.value
    if (!vehicleRef) {
      errors.push({
        itemId: deductible.id,
        field: 'vehicleRef',
        message: 'Vehicle reference is required',
        severity: 'error',
      })
    } else if (!validVehicleIds.has(vehicleRef)) {
      errors.push({
        itemId: deductible.id,
        field: 'vehicleRef',
        message: 'Invalid vehicle reference',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }
  })

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    requiredFieldsComplete,
    totalRequiredFields,
    completionPercentage: totalRequiredFields > 0
      ? Math.round((requiredFieldsComplete / totalRequiredFields) * 100)
      : 100,
  }
}

/**
 * Validate claims have required fields
 */
export function validateClaimArray(claims: ClaimData[]): ArrayFieldValidation {
  const errors: ArrayFieldValidationError[] = []
  let requiredFieldsComplete = 0
  let totalRequiredFields = 0

  claims.forEach(claim => {
    totalRequiredFields += 2 // date and type are required

    // Date validation
    if (!hasValue(claim.date)) {
      errors.push({
        itemId: claim.id,
        field: 'date',
        message: 'Claim date is required',
        severity: 'error',
      })
    } else {
      const dateResult = validateDate(claim.date.value)
      if (!dateResult.isValid) {
        errors.push({
          itemId: claim.id,
          field: 'date',
          message: dateResult.error || 'Invalid date',
          severity: 'error',
        })
      } else {
        requiredFieldsComplete++
      }
    }

    // Type validation
    if (!hasValue(claim.type)) {
      errors.push({
        itemId: claim.id,
        field: 'type',
        message: 'Claim type is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }
  })

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    requiredFieldsComplete,
    totalRequiredFields,
    completionPercentage: totalRequiredFields > 0
      ? Math.round((requiredFieldsComplete / totalRequiredFields) * 100)
      : 100,
  }
}

/**
 * Validate accidents have required fields and valid driver references
 */
export function validateAccidentArray(
  accidents: AccidentData[],
  validDriverIds: Set<string>
): ArrayFieldValidation {
  const errors: ArrayFieldValidationError[] = []
  let requiredFieldsComplete = 0
  let totalRequiredFields = 0

  accidents.forEach(accident => {
    totalRequiredFields += 2 // date and type are required

    // Date validation
    if (!hasValue(accident.date)) {
      errors.push({
        itemId: accident.id,
        field: 'date',
        message: 'Accident date is required',
        severity: 'error',
      })
    } else {
      const dateResult = validateDateWithinYears(accident.date.value, 5)
      if (!dateResult.isValid) {
        errors.push({
          itemId: accident.id,
          field: 'date',
          message: dateResult.error || 'Invalid date',
          severity: 'warning',
        })
      } else {
        requiredFieldsComplete++
      }
    }

    // Type validation
    if (!hasValue(accident.type)) {
      errors.push({
        itemId: accident.id,
        field: 'type',
        message: 'Accident type is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }

    // Driver reference validation (optional but must be valid if provided)
    const driverRef = accident.driverRef.value
    if (driverRef && !validDriverIds.has(driverRef)) {
      errors.push({
        itemId: accident.id,
        field: 'driverRef',
        message: 'Invalid driver reference',
        severity: 'warning',
      })
    }
  })

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    requiredFieldsComplete,
    totalRequiredFields,
    completionPercentage: totalRequiredFields > 0
      ? Math.round((requiredFieldsComplete / totalRequiredFields) * 100)
      : 100,
  }
}

/**
 * Validate scheduled items have required fields
 */
export function validateScheduledItemArray(items: ScheduledItemData[]): ArrayFieldValidation {
  const errors: ArrayFieldValidationError[] = []
  let requiredFieldsComplete = 0
  let totalRequiredFields = 0

  items.forEach(item => {
    totalRequiredFields += 2 // description and value are required

    // Description validation
    if (!hasValue(item.description)) {
      errors.push({
        itemId: item.id,
        field: 'description',
        message: 'Item description is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }

    // Value validation
    if (!hasValue(item.value)) {
      errors.push({
        itemId: item.id,
        field: 'value',
        message: 'Item value is required',
        severity: 'error',
      })
    } else {
      requiredFieldsComplete++
    }
  })

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    requiredFieldsComplete,
    totalRequiredFields,
    completionPercentage: totalRequiredFields > 0
      ? Math.round((requiredFieldsComplete / totalRequiredFields) * 100)
      : 100,
  }
}
