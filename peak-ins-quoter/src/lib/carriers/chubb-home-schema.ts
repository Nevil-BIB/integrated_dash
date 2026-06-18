/**
 * Chubb Home schema accessors.
 * Source of truth: ./schemas/chubb-home.json
 */

import {
  getAllSchemaFields,
  getCarrierSchema,
  getOptionalSchemaFields,
  getRequiredSchemaFields,
} from './load-schema'
import type { CarrierFieldDefinition } from './types'

export const CHUBB_HOME_SCHEMA = getCarrierSchema('chubb-home')
export const CHUBB_HOME_SCHEMA_VERSION = CHUBB_HOME_SCHEMA.version

function toFieldDefinition(field: ReturnType<typeof getAllSchemaFields>[number]): CarrierFieldDefinition {
  const step = CHUBB_HOME_SCHEMA.sections.find((section) =>
    section.fields.some((item) => item.key === field.key),
  )?.automationStep

  return {
    key: field.key,
    aliases: field.aliases,
    label: field.label,
    step: (step ?? 'client-info') as CarrierFieldDefinition['step'],
    inputType: field.type === 'array' ? 'array' : field.type,
    required: field.required,
    notes: field.notes,
    allowedValues: field.options,
    conditionalOn: field.conditionalOn,
  }
}

export const CHUBB_HOME_REQUIRED_FIELDS = getRequiredSchemaFields(CHUBB_HOME_SCHEMA).map(toFieldDefinition)
export const CHUBB_HOME_OPTIONAL_FIELDS = getOptionalSchemaFields(CHUBB_HOME_SCHEMA).map(toFieldDefinition)
export const CHUBB_HOME_ALL_FIELDS = getAllSchemaFields(CHUBB_HOME_SCHEMA).map(toFieldDefinition)

export const CHUBB_HOME_NON_PAYLOAD_FIELDS = CHUBB_HOME_SCHEMA.nonPayload.map(
  (item) => item.notes ?? item.id,
)
