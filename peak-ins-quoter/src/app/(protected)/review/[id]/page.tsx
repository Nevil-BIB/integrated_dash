import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReviewPageClient } from './review-page-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Calendar, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Extraction } from '@/types/extraction'

interface ReviewPageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('extractions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  // Type assertion since Supabase types may not be fully generated
  const extraction = data as unknown as Extraction

  const statusConfig = {
    pending: {
      className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      icon: Clock,
      label: 'Pending'
    },
    processing: {
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Loader2,
      label: 'Processing'
    },
    completed: {
      className: 'bg-green-50 text-green-700 border-green-200',
      icon: CheckCircle2,
      label: 'Completed'
    },
    failed: {
      className: 'bg-red-50 text-red-700 border-red-200',
      icon: XCircle,
      label: 'Failed'
    },
  }

  const status = statusConfig[extraction.status as keyof typeof statusConfig]
  const StatusIcon = status?.icon

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Left: Back button and file info */}
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back to dashboard</span>
                </Button>
              </Link>
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate font-semibold text-foreground">
                    {extraction.filename}
                  </h1>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>
                      {new Date(extraction.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Status */}
            <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant="outline"
                className={`${status.className} flex items-center gap-1.5 px-3 py-1`}
              >
                <StatusIcon className={`h-3.5 w-3.5 ${extraction.status === 'processing' ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{status.label}</span>
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 lg:px-8 py-8 lg:py-10">
        {extraction.extracted_data ? (
          <ReviewPageClient
            extractionId={extraction.id}
            extractedData={extraction.extracted_data}
            insuranceType={extraction.insurance_type || 'home'}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-background py-20 sm:py-24 text-center px-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              {extraction.status === 'processing' ? (
                <Loader2 className="h-7 w-7 text-muted-foreground animate-spin" />
              ) : (
                <FileText className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <p className="text-lg font-medium text-foreground">
              {extraction.status === 'processing'
                ? 'Extraction in progress...'
                : extraction.status === 'failed'
                ? 'Extraction failed'
                : 'No extracted data'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {extraction.status === 'processing'
                ? 'Please wait while we process your document. This may take a moment.'
                : extraction.status === 'failed'
                ? 'There was an error processing this document. Please try uploading again.'
                : 'No data is available for this extraction.'}
            </p>
            {extraction.status === 'failed' && (
              <Link href="/upload" className="mt-6">
                <Button variant="outline">Upload New Document</Button>
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
