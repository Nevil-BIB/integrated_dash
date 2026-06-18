/**
 * Unit tests for OpenRouter Zod validation schemas
 */

import { describe, it, expect } from 'vitest'
import {
  ExtractionFieldSchema,
  ExtractionBooleanFieldSchema,
  ConfidenceLevelSchema,
  validatePartialHomeExtraction,
  validatePartialAutoExtraction,
  validatePartialLegacyExtraction,
} from './schemas'

describe('ExtractionFieldSchema', () => {
  it('should accept valid extraction field', () => {
    const validField = {
      value: 'John',
      confidence: 'high',
      flagged: false,
    }
    const result = ExtractionFieldSchema.safeParse(validField)
    expect(result.success).toBe(true)
  })

  it('should accept null value', () => {
    const fieldWithNull = {
      value: null,
      confidence: 'low',
      flagged: true,
    }
    const result = ExtractionFieldSchema.safeParse(fieldWithNull)
    expect(result.success).toBe(true)
  })

  it('should accept optional rawText', () => {
    const fieldWithRaw = {
      value: 'John',
      confidence: 'medium',
      flagged: false,
      rawText: 'JOHN',
    }
    const result = ExtractionFieldSchema.safeParse(fieldWithRaw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rawText).toBe('JOHN')
    }
  })

  it('should reject invalid confidence level', () => {
    const invalidField = {
      value: 'John',
      confidence: 'very_high', // Invalid
      flagged: false,
    }
    const result = ExtractionFieldSchema.safeParse(invalidField)
    expect(result.success).toBe(false)
  })

  it('should reject missing required fields', () => {
    const missingConfidence = {
      value: 'John',
      flagged: false,
    }
    expect(ExtractionFieldSchema.safeParse(missingConfidence).success).toBe(false)

    const missingFlagged = {
      value: 'John',
      confidence: 'high',
    }
    expect(ExtractionFieldSchema.safeParse(missingFlagged).success).toBe(false)
  })
})

describe('ExtractionBooleanFieldSchema', () => {
  it('should accept valid boolean field', () => {
    const validField = {
      value: true,
      confidence: 'high',
      flagged: false,
    }
    const result = ExtractionBooleanFieldSchema.safeParse(validField)
    expect(result.success).toBe(true)
  })

  it('should accept false value', () => {
    const falseField = {
      value: false,
      confidence: 'medium',
      flagged: false,
    }
    const result = ExtractionBooleanFieldSchema.safeParse(falseField)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.value).toBe(false)
    }
  })

  it('should accept null value', () => {
    const nullField = {
      value: null,
      confidence: 'low',
      flagged: true,
    }
    const result = ExtractionBooleanFieldSchema.safeParse(nullField)
    expect(result.success).toBe(true)
  })

  it('should reject string value', () => {
    const invalidField = {
      value: 'yes', // Should be boolean
      confidence: 'high',
      flagged: false,
    }
    const result = ExtractionBooleanFieldSchema.safeParse(invalidField)
    expect(result.success).toBe(false)
  })
})

describe('ConfidenceLevelSchema', () => {
  it('should accept valid confidence levels', () => {
    expect(ConfidenceLevelSchema.safeParse('high').success).toBe(true)
    expect(ConfidenceLevelSchema.safeParse('medium').success).toBe(true)
    expect(ConfidenceLevelSchema.safeParse('low').success).toBe(true)
  })

  it('should reject invalid confidence levels', () => {
    expect(ConfidenceLevelSchema.safeParse('HIGH').success).toBe(false)
    expect(ConfidenceLevelSchema.safeParse('very_low').success).toBe(false)
    expect(ConfidenceLevelSchema.safeParse('').success).toBe(false)
  })
})

