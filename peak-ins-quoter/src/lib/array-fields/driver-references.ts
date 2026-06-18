/**
 * Driver Reference Management Utilities
 * Handles driver display labels, reference tracking, and dependency management
 */

import type {
  DriverData,
  DriverReferenceOption,
  AccidentData,
  TicketData,
  ReferenceDependency,
  ReferenceWarning,
} from './types'

// =============================================================================
// Driver Label Generation
// =============================================================================

/**
 * Generate a display label for a driver (e.g., "John Smith")
 */
export function generateDriverLabel(driver: DriverData): string {
  const firstName = driver.firstName.value
  const lastName = driver.lastName.value

  const parts: string[] = []
  if (firstName) parts.push(firstName)
  if (lastName) parts.push(lastName)

  return parts.length > 0 ? parts.join(' ') : `Driver ${driver.id.substring(0, 6)}`
}

/**
 * Generate a label with relationship (e.g., "John Smith (Spouse)")
 */
export function generateDriverLabelWithRelationship(driver: DriverData): string {
  const baseLabel = generateDriverLabel(driver)
  const relationship = driver.relationship.value

  if (relationship) {
    return `${baseLabel} (${relationship})`
  }

  return baseLabel
}

/**
 * Generate a short label for compact displays
 */
export function generateDriverShortLabel(driver: DriverData): string {
  const firstName = driver.firstName.value
  const lastName = driver.lastName.value

  if (firstName && lastName) {
    return `${firstName.charAt(0)}. ${lastName}`
  }
  if (firstName) return firstName
  if (lastName) return lastName

  return `Driver ${driver.id.substring(0, 6)}`
}

// =============================================================================
// Owner/Spouse Driver Options
// =============================================================================

export interface OwnerInfo {
  firstName: string | null
  lastName: string | null
  dateOfBirth: string | null
}

export interface SpouseInfo {
  firstName: string | null
  lastName: string | null
  dateOfBirth: string | null
}

/**
 * Generate driver options including owner and spouse as implicit drivers
 */
export function generateDriverOptionsWithOwner(
  drivers: DriverData[],
  owner?: OwnerInfo,
  spouse?: SpouseInfo
): DriverReferenceOption[] {
  const options: DriverReferenceOption[] = []

  // Add owner as first option if available
  if (owner && (owner.firstName || owner.lastName)) {
    const ownerLabel = [owner.firstName, owner.lastName].filter(Boolean).join(' ')
    options.push({
      value: '__owner__',
      label: `${ownerLabel} (Primary Insured)`,
      driverId: '__owner__',
      isOwner: true,
      isSpouse: false,
      firstName: owner.firstName,
      lastName: owner.lastName,
    })
  }

  // Add spouse as second option if available
  if (spouse && (spouse.firstName || spouse.lastName)) {
    const spouseLabel = [spouse.firstName, spouse.lastName].filter(Boolean).join(' ')
    options.push({
      value: '__spouse__',
      label: `${spouseLabel} (Spouse)`,
      driverId: '__spouse__',
      isOwner: false,
      isSpouse: true,
      firstName: spouse.firstName,
      lastName: spouse.lastName,
    })
  }

  // Add additional drivers
  drivers.forEach((driver, index) => {
    options.push({
      value: driver.id,
      label: generateDriverLabelWithRelationship(driver) || `Additional Driver ${index + 1}`,
      driverId: driver.id,
      isOwner: false,
      isSpouse: false,
      firstName: driver.firstName.value,
      lastName: driver.lastName.value,
    })
  })

  return options
}

/**
 * Generate driver options without owner/spouse (just additional drivers)
 */
export function generateDriverOptions(drivers: DriverData[]): DriverReferenceOption[] {
  return drivers.map((driver, index) => ({
    value: driver.id,
    label: generateDriverLabel(driver) || `Driver ${index + 1}`,
    driverId: driver.id,
    isOwner: false,
    isSpouse: false,
    firstName: driver.firstName.value,
    lastName: driver.lastName.value,
  }))
}

/**
 * Find a driver by their reference ID
 */
export function findDriverByRef(
  drivers: DriverData[],
  driverRef: string,
  owner?: OwnerInfo,
  spouse?: SpouseInfo
): { driver?: DriverData; isOwner: boolean; isSpouse: boolean } {
  if (driverRef === '__owner__') {
    return { driver: undefined, isOwner: true, isSpouse: false }
  }

  if (driverRef === '__spouse__') {
    return { driver: undefined, isOwner: false, isSpouse: true }
  }

  const driver = drivers.find(d => d.id === driverRef)
  return { driver, isOwner: false, isSpouse: false }
}

/**
 * Find a driver by name
 */
export function findDriverByName(
  drivers: DriverData[],
  firstName: string,
  lastName: string
): DriverData | undefined {
  const normalizedFirst = firstName.toLowerCase().trim()
  const normalizedLast = lastName.toLowerCase().trim()

  return drivers.find(d => {
    const driverFirst = d.firstName.value?.toLowerCase().trim()
    const driverLast = d.lastName.value?.toLowerCase().trim()
    return driverFirst === normalizedFirst && driverLast === normalizedLast
  })
}

// =============================================================================
// Reference Dependency Tracking
// =============================================================================

