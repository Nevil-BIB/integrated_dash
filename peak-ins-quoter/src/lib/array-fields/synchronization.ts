/**
 * Array Field Synchronization Utilities
 * Handle cross-array dependencies and automatic updates
 */

import type {
  VehicleData,
  DriverData,
  DeductibleData,
  LienholderData,
  AccidentData,
  TicketData,
  ClaimData,
  ScheduledItemData,
} from './types'
import {
  createDeductibleForVehicle,
  createDefaultDeductible,
} from './factories'
import {
  getVehicleDependencies,
  generateVehicleLabel,
} from './vehicle-references'
import {
  getDriverDependencies,
  generateDriverLabel,
} from './driver-references'

// =============================================================================
// Vehicle-Deductible Synchronization
// =============================================================================

export interface VehicleSyncResult {
  deductibles: DeductibleData[]
  lienholders: LienholderData[]
  addedDeductibleIds: string[]
  removedDeductibleIds: string[]
  warnings: string[]
}

/**
 * Synchronize deductibles when vehicles change
 * - Auto-creates deductible entries for new vehicles
 * - Warns about orphaned deductibles when vehicles are removed
 */
export function syncVehicleDeductibles(
  vehicles: VehicleData[],
  deductibles: DeductibleData[],
  options: {
    autoCreateDeductibles?: boolean
    removeOrphans?: boolean
  } = {}
): {
  deductibles: DeductibleData[]
  addedIds: string[]
  removedIds: string[]
  orphanedIds: string[]
} {
  const { autoCreateDeductibles = true, removeOrphans = false } = options

  const vehicleIds = new Set(vehicles.map(v => v.id))
  const vehiclesWithDeductibles = new Set(
    deductibles
      .map(d => d.vehicleRef.value)
      .filter((ref): ref is string => ref !== null)
  )

  const addedIds: string[] = []
  const removedIds: string[] = []
  const orphanedIds: string[] = []

  // Find vehicles without deductibles
  const vehiclesNeedingDeductibles = vehicles.filter(
    v => !vehiclesWithDeductibles.has(v.id)
  )

  // Find orphaned deductibles (referencing non-existent vehicles)
  const orphanedDeductibles = deductibles.filter(d => {
    const ref = d.vehicleRef.value
    return ref !== null && !vehicleIds.has(ref)
  })

  orphanedIds.push(...orphanedDeductibles.map(d => d.id))

  // Build new deductibles array
  let newDeductibles = [...deductibles]

  // Auto-create deductibles for new vehicles
  if (autoCreateDeductibles) {
    for (const vehicle of vehiclesNeedingDeductibles) {
      const newDeductible = createDeductibleForVehicle(vehicle.id)
      newDeductibles.push(newDeductible)
      addedIds.push(newDeductible.id)
    }
  }

  // Remove orphaned deductibles if requested
  if (removeOrphans) {
    newDeductibles = newDeductibles.filter(d => {
      const ref = d.vehicleRef.value
      if (ref !== null && !vehicleIds.has(ref)) {
        removedIds.push(d.id)
        return false
      }
      return true
    })
  }

  return {
    deductibles: newDeductibles,
    addedIds,
    removedIds,
    orphanedIds,
  }
}

/**
 * Handle vehicle addition - auto-create associated entries
 */
export function onVehicleAdded(
  vehicle: VehicleData,
  existingDeductibles: DeductibleData[],
  options: {
    createDeductible?: boolean
    defaultComprehensive?: string
    defaultCollision?: string
  } = {}
): {
  deductibles: DeductibleData[]
  addedDeductible?: DeductibleData
} {
  const {
    createDeductible = true,
    defaultComprehensive,
    defaultCollision,
  } = options

  if (!createDeductible) {
    return { deductibles: existingDeductibles }
  }

  const newDeductible = createDeductibleForVehicle(vehicle.id, {
    comprehensiveDeductible: defaultComprehensive ?? null,
    collisionDeductible: defaultCollision ?? null,
  })

  return {
    deductibles: [...existingDeductibles, newDeductible],
    addedDeductible: newDeductible,
  }
}

/**
 * Handle vehicle removal - check for dependencies and optionally remove them
 */
