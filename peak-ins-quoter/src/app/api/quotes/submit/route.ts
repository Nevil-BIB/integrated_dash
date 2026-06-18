/**
 * Quote Submission API
 * POST /api/quotes/submit
 *
 * Submits validated quote data for processing.
 * Creates a quote record in the database and prepares data for RPA execution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { QuoteType, UIFieldValidation } from '@/types/quote'
import type { WebhookPayload } from '@/types/webhook'
import { transformToWebhookPayload, sendToWebhook } from '@/lib/webhook'

interface QuoteSubmitRequest {
  extractionId: string
  quoteType: QuoteType
  fields: UIFieldValidation[]
}

interface QuoteSubmitResponse {
  success: boolean
  quoteId: string
  message?: string
  errors?: string[]
  webhookPayload?: WebhookPayload  // Included for debugging/verification
}

// Transform UI fields to structured quote data for storage
function transformFieldsToQuoteData(
  fields: UIFieldValidation[],
  quoteType: QuoteType
): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  for (const field of fields) {
    if (field.value !== null && field.value !== '') {
      // Parse the key to get category and field name
      // Keys are in format: "personal.firstName" or "home.yearBuilt"
      const parts = field.key.split('.')
      if (parts.length === 2) {
        const [category, fieldName] = parts
        if (!data[category]) {
          data[category] = {}
        }
        (data[category] as Record<string, unknown>)[fieldName] = field.value
      } else {
        // Flat field
        data[field.key] = field.value
      }
    }
  }

  return {
    quoteType,
    data,
    submittedAt: new Date().toISOString(),
  }
}

// Validate that all required fields are present
function validateRequiredFields(fields: UIFieldValidation[]): string[] {
  const errors: string[] = []

  for (const field of fields) {
    if (field.required && (field.value === null || field.value === '')) {
      errors.push(`Missing required field: ${field.label}`)
    }
    if (field.status === 'invalid') {
      errors.push(`Invalid value for: ${field.label}`)
    }
  }

  return errors
}

export async function POST(request: NextRequest) {
  try {
    // Validate Content-Type header
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { success: false, errors: ['Content-Type must be application/json'] },
        { status: 415 }
      )
    }

    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, errors: ['Unauthorized'] },
        { status: 401 }
      )
    }

    // Parse request body with error handling
    let body: QuoteSubmitRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Quote submit JSON parse error:', parseError)
      return NextResponse.json(
        { success: false, errors: ['Invalid JSON in request body'] },
        { status: 400 }
      )
    }
    const { extractionId, quoteType, fields } = body

    // Validate request
    if (!extractionId) {
      return NextResponse.json(
        { success: false, errors: ['extractionId is required'] },
        { status: 400 }
      )
    }

    if (!quoteType || !['home', 'auto', 'both'].includes(quoteType)) {
      return NextResponse.json(
        { success: false, errors: ['Invalid quoteType. Must be "home", "auto", or "both"'] },
        { status: 400 }
      )
    }

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { success: false, errors: ['fields array is required'] },
        { status: 400 }
      )
    }

    // Validate required fields are present
    const validationErrors = validateRequiredFields(fields)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, errors: validationErrors },
        { status: 400 }
      )
    }

    // Verify extraction exists and belongs to user
    const { data: extraction, error: extractionError } = await supabase
      .from('extractions')
      .select('id, user_id, filename')
      .eq('id', extractionId)
      .single()

    if (extractionError || !extraction) {
      return NextResponse.json(
        { success: false, errors: ['Extraction not found'] },
        { status: 404 }
      )
    }

    if (extraction.user_id !== user.id) {
      return NextResponse.json(
        { success: false, errors: ['Unauthorized access to extraction'] },
        { status: 403 }
      )
    }

    // Transform fields to structured quote data
    const quoteData = transformFieldsToQuoteData(fields, quoteType)

    // Create quote record in database
    const { data: quote, error: insertError } = await supabase
      .from('quotes')
      .insert({
        user_id: user.id,
        extraction_id: extractionId,
        quote_type: quoteType,
        quote_data: quoteData,
        status: 'pending', // pending -> processing -> completed | failed
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to create quote:', insertError)

      // Check if quotes table exists
      if (insertError.code === '42P01') {
        // Table doesn't exist - return helpful error
        return NextResponse.json(
          {
            success: false,
            errors: ['Quotes table not found. Please run migrations.']
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { success: false, errors: ['Failed to create quote record'] },
        { status: 500 }
      )
    }

    // Update extraction status
    await supabase
      .from('extractions')
      .update({
        status: 'quoted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', extractionId)

    console.log(`[Quote Submit] Created quote ${quote.id} for extraction ${extractionId}`)

    // Transform to webhook payload format
    const webhookPayload = transformToWebhookPayload(
      quote.id,
      extractionId,
      user.id,
      extraction.filename,
      quoteData
    )

    // Send to webhook (currently just logs since no webhook URL configured)
    // TODO: Add WEBHOOK_URL environment variable when ready
    const webhookUrl = process.env.WEBHOOK_URL
    const webhookResult = await sendToWebhook(webhookPayload, webhookUrl)

    console.log(`[Quote Submit] Webhook payload prepared for quote ${quote.id}`)

    const response: QuoteSubmitResponse = {
      success: true,
      quoteId: quote.id,
      message: webhookUrl
        ? 'Quote submitted and sent to webhook'
        : 'Quote submitted successfully (webhook payload ready)',
      webhookPayload, // Include for debugging/verification
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Quote submission error:', error)
    return NextResponse.json(
      {
        success: false,
        errors: ['An unexpected error occurred during quote submission']
      },
      { status: 500 }
    )
  }
}

// Handle CORS preflight
// Note: In production, restrict origins to your actual domain(s)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')

  // Define allowed origins - add your production domain(s) here
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[]

  // Check if the request origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.includes(origin)

  return new NextResponse(null, {
    status: 200,
    headers: {
      // Only reflect the origin if it's in our allowed list, otherwise use the first allowed origin
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0] || '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    },
  })
}
