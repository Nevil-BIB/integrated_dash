// Client exports
export {
  sendToOpenRouter,
  createVisionMessage,
  extractFromImages,
  extractHomeFromImages,
  extractAutoFromImages,
  extractFromImagesWithType,
  extractWithPromptFromImages,
  createDefaultExtractionResult,
  createDefaultHomeApiExtractionResult,
  createDefaultAutoApiExtractionResult,
} from './client'

// Prompt exports
export {
  EXTRACTION_PROMPT,
  HOME_EXTRACTION_PROMPT,
  AUTO_EXTRACTION_PROMPT,
  SINGLE_FIELD_PROMPT,
  getExtractionPrompt,
} from './prompts'

// Schema exports (for runtime validation)
export {
  ExtractionFieldSchema,
  ExtractionBooleanFieldSchema,
  HomeApiExtractionResultSchema,
  AutoApiExtractionResultSchema,
  validatePartialHomeExtraction,
  validatePartialAutoExtraction,
  validatePartialLegacyExtraction,
} from './schemas'

// Type exports
export type { InsurancePromptType } from './prompts'
export type {
  ConfidenceLevel,
  ExtractionFieldType,
  ExtractionBooleanFieldType,
  ValidationResult,
  ValidationSuccess,
  ValidationFailure,
} from './schemas'
