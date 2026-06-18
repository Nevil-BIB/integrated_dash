/**
 * Quote Validation API Endpoint
 * POST /api/quotes/validate
 *
 * Validates home and/or auto quote data and returns detailed field-level validation results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateQuote } from '@/lib/validation/quote-validator';
import type {
  QuoteType,
  HomeQuoteData,
  AutoQuoteData,
  QuoteValidationRequest,
  QuoteValidationResponse,
} from '@/types/quote';

/**
 * Validates the request body structure
 */
function isValidRequest(body: unknown): body is QuoteValidationRequest {
  if (!body || typeof body !== 'object') return false;

  const req = body as Record<string, unknown>;

  // quoteType is required and must be valid
  if (!req.quoteType || !['home', 'auto', 'both'].includes(req.quoteType as string)) {
    return false;
  }

  return true;
}

/**
 * POST /api/quotes/validate
 *
 * Request body:
 * {
 *   quoteType: 'home' | 'auto' | 'both',
 *   homeData?: Partial<HomeQuoteData>,
 *   autoData?: Partial<AutoQuoteData>
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   validation: ValidationResult,
 *   errors?: string[]
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<QuoteValidationResponse>> {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          validation: {
            isValid: false,
            quoteType: 'home' as QuoteType,
            totalFields: 0,
            validFields: 0,
            invalidFields: 0,
            missingRequiredFields: [],
            fields: {},
          },
          errors: ['Unauthorized'],
        },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          validation: {
            isValid: false,
            quoteType: 'home' as QuoteType,
            totalFields: 0,
            validFields: 0,
            invalidFields: 0,
            missingRequiredFields: [],
            fields: {},
          },
          errors: ['Invalid JSON in request body'],
        },
        { status: 400 }
      );
    }

    // Validate request structure
    if (!isValidRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          validation: {
            isValid: false,
            quoteType: 'home' as QuoteType,
            totalFields: 0,
            validFields: 0,
            invalidFields: 0,
            missingRequiredFields: [],
            fields: {},
          },
          errors: ['Invalid request: quoteType must be "home", "auto", or "both"'],
        },
        { status: 400 }
      );
    }

    const { quoteType, homeData, autoData } = body;

    // Validate that appropriate data is provided for the quote type
    const errors: string[] = [];

    if ((quoteType === 'home' || quoteType === 'both') && !homeData) {
      errors.push('Home data is required for home or combined quotes');
    }

    if ((quoteType === 'auto' || quoteType === 'both') && !autoData) {
      errors.push('Auto data is required for auto or combined quotes');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          validation: {
            isValid: false,
            quoteType,
            totalFields: 0,
            validFields: 0,
            invalidFields: 0,
            missingRequiredFields: errors,
            fields: {},
          },
          errors,
        },
        { status: 400 }
      );
    }

    // Perform validation
    const validationResult = validateQuote(
      quoteType,
      homeData as Partial<HomeQuoteData> | undefined,
      autoData as Partial<AutoQuoteData> | undefined
    );

    // Return validation result
    return NextResponse.json({
      success: true,
      validation: validationResult,
    });
  } catch (error) {
    console.error('Quote validation error:', error);

    return NextResponse.json(
      {
        success: false,
        validation: {
          isValid: false,
          quoteType: 'home' as QuoteType,
          totalFields: 0,
          validFields: 0,
          invalidFields: 0,
          missingRequiredFields: [],
          fields: {},
        },
        errors: [
          error instanceof Error ? error.message : 'Internal server error',
        ],
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
