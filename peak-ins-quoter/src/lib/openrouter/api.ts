/**
 * OpenRouter API client utilities
 *
 * Handles communication with the OpenRouter API for Claude Vision calls.
 */

import https from 'node:https'
import {
  validatePartialHomeExtraction,
  validatePartialAutoExtraction,
  validatePartialLegacyExtraction,
  logValidationErrors,
  type PartialHomeApiExtractionResultType,
  type PartialAutoApiExtractionResultType,
  type PartialLegacyExtractionResultType,
} from './schemas'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-sonnet-4'
const OPENROUTER_REQUEST_TIMEOUT_MS = Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS ?? 180000)
const OPENROUTER_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES ?? 2)
const OPENROUTER_RETRY_DELAY_MS = Number(process.env.OPENROUTER_RETRY_DELAY_MS ?? 1500)
const OPENROUTER_HTTPS_FALLBACK_ATTEMPTS = Number(process.env.OPENROUTER_HTTPS_FALLBACK_ATTEMPTS ?? 1)

// =============================================================================
// Types
// =============================================================================

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: { url: string }
  }>
}

export interface OpenRouterResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

type OpenRouterFetchInit = RequestInit

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clean and validate base64 string
 * Removes any whitespace, newlines, or data URI prefix
 */
export function cleanBase64(base64: string): string {
  // Remove data URI prefix if present
  let cleaned = base64.replace(/^data:image\/[a-z]+;base64,/i, '')
  // Remove any whitespace or newlines
  cleaned = cleaned.replace(/[\s\n\r]/g, '')
  return cleaned
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientOpenRouterError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const normalized = msg.toLowerCase()
  return (
    normalized.includes('und_err_connect_timeout') ||
    normalized.includes('connect timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('econnreset') ||
    normalized.includes('fetch failed') ||
    normalized.includes('socket hang up')
  )
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([k, v]) => [k, String(v)]))
  }
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, String(v)])
  )
}

async function postJsonViaHttps(
  url: string,
  init: OpenRouterFetchInit,
  timeoutMs: number,
): Promise<Response> {
  const target = new URL(url)
  const headers = headersToRecord(init.headers)
  const body = typeof init.body === 'string' ? init.body : String(init.body ?? '')

  return await new Promise<Response>((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: init.method ?? 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          const response = new Response(text, {
            status: res.statusCode ?? 500,
            statusText: res.statusMessage ?? '',
            headers: Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v ?? '')])
            ),
          })
          resolve(response)
        })
      }
    )

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTPS request timeout after ${timeoutMs}ms`))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function fetchOpenRouterWithRetry(
  url: string,
  init: OpenRouterFetchInit,
): Promise<Response> {
  let lastError: unknown = null
  const attempts = Math.max(1, OPENROUTER_MAX_RETRIES + 1)

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(OPENROUTER_REQUEST_TIMEOUT_MS),
      } as OpenRouterFetchInit)
    } catch (error) {
      lastError = error
      const retryable = isTransientOpenRouterError(error)
      const finalAttempt = attempt >= attempts
      console.error(`[OpenRouter] Network error attempt ${attempt}/${attempts}:`, error)
      if (!retryable || finalAttempt) break
      await sleep(OPENROUTER_RETRY_DELAY_MS * attempt)
    }
  }

  const shouldFallback = isTransientOpenRouterError(lastError)
  if (shouldFallback) {
    const fallbackAttempts = Math.max(1, OPENROUTER_HTTPS_FALLBACK_ATTEMPTS)
    for (let attempt = 1; attempt <= fallbackAttempts; attempt++) {
      try {
        console.warn(`[OpenRouter] Falling back to node:https transport (${attempt}/${fallbackAttempts})`)
        return await postJsonViaHttps(url, init, OPENROUTER_REQUEST_TIMEOUT_MS)
      } catch (error) {
        lastError = error
        const finalAttempt = attempt >= fallbackAttempts
        console.error(`[OpenRouter] HTTPS fallback failed (${attempt}/${fallbackAttempts}):`, error)
        if (!finalAttempt) {
          await sleep(OPENROUTER_RETRY_DELAY_MS * attempt)
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OpenRouter request failed')
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Call Claude Vision via OpenRouter API
 */
export async function callClaudeVision(
  base64Images: string[],
  prompt: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY

  console.log('[OpenRouter] callClaudeVision called with', base64Images.length, 'images')
  console.log('[OpenRouter] API Key present:', !!apiKey)
  console.log('[OpenRouter] API Key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A')

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  if (!apiKey.startsWith('sk-or-')) {
    console.warn('[OpenRouter] API key does not start with expected prefix "sk-or-"')
  }

  // Build content array with cleaned base64 images
  // Images from PDF converter are PNG format
  const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt },
    ...base64Images.map((img, idx) => {
      const cleanedBase64 = cleanBase64(img)
      console.log(`[OpenRouter] Image ${idx + 1}: ${cleanedBase64.length} chars, starts with: ${cleanedBase64.substring(0, 20)}...`)
      return {
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${cleanedBase64}` }
      }
    })
  ]

  const requestBody = {
    model: MODEL,
    messages: [{ role: 'user', content: messageContent }],
    max_tokens: 8192,
    temperature: 0.1, // Low temperature for consistent extraction
  }

  console.log('[OpenRouter] Sending request to:', OPENROUTER_API_URL)
  console.log('[OpenRouter] Model:', MODEL)
  console.log('[OpenRouter] Number of content items:', messageContent.length)
  console.log('[OpenRouter] Request body size:', JSON.stringify(requestBody).length)

  const response = await fetchOpenRouterWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Fact Finder Extraction',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  console.log('[OpenRouter] Response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error response')
    console.error('[OpenRouter] API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    })
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
  }

  const data: OpenRouterResponse = await response.json()
  const responseContent = data.choices[0]?.message?.content || ''

  console.log('[OpenRouter] Response received:', {
    hasContent: !!responseContent,
    contentLength: responseContent.length,
    contentPreview: responseContent.substring(0, 200),
    usage: data.usage,
  })

  return responseContent
}

