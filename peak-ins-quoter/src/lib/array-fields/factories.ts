/**
 * Default Item Factory Functions
 * Create empty/default instances of array field items
 */

import type { ExtractionField } from '@/types/extraction'
import type {
  VehicleData,
  DriverData,
  ClaimData,
  AccidentData,
  TicketData,
  DeductibleData,
  LienholderData,
  ScheduledItemData,
  ConfidenceLevel,
} from './types'
import { generateArrayFieldId } from '@/hooks/use-array-field'

// =============================================================================
// Field Factory
// =============================================================================

/**
 * Create an empty extraction field with default values
 */
export function createEmptyField(
  value: string | null = null,
  confidence: ConfidenceLevel = 'low',
  flagged: boolean = false
): ExtractionField {
  return {
    value,
    confidence,
    flagged: flagged || value === null,
    rawText: undefined,
  }
}

/**
 * Create an extraction field from a plain value
 */
export function createFieldFromValue(
  value: string | null,
  confidence: ConfidenceLevel = 'medium'
): ExtractionField {
  return {
    value,
    confidence,
    flagged: value === null,
    rawText: undefined,
  }
}

// =============================================================================
// Vehicle Factory
// =============================================================================

/**
 * Create a default empty vehicle entry
 */
export function createDefaultVehicle(): VehicleData {
  return {
    id: generateArrayFieldId(),
    year: createEmptyField(),
    make: createEmptyField(),
    model: createEmptyField(),
    vin: createEmptyField(),
    ownership: createEmptyField(),
    usage: createEmptyField(),
    annualMileage: createEmptyField(),
    garagingAddress: createEmptyField(),
  }
}

/**
 * Create a vehicle entry with partial data
 */
