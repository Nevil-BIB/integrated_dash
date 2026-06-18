import {
  ExtractionResult,
  ExtractionStatus,
  InsuranceType,
  HomeApiExtractionResult,
  AutoApiExtractionResult,
  CombinedExtractionData,
} from './extraction'
import { HomeExtractionResult } from './home-extraction'
import { AutoExtractionResult } from './auto-extraction'
import { QuoteType } from './quote'

export type QuoteStatus = 'pending' | 'processing' | 'completed' | 'failed'

// =============================================================================
// Discriminated Union for Extracted Data Types
// =============================================================================

/**
 * Discriminant field type for distinguishing extracted data variants
 */
export type ExtractedDataKind =
  | 'home_api'
  | 'auto_api'
  | 'combined_api'
  | 'home_ui'
  | 'auto_ui'
  | 'combined_ui'
  | 'legacy'

/**
 * Wrapper for Home API extraction data with discriminant
 */
export interface HomeApiExtractedData {
  kind: 'home_api'
  data: HomeApiExtractionResult
}

/**
 * Wrapper for Auto API extraction data with discriminant
 */
export interface AutoApiExtractedData {
  kind: 'auto_api'
  data: AutoApiExtractionResult
}

/**
 * Wrapper for Combined API extraction data with discriminant
 */
export interface CombinedApiExtractedData {
  kind: 'combined_api'
  data: CombinedExtractionData
}

/**
 * Wrapper for Home UI extraction data with discriminant
 */
export interface HomeUiExtractedData {
  kind: 'home_ui'
  data: HomeExtractionResult
}

/**
 * Wrapper for Auto UI extraction data with discriminant
 */
export interface AutoUiExtractedData {
  kind: 'auto_ui'
  data: AutoExtractionResult
}

/**
 * Combined UI extraction data structure for storing both Home and Auto forms
 */
export interface CombinedUiExtractionData {
  quoteType: 'both'
  home: HomeExtractionResult
  auto: AutoExtractionResult
}

/**
 * Wrapper for Combined UI extraction data with discriminant
 */
export interface CombinedUiExtractedData {
  kind: 'combined_ui'
  data: CombinedUiExtractionData
}

/**
 * Wrapper for legacy extraction data with discriminant
 */
export interface LegacyExtractedData {
  kind: 'legacy'
  data: ExtractionResult
}

/**
 * Discriminated union type for all possible extracted_data formats
 * Uses the 'kind' discriminant field for type-safe narrowing
 *
 * @example
 * function processData(data: DiscriminatedExtractedData) {
 *   switch (data.kind) {
 *     case 'home_api':
 *       // data.data is HomeApiExtractionResult
 *       console.log(data.data.personal.firstName);
 *       break;
 *     case 'auto_api':
 *       // data.data is AutoApiExtractionResult
 *       console.log(data.data.vehicles[0]?.vin);
 *       break;
 *     // ... other cases
 *   }
 * }
 */
export type DiscriminatedExtractedData =
  | HomeApiExtractedData
  | AutoApiExtractedData
  | CombinedApiExtractedData
  | HomeUiExtractedData
  | AutoUiExtractedData
  | CombinedUiExtractedData
  | LegacyExtractedData

/**
 * Union type for all possible extracted_data formats
 * Includes both API types (from extraction) and UI form types
 *
 * @deprecated Prefer DiscriminatedExtractedData for type-safe narrowing
 */
export type ExtractedDataType =
  | HomeApiExtractionResult
  | AutoApiExtractionResult
  | CombinedExtractionData
  | HomeExtractionResult
  | AutoExtractionResult
  | CombinedUiExtractionData
  | ExtractionResult
  | null

// =============================================================================
// Type Guards for Extracted Data
// =============================================================================

/**
 * Type guard to check if extracted data is Home API format
 */
export function isHomeApiExtractionResult(data: ExtractedDataType): data is HomeApiExtractionResult {
  if (!data || typeof data !== 'object') return false
  return 'personal' in data && 'property' in data && 'safety' in data && 'updates' in data
}

/**
 * Type guard to check if extracted data is Auto API format
 */
export function isAutoApiExtractionResult(data: ExtractedDataType): data is AutoApiExtractionResult {
  if (!data || typeof data !== 'object') return false
  return 'personal' in data && 'vehicles' in data && 'additionalDrivers' in data
}

/**
 * Type guard to check if extracted data is Combined API format
 * CombinedExtractionData has 'shared' property (API format)
 * CombinedUiExtractionData does NOT have 'shared' property (UI format)
 */
