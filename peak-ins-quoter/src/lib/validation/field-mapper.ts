/**
 * Field Mapping Functions
 * Maps extraction results to quote data structures with normalization
 */

import type { ExtractionResult, ExtractionField } from '@/types/extraction';
import type {
  HomeQuoteData,
  AutoQuoteData,
  Address,
  HomeStyle,
  ConstructionType,
  MaritalStatus,
  VehicleUse,
  ConfidenceLevel,
} from '@/types/quote';

// =============================================================================
// Normalization Helpers
// =============================================================================

/**
 * Normalizes various date formats to MM/DD/YYYY
 * Handles: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, Month DD, YYYY, etc.
 */
export function normalizeDate(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';

  const cleaned = value.trim();
  if (!cleaned) return '';

  // Already in correct format MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    return cleaned;
  }

  // Format: M/D/YYYY or MM/D/YYYY or M/DD/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  }

  // Format: MM-DD-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  }

  // Format: YYYY-MM-DD (ISO)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${month}/${day}/${year}`;
  }

  // Format: Month DD, YYYY or Month D, YYYY
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const monthNameMatch = cleaned.toLowerCase().match(
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s*(\d{4})$/i
  );
  if (monthNameMatch) {
    const [, monthName, day, year] = monthNameMatch;
    const monthIndex = monthNames.indexOf(monthName.toLowerCase()) + 1;
    return `${monthIndex.toString().padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  }

  // Format: DD Month YYYY
  const dmyMatch = cleaned.toLowerCase().match(
    /^(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/i
  );
  if (dmyMatch) {
    const [, day, monthName, year] = dmyMatch;
    const monthIndex = monthNames.indexOf(monthName.toLowerCase()) + 1;
    return `${monthIndex.toString().padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  }

  // Try parsing as a date
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const day = parsed.getDate().toString().padStart(2, '0');
    const year = parsed.getFullYear();
    return `${month}/${day}/${year}`;
  }

  return cleaned; // Return original if no match
}

/**
 * Normalizes phone numbers to E.164 format (+1XXXXXXXXXX)
 */
export function normalizePhone(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';

  // Remove all non-digit characters
  let digits = value.replace(/\D/g, '');

  // Remove leading 1 if 11 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.substring(1);
  }

  // Must have exactly 10 digits for US number
  if (digits.length !== 10) {
    return value.trim(); // Return original if can't normalize
  }

  return `+1${digits}`;
}

/**
 * Normalizes SSN to XXX-XX-XXXX format
 */
