// Re-export extraction types
export type {
  ExtractionField,
  ExtractionBooleanField,
  ExtractionNumberField,
  // Shared
  SharedPersonalInfo,
  AutoSpecificPersonalInfo,
  // Home types
  HomePersonalInfo,
  HomePropertyInfo,
  HomeSafetyInfo,
  HomeCoverageInfo,
  HomeClaimsHistory,
  HomeLienholderInfo,
  HomeUpdatesInfo,
  HomeApiExtractionResult,
  HomeScheduledItem,
  HomeClaimEntry,
  // Auto types
  AutoPersonalInfo,
  AutoAdditionalDriver,
  AutoVehicle,
  AutoCoverageInfo,
  AutoVehicleDeductible,
  AutoVehicleLienholder,
  AutoPriorInsurance,
  AutoAccidentOrTicket,
  AutoApiExtractionResult,
  // Combined
  CombinedExtractionData,
  // Legacy
  ExtractionResult,
  ExtractionStatus,
  InsuranceType,
  Extraction,
} from './extraction'

export {
  // Home fields
  HOME_REQUIRED_FIELDS,
  HOME_FIELD_LABELS,
  // Auto fields
  AUTO_REQUIRED_FIELDS,
  AUTO_FIELD_LABELS,
  // Shared fields
  SHARED_REQUIRED_FIELDS,
  SHARED_FIELD_LABELS,
} from './extraction'

// Re-export database types
export * from './database'

// Re-export quote types
export * from './quote'

// Re-export home extraction UI types
export * from './home-extraction'

// Re-export auto extraction UI types (excluding createEmptyExtractionField to avoid conflict)
export {
  // Types
  type AutoFieldInputType,
  type AutoFieldConfig,
  type AutoExtractionResult,
  type AutoSectionConfig,
  // Constants
  US_STATES,
  AUTO_PERSONAL_FIELDS,
  AUTO_DRIVER_FIELDS,
  AUTO_VEHICLE_FIELDS,
  AUTO_COVERAGE_FIELDS,
  AUTO_DEDUCTIBLE_FIELDS,
  AUTO_LIENHOLDER_FIELDS,
  AUTO_PRIOR_INSURANCE_FIELDS,
  AUTO_ACCIDENT_TICKET_FIELDS,
  AUTO_SECTIONS,
  // Helper functions (renamed to avoid conflicts)
  createEmptyBooleanField as createEmptyAutoBooleanField,
  createEmptyAutoDriver,
  createEmptyAutoVehicle,
  createEmptyAutoDeductible,
  createEmptyAutoLienholder,
  createEmptyAutoPriorInsurance,
  createEmptyAutoAccidentOrTicket,
  createEmptyAutoPersonal,
  createEmptyAutoCoverage,
  createEmptyAutoExtraction,
  // Utility functions
  getVehicleDisplayName,
  getDriverDisplayName,
  validateVIN,
  parseCoverageLimit,
  apiToUiAutoExtraction,
  uiToApiAutoExtraction,
} from './auto-extraction'