export function isCombinedExtractionData(data: ExtractedDataType): data is CombinedExtractionData {
  if (!data || typeof data !== 'object') return false
  // CombinedExtractionData always has 'shared' property - this distinguishes it from CombinedUiExtractionData
  return 'shared' in data && 'quoteType' in data
}

/**
 * Type guard to check if extracted data is Combined UI format
 * CombinedUiExtractionData does NOT have 'shared' property - this distinguishes it from CombinedExtractionData
 */
export function isCombinedUiExtractionData(data: ExtractedDataType): data is CombinedUiExtractionData {
  if (!data || typeof data !== 'object') return false
  const combined = data as CombinedUiExtractionData
  // Must have quoteType='both', 'home', 'auto', but NOT 'shared' (which would indicate API format)
  return 'quoteType' in data && combined.quoteType === 'both' && 'home' in data && 'auto' in data && !('shared' in data)
}

/**
 * Type guard to check if extracted data is Legacy format
 */
export function isLegacyExtractionResult(data: ExtractedDataType): data is ExtractionResult {
  if (!data || typeof data !== 'object') return false
  return 'personal' in data && 'employment' in data && 'beneficiary' in data
}

/**
 * Wrap extracted data with discriminant for type-safe handling
 */
export function wrapExtractedData(data: ExtractedDataType): DiscriminatedExtractedData | null {
  if (!data) return null

  if (isCombinedUiExtractionData(data)) {
    return { kind: 'combined_ui', data }
  }
  if (isCombinedExtractionData(data)) {
    return { kind: 'combined_api', data }
  }
  if (isAutoApiExtractionResult(data)) {
    return { kind: 'auto_api', data }
  }
  if (isHomeApiExtractionResult(data)) {
    return { kind: 'home_api', data }
  }
  if (isLegacyExtractionResult(data)) {
    return { kind: 'legacy', data }
  }

  // Could not determine type
  return null
}

export interface CarrierQuote {
  carrier: string
  premium?: number
  status: string
  details?: Record<string, unknown>
}

export interface Database {
  public: {
    Tables: {
      extractions: {
        Row: {
          id: string
          user_id: string
          filename: string
          storage_path: string
          insurance_type: InsuranceType
          extracted_data: ExtractedDataType
          status: ExtractionStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          storage_path: string
          insurance_type?: InsuranceType
          extracted_data?: ExtractedDataType
          status?: ExtractionStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          storage_path?: string
          insurance_type?: InsuranceType
          extracted_data?: ExtractedDataType
          status?: ExtractionStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          extraction_id: string
          quote_type: QuoteType
          quote_data: Record<string, unknown>
          status: QuoteStatus
          rpa_job_id: string | null
          rpa_started_at: string | null
          rpa_completed_at: string | null
          rpa_error: string | null
          carrier_quotes: CarrierQuote[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          extraction_id: string
          quote_type: QuoteType
          quote_data: Record<string, unknown>
          status?: QuoteStatus
          rpa_job_id?: string | null
          rpa_started_at?: string | null
          rpa_completed_at?: string | null
          rpa_error?: string | null
          carrier_quotes?: CarrierQuote[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          extraction_id?: string
          quote_type?: QuoteType
          quote_data?: Record<string, unknown>
          status?: QuoteStatus
          rpa_job_id?: string | null
          rpa_started_at?: string | null
          rpa_completed_at?: string | null
          rpa_error?: string | null
          carrier_quotes?: CarrierQuote[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quotes_extraction_id_fkey'
            columns: ['extraction_id']
            referencedRelation: 'extractions'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Use different names to avoid conflict with Extraction from extraction.ts
export type ExtractionRow = Database['public']['Tables']['extractions']['Row']
export type ExtractionInsert = Database['public']['Tables']['extractions']['Insert']
export type ExtractionUpdate = Database['public']['Tables']['extractions']['Update']

// Quote table types
export type QuoteRow = Database['public']['Tables']['quotes']['Row']
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert']
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update']

// =============================================================================
// API Response Types for Auto-Save
// =============================================================================

/**
 * Successful auto-save response from PATCH /api/extractions/[id]
 */
export interface AutoSaveSuccessResponse {
  success: true
  updated_at: string
}

/**
 * Conflict response when optimistic locking fails
 */
export interface AutoSaveConflictResponse {
  success: false
  error: 'Resource has been modified'
  current_updated_at: string
}

/**
 * Generic error response for auto-save
 */
export interface AutoSaveErrorResponse {
  success: false
  error: string
}

/**
 * Union type for all possible auto-save responses
 */
export type AutoSaveResponse =
  | AutoSaveSuccessResponse
  | AutoSaveConflictResponse
  | AutoSaveErrorResponse
