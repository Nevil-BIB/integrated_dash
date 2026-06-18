'use client'

import { useCallback, useMemo, useState } from 'react'
import { useArrayField, generateArrayFieldId } from './use-array-field'
import type {
  VehicleData,
  DriverData,
  DeductibleData,
  LienholderData,
  AccidentData,
  TicketData,
  ClaimData,
  ScheduledItemData,
  FormArrayState,
  ConsistencyIssue,
  ReferenceWarning,
} from '@/lib/array-fields'
import {
  createDefaultVehicle,
  createDefaultDriver,
  createDefaultDeductible,
  createDefaultLienholder,
  createDefaultAccident,
  createDefaultTicket,
  createDefaultClaim,
  createDefaultScheduledItem,
  createDeductibleForVehicle,
  synchronizeArrayFields,
  checkConsistency,
  canDeleteVehicle,
  canDeleteDriver,
  generateVehicleLabel,
  generateDriverLabel,
} from '@/lib/array-fields'

/**
 * Options for the form arrays hook
 */
export interface UseFormArraysOptions {
  /** Initial state for all arrays */
  initialState?: Partial<FormArrayState>
  /** Auto-create deductibles when vehicles are added */
  autoCreateDeductibles?: boolean
  /** Callback when state changes */
  onStateChange?: (state: FormArrayState) => void
  /** Include owner info for driver options */
  ownerInfo?: {
    firstName: string | null
    lastName: string | null
  }
  /** Include spouse info for driver options */
  spouseInfo?: {
    firstName: string | null
    lastName: string | null
  }
}

/**
 * Return type for the form arrays hook
 */
export interface UseFormArraysReturn {
  // State
  state: FormArrayState

  // Vehicle management
  vehicles: {
    items: VehicleData[]
    add: () => void
    remove: (id: string) => Promise<{ success: boolean; warning?: ReferenceWarning }>
    update: (id: string, updates: Partial<VehicleData>) => void
    updateField: (id: string, field: keyof VehicleData, value: VehicleData[keyof VehicleData]) => void
    duplicate: (id: string) => void
    canAdd: boolean
    canRemove: boolean
    getLabel: (id: string) => string
  }

  // Driver management
  drivers: {
    items: DriverData[]
    add: () => void
    remove: (id: string) => Promise<{ success: boolean; warning?: ReferenceWarning }>
    update: (id: string, updates: Partial<DriverData>) => void
    updateField: (id: string, field: keyof DriverData, value: DriverData[keyof DriverData]) => void
    duplicate: (id: string) => void
    canAdd: boolean
    canRemove: boolean
    getLabel: (id: string) => string
  }

  // Deductible management
  deductibles: {
    items: DeductibleData[]
    add: (vehicleId?: string) => void
    remove: (id: string) => Promise<boolean>
    update: (id: string, updates: Partial<DeductibleData>) => void
    updateField: (id: string, field: keyof DeductibleData, value: DeductibleData[keyof DeductibleData]) => void
    getForVehicle: (vehicleId: string) => DeductibleData | undefined
  }

  // Lienholder management
  lienholders: {
    items: LienholderData[]
    add: (vehicleId?: string) => void
    remove: (id: string) => Promise<boolean>
    update: (id: string, updates: Partial<LienholderData>) => void
    updateField: (id: string, field: keyof LienholderData, value: LienholderData[keyof LienholderData]) => void
    getForVehicle: (vehicleId: string) => LienholderData[]
  }

  // Accident management
  accidents: {
    items: AccidentData[]
    add: (driverId?: string) => void
    remove: (id: string) => Promise<boolean>
    update: (id: string, updates: Partial<AccidentData>) => void
    updateField: (id: string, field: keyof AccidentData, value: AccidentData[keyof AccidentData]) => void
    getForDriver: (driverId: string) => AccidentData[]
  }

  // Ticket management
  tickets: {
    items: TicketData[]
    add: (driverId?: string) => void
    remove: (id: string) => Promise<boolean>
    update: (id: string, updates: Partial<TicketData>) => void
    updateField: (id: string, field: keyof TicketData, value: TicketData[keyof TicketData]) => void
    getForDriver: (driverId: string) => TicketData[]
  }

