/**
 * Unified carrier quoting — shared types.
 * Each carrier product (e.g. chubb-home) has its own schema file.
 */

export type CarrierId = 'chubb' | 'travelers' | 'autoOwners' | 'nationalGeneral' | 'safeco'

export type CarrierProductType = 'home' | 'auto'

/** Combined selector value: carrier + product in one option */
export type CarrierOptionId =
  | 'chubb-home'
  | 'travelers-home'
  | 'auto-owners-home'
  | 'national-general-auto'
  | 'safeco-home'

export interface CarrierOption {
  id: CarrierOptionId
  carrierId: CarrierId
  productType: CarrierProductType
  label: string
  description: string
  enabled: boolean
  /** Maps to insurance_type for extraction API until carrier-specific prompts exist */
  insuranceType: 'home' | 'auto' | 'both'
  /** Backend Playwright route segment */
  automationRoute: string
  /** Carrier product JSON schema filename (under schemas/) */
  schemaFile: string
}

export type CarrierFieldInputType =
  | 'text'
  | 'date'
  | 'number'
  | 'dropdown'
  | 'checkbox'
  | 'array'

export type ChubbAutomationStep =
  | 'policy-information'
  | 'client-info'
  | 'address'
  | 'residence-info-hce'
  | 'residence-info-main'
  | 'residence-risk'
  | 'state-detail'
  | 'discount-detail'
  | 'losses'

export interface CarrierFieldDefinition {
  /** Canonical payload key sent to automation */
  key: string
  /** Alternate keys the backend also accepts */
  aliases?: string[]
  label: string
  step: ChubbAutomationStep
  inputType: CarrierFieldInputType
  required: boolean
  notes?: string
  /** Fixed portal values when known */
  allowedValues?: readonly string[]
  conditionalOn?:
    | { key: string; value: string }
    | { key: string; notValue: string }
}

export interface ExtractionWorkflowMeta {
  carrierOptionId: CarrierOptionId
  /** All carriers selected at upload (multi-carrier workflows) */
  carrierOptionIds?: CarrierOptionId[]
  carrierId: CarrierId
  productType: CarrierProductType
  schemaVersion: string
}

export const CARRIER_OPTIONS: CarrierOption[] = [
  {
    id: 'chubb-home',
    carrierId: 'chubb',
    productType: 'home',
    label: 'Chubb Home',
    description: 'Masterpiece EZ Quote — homeowners',
    enabled: true,
    insuranceType: 'home',
    automationRoute: 'chubb',
    schemaFile: 'chubb-home.json',
  },
  {
    id: 'travelers-home',
    carrierId: 'travelers',
    productType: 'home',
    label: 'Travelers Home',
    description: 'Travelers homeowners quoting portal',
    enabled: true,
    insuranceType: 'home',
    automationRoute: 'travelers',
    schemaFile: 'travelers-home.json',
  },
  {
    id: 'auto-owners-home',
    carrierId: 'autoOwners',
    productType: 'home',
    label: 'Auto Owners Home',
    description: 'Auto-Owners homeowners (Dwelling Fire) quoting portal',
    enabled: true,
    insuranceType: 'home',
    automationRoute: 'autoOwners',
    schemaFile: 'auto-owners-home.json',
  },
  {
    id: 'national-general-auto',
    carrierId: 'nationalGeneral',
    productType: 'auto',
    label: 'National General Auto',
    description: 'National General personal auto quoting portal',
    enabled: true,
    insuranceType: 'auto',
    automationRoute: 'nationalGeneral',
    schemaFile: 'national-general-auto.json',
  },
  {
    id: 'safeco-home',
    carrierId: 'safeco',
    productType: 'home',
    label: 'Safeco Home',
    description: 'Safeco homeowners quoting portal',
    enabled: true,
    insuranceType: 'home',
    automationRoute: 'safeco',
    schemaFile: 'safeco-home.json',
  },
]

export function getCarrierOption(id: CarrierOptionId): CarrierOption {
  const option = CARRIER_OPTIONS.find((o) => o.id === id)
  if (!option) {
    throw new Error(`Unknown carrier option: ${id}`)
  }
  return option
}
