/**
 * Array Field Types
 * Type definitions for array field data structures used in extraction forms
 */

import type { ExtractionField } from '@/types/extraction'

// =============================================================================
// Base Types
// =============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ArrayFieldItem {
  id: string
  [key: string]: unknown
}

// =============================================================================
// Vehicle Types
// =============================================================================

export interface VehicleData extends ArrayFieldItem {
  year: ExtractionField
  make: ExtractionField
  model: ExtractionField
  vin: ExtractionField
  ownership: ExtractionField
  usage: ExtractionField
  annualMileage: ExtractionField
  garagingAddress: ExtractionField
}

export interface VehicleReferenceOption {
  value: string
  label: string
  vehicleId: string
  year: string | null
  make: string | null
  model: string | null
}

// =============================================================================
// Driver Types
// =============================================================================

export interface DriverData extends ArrayFieldItem {
  firstName: ExtractionField
  lastName: ExtractionField
  dateOfBirth: ExtractionField
  licenseNumber: ExtractionField
  licenseState: ExtractionField
  relationship: ExtractionField
  gender: ExtractionField
  maritalStatus: ExtractionField
}

export interface DriverReferenceOption {
  value: string
  label: string
  driverId: string
  isOwner: boolean
  isSpouse: boolean
  firstName: string | null
  lastName: string | null
}

// =============================================================================
// Accident/Ticket Types
// =============================================================================

export interface AccidentData extends ArrayFieldItem {
  date: ExtractionField
  type: ExtractionField
  description: ExtractionField
  driverRef: ExtractionField
  atFault: ExtractionField
  amountPaid: ExtractionField
}

export interface TicketData extends ArrayFieldItem {
  date: ExtractionField
  type: ExtractionField
  description: ExtractionField
  driverRef: ExtractionField
  points: ExtractionField
}

// =============================================================================
// Deductible Types
// =============================================================================

export interface DeductibleData extends ArrayFieldItem {
  vehicleRef: ExtractionField
  comprehensiveDeductible: ExtractionField
  collisionDeductible: ExtractionField
}

// =============================================================================
// Lienholder Types
// =============================================================================

export interface LienholderData extends ArrayFieldItem {
  vehicleRef: ExtractionField
  name: ExtractionField
  address: ExtractionField
  city: ExtractionField
  state: ExtractionField
  zip: ExtractionField
  loanNumber: ExtractionField
}

// =============================================================================
// Scheduled Item Types (for home insurance)
// =============================================================================

export interface ScheduledItemData extends ArrayFieldItem {
  category: ExtractionField
  description: ExtractionField
  value: ExtractionField
  serialNumber: ExtractionField
  appraisalDate: ExtractionField
}

// =============================================================================
// Claim Types (for home insurance)
// =============================================================================

export interface ClaimData extends ArrayFieldItem {
  date: ExtractionField
  type: ExtractionField
  description: ExtractionField
  amount: ExtractionField
  status: ExtractionField
}

// =============================================================================
// Reference Dependency Types
// =============================================================================

export interface ReferenceDependency {
  /** The type of entity that depends on the reference */
  dependentType: 'deductible' | 'lienholder' | 'accident' | 'ticket'
  /** ID of the dependent item */
  dependentId: string
  /** Field name that holds the reference */
  fieldName: string
  /** Display label for the dependency */
  label: string
}

export interface ReferenceWarning {
  /** ID of the item being referenced */
  referencedId: string
  /** Type of the referenced item */
  referencedType: 'vehicle' | 'driver'
  /** Label of the referenced item */
  referencedLabel: string
  /** List of items that depend on this reference */
  dependencies: ReferenceDependency[]
  /** Warning message to display */
  message: string
}

// =============================================================================
// Validation Types
// =============================================================================

export interface ArrayFieldValidation {
  isValid: boolean
  errors: ArrayFieldValidationError[]
  requiredFieldsComplete: number
  totalRequiredFields: number
  completionPercentage: number
}

export interface ArrayFieldValidationError {
  itemId: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

// =============================================================================
// Confidence Aggregation Types
// =============================================================================

export interface ConfidenceAggregation {
  overall: ConfidenceLevel
  highCount: number
  mediumCount: number
  lowCount: number
  totalFields: number
  flaggedCount: number
  completedCount: number
  completionPercentage: number
}

export interface SectionConfidence {
  sectionKey: string
  sectionLabel: string
  confidence: ConfidenceAggregation
  items: ItemConfidence[]
}

export interface ItemConfidence {
  itemId: string
  itemLabel: string
  confidence: ConfidenceAggregation
}

// =============================================================================
// Persistence Types
// =============================================================================

export interface DraftState<T> {
  data: T
  version: number
  savedAt: string
  extractionId?: string
}

export interface PersistenceConfig {
  storageKey: string
  version: number
  extractionId?: string
  debounceMs?: number
}
