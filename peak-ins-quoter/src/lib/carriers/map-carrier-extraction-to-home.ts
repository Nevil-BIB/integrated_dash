import type { ExtractionField } from '@/types'
import {
  createEmptyHomeExtraction,
  type HomeChubbAttachedStructure,
  type HomeChubbConstructionTypeEntry,
  type HomeExtractionResult,
} from '@/types/home-extraction'
import { applyChubbStaticFieldValues } from './chubb-static-fields'
import {
  applyAutoOwnersStaticFieldValues,
  isAutoOwnersExcludedField,
  stripAutoOwnersExcludedFieldValues,
} from './auto-owners-static-fields'
import {
  resolveUiPath,
  SECONDARY_UI_PATHS,
  setFieldAtUiPath,
} from './schema-field-access'
import type { CarrierOptionId } from './types'

export interface CarrierRawExtractionResult {
  fields: Record<string, ExtractionField>
  attachedStructures?: HomeChubbAttachedStructure[]
  constructionTypes?: HomeChubbConstructionTypeEntry[]
}

function normalizeField(raw: unknown): ExtractionField | null {
  if (!raw || typeof raw !== 'object') return null
  const field = raw as Record<string, unknown>
  if (
    !('confidence' in field) ||
    (field.confidence !== 'high' && field.confidence !== 'medium' && field.confidence !== 'low')
  ) {
    return null
  }
  if (typeof field.flagged !== 'boolean') return null
  let value: string | null = null
  if (field.value === null) {
    value = null
  } else if (typeof field.value === 'boolean') {
    value = field.value ? 'Yes' : 'No'
  } else if (typeof field.value === 'string') {
    value = field.value
  } else if (field.value != null) {
    value = String(field.value)
  }
  return {
    value,
    confidence: field.confidence,
    flagged: field.flagged,
    rawText: typeof field.rawText === 'string' ? field.rawText : undefined,
  }
}

function assignFieldAtPath(
  result: HomeExtractionResult,
  path: string,
  field: ExtractionField,
): HomeExtractionResult {
  return setFieldAtUiPath(result, path, field)
}

function confidenceRank(confidence: ExtractionField['confidence']): number {
  return { high: 3, medium: 2, low: 1 }[confidence]
}

function shouldReplaceField(existing: ExtractionField, incoming: ExtractionField): boolean {
  return (
    existing.flagged ||
    existing.value === null ||
    confidenceRank(incoming.confidence) > confidenceRank(existing.confidence)
  )
}

function mergeCarrierFieldMaps(
  maps: Record<string, ExtractionField>[],
): Record<string, ExtractionField> {
  const merged: Record<string, ExtractionField> = {}
  for (const map of maps) {
    for (const [key, field] of Object.entries(map)) {
      if (field.value === null) continue
      const existing = merged[key]
      if (!existing || shouldReplaceField(existing, field)) {
        merged[key] = field
      }
    }
  }
  return merged
}

function mergeStructureArrays<T>(arrays: (T[] | undefined)[], fallback: T[]): T[] {
  const result: T[] = []
  for (const arr of arrays) {
    if (!arr) continue
    for (const item of arr) {
      result.push(item)
    }
  }
  return result.length > 0 ? result : fallback
}

export function mergeCarrierRawExtractions(
  partials: Partial<CarrierRawExtractionResult>[],
): CarrierRawExtractionResult {
  const fieldMaps = partials
    .map((p) => p.fields)
    .filter((f): f is Record<string, ExtractionField> => !!f)

  return {
    fields: mergeCarrierFieldMaps(fieldMaps),
    attachedStructures: mergeStructureArrays(
      partials.map((p) => p.attachedStructures),
      [],
    ),
    constructionTypes: mergeStructureArrays(
      partials.map((p) => p.constructionTypes),
      [],
    ),
  }
}

export function mapCarrierExtractionToHome(
  raw: CarrierRawExtractionResult,
  carrierOptionId: CarrierOptionId,
): HomeExtractionResult & { carrierFields: Record<string, ExtractionField> } {
  let result = createEmptyHomeExtraction()
  const carrierFields: Record<string, ExtractionField> = {}

  for (const [schemaKey, rawField] of Object.entries(raw.fields)) {
    if (carrierOptionId === 'auto-owners-home' && isAutoOwnersExcludedField(schemaKey)) {
      continue
    }
    const field = normalizeField(rawField)
    if (!field) continue
    carrierFields[schemaKey] = field
    if (field.value === null) continue

    const uiPath = resolveUiPath(schemaKey, carrierOptionId)
    result = assignFieldAtPath(result, uiPath, field)

    const secondary = SECONDARY_UI_PATHS[uiPath]
    if (secondary) {
      for (const extraPath of secondary) {
        result = assignFieldAtPath(result, extraPath, field)
      }
    }
  }

  if (carrierOptionId === 'chubb-home') {
    if (raw.attachedStructures?.length) {
      result.chubbHomeCoverageEstimator.attachedStructures = raw.attachedStructures
    }
    if (raw.constructionTypes?.length) {
      result.chubbHomeCoverageEstimator.constructionTypes = raw.constructionTypes
    }
    applyChubbStaticFieldValues(carrierFields)
    result = assignFieldAtPath(result, 'insuranceDetails.numberOfLosses5Years', {
      value: 'No',
      confidence: 'high',
      flagged: false,
    })
  }

  if (carrierOptionId === 'auto-owners-home') {
    stripAutoOwnersExcludedFieldValues(carrierFields)
    applyAutoOwnersStaticFieldValues(carrierFields)
    result = assignFieldAtPath(result, 'locationDetail.personalPropertyOnly', {
      value: 'No',
      confidence: 'high',
      flagged: false,
    })
    result = assignFieldAtPath(result, 'personal.entity', {
      value: 'Individual',
      confidence: 'high',
      flagged: false,
    })
  }

  return { ...result, carrierFields }
}

export function createEmptyCarrierRawExtraction(): CarrierRawExtractionResult {
  return { fields: {}, attachedStructures: [], constructionTypes: [] }
}
