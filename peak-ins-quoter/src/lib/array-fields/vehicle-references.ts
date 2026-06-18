/**
 * Vehicle Reference Management Utilities
 * Handles vehicle display labels, reference tracking, and dependency management
 */

import type {
  VehicleData,
  VehicleReferenceOption,
  DeductibleData,
  LienholderData,
  ReferenceDependency,
  ReferenceWarning,
} from './types'

// =============================================================================
// Vehicle Label Generation
// =============================================================================

/**
 * Generate a display label for a vehicle (e.g., "2024 Toyota Camry")
 */
export function generateVehicleLabel(vehicle: VehicleData): string {
  const year = vehicle.year.value
  const make = vehicle.make.value
  const model = vehicle.model.value

  const parts: string[] = []
  if (year) parts.push(year)
  if (make) parts.push(make)
  if (model) parts.push(model)

  return parts.length > 0 ? parts.join(' ') : `Vehicle ${vehicle.id.substring(0, 6)}`
}

/**
 * Generate a short label for a vehicle (e.g., "2024 Camry")
 */
export function generateVehicleShortLabel(vehicle: VehicleData): string {
  const year = vehicle.year.value
  const model = vehicle.model.value

  const parts: string[] = []
  if (year) parts.push(year)
  if (model) parts.push(model)

  return parts.length > 0 ? parts.join(' ') : `Vehicle ${vehicle.id.substring(0, 6)}`
}

/**
 * Generate a label with VIN suffix for disambiguation
 */
export function generateVehicleLabelWithVin(vehicle: VehicleData): string {
  const baseLabel = generateVehicleLabel(vehicle)
  const vin = vehicle.vin.value

  if (vin && vin.length >= 4) {
    return `${baseLabel} (VIN: ...${vin.slice(-4)})`
  }

  return baseLabel
}

// =============================================================================
// Reference Option Generation
// =============================================================================

/**
 * Generate dropdown options for vehicle selection
 */
export function generateVehicleOptions(vehicles: VehicleData[]): VehicleReferenceOption[] {
  return vehicles.map((vehicle, index) => ({
    value: vehicle.id,
    label: generateVehicleLabel(vehicle) || `Vehicle ${index + 1}`,
    vehicleId: vehicle.id,
    year: vehicle.year.value,
    make: vehicle.make.value,
    model: vehicle.model.value,
  }))
}

/**
 * Find a vehicle by its reference ID
 */
export function findVehicleByRef(
  vehicles: VehicleData[],
  vehicleRef: string
): VehicleData | undefined {
  return vehicles.find(v => v.id === vehicleRef)
}

/**
 * Find a vehicle by VIN
 */
export function findVehicleByVin(
  vehicles: VehicleData[],
  vin: string
): VehicleData | undefined {
  if (!vin) return undefined
  const normalizedVin = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return vehicles.find(v => {
    const vehicleVin = v.vin.value?.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return vehicleVin === normalizedVin
  })
}

// =============================================================================
// Reference Dependency Tracking
// =============================================================================

/**
 * Get all dependencies for a specific vehicle
 */
export function getVehicleDependencies(
  vehicleId: string,
  deductibles: DeductibleData[],
  lienholders: LienholderData[]
): ReferenceDependency[] {
  const dependencies: ReferenceDependency[] = []

  // Check deductibles
  deductibles.forEach(deductible => {
    if (deductible.vehicleRef.value === vehicleId) {
      dependencies.push({
        dependentType: 'deductible',
        dependentId: deductible.id,
        fieldName: 'vehicleRef',
        label: `Deductible entry (Comp: ${deductible.comprehensiveDeductible.value || 'N/A'}, Coll: ${deductible.collisionDeductible.value || 'N/A'})`,
      })
    }
  })

  // Check lienholders
  lienholders.forEach(lienholder => {
    if (lienholder.vehicleRef.value === vehicleId) {
      dependencies.push({
        dependentType: 'lienholder',
        dependentId: lienholder.id,
        fieldName: 'vehicleRef',
        label: `Lienholder: ${lienholder.name.value || 'Unknown'}`,
      })
    }
  })

  return dependencies
}

/**
 * Check if a vehicle can be safely deleted
 */
