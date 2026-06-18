/**
 * Extraction result merging utilities
 *
 * These functions merge partial extraction results from multi-page documents
 * into complete extraction results, prioritizing higher confidence values.
 */

import {
  ExtractionResult,
  ExtractionField,
  ExtractionBooleanField,
  HomeApiExtractionResult,
  AutoApiExtractionResult,
  AutoVehicle,
  AutoAdditionalDriver,
  AutoVehicleLienholder,
  AutoAccidentOrTicket,
} from '@/types/extraction'

import {
  createDefaultHomeApiExtractionResult,
  createDefaultAutoApiExtractionResult,
  createDefaultExtractionResult,
} from './defaults'

// =============================================================================
// Confidence Utilities
// =============================================================================

type ConfidenceLevel = 'high' | 'medium' | 'low'

/**
 * Get confidence rank for comparison (higher is better)
 */
export function confidenceRank(confidence: ConfidenceLevel): number {
  return { high: 3, medium: 2, low: 1 }[confidence]
}

/**
 * Check if a new field should replace an existing field based on confidence
 */
export function shouldReplaceField(
  existing: ExtractionField | ExtractionBooleanField,
  incoming: ExtractionField | ExtractionBooleanField
): boolean {
  // Replace if existing is flagged or has no value
  if (existing.flagged || existing.value === null) {
    return true
  }
  // Replace if incoming has higher confidence
  return confidenceRank(incoming.confidence) > confidenceRank(existing.confidence)
}

// =============================================================================
// Type-safe field accessors
// =============================================================================

/**
 * Type guard to check if a value is an extraction field
 */
function isExtractionField(value: unknown): value is ExtractionField | ExtractionBooleanField {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return 'confidence' in obj && 'flagged' in obj && 'value' in obj
}

/**
 * Safely get a field from a category object using runtime check
 */
function getFieldValue(
  category: Record<string, unknown>,
  field: string
): ExtractionField | ExtractionBooleanField | undefined {
  const value = category[field]
  return isExtractionField(value) ? value : undefined
}

/**
 * Safely set a field on a category object
 */
function setFieldValue(
  category: Record<string, unknown>,
  field: string,
  value: ExtractionField | ExtractionBooleanField
): void {
  category[field] = value
}

// =============================================================================
// Home Extraction Merging
// =============================================================================

/**
 * Merge partial Home extraction results into a complete result
 */
export function mergeHomeApiExtractionResults(
  partials: Partial<HomeApiExtractionResult>[]
): HomeApiExtractionResult {
  const result = createDefaultHomeApiExtractionResult()

  for (const partial of partials) {
    // Iterate over each category in the partial result
    const categories = Object.keys(partial) as (keyof HomeApiExtractionResult)[]

    for (const category of categories) {
      const partialCategory = partial[category]
      if (!partialCategory) continue

      const resultCategory = result[category] as unknown as Record<string, unknown>
      const partialCategoryRecord = partialCategory as unknown as Record<string, unknown>
      const fields = Object.keys(partialCategoryRecord)

      for (const field of fields) {
        const partialField = getFieldValue(partialCategoryRecord, field)
        if (!partialField || partialField.value === null) continue

        const existingField = getFieldValue(resultCategory, field)
        if (existingField && shouldReplaceField(existingField, partialField)) {
          setFieldValue(resultCategory, field, partialField)
        }
      }
    }
  }

  return result
}

// =============================================================================
// Auto Extraction Merging
// =============================================================================

/**
 * Check if two vehicles are duplicates based on VIN
 */
function isVehicleDuplicate(existing: AutoVehicle, incoming: AutoVehicle): boolean {
  return (
    existing.vin?.value === incoming.vin?.value &&
    incoming.vin?.value !== null
  )
}

/**
 * Check if two drivers are duplicates based on license number
 */
function isDriverDuplicate(existing: AutoAdditionalDriver, incoming: AutoAdditionalDriver): boolean {
  return (
    existing.licenseNumber?.value === incoming.licenseNumber?.value &&
    incoming.licenseNumber?.value !== null
  )
}

/**
 * Check if two lienholders are duplicates based on vehicle reference
 */
function isLienholderDuplicate(
  existing: AutoVehicleLienholder,
  incoming: AutoVehicleLienholder
): boolean {
  return (
    existing.vehicleReference?.value === incoming.vehicleReference?.value &&
    incoming.vehicleReference?.value !== null
  )
}

