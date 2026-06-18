import { extractWithPromptFromImages } from '@/lib/openrouter/client'
import type { ExtractionField } from '@/types'
import type {
  AutoApiExtractionResult,
  ExtractionBooleanField,
} from '@/types/extraction'
import type { HomeExtractionResult } from '@/types/home-extraction'
import { buildCarrierExtractionPrompt } from './carrier-extraction-prompt'
import {
  createEmptyCarrierRawExtraction,
  mapCarrierExtractionToHome,
  mergeCarrierRawExtractions,
  type CarrierRawExtractionResult,
} from './map-carrier-extraction-to-home'
import { getAllSchemaFields, getCarrierSchema } from './load-schema'
import type { CarrierOptionId } from './types'
import { extractAutoFromImages } from '@/lib/openrouter/client'

const CARRIER_SCHEMA_EXTRACTION_IDS: CarrierOptionId[] = [
  'chubb-home',
  'travelers-home',
  'auto-owners-home',
  'national-general-auto',
  'safeco-home',
]

export function supportsCarrierSchemaExtraction(
  carrierOptionId: CarrierOptionId,
): boolean {
  return CARRIER_SCHEMA_EXTRACTION_IDS.includes(carrierOptionId)
}

function extractJsonFromContent(content: string): string {
  const trimmed = content.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) return fenceMatch[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1)
  }
  return trimmed
}

function parseCarrierExtractionResponse(content: string): Partial<CarrierRawExtractionResult> {
  const jsonStr = extractJsonFromContent(content)
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>

  const fields: Record<string, ExtractionField> = {}
  const rawFields = parsed.fields
  if (rawFields && typeof rawFields === 'object') {
    for (const [key, value] of Object.entries(rawFields)) {
      if (value && typeof value === 'object') {
        fields[key] = value as ExtractionField
      }
    }
  }

  return {
    fields,
    attachedStructures: Array.isArray(parsed.attachedStructures)
      ? (parsed.attachedStructures as CarrierRawExtractionResult['attachedStructures'])
      : undefined,
    constructionTypes: Array.isArray(parsed.constructionTypes)
      ? (parsed.constructionTypes as CarrierRawExtractionResult['constructionTypes'])
      : undefined,
  }
}

function normalizeExtractionField(value: unknown): ExtractionField {
  if (!value || typeof value !== 'object') {
    return { value: null, confidence: 'low', flagged: true }
  }
  const raw = value as Partial<ExtractionField>
  const confidence: ExtractionField['confidence'] =
    raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low'
      ? raw.confidence
      : 'low'
  const flagged = typeof raw.flagged === 'boolean' ? raw.flagged : true
  const out: ExtractionField = {
    value: raw.value == null ? null : String(raw.value),
    confidence,
    flagged,
  }
  if (typeof raw.rawText === 'string') {
    out.rawText = raw.rawText
  }
  return out
}

function isMissingField(field: ExtractionField | undefined): boolean {
  return !field || field.value == null || String(field.value).trim() === ''
}

function hasIndexedFieldPrefix(
  fields: Record<string, ExtractionField>,
  prefix: string,
): boolean {
  return Object.entries(fields).some(
    ([key, field]) => key.startsWith(prefix) && !isMissingField(field),
  )
}

function toTextField(
  field: ExtractionField | ExtractionBooleanField | undefined,
  formatter?: (value: string) => string | null,
): ExtractionField | null {
  if (!field) return null
  if (field.value == null) return null

  let value: string | null
  if (typeof field.value === 'boolean') {
    value = field.value ? 'Yes' : 'No'
  } else {
    value = String(field.value).trim()
  }

  if (!value) return null
  if (formatter) {
    value = formatter(value)
    if (!value) return null
  }

  return {
    value,
    confidence: field.confidence,
    flagged: field.flagged,
    ...(field.rawText ? { rawText: field.rawText } : {}),
  }
}

function toNatGenDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (us) return value
  return null
}