export function normalizeSSN(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';

  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');

  // Must have exactly 9 digits
  if (digits.length !== 9) {
    return value.trim(); // Return original if can't normalize
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * Parses an address string into structured components
 * Handles formats like: "123 Main St, City, ST 12345"
 */
export function normalizeAddress(value: string | null | undefined): Address {
  const empty: Address = { street: '', city: '', state: '', zip: '' };

  if (!value || typeof value !== 'string') return empty;

  const cleaned = value.trim();
  if (!cleaned) return empty;

  // Try to parse: "Street, City, State ZIP" or "Street, City, State, ZIP"
  // Common patterns:
  // "123 Main St, Springfield, IL 62701"
  // "123 Main Street, Springfield, IL, 62701"

  // Extract ZIP code first (5 digits or 5+4)
  const zipMatch = cleaned.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
  const zip = zipMatch ? zipMatch[1] : '';
  let remaining = zipMatch ? cleaned.replace(zipMatch[0], '').trim() : cleaned;

  // Remove trailing comma if present
  remaining = remaining.replace(/,\s*$/, '');

  // Try to extract state (2-letter code at the end)
  const stateMatch = remaining.match(/,?\s*([A-Z]{2})\s*$/i);
  const state = stateMatch ? stateMatch[1].toUpperCase() : '';
  remaining = stateMatch ? remaining.replace(stateMatch[0], '').trim() : remaining;

  // Remove trailing comma
  remaining = remaining.replace(/,\s*$/, '');

  // Split by comma - first part is street, rest is city
  const parts = remaining.split(',').map(p => p.trim());

  if (parts.length >= 2) {
    return {
      street: parts[0],
      city: parts.slice(1).join(', '),
      state,
      zip,
    };
  }

  // If only one part, treat it all as street
  return {
    street: parts[0] || '',
    city: '',
    state,
    zip,
  };
}

/**
 * Helper to safely get extraction field value
 */
function getFieldValue(field: ExtractionField | undefined): string | null {
  if (!field) return null;
  return field.value ?? null;
}

/**
 * Helper to get confidence from extraction field
 */
export function getConfidence(field: ExtractionField | undefined): ConfidenceLevel {
  return field?.confidence ?? 'low';
}

// =============================================================================
// Field Name Mapping
// =============================================================================

// Maps common variations of field names to their canonical form
const FIELD_NAME_VARIATIONS: Record<string, string[]> = {
  // Date of Birth
  applicantDOB: ['date of birth', 'dob', 'birth date', 'birthdate', 'birthday', 'd.o.b.', 'd.o.b'],

  // SSN
  applicantSSN: ['social security', 'ssn', 'ss#', 'ss #', 'social security number', 'soc sec'],

  // Home Style
  homeStyle: ['dwelling type', 'home style', 'house style', 'property type', 'dwelling style', 'home type'],

  // Construction
  constructionType: ['construction', 'construction type', 'building type', 'structure type'],

  // Year Built
  yearBuilt: ['year built', 'built year', 'year constructed', 'construction year', 'age of home'],

  // Marital Status
  maritalStatus: ['marital status', 'married', 'single', 'relationship status'],

  // Vehicle Use
  vehicleUse: ['vehicle use', 'car use', 'primary use', 'usage', 'how is vehicle used'],

  // Phone
  phoneNumber: ['phone', 'phone number', 'telephone', 'tel', 'cell', 'mobile', 'contact number'],

  // Email
  email: ['email', 'e-mail', 'email address', 'e-mail address'],

  // Name
  name: ['name', 'full name', 'applicant name', 'insured name', 'policyholder'],

  // Spouse
  spouseName: ['spouse', 'spouse name', 'co-applicant', 'co applicant'],

  // Address
  address: ['address', 'street address', 'home address', 'mailing address', 'residence'],
};

/**
 * Finds the canonical field name for a given variation
 */
export function findCanonicalFieldName(rawName: string): string | null {
  const normalized = rawName.toLowerCase().trim();

  for (const [canonical, variations] of Object.entries(FIELD_NAME_VARIATIONS)) {
    if (variations.some(v => normalized.includes(v) || v.includes(normalized))) {
      return canonical;
    }
  }

  return null;
}

// =============================================================================
// Value Normalization for Enums
// =============================================================================

const HOME_STYLE_MAPPING: Record<string, HomeStyle> = {
  'colonial': 'Colonial',
  'ranch': 'Ranch',
  'split level': 'Split Level',
  'split-level': 'Split Level',
  'cape cod': 'Cape Cod',
  'cape': 'Cape Cod',
  'contemporary': 'Contemporary',
  'modern': 'Contemporary',
  'victorian': 'Victorian',
  'bi-level': 'Bi-Level',
  'bilevel': 'Bi-Level',
  'bi level': 'Bi-Level',
  'tri-level': 'Tri-Level',
  'trilevel': 'Tri-Level',
  'tri level': 'Tri-Level',
  'townhouse': 'Townhouse',
  'townhome': 'Townhouse',
  'row house': 'Row House',
  'rowhouse': 'Row House',
  'other': 'Other',
};

const CONSTRUCTION_TYPE_MAPPING: Record<string, ConstructionType> = {
  'frame': 'Frame',
  'wood frame': 'Frame',
  'wood': 'Frame',
  'masonry': 'Masonry',
  'brick': 'Masonry',
  'stone': 'Masonry',
  'concrete': 'Masonry',
  'frame/masonry': 'Frame/Masonry',
  'frame masonry': 'Frame/Masonry',
  'mixed': 'Frame/Masonry',
  'fire resistive': 'Fire Resistive',
  'fire-resistive': 'Fire Resistive',
  'fireproof': 'Fire Resistive',
  'other': 'Other',
};

const MARITAL_STATUS_MAPPING: Record<string, MaritalStatus> = {
  'single': 'Single',
  'unmarried': 'Single',
  'married': 'Married',
  'divorced': 'Divorced',
  'widowed': 'Widowed',
  'widow': 'Widowed',
  'widower': 'Widowed',
  'separated': 'Separated',
  'domestic partner': 'Domestic Partner',
  'domestic partnership': 'Domestic Partner',
  'civil union': 'Domestic Partner',
};

const VEHICLE_USE_MAPPING: Record<string, VehicleUse> = {
  'pleasure': 'Pleasure',
  'personal': 'Pleasure',
  'commute': 'Commute',
  'work': 'Commute',
  'to work': 'Commute',
  'business': 'Business',
  'commercial': 'Business',
  'farm': 'Farm',
  'agricultural': 'Farm',
};

function normalizeHomeStyle(value: string | null): HomeStyle | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().trim();
  return HOME_STYLE_MAPPING[key];
}

function normalizeConstructionType(value: string | null): ConstructionType | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().trim();
  return CONSTRUCTION_TYPE_MAPPING[key];
}

