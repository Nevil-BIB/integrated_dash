'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ExtractionReview, QuoteType, ExtractionReviewHandle } from '@/components/extraction'
import { ExtractedDataType } from '@/types/database'
import { InsuranceType } from '@/types/extraction'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ReviewPageClientProps {
  extractionId: string
  extractedData: ExtractedDataType
  insuranceType: InsuranceType
}

/**
 * Map InsuranceType to QuoteType for URL building
 * InsuranceType can be 'home' | 'auto' | 'both' | 'life' | 'health' | 'generic'
 * QuoteType is 'home' | 'auto' | 'both'
 */
function insuranceTypeToQuoteType(insuranceType: InsuranceType): QuoteType {
  if (insuranceType === 'home' || insuranceType === 'auto' || insuranceType === 'both') {
    return insuranceType
  }
  // Default to 'home' for legacy types
  return 'home'
}

/**
 * Client component for the review page that handles quote type state
 * and provides navigation to the quote page with the selected type.
 *
 * The quote type is determined by the insurance_type selected during upload,
 * so no additional quote type selection is needed on the review page.
 */
export function ReviewPageClient({
  extractionId,
  extractedData,
  insuranceType,
}: ReviewPageClientProps) {
  const router = useRouter()
  const extractionReviewRef = useRef<ExtractionReviewHandle>(null)
  const [isNavigating, setIsNavigating] = useState(false)

  // Convert insurance type to quote type for the ExtractionReview component
  const quoteType = insuranceTypeToQuoteType(insuranceType)

  // Build the quote URL with the insurance type
  const quoteUrl = `/review/${extractionId}/quote?type=${quoteType}`

  /**
   * Handle navigation to quote page - ensures all data is saved first
   * This prevents the race condition where auto-save hasn't completed
   * before the user navigates away
   */
  const handleProceedToQuote = useCallback(async () => {
    setIsNavigating(true)
    try {
      // Force save any pending changes before navigation
      if (extractionReviewRef.current) {
        const saveSuccess = await extractionReviewRef.current.saveBeforeNavigation()
        if (!saveSuccess) {
          toast.error('Please complete required fields (including Location Detail) before proceeding.')
          setIsNavigating(false)
          return
        }
      }
      // Navigate after successful save
      router.push(quoteUrl)
    } catch (error) {
      console.error('Error during navigation:', error)
      toast.error('An error occurred. Please try again.')
      setIsNavigating(false)
    }
  }, [quoteUrl, router])

  return (
    <>
      <ErrorBoundary
        title="Error Loading Review"
        description="There was a problem loading the extraction review. Please try refreshing the page."
        onError={(error) => {
          // Log error for monitoring in production
          if (process.env.NODE_ENV === 'development') {
            console.error('ExtractionReview error:', error)
          }
        }}
      >
        <ExtractionReview
          ref={extractionReviewRef}
          extractionId={extractionId}
          initialData={extractedData}
          quoteType={quoteType}
        />
      </ErrorBoundary>

      {/* Floating action button for proceeding to quote */}
      <div className="sticky bottom-6 mt-8 flex justify-end">
        <Button
          size="lg"
          className="shadow-lg gap-2"
          onClick={handleProceedToQuote}
          disabled={isNavigating}
        >
          {isNavigating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Proceed to Quote
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </>
  )
}