export function onVehicleRemoved(
  vehicleId: string,
  deductibles: DeductibleData[],
  lienholders: LienholderData[],
  options: {
    removeDeductibles?: boolean
    removeLienholders?: boolean
  } = {}
): VehicleSyncResult {
  const { removeDeductibles = false, removeLienholders = false } = options

  const warnings: string[] = []
  const removedDeductibleIds: string[] = []

  // Check for dependencies
  const dependencies = getVehicleDependencies(vehicleId, deductibles, lienholders)

  // Process deductibles
  let newDeductibles = deductibles
  if (removeDeductibles) {
    newDeductibles = deductibles.filter(d => {
      if (d.vehicleRef.value === vehicleId) {
        removedDeductibleIds.push(d.id)
        return false
      }
      return true
    })
  } else {
    // Warn about orphaned deductibles
    const orphanedDeds = deductibles.filter(d => d.vehicleRef.value === vehicleId)
    if (orphanedDeds.length > 0) {
      warnings.push(
        `${orphanedDeds.length} deductible(s) reference this vehicle and will become orphaned`
      )
    }
  }

  // Process lienholders
  let newLienholders = lienholders
  if (removeLienholders) {
    newLienholders = lienholders.filter(l => l.vehicleRef.value !== vehicleId)
  } else {
    const orphanedLiens = lienholders.filter(l => l.vehicleRef.value === vehicleId)
    if (orphanedLiens.length > 0) {
      warnings.push(
        `${orphanedLiens.length} lienholder(s) reference this vehicle and will become orphaned`
      )
    }
  }

  return {
    deductibles: newDeductibles,
    lienholders: newLienholders,
    addedDeductibleIds: [],
    removedDeductibleIds,
    warnings,
  }
}

// =============================================================================
// Driver-Incident Synchronization
// =============================================================================

export interface DriverSyncResult {
  accidents: AccidentData[]
  tickets: TicketData[]
  warnings: string[]
}

/**
 * Handle driver removal - check for incident dependencies
 */
export function onDriverRemoved(
  driverId: string,
  accidents: AccidentData[],
  tickets: TicketData[],
  options: {
    removeIncidents?: boolean
    clearReferences?: boolean
  } = {}
): DriverSyncResult {
  const { removeIncidents = false, clearReferences = false } = options

  const warnings: string[] = []

  // Check for dependencies
  const dependencies = getDriverDependencies(driverId, accidents, tickets)

  let newAccidents = accidents
  let newTickets = tickets

  if (removeIncidents) {
    // Remove all incidents associated with this driver
    newAccidents = accidents.filter(a => a.driverRef.value !== driverId)
    newTickets = tickets.filter(t => t.driverRef.value !== driverId)
  } else if (clearReferences) {
    // Clear the driver reference but keep the incidents
    newAccidents = accidents.map(a => {
      if (a.driverRef.value === driverId) {
        return {
          ...a,
          driverRef: { ...a.driverRef, value: null, flagged: true },
        }
      }
      return a
    })
    newTickets = tickets.map(t => {
      if (t.driverRef.value === driverId) {
        return {
          ...t,
          driverRef: { ...t.driverRef, value: null, flagged: true },
        }
      }
      return t
    })
    if (dependencies.length > 0) {
      warnings.push(
        `${dependencies.length} incident(s) had their driver reference cleared`
      )
    }
  } else {
    // Just warn about orphaned references
    if (dependencies.length > 0) {
      warnings.push(
        `${dependencies.length} incident(s) reference this driver and will have invalid references`
      )
    }
  }

  return {
    accidents: newAccidents,
    tickets: newTickets,
    warnings,
  }
}

// =============================================================================
// Full State Synchronization
// =============================================================================

export interface FormArrayState {
  vehicles: VehicleData[]
  drivers: DriverData[]
  deductibles: DeductibleData[]
  lienholders: LienholderData[]
  accidents: AccidentData[]
  tickets: TicketData[]
  // Optional fields for home insurance
  claims?: ClaimData[]
  scheduledItems?: ScheduledItemData[]
}

export interface SyncOptions {
  autoCreateDeductibles: boolean
  removeOrphanedDeductibles: boolean
  removeOrphanedLienholders: boolean
  clearOrphanedDriverRefs: boolean
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  autoCreateDeductibles: true,
  removeOrphanedDeductibles: false,
  removeOrphanedLienholders: false,
  clearOrphanedDriverRefs: true,
}

/**
 * Synchronize all array fields to ensure reference integrity
 */