function normalizeMaritalStatus(value: string | null): MaritalStatus | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().trim();
  return MARITAL_STATUS_MAPPING[key];
}

function normalizeVehicleUse(value: string | null): VehicleUse | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().trim();
  return VEHICLE_USE_MAPPING[key];
}

// =============================================================================
// Extraction to Quote Mapping
// =============================================================================

/**
 * Maps extraction result to home quote data structure
 */
export function mapExtractionToHomeQuote(extraction: ExtractionResult): Partial<HomeQuoteData> {
  const personal = extraction.personal;

  // Build full name from first and last
  const firstName = getFieldValue(personal.firstName) || '';
  const lastName = getFieldValue(personal.lastName) || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  // Build address from components
  const address: Address = {
    street: getFieldValue(personal.address) || '',
    city: getFieldValue(personal.city) || '',
    state: getFieldValue(personal.state) || '',
    zip: getFieldValue(personal.zipCode) || '',
  };

  // If we have a combined address field but not components, try to parse it
  if (!address.city && !address.state && address.street) {
    const parsed = normalizeAddress(address.street);
    if (parsed.city) {
      Object.assign(address, parsed);
    }
  }

  // Normalize DOB
  const dob = normalizeDate(getFieldValue(personal.dateOfBirth));

  // Normalize phone
  const phone = normalizePhone(getFieldValue(personal.phone));

  // Normalize SSN
  const ssn = normalizeSSN(getFieldValue(personal.ssn));

  const result: Partial<HomeQuoteData> = {
    personal: {
      name: fullName,
      address,
      applicantDOB: dob,
      phoneNumber: phone || undefined,
      email: getFieldValue(personal.email) || undefined,
      applicantSSN: ssn || undefined,
    },
    home: {
      // These would typically come from a home-specific extraction
      // For now, set required fields to trigger validation
      yearBuilt: 0, // Will be invalid - requires manual entry
      constructionType: 'Frame', // Default placeholder
    },
  };

  return result;
}

/**
 * Maps extraction result to auto quote data structure
 */
export function mapExtractionToAutoQuote(extraction: ExtractionResult): Partial<AutoQuoteData> {
  const personal = extraction.personal;

  // Build full name
  const firstName = getFieldValue(personal.firstName) || '';
  const lastName = getFieldValue(personal.lastName) || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  // Build current address
  const currentAddress: Address = {
    street: getFieldValue(personal.address) || '',
    city: getFieldValue(personal.city) || '',
    state: getFieldValue(personal.state) || '',
    zip: getFieldValue(personal.zipCode) || '',
  };

  // Try to parse if combined
  if (!currentAddress.city && !currentAddress.state && currentAddress.street) {
    const parsed = normalizeAddress(currentAddress.street);
    if (parsed.city) {
      Object.assign(currentAddress, parsed);
    }
  }

  // Normalize phone
  const phone = normalizePhone(getFieldValue(personal.phone));

  // Get email
  const email = getFieldValue(personal.email);

  const result: Partial<AutoQuoteData> = {
    personal: {
      name: fullName,
      currentAddress,
      phoneNumber: phone || '', // Required field
      email: email || '', // Required field
      maritalStatus: 'Single', // Default - will need to be updated
      effectiveDate: '', // Required - user must provide
    },
    vehicleUsage: {},
    additionalDrivers: [],
    automobiles: [],
    coverages: {},
    deductibles: [],
    accidentsOrTickets: [],
  };

  return result;
}