describe('validatePartialHomeExtraction', () => {
  it('should validate a complete personal section', () => {
    const partial = {
      personal: {
        firstName: { value: 'John', confidence: 'high', flagged: false },
        lastName: { value: 'Doe', confidence: 'high', flagged: false },
        dateOfBirth: { value: '1980-01-15', confidence: 'medium', flagged: false },
        ssn: { value: null, confidence: 'low', flagged: true },
        spouseFirstName: { value: null, confidence: 'low', flagged: true },
        spouseLastName: { value: null, confidence: 'low', flagged: true },
        spouseDateOfBirth: { value: null, confidence: 'low', flagged: true },
        spouseSsn: { value: null, confidence: 'low', flagged: true },
        streetAddress: { value: '123 Main St', confidence: 'high', flagged: false },
        city: { value: 'San Francisco', confidence: 'high', flagged: false },
        state: { value: 'CA', confidence: 'high', flagged: false },
        zipCode: { value: '94102', confidence: 'high', flagged: false },
        priorStreetAddress: { value: null, confidence: 'low', flagged: true },
        priorCity: { value: null, confidence: 'low', flagged: true },
        priorState: { value: null, confidence: 'low', flagged: true },
        priorZipCode: { value: null, confidence: 'low', flagged: true },
        yearsAtCurrentAddress: { value: '10', confidence: 'high', flagged: false },
        phone: { value: '(415) 555-1234', confidence: 'high', flagged: false },
        email: { value: 'john@example.com', confidence: 'high', flagged: false },
      },
    }

    const result = validatePartialHomeExtraction(partial)
    expect(result.success).toBe(true)
  })

  it('should validate an empty partial result', () => {
    const emptyPartial = {}
    const result = validatePartialHomeExtraction(emptyPartial)
    expect(result.success).toBe(true)
  })

  it('should return error details for invalid data', () => {
    const invalidData = {
      personal: {
        firstName: { value: 123 }, // Should be string, missing required fields
      },
    }

    const result = validatePartialHomeExtraction(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })
})

describe('validatePartialAutoExtraction', () => {
  it('should validate personal info with auto-specific fields', () => {
    const partial = {
      personal: {
        effectiveDate: { value: '2024-01-15', confidence: 'high', flagged: false },
        ownerFirstName: { value: 'John', confidence: 'high', flagged: false },
        ownerLastName: { value: 'Doe', confidence: 'high', flagged: false },
        ownerDOB: { value: '1980-01-15', confidence: 'high', flagged: false },
        maritalStatus: { value: 'Single', confidence: 'high', flagged: false },
        spouseFirstName: { value: null, confidence: 'low', flagged: true },
        spouseLastName: { value: null, confidence: 'low', flagged: true },
        spouseDOB: { value: null, confidence: 'low', flagged: true },
        streetAddress: { value: '123 Main St', confidence: 'high', flagged: false },
        city: { value: 'San Francisco', confidence: 'high', flagged: false },
        state: { value: 'CA', confidence: 'high', flagged: false },
        zipCode: { value: '94102', confidence: 'high', flagged: false },
        garagingAddressSameAsMailing: { value: true, confidence: 'high', flagged: false },
        garagingStreetAddress: { value: null, confidence: 'low', flagged: true },
        garagingCity: { value: null, confidence: 'low', flagged: true },
        garagingState: { value: null, confidence: 'low', flagged: true },
        garagingZipCode: { value: null, confidence: 'low', flagged: true },
        priorStreetAddress: { value: null, confidence: 'low', flagged: true },
        priorCity: { value: null, confidence: 'low', flagged: true },
        priorState: { value: null, confidence: 'low', flagged: true },
        priorZipCode: { value: null, confidence: 'low', flagged: true },
        yearsAtCurrentAddress: { value: '5', confidence: 'high', flagged: false },
        phone: { value: '(415) 555-1234', confidence: 'high', flagged: false },
        email: { value: 'john@example.com', confidence: 'high', flagged: false },
        ownerDriversLicense: { value: 'D1234567', confidence: 'high', flagged: false },
        ownerLicenseState: { value: 'CA', confidence: 'high', flagged: false },
        spouseDriversLicense: { value: null, confidence: 'low', flagged: true },
        spouseLicenseState: { value: null, confidence: 'low', flagged: true },
        ownerOccupation: { value: 'Engineer', confidence: 'high', flagged: false },
        spouseOccupation: { value: null, confidence: 'low', flagged: true },
        ownerEducation: { value: 'Bachelors', confidence: 'high', flagged: false },
        spouseEducation: { value: null, confidence: 'low', flagged: true },
        rideShare: { value: false, confidence: 'high', flagged: false },
        delivery: { value: false, confidence: 'high', flagged: false },
      },
    }

    const result = validatePartialAutoExtraction(partial)
    expect(result.success).toBe(true)
  })

  it('should validate vehicles array', () => {
    const partial = {
      vehicles: [
        {
          year: { value: '2020', confidence: 'high', flagged: false },
          make: { value: 'Toyota', confidence: 'high', flagged: false },
          model: { value: 'Camry', confidence: 'high', flagged: false },
          vin: { value: '1HGBH41JXMN109186', confidence: 'high', flagged: false },
          estimatedMileage: { value: '50000', confidence: 'medium', flagged: false },
          vehicleUsage: { value: 'commute', confidence: 'high', flagged: false },
          ownership: { value: 'financed', confidence: 'high', flagged: false },
        },
      ],
    }

    const result = validatePartialAutoExtraction(partial)
    expect(result.success).toBe(true)
  })

  it('should validate empty arrays', () => {
    const partial = {
      vehicles: [],
      additionalDrivers: [],
      deductibles: [],
      lienholders: [],
      accidentsOrTickets: [],
    }

    const result = validatePartialAutoExtraction(partial)
    expect(result.success).toBe(true)
  })
})

describe('validatePartialLegacyExtraction', () => {
  it('should validate legacy extraction format', () => {
    const partial = {
      personal: {
        firstName: { value: 'John', confidence: 'high', flagged: false },
        lastName: { value: 'Doe', confidence: 'high', flagged: false },
        dateOfBirth: { value: '1980-01-15', confidence: 'medium', flagged: false },
        ssn: { value: '123-45-6789', confidence: 'high', flagged: false },
        address: { value: '123 Main St', confidence: 'high', flagged: false },
        city: { value: 'San Francisco', confidence: 'high', flagged: false },
        state: { value: 'CA', confidence: 'high', flagged: false },
        zipCode: { value: '94102', confidence: 'high', flagged: false },
        phone: { value: '(415) 555-1234', confidence: 'high', flagged: false },
        email: { value: 'john@example.com', confidence: 'high', flagged: false },
      },
      employment: {
        employer: { value: 'Acme Corp', confidence: 'high', flagged: false },
        occupation: { value: 'Engineer', confidence: 'high', flagged: false },
        income: { value: '100000', confidence: 'medium', flagged: false },
        yearsEmployed: { value: '5', confidence: 'high', flagged: false },
      },
    }

    const result = validatePartialLegacyExtraction(partial)
    expect(result.success).toBe(true)
  })
})
