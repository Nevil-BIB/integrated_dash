/**
 * Unit tests for quote validation functions
 */

import { describe, it, expect } from 'vitest'
import {
  isValidDateFormat,
  isValidE164Phone,
  isValidSSNFormat,
  isValidEmail,
  isValidYear,
  isValidZipCode,
  isValidAddress,
} from './quote-validator'

describe('Date Format Validation', () => {
  describe('isValidDateFormat', () => {
    it('should accept valid date format MM/DD/YYYY', () => {
      expect(isValidDateFormat('01/15/2024')).toBe(true)
      expect(isValidDateFormat('12/31/1990')).toBe(true)
      expect(isValidDateFormat('06/01/2000')).toBe(true)
    })

    it('should reject invalid month values', () => {
      expect(isValidDateFormat('00/15/2024')).toBe(false) // Month 00
      expect(isValidDateFormat('13/15/2024')).toBe(false) // Month 13
    })

    it('should reject invalid day values', () => {
      expect(isValidDateFormat('01/00/2024')).toBe(false) // Day 00
      expect(isValidDateFormat('01/32/2024')).toBe(false) // Day 32
    })

    it('should validate leap year dates', () => {
      expect(isValidDateFormat('02/29/2024')).toBe(true) // 2024 is a leap year
      expect(isValidDateFormat('02/29/2023')).toBe(false) // 2023 is not a leap year
    })

    it('should reject incorrect formats', () => {
      expect(isValidDateFormat('1/15/2024')).toBe(false) // Single digit month
      expect(isValidDateFormat('01-15-2024')).toBe(false) // Wrong delimiter
      expect(isValidDateFormat('2024/01/15')).toBe(false) // Wrong order
      expect(isValidDateFormat('01/15/24')).toBe(false) // 2-digit year
    })

    it('should reject empty or null values', () => {
      expect(isValidDateFormat('')).toBe(false)
      expect(isValidDateFormat(null as unknown as string)).toBe(false)
      expect(isValidDateFormat(undefined as unknown as string)).toBe(false)
    })
  })
})

describe('Phone Number Validation', () => {
  describe('isValidE164Phone', () => {
    it('should accept valid E.164 US phone numbers', () => {
      expect(isValidE164Phone('+14155551234')).toBe(true)
      expect(isValidE164Phone('+10000000000')).toBe(true)
      expect(isValidE164Phone('+19999999999')).toBe(true)
    })

    it('should reject non-US country codes', () => {
      expect(isValidE164Phone('+44155551234')).toBe(false)
      expect(isValidE164Phone('+614155551234')).toBe(false)
    })

    it('should reject incorrect length', () => {
      expect(isValidE164Phone('+1415555123')).toBe(false) // 9 digits
      expect(isValidE164Phone('+141555512345')).toBe(false) // 11 digits
    })

    it('should reject missing + prefix', () => {
      expect(isValidE164Phone('14155551234')).toBe(false)
    })

    it('should reject formatted numbers', () => {
      expect(isValidE164Phone('+1 415-555-1234')).toBe(false)
      expect(isValidE164Phone('+1(415)555-1234')).toBe(false)
    })

    it('should reject empty values', () => {
      expect(isValidE164Phone('')).toBe(false)
      expect(isValidE164Phone(null as unknown as string)).toBe(false)
    })
  })
})

describe('SSN Validation', () => {
  describe('isValidSSNFormat', () => {
    it('should accept valid SSN format XXX-XX-XXXX', () => {
      expect(isValidSSNFormat('123-45-6789')).toBe(true)
      expect(isValidSSNFormat('000-00-0000')).toBe(true)
      expect(isValidSSNFormat('999-99-9999')).toBe(true)
    })

    it('should reject unformatted SSN', () => {
      expect(isValidSSNFormat('123456789')).toBe(false)
    })

    it('should reject incorrect delimiter', () => {
      expect(isValidSSNFormat('123 45 6789')).toBe(false)
      expect(isValidSSNFormat('123.45.6789')).toBe(false)
    })

    it('should reject wrong segment lengths', () => {
      expect(isValidSSNFormat('12-345-6789')).toBe(false)
      expect(isValidSSNFormat('1234-56-789')).toBe(false)
    })

    it('should reject empty values', () => {
      expect(isValidSSNFormat('')).toBe(false)
    })
  })
})

