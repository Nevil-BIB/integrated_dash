/**
 * Confidence Aggregation Utilities
 * Calculate confidence scores and completion metrics for array fields
 */

import type { ExtractionField } from '@/types/extraction'
import type {
  ConfidenceLevel,
  ConfidenceAggregation,
  SectionConfidence,
  ItemConfidence,
  ArrayFieldItem,
} from './types'

// =============================================================================
// Confidence Calculation
// =============================================================================

/**
 * Calculate the overall confidence level based on individual field counts
 */
export function calculateOverallConfidence(
  highCount: number,
  mediumCount: number,
  lowCount: number
): ConfidenceLevel {
  const total = highCount + mediumCount + lowCount

  if (total === 0) return 'low'

  const highPercentage = highCount / total
  const lowPercentage = lowCount / total

  // If more than 70% are high confidence, overall is high
  if (highPercentage >= 0.7) return 'high'

  // If more than 30% are low confidence, overall is low
  if (lowPercentage >= 0.3) return 'low'

  // Otherwise, it's medium
  return 'medium'
}

/**
 * Get confidence weight for sorting/prioritization
 */
export function getConfidenceWeight(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
  }
}

/**
 * Compare two confidence levels
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareConfidence(a: ConfidenceLevel, b: ConfidenceLevel): number {
  return getConfidenceWeight(a) - getConfidenceWeight(b)
}

// =============================================================================
// Field Aggregation
// =============================================================================

/**
 * Aggregate confidence from a set of extraction fields
 */
export function aggregateFieldConfidence(
  fields: Record<string, ExtractionField>
): ConfidenceAggregation {
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  let flaggedCount = 0
  let completedCount = 0

  const fieldEntries = Object.entries(fields)

  for (const [, field] of fieldEntries) {
    // Count by confidence level
    switch (field.confidence) {
      case 'high':
        highCount++
        break
      case 'medium':
        mediumCount++
        break
      case 'low':
        lowCount++
        break
    }

    // Count flagged fields
    if (field.flagged) {
      flaggedCount++
    }

    // Count completed (non-null, non-empty) fields
    if (field.value !== null && field.value !== '') {
      completedCount++
    }
  }

  const totalFields = fieldEntries.length
  const completionPercentage = totalFields > 0
    ? Math.round((completedCount / totalFields) * 100)
    : 0

  return {
    overall: calculateOverallConfidence(highCount, mediumCount, lowCount),
    highCount,
    mediumCount,
    lowCount,
    totalFields,
    flaggedCount,
    completedCount,
    completionPercentage,
  }
}

/**
 * Aggregate confidence from an array of extraction fields
 */
export function aggregateFieldArrayConfidence(
  fields: ExtractionField[]
): ConfidenceAggregation {
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  let flaggedCount = 0
  let completedCount = 0

  for (const field of fields) {
    switch (field.confidence) {
      case 'high':
        highCount++
        break
      case 'medium':
        mediumCount++
        break
      case 'low':
        lowCount++
        break
    }

    if (field.flagged) {
      flaggedCount++
    }

    if (field.value !== null && field.value !== '') {
      completedCount++
    }
  }

  const totalFields = fields.length
  const completionPercentage = totalFields > 0
    ? Math.round((completedCount / totalFields) * 100)
    : 0

  return {
    overall: calculateOverallConfidence(highCount, mediumCount, lowCount),
    highCount,
    mediumCount,
    lowCount,
    totalFields,
    flaggedCount,
    completedCount,
    completionPercentage,
  }
}

// =============================================================================
// Item-Level Aggregation
// =============================================================================

/**
 * Extract all ExtractionField values from an item
 */
export function extractFieldsFromItem<T extends ArrayFieldItem>(
  item: T
): ExtractionField[] {
  const fields: ExtractionField[] = []

  for (const [key, value] of Object.entries(item)) {
    if (key === 'id') continue

    // Check if the value is an ExtractionField
    if (
      value &&
      typeof value === 'object' &&
      'confidence' in value &&
      'flagged' in value
    ) {
      fields.push(value as ExtractionField)
    }
  }

  return fields
}

/**
 * Calculate confidence for a single array item
 */
export function calculateItemConfidence<T extends ArrayFieldItem>(
  item: T,
  labelGenerator: (item: T) => string
): ItemConfidence {
  const fields = extractFieldsFromItem(item)
  const confidence = aggregateFieldArrayConfidence(fields)

  return {
    itemId: item.id,
    itemLabel: labelGenerator(item),
    confidence,
  }
}

/**
 * Calculate confidence for all items in an array
 */
export function calculateArrayConfidence<T extends ArrayFieldItem>(
  items: T[],
  labelGenerator: (item: T) => string
): {
  overall: ConfidenceAggregation
  items: ItemConfidence[]
} {
  const itemConfidences = items.map(item =>
    calculateItemConfidence(item, labelGenerator)
  )

  // Aggregate all item confidences
  let totalHigh = 0
  let totalMedium = 0
  let totalLow = 0
  let totalFlagged = 0
  let totalCompleted = 0
  let totalFields = 0

  itemConfidences.forEach(({ confidence }) => {
    totalHigh += confidence.highCount
    totalMedium += confidence.mediumCount
    totalLow += confidence.lowCount
    totalFlagged += confidence.flaggedCount
    totalCompleted += confidence.completedCount
    totalFields += confidence.totalFields
  })

  const overall: ConfidenceAggregation = {
    overall: calculateOverallConfidence(totalHigh, totalMedium, totalLow),
    highCount: totalHigh,
    mediumCount: totalMedium,
    lowCount: totalLow,
    totalFields,
    flaggedCount: totalFlagged,
    completedCount: totalCompleted,
    completionPercentage: totalFields > 0
      ? Math.round((totalCompleted / totalFields) * 100)
      : 0,
  }

  return {
    overall,
    items: itemConfidences,
  }
}