export function synchronizeArrayFields(
  state: FormArrayState,
  options: Partial<SyncOptions> = {}
): {
  state: FormArrayState
  changes: {
    addedDeductibles: string[]
    removedDeductibles: string[]
    removedLienholders: string[]
    clearedDriverRefs: string[]
  }
  warnings: string[]
} {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options }
  const warnings: string[] = []
  const changes = {
    addedDeductibles: [] as string[],
    removedDeductibles: [] as string[],
    removedLienholders: [] as string[],
    clearedDriverRefs: [] as string[],
  }

  // Build sets of valid IDs
  const vehicleIds = new Set(state.vehicles.map(v => v.id))
  const driverIds = new Set(state.drivers.map(d => d.id))
  // Include owner/spouse as valid driver refs
  driverIds.add('__owner__')
  driverIds.add('__spouse__')

  // Sync deductibles with vehicles
  let newDeductibles = [...state.deductibles]

  if (opts.autoCreateDeductibles) {
    // Find vehicles without deductibles
    const vehiclesWithDeds = new Set(
      newDeductibles
        .map(d => d.vehicleRef.value)
        .filter((ref): ref is string => ref !== null)
    )

    for (const vehicle of state.vehicles) {
      if (!vehiclesWithDeds.has(vehicle.id)) {
        const newDed = createDeductibleForVehicle(vehicle.id)
        newDeductibles.push(newDed)
        changes.addedDeductibles.push(newDed.id)
      }
    }
  }

  if (opts.removeOrphanedDeductibles) {
    newDeductibles = newDeductibles.filter(d => {
      const ref = d.vehicleRef.value
      if (ref && !vehicleIds.has(ref)) {
        changes.removedDeductibles.push(d.id)
        return false
      }
      return true
    })
  }

  // Sync lienholders with vehicles
  let newLienholders = [...state.lienholders]

  if (opts.removeOrphanedLienholders) {
    newLienholders = newLienholders.filter(l => {
      const ref = l.vehicleRef.value
      if (ref && !vehicleIds.has(ref)) {
        changes.removedLienholders.push(l.id)
        return false
      }
      return true
    })
  }

  // Sync accidents/tickets with drivers
  let newAccidents = [...state.accidents]
  let newTickets = [...state.tickets]

  if (opts.clearOrphanedDriverRefs) {
    newAccidents = newAccidents.map(a => {
      const ref = a.driverRef.value
      if (ref && !driverIds.has(ref)) {
        changes.clearedDriverRefs.push(a.id)
        return {
          ...a,
          driverRef: { ...a.driverRef, value: null, flagged: true },
        }
      }
      return a
    })

    newTickets = newTickets.map(t => {
      const ref = t.driverRef.value
      if (ref && !driverIds.has(ref)) {
        changes.clearedDriverRefs.push(t.id)
        return {
          ...t,
          driverRef: { ...t.driverRef, value: null, flagged: true },
        }
      }
      return t
    })
  }

  // Count orphans for warnings
  const orphanedDeductibles = newDeductibles.filter(d => {
    const ref = d.vehicleRef.value
    return ref && !vehicleIds.has(ref)
  }).length

  const orphanedLienholders = newLienholders.filter(l => {
    const ref = l.vehicleRef.value
    return ref && !vehicleIds.has(ref)
  }).length

  if (orphanedDeductibles > 0 && !opts.removeOrphanedDeductibles) {
    warnings.push(`${orphanedDeductibles} deductible(s) reference non-existent vehicles`)
  }

  if (orphanedLienholders > 0 && !opts.removeOrphanedLienholders) {
    warnings.push(`${orphanedLienholders} lienholder(s) reference non-existent vehicles`)
  }

  return {
    state: {
      ...state,
      deductibles: newDeductibles,
      lienholders: newLienholders,
      accidents: newAccidents,
      tickets: newTickets,
    },
    changes,
    warnings,
  }
}

// =============================================================================
// Reference Update Helpers
// =============================================================================

/**
 * Update all references from one vehicle to another
 * Useful when duplicating or merging vehicles
 */
