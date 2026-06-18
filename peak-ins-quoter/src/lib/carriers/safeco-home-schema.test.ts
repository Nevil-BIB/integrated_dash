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

describe('safeco-home schema integration', () => {
  it('loads expected required keys from safeco-home schema', () => {
    const schema = getCarrierSchema('safeco-home')
    const required = getRequiredSchemaFields(schema).map((f) => f.key)

    expect(schema.id).toBe('safeco-home')
    expect(schema.productType).toBe('home')
    expect(schema.payload.supportsFieldsArray).toBe(true)
    expect(required).toEqual(
      expect.arrayContaining([
        'quoteSetup.ratingState',
        'quoteSetup.policyForm',
        'quoteSetup.agentNumber',
        'quoteSetup.effectiveDate',
        'applicant.firstName',
        'applicant.lastName',
        'address.mailingAddressLine1',
        'underwriting.currentlyInsured',
        'dwellingInformation.roofRenovation',
      ]),
    )
  })

  it('normalizes extraction output to include missing scalar schema keys', async () => {
    vi.mocked(extractWithPromptFromImages).mockResolvedValue({
      fields: {
        'quoteSetup.ratingState': field('Alabama'),
        'quoteSetup.policyForm': field('Homeowners'),
        'quoteSetup.agentNumber': field('40-0591'),
        'applicant.firstName': field('John'),
        'applicant.lastName': field('Doe'),
      },
      attachedStructures: [],
      constructionTypes: [],
    })
    vi.mocked(extractAutoFromImages).mockResolvedValue({
      personal: {} as never,
      additionalDrivers: [],
      vehicles: [],
      coverage: {} as never,
      lienholders: [],
      priorInsurance: {} as never,
      accidentsOrTickets: [],
    })

    const result = await extractCarrierFromImages(['fake-image'], 'safeco-home')

    expect(result.carrierFields['applicant.firstName']?.value).toBe('John')
    expect(result.carrierFields['address.mailingAddressLine1']).toBeDefined()
    expect(result.carrierFields['address.mailingAddressLine1']?.value).toBeNull()
    expect(result.carrierFields['address.mailingAddressLine1']?.flagged).toBe(true)
  })

  it('validates and builds submit payload using safeco-home schema keys', () => {
    const carrierFields: Record<string, ExtractionField> = {
      'quoteSetup.ratingState': field('Alabama'),
      'quoteSetup.policyForm': field('Homeowners'),
      'quoteSetup.agentNumber': field('40-0591'),
      'quoteSetup.quoteDate': field('06/15/2026'),
      'quoteSetup.effectiveDate': field('07/01/2026'),
      'applicant.firstName': field('John'),
      'applicant.lastName': field('Doe'),
      'applicant.birthDate': field('01/15/1985'),
      'applicant.maritalStatus': field('Married'),
      'applicant.coApplicantPresent': field('No'),
      'applicant.primaryPhone': field('5551234567'),
      'applicant.reasonForPolicy': field('New property customer to Safeco'),
      'applicant.additionalInterestsPresent': field('No'),
      'address.mailingAddressLine1': field('123 Main St'),
      'address.mailingCity': field('Birmingham'),
      'address.mailingState': field('AL'),
      'address.mailingZipCode': field('35203'),
      'address.locationSameAsMailing': field('Yes'),
      'underwriting.underConstruction': field('No'),
      'underwriting.businessOnPremises': field('No'),
      'underwriting.rentedToOthers': field('No'),
      'underwriting.undesirableAnimal': field('No'),
      'underwriting.dogsOwned': field('0'),
      'underwriting.horsesLivestock': field('No'),
      'underwriting.monthsOccupied': field('9-12 (Primary)'),
      'underwriting.currentlyInsured': field('Yes'),
      'underwriting.dwellingHazards': field('No'),
      'underwriting.occupants': field('3'),
      'underwriting.insuranceCancelled': field('No'),
      'underwriting.lossesLastFiveYears': field('0'),
      'underwriting.ownershipMonth': field('November'),
      'underwriting.ownershipYear': field('2022'),
      'dwellingInformation.outdatedElectrical': field('No'),
      'dwellingInformation.dwellingLocatedIn': field('Suburb'),
      'dwellingInformation.roofRenovation': field('Full'),
      'dwellingInformation.plumbingRenovation': field('Partial'),
    }

    const base = createEmptyHomeExtraction()
    const data: typeof base & {
      workflow: ReturnType<typeof createWorkflowMeta>
      carrierFields: Record<string, ExtractionField>
    } = {
      ...base,
      workflow: createWorkflowMeta('safeco-home'),
      carrierFields,
    }

    const validation = validateCarrierExtraction(data, 'safeco-home')
    expect(validation.valid).toBe(true)

    const submitFields = buildCarrierSubmitFields(data, 'safeco-home')
    const submitKeys = submitFields.map((f) => f.key)

    expect(submitKeys).toEqual(
      expect.arrayContaining([
        'quoteSetup.policyForm',
        'applicant.firstName',
        'address.mailingAddressLine1',
        'underwriting.currentlyInsured',
        'dwellingInformation.roofRenovation',
      ]),
    )
  })
})
