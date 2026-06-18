import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuotePreviewClient } from './QuotePreviewClient'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Home, Car, Layers } from 'lucide-react'
import Link from 'next/link'
import type { Extraction, ExtractionResult, CombinedExtractionData } from '@/types/extraction'
import type { HomeExtractionResult } from '@/types/home-extraction'
import type { AutoExtractionResult } from '@/types/auto-extraction'
import type { CombinedUiExtractionData } from '@/types/database'
import type { QuoteType } from '@/types/quote'
import {
  getHomeExtractionData,
  getAutoExtractionData,
  detectExtractionType,
  isCombinedUiExtractionData,
} from '@/lib/extraction/transform'
import {
  readWorkflowMeta,
  supportsCarrierSchemaExtraction,
} from '@/lib/carriers'

// Force dynamic rendering to ensure fresh data after auto-save
export const dynamic = 'force-dynamic'

interface QuotePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string }>
}

// Union type for all possible extraction data formats
type ExtractedData = HomeExtractionResult | AutoExtractionResult | ExtractionResult | CombinedExtractionData | CombinedUiExtractionData

/**
 * Maps quote type to display configuration with dark mode support
 */
const quoteTypeConfig: Record<QuoteType, {
  label: string
  shortLabel: string
  icon: typeof Home
  bgClass: string
  textClass: string
}> = {
  home: {
    label: 'Home Insurance Quote',
    shortLabel: 'Home',
    icon: Home,
    bgClass: 'bg-sky-100 dark:bg-sky-950/40',
    textClass: 'text-sky-800 dark:text-sky-300',
  },
  auto: {
    label: 'Auto Insurance Quote',
    shortLabel: 'Auto',
    icon: Car,
    bgClass: 'bg-emerald-100 dark:bg-emerald-950/40',
    textClass: 'text-emerald-800 dark:text-emerald-300',
  },
  both: {
    label: 'Home + Auto Bundle',
    shortLabel: 'Bundle',
    icon: Layers,
    bgClass: 'bg-violet-100 dark:bg-violet-950/40',
    textClass: 'text-violet-800 dark:text-violet-300',
  },
}

/**
 * Validates the quote type parameter
 */
function isValidQuoteType(type: string | undefined): type is QuoteType {
  return type === 'home' || type === 'auto' || type === 'both'
}

export default async function QuotePage({ params, searchParams }: QuotePageProps) {
  const { id } = await params
  const { type } = await searchParams
  const supabase = await createClient()

  // Validate quote type from URL param
  if (!isValidQuoteType(type)) {
    // Redirect back to review page if no valid quote type
    redirect(`/review/${id}`)
  }

  const quoteType: QuoteType = type

  const { data, error } = await supabase
    .from('extractions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const extraction = data as unknown as Extraction

  // Only allow quoting for completed extractions
  if (extraction.status !== 'completed' || !extraction.extracted_data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold mb-2">Extraction Not Ready</h1>
          <p className="text-muted-foreground mb-6">
            The extraction must be completed before you can generate a quote.
            Current status: <strong>{extraction.status}</strong>
          </p>
          <Link href={`/review/${id}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Review
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const rawExtractedData = extraction.extracted_data as ExtractedData
  const config = quoteTypeConfig[quoteType]
  const TypeIcon = config.icon

  // Transform API-format data to UI-format data based on quote type
  // The database stores API format (HomeApiExtractionResult/AutoApiExtractionResult)
  // but the preview/validation expects UI format (HomeExtractionResult/AutoExtractionResult)
  let transformedData: ExtractedData = rawExtractedData
  const detectedType = detectExtractionType(rawExtractedData)
  const workflowMeta = readWorkflowMeta(rawExtractedData)
  const isCarrierSchemaWorkflow =
    workflowMeta != null &&
    supportsCarrierSchemaExtraction(workflowMeta.carrierOptionId)
  console.log('[QuotePage] Detected extraction type:', detectedType, 'for quoteType:', quoteType)

  if (isCarrierSchemaWorkflow) {
    transformedData = rawExtractedData
    console.log(
      '[QuotePage] Carrier-schema workflow detected; preserving extracted data shape for carrier form'
    )
  } else if (quoteType === 'home') {
    const homeData = getHomeExtractionData(rawExtractedData)
    if (homeData) {
      transformedData = homeData
      console.log('[QuotePage] Transformed to HomeExtractionResult')
    }
  } else if (quoteType === 'auto') {
    const autoData = getAutoExtractionData(rawExtractedData)
    if (autoData) {
      transformedData = autoData
      console.log('[QuotePage] Transformed to AutoExtractionResult')
    }
  } else if (quoteType === 'both') {
    // For 'both' quote type, we need to transform both home and auto parts
    // Check if already in UI format (CombinedUiExtractionData)
    if (isCombinedUiExtractionData(rawExtractedData)) {
      // Already in UI format, use as-is
      transformedData = rawExtractedData
      console.log('[QuotePage] Data already in CombinedUiExtractionData format')
    } else {
      // Transform both home and auto from API format to UI format
      const homeData = getHomeExtractionData(rawExtractedData)
      const autoData = getAutoExtractionData(rawExtractedData)
      if (homeData && autoData) {
        transformedData = {
          quoteType: 'both',
          home: homeData,
          auto: autoData,
        } as CombinedUiExtractionData
        console.log('[QuotePage] Transformed to CombinedUiExtractionData')
      } else if (homeData) {
        // Only home data available
        transformedData = homeData
        console.log('[QuotePage] Only home data available for both type')
      } else if (autoData) {
        // Only auto data available
        transformedData = autoData
        console.log('[QuotePage] Only auto data available for both type')
      }
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background shrink-0">
        <div className="px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Link href={`/review/${id}`}>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back to review</span>
                </Button>
              </Link>
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-semibold text-foreground truncate">
                    Final Review
                  </h1>
                  <p className="text-xs text-muted-foreground truncate">
                    {extraction.filename}
                  </p>
                </div>
              </div>
            </div>
            {/* Quote type badge */}
            <Badge
              variant="secondary"
              className={`${config.bgClass} ${config.textClass} border-0 gap-1.5 shrink-0`}
            >
              <TypeIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{config.label}</span>
              <span className="sm:hidden">{config.shortLabel}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <QuotePreviewClient
          extractionId={extraction.id}
          extractedData={transformedData}
          quoteType={quoteType}
          storagePath={extraction.storage_path}
          supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        />
      </div>
    </div>
  )
}
