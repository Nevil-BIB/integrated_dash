'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'

interface QuoteErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function QuoteError({ error, reset }: QuoteErrorProps) {
  const params = useParams()
  const extractionId = params?.id as string | undefined

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Quote page error:', error)
  }, [error])

  return (
    <div className="flex flex-col h-full min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background shrink-0">
        <div className="px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href={extractionId ? `/review/${extractionId}` : '/dashboard'}>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Go back</span>
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-semibold text-foreground">
                Quote Preview
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Error Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5">
              <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold mb-2 text-foreground">
              Quote Generation Failed
            </h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">
              We encountered an error while preparing your quote. Please try again or return to the review page.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mb-5 font-mono">
                Error ID: {error.digest}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button onClick={reset} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Link href={extractionId ? `/review/${extractionId}` : '/dashboard'}>
                <Button variant="outline" className="gap-2 w-full">
                  <ArrowLeft className="h-4 w-4" />
                  {extractionId ? 'Back to Review' : 'Back to Dashboard'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
