/**
 * Array Fields Module
 * Comprehensive utilities for managing dynamic array fields in extraction forms
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Base types
  ConfidenceLevel,
  ArrayFieldItem,

  // Data types
  VehicleData,
  VehicleReferenceOption,
  DriverData,
  DriverReferenceOption,
  AccidentData,
  TicketData,
  DeductibleData,
  LienholderData,
  ScheduledItemData,
  ClaimData,

  // Reference types
  ReferenceDependency,
  ReferenceWarning,

  // Validation types
  ArrayFieldValidation,
  ArrayFieldValidationError,

  // Confidence types
  ConfidenceAggregation,
  SectionConfidence,
  ItemConfidence,

  // Persistence types
  DraftState,
  PersistenceConfig,
} from './types'

// =============================================================================
// Vehicle References
// =============================================================================

export {
  // Label generation
  generateVehicleLabel,
  generateVehicleShortLabel,
  generateVehicleLabelWithVin,

  // Reference options
  generateVehicleOptions,
  findVehicleByRef,
  findVehicleByVin,

  // Dependency tracking
  getVehicleDependencies,
  canDeleteVehicle,
  generateVehicleDeletionWarning,

  // Reference updates
  updateVehicleReferences,
  removeOrphanedVehicleReferences,

  // Auto-create
  vehicleHasDeductible,
  getMissingVehicleDeductibles,
  getVehiclesNeedingDeductibles,
} from './vehicle-references'

// =============================================================================
// Driver References
// =============================================================================

export type { OwnerInfo, SpouseInfo } from './driver-references'

export {
  // Label generation
  generateDriverLabel,
  generateDriverLabelWithRelationship,
  generateDriverShortLabel,

  // Reference options
  generateDriverOptionsWithOwner,
  generateDriverOptions,
  findDriverByRef,
  findDriverByName,

  // Dependency tracking
  getDriverDependencies,
  canDeleteDriver,
  generateDriverDeletionWarning,

  // Reference updates
  updateDriverReferences,
  removeOrphanedDriverReferences,

  // Statistics
  countDriverAccidents,
  countDriverTickets,
  getDriverIncidents,
} from './driver-references'

// =============================================================================
// Validation
// =============================================================================

export {
  // VIN validation
  validateVin,
  normalizeVin,

  // Coverage validation
  validateCoverageLimits,
  parseCoverageLimits,

  // Date validation
  validateDate,
  validateDateNotFuture,
  validateDateWithinYears,

  // Field validation
  hasValue,
  validateVehicleRequired,
  validateDriverRequired,

  // Array validation
  validateMinimumVehicles,
  validateMinimumDrivers,
  validateVehicleArray,
  validateDriverArray,
  validateDeductibleArray,
  validateClaimArray,
  validateAccidentArray,
  validateScheduledItemArray,
} from './validation'

// =============================================================================
// Confidence Aggregation
// =============================================================================

export {
  // Confidence calculation
  calculateOverallConfidence,
  getConfidenceWeight,
  compareConfidence,

  // Field aggregation
  aggregateFieldConfidence,
  aggregateFieldArrayConfidence,

  // Item aggregation
  extractFieldsFromItem,
  calculateItemConfidence,
  calculateArrayConfidence,

  // Section aggregation
  calculateSectionConfidence,

  // Required fields
  checkRequiredFields,
  checkArrayRequiredFields,

  // Flagged fields
  getFlaggedFields,
  countFlaggedFields,
  getItemsWithFlaggedFields,

  // Low confidence fields
  getLowConfidenceFields,
  countLowConfidenceFields,
  sortItemsByIssueCount,
} from './confidence'

// =============================================================================
// Factories
// =============================================================================

export {
  // Field factory
  createEmptyField,
  createFieldFromValue,

  // Item factories
  createDefaultVehicle,
  createVehicle,
  createDefaultDriver,
  createDriver,
  createDefaultClaim,
  createClaim,
  createDefaultAccident,
  createAccident,
  createDefaultTicket,
  createTicket,
  createDefaultDeductible,
  createDeductibleForVehicle,
  createDefaultLienholder,
  createLienholderForVehicle,
  createDefaultScheduledItem,
  createScheduledItem,

  // Batch creation
  createVehicles,
  createDrivers,
  createDeductiblesForVehicles,
} from './factories'

// =============================================================================
// Persistence
// =============================================================================

export {
  // Storage key generation
  generateStorageKey,
  generateVersionedKey,

  // Storage operations
  isStorageAvailable,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  getStorageKeysByPrefix,

  // Draft state management
  saveDraftState,
  loadDraftState,
  clearDraftState,
  clearAllDrafts,
  hasDraft,
  getDraftMetadata,

  // Migration
  registerMigration,
  applyMigrations,

  // Auto-save
  createDebouncedSave,

  // Cross-tab sync
  subscribeToStorageChanges,
} from './persistence'

// =============================================================================
// Synchronization
// =============================================================================

export type {
  VehicleSyncResult,
  DriverSyncResult,
  FormArrayState,
  SyncOptions,
  ConsistencyIssue,
} from './synchronization'

export {
  // Vehicle-deductible sync
  syncVehicleDeductibles,
  onVehicleAdded,
  onVehicleRemoved,

  // Driver-incident sync
  onDriverRemoved,

  // Full state sync
  synchronizeArrayFields,

  // Reference updates
  reassignVehicleReferences,
  reassignDriverReferences,

  // Consistency
  checkConsistency,
} from './synchronization'
