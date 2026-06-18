import type { ExtractionField } from '@/types'
import type { UIFieldValidation } from '@/types/quote'

/** Chubb fields hidden from UI but always sent with fixed values. */
export const CHUBB_STATIC_FIELD_VALUES = {
  hasHomeownersLossesPast7Years: 'No',
} as const satisfies Record<string, string>

export function applyChubbStaticFieldValues(
  carrierFields: Record<string, ExtractionField>,
): void {
  for (const [key, value] of Object.entries(CHUBB_STATIC_FIELD_VALUES)) {
    carrierFields[key] = {
      value,
      confidence: 'high',
      flagged: false,
    }
  }
}

export function appendChubbStaticSubmitFields(fields: UIFieldValidation[]): void {
  const staticFields: Array<{ key: string; label: string; value: string }> = [
    {
      key: 'hasHomeownersLossesPast7Years',
      label: 'Homeowner Losses (Past 7 Years)',
      value: 'No',
    },
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
