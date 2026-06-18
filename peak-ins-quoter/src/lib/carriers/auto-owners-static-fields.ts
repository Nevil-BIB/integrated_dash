import type { ExtractionField } from '@/types'
import type { UIFieldValidation } from '@/types/quote'

/** Auto Owners fields removed from UI and never sent to automation. */
export const AUTO_OWNERS_EXCLUDED_FIELD_KEYS = new Set(['coverageC', 'coverageCAmount'])

/** Auto Owners fields hidden from UI but always sent with fixed values. */
export const AUTO_OWNERS_STATIC_FIELD_VALUES = {
  personalPropertyOnly: 'No',
  entity: 'Individual',
} as const satisfies Record<string, string>

export function isAutoOwnersExcludedField(key: string): boolean {
  return AUTO_OWNERS_EXCLUDED_FIELD_KEYS.has(key)
}

export function stripAutoOwnersExcludedFieldValues(
  carrierFields: Record<string, ExtractionField>,
): void {
  for (const key of AUTO_OWNERS_EXCLUDED_FIELD_KEYS) {
    delete carrierFields[key]
  }
}

export function applyAutoOwnersStaticFieldValues(
  carrierFields: Record<string, ExtractionField>,
): void {
  for (const [key, value] of Object.entries(AUTO_OWNERS_STATIC_FIELD_VALUES)) {
    carrierFields[key] = {
      value,
      confidence: 'high',
      flagged: false,
    }
  }
}

export function appendAutoOwnersStaticSubmitFields(fields: UIFieldValidation[]): void {
  const staticFields: Array<{ key: string; label: string; value: string }> = [
    { key: 'personalPropertyOnly', label: 'Personal Property Only', value: 'No' },
    { key: 'entity', label: 'Entity Type', value: 'Individual' },
  ]

  for (const { key, label, value } of staticFields) {
    const entry: UIFieldValidation = {
      key,
      label,
      value,
      status: 'valid',
      confidence: 'high',
      flagged: false,
      required: false,
    }
    const existingIndex = fields.findIndex((field) => field.key === key)
    if (existingIndex >= 0) {
      fields[existingIndex] = { ...fields[existingIndex], value }
    } else {
      fields.push(entry)
    }
  }
}

export function filterAutoOwnersExcludedSubmitFields(
  fields: UIFieldValidation[],
): UIFieldValidation[] {
  return fields.filter((field) => !AUTO_OWNERS_EXCLUDED_FIELD_KEYS.has(field.key))
}
