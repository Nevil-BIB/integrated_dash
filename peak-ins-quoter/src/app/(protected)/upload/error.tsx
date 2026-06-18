'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface UploadErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function UploadError({ error, reset }: UploadErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Upload page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header Section */}
      <div className="border-b bg-background">
        <div className="container max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Upload Document
            </h1>
          </div>
        </div>
      </div>

      {/* Error Content */}
      <div className="container max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">
              Upload Error
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              We encountered an error while loading the upload page. Please try again.
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
      </div>
    </div>
  )
}