// =============================================================================
// Section-Level Aggregation
// =============================================================================

/**
 * Calculate confidence for a section containing an array of items
 */
export function calculateSectionConfidence<T extends ArrayFieldItem>(
  sectionKey: string,
  sectionLabel: string,
  items: T[],
  labelGenerator: (item: T) => string
): SectionConfidence {
  const { overall, items: itemConfidences } = calculateArrayConfidence(
    items,
    labelGenerator
  )

  return {
    sectionKey,
    sectionLabel,
    confidence: overall,
    items: itemConfidences,
  }
}

// =============================================================================
// Required Fields Tracking
// =============================================================================

interface RequiredFieldStatus {
  fieldKey: string
  isComplete: boolean
  confidence: ConfidenceLevel
  flagged: boolean
}

/**
 * Check completion status of required fields in an item
 */
export function checkRequiredFields<T extends ArrayFieldItem>(
  item: T,
  requiredFieldKeys: (keyof T)[]
): {
  allComplete: boolean
  completedCount: number
  totalRequired: number
  fields: RequiredFieldStatus[]
} {
  const fields: RequiredFieldStatus[] = []
  let completedCount = 0

  for (const key of requiredFieldKeys) {
    const field = item[key] as ExtractionField | undefined

    if (field && typeof field === 'object' && 'value' in field) {
      const isComplete = field.value !== null && field.value !== ''

      fields.push({
        fieldKey: String(key),
        isComplete,
        confidence: field.confidence,
        flagged: field.flagged,
      })

      if (isComplete) {
        completedCount++
      }
    }
  }

  return {
    allComplete: completedCount === requiredFieldKeys.length,
    completedCount,
    totalRequired: requiredFieldKeys.length,
    fields,
  }
}

/**
 * Check completion status across all items in an array
 */
export function checkArrayRequiredFields<T extends ArrayFieldItem>(
  items: T[],
  requiredFieldKeys: (keyof T)[]
): {
  allItemsComplete: boolean
  itemsComplete: number
  totalItems: number
  overallCompletedFields: number
  overallTotalFields: number
  completionPercentage: number
} {
  let itemsComplete = 0
  let overallCompletedFields = 0
  let overallTotalFields = 0

  for (const item of items) {
    const { allComplete, completedCount, totalRequired } = checkRequiredFields(
      item,
      requiredFieldKeys
    )

    if (allComplete) {
      itemsComplete++
    }

    overallCompletedFields += completedCount
    overallTotalFields += totalRequired
  }

  return {
    allItemsComplete: itemsComplete === items.length,
    itemsComplete,
    totalItems: items.length,
    overallCompletedFields,
    overallTotalFields,
    completionPercentage: overallTotalFields > 0
      ? Math.round((overallCompletedFields / overallTotalFields) * 100)
      : 100,
  }
}

// =============================================================================
// Flagged Field Utilities
// =============================================================================

/**
 * Get all flagged fields from an item
 */
export function getFlaggedFields<T extends ArrayFieldItem>(
  item: T
): { fieldKey: string; field: ExtractionField }[] {
  const flaggedFields: { fieldKey: string; field: ExtractionField }[] = []

  for (const [key, value] of Object.entries(item)) {
    if (key === 'id') continue

    if (
      value &&
      typeof value === 'object' &&
      'flagged' in value &&
      (value as ExtractionField).flagged
    ) {
      flaggedFields.push({
        fieldKey: key,
        field: value as ExtractionField,
      })
    }
  }

  return flaggedFields
}

/**
 * Count total flagged fields across an array of items
 */
export function countFlaggedFields<T extends ArrayFieldItem>(
  items: T[]
): number {
  let count = 0

  for (const item of items) {
    count += getFlaggedFields(item).length
  }

  return count
}

/**
 * Get all items that have flagged fields
 */
export function getItemsWithFlaggedFields<T extends ArrayFieldItem>(
  items: T[]
): T[] {
  return items.filter(item => getFlaggedFields(item).length > 0)
}

// =============================================================================
// Low Confidence Field Utilities
// =============================================================================

/**
 * Get all low confidence fields from an item
 */
export function getLowConfidenceFields<T extends ArrayFieldItem>(
  item: T
): { fieldKey: string; field: ExtractionField }[] {
  const lowConfidenceFields: { fieldKey: string; field: ExtractionField }[] = []

  for (const [key, value] of Object.entries(item)) {
    if (key === 'id') continue

    if (
      value &&
      typeof value === 'object' &&
      'confidence' in value &&
      (value as ExtractionField).confidence === 'low'
    ) {
      lowConfidenceFields.push({
        fieldKey: key,
        field: value as ExtractionField,
      })
    }
  }

  return lowConfidenceFields
}

/**
 * Count total low confidence fields across an array of items
 */
export function countLowConfidenceFields<T extends ArrayFieldItem>(
  items: T[]
): number {
  let count = 0

  for (const item of items) {
    count += getLowConfidenceFields(item).length
  }

  return count
}

/**
 * Get items sorted by number of issues (flagged + low confidence)
 * Items with more issues come first (for review prioritization)
 */
export function sortItemsByIssueCount<T extends ArrayFieldItem>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aIssues = getFlaggedFields(a).length + getLowConfidenceFields(a).length
    const bIssues = getFlaggedFields(b).length + getLowConfidenceFields(b).length
    return bIssues - aIssues // Descending order (most issues first)
  })
}