function setFieldIfMissing(
  fields: Record<string, ExtractionField>,
  key: string,
  source: ExtractionField | ExtractionBooleanField | undefined,
  formatter?: (value: string) => string | null,
): void {
  if (!isMissingField(fields[key])) return
  const next = toTextField(source, formatter)
  if (!next) return
  fields[key] = next
}

function parsePhoneSegments(phoneRaw: string | null): {
  areaCode: string
  exchange: string
  number: string
} | null {
  if (!phoneRaw) return null
  const digits = phoneRaw.replace(/\D/g, '')
  if (digits.length < 10) return null
  const d10 = digits.slice(-10)
  return {
    areaCode: d10.slice(0, 3),
    exchange: d10.slice(3, 6),
    number: d10.slice(6, 10),
  }
}

const NATGEN_MAKE_CODE_BY_NAME: Record<string, string> = {
  ACURA: 'ACUR',
  AUDI: 'AUDI',
  BMW: 'BMW',
  BUICK: 'BUIC',
  CADILLAC: 'CADI',
  CHEVROLET: 'CHEV',
  CHRYSLER: 'CHRY',
  DODGE: 'DODG',
  FIAT: 'FIAT',
  FORD: 'FORD',
  GMC: 'GMC',
  HONDA: 'HOND',
  HYUNDAI: 'HYUN',
  INFINITI: 'INFI',
  JAGUAR: 'JAGU',
  JEEP: 'JEEP',
  KIA: 'KIA',
  LANDROVER: 'LNDR',
  LEXUS: 'LEXS',
  LINCOLN: 'LINC',
  MAZDA: 'MAZD',
  MERCEDES: 'MERZ',
  MINI: 'MNNI',
  MITSUBISHI: 'MITS',
  NISSAN: 'NISS',
  PORSCHE: 'PORS',
  RAM: 'RAM',
  SUBARU: 'SUBA',
  TESLA: 'TESL',
  TOYOTA: 'TOYT',
  VOLKSWAGEN: 'VOLK',
  VOLVO: 'VOLV',
}

function toNatGenMakeCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const upper = trimmed.toUpperCase()
  if (upper.length <= 4) return upper
  const normalized = upper.replace(/[^A-Z]/g, '')
  return NATGEN_MAKE_CODE_BY_NAME[normalized] ?? upper.slice(0, 4)
}

function mapOwnershipToNatGen(value: string): string | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  if (raw.includes('financ')) return 'FIN'
  if (raw.includes('lease')) return 'LSE'
  if (raw.includes('own')) return 'OWN'
  return null
}

function mapMaritalStatusToNatGen(value: string): string | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  if (raw.startsWith('m')) return 'M'
  if (raw.startsWith('s')) return 'S'
  if (raw.startsWith('d')) return 'D'
  if (raw.startsWith('w')) return 'W'
  if (raw.startsWith('p')) return 'P'
  if (raw.startsWith('h')) return 'H'
  return null
}

function mapRelationshipToNatGen(value: string): string | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  if (raw.includes('spouse')) return 'Spouse'
  if (raw.includes('child') || raw.includes('son') || raw.includes('daughter')) return 'Child'
  if (raw.includes('parent') || raw.includes('mother') || raw.includes('father')) return 'Parent'
  if (raw.includes('insured')) return 'Named Insured'
  return 'Other'
}

function mapVehicleDeductible(value: string): string | null {
  const normalized = value.replace(/\s+/g, '').toLowerCase()
  if (!normalized) return null
  if (normalized.includes('liabilityonly') || normalized.includes('reject')) {
    return '-1'
  }
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return null
  return digits
}

function mapTowValue(value: string): string | null {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits === '25') return '35'
  if (digits === '50') return '50'
  if (digits === '75') return '75'
  return null
}

