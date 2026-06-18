import type { HomeChubbConstructionTypeEntry, HomeExtractionResult } from '@/types/home-extraction'
import type { CarrierProductSchema, CarrierSchemaField } from './schema-types'
import { getFieldBySchemaKey } from './schema-field-access'
import { getAllSchemaFields, getRequiredSchemaFields } from './load-schema'
import type { CarrierOptionId } from './types'
import { getCarrierSchema } from './load-schema'

export function isCarrierFieldVisible(
  field: CarrierSchemaField,
  data: HomeExtractionResult,
  carrierOptionId: CarrierOptionId,
): boolean {
  if (field.key === 'percentRenovated') {
    return getFieldBySchemaKey(data, 'renovated', carrierOptionId).value === 'Yes'
  }
  if (!field.conditionalOn) return true
  const dep = getFieldBySchemaKey(data, field.conditionalOn.key, carrierOptionId)
  if ('notValue' in field.conditionalOn) {
    return dep.value !== field.conditionalOn.notValue
  }
  return dep.value === field.conditionalOn.value
}

export function isCarrierFieldComplete(
  field: CarrierSchemaField,
  data: HomeExtractionResult,
  carrierOptionId: CarrierOptionId,
): boolean {
  if (field.type === 'array') return true
  const value = getFieldBySchemaKey(data, field.key, carrierOptionId).value
  return value != null && String(value).trim() !== ''
}

export interface CarrierValidationResult {
  valid: boolean
  missingFields: Array<{ key: string; label: string }>
  messages?: string[]
}

function parseConstructionPercentage(value: string | null | undefined): number | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed.replace('%', ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getActiveConstructionTypeRows(
  entries: HomeChubbConstructionTypeEntry[],
): HomeChubbConstructionTypeEntry[] {
  return entries.filter((entry) => {
    const hasType = Boolean(entry.constructionType?.value?.trim())
    const hasPercentage = Boolean(entry.percentage?.value?.trim())
    return hasType || hasPercentage
  })
}

export function validateChubbConstructionTypes(
  data: HomeExtractionResult,
): CarrierValidationResult {
  const entries = data.chubbHomeCoverageEstimator?.constructionTypes ?? []
  const activeRows = getActiveConstructionTypeRows(entries)
  const missingFields = [{ key: 'constructionTypes', label: 'Construction Types' }]

  if (activeRows.length < 1) {
    return {
      valid: false,
      missingFields,
      messages: ['Enter at least one construction type with type and percentage.'],
    }
  }

  const hasIncompleteRow = activeRows.some((entry) => {
    const hasType = Boolean(entry.constructionType?.value?.trim())
    const hasPercentage = Boolean(entry.percentage?.value?.trim())
    return !hasType || !hasPercentage
  })
  if (hasIncompleteRow) {
    return {
      valid: false,
      missingFields,
      messages: ['Each construction type row must include both type and percentage.'],
    }
  }

  const totalPercentage = activeRows.reduce((sum, entry) => {
    const parsed = parseConstructionPercentage(entry.percentage?.value)
    return sum + (parsed ?? 0)
  }, 0)

  if (Math.abs(totalPercentage - 100) > 0.001) {
    return {
      valid: false,
      missingFields,
      messages: [
        `Construction type percentages must total 100% (currently ${totalPercentage}%).`,
      ],
    }
  }

  return { valid: true, missingFields: [] }
}

export function validateCarrierRequiredFields(
  data: HomeExtractionResult,
  schema: CarrierProductSchema,
  carrierOptionId: CarrierOptionId,
): CarrierValidationResult {
  const missingFields: Array<{ key: string; label: string }> = []

  for (const field of getRequiredSchemaFields(schema)) {
    if (field.type === 'array') continue
    if (!isCarrierFieldVisible(field, data, carrierOptionId)) continue
    if (!isCarrierFieldComplete(field, data, carrierOptionId)) {
      missingFields.push({ key: field.key, label: field.label })
    }
  }

  const messages: string[] = []

  if (carrierOptionId === 'chubb-home') {
    const constructionTypesField = schema.sections
      .flatMap((section) => section.fields)
      .find((field) => field.key === 'constructionTypes' && field.type === 'array')

    if (constructionTypesField?.required) {
      const constructionValidation = validateChubbConstructionTypes(data)
      if (!constructionValidation.valid) {
        missingFields.push(...constructionValidation.missingFields)
        if (constructionValidation.messages?.length) {
          messages.push(...constructionValidation.messages)
        }
      }
    }
  }

  const uniqueMissingFields = Array.from(
    new Map(missingFields.map((field) => [field.key, field])).values(),
  )

  return {
    valid: uniqueMissingFields.length === 0,
    missingFields: uniqueMissingFields,
    messages: messages.length > 0 ? messages : undefined,
  }
}

export function validateCarrierExtraction(
  data: HomeExtractionResult,
  carrierOptionId: CarrierOptionId,
): CarrierValidationResult {
  const schema = getCarrierSchema(carrierOptionId)
  return validateCarrierRequiredFields(data, schema, carrierOptionId)
}

export function countCarrierFieldStats(
  data: HomeExtractionResult,
  schema: CarrierProductSchema,
  carrierOptionId: CarrierOptionId,
): { total: number; completed: number; lowConfidence: number; flagged: number } {
  const fields = getAllSchemaFields(schema).filter(
    (f) => f.type !== 'array' && isCarrierFieldVisible(f, data, carrierOptionId),
  )
  let completed = 0
  let lowConfidence = 0
  let flagged = 0

  for (const field of fields) {
    const extracted = getFieldBySchemaKey(data, field.key, carrierOptionId)
    if (extracted.value != null && String(extracted.value).trim() !== '') {
      completed++
    }
    if (extracted.confidence === 'low') lowConfidence++
    if (extracted.flagged) flagged++
  }

  return { total: fields.length, completed, lowConfidence, flagged }
}

export function countCarrierRequiredFieldStats(
  data: HomeExtractionResult,
  schema: CarrierProductSchema,
  carrierOptionId: CarrierOptionId,
): { total: number; completed: number } {
  const requiredFields = getRequiredSchemaFields(schema).filter(
    (f) => f.type !== 'array' && isCarrierFieldVisible(f, data, carrierOptionId),
  )
  let completed = 0
  for (const field of requiredFields) {
    if (isCarrierFieldComplete(field, data, carrierOptionId)) completed++
  }
  return { total: requiredFields.length, completed }
}
