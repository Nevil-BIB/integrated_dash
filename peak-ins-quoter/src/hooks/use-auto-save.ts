'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Auto-save status enum
 */
export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/**
 * Auto-save hook options
 */
export interface UseAutoSaveOptions<T> {
  /**
   * The current data to auto-save
   */
  data: T

  /**
   * The save function that persists data
   * Should return a Promise that resolves on success or rejects on error
   */
  onSave: (data: T) => Promise<void>

  /**
   * Debounce delay in milliseconds
   * @default 1500
   */
  debounceMs?: number

  /**
   * Whether auto-save is enabled
   * @default true
   */
  enabled?: boolean

  /**
   * Callback when save succeeds
   */
  onSaveSuccess?: () => void

  /**
   * Callback when save fails
   */
  onSaveError?: (error: Error) => void

  /**
   * How long to show "saved" status before returning to idle
   * @default 2000
   */
  savedDisplayMs?: number

  /**
   * Custom equality comparison function
   * If not provided, uses JSON.stringify comparison
   * Return true if values are equal (no save needed)
   */
  isEqual?: (a: T, b: T) => boolean
}

/**
 * Auto-save hook return value
 */
export interface UseAutoSaveReturn {
  /**
   * Current auto-save status
   * - 'idle': No pending changes
   * - 'pending': Changes detected, waiting for debounce
   * - 'saving': Save in progress
   * - 'saved': Save completed successfully (resets to idle after savedDisplayMs)
   * - 'error': Save failed
   */
  status: AutoSaveStatus

  /**
   * Whether there are unsaved changes (pending or saving)
   * @alias isDirty
   */
  hasUnsavedChanges: boolean

  /**
   * Whether there are unsaved changes (alias for hasUnsavedChanges)
   */
  isDirty: boolean

  /**
   * Last saved timestamp (null if never saved)
   */
  lastSavedAt: Date | null

  /**
   * The error if save failed
   */
  error: Error | null

  /**
   * Manually trigger a save (bypasses debounce)
   */
  saveNow: () => Promise<void>

  /**
   * Alias for saveNow - manually trigger a save (bypasses debounce)
   */
  forceSave: () => Promise<void>

  /**
   * Reset the status to idle (e.g., after dismissing an error)
   */
  resetStatus: () => void

  /**
   * Clear error and return to idle
   */
  clearError: () => void
}

/**
 * Default equality comparison using JSON serialization
 * Handles most common cases but may not work for all data types
 */
function defaultIsEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    // Fallback to reference equality if JSON serialization fails
    return a === b
  }
}