export function createVehicle(
  data: Partial<{
    year: string | null
    make: string | null
    model: string | null
    vin: string | null
    ownership: string | null
    usage: string | null
    annualMileage: string | null
    garagingAddress: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): VehicleData {
  return {
    id: generateArrayFieldId(),
    year: createFieldFromValue(data.year ?? null, confidence),
    make: createFieldFromValue(data.make ?? null, confidence),
    model: createFieldFromValue(data.model ?? null, confidence),
    vin: createFieldFromValue(data.vin ?? null, confidence),
    ownership: createFieldFromValue(data.ownership ?? null, confidence),
    usage: createFieldFromValue(data.usage ?? null, confidence),
    annualMileage: createFieldFromValue(data.annualMileage ?? null, confidence),
    garagingAddress: createFieldFromValue(data.garagingAddress ?? null, confidence),
  }
}

// =============================================================================
// Driver Factory
// =============================================================================

/**
 * Create a default empty driver entry
 */
export function createDefaultDriver(): DriverData {
  return {
    id: generateArrayFieldId(),
    firstName: createEmptyField(),
    lastName: createEmptyField(),
    dateOfBirth: createEmptyField(),
    licenseNumber: createEmptyField(),
    licenseState: createEmptyField(),
    relationship: createEmptyField(),
    gender: createEmptyField(),
    maritalStatus: createEmptyField(),
  }
}

/**
 * Create a driver entry with partial data
 */
export function createDriver(
  data: Partial<{
    firstName: string | null
    lastName: string | null
    dateOfBirth: string | null
    licenseNumber: string | null
    licenseState: string | null
    relationship: string | null
    gender: string | null
    maritalStatus: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): DriverData {
  return {
    id: generateArrayFieldId(),
    firstName: createFieldFromValue(data.firstName ?? null, confidence),
    lastName: createFieldFromValue(data.lastName ?? null, confidence),
    dateOfBirth: createFieldFromValue(data.dateOfBirth ?? null, confidence),
    licenseNumber: createFieldFromValue(data.licenseNumber ?? null, confidence),
    licenseState: createFieldFromValue(data.licenseState ?? null, confidence),
    relationship: createFieldFromValue(data.relationship ?? null, confidence),
    gender: createFieldFromValue(data.gender ?? null, confidence),
    maritalStatus: createFieldFromValue(data.maritalStatus ?? null, confidence),
  }
}

// =============================================================================
// Claim Factory (Home Insurance)
// =============================================================================

/**
 * Create a default empty claim entry
 */
export function createDefaultClaim(): ClaimData {
  return {
    id: generateArrayFieldId(),
    date: createEmptyField(),
    type: createEmptyField(),
    description: createEmptyField(),
    amount: createEmptyField(),
    status: createEmptyField(),
  }
}

/**
 * Create a claim entry with partial data
 */
export function createClaim(
  data: Partial<{
    date: string | null
    type: string | null
    description: string | null
    amount: string | null
    status: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): ClaimData {
  return {
    id: generateArrayFieldId(),
    date: createFieldFromValue(data.date ?? null, confidence),
    type: createFieldFromValue(data.type ?? null, confidence),
    description: createFieldFromValue(data.description ?? null, confidence),
    amount: createFieldFromValue(data.amount ?? null, confidence),
    status: createFieldFromValue(data.status ?? null, confidence),
  }
}

// =============================================================================
// Accident Factory
// =============================================================================

/**
 * Create a default empty accident entry
 */
export function createDefaultAccident(): AccidentData {
  return {
    id: generateArrayFieldId(),
    date: createEmptyField(),
    type: createEmptyField(),
    description: createEmptyField(),
    driverRef: createEmptyField(),
    atFault: createEmptyField(),
    amountPaid: createEmptyField(),
  }
}

/**
 * Create an accident entry with partial data
 */
export function createAccident(
  data: Partial<{
    date: string | null
    type: string | null
    description: string | null
    driverRef: string | null
    atFault: string | null
    amountPaid: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): AccidentData {
  return {
    id: generateArrayFieldId(),
    date: createFieldFromValue(data.date ?? null, confidence),
    type: createFieldFromValue(data.type ?? null, confidence),
    description: createFieldFromValue(data.description ?? null, confidence),
    driverRef: createFieldFromValue(data.driverRef ?? null, confidence),
    atFault: createFieldFromValue(data.atFault ?? null, confidence),
    amountPaid: createFieldFromValue(data.amountPaid ?? null, confidence),
  }
}

// =============================================================================
// Ticket Factory
// =============================================================================

/**
 * Create a default empty ticket entry
 */
export function createDefaultTicket(): TicketData {
  return {
    id: generateArrayFieldId(),
    date: createEmptyField(),
    type: createEmptyField(),
    description: createEmptyField(),
    driverRef: createEmptyField(),
    points: createEmptyField(),
  }
}

/**
 * Create a ticket entry with partial data
 */
export function createTicket(
  data: Partial<{
    date: string | null
    type: string | null
    description: string | null
    driverRef: string | null
    points: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): TicketData {
  return {
    id: generateArrayFieldId(),
    date: createFieldFromValue(data.date ?? null, confidence),
    type: createFieldFromValue(data.type ?? null, confidence),
    description: createFieldFromValue(data.description ?? null, confidence),
    driverRef: createFieldFromValue(data.driverRef ?? null, confidence),
    points: createFieldFromValue(data.points ?? null, confidence),
  }
}

// =============================================================================
// Deductible Factory
// =============================================================================

/**
 * Create a default empty deductible entry
 */
export function createDefaultDeductible(): DeductibleData {
  return {
    id: generateArrayFieldId(),
    vehicleRef: createEmptyField(),
    comprehensiveDeductible: createEmptyField(),
    collisionDeductible: createEmptyField(),
  }
}

/**
 * Create a deductible entry for a specific vehicle
 */
export function createDeductibleForVehicle(
  vehicleId: string,
  data?: Partial<{
    comprehensiveDeductible: string | null
    collisionDeductible: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): DeductibleData {
  return {
    id: generateArrayFieldId(),
    vehicleRef: createFieldFromValue(vehicleId, 'high'), // vehicleRef is always high confidence when explicitly set
    comprehensiveDeductible: createFieldFromValue(
      data?.comprehensiveDeductible ?? null,
      confidence
    ),
    collisionDeductible: createFieldFromValue(
      data?.collisionDeductible ?? null,
      confidence
    ),
  }
}

// =============================================================================
// Lienholder Factory
// =============================================================================

/**
 * Create a default empty lienholder entry
 */
export function createDefaultLienholder(): LienholderData {
  return {
    id: generateArrayFieldId(),
    vehicleRef: createEmptyField(),
    name: createEmptyField(),
    address: createEmptyField(),
    city: createEmptyField(),
    state: createEmptyField(),
    zip: createEmptyField(),
    loanNumber: createEmptyField(),
  }
}

/**
 * Create a lienholder entry for a specific vehicle
 */
export function createLienholderForVehicle(
  vehicleId: string,
  data?: Partial<{
    name: string | null
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    loanNumber: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): LienholderData {
  return {
    id: generateArrayFieldId(),
    vehicleRef: createFieldFromValue(vehicleId, 'high'),
    name: createFieldFromValue(data?.name ?? null, confidence),
    address: createFieldFromValue(data?.address ?? null, confidence),
    city: createFieldFromValue(data?.city ?? null, confidence),
    state: createFieldFromValue(data?.state ?? null, confidence),
    zip: createFieldFromValue(data?.zip ?? null, confidence),
    loanNumber: createFieldFromValue(data?.loanNumber ?? null, confidence),
  }
}

// =============================================================================
// Scheduled Item Factory (Home Insurance)
// =============================================================================

/**
 * Create a default empty scheduled item entry
 */
export function createDefaultScheduledItem(): ScheduledItemData {
  return {
    id: generateArrayFieldId(),
    category: createEmptyField(),
    description: createEmptyField(),
    value: createEmptyField(),
    serialNumber: createEmptyField(),
    appraisalDate: createEmptyField(),
  }
}

/**
 * Create a scheduled item entry with partial data
 */
export function createScheduledItem(
  data: Partial<{
    category: string | null
    description: string | null
    value: string | null
    serialNumber: string | null
    appraisalDate: string | null
  }>,
  confidence: ConfidenceLevel = 'medium'
): ScheduledItemData {
  return {
    id: generateArrayFieldId(),
    category: createFieldFromValue(data.category ?? null, confidence),
    description: createFieldFromValue(data.description ?? null, confidence),
    value: createFieldFromValue(data.value ?? null, confidence),
    serialNumber: createFieldFromValue(data.serialNumber ?? null, confidence),
    appraisalDate: createFieldFromValue(data.appraisalDate ?? null, confidence),
  }
}

// =============================================================================
// Batch Creation Utilities
// =============================================================================

/**
 * Create multiple vehicles at once
 */
export function createVehicles(
  dataArray: Array<Parameters<typeof createVehicle>[0]>,
  confidence: ConfidenceLevel = 'medium'
): VehicleData[] {
  return dataArray.map(data => createVehicle(data, confidence))
}

/**
 * Create multiple drivers at once
 */
export function createDrivers(
  dataArray: Array<Parameters<typeof createDriver>[0]>,
  confidence: ConfidenceLevel = 'medium'
): DriverData[] {
  return dataArray.map(data => createDriver(data, confidence))
}

/**
 * Create deductibles for all vehicles (one deductible per vehicle)
 */
export function createDeductiblesForVehicles(
  vehicles: VehicleData[],
  defaultDeductible?: { comprehensive: string; collision: string }
): DeductibleData[] {
  return vehicles.map(vehicle =>
    createDeductibleForVehicle(vehicle.id, {
      comprehensiveDeductible: defaultDeductible?.comprehensive ?? null,
      collisionDeductible: defaultDeductible?.collision ?? null,
    })
  )
}