export function reassignVehicleReferences(
  fromVehicleId: string,
  toVehicleId: string,
  deductibles: DeductibleData[],
  lienholders: LienholderData[]
): {
  deductibles: DeductibleData[]
  lienholders: LienholderData[]
  updatedCount: number
} {
  let updatedCount = 0

  const newDeductibles = deductibles.map(d => {
    if (d.vehicleRef.value === fromVehicleId) {
      updatedCount++
      return {
        ...d,
        vehicleRef: { ...d.vehicleRef, value: toVehicleId },
      }
    }
    return d
  })

  const newLienholders = lienholders.map(l => {
    if (l.vehicleRef.value === fromVehicleId) {
      updatedCount++
      return {
        ...l,
        vehicleRef: { ...l.vehicleRef, value: toVehicleId },
      }
    }
    return l
  })

  return {
    deductibles: newDeductibles,
    lienholders: newLienholders,
    updatedCount,
  }
}

/**
 * Update all references from one driver to another
 */
export function reassignDriverReferences(
  fromDriverId: string,
  toDriverId: string,
  accidents: AccidentData[],
  tickets: TicketData[]
): {
  accidents: AccidentData[]
  tickets: TicketData[]
  updatedCount: number
} {
  let updatedCount = 0

  const newAccidents = accidents.map(a => {
    if (a.driverRef.value === fromDriverId) {
      updatedCount++
      return {
        ...a,
        driverRef: { ...a.driverRef, value: toDriverId },
      }
    }
    return a
  })

  const newTickets = tickets.map(t => {
    if (t.driverRef.value === fromDriverId) {
      updatedCount++
      return {
        ...t,
        driverRef: { ...t.driverRef, value: toDriverId },
      }
    }
    return t
  })

  return {
    accidents: newAccidents,
    tickets: newTickets,
    updatedCount,
  }
}

// =============================================================================
// Consistency Check
// =============================================================================

export interface ConsistencyIssue {
  type: 'orphaned_deductible' | 'orphaned_lienholder' | 'orphaned_accident' | 'orphaned_ticket' | 'missing_deductible'
  itemId: string
  message: string
  suggestion: string
}

/**
 * Check for consistency issues in the form state
 */
export function checkConsistency(state: FormArrayState): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []

  const vehicleIds = new Set(state.vehicles.map(v => v.id))
  const driverIds = new Set(state.drivers.map(d => d.id))
  driverIds.add('__owner__')
  driverIds.add('__spouse__')

  // Check for orphaned deductibles
  for (const deductible of state.deductibles) {
    const ref = deductible.vehicleRef.value
    if (ref && !vehicleIds.has(ref)) {
      issues.push({
        type: 'orphaned_deductible',
        itemId: deductible.id,
        message: 'Deductible references a non-existent vehicle',
        suggestion: 'Reassign to a valid vehicle or remove this deductible entry',
      })
    }
  }

  // Check for orphaned lienholders
  for (const lienholder of state.lienholders) {
    const ref = lienholder.vehicleRef.value
    if (ref && !vehicleIds.has(ref)) {
      issues.push({
        type: 'orphaned_lienholder',
        itemId: lienholder.id,
        message: 'Lienholder references a non-existent vehicle',
        suggestion: 'Reassign to a valid vehicle or remove this lienholder entry',
      })
    }
  }

  // Check for orphaned accident driver refs
  for (const accident of state.accidents) {
    const ref = accident.driverRef.value
    if (ref && !driverIds.has(ref)) {
      issues.push({
        type: 'orphaned_accident',
        itemId: accident.id,
        message: 'Accident references a non-existent driver',
        suggestion: 'Reassign to a valid driver or clear the driver reference',
      })
    }
  }

  // Check for orphaned ticket driver refs
  for (const ticket of state.tickets) {
    const ref = ticket.driverRef.value
    if (ref && !driverIds.has(ref)) {
      issues.push({
        type: 'orphaned_ticket',
        itemId: ticket.id,
        message: 'Ticket references a non-existent driver',
        suggestion: 'Reassign to a valid driver or clear the driver reference',
      })
    }
  }

  // Check for vehicles missing deductibles
  const vehiclesWithDeductibles = new Set(
    state.deductibles
      .map(d => d.vehicleRef.value)
      .filter((ref): ref is string => ref !== null)
  )

  for (const vehicle of state.vehicles) {
    if (!vehiclesWithDeductibles.has(vehicle.id)) {
      issues.push({
        type: 'missing_deductible',
        itemId: vehicle.id,
        message: `Vehicle "${generateVehicleLabel(vehicle)}" does not have a deductible entry`,
        suggestion: 'Add a deductible entry for this vehicle',
      })
    }
  }

  return issues
}
