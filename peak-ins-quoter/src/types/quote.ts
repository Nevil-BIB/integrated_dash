/**
 * Quote Validation Types
 * Type definitions for home and auto insurance quote data structures
 */

// =============================================================================
// Address Types
// =============================================================================

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

// =============================================================================
// Home Quote Types
// =============================================================================

export type HomeStyle =
  | 'Colonial'
  | 'Ranch'
  | 'Split Level'
  | 'Cape Cod'
  | 'Contemporary'
  | 'Victorian'
  | 'Bi-Level'
  | 'Tri-Level'
  | 'Townhouse'
  | 'Row House'
  | 'Other';

export type ConstructionType =
  | 'Frame'
  | 'Masonry'
  | 'Frame/Masonry'
  | 'Fire Resistive'
  | 'Other';

export type FoundationType =
  | 'Basement'
  | 'Crawl Space'
  | 'Slab'
  | 'Pier/Post'
  | 'Other';

export type FoundationMaterial =
  | 'Poured Concrete'
  | 'Block'
  | 'Stone'
  | 'Brick'
  | 'Other';

export type RoomQuality = 'Basic' | 'Standard' | 'Custom' | 'Designer';

export interface HomeQuotePersonal {
  name: string; // Required - "First Last"
  spouseName?: string;
  address: Address; // Required
  priorAddress?: Address; // Required if < 5 years at current
  phoneNumber?: string; // E.164 format
  email?: string;
  effectiveDate?: string; // MM/DD/YYYY
  applicantDOB: string; // Required - MM/DD/YYYY
  spouseDOB?: string;
  applicantSSN?: string; // XXX-XX-XXXX
  spouseSSN?: string;
  yearsAtCurrentAddress?: number; // Used to determine if priorAddress is required
}

export interface HomeQuoteHome {
  homeStyle?: HomeStyle;
  yearBuilt: number; // Required - 4-digit year
  constructionType: ConstructionType; // Required
  stories?: number;
  finishedLivingArea?: number; // sq ft
  foundationType?: FoundationType;
  foundationMaterial?: FoundationMaterial;
  kitchen?: RoomQuality;
  bathroomType?: RoomQuality;
  bathroomStyle?: RoomQuality;
  hvacSystems?: string;
  flooring?: string;
  roofStyleSlope?: string;
  roofCover?: string;
  finishedBasement?: boolean;
  garage?: string;
  deckPatioDetails?: string;
  condoOrTownhouse?: boolean;
  specialFeatures?: string;
}

export interface HomeQuoteData {
  personal: HomeQuotePersonal;
  home: HomeQuoteHome;
}

// =============================================================================
// Auto Quote Types
// =============================================================================

export type MaritalStatus =
  | 'Single'
  | 'Married'
  | 'Divorced'
  | 'Widowed'
  | 'Separated'
  | 'Domestic Partner';

export type VehicleUse = 'Pleasure' | 'Commute' | 'Business' | 'Farm';

export type VehicleOwnership = 'Owned' | 'Financed' | 'Leased';

export type AccidentOrTicketType = 'Accident' | 'Ticket';

export interface AutoQuotePersonal {
  name: string; // Required
  spouseName?: string;
  currentAddress: Address; // Required
  priorAddress?: Address;
  phoneNumber: string; // Required - E.164
  email: string; // Required
  maritalStatus: MaritalStatus; // Required
  applicantDOB?: string;
  spouseDOB?: string;
  applicantDL?: string;
  spouseDL?: string;
  applicantOccupation?: string;
  spouseOccupation?: string;
  effectiveDate: string; // Required - MM/DD/YYYY
}

export interface AutoQuoteVehicleUsage {
  garagingAddressSameAsMailing?: boolean;
  vehicleUse?: VehicleUse;
  rideShare?: boolean;
  delivery?: boolean;
}

export interface AdditionalDriver {
  name: string;
  dob: string;
  licenseNumber?: string;
  relationship?: string;
}

export interface Automobile {
  year: number;
  make: string;
  model: string;
  vin?: string;
  ownership?: VehicleOwnership;
}

export interface AutoQuoteCoverages {
  bodilyInjury?: string;
  propertyDamage?: string;
  uninsuredMotorist?: string;
  offRoadVehicleLiability?: boolean;
  medicalPayments?: string;
  towing?: boolean;
  rental?: boolean;
}

export interface VehicleDeductible {
  vehicleRef: string;
  comprehensiveDeductible?: string;
  collisionDeductible?: string;
}

export interface PriorInsurance {
  company?: string;
  premium?: number;
  policyNumber?: string;
  expirationDate?: string;
}

export interface AccidentOrTicket {
  date: string;
  type: AccidentOrTicketType;
  description?: string;
  driver?: string;
}