// =============================================================================
// Response Parsing with Runtime Validation
// =============================================================================

/**
 * Extract JSON from a potentially decorated response
 */
function extractJson(content: string): string {
  // Clean up the content - remove any leading/trailing whitespace
  let cleanedContent = content.trim()

  // If response is wrapped in markdown code block, extract it
  const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    cleanedContent = codeBlockMatch[1].trim()
    console.log('[OpenRouter] Extracted from code block')
  }

  // Find the JSON object - look for the outermost { }
  const firstBrace = cleanedContent.indexOf('{')
  const lastBrace = cleanedContent.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.error('[OpenRouter] No valid JSON structure found:', cleanedContent.substring(0, 500))
    throw new Error('Invalid response format from AI - no JSON object found')
  }

  return cleanedContent.substring(firstBrace, lastBrace + 1)
}

/**
 * Parse JSON with error location logging
 */
function parseJson(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr)
  } catch (parseError) {
    console.error('[OpenRouter] JSON parse error:', parseError)
    console.error('[OpenRouter] Problematic JSON (first 1000 chars):', jsonStr.substring(0, 1000))

    // Try to identify the location of the error
    if (parseError instanceof SyntaxError) {
      const errorMatch = parseError.message.match(/position (\d+)/)
      if (errorMatch) {
        const pos = parseInt(errorMatch[1], 10)
        console.error('[OpenRouter] Error near:', jsonStr.substring(Math.max(0, pos - 50), pos + 50))
      }
    }

    throw new Error(`Failed to parse extraction response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
  }
}

/**
 * Parse and validate Home extraction response with Zod schema
 */
export function parseHomeExtractionResponse(content: string): Partial<PartialHomeApiExtractionResultType> {
  console.log('[OpenRouter] Parsing Home response, length:', content.length)

  const jsonStr = extractJson(content)
  console.log('[OpenRouter] JSON string length:', jsonStr.length)
  console.log('[OpenRouter] JSON preview:', jsonStr.substring(0, 300))

  const parsed = parseJson(jsonStr)
  console.log('[OpenRouter] Successfully parsed JSON with keys:', Object.keys(parsed as object))

  // Validate with Zod schema
  const validation = validatePartialHomeExtraction(parsed)
  if (!validation.success) {
    console.warn('[OpenRouter] Schema validation failed, using raw parsed data')
    logValidationErrors(validation.issues)
    // Return raw parsed data - it may be usable even if not fully compliant
    return parsed as Partial<PartialHomeApiExtractionResultType>
  }

  console.log('[OpenRouter] Schema validation passed')
  return validation.data
}

/**
 * Parse and validate Auto extraction response with Zod schema
 */
export function parseAutoExtractionResponse(content: string): Partial<PartialAutoApiExtractionResultType> {
  console.log('[OpenRouter] Parsing Auto response, length:', content.length)

  const jsonStr = extractJson(content)
  console.log('[OpenRouter] JSON string length:', jsonStr.length)
  console.log('[OpenRouter] JSON preview:', jsonStr.substring(0, 300))

  const parsed = parseJson(jsonStr)
  console.log('[OpenRouter] Successfully parsed JSON with keys:', Object.keys(parsed as object))

  // Validate with Zod schema
  const validation = validatePartialAutoExtraction(parsed)
  if (!validation.success) {
    console.warn('[OpenRouter] Schema validation failed, using raw parsed data')
    logValidationErrors(validation.issues)
    // Return raw parsed data - it may be usable even if not fully compliant
    return parsed as Partial<PartialAutoApiExtractionResultType>
  }

  console.log('[OpenRouter] Schema validation passed')
  return validation.data
}

/**
 * Parse and validate legacy extraction response with Zod schema
 */
export function parseLegacyExtractionResponse(content: string): Partial<PartialLegacyExtractionResultType> {
  console.log('[OpenRouter] Parsing Legacy response, length:', content.length)

  const jsonStr = extractJson(content)
  console.log('[OpenRouter] JSON string length:', jsonStr.length)
  console.log('[OpenRouter] JSON preview:', jsonStr.substring(0, 300))

  const parsed = parseJson(jsonStr)
  console.log('[OpenRouter] Successfully parsed JSON with keys:', Object.keys(parsed as object))

  // Validate with Zod schema
  const validation = validatePartialLegacyExtraction(parsed)
  if (!validation.success) {
    console.warn('[OpenRouter] Schema validation failed, using raw parsed data')
    logValidationErrors(validation.issues)
    // Return raw parsed data - it may be usable even if not fully compliant
    return parsed as Partial<PartialLegacyExtractionResultType>
  }

  console.log('[OpenRouter] Schema validation passed')
  return validation.data
}

/**
 * Generic parse function (deprecated - use type-specific parsers)
 * @deprecated Use parseHomeExtractionResponse, parseAutoExtractionResponse, or parseLegacyExtractionResponse
 */
export function parseExtractionResponse<T>(content: string): Partial<T> {
  console.log('[OpenRouter] Parsing response (generic), length:', content.length)

  const jsonStr = extractJson(content)
  console.log('[OpenRouter] JSON string length:', jsonStr.length)
  console.log('[OpenRouter] JSON preview:', jsonStr.substring(0, 300))

  const parsed = parseJson(jsonStr)
  console.log('[OpenRouter] Successfully parsed JSON with keys:', Object.keys(parsed as object))

  // No runtime validation for generic parser - use type-specific parsers for validation
  return parsed as Partial<T>
}

// =============================================================================
// Legacy API Functions
// =============================================================================

export async function sendToOpenRouter(
  messages: OpenRouterMessage[],
  options?: {
    maxTokens?: number
    temperature?: number
  }
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetchOpenRouterWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Fact Finder Extraction',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
    )
  }

  return response.json()
}

export function createVisionMessage(
  prompt: string,
  base64Images: string[]
): OpenRouterMessage {
  const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt },
  ]

  for (const base64Image of base64Images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: base64Image.startsWith('data:')
          ? base64Image
          : `data:image/png;base64,${base64Image}`,
      },
    })
  }

  return {
    role: 'user',
    content,
  }
}
