import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExtractedDataType } from '@/types/database'

/**
 * Maximum request body size for extraction updates (5MB)
 * This limits the size of extracted_data JSON payloads
 */
const MAX_BODY_SIZE = 5 * 1024 * 1024

/**
 * Validate UUID format (v4)
 * Returns true if the string is a valid UUID v4 format
 */
function isValidUUID(id: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidV4Regex.test(id)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Validate UUID format before database query
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid extraction ID format' }, { status: 400 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: extraction, error } = await supabase
      .from('extractions')
      .select('*')
      .eq('id', id)
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

/**
 * PATCH /api/extractions/[id]
 *
 * Optimized for auto-save functionality with debounced field changes.
 * - Validates request size to prevent oversized payloads
 * - Performs idempotent updates (same data = same result)
 * - Returns minimal response for efficiency
 * - Supports optimistic locking via If-Match header (optional)
 *
 * Request body:
 * - extracted_data: ExtractedDataType (required) - full or partial extraction data
 *
 * Response (success):
 * {
 *   "success": true,
 *   "updated_at": "2026-01-13T12:00:00Z"
 * }
 *
 * Response (conflict - optimistic locking):
 * {
 *   "success": false,
 *   "error": "Resource has been modified",
 *   "current_updated_at": "2026-01-13T12:00:00Z"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate Content-Type header
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { success: false, error: 'Content-Type must be application/json' },
        { status: 415 }
      )
    }

    // Validate request body size via Content-Length header
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Request body too large' },
        { status: 413 }
      )
    }

    const supabase = await createClient()
    const { id } = await params

    // Validate UUID format before database query
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid extraction ID format' },
        { status: 400 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse JSON with error handling
    let body: { extracted_data?: ExtractedDataType }
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('PATCH extraction JSON parse error:', parseError)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { extracted_data } = body

    // Validate extracted_data is present
    if (extracted_data === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing extracted_data in request body' },
        { status: 400 }
      )
    }

    // Check for optimistic locking via If-Match header (ETag = updated_at timestamp)
    const ifMatchHeader = request.headers.get('if-match')
    if (ifMatchHeader) {
      // Fetch current updated_at to compare
      const { data: current, error: fetchError } = await supabase
        .from('extractions')
        .select('updated_at')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !current) {
        return NextResponse.json(
          { success: false, error: 'Extraction not found' },
          { status: 404 }
        )
      }

      // Compare ETag (stored as ISO timestamp)
      const currentEtag = `"${current.updated_at}"`
      if (ifMatchHeader !== currentEtag) {
        return NextResponse.json(
          {
            success: false,
            error: 'Resource has been modified',
            current_updated_at: current.updated_at,
          },
          { status: 409 }
        )
      }
    }

    // Perform the update
    // Note: updated_at is automatically set by database trigger
    // We only select updated_at for minimal response
    const { data: updated, error } = await supabase
      .from('extractions')
      .update({ extracted_data })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('updated_at')
      .single()

    if (error) {
      // Check if it's a not found error (no rows matched)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Extraction not found' },
          { status: 404 }
        )
      }
      console.error('Update extraction error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update extraction' },
        { status: 500 }
      )
    }

    // Return minimal response optimized for auto-save
    return NextResponse.json({
      success: true,
      updated_at: updated.updated_at,
    })
  } catch (error) {
    console.error('Update extraction error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Validate UUID format before database query
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid extraction ID format' }, { status: 400 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get extraction to find storage path
    const { data: extraction } = await supabase
      .from('extractions')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (extraction?.storage_path) {
      // Delete file from storage
      await supabase.storage.from('fact-finders').remove([extraction.storage_path])
    }

    // Delete extraction record
    const { error } = await supabase
      .from('extractions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete extraction' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete extraction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