export interface AutoQuoteData {
  personal: AutoQuotePersonal;
  vehicleUsage: AutoQuoteVehicleUsage;
  additionalDrivers: AdditionalDriver[];
  automobiles: Automobile[];
  coverages: AutoQuoteCoverages;
  deductibles: VehicleDeductible[];
  priorInsurance?: PriorInsurance;
  accidentsOrTickets: AccidentOrTicket[];
}

// =============================================================================
// Quote Type Union
// =============================================================================

export type QuoteType = 'home' | 'auto' | 'both';

// =============================================================================
// Validation Types
// =============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface FieldValidation {
  isValid: boolean;
  isRequired: boolean;
  value: unknown;
  error?: string;
  confidence?: ConfidenceLevel;
}

export interface ValidationResult {
  isValid: boolean;
  quoteType: QuoteType;
  totalFields: number;
  validFields: number;
  invalidFields: number;
  missingRequiredFields: string[];
  fields: Record<string, FieldValidation>;
  home?: {
    isValid: boolean;
    fields: Record<string, FieldValidation>;
  };
  auto?: {
    isValid: boolean;
    fields: Record<string, FieldValidation>;
  };
}

// =============================================================================
// API Types
// =============================================================================

export interface QuoteValidationRequest {
  quoteType: QuoteType;
  homeData?: Partial<HomeQuoteData>;
  autoData?: Partial<AutoQuoteData>;
}

export interface QuoteValidationResponse {
  success: boolean;
  validation: ValidationResult;
  errors?: string[];
}

// =============================================================================
// UI Component Types
// =============================================================================

export type FieldValidationStatus = 'valid' | 'invalid' | 'missing';

export interface UIFieldValidation {
  key: string;
  label: string;
  value: string | null;
  status: FieldValidationStatus;
  confidence: ConfidenceLevel;
  flagged: boolean;
  errorMessage?: string;
  rawText?: string;
  inputType?: 'text' | 'select' | 'date' | 'tel' | 'email' | 'number';
  options?: string[];
  required: boolean;
  category?: string;
}

export interface ArrayFieldSchema {
  name: string;
  label: string;
  minItems?: number;
  maxItems?: number;
  fields: {
    key: string;
    label: string;
    inputType: 'text' | 'select' | 'date' | 'tel' | 'email' | 'number';
    required: boolean;
    options?: string[];
  }[];
}

export interface UIValidationResult {
  isValid: boolean;
  requiredFields: UIFieldValidation[];
  optionalFields: UIFieldValidation[];
  flaggedFields: UIFieldValidation[];
  totalRequired: number;
  completedRequired: number;
  completionPercentage: number;
}

export interface QuoteValidationState {
  quoteType: QuoteType | null;
  validationResult: UIValidationResult | null;
  isValidating: boolean;
  isSubmitting: boolean;
}

// =============================================================================
// Array Field Schemas
// =============================================================================

export const DRIVER_SCHEMA: ArrayFieldSchema = {
  name: 'drivers',
  label: 'Drivers',
  minItems: 1,
  maxItems: 6,
  fields: [
    { key: 'firstName', label: 'First Name', inputType: 'text', required: true },
    { key: 'lastName', label: 'Last Name', inputType: 'text', required: true },
    { key: 'dateOfBirth', label: 'Date of Birth', inputType: 'date', required: true },
    { key: 'licenseNumber', label: 'License Number', inputType: 'text', required: true },
    { key: 'licenseState', label: 'License State', inputType: 'select', required: true, options: [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ]},
    { key: 'relationship', label: 'Relationship', inputType: 'select', required: true, options: [
      'Primary Insured', 'Spouse', 'Child', 'Other'
    ]},
  ],
};

export const VEHICLE_SCHEMA: ArrayFieldSchema = {
  name: 'vehicles',
  label: 'Vehicles',
  minItems: 1,
  maxItems: 6,
  fields: [
    { key: 'year', label: 'Year', inputType: 'number', required: true },
    { key: 'make', label: 'Make', inputType: 'text', required: true },
    { key: 'model', label: 'Model', inputType: 'text', required: true },
    { key: 'vin', label: 'VIN', inputType: 'text', required: true },
    { key: 'usage', label: 'Primary Use', inputType: 'select', required: true, options: [
      'Commute', 'Pleasure', 'Business', 'Rideshare'
    ]},
    { key: 'annualMileage', label: 'Annual Mileage', inputType: 'number', required: false },
  ],
};

export const INCIDENT_SCHEMA: ArrayFieldSchema = {
  name: 'incidents',
  label: 'Accidents/Tickets',
  minItems: 0,
  maxItems: 10,
  fields: [
    { key: 'type', label: 'Type', inputType: 'select', required: true, options: [
      'At-Fault Accident', 'Not-At-Fault Accident', 'Speeding Ticket', 'Other Violation', 'DUI/DWI', 'License Suspension'
    ]},
    { key: 'date', label: 'Date', inputType: 'date', required: true },
    { key: 'description', label: 'Description', inputType: 'text', required: false },
  ],
};
