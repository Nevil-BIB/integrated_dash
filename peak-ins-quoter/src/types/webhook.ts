/**
 * Webhook Payload Types
 *
 * These types define the JSON structure sent to the RPA webhook
 * when a quote is submitted for processing.
 */

// =============================================================================
// Webhook Address Format
// =============================================================================

export interface WebhookAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

// =============================================================================
// Webhook Personal Information
// =============================================================================

export interface WebhookPersonal {
  firstName: string;
  lastName: string;
  dateOfBirth: string;  // YYYY-MM-DD
  ssn?: string;         // XXX-XX-XXXX
  phone: string;
  email: string;
  maritalStatus: string;
  occupation?: string;

  // Spouse info (if applicable)
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseDateOfBirth?: string;
  spouseSsn?: string;
  spouseOccupation?: string;

  // Address
  address: WebhookAddress;
  yearsAtCurrentAddress?: number;
  priorAddress?: WebhookAddress;
}

// =============================================================================
// Webhook Home Insurance Data
// =============================================================================

export interface WebhookHomeProperty {
  yearBuilt: number;
  squareFootage: number;
  numberOfStories: number;
  bedroomCount: number;
  bathroomCount: string;  // Can be "2.5" etc
  dwellingType: string;
  constructionStyle: string;
  exteriorConstruction: string;
  roofAge: number;
  roofConstruction: string;
  roofShape?: string;
  foundation: string;
  heatType: string;
  garageType?: string;
  garageLocation?: string;
  purchaseDate?: string;
  condoOrTownhouse: boolean;
  specialFeatures?: string;
}

export interface WebhookHomeOccupancy {
  dwellingOccupancy: string;  // "Owner Occupied", "Tenant", etc.
  businessOnPremises: boolean;
  shortTermRental: boolean;
  numberOfFamilies: number;
}

export interface WebhookHomeSafety {
  alarmSystem: boolean;
  monitoredAlarm: boolean;
  pool: boolean;
  trampoline: boolean;
  dog: boolean;
  dogBreed?: string;
}

export interface WebhookHomeCoverage {
  dwellingCoverage: string;    // "$450,000"
  liabilityCoverage: string;   // "$300,000"
  medicalPayments?: string;
  deductible: string;          // "$1,000"
}

export interface WebhookScheduledItem {
  description: string;
  value: string;
}

export interface WebhookHomeLienholder {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface WebhookHomeInsurance {
  effectiveDate: string;       // YYYY-MM-DD
  reasonForPolicy: string;     // "New Purchase", "Existing Home", etc.
  currentlyInsured: string;    // "Yes - Same Carrier", "Yes - Different Carrier", "No"
  currentInsuranceCompany?: string;
  currentPolicyNumber?: string;
  escrowed: boolean;
  lienholder?: WebhookHomeLienholder;
}

export interface WebhookHomeData {
  property: WebhookHomeProperty;
  occupancy: WebhookHomeOccupancy;
  safety: WebhookHomeSafety;
  coverage: WebhookHomeCoverage;
  scheduledItems?: {
    jewelry?: WebhookScheduledItem[];
    otherValuables?: WebhookScheduledItem[];
  };
  insurance: WebhookHomeInsurance;
}

// =============================================================================
// Webhook Auto Insurance Data
// =============================================================================

export interface WebhookDriver {
  firstName: string;
  lastName: string;
  dateOfBirth: string;         // YYYY-MM-DD
  driversLicense: string;
  licenseState: string;
  relationship: string;        // "Primary Insured", "Spouse", "Child", etc.
  occupation?: string;
  education?: string;
  goodStudentDiscount?: boolean;
}

export interface WebhookVehicle {
  year: number;
  make: string;
  model: string;
  vin: string;
  usage: string;               // "Commute", "Pleasure", "Business"
  estimatedMileage?: number;
  ownership: string;           // "Owned", "Financed", "Leased"
  comprehensiveDeductible: string;
  collisionDeductible: string;
  lienholder?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface WebhookAutoCoverage {
  bodilyInjury: string;        // "250/500" (per person/per accident in thousands)
  propertyDamage: string;      // "100" (in thousands)
  uninsuredMotorist?: string;
  underinsuredMotorist?: string;
  medicalPayments?: string;
  towing: boolean;
  rental: boolean;
}

export interface WebhookPriorInsurance {
  company: string;
  premium?: string;
  policyNumber?: string;
  expirationDate?: string;
}

export interface WebhookIncident {
  type: string;                // "At-Fault Accident", "Speeding Ticket", etc.
  date: string;                // YYYY-MM-DD
  description?: string;
  driverName?: string;
}

export interface WebhookAutoData {
  effectiveDate: string;       // YYYY-MM-DD
  garagingAddress: WebhookAddress;
  garagingAddressSameAsMailing: boolean;
  rideShare: boolean;
  delivery: boolean;
  drivers: WebhookDriver[];
  vehicles: WebhookVehicle[];
  coverage: WebhookAutoCoverage;
  priorInsurance?: WebhookPriorInsurance;
  incidents: WebhookIncident[];
}

// =============================================================================
// Complete Webhook Payload
// =============================================================================

export interface WebhookMetadata {
  quoteId: string;
  extractionId: string;
  userId: string;
  filename: string;
  submittedAt: string;         // ISO 8601 timestamp
  quoteType: 'home' | 'auto' | 'both';
  version: string;             // Payload schema version
}

export interface WebhookPayload {
  metadata: WebhookMetadata;
  personal: WebhookPersonal;
  home?: WebhookHomeData;
  auto?: WebhookAutoData;
}

// =============================================================================
// Webhook Response (expected from RPA system)
// =============================================================================

export interface WebhookResponse {
  success: boolean;
  jobId?: string;              // RPA job ID for tracking
  message?: string;
  errors?: string[];
}
