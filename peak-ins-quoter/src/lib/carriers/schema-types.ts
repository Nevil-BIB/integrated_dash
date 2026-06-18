import type { CarrierId, CarrierProductType, CarrierOptionId } from './types'

export type CarrierSchemaFieldType =
  | 'text'
  | 'date'
  | 'number'
  | 'dropdown'
  | 'checkbox'
  | 'array'

export interface CarrierSchemaField {
  key: string
  aliases?: string[]
  label: string
  type: CarrierSchemaFieldType
  required: boolean
  options?: string[]
  optionsSource?: 'portal'
  format?: string
  notes?: string
  conditionalOn?:
    | { key: string; value: string }
    | { key: string; notValue: string }
  itemSchema?: Record<string, { type: string; options?: string[]; notes?: string }>
}

export interface CarrierSchemaSection {
  id: string
  title: string
  automationStep: string
  fields: CarrierSchemaField[]
}

export interface CarrierProductSchema {
  id: CarrierOptionId
  carrierId: CarrierId
  productType: CarrierProductType
  label: string
  description: string
  version: string
  automation: {
    route: string
    submitPath: string
    statusPath: string
  }
  payload: {
    supportsFlatKeys: boolean
    supportsNestedObjects: boolean
    supportsFieldsArray: boolean
    notes?: string
  }
  formatRules: Record<string, string | string[]>
  nonPayload: Array<{
    id: string
    source: string
    key?: string
    keys?: string[]
    value?: string
    notes?: string
  }>
  sections: CarrierSchemaSection[]
}