export function canDeleteVehicle(
  vehicleId: string,
  deductibles: DeductibleData[],
  lienholders: LienholderData[]
): { canDelete: boolean; warning?: ReferenceWarning } {
  const dependencies = getVehicleDependencies(vehicleId, deductibles, lienholders)

  if (dependencies.length === 0) {
    return { canDelete: true }
  }

  return {
    canDelete: false,
    warning: {
      referencedId: vehicleId,
      referencedType: 'vehicle',
      referencedLabel: 'This vehicle',
      dependencies,
      message: `This vehicle is referenced by ${dependencies.length} other item(s). Please remove or reassign these references before deleting.`,
    },
  }
}

/**
 * Generate a warning message for vehicle deletion with dependencies
 */
export function generateVehicleDeletionWarning(
  vehicle: VehicleData,
  dependencies: ReferenceDependency[]
): string {
  const vehicleLabel = generateVehicleLabel(vehicle)
  const dependencyLabels = dependencies.map(d => d.label).join(', ')

  return `Cannot delete "${vehicleLabel}" because it is referenced by: ${dependencyLabels}. Please remove or reassign these references first.`
}

// =============================================================================
// Reference Updates
// =============================================================================

/**
 * Update all references when a vehicle ID changes (e.g., after duplication)
 * Returns the updated arrays
 */
export function updateVehicleReferences(
  oldVehicleId: string,
  newVehicleId: string,
  deductibles: DeductibleData[],
  lienholders: LienholderData[]
): {
  deductibles: DeductibleData[]
  lienholders: LienholderData[]
} {
  const updatedDeductibles = deductibles.map(d => {
    if (d.vehicleRef.value === oldVehicleId) {
      return {
        ...d,
        vehicleRef: { ...d.vehicleRef, value: newVehicleId },
      }
    }
    return d
  })

  const updatedLienholders = lienholders.map(l => {
    if (l.vehicleRef.value === oldVehicleId) {
      return {
        ...l,
        vehicleRef: { ...l.vehicleRef, value: newVehicleId },
      }
    }
    return l
  })

  return {
    deductibles: updatedDeductibles,
    lienholders: updatedLienholders,
  }
}

/**
 * Remove all orphaned references (references to deleted vehicles)
 */
export function removeOrphanedVehicleReferences(
  vehicleIds: Set<string>,
  deductibles: DeductibleData[],
  lienholders: LienholderData[]
): {
  deductibles: DeductibleData[]
  lienholders: LienholderData[]
  orphanedDeductibleIds: string[]
  orphanedLienholderIds: string[]
} {
  const orphanedDeductibleIds: string[] = []
  const orphanedLienholderIds: string[] = []

  const validDeductibles = deductibles.filter(d => {
    const ref = d.vehicleRef.value
    if (ref && !vehicleIds.has(ref)) {
      orphanedDeductibleIds.push(d.id)
      return false
    }
    return true
  })

  const validLienholders = lienholders.filter(l => {
    const ref = l.vehicleRef.value
    if (ref && !vehicleIds.has(ref)) {
      orphanedLienholderIds.push(l.id)
      return false
    }
    return true
  })

  return {
    deductibles: validDeductibles,
    lienholders: validLienholders,
    orphanedDeductibleIds,
    orphanedLienholderIds,
  }
}

// =============================================================================
// Auto-Create Related Entries
// =============================================================================

/**
 * Check if a vehicle has an associated deductible entry
 */
export function vehicleHasDeductible(
  vehicleId: string,
  deductibles: DeductibleData[]
): boolean {
  return deductibles.some(d => d.vehicleRef.value === vehicleId)
}

/**
 * Get missing deductible entries for vehicles
 */
export function getMissingVehicleDeductibles(
  vehicles: VehicleData[],
  deductibles: DeductibleData[]
): VehicleData[] {
  return vehicles.filter(v => !vehicleHasDeductible(v.id, deductibles))
}

/**
 * Get vehicles that have comprehensive or collision coverage (need deductibles)
 */
export function getVehiclesNeedingDeductibles(
  vehicles: VehicleData[],
  deductibles: DeductibleData[]
): VehicleData[] {
  // All vehicles typically need deductibles, but we return those missing entries
  return getMissingVehicleDeductibles(vehicles, deductibles)
}
