/**
 * Quote Details Page
 * Shows quote status and carrier quote results after RPA execution
 */

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface QuotePageProps {
  params: Promise<{ id: string }>
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
    case 'processing':
      return (
        <Badge variant="default" className="gap-1 bg-blue-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      )
    case 'completed':
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function getQuoteTypeLabel(type: string) {
  switch (type) {
    case 'home':
      return 'Home Insurance'
    case 'auto':
      return 'Auto Insurance'
    case 'both':
      return 'Home + Auto Bundle'
    default:
      return type
  }
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch quote with extraction info
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      *,
      extractions (
        id,
        filename
      )
    `)
    .eq('id', id)
    .single()

  if (error || !quote) {
    notFound()
  }

  // Ensure user owns this quote
  if (quote.user_id !== user.id) {
    notFound()
  }

  const extraction = quote.extractions as { id: string; filename: string } | null
  const quoteData = quote.quote_data as Record<string, unknown>
  const carrierQuotes = (quote.carrier_quotes as Array<{
    carrier: string
    premium?: number
    status: string
    details?: Record<string, unknown>
  }>) || []

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {getQuoteTypeLabel(quote.quote_type)} Quote
            </h1>
            {extraction && (
              <p className="text-muted-foreground">
                From: {extraction.filename}
              </p>
            )}
          </div>
          {getStatusBadge(quote.status)}
        </div>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quote Status</CardTitle>
          <CardDescription>
            Submitted on {new Date(quote.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quote.status === 'pending' && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Quote Pending</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Your quote request has been submitted and is waiting to be processed.
                RPA automation will run shortly to fetch quotes from carriers.
              </p>
            </div>
          )}

          {quote.status === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin mb-4" />
              <h3 className="font-semibold mb-2">Getting Quotes...</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Our automation is currently fetching quotes from insurance carriers.
                This typically takes 2-5 minutes.
              </p>
              {quote.rpa_started_at && (
                <p className="text-xs text-muted-foreground mt-4">
                  Started: {new Date(quote.rpa_started_at).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}

          {quote.status === 'completed' && (
            <div>
              {carrierQuotes.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold">Carrier Quotes</h3>
                  <div className="grid gap-4">
                    {carrierQuotes.map((cq, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{cq.carrier}</p>
                          <p className="text-sm text-muted-foreground">
                            {cq.status === 'quoted' ? 'Quote received' : cq.status}
                          </p>
                        </div>
                        {cq.premium && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">
                              ${cq.premium.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">/year</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="font-semibold mb-2">Quote Complete</h3>
                  <p className="text-muted-foreground text-sm">
                    The quote process has completed. Carrier results will appear here.
                  </p>
                </div>
              )}
            </div>
          )}

          {quote.status === 'failed' && (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="font-semibold mb-2">Quote Failed</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                There was an error processing your quote request.
              </p>
              {quote.rpa_error && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                  {quote.rpa_error}
                </p>
              )}
              <Button className="mt-4" variant="outline">
                Retry Quote
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Submitted Information</CardTitle>
          <CardDescription>
            Data submitted for quote request
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
            {JSON.stringify(quoteData, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
