import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { convertPDFToImages } from '@/lib/pdf/converter'
import {
  extractHomeFromImages,
  extractAutoFromImages,
} from '@/lib/openrouter/client'
import {
  CARRIER_OPTIONS,
  extractCarrierFromImages,
  getCarrierOption,
  supportsCarrierSchemaExtraction,
  withWorkflowMeta,
  type CarrierExtractionResult,
  type CarrierOptionId,
} from '@/lib/carriers'
import type {
  InsuranceType,
  HomeApiExtractionResult,
  AutoApiExtractionResult,
  CombinedExtractionData,
} from '@/types'
import type { ExtractedDataType } from '@/types/database'
import type { ExtractionField } from '@/types/extraction'
import type { HomeExtractionResult } from '@/types/home-extraction'

export const runtime = 'nodejs'

/**
 * Supported insurance types for extraction
 */
type ExtractionInsuranceType = 'home' | 'auto' | 'both'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientDownloadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLowerCase()
  return (
    normalized.includes('econnreset') ||
    normalized.includes('terminated') ||
    normalized.includes('socket hang up') ||
    normalized.includes('fetch failed') ||
    normalized.includes('network')
  )
}

async function downloadPdfWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
  maxAttempts = 3,
): Promise<Blob> {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('fact-finders')
        .download(storagePath)

      if (downloadError || !fileData) {
        throw new Error(downloadError?.message || 'Unknown storage download error')
      }

      return fileData
    } catch (error) {
      lastError = error
      const retryable = isTransientDownloadError(error)
      const isFinalAttempt = attempt >= maxAttempts

      console.error(
        `[Extract API] PDF download attempt ${attempt}/${maxAttempts} failed:`,
        error,
      )

      if (!retryable || isFinalAttempt) {
        break
      }

      await sleep(600 * attempt)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to download file after retries')
}