function backfillNationalGeneralFromAutoExtraction(
  raw: CarrierRawExtractionResult,
  autoData: AutoApiExtractionResult,
): CarrierRawExtractionResult {
  const nextFields: Record<string, ExtractionField> = { ...raw.fields }
  const personal = autoData.personal

  setFieldIfMissing(nextFields, 'namedInsured.firstName', personal.ownerFirstName)
  setFieldIfMissing(nextFields, 'namedInsured.lastName', personal.ownerLastName)
  setFieldIfMissing(
    nextFields,
    'namedInsured.dateOfBirth',
    personal.ownerDOB,
    toNatGenDate,
  )
  setFieldIfMissing(nextFields, 'namedInsured.email', personal.email)
  setFieldIfMissing(nextFields, 'namedInsured.mailingAddress', personal.streetAddress)
  setFieldIfMissing(nextFields, 'namedInsured.city', personal.city)
  setFieldIfMissing(nextFields, 'namedInsured.state', personal.state)
  setFieldIfMissing(nextFields, 'namedInsured.zipCode', personal.zipCode)
  setFieldIfMissing(nextFields, 'namedInsured.previousAddress', personal.priorStreetAddress)
  setFieldIfMissing(nextFields, 'namedInsured.previousCity', personal.priorCity)
  setFieldIfMissing(nextFields, 'namedInsured.previousState', personal.priorState)
  setFieldIfMissing(nextFields, 'namedInsured.previousZip', personal.priorZipCode)

  const phone = parsePhoneSegments(toTextField(personal.phone)?.value ?? null)
  if (phone) {
    if (isMissingField(nextFields['namedInsured.phone.areaCode'])) {
      nextFields['namedInsured.phone.areaCode'] = {
        value: phone.areaCode,
        confidence: 'medium',
        flagged: false,
      }
    }
    if (isMissingField(nextFields['namedInsured.phone.exchange'])) {
      nextFields['namedInsured.phone.exchange'] = {
        value: phone.exchange,
        confidence: 'medium',
        flagged: false,
      }
    }
    if (isMissingField(nextFields['namedInsured.phone.number'])) {
      nextFields['namedInsured.phone.number'] = {
        value: phone.number,
        confidence: 'medium',
        flagged: false,
      }
    }
  }

  const baseDriverKeys = [
    'drivers[0].firstName',
    'drivers[0].lastName',
    'drivers[0].dateOfBirth',
  ] as const
  if (baseDriverKeys.every((key) => isMissingField(nextFields[key]))) {
    setFieldIfMissing(nextFields, 'drivers[0].firstName', personal.ownerFirstName)
    setFieldIfMissing(nextFields, 'drivers[0].lastName', personal.ownerLastName)
    setFieldIfMissing(
      nextFields,
      'drivers[0].dateOfBirth',
      personal.ownerDOB,
      toNatGenDate,
    )
    if (isMissingField(nextFields['drivers[0].relationship'])) {
      nextFields['drivers[0].relationship'] = {
        value: 'Named Insured',
        confidence: 'medium',
        flagged: false,
      }
    }
    if (isMissingField(nextFields['drivers[0].driverStatus'])) {
      nextFields['drivers[0].driverStatus'] = {
        value: 'Rated Driver',
        confidence: 'medium',
        flagged: false,
      }
    }
    setFieldIfMissing(
      nextFields,
      'drivers[0].maritalStatus',
      personal.maritalStatus,
      mapMaritalStatusToNatGen,
    )
    setFieldIfMissing(nextFields, 'drivers[0].licenseState', personal.ownerLicenseState)
    setFieldIfMissing(nextFields, 'drivers[0].dlNumber', personal.ownerDriversLicense)
    setFieldIfMissing(nextFields, 'drivers[0].email', personal.email)
    if (phone) {
      if (isMissingField(nextFields['drivers[0].cellPhone.areaCode'])) {
        nextFields['drivers[0].cellPhone.areaCode'] = {
          value: phone.areaCode,
          confidence: 'medium',
          flagged: false,
        }
      }
      if (isMissingField(nextFields['drivers[0].cellPhone.exchange'])) {
        nextFields['drivers[0].cellPhone.exchange'] = {
          value: phone.exchange,
          confidence: 'medium',
          flagged: false,
        }
      }
      if (isMissingField(nextFields['drivers[0].cellPhone.number'])) {
        nextFields['drivers[0].cellPhone.number'] = {
          value: phone.number,
          confidence: 'medium',
          flagged: false,
        }
      }
    }
  }

  autoData.additionalDrivers.forEach((driver, idx) => {
    const i = idx + 1
    setFieldIfMissing(nextFields, `drivers[${i}].firstName`, driver.firstName)
    setFieldIfMissing(nextFields, `drivers[${i}].lastName`, driver.lastName)
    setFieldIfMissing(nextFields, `drivers[${i}].dateOfBirth`, driver.dateOfBirth, toNatGenDate)
    setFieldIfMissing(nextFields, `drivers[${i}].dlNumber`, driver.licenseNumber)
    setFieldIfMissing(nextFields, `drivers[${i}].licenseState`, driver.licenseState)
    setFieldIfMissing(
      nextFields,
      `drivers[${i}].relationship`,
      driver.relationship,
      mapRelationshipToNatGen,
    )
    if (isMissingField(nextFields[`drivers[${i}].driverStatus`])) {
      nextFields[`drivers[${i}].driverStatus`] = {
        value: 'Listed Driver',
        confidence: 'low',
        flagged: true,
      }
    }
  })

  autoData.vehicles.forEach((vehicle, i) => {
    setFieldIfMissing(nextFields, `vehicles[${i}].modelYear`, vehicle.year)
    setFieldIfMissing(nextFields, `vehicles[${i}].make`, vehicle.make, (v) => toNatGenMakeCode(v))
    setFieldIfMissing(nextFields, `vehicles[${i}].model`, vehicle.model)
    setFieldIfMissing(nextFields, `vehicles[${i}].vin`, vehicle.vin)
    setFieldIfMissing(nextFields, `vehicles[${i}].annualMileage`, vehicle.estimatedMileage)
    setFieldIfMissing(
      nextFields,
      `vehicles[${i}].ownershipStatus`,
      vehicle.ownership,
      mapOwnershipToNatGen,
    )
    setFieldIfMissing(
      nextFields,
      `coverages.vehicles[${i}].comp`,
      vehicle.comprehensiveDeductible,
      mapVehicleDeductible,
    )
    setFieldIfMissing(
      nextFields,
      `coverages.vehicles[${i}].coll`,
      vehicle.collisionDeductible,
      mapVehicleDeductible,
    )
    setFieldIfMissing(
      nextFields,
      `coverages.vehicles[${i}].tow`,
      vehicle.roadTroubleService,
      mapTowValue,
    )
    setFieldIfMissing(
      nextFields,
      `coverages.vehicles[${i}].ppmx`,
      vehicle.limitedTNCCoverage,
    )
  })

  setFieldIfMissing(nextFields, 'coverages.bi', autoData.coverage.bodilyInjury)
  setFieldIfMissing(nextFields, 'coverages.pd', autoData.coverage.propertyDamage)
  setFieldIfMissing(nextFields, 'coverages.med', autoData.coverage.medicalPayments)
  setFieldIfMissing(nextFields, 'coverages.umuimbi', autoData.coverage.uninsuredMotorist)

  if (isMissingField(nextFields['coverages.payMethod'])) {
    nextFields['coverages.payMethod'] = {
      value: 'AS',
      confidence: 'low',
      flagged: true,
    }
  }
  if (isMissingField(nextFields['coverages.payPlan'])) {
    nextFields['coverages.payPlan'] = {
      value: '7076',
      confidence: 'low',
      flagged: true,
    }
  }

  if (isMissingField(nextFields['underwriting.residenceStatus'])) {
    nextFields['underwriting.residenceStatus'] = {
      value: 'HCO',
      confidence: 'low',
      flagged: true,
    }
  }

  if (isMissingField(nextFields['underwriting.priorCarrier'])) {
    const priorCarrierValue =
      toTextField(autoData.priorInsurance.insuranceCompany)?.value?.trim() ? '380' : '0'
    nextFields['underwriting.priorCarrier'] = {
      value: priorCarrierValue,
      confidence: 'low',
      flagged: true,
    }
  }

  setFieldIfMissing(
    nextFields,
    'underwriting.priorExpDate',
    autoData.priorInsurance.expirationDate,
    toNatGenDate,
  )
  setFieldIfMissing(nextFields, 'underwriting.priorBI', autoData.coverage.bodilyInjury)

  return {
    ...raw,
    fields: nextFields,
  }
}