  // Claims management (for home insurance)
  claims: {
    items: ClaimData[]
    add: () => void
    remove: (id: string) => Promise<boolean>
    update: (id: string, updates: Partial<ClaimData>) => void
    updateField: (id: string, field: keyof ClaimData, value: ClaimData[keyof ClaimData]) => void
  }

  // Scheduled items management (for home insurance)
  scheduledItems: {
    items: ScheduledItemData[]
    add: () => void
    remove: (id: string) => Promise<boolean>
    update: (id: string, updates: Partial<ScheduledItemData>) => void
    updateField: (id: string, field: keyof ScheduledItemData, value: ScheduledItemData[keyof ScheduledItemData]) => void
  }

  // Synchronization
  synchronize: () => { changes: number; warnings: string[] }
  consistencyIssues: ConsistencyIssue[]

  // Bulk operations
  setAllState: (state: Partial<FormArrayState>) => void
  clearAll: () => void
}

/**
 * Hook for managing all form array fields with automatic synchronization
 */
export function useFormArrays(
  options: UseFormArraysOptions = {}
): UseFormArraysReturn {
  const {
    initialState = {},
    autoCreateDeductibles = true,
    onStateChange,
  } = options

  // Individual array field hooks
  const vehiclesHook = useArrayField<VehicleData>({
    initialItems: initialState.vehicles ?? [],
    minItems: 0,
    maxItems: 6,
    createDefaultItem: createDefaultVehicle,
  })

  const driversHook = useArrayField<DriverData>({
    initialItems: initialState.drivers ?? [],
    minItems: 0,
    maxItems: 10,
    createDefaultItem: createDefaultDriver,
  })

  const deductiblesHook = useArrayField<DeductibleData>({
    initialItems: initialState.deductibles ?? [],
    minItems: 0,
    maxItems: 10,
    createDefaultItem: createDefaultDeductible,
  })

  const lienholdersHook = useArrayField<LienholderData>({
    initialItems: initialState.lienholders ?? [],
    minItems: 0,
    maxItems: 10,
    createDefaultItem: createDefaultLienholder,
  })

  const accidentsHook = useArrayField<AccidentData>({
    initialItems: initialState.accidents ?? [],
    minItems: 0,
    maxItems: 20,
    createDefaultItem: createDefaultAccident,
  })

  const ticketsHook = useArrayField<TicketData>({
    initialItems: initialState.tickets ?? [],
    minItems: 0,
    maxItems: 20,
    createDefaultItem: createDefaultTicket,
  })

  const claimsHook = useArrayField<ClaimData>({
    initialItems: initialState.claims ?? [],
    minItems: 0,
    maxItems: 20,
    createDefaultItem: createDefaultClaim,
  })

  const scheduledItemsHook = useArrayField<ScheduledItemData>({
    initialItems: initialState.scheduledItems ?? [],
    minItems: 0,
    maxItems: 50,
    createDefaultItem: createDefaultScheduledItem,
  })

  // Pending warning state for deletion confirmations
  const [pendingWarning, setPendingWarning] = useState<ReferenceWarning | null>(null)

  // Build current state
  const state: FormArrayState = useMemo(() => ({
    vehicles: vehiclesHook.items,
    drivers: driversHook.items,
    deductibles: deductiblesHook.items,
    lienholders: lienholdersHook.items,
    accidents: accidentsHook.items,
    tickets: ticketsHook.items,
  }), [
    vehiclesHook.items,
    driversHook.items,
    deductiblesHook.items,
    lienholdersHook.items,
    accidentsHook.items,
    ticketsHook.items,
  ])

  // Vehicle management with auto-deductible creation
  const addVehicle = useCallback(() => {
    const newVehicle = createDefaultVehicle()
    vehiclesHook.addItemWithData(newVehicle)

    if (autoCreateDeductibles) {
      const newDeductible = createDeductibleForVehicle(newVehicle.id)
      deductiblesHook.addItemWithData(newDeductible)
    }
  }, [vehiclesHook, deductiblesHook, autoCreateDeductibles])

  const removeVehicle = useCallback(async (id: string): Promise<{
    success: boolean
    warning?: ReferenceWarning
  }> => {
    const { canDelete, warning } = canDeleteVehicle(
      id,
      deductiblesHook.items,
      lienholdersHook.items
    )

    if (!canDelete && warning) {
      return { success: false, warning }
    }

    const success = await vehiclesHook.removeItem(id)
    return { success }
  }, [vehiclesHook, deductiblesHook.items, lienholdersHook.items])

  const getVehicleLabel = useCallback((id: string): string => {
    const vehicle = vehiclesHook.getItem(id)
    return vehicle ? generateVehicleLabel(vehicle) : `Vehicle ${id.substring(0, 6)}`
  }, [vehiclesHook])

  // Driver management
  const removeDriver = useCallback(async (id: string): Promise<{
    success: boolean
    warning?: ReferenceWarning
  }> => {
    const { canDelete, warning } = canDeleteDriver(
      id,
      accidentsHook.items,
      ticketsHook.items
    )

    if (!canDelete && warning) {
      return { success: false, warning }
    }

    const success = await driversHook.removeItem(id)
    return { success }
  }, [driversHook, accidentsHook.items, ticketsHook.items])

  const getDriverLabel = useCallback((id: string): string => {
    const driver = driversHook.getItem(id)
    return driver ? generateDriverLabel(driver) : `Driver ${id.substring(0, 6)}`
  }, [driversHook])

  // Deductible helpers
  const addDeductible = useCallback((vehicleId?: string) => {
    if (vehicleId) {
      const newDeductible = createDeductibleForVehicle(vehicleId)
      deductiblesHook.addItemWithData(newDeductible)
    } else {
      deductiblesHook.addItem()
    }
  }, [deductiblesHook])

  const getDeductibleForVehicle = useCallback((vehicleId: string): DeductibleData | undefined => {
    return deductiblesHook.items.find(d => d.vehicleRef.value === vehicleId)
  }, [deductiblesHook.items])

  // Lienholder helpers
  const addLienholder = useCallback((vehicleId?: string) => {
    if (vehicleId) {
      const newLienholder: LienholderData = {
        ...createDefaultLienholder(),
        vehicleRef: { value: vehicleId, confidence: 'high', flagged: false },
      }
      lienholdersHook.addItemWithData(newLienholder)
    } else {
      lienholdersHook.addItem()
    }
  }, [lienholdersHook])

  const getLienholdersForVehicle = useCallback((vehicleId: string): LienholderData[] => {
    return lienholdersHook.items.filter(l => l.vehicleRef.value === vehicleId)
  }, [lienholdersHook.items])

  // Accident helpers
  const addAccident = useCallback((driverId?: string) => {
    if (driverId) {
      const newAccident: AccidentData = {
        ...createDefaultAccident(),
        driverRef: { value: driverId, confidence: 'high', flagged: false },
      }
      accidentsHook.addItemWithData(newAccident)
    } else {
      accidentsHook.addItem()
    }
  }, [accidentsHook])

  const getAccidentsForDriver = useCallback((driverId: string): AccidentData[] => {
    return accidentsHook.items.filter(a => a.driverRef.value === driverId)
  }, [accidentsHook.items])

  // Ticket helpers
  const addTicket = useCallback((driverId?: string) => {
    if (driverId) {
      const newTicket: TicketData = {
        ...createDefaultTicket(),
        driverRef: { value: driverId, confidence: 'high', flagged: false },
      }
      ticketsHook.addItemWithData(newTicket)
    } else {
      ticketsHook.addItem()
    }
  }, [ticketsHook])

  const getTicketsForDriver = useCallback((driverId: string): TicketData[] => {
    return ticketsHook.items.filter(t => t.driverRef.value === driverId)
  }, [ticketsHook.items])

  // Synchronization
  const synchronize = useCallback(() => {
    const result = synchronizeArrayFields(state, {
      autoCreateDeductibles,
      removeOrphanedDeductibles: false,
      removeOrphanedLienholders: false,
      clearOrphanedDriverRefs: true,
    })

    // Apply changes
    if (result.changes.addedDeductibles.length > 0) {
      deductiblesHook.setItems(result.state.deductibles)
    }
    if (result.changes.clearedDriverRefs.length > 0) {
      accidentsHook.setItems(result.state.accidents)
      ticketsHook.setItems(result.state.tickets)
    }

    const totalChanges =
      result.changes.addedDeductibles.length +
      result.changes.removedDeductibles.length +
      result.changes.removedLienholders.length +
      result.changes.clearedDriverRefs.length

    return {
      changes: totalChanges,
      warnings: result.warnings,
    }
  }, [state, autoCreateDeductibles, deductiblesHook, accidentsHook, ticketsHook])

  // Consistency check
  const consistencyIssues = useMemo(() => {
    return checkConsistency(state)
  }, [state])

  // Bulk operations
  const setAllState = useCallback((newState: Partial<FormArrayState>) => {
    if (newState.vehicles) vehiclesHook.setItems(newState.vehicles)
    if (newState.drivers) driversHook.setItems(newState.drivers)
    if (newState.deductibles) deductiblesHook.setItems(newState.deductibles)
    if (newState.lienholders) lienholdersHook.setItems(newState.lienholders)
    if (newState.accidents) accidentsHook.setItems(newState.accidents)
    if (newState.tickets) ticketsHook.setItems(newState.tickets)
  }, [vehiclesHook, driversHook, deductiblesHook, lienholdersHook, accidentsHook, ticketsHook])

  const clearAll = useCallback(() => {
    vehiclesHook.clearAll()
    driversHook.clearAll()
    deductiblesHook.clearAll()
    lienholdersHook.clearAll()
    accidentsHook.clearAll()
    ticketsHook.clearAll()
    claimsHook.clearAll()
    scheduledItemsHook.clearAll()
  }, [vehiclesHook, driversHook, deductiblesHook, lienholdersHook, accidentsHook, ticketsHook, claimsHook, scheduledItemsHook])

  return {
    state,

    vehicles: {
      items: vehiclesHook.items,
      add: addVehicle,
      remove: removeVehicle,
      update: vehiclesHook.updateItem,
      updateField: vehiclesHook.updateItemField,
      duplicate: vehiclesHook.duplicateItem,
      canAdd: vehiclesHook.canAdd,
      canRemove: vehiclesHook.canRemove,
      getLabel: getVehicleLabel,
    },

    drivers: {
      items: driversHook.items,
      add: driversHook.addItem,
      remove: removeDriver,
      update: driversHook.updateItem,
      updateField: driversHook.updateItemField,
      duplicate: driversHook.duplicateItem,
      canAdd: driversHook.canAdd,
      canRemove: driversHook.canRemove,
      getLabel: getDriverLabel,
    },

    deductibles: {
      items: deductiblesHook.items,
      add: addDeductible,
      remove: deductiblesHook.removeItem,
      update: deductiblesHook.updateItem,
      updateField: deductiblesHook.updateItemField,
      getForVehicle: getDeductibleForVehicle,
    },

    lienholders: {
      items: lienholdersHook.items,
      add: addLienholder,
      remove: lienholdersHook.removeItem,
      update: lienholdersHook.updateItem,
      updateField: lienholdersHook.updateItemField,
      getForVehicle: getLienholdersForVehicle,
    },

    accidents: {
      items: accidentsHook.items,
      add: addAccident,
      remove: accidentsHook.removeItem,
      update: accidentsHook.updateItem,
      updateField: accidentsHook.updateItemField,
      getForDriver: getAccidentsForDriver,
    },

    tickets: {
      items: ticketsHook.items,
      add: addTicket,
      remove: ticketsHook.removeItem,
      update: ticketsHook.updateItem,
      updateField: ticketsHook.updateItemField,
      getForDriver: getTicketsForDriver,
    },

    claims: {
      items: claimsHook.items,
      add: claimsHook.addItem,
      remove: claimsHook.removeItem,
      update: claimsHook.updateItem,
      updateField: claimsHook.updateItemField,
    },

    scheduledItems: {
      items: scheduledItemsHook.items,
      add: scheduledItemsHook.addItem,
      remove: scheduledItemsHook.removeItem,
      update: scheduledItemsHook.updateItem,
      updateField: scheduledItemsHook.updateItemField,
    },

    synchronize,
    consistencyIssues,
    setAllState,
    clearAll,
  }
}
