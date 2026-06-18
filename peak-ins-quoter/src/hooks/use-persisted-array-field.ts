'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  useArrayField,
  type ArrayFieldItem,
  type UseArrayFieldOptions,
  type UseArrayFieldReturn,
} from './use-array-field'
import {
  saveDraftState,
  loadDraftState,
  clearDraftState,
  type PersistenceConfig,
} from '@/lib/array-fields/persistence'

/**
 * Options for the persisted array field hook
 */
export interface UsePersistedArrayFieldOptions<T extends ArrayFieldItem>
  extends UseArrayFieldOptions<T> {
  /** Storage key for persisting draft state */
  storageKey: string
  /** Schema version for migration support */
  version?: number
  /** Optional extraction ID for scoping storage */
  extractionId?: string
  /** Debounce delay for auto-save (ms) */
  debounceMs?: number
  /** Whether to auto-restore from storage on mount */
  autoRestore?: boolean
}

/**
 * Return type extending the base useArrayField return
 */
export interface UsePersistedArrayFieldReturn<T extends ArrayFieldItem>
  extends UseArrayFieldReturn<T> {
  /** Whether there is a saved draft */
  hasDraft: boolean
  /** When the draft was last saved */
  lastSavedAt: string | null
  /** Manually save the current state */
  saveDraft: () => boolean
  /** Restore from saved draft */
  restoreDraft: () => boolean
  /** Clear the saved draft */
  clearDraft: () => boolean
  /** Whether the state has unsaved changes */
  isDirty: boolean
}

/**
 * Hook that extends useArrayField with localStorage persistence
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   addItem,
 *   removeItem,
 *   hasDraft,
 *   restoreDraft,
 *   clearDraft,
 * } = usePersistedArrayField({
 *   storageKey: 'auto-quote-vehicles',
 *   extractionId: extraction?.id,
 *   version: 1,
 *   createDefaultItem: createDefaultVehicle,
 *   minItems: 1,
 *   maxItems: 6,
 * })
 * ```
 */
export function usePersistedArrayField<T extends ArrayFieldItem>(
  options: UsePersistedArrayFieldOptions<T>
): UsePersistedArrayFieldReturn<T> {
  const {
    storageKey,
    version = 1,
    extractionId,
    debounceMs = 1000,
    autoRestore = true,
    ...arrayFieldOptions
  } = options

  // Track if we've initialized from storage
  const isInitializedRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedItemsRef = useRef<string>('')
  const lastSavedAtRef = useRef<string | null>(null)

  // Persistence config
  const persistenceConfig: PersistenceConfig = {
    storageKey,
    version,
    extractionId,
    debounceMs,
  }

  // Initialize array field
  const arrayField = useArrayField(arrayFieldOptions)

  // Check for saved draft
  const checkForDraft = useCallback((): boolean => {
    const draft = loadDraftState<T[]>(persistenceConfig)
    return draft !== null
  }, [storageKey, version, extractionId])

  // Restore from draft
  const restoreDraft = useCallback((): boolean => {
    const draft = loadDraftState<T[]>(persistenceConfig)
    if (draft) {
      arrayField.setItems(draft.data)
      lastSavedAtRef.current = draft.savedAt
      lastSavedItemsRef.current = JSON.stringify(draft.data)
      return true
    }
    return false
  }, [arrayField.setItems, storageKey, version, extractionId])

  // Save draft manually
  const saveDraft = useCallback((): boolean => {
    const success = saveDraftState(persistenceConfig, arrayField.items)
    if (success) {
      lastSavedAtRef.current = new Date().toISOString()
      lastSavedItemsRef.current = JSON.stringify(arrayField.items)
    }
    return success
  }, [arrayField.items, storageKey, version, extractionId])

  // Clear draft
  const clearDraft = useCallback((): boolean => {
    const success = clearDraftState(persistenceConfig)
    if (success) {
      lastSavedAtRef.current = null
      lastSavedItemsRef.current = ''
    }
    return success
  }, [storageKey, version, extractionId])

  // Auto-restore on mount
  useEffect(() => {
    if (!isInitializedRef.current && autoRestore) {
      const draft = loadDraftState<T[]>(persistenceConfig)
      if (draft) {
        arrayField.setItems(draft.data)
        lastSavedAtRef.current = draft.savedAt
        lastSavedItemsRef.current = JSON.stringify(draft.data)
      }
      isInitializedRef.current = true
    }
  }, [autoRestore])

  // Auto-save with debounce when items change
  useEffect(() => {
    // Skip if not initialized (prevents saving initial state before restore)
    if (!isInitializedRef.current) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveDraftState(persistenceConfig, arrayField.items)
      lastSavedAtRef.current = new Date().toISOString()
      lastSavedItemsRef.current = JSON.stringify(arrayField.items)
    }, debounceMs)

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [arrayField.items, debounceMs])

  // Check if dirty
  const isDirty = JSON.stringify(arrayField.items) !== lastSavedItemsRef.current

  return {
    ...arrayField,
    hasDraft: checkForDraft(),
    lastSavedAt: lastSavedAtRef.current,
    saveDraft,
    restoreDraft,
    clearDraft,
    isDirty,
  }
}
