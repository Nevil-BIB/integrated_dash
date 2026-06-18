import { describe, expect, it, vi } from 'vitest'
import type { ExtractionField } from '@/types'
import { createEmptyHomeExtraction } from '@/types/home-extraction'
import {
  buildCarrierSubmitFields,
  createWorkflowMeta,
  extractCarrierFromImages,
  getCarrierSchema,
  getRequiredSchemaFields,
  validateCarrierExtraction,
} from './index'
import {
  extractAutoFromImages,
  extractWithPromptFromImages,
} from '@/lib/openrouter/client'

vi.mock('@/lib/openrouter/client', () => ({
  extractWithPromptFromImages: vi.fn(),
  extractAutoFromImages: vi.fn(),
}))

function field(value: string | null, confidence: ExtractionField['confidence'] = 'high'): ExtractionField {
  return {
    value,
    confidence,
    flagged: value == null,
  }
}

describe('national-general-auto schema integration', () => {
  it('loads expected required keys from national-general-auto schema', () => {
    const schema = getCarrierSchema('national-general-auto')
    const required = getRequiredSchemaFields(schema)

    expect(schema.id).toBe('national-general-auto')
    expect(schema.productType).toBe('auto')
    expect(schema.payload.supportsFieldsArray).toBe(true)

    const requiredScalarKeys = required
      .filter((f) => f.type !== 'array')
      .map((f) => f.key)

    expect(requiredScalarKeys).toEqual(
      expect.arrayContaining([
        'namedInsured.firstName',
        'namedInsured.lastName',
        'namedInsured.dateOfBirth',
        'namedInsured.mailingAddress',
        'namedInsured.city',
        'namedInsured.zipCode',
        'underwriting.residenceStatus',
      ]),
    )

    expect(required.some((f) => f.type === 'array' && f.key === 'drivers')).toBe(true)
    expect(required.some((f) => f.type === 'array' && f.key === 'vehicles')).toBe(true)
  })

  it('keeps indexed array keys and backfills missing scalar schema keys during extraction', async () => {
    vi.mocked(extractWithPromptFromImages).mockResolvedValue({
      fields: {
        'namedInsured.firstName': field('Nicholas'),
        'namedInsured.lastName': field('Elam'),
        'namedInsured.dateOfBirth': field('05/02/1991'),
        'drivers[0].firstName': field('Nicholas'),
        'drivers[0].lastName': field('Elam'),
        'vehicles[0].modelYear': field('2004'),
      },
      attachedStructures: [],
      constructionTypes: [],
    })
    vi.mocked(extractAutoFromImages).mockResolvedValue({
      personal: {
        ownerFirstName: field('Nicholas'),
        ownerLastName: field('Elam'),
        ownerDOB: field('1991-05-02'),
        maritalStatus: field('Married'),
        spouseFirstName: field('Sarah'),
        spouseLastName: field('Elam'),
        spouseDOB: field('1993-03-18'),
        streetAddress: field('123 Main St'),
        city: field('Birmingham'),
        state: field('AL'),
        zipCode: field('35244'),
        garagingAddressSameAsMailing: { value: true, confidence: 'high', flagged: false },
        garagingStreetAddress: field(null),
        garagingCity: field(null),
        garagingState: field(null),
        garagingZipCode: field(null),
        priorStreetAddress: field(null),
        priorCity: field(null),
        priorState: field(null),
        priorZipCode: field(null),
        yearsAtCurrentAddress: field('2'),
        phone: field('205-746-5350'),
        email: field('nicholas@example.com'),
        effectiveDate: field('2026-06-20'),
        ownerDriversLicense: field('A1234567'),
        ownerLicenseState: field('AL'),
        spouseDriversLicense: field('B1234567'),
        spouseLicenseState: field('AL'),
        ownerOccupation: field('Engineer'),
        spouseOccupation: field('Teacher'),
        ownerEducation: field('Bachelors'),
        spouseEducation: field('Bachelors'),
        rideShare: { value: false, confidence: 'high', flagged: false },
        delivery: { value: false, confidence: 'high', flagged: false },
      },
      additionalDrivers: [],
      vehicles: [],
      coverage: {
        bodilyInjury: field('25/50'),
        propertyDamage: field('25'),
        uninsuredMotorist: field('25/50'),
        underinsuredMotorist: field('25/50'),
        medicalPayments: field('1000'),
        towing: { value: false, confidence: 'high', flagged: false },
        rental: { value: false, confidence: 'high', flagged: false },
        offRoadVehicleLiability: { value: false, confidence: 'high', flagged: false },
      },
      lienholders: [],
      priorInsurance: {
        insuranceCompany: field('Carrier'),
        premium: field('1000'),
        policyNumber: field('ABC123'),
        expirationDate: field('2026-07-01'),
      },
      accidentsOrTickets: [],
    })

    const result = await extractCarrierFromImages(['fake-image'], 'national-general-auto')

    expect(result.carrierFields['namedInsured.firstName']?.value).toBe('Nicholas')
    expect(result.carrierFields['namedInsured.city']).toBeDefined()
    expect(result.carrierFields['namedInsured.city']?.value).toBeNull()
    expect(result.carrierFields['namedInsured.city']?.flagged).toBe(true)

    expect(result.carrierFields['drivers[0].firstName']?.value).toBe('Nicholas')
    expect(result.carrierFields['vehicles[0].modelYear']?.value).toBe('2004')
    expect(extractAutoFromImages).not.toHaveBeenCalled()
  })

  it('validates and builds submit payload using national-general-auto schema keys', () => {
    const requiredScalars = getRequiredSchemaFields(
      getCarrierSchema('national-general-auto'),
    )
      .filter((f) => f.type !== 'array')
      .map((f) => f.key)

    const carrierFields: Record<string, ExtractionField> = {
      'namedInsured.firstName': field('Nicholas'),
      'namedInsured.lastName': field('Elam'),
      'namedInsured.dateOfBirth': field('05/02/1991'),
      'namedInsured.mailingAddress': field('123 Main St'),
      'namedInsured.city': field('Birmingham'),
      'namedInsured.zipCode': field('35244'),
      'underwriting.residenceStatus': field('HCO'),
      'drivers[0].firstName': field('Nicholas'),
      'drivers[0].lastName': field('Elam'),
      'vehicles[0].modelYear': field('2004'),
      'coverages.payMethod': field('AS'),
      'coverages.payPlan': field('7076'),
    }

    const base = createEmptyHomeExtraction()
    const data: typeof base & {
      workflow: ReturnType<typeof createWorkflowMeta>
      carrierFields: Record<string, ExtractionField>
    } = {
      ...base,
      workflow: createWorkflowMeta('national-general-auto'),
      carrierFields,
    }

    const validation = validateCarrierExtraction(data, 'national-general-auto')
    expect(validation.valid).toBe(true)

    const submitFields = buildCarrierSubmitFields(data, 'national-general-auto')
    const submitKeys = submitFields.map((f) => f.key)

    expect(submitKeys).toEqual(expect.arrayContaining(requiredScalars))
    expect(submitKeys).toEqual(
      expect.arrayContaining([
        'drivers[0].firstName',
        'drivers[0].lastName',
        'vehicles[0].modelYear',
        'coverages.payMethod',
        'coverages.payPlan',
      ]),
    )
  })
})