describe('Email Validation', () => {
  describe('isValidEmail', () => {
    it('should accept valid email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('user.name@example.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.org')).toBe(true)
      expect(isValidEmail('firstname.lastname@subdomain.example.com')).toBe(true)
    })

    it('should reject missing @ symbol', () => {
      expect(isValidEmail('userexample.com')).toBe(false)
    })

    it('should reject missing domain', () => {
      expect(isValidEmail('user@')).toBe(false)
    })

    it('should reject missing local part', () => {
      expect(isValidEmail('@example.com')).toBe(false)
    })

    it('should reject spaces', () => {
      expect(isValidEmail('user @example.com')).toBe(false)
      expect(isValidEmail('user@ example.com')).toBe(false)
    })

    it('should reject empty values', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail(null as unknown as string)).toBe(false)
    })
  })
})

describe('Year Validation', () => {
  describe('isValidYear', () => {
    const currentYear = new Date().getFullYear()

    it('should accept valid years', () => {
      expect(isValidYear(2024)).toBe(true)
      expect(isValidYear(1900)).toBe(true)
      expect(isValidYear(currentYear)).toBe(true)
      expect(isValidYear(currentYear + 1)).toBe(true) // Next year (for new vehicles)
    })

    it('should reject years too far in the past', () => {
      expect(isValidYear(1799)).toBe(false)
      expect(isValidYear(1700)).toBe(false)
    })

    it('should reject years too far in the future', () => {
      expect(isValidYear(currentYear + 2)).toBe(false)
      expect(isValidYear(3000)).toBe(false)
    })

    it('should reject non-integer values', () => {
      expect(isValidYear(2024.5)).toBe(false)
      expect(isValidYear(NaN)).toBe(false)
    })
  })
})

describe('Zip Code Validation', () => {
  describe('isValidZipCode', () => {
    it('should accept 5-digit zip codes', () => {
      expect(isValidZipCode('94102')).toBe(true)
      expect(isValidZipCode('00001')).toBe(true)
      expect(isValidZipCode('99999')).toBe(true)
    })

    it('should accept ZIP+4 format', () => {
      expect(isValidZipCode('94102-1234')).toBe(true)
      expect(isValidZipCode('00001-0000')).toBe(true)
    })

    it('should reject wrong length', () => {
      expect(isValidZipCode('9410')).toBe(false) // 4 digits
      expect(isValidZipCode('941022')).toBe(false) // 6 digits
    })

    it('should reject non-numeric characters', () => {
      expect(isValidZipCode('9410A')).toBe(false)
      expect(isValidZipCode('ABCDE')).toBe(false)
    })

    it('should reject invalid ZIP+4 format', () => {
      expect(isValidZipCode('94102-123')).toBe(false) // Only 3 after dash
      expect(isValidZipCode('94102-12345')).toBe(false) // 5 after dash
    })

    it('should reject empty values', () => {
      expect(isValidZipCode('')).toBe(false)
      expect(isValidZipCode(null as unknown as string)).toBe(false)
    })
  })
})

describe('Address Validation', () => {
  describe('isValidAddress', () => {
    it('should accept valid complete address', () => {
      expect(isValidAddress({
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102'
      })).toBe(true)
    })

    it('should reject missing street', () => {
      expect(isValidAddress({
        city: 'San Francisco',
        state: 'CA',
        zip: '94102'
      })).toBe(false)
    })

    it('should reject missing city', () => {
      expect(isValidAddress({
        street: '123 Main St',
        state: 'CA',
        zip: '94102'
      })).toBe(false)
    })

    it('should reject missing state', () => {
      expect(isValidAddress({
        street: '123 Main St',
        city: 'San Francisco',
        zip: '94102'
      })).toBe(false)
    })

    it('should reject missing zip', () => {
      expect(isValidAddress({
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA'
      })).toBe(false)
    })

    it('should reject empty strings', () => {
      expect(isValidAddress({
        street: '',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102'
      })).toBe(false)

      expect(isValidAddress({
        street: '   ', // whitespace only
        city: 'San Francisco',
        state: 'CA',
        zip: '94102'
      })).toBe(false)
    })

    it('should reject undefined address', () => {
      expect(isValidAddress(undefined)).toBe(false)
    })

    it('should reject empty object', () => {
      expect(isValidAddress({})).toBe(false)
    })
  })
})
