'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'

interface ReviewErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ReviewError({ error, reset }: ReviewErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Review page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to dashboard</span>
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-semibold text-foreground">
                Review Extraction
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Error Content */}
      <main className="mx-auto max-w-5xl px-6 lg:px-8 py-8 lg:py-10">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">
              Failed to Load Extraction
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              We encountered an error while loading this extraction. The document may have been deleted or there may be a temporary issue.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mb-6 font-mono">
                Error ID: {error.digest}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={reset} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