function ensureAllScalarSchemaFields(
  raw: CarrierRawExtractionResult,
  carrierOptionId: CarrierOptionId,
): CarrierRawExtractionResult {
  const schema = getCarrierSchema(carrierOptionId)
  const scalarFields = getAllSchemaFields(schema).filter((f) => f.type !== 'array')
  const nextFields: Record<string, ExtractionField> = {}

  for (const field of scalarFields) {
    const existing = raw.fields[field.key]
    nextFields[field.key] = normalizeExtractionField(existing)
  }

  // Preserve extra keys (for example indexed array paths like drivers[0].firstName)
  // so downstream submit payloads can still carry rich carrier-specific data.
  for (const [key, value] of Object.entries(raw.fields)) {
    if (key in nextFields) continue
    nextFields[key] = normalizeExtractionField(value)
  }

  return {
    ...raw,
    fields: nextFields,
    attachedStructures: raw.attachedStructures ?? [],
    constructionTypes: raw.constructionTypes ?? [],
  }
}

export type CarrierExtractionResult = HomeExtractionResult & {
  carrierFields: Record<string, ExtractionField>
  carrierFieldsByOption?: Partial<
    Record<CarrierOptionId, Record<string, ExtractionField>>
  >
}

/**
 * Extract fact-finder data using the carrier product JSON schema (not the broad home prompt).
 */
