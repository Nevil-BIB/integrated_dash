/**
 * Validation Module Exports
 */

// Quote validation functions
export {
  validateHomeQuote,
  validateAutoQuote,
  validateQuote,
  isValidDateFormat,
  isValidE164Phone,
  isValidSSNFormat,
  isValidEmail,
  isValidYear,
  isValidAddress,
  isValidZipCode,
} from './quote-validator';

// Field mapping functions
export {
  normalizeDate,
  normalizePhone,
  normalizeSSN,
  normalizeAddress,
  mapExtractionToHomeQuote,
  mapExtractionToAutoQuote,
  mergeHomeQuoteData,
  mergeAutoQuoteData,
  findCanonicalFieldName,
  mapExtractedField,
  getConfidence,
} from './field-mapper';

// Re-export types for convenience
export type { MappedField } from './field-mapper';
