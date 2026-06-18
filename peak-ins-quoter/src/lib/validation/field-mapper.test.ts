/**
 * Unit tests for field-mapper functions
 * Tests date/phone/SSN normalization and extraction-to-quote mapping
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeDate,
  normalizePhone,
  normalizeSSN,
  normalizeAddress,
  findCanonicalFieldName,
  mapExtractedField,
} from './field-mapper'

describe('Date Normalization', () => {
  describe('normalizeDate', () => {
    it('should return date already in MM/DD/YYYY format unchanged', () => {
      expect(normalizeDate('01/15/2024')).toBe('01/15/2024')
      expect(normalizeDate('12/31/1990')).toBe('12/31/1990')
    })

    it('should normalize single-digit month and day formats', () => {
      expect(normalizeDate('1/5/2024')).toBe('01/05/2024')
      expect(normalizeDate('3/15/2020')).toBe('03/15/2020')
      expect(normalizeDate('12/5/2020')).toBe('12/05/2020')
    })

    it('should convert dash-delimited dates', () => {
      expect(normalizeDate('01-15-2024')).toBe('01/15/2024')
      expect(normalizeDate('1-5-2024')).toBe('01/05/2024')
    })

    it('should convert ISO format dates (YYYY-MM-DD)', () => {
      expect(normalizeDate('2024-01-15')).toBe('01/15/2024')
      expect(normalizeDate('1990-12-31')).toBe('12/31/1990')
    })

    it('should parse month name formats (Month DD, YYYY)', () => {
      expect(normalizeDate('January 15, 2024')).toBe('01/15/2024')
      expect(normalizeDate('December 31, 1990')).toBe('12/31/1990')
      expect(normalizeDate('march 5, 2020')).toBe('03/05/2020') // lowercase
    })

    it('should parse European format (DD Month YYYY)', () => {
      expect(normalizeDate('15 January 2024')).toBe('01/15/2024')
      expect(normalizeDate('5 march 2020')).toBe('03/05/2020')
    })

    it('should return empty string for invalid input', () => {
      expect(normalizeDate('')).toBe('')
      expect(normalizeDate(null)).toBe('')
      expect(normalizeDate(undefined)).toBe('')
    })

    it('should return original string if format cannot be determined', () => {
      expect(normalizeDate('invalid date')).toBe('invalid date')
    })
  })
})

describe('Phone Number Normalization', () => {
  describe('normalizePhone', () => {
    it('should normalize 10-digit phone numbers to E.164', () => {
      expect(normalizePhone('4155551234')).toBe('+14155551234')
      expect(normalizePhone('415-555-1234')).toBe('+14155551234')
      expect(normalizePhone('(415) 555-1234')).toBe('+14155551234')
      expect(normalizePhone('415.555.1234')).toBe('+14155551234')
    })

    it('should handle 11-digit numbers with leading 1', () => {
      expect(normalizePhone('14155551234')).toBe('+14155551234')
      expect(normalizePhone('1-415-555-1234')).toBe('+14155551234')
    })

    it('should return original if wrong length', () => {
      expect(normalizePhone('555-1234')).toBe('555-1234') // Only 7 digits
      expect(normalizePhone('123')).toBe('123')
    })

    it('should return empty string for invalid input', () => {
      expect(normalizePhone('')).toBe('')
      expect(normalizePhone(null)).toBe('')
      expect(normalizePhone(undefined)).toBe('')
    })
  })
})

describe('SSN Normalization', () => {
  describe('normalizeSSN', () => {
    it('should format 9 consecutive digits into XXX-XX-XXXX', () => {
      expect(normalizeSSN('123456789')).toBe('123-45-6789')
    })

    it('should handle SSNs with existing formatting', () => {
      expect(normalizeSSN('123 45 6789')).toBe('123-45-6789')
      expect(normalizeSSN('123.45.6789')).toBe('123-45-6789')
    })

    it('should return original if wrong digit count', () => {
      expect(normalizeSSN('12345678')).toBe('12345678') // 8 digits
      expect(normalizeSSN('1234567890')).toBe('1234567890') // 10 digits
    })

    it('should return empty string for invalid input', () => {
      expect(normalizeSSN('')).toBe('')
      expect(normalizeSSN(null)).toBe('')
      expect(normalizeSSN(undefined)).toBe('')
    })
  })
})

describe('Address Normalization', () => {
  describe('normalizeAddress', () => {
    it('should parse complete address with ZIP', () => {
      const result = normalizeAddress('123 Main St, San Francisco, CA 94102')
      expect(result.street).toBe('123 Main St')
      expect(result.city).toBe('San Francisco')
      expect(result.state).toBe('CA')
      expect(result.zip).toBe('94102')
    })

    it('should handle ZIP+4 format', () => {
      const result = normalizeAddress('456 Oak Ave, Springfield, IL 62701-1234')
      expect(result.zip).toBe('62701-1234')
    })

    it('should extract state even with comma after it', () => {
      const result = normalizeAddress('789 Pine Rd, Austin, TX, 78701')
      expect(result.state).toBe('TX')
      expect(result.zip).toBe('78701')
    })

    it('should return empty address for invalid input', () => {
      const emptyResult = normalizeAddress('')
      expect(emptyResult.street).toBe('')
      expect(emptyResult.city).toBe('')
      expect(emptyResult.state).toBe('')
      expect(emptyResult.zip).toBe('')

      const nullResult = normalizeAddress(null)
      expect(nullResult.street).toBe('')
    })
  })
})

describe('Field Name Mapping', () => {
  describe('findCanonicalFieldName', () => {
    it('should find canonical name for date of birth variations', () => {
      expect(findCanonicalFieldName('date of birth')).toBe('applicantDOB')
      expect(findCanonicalFieldName('DOB')).toBe('applicantDOB')
      expect(findCanonicalFieldName('Birth Date')).toBe('applicantDOB')
      expect(findCanonicalFieldName('D.O.B.')).toBe('applicantDOB')
    })

    it('should find canonical name for SSN variations', () => {
      expect(findCanonicalFieldName('social security')).toBe('applicantSSN')
      expect(findCanonicalFieldName('SSN')).toBe('applicantSSN')
      expect(findCanonicalFieldName('SS#')).toBe('applicantSSN')
    })

    it('should find canonical name for phone variations', () => {
      expect(findCanonicalFieldName('phone number')).toBe('phoneNumber')
      expect(findCanonicalFieldName('cell')).toBe('phoneNumber')
      expect(findCanonicalFieldName('mobile')).toBe('phoneNumber')
      expect(findCanonicalFieldName('telephone')).toBe('phoneNumber')
    })

    it('should find canonical name for address variations', () => {
      expect(findCanonicalFieldName('street address')).toBe('address')
      expect(findCanonicalFieldName('home address')).toBe('address')
      expect(findCanonicalFieldName('mailing address')).toBe('address')
    })

    it('should return null for unrecognized field names', () => {
      expect(findCanonicalFieldName('random field')).toBeNull()
      expect(findCanonicalFieldName('xyz123')).toBeNull()
    })
  })
})

describe('Field Mapping', () => {
  describe('mapExtractedField', () => {
    it('should map and normalize date fields', () => {
      const result = mapExtractedField('date of birth', '2024-01-15', 'high')
      expect(result).not.toBeNull()
      expect(result!.targetPath).toBe('personal.applicantDOB')
      expect(result!.value).toBe('01/15/2024')
      expect(result!.confidence).toBe('high')
      expect(result!.normalized).toBe(true)
    })

    it('should map and normalize phone fields', () => {
      const result = mapExtractedField('phone', '(415) 555-1234', 'medium')
      expect(result).not.toBeNull()
      expect(result!.targetPath).toBe('personal.phoneNumber')
      expect(result!.value).toBe('+14155551234')
      expect(result!.normalized).toBe(true)
    })

    it('should map and normalize SSN fields', () => {
      const result = mapExtractedField('social security', '123456789', 'high')
      expect(result).not.toBeNull()
      expect(result!.targetPath).toBe('personal.applicantSSN')
      expect(result!.value).toBe('123-45-6789')
      expect(result!.normalized).toBe(true)
    })

    it('should return null for unrecognized field names', () => {
      const result = mapExtractedField('unknown field', 'value', 'low')
      expect(result).toBeNull()
    })

    it('should map home style to correct target path', () => {
      const result = mapExtractedField('dwelling type', 'ranch', 'high')
      expect(result).not.toBeNull()
      expect(result!.targetPath).toBe('home.homeStyle')
    })

    it('should map marital status to personal section', () => {
      const result = mapExtractedField('marital status', 'married', 'high')
      expect(result).not.toBeNull()
      expect(result!.targetPath).toBe('personal.maritalStatus')
      expect(result!.value).toBe('Married')
    })
  })
})