/**
 * Check if two accidents/tickets are duplicates based on date and driver
 */
function isIncidentDuplicate(
  existing: AutoAccidentOrTicket,
  incoming: AutoAccidentOrTicket
): boolean {
  return (
    existing.date?.value === incoming.date?.value &&
    existing.driverName?.value === incoming.driverName?.value &&
    incoming.date?.value !== null
  )
}

/**
 * Merge partial Auto extraction results into a complete result
 * Handles both object fields (personal, coverage, priorInsurance) and array fields
 */
export function mergeAutoApiExtractionResults(
  partials: Partial<AutoApiExtractionResult>[]
): AutoApiExtractionResult {
  const result = createDefaultAutoApiExtractionResult()

  // Object fields to merge
  const objectFields: (keyof AutoApiExtractionResult)[] = ['personal', 'coverage', 'priorInsurance']

  for (const partial of partials) {
    // Merge object fields
    for (const category of objectFields) {
      const partialCategory = partial[category]
      if (!partialCategory) continue

      const resultCategory = result[category] as unknown as Record<string, unknown>
      const partialCategoryRecord = partialCategory as unknown as Record<string, unknown>
      const fields = Object.keys(partialCategoryRecord)

      for (const field of fields) {
        const partialField = getFieldValue(partialCategoryRecord, field)
        if (!partialField || partialField.value === null) continue

        const existingField = getFieldValue(resultCategory, field)
        if (existingField && shouldReplaceField(existingField, partialField)) {
          setFieldValue(resultCategory, field, partialField)
        }
      }
    }

    // Merge vehicles array (dedupe by VIN)
    if (partial.vehicles && Array.isArray(partial.vehicles)) {
      for (const vehicle of partial.vehicles) {
        const isDuplicate = result.vehicles.some(existing => isVehicleDuplicate(existing, vehicle))
        if (!isDuplicate) {
          result.vehicles.push(vehicle)
        }
      }
    }

    // Merge additionalDrivers array (dedupe by license number)
    if (partial.additionalDrivers && Array.isArray(partial.additionalDrivers)) {
      for (const driver of partial.additionalDrivers) {
        const isDuplicate = result.additionalDrivers.some(existing => isDriverDuplicate(existing, driver))
        if (!isDuplicate) {
          result.additionalDrivers.push(driver)
        }
      }
    }

    // Merge lienholders array (dedupe by vehicle reference)
    if (partial.lienholders && Array.isArray(partial.lienholders)) {
      for (const lienholder of partial.lienholders) {
        const isDuplicate = result.lienholders.some(
          existing => isLienholderDuplicate(existing, lienholder)
        )
        if (!isDuplicate) {
          result.lienholders.push(lienholder)
        }
      }
    }

    // Merge accidentsOrTickets array (dedupe by date and driver)
    if (partial.accidentsOrTickets && Array.isArray(partial.accidentsOrTickets)) {
      for (const incident of partial.accidentsOrTickets) {
        const isDuplicate = result.accidentsOrTickets.some(
          existing => isIncidentDuplicate(existing, incident)
        )
        if (!isDuplicate) {
          result.accidentsOrTickets.push(incident)
        }
      }
    }
  }

  return result
}

// =============================================================================
// Legacy Extraction Merging
// =============================================================================

/**
 * Merge partial extraction results into a complete result (legacy)
 */
export function mergeExtractionResults(
  partials: Partial<ExtractionResult>[]
): ExtractionResult {
  const result = createDefaultExtractionResult()

  for (const partial of partials) {
    const categories = Object.keys(partial) as (keyof ExtractionResult)[]

    for (const category of categories) {
      const partialCategory = partial[category]
      if (!partialCategory) continue

      const resultCategory = result[category] as unknown as Record<string, unknown>
      const partialCategoryRecord = partialCategory as unknown as Record<string, unknown>
      const fields = Object.keys(partialCategoryRecord)

      for (const field of fields) {
        const partialField = getFieldValue(partialCategoryRecord, field)
        if (!partialField || partialField.value === null) continue

        const existingField = getFieldValue(resultCategory, field)
        if (existingField && shouldReplaceField(existingField, partialField)) {
          setFieldValue(resultCategory, field, partialField)
        }
      }
    }
  }

  return result
}
