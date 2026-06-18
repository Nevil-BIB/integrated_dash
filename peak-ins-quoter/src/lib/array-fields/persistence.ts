/**
 * Form State Persistence Utilities
 * Save and restore draft form state to localStorage
 */

import type { DraftState, PersistenceConfig } from './types'

// Re-export types for convenience
export type { DraftState, PersistenceConfig } from './types'

// =============================================================================
// Storage Key Generation
// =============================================================================

/**
 * Generate a storage key for draft state
 */
export function generateStorageKey(
  baseKey: string,
  extractionId?: string
): string {
  if (extractionId) {
    return `${baseKey}_${extractionId}`
  }
  return baseKey
}

/**
 * Generate a versioned storage key
 */
export function generateVersionedKey(
  baseKey: string,
  version: number
): string {
  return `${baseKey}_v${version}`
}

// =============================================================================
// Local Storage Operations
// =============================================================================

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Safely get an item from localStorage
 */
export function getStorageItem<T>(key: string): T | null {
  if (!isStorageAvailable()) return null

  try {
    const item = window.localStorage.getItem(key)
    if (!item) return null
    return JSON.parse(item) as T
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error)
    return null
  }
}

/**
 * Safely set an item in localStorage
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (!isStorageAvailable()) return false

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Error writing to localStorage (${key}):`, error)
    return false
  }
}

/**
 * Safely remove an item from localStorage
 */
export function removeStorageItem(key: string): boolean {
  if (!isStorageAvailable()) return false

  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/**
 * Get all storage keys matching a prefix
 */
export function getStorageKeysByPrefix(prefix: string): string[] {
  if (!isStorageAvailable()) return []

  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      keys.push(key)
    }
  }
  return keys
}

// =============================================================================
// Draft State Management
// =============================================================================

/**
 * Save draft state to localStorage
 */
export function saveDraftState<T>(
  config: PersistenceConfig,
  data: T
): boolean {
  const key = generateStorageKey(config.storageKey, config.extractionId)
  const versionedKey = generateVersionedKey(key, config.version)

  const draft: DraftState<T> = {
    data,
    version: config.version,
    savedAt: new Date().toISOString(),
    extractionId: config.extractionId,
  }

  return setStorageItem(versionedKey, draft)
}

/**
 * Load draft state from localStorage
 */
export function loadDraftState<T>(
  config: PersistenceConfig
): DraftState<T> | null {
  const key = generateStorageKey(config.storageKey, config.extractionId)
  const versionedKey = generateVersionedKey(key, config.version)

  const draft = getStorageItem<DraftState<T>>(versionedKey)

  if (!draft) return null

  // Check version compatibility
  if (draft.version !== config.version) {
    console.warn(`Draft version mismatch: expected ${config.version}, got ${draft.version}`)
    // Attempt migration or return null
    return attemptMigration(draft, config.version)
  }

  return draft
}

/**
 * Clear draft state from localStorage
 */
export function clearDraftState(config: PersistenceConfig): boolean {
  const key = generateStorageKey(config.storageKey, config.extractionId)
  const versionedKey = generateVersionedKey(key, config.version)

  return removeStorageItem(versionedKey)
}

/**
 * Clear all drafts for a given base key
 */
export function clearAllDrafts(baseKey: string): number {
  const keys = getStorageKeysByPrefix(baseKey)
  let cleared = 0

  keys.forEach(key => {
    if (removeStorageItem(key)) {
      cleared++
    }
  })

  return cleared
}

/**
 * Check if a draft exists
 */
export function hasDraft(config: PersistenceConfig): boolean {
  const key = generateStorageKey(config.storageKey, config.extractionId)
  const versionedKey = generateVersionedKey(key, config.version)

  return getStorageItem(versionedKey) !== null
}

/**
 * Get draft metadata without loading full data
 */
export function getDraftMetadata(
  config: PersistenceConfig
): { savedAt: string; version: number } | null {
  const key = generateStorageKey(config.storageKey, config.extractionId)
  const versionedKey = generateVersionedKey(key, config.version)

  const draft = getStorageItem<DraftState<unknown>>(versionedKey)

  if (!draft) return null

  return {
    savedAt: draft.savedAt,
    version: draft.version,
  }
}

// =============================================================================
// Version Migration
// =============================================================================

/**
 * Attempt to migrate draft data to a newer version
 * Returns null if migration is not possible
 */
function attemptMigration<T>(
  draft: DraftState<T>,
  targetVersion: number
): DraftState<T> | null {
  // For now, we don't support automatic migration
  // In the future, you can add migration logic here based on version numbers

  console.warn(
    `Cannot migrate draft from version ${draft.version} to ${targetVersion}. ` +
    'Draft will be discarded.'
  )

  return null
}

/**
 * Register a migration function for a specific version transition
 */
type MigrationFunction<TOld, TNew> = (oldData: TOld) => TNew

interface MigrationRegistry {
  [key: string]: MigrationFunction<unknown, unknown>
}

const migrationRegistry: MigrationRegistry = {}

/**
 * Register a migration function
 */
export function registerMigration<TOld, TNew>(
  fromVersion: number,
  toVersion: number,
  migrationFn: MigrationFunction<TOld, TNew>
): void {
  const key = `${fromVersion}->${toVersion}`
  migrationRegistry[key] = migrationFn as MigrationFunction<unknown, unknown>
}

/**
 * Apply migrations to get from one version to another
 */
export function applyMigrations<T>(
  data: unknown,
  fromVersion: number,
  toVersion: number
): T | null {
  let currentVersion = fromVersion
  let currentData = data

  while (currentVersion < toVersion) {
    const nextVersion = currentVersion + 1
    const key = `${currentVersion}->${nextVersion}`
    const migrationFn = migrationRegistry[key]

    if (!migrationFn) {
      console.error(`No migration found for ${key}`)
      return null
    }

    currentData = migrationFn(currentData)
    currentVersion = nextVersion
  }

  return currentData as T
}

// =============================================================================
// Debounced Auto-Save
// =============================================================================

/**
 * Create a debounced save function
 */
export function createDebouncedSave<T>(
  config: PersistenceConfig,
  debounceMs: number = 1000
): {
  save: (data: T) => void
  saveImmediately: (data: T) => boolean
  cancel: () => void
} {
  let timeoutId: NodeJS.Timeout | null = null

  const save = (data: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      saveDraftState(config, data)
      timeoutId = null
    }, debounceMs)
  }

  const saveImmediately = (data: T): boolean => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    return saveDraftState(config, data)
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return { save, saveImmediately, cancel }
}

// =============================================================================
// Storage Event Handling
// =============================================================================

/**
 * Subscribe to storage changes (for cross-tab synchronization)
 */
export function subscribeToStorageChanges(
  keyPrefix: string,
  callback: (key: string, newValue: unknown | null) => void
): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key && event.key.startsWith(keyPrefix)) {
      const newValue = event.newValue ? JSON.parse(event.newValue) : null
      callback(event.key, newValue)
    }
  }

  window.addEventListener('storage', handler)

  return () => {
    window.removeEventListener('storage', handler)
  }
}