/**
 * Combines personal info from fact finder with home-specific fields
 */
export function mergeHomeQuoteData(
  base: Partial<HomeQuoteData>,
  overrides: Partial<HomeQuoteData>
): Partial<HomeQuoteData> {
  return {
    personal: {
      ...base.personal,
      ...overrides.personal,
      address: {
        ...base.personal?.address,
        ...overrides.personal?.address,
      } as Address,
    } as HomeQuoteData['personal'],
    home: {
      ...base.home,
      ...overrides.home,
    } as HomeQuoteData['home'],
  };
}

/**
 * Combines personal info from fact finder with auto-specific fields
 */
export function mergeAutoQuoteData(
  base: Partial<AutoQuoteData>,
  overrides: Partial<AutoQuoteData>
): Partial<AutoQuoteData> {
  return {
    personal: {
      ...base.personal,
      ...overrides.personal,
      currentAddress: {
        ...base.personal?.currentAddress,
        ...overrides.personal?.currentAddress,
      } as Address,
    } as AutoQuoteData['personal'],
    vehicleUsage: {
      ...base.vehicleUsage,
      ...overrides.vehicleUsage,
    },
    additionalDrivers: [
      ...(base.additionalDrivers || []),
      ...(overrides.additionalDrivers || []),
    ],
    automobiles: [
      ...(base.automobiles || []),
      ...(overrides.automobiles || []),
    ],
    coverages: {
      ...base.coverages,
      ...overrides.coverages,
    },
    deductibles: [
      ...(base.deductibles || []),
      ...(overrides.deductibles || []),
    ],
    priorInsurance: {
      ...base.priorInsurance,
      ...overrides.priorInsurance,
    },
    accidentsOrTickets: [
      ...(base.accidentsOrTickets || []),
      ...(overrides.accidentsOrTickets || []),
    ],
  };
}

// =============================================================================
// Extended Field Mapping for Dynamic Extraction
// =============================================================================

export interface MappedField {
  targetPath: string;
  value: unknown;
  confidence: ConfidenceLevel;
  normalized: boolean;
}

/**
 * Maps a raw extracted field to its target location in quote data
 * Handles field name variations and value normalization
 */
export function mapExtractedField(
  rawFieldName: string,
  rawValue: string,
  confidence: ConfidenceLevel
): MappedField | null {
  const canonicalName = findCanonicalFieldName(rawFieldName);

  if (!canonicalName) {
    return null;
  }

  let value: unknown = rawValue;
  let normalized = false;

  // Apply normalization based on field type
  switch (canonicalName) {
    case 'applicantDOB':
      value = normalizeDate(rawValue);
      normalized = value !== rawValue;
      break;
    case 'applicantSSN':
      value = normalizeSSN(rawValue);
      normalized = value !== rawValue;
      break;
    case 'phoneNumber':
      value = normalizePhone(rawValue);
      normalized = value !== rawValue;
      break;
    case 'homeStyle':
      value = normalizeHomeStyle(rawValue);
      normalized = true;
      break;
    case 'constructionType':
      value = normalizeConstructionType(rawValue);
      normalized = true;
      break;
    case 'maritalStatus':
      value = normalizeMaritalStatus(rawValue);
      normalized = true;
      break;
    case 'vehicleUse':
      value = normalizeVehicleUse(rawValue);
      normalized = true;
      break;
    case 'address':
      value = normalizeAddress(rawValue);
      normalized = true;
      break;
  }

  // Determine target path based on canonical name
  let targetPath: string;
  switch (canonicalName) {
    case 'applicantDOB':
    case 'applicantSSN':
    case 'phoneNumber':
    case 'email':
    case 'name':
    case 'spouseName':
    case 'address':
    case 'maritalStatus':
      targetPath = `personal.${canonicalName}`;
      break;
    case 'homeStyle':
    case 'constructionType':
    case 'yearBuilt':
      targetPath = `home.${canonicalName}`;
      break;
    case 'vehicleUse':
      targetPath = `vehicleUsage.${canonicalName}`;
      break;
    default:
      targetPath = canonicalName;
  }

  return {
    targetPath,
    value,
    confidence,
    normalized,
  };
}