export async function POST(request: NextRequest) {
  console.log('[Extract API] POST request received')

  try {
    // Validate Content-Type header
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      )
    }

    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('[Extract API] Unauthorized - no user or auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[Extract API] Authenticated user:', user.id)

    // Get extraction ID and insurance type from request with JSON parse error handling
    let body: unknown
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[Extract API] JSON parse error:', parseError)
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    console.log('[Extract API] Request body:', body)

    const {
      extractionId,
      insuranceType: bodyInsuranceType,
      carrierOptionId,
      carrierOptionIds: bodyCarrierOptionIds,
    } = body as {
      extractionId?: string
      insuranceType?: ExtractionInsuranceType
      carrierOptionId?: CarrierOptionId
      carrierOptionIds?: CarrierOptionId[]
    }

    const resolvedCarrierOptionIds =
      bodyCarrierOptionIds?.length
        ? bodyCarrierOptionIds
        : [
            carrierOptionId ??
              (CARRIER_OPTIONS.find((o) => o.insuranceType === bodyInsuranceType)?.id ??
                'chubb-home'),
          ]
    const resolvedCarrierOptionId = resolvedCarrierOptionIds[0]
    const carrierOption = getCarrierOption(resolvedCarrierOptionId)
    const insuranceType = (bodyInsuranceType ?? carrierOption.insuranceType) as ExtractionInsuranceType

    if (!extractionId) {
      console.log('[Extract API] Missing extraction ID')
      return NextResponse.json({ error: 'Extraction ID required' }, { status: 400 })
    }
    console.log(
      '[Extract API] Processing extraction:',
      extractionId,
      'carrier:',
      resolvedCarrierOptionId,
      'type:',
      insuranceType,
    )

    // Validate insurance type
    const validTypes: ExtractionInsuranceType[] = ['home', 'auto', 'both']
    if (!validTypes.includes(insuranceType)) {
      return NextResponse.json(
        { error: `Invalid insurance type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get extraction record and verify ownership
    const { data: extraction, error: fetchError } = await supabase
      .from('extractions')
      .select('*')
      .eq('id', extractionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !extraction) {
      return NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
    }

    // Update status to processing and set insurance type
    await supabase
      .from('extractions')
      .update({
        status: 'processing',
        insurance_type: insuranceType,
      })
      .eq('id', extractionId)

    try {
      // Download PDF from storage
      console.log('[Extract API] Downloading PDF from:', extraction.storage_path)
      const fileData = await downloadPdfWithRetry(supabase, extraction.storage_path, 3)
      console.log('[Extract API] PDF downloaded, size:', fileData.size)

      // Convert PDF to images
      const arrayBuffer = await fileData.arrayBuffer()
      console.log('[Extract API] Converting PDF to images...')
      const conversionResult = await convertPDFToImages(arrayBuffer)

      if (conversionResult.pages.length === 0) {
        console.error('[Extract API] No pages found in PDF')
        throw new Error('No pages found in PDF')
      }
      console.log('[Extract API] Converted', conversionResult.pages.length, 'pages')

      // Extract base64 images from conversion result
      const images = conversionResult.pages.map(page => page.base64Image)
      console.log('[Extract API] Image sizes:', images.map(img => img.length))

      // Extract data using Claude Vision based on insurance type
      let extractedData:
        | HomeApiExtractionResult
        | HomeExtractionResult
        | CarrierExtractionResult
        | AutoApiExtractionResult
        | CombinedExtractionData
      let dbInsuranceType: InsuranceType = insuranceType

      switch (insuranceType) {
        case 'home':
          if (
            resolvedCarrierOptionIds.every((id) => supportsCarrierSchemaExtraction(id))
          ) {
            console.log(
              `[Extract API] Starting CARRIER-SCHEMA extraction (${resolvedCarrierOptionIds.join(', ')}) for ${images.length} pages`,
            )
            const carrierFieldsByOption: Partial<
              Record<CarrierOptionId, Record<string, ExtractionField>>
            > = {}
            let baseCarrierData: Awaited<ReturnType<typeof extractCarrierFromImages>> | null =
              null

            for (const carrierId of resolvedCarrierOptionIds) {
              const carrierResult = await extractCarrierFromImages(images, carrierId)
              carrierFieldsByOption[carrierId] = carrierResult.carrierFields
              if (!baseCarrierData) {
                baseCarrierData = carrierResult
              }
            }

            if (!baseCarrierData) {
              throw new Error('Carrier schema extraction produced no data')
            }

            extractedData = {
              ...baseCarrierData,
              carrierFields:
                carrierFieldsByOption[resolvedCarrierOptionId] ??
                baseCarrierData.carrierFields,
              carrierFieldsByOption,
            }
          } else if (supportsCarrierSchemaExtraction(resolvedCarrierOptionId)) {
            console.log(
              `[Extract API] Starting CARRIER-SCHEMA extraction (${resolvedCarrierOptionId}) for ${images.length} pages`,
            )
            extractedData = await extractCarrierFromImages(images, resolvedCarrierOptionId)
          } else {
            console.log(`[Extract API] Starting HOME extraction for ${images.length} pages`)
            extractedData = await extractHomeFromImages(images)
          }
          break

        case 'auto':
          if (
            resolvedCarrierOptionIds.every((id) => supportsCarrierSchemaExtraction(id))
          ) {
            console.log(
              `[Extract API] Starting AUTO CARRIER-SCHEMA extraction (${resolvedCarrierOptionIds.join(', ')}) for ${images.length} pages`,
            )
            const carrierFieldsByOption: Partial<
              Record<CarrierOptionId, Record<string, ExtractionField>>
            > = {}
            let baseCarrierData: Awaited<ReturnType<typeof extractCarrierFromImages>> | null =
              null

            for (const carrierId of resolvedCarrierOptionIds) {
              const carrierResult = await extractCarrierFromImages(images, carrierId)
              carrierFieldsByOption[carrierId] = carrierResult.carrierFields
              if (!baseCarrierData) {
                baseCarrierData = carrierResult
              }
            }

            if (!baseCarrierData) {
              throw new Error('Carrier schema extraction produced no data')
            }

            extractedData = {
              ...baseCarrierData,
              carrierFields:
                carrierFieldsByOption[resolvedCarrierOptionId] ??
                baseCarrierData.carrierFields,
              carrierFieldsByOption,
            }
          } else if (supportsCarrierSchemaExtraction(resolvedCarrierOptionId)) {
            console.log(
              `[Extract API] Starting AUTO CARRIER-SCHEMA extraction (${resolvedCarrierOptionId}) for ${images.length} pages`,
            )
            extractedData = await extractCarrierFromImages(images, resolvedCarrierOptionId)
          } else {
            console.log(`[Extract API] Starting AUTO extraction for ${images.length} pages`)
            extractedData = await extractAutoFromImages(images)
          }
          break

        case 'both':
          console.log(`[Extract API] Starting COMBINED (Home + Auto) extraction for ${images.length} pages`)
          // For combined extraction, run both extractions and merge shared fields
          const [homeResult, autoResult] = await Promise.all([
            extractHomeFromImages(images),
            extractAutoFromImages(images),
          ])

          // Create combined result with shared personal info
          // Use home personal info as the source of truth for shared fields,
          // but include auto-specific personal fields from the auto extraction
          extractedData = {
            shared: {
              ownerFirstName: homeResult.personal.firstName,
              ownerLastName: homeResult.personal.lastName,
              ownerDOB: homeResult.personal.dateOfBirth,
              spouseFirstName: homeResult.personal.spouseFirstName,
              spouseLastName: homeResult.personal.spouseLastName,
              spouseDOB: homeResult.personal.spouseDateOfBirth,
              streetAddress: homeResult.personal.streetAddress,
              city: homeResult.personal.city,
              state: homeResult.personal.state,
              zipCode: homeResult.personal.zipCode,
              priorStreetAddress: homeResult.personal.priorStreetAddress,
              priorCity: homeResult.personal.priorCity,
              priorState: homeResult.personal.priorState,
              priorZipCode: homeResult.personal.priorZipCode,
              yearsAtCurrentAddress: homeResult.personal.yearsAtCurrentAddress,
              phone: homeResult.personal.phone,
              email: homeResult.personal.email,
            },
            // Auto-specific personal fields stored separately at top level
            autoPersonal: {
              effectiveDate: autoResult.personal.effectiveDate,
              maritalStatus: autoResult.personal.maritalStatus,
              garagingAddressSameAsMailing: autoResult.personal.garagingAddressSameAsMailing,
              garagingStreetAddress: autoResult.personal.garagingStreetAddress,
              garagingCity: autoResult.personal.garagingCity,
              garagingState: autoResult.personal.garagingState,
              garagingZipCode: autoResult.personal.garagingZipCode,
              ownerDriversLicense: autoResult.personal.ownerDriversLicense,
              ownerLicenseState: autoResult.personal.ownerLicenseState,
              spouseDriversLicense: autoResult.personal.spouseDriversLicense,
              spouseLicenseState: autoResult.personal.spouseLicenseState,
              ownerOccupation: autoResult.personal.ownerOccupation,
              spouseOccupation: autoResult.personal.spouseOccupation,
              ownerEducation: autoResult.personal.ownerEducation,
              spouseEducation: autoResult.personal.spouseEducation,
              rideShare: autoResult.personal.rideShare,
              delivery: autoResult.personal.delivery,
            },
            home: {
              property: homeResult.property,
              householdMember: homeResult.householdMember,
              locationDetail: homeResult.locationDetail,
              locationInformation: homeResult.locationInformation,
              policyQuestions: homeResult.policyQuestions,
              locationSpecificQuestions: homeResult.locationSpecificQuestions,
              safety: homeResult.safety,
              coverage: homeResult.coverage,
              claims: homeResult.claims,
              lienholder: homeResult.lienholder,
              updates: homeResult.updates,
            },
            auto: {
              additionalDrivers: autoResult.additionalDrivers,
              vehicles: autoResult.vehicles,
              coverage: autoResult.coverage,
              lienholders: autoResult.lienholders,
              priorInsurance: autoResult.priorInsurance,
              accidentsOrTickets: autoResult.accidentsOrTickets,
            },
            quoteType: 'both',
          } satisfies CombinedExtractionData
          break

        default:
          // Fallback to legacy extraction (should not reach here due to validation)
          console.log(`[Extract API] Falling back to generic extraction`)
          extractedData = await extractHomeFromImages(images)
          dbInsuranceType = 'generic'
      }

      const extractedDataWithWorkflow = withWorkflowMeta(
        extractedData as unknown as Record<string, unknown>,
        resolvedCarrierOptionId,
        resolvedCarrierOptionIds,
      )

      // Update extraction record with results
      const { error: updateError } = await supabase
        .from('extractions')
        .update({
          extracted_data: extractedDataWithWorkflow as unknown as ExtractedDataType,
          insurance_type: dbInsuranceType,
          status: 'completed',
        })
        .eq('id', extractionId)

      if (updateError) {
        throw new Error('Failed to save extraction results')
      }

      return NextResponse.json({
        success: true,
        extractionId,
        insuranceType: dbInsuranceType,
        data: extractedDataWithWorkflow,
        carrierOptionId: resolvedCarrierOptionId,
      })
    } catch (extractError) {
      // Update status to failed with proper error handling
      const { error: statusUpdateError } = await supabase
        .from('extractions')
        .update({ status: 'failed' })
        .eq('id', extractionId)

      if (statusUpdateError) {
        console.error('[Extract API] Failed to update extraction status to failed:', statusUpdateError)
      }

      // Log full error details server-side only (never expose to client)
      console.error('[Extract API] Extraction processing error:', extractError)
      if (extractError instanceof Error) {
        console.error('[Extract API] Error stack:', extractError.stack)
      }

      // Return generic error message to client - do not expose stack traces or internal details
      return NextResponse.json({
        error: 'Extraction processing failed',
      }, { status: 500 })
    }
  } catch (error) {
    // Log full error details server-side only
    console.error('[Extract API] Outer error:', error)
    if (error instanceof Error) {
      console.error('[Extract API] Outer error stack:', error.stack)
    }

    // Return generic error message to client
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 })
  }
}

// GET endpoint to check extraction status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const extractionId = searchParams.get('id')

    if (!extractionId) {
      return NextResponse.json({ error: 'Extraction ID required' }, { status: 400 })
    }

    const { data: extraction, error } = await supabase
      .from('extractions')
      .select('*')
      .eq('id', extractionId)
      .eq('user_id', user.id)
      .single()

    if (error || !extraction) {
      return NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
    }

    return NextResponse.json({ extraction })
  } catch (error) {
    console.error('Get extraction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
