import type { ExtractionField } from '@/types'
import type { UIFieldValidation, UIValidationResult } from '@/types/quote'
import {
  CHUBB_ATTACHED_STRUCTURE_FIELDS,
  CHUBB_CONSTRUCTION_TYPE_FIELDS,
  type HomeExtractionResult,
} from '@/types/home-extraction'
import { getCarrierFieldsMap } from './carrier-field-storage'
import { getFieldBySchemaKey } from './schema-field-access'
import { getCarrierSchema } from './load-schema'
import type { CarrierSchemaField, CarrierSchemaFieldType } from './schema-types'
import type { CarrierOptionId } from './types'
import {
  isCarrierFieldVisible,
  validateCarrierRequiredFields,
} from './validate-carrier-extraction'
import { appendChubbStaticSubmitFields } from './chubb-static-fields'
import {
  appendAutoOwnersStaticSubmitFields,
  filterAutoOwnersExcludedSubmitFields,
} from './auto-owners-static-fields'
import { carrierFieldUsesSelect, resolveCarrierFieldOptions } from './carrier-portal-field-options'

function schemaTypeToUiInputType(
  type: CarrierSchemaFieldType,
): NonNullable<UIFieldValidation['inputType']> {
  switch (type) {
    case 'date':
      return 'date'
    case 'number':
      return 'number'
    case 'dropdown':
      return 'select'
    default:
      return 'text'
  }
}

function readFieldValue(field: ExtractionField | undefined): string | null {
  const value = field?.value
  if (value == null || String(value).trim() === '') return null
  return String(value)
}

function buildScalarUiField(
  field: CarrierSchemaField,
  sectionTitle: string,
  data: HomeExtractionResult,
  carrierOptionId: CarrierOptionId,
): UIFieldValidation {
  const extracted = getFieldBySchemaKey(data, field.key, carrierOptionId)
  const value = readFieldValue(extracted)
  return {
    key: field.key,
    label: field.label,
    value,
    status: value ? 'valid' : field.required ? 'missing' : 'valid',
    confidence: extracted.confidence ?? 'high',
    flagged: extracted.flagged ?? false,
    required: field.required,
    category: sectionTitle,
    inputType: carrierFieldUsesSelect(field)
      ? 'select'
      : schemaTypeToUiInputType(field.type),
    options: resolveCarrierFieldOptions(field),
    rawText: extracted.rawText,
  }
}

function appendChubbArraySubmitFields(
  fields: UIFieldValidation[],
  data: HomeExtractionResult,
): void {
  const chubb = data.chubbHomeCoverageEstimator

  chubb.attachedStructures.forEach((entry, index) => {
    for (const fieldKey of Object.keys(CHUBB_ATTACHED_STRUCTURE_FIELDS) as Array<
      keyof typeof CHUBB_ATTACHED_STRUCTURE_FIELDS
    >) {
      const payloadKey = `attachedStructures[${index}].${fieldKey}`
      const config = CHUBB_ATTACHED_STRUCTURE_FIELDS[fieldKey]
      const value = readFieldValue(entry[fieldKey])
      if (!value) continue
      fields.push({
        key: payloadKey,
        label: config.label,
        value,
        status: 'valid',
        confidence: entry[fieldKey]?.confidence ?? 'high',
        flagged: entry[fieldKey]?.flagged ?? false,
        required: false,
        category: 'Home Coverage Estimator',
        inputType: config.inputType === 'select' ? 'select' : 'number',
        options: config.options,
      })
    }
  })

  chubb.constructionTypes.forEach((entry, index) => {
    for (const fieldKey of Object.keys(CHUBB_CONSTRUCTION_TYPE_FIELDS) as Array<
      keyof typeof CHUBB_CONSTRUCTION_TYPE_FIELDS
    >) {
      const payloadKey = `constructionTypes[${index}].${fieldKey}`
      const config = CHUBB_CONSTRUCTION_TYPE_FIELDS[fieldKey]
      const value = readFieldValue(entry[fieldKey])
      if (!value) continue
      fields.push({
        key: payloadKey,
        label: config.label,
        value,
        status: 'valid',
        confidence: entry[fieldKey]?.confidence ?? 'high',
        flagged: entry[fieldKey]?.flagged ?? false,
        required: false,
        category: 'Home Coverage Estimator',
        inputType: config.inputType === 'select' ? 'select' : 'text',
        options: config.options,
      })
    }
  })
}

/**
 * Build quote preview validation from carrier JSON schema only (not broad home fields).
 */
export function transformCarrierToValidation(
  data: HomeExtractionResult,
  carrierOptionId: CarrierOptionId,
): UIValidationResult {
  const schema = getCarrierSchema(carrierOptionId)
  const requiredFields: UIFieldValidation[] = []
  const optionalFields: UIFieldValidation[] = []
  const flaggedFields: UIFieldValidation[] = []

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type === 'array') continue
      if (!isCarrierFieldVisible(field, data, carrierOptionId)) continue

      const entry = buildScalarUiField(field, section.title, data, carrierOptionId)
      if (field.required) {
        requiredFields.push(entry)
      } else {
        optionalFields.push(entry)
      }
      if (entry.flagged || entry.confidence === 'low') {
        flaggedFields.push(entry)
      }
    }
  }

  const validation = validateCarrierRequiredFields(data, schema, carrierOptionId)
  const completedRequired = requiredFields.filter((f) => f.value).length
  const totalRequired = requiredFields.length

  return {
    isValid: validation.valid,
    requiredFields,
    optionalFields,
    flaggedFields,
    totalRequired,
    completedRequired,
    completionPercentage:
      totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 100,
  }
}

/**
 * Flat field list for Chubb Playwright submit payload (schema keys only).
 */
export function buildCarrierSubmitFields(
  data: HomeExtractionResult & {
    carrierFields?: Record<string, ExtractionField>
    carrierFieldsByOption?: Partial<
      Record<CarrierOptionId, Record<string, ExtractionField>>
    >
  },
  carrierOptionId: CarrierOptionId,
): UIFieldValidation[] {
  const schema = getCarrierSchema(carrierOptionId)
  const fields: UIFieldValidation[] = []

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type === 'array') continue
      if (!isCarrierFieldVisible(field, data, carrierOptionId)) continue

      const entry = buildScalarUiField(field, section.title, data, carrierOptionId)
      if (!entry.value) continue
      fields.push(entry)
    }
  }

  if (carrierOptionId === 'chubb-home') {
    appendChubbArraySubmitFields(fields, data)
    appendChubbStaticSubmitFields(fields)
  }

  if (carrierOptionId === 'auto-owners-home') {
    appendAutoOwnersStaticSubmitFields(fields)
  }

  const carrierFields = getCarrierFieldsMap(data, carrierOptionId)
  if (carrierFields) {
    for (const [key, field] of Object.entries(carrierFields)) {
      const value = readFieldValue(field)
      if (!value) continue
      if (fields.some((f) => f.key === key)) continue
      fields.push({
        key,
        label: key,
        value,
        status: 'valid',
        confidence: field.confidence ?? 'high',
        flagged: field.flagged ?? false,
        required: false,
      })
    }
  }

  if (carrierOptionId === 'auto-owners-home') {
    return filterAutoOwnersExcludedSubmitFields(fields)
  }

  return fields
}