/**
 * Get all dependencies for a specific driver
 */
export function getDriverDependencies(
  driverId: string,
  accidents: AccidentData[],
  tickets: TicketData[]
): ReferenceDependency[] {
  const dependencies: ReferenceDependency[] = []

  // Check accidents
  accidents.forEach(accident => {
    if (accident.driverRef.value === driverId) {
      dependencies.push({
        dependentType: 'accident',
        dependentId: accident.id,
        fieldName: 'driverRef',
        label: `Accident on ${accident.date.value || 'unknown date'}`,
      })
    }
  })

  // Check tickets
  tickets.forEach(ticket => {
    if (ticket.driverRef.value === driverId) {
      dependencies.push({
        dependentType: 'ticket',
        dependentId: ticket.id,
        fieldName: 'driverRef',
        label: `Ticket on ${ticket.date.value || 'unknown date'}`,
      })
    }
  })

  return dependencies
}

/**
 * Check if a driver can be safely deleted
 */
export function canDeleteDriver(
  driverId: string,
  accidents: AccidentData[],
  tickets: TicketData[]
): { canDelete: boolean; warning?: ReferenceWarning } {
  const dependencies = getDriverDependencies(driverId, accidents, tickets)

  if (dependencies.length === 0) {
    return { canDelete: true }
  }

  return {
    canDelete: false,
    warning: {
      referencedId: driverId,
      referencedType: 'driver',
      referencedLabel: 'This driver',
      dependencies,
      message: `This driver is referenced by ${dependencies.length} accident/ticket record(s). Please remove or reassign these references before deleting.`,
    },
  }
}

/**
 * Generate a warning message for driver deletion with dependencies
 */
export function generateDriverDeletionWarning(
  driver: DriverData,
  dependencies: ReferenceDependency[]
): string {
  const driverLabel = generateDriverLabel(driver)
  const dependencyLabels = dependencies.map(d => d.label).join(', ')

  return `Cannot delete "${driverLabel}" because they are associated with: ${dependencyLabels}. Please remove or reassign these records first.`
}

// =============================================================================
// Reference Updates
// =============================================================================

/**
 * Update all references when a driver ID changes
 */
export function updateDriverReferences(
  oldDriverId: string,
  newDriverId: string,
  accidents: AccidentData[],
  tickets: TicketData[]
): {
  accidents: AccidentData[]
  tickets: TicketData[]
} {
  const updatedAccidents = accidents.map(a => {
    if (a.driverRef.value === oldDriverId) {
      return {
        ...a,
        driverRef: { ...a.driverRef, value: newDriverId },
      }
    }
    return a
  })

  const updatedTickets = tickets.map(t => {
    if (t.driverRef.value === oldDriverId) {
      return {
        ...t,
        driverRef: { ...t.driverRef, value: newDriverId },
      }
    }
    return t
  })

  return {
    accidents: updatedAccidents,
    tickets: updatedTickets,
  }
}

/**
 * Remove all orphaned references (references to deleted drivers)
 */
export function removeOrphanedDriverReferences(
  driverIds: Set<string>,
  accidents: AccidentData[],
  tickets: TicketData[],
  includeOwnerSpouse: boolean = true
): {
  accidents: AccidentData[]
  tickets: TicketData[]
  orphanedAccidentIds: string[]
  orphanedTicketIds: string[]
} {
  const validDriverRefs = new Set(driverIds)
  if (includeOwnerSpouse) {
    validDriverRefs.add('__owner__')
    validDriverRefs.add('__spouse__')
  }

  const orphanedAccidentIds: string[] = []
  const orphanedTicketIds: string[] = []

  // For accidents/tickets, we might want to keep them but clear the driver ref
  // rather than deleting them entirely. Here we just filter.
  const validAccidents = accidents.filter(a => {
    const ref = a.driverRef.value
    if (ref && !validDriverRefs.has(ref)) {
      orphanedAccidentIds.push(a.id)
      return false
    }
    return true
  })

  const validTickets = tickets.filter(t => {
    const ref = t.driverRef.value
    if (ref && !validDriverRefs.has(ref)) {
      orphanedTicketIds.push(t.id)
      return false
    }
    return true
  })

  return {
    accidents: validAccidents,
    tickets: validTickets,
    orphanedAccidentIds,
    orphanedTicketIds,
  }
}

// =============================================================================
// Driver Statistics
// =============================================================================

/**
 * Count accidents for a specific driver
 */
export function countDriverAccidents(
  driverId: string,
  accidents: AccidentData[]
): number {
  return accidents.filter(a => a.driverRef.value === driverId).length
}

/**
 * Count tickets for a specific driver
 */
export function countDriverTickets(
  driverId: string,
  tickets: TicketData[]
): number {
  return tickets.filter(t => t.driverRef.value === driverId).length
}

/**
 * Get all incidents (accidents + tickets) for a driver
 */
export function getDriverIncidents(
  driverId: string,
  accidents: AccidentData[],
  tickets: TicketData[]
): { accidents: AccidentData[]; tickets: TicketData[] } {
  return {
    accidents: accidents.filter(a => a.driverRef.value === driverId),
    tickets: tickets.filter(t => t.driverRef.value === driverId),
  }
}