export async function extractCarrierFromImages(
  images: string[],
  carrierOptionId: CarrierOptionId,
): Promise<CarrierExtractionResult> {
  if (!supportsCarrierSchemaExtraction(carrierOptionId)) {
    throw new Error(`Carrier schema extraction not implemented for: ${carrierOptionId}`)
  }

  const schema = getCarrierSchema(carrierOptionId)
  const prompt = buildCarrierExtractionPrompt(carrierOptionId)
  const logPrefix = `[extractCarrier:${schema.id}]`

  let raw = await extractWithPromptFromImages(images, prompt, {
    logPrefix,
    parseBatch: parseCarrierExtractionResponse,
    mergePartials: mergeCarrierRawExtractions,
    createDefault: createEmptyCarrierRawExtraction,
  })

  if (carrierOptionId === 'national-general-auto') {
    const hasDriverValues = hasIndexedFieldPrefix(raw.fields, 'drivers[')
    const hasVehicleValues = hasIndexedFieldPrefix(raw.fields, 'vehicles[')
    const missingNamedInsured =
      isMissingField(raw.fields['namedInsured.firstName']) ||
      isMissingField(raw.fields['namedInsured.lastName']) ||
      isMissingField(raw.fields['namedInsured.dateOfBirth'])

    if (!hasDriverValues || !hasVehicleValues || missingNamedInsured) {
      try {
        console.log(
          `[extractCarrier:${schema.id}] Running AUTO fallback backfill (drivers=${hasDriverValues}, vehicles=${hasVehicleValues}, missingNamedInsured=${missingNamedInsured})`,
        )
        const autoData = await extractAutoFromImages(images)
        raw = backfillNationalGeneralFromAutoExtraction(raw, autoData)
      } catch (error) {
        console.warn(
          `[extractCarrier:${schema.id}] AUTO fallback backfill failed; proceeding with carrier extraction only`,
          error,
        )
      }
    }
  }

  const normalized = ensureAllScalarSchemaFields(raw, carrierOptionId)
  return mapCarrierExtractionToHome(normalized, carrierOptionId)
}