/**
 * Custom hook for auto-saving form data with debouncing and race condition handling
 *
 * Features:
 * - Debounces saves to avoid API spam
 * - Tracks saving/saved/error states for UI feedback
 * - Provides manual "forceSave" for immediate save
 * - Handles component unmount gracefully (cancels pending saves)
 * - Handles race conditions (data changes during save)
 * - Only saves when data actually changes (configurable comparison)
 * - Supports custom equality comparison for complex data
 *
 * @example
 * ```tsx
 * const { status, isDirty, forceSave, lastSavedAt, error } = useAutoSave({
 *   data: formData,
 *   onSave: async (data) => {
 *     await api.updateForm(data)
 *   },
 *   debounceMs: 1500,
 *   enabled: isFormValid,
 * })
 *
 * // Show save status indicator
 * <SaveStatus status={status} lastSavedAt={lastSavedAt} />
 *
 * // Force save on blur
 * <input onBlur={() => forceSave()} />
 * ```
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 1500,
  enabled = true,
  onSaveSuccess,
  onSaveError,
  savedDisplayMs = 2000,
  isEqual = defaultIsEqual,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Refs to track state across renders and prevent race conditions
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const isFirstRenderRef = useRef(true)
  const lastSavedDataRef = useRef<T>(data)
  const latestDataRef = useRef<T>(data)
  const isSavingRef = useRef(false)
  const saveVersionRef = useRef(0)
  const pendingRetryRef = useRef(false)

  // Keep latest data ref updated for race condition handling
  latestDataRef.current = data

  // Cleanup function - clears all timers
  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
  }, [])

  /**
   * Core save function with race condition handling
   * Uses save version to ensure only the latest save request is processed
   */
  const performSave = useCallback(
    async (dataToSave: T, version: number) => {
      // Guard: Don't save if unmounted or version is stale
      if (!isMountedRef.current || version !== saveVersionRef.current) {
        return
      }

      // Guard: If already saving, mark for retry after current save completes
      if (isSavingRef.current) {
        pendingRetryRef.current = true
        return
      }

      // Guard: Skip if data hasn't actually changed from last save
      if (isEqual(dataToSave, lastSavedDataRef.current)) {
        if (isMountedRef.current && version === saveVersionRef.current) {
          setStatus('idle')
        }
        return
      }

      isSavingRef.current = true
      setStatus('saving')
      setError(null)

      try {
        await onSave(dataToSave)

        // Post-save guards
        if (!isMountedRef.current) return
        if (version !== saveVersionRef.current) return

        // Success: Update last saved reference
        lastSavedDataRef.current = dataToSave
        setLastSavedAt(new Date())
        setStatus('saved')
        onSaveSuccess?.()

        // Reset to idle after showing "saved" indicator
        savedTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && !pendingRetryRef.current) {
            setStatus('idle')
          }
        }, savedDisplayMs)

        // Check for race condition: data changed during save
        if (!isEqual(latestDataRef.current, dataToSave) && pendingRetryRef.current) {
          pendingRetryRef.current = false
          // Schedule a new save for the updated data
          saveVersionRef.current += 1
          const newVersion = saveVersionRef.current
          setTimeout(() => {
            performSave(latestDataRef.current, newVersion)
          }, 100)
        }
      } catch (err) {
        if (!isMountedRef.current) return
        if (version !== saveVersionRef.current) return

        const saveError = err instanceof Error ? err : new Error('Failed to save')
        setError(saveError)
        setStatus('error')
        onSaveError?.(saveError)
      } finally {
        isSavingRef.current = false
        pendingRetryRef.current = false
      }
    },
    [onSave, onSaveSuccess, onSaveError, savedDisplayMs, isEqual]
  )

  /**
   * Manual save - bypasses debounce and saves immediately
   */
  const saveNow = useCallback(async () => {
    clearTimers()
    saveVersionRef.current += 1
    const version = saveVersionRef.current
    await performSave(latestDataRef.current, version)
  }, [clearTimers, performSave])

  // Alias for saveNow
  const forceSave = saveNow

  /**
   * Reset status to idle and clear error
   */
  const resetStatus = useCallback(() => {
    clearTimers()
    setStatus('idle')
    setError(null)
    pendingRetryRef.current = false
  }, [clearTimers])

  // Alias for resetStatus
  const clearError = resetStatus

  /**
   * Effect: Handle auto-save on data changes
   */
  useEffect(() => {
    // Skip first render - initial data load shouldn't trigger save
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      lastSavedDataRef.current = data
      return
    }

    // Skip if disabled
    if (!enabled) return

    // Skip if data hasn't actually changed from last save
    if (isEqual(data, lastSavedDataRef.current)) return

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set pending status
    setStatus('pending')

    // Increment save version (invalidates any in-flight operations)
    saveVersionRef.current += 1
    const version = saveVersionRef.current

    // Set up new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        performSave(latestDataRef.current, version)
      }
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [data, enabled, debounceMs, performSave, isEqual])

  /**
   * Effect: Cleanup on unmount
   */
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      clearTimers()
    }
  }, [clearTimers])

  // Calculate dirty state
  const isDirty = status === 'pending' || status === 'saving' || status === 'error'
  const hasUnsavedChanges = isDirty

  return {
    status,
    hasUnsavedChanges,
    isDirty,
    lastSavedAt,
    error,
    saveNow,
    forceSave,
    resetStatus,
    clearError,
  }
}
