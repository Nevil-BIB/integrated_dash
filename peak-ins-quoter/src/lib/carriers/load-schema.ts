import autoOwnersHomeSchema from './schemas/auto-owners-home.json'
import chubbHomeSchema from './schemas/chubb-home.json'
import nationalGeneralAutoSchema from './schemas/national-general-auto.json'
import safecoHomeSchema from './schemas/safeco-home.json'
import travelersHomeSchema from './schemas/travelers-home.json'
import type { CarrierOptionId } from './types'
import type { CarrierProductSchema, CarrierSchemaField } from './schema-types'

const SCHEMA_REGISTRY: Record<CarrierOptionId, CarrierProductSchema> = {
  'chubb-home': chubbHomeSchema as CarrierProductSchema,
  'travelers-home': travelersHomeSchema as CarrierProductSchema,
  'auto-owners-home': autoOwnersHomeSchema as CarrierProductSchema,
  'national-general-auto': nationalGeneralAutoSchema as CarrierProductSchema,
  'safeco-home': safecoHomeSchema as CarrierProductSchema,
}

export function getCarrierSchema(carrierOptionId: CarrierOptionId): CarrierProductSchema {
  const schema = SCHEMA_REGISTRY[carrierOptionId]
  if (!schema) {
    throw new Error(`No JSON schema registered for carrier option: ${carrierOptionId}`)
  }
  return schema
}

export function getAllSchemaFields(schema: CarrierProductSchema): CarrierSchemaField[] {
  return schema.sections.flatMap((section) => section.fields)
}

export function getRequiredSchemaFields(schema: CarrierProductSchema): CarrierSchemaField[] {
  return getAllSchemaFields(schema).filter((field) => field.required)
}

export function getOptionalSchemaFields(schema: CarrierProductSchema): CarrierSchemaField[] {
  return getAllSchemaFields(schema).filter((field) => !field.required)
}
