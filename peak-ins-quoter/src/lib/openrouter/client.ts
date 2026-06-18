import {
  ExtractionResult,
  ExtractionField,
  ExtractionBooleanField,
  HomeApiExtractionResult,
  HomePersonalInfo,
  HomePropertyInfo,
  HomeSafetyInfo,
  HomeCoverageInfo,
  HomeClaimsHistory,
  HomeLienholderInfo,
  HomeUpdatesInfo,
  HomeApiHouseholdMemberInfo,
  HomeApiLocationDetailInfo,
  HomeApiLocationInformationInfo,
  HomeApiPolicyQuestionsInfo,
  HomeApiLocationSpecificQuestionsInfo,
  AutoApiExtractionResult,
  AutoPersonalInfo,
  AutoAdditionalDriver,
  AutoVehicle,
  AutoCoverageInfo,
  AutoVehicleLienholder,
  AutoPriorInsurance,
  AutoAccidentOrTicket,
} from '@/types/extraction'
import { EXTRACTION_PROMPT, HOME_EXTRACTION_PROMPT, AUTO_EXTRACTION_PROMPT, InsurancePromptType } from './prompts'
import {
  validatePartialHomeExtraction,
  validatePartialAutoExtraction,
  validatePartialLegacyExtraction,
  logValidationErrors,
} from './schemas'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-sonnet-4'
const MAX_PAGES_PER_BATCH = 5
const OPENROUTER_REQUEST_TIMEOUT_MS = Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS ?? 180000)
const OPENROUTER_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES ?? 2)
const OPENROUTER_RETRY_DELAY_MS = Number(process.env.OPENROUTER_RETRY_DELAY_MS ?? 1500)

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: { url: string }
  }>
}

interface OpenRouterResponse {
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

/**
 * Clean and validate base64 string
 * Removes any whitespace, newlines, or data URI prefix
 */
function cleanBase64(base64: string): string {
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

async function fetchOpenRouterWithRetry(url: string, init: OpenRouterFetchInit): Promise<Response> {
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

  throw lastError instanceof Error ? lastError : new Error('OpenRouter request failed')
}

/**
 * Call Claude Vision via OpenRouter API
 */
async function callClaudeVision(
  base64Images: string[],
  prompt: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY

  console.log('[OpenRouter] callClaudeVision called with', base64Images.length, 'images')
  // Only log boolean presence of API key - never log key contents or prefixes
  console.log('[OpenRouter] API Key present:', !!apiKey)

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  // Validate API key format without logging the actual key content
  if (!apiKey.startsWith('sk-or-')) {
    console.warn('[OpenRouter] API key format validation failed')
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
    body: JSON.stringify(requestBody)
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

/**
 * Extract JSON string from AI response content
 */
function extractJsonFromContent(content: string): string {
  console.log('[OpenRouter] Parsing response, length:', content.length)

  // Clean up the content - remove any leading/trailing whitespace
  let cleanedContent = content.trim()

  // If response is wrapped in markdown code block, extract it
  const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    cleanedContent = codeBlockMatch[1].trim()
    console.log('[OpenRouter] Extracted from code block')
  }

  // Find the JSON object - look for the outermost { }
  // This handles cases where there might be text before/after the JSON
  const firstBrace = cleanedContent.indexOf('{')
  const lastBrace = cleanedContent.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.error('[OpenRouter] No valid JSON structure found:', cleanedContent.substring(0, 500))
    throw new Error('Invalid response format from AI - no JSON object found')
  }

  return cleanedContent.substring(firstBrace, lastBrace + 1)
}

/**
 * Parse JSON string with error location logging
 */
function parseJsonString(jsonStr: string): unknown {
  console.log('[OpenRouter] JSON string length:', jsonStr.length)
  console.log('[OpenRouter] JSON preview:', jsonStr.substring(0, 300))

  try {
    const parsed = JSON.parse(jsonStr) as unknown
    console.log('[OpenRouter] Successfully parsed JSON with keys:', Object.keys(parsed as object))
    return parsed
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
function parseHomeExtractionResponse(content: string): Partial<HomeApiExtractionResult> {
  const jsonStr = extractJsonFromContent(content)
  const parsed = parseJsonString(jsonStr)

  // Validate with Zod schema
  const validation = validatePartialHomeExtraction(parsed)
  if (!validation.success) {
    console.warn('[OpenRouter] Home schema validation failed, using raw parsed data')
    logValidationErrors(validation.issues)
    // Return raw parsed data - it may be usable even if not fully compliant
    return parsed as Partial<HomeApiExtractionResult>
  }

  console.log('[OpenRouter] Home schema validation passed')
  return validation.data as Partial<HomeApiExtractionResult>
}

/**
 * Parse and validate Auto extraction response with Zod schema
 */
function parseAutoExtractionResponse(content: string): Partial<AutoApiExtractionResult> {
  const jsonStr = extractJsonFromContent(content)
  const parsed = parseJsonString(jsonStr)

  // Validate with Zod schema
  const validation = validatePartialAutoExtraction(parsed)
  if (!validation.success) {
    console.warn('[OpenRouter] Auto schema validation failed, using raw parsed data')
    logValidationErrors(validation.issues)
    // Return raw parsed data - it may be usable even if not fully compliant
    return parsed as Partial<AutoApiExtractionResult>
  }

  console.log('[OpenRouter] Auto schema validation passed')
  return validation.data as Partial<AutoApiExtractionResult>
}

/**
 * Parse and validate legacy extraction response with Zod schema
 */
function parseLegacyExtractionResponse(content: string): Partial<ExtractionResult> {
  const jsonStr = extractJsonFromContent(content)
  const parsed = parseJsonString(jsonStr)

  // Validate with Zod schema
  const validation = validatePartialLegacyExtraction(parsed)
  if (!validation.success) {
    console.warn('[OpenRouter] Legacy schema validation failed, using raw parsed data')
    logValidationErrors(validation.issues)
    // Return raw parsed data - it may be usable even if not fully compliant
    return parsed as Partial<ExtractionResult>
  }

  console.log('[OpenRouter] Legacy schema validation passed')
  return validation.data as Partial<ExtractionResult>
}

/**
 * Parse Claude's response into structured data (generic - no Zod validation)
 * @deprecated Use type-specific parsers (parseHomeExtractionResponse, parseAutoExtractionResponse)
 */
function parseExtractionResponse<T>(content: string): Partial<T> {
  const jsonStr = extractJsonFromContent(content)
  return parseJsonString(jsonStr) as Partial<T>
}

// ============================================================================
// Default Field Creators
// ============================================================================

/**
 * Create a default text extraction field
 */
function createDefaultField(value: string | null = null): ExtractionField {
  return {
    value,
    confidence: 'low',
    flagged: true,
    rawText: undefined,
  }
}

/**
 * Create a default boolean extraction field
 */
function createDefaultBooleanField(value: boolean | null = null): ExtractionBooleanField {
  return {
    value,
    confidence: 'low',
    flagged: true,
    rawText: undefined,
  }
}

// ============================================================================
// Home Insurance Default Result
// ============================================================================

/**
 * Create default HomePersonalInfo
 */
function createDefaultHomePersonalInfo(): HomePersonalInfo {
  return {
    firstName: createDefaultField(),
    lastName: createDefaultField(),
    dateOfBirth: createDefaultField(),
    ssn: createDefaultField(),
    spouseFirstName: createDefaultField(),
    spouseLastName: createDefaultField(),
    spouseDateOfBirth: createDefaultField(),
    spouseSsn: createDefaultField(),
    streetAddress: createDefaultField(),
    city: createDefaultField(),
    state: createDefaultField(),
    zipCode: createDefaultField(),
    priorStreetAddress: createDefaultField(),
    priorCity: createDefaultField(),
    priorState: createDefaultField(),
    priorZipCode: createDefaultField(),
    yearsAtCurrentAddress: createDefaultField(),
    phone: createDefaultField(),
    email: createDefaultField(),
  }
}

/**
 * Create default HomePropertyInfo
 */
function createDefaultHomePropertyInfo(): HomePropertyInfo {
  return {
    purchaseDate: createDefaultField(),
    yearBuilt: createDefaultField(),
    squareFootage: createDefaultField(),
    numberOfStories: createDefaultField(),
    numberOfKitchens: createDefaultField(),
    kitchenStyle: createDefaultField(),
    numberOfBathrooms: createDefaultField(),
    bathroomStyle: createDefaultField(),
    flooringPercentage: createDefaultField(),
    heatType: createDefaultField(),
    exteriorConstruction: createDefaultField(),
    exteriorFeatures: createDefaultField(),
    roofAge: createDefaultField(),
    roofConstruction: createDefaultField(),
    foundationType: createDefaultField(),
    hasFinishedBasement: createDefaultBooleanField(),
    garageType: createDefaultField(),
    numberOfCarGarage: createDefaultField(),
    numberOfFireplaces: createDefaultField(),
    fireplaceType: createDefaultField(),
    deckPatioDetails: createDefaultField(),
    isCondoOrTownhouse: createDefaultBooleanField(),
    specialFeatures: createDefaultField(),
  }
}

/**
 * Create default HomeSafetyInfo
 */
function createDefaultHomeSafetyInfo(): HomeSafetyInfo {
  return {
    hasAlarmSystem: createDefaultBooleanField(),
    isAlarmMonitored: createDefaultBooleanField(),
    hasPool: createDefaultBooleanField(),
    hasTrampoline: createDefaultBooleanField(),
    hasEnclosedYard: createDefaultBooleanField(),
    hasDog: createDefaultBooleanField(),
    dogBreed: createDefaultField(),
  }
}

/**
 * Create default HomeCoverageInfo
 */
function createDefaultHomeCoverageInfo(): HomeCoverageInfo {
  return {
    dwellingCoverage: createDefaultField(),
    liabilityCoverage: createDefaultField(),
    medicalPayments: createDefaultField(),
    deductible: createDefaultField(),
    personalPropertyCoverage: createDefaultField(),
    lossOfUseCoverage: createDefaultField(),
  }
}

/**
 * Create default HomeClaimsHistory
 */
function createDefaultHomeClaimsHistory(): HomeClaimsHistory {
  return {
    claimsInLast5Years: createDefaultField(),
    numberOfClaims: createDefaultField(),
    claimDetails: createDefaultField(),
  }
}

/**
 * Create default HomeLienholderInfo
 */
function createDefaultHomeLienholderInfo(): HomeLienholderInfo {
  return {
    lienholderName: createDefaultField(),
    lienholderAddress: createDefaultField(),
    loanNumber: createDefaultField(),
    currentInsuranceCompany: createDefaultField(),
    currentPolicyNumber: createDefaultField(),
    currentEffectiveDate: createDefaultField(),
    currentPremium: createDefaultField(),
    isEscrowed: createDefaultBooleanField(),
    hasBeenCancelledOrDeclined: createDefaultBooleanField(),
    cancelDeclineDetails: createDefaultField(),
    referredBy: createDefaultField(),
  }
}

/**
 * Create default HomeUpdatesInfo
 */
function createDefaultHomeUpdatesInfo(): HomeUpdatesInfo {
  return {
    hvacUpdateYear: createDefaultField(),
    plumbingUpdateYear: createDefaultField(),
    roofUpdateYear: createDefaultField(),
    electricalUpdateYear: createDefaultField(),
    hasCircuitBreakers: createDefaultBooleanField(),
  }
}

function createDefaultHomeHouseholdMemberInfo(): HomeApiHouseholdMemberInfo {
  return {
    firstName: createDefaultField(),
    lastName: createDefaultField(),
    suffix: createDefaultField(),
    dob: createDefaultField(),
    ssn: createDefaultField(),
    relationship: createDefaultField(),
    maritalStatus: createDefaultField(),
    dlState: createDefaultField(),
    dlNumber: createDefaultField(),
  }
}

function createDefaultHomeLocationDetailInfo(): HomeApiLocationDetailInfo {
  return {
    locationOccupancy: createDefaultField(),
    ownerOccupied: createDefaultField(),
    vacant: createDefaultField(),
    liabilityCoverageOnly: createDefaultField(),
    personalPropertyOnly: createDefaultField(),
  }
}

function createDefaultHomeLocationInformationInfo(): HomeApiLocationInformationInfo {
  return {
    program: createDefaultField(),
    type: createDefaultField(),
    coverageA: createDefaultField(),
    coverageF: createDefaultField(),
    personalInjury: createDefaultField(),
    coverageG: createDefaultField(),
    constructionYear: createDefaultField(),
    construction: createDefaultField(),
    foundation: createDefaultField(),
    finishedLivingArea: createDefaultField(),
    numberOfFamiliesUnits: createDefaultField(),
    replacementCost100: createDefaultField(),
    roofLossSettlementWindstormHail: createDefaultField(),
    roofingMaterial: createDefaultField(),
    roofUpdateYear: createDefaultField(),
    marketValue: createDefaultField(),
    hasMortgageeContractHolderOrSecuredLineOfCredit: createDefaultField(),
    boardingOrLodgingOrStudentRentals: createDefaultField(),
    isStudentRental: createDefaultField(),
    visibleFromOtherDwellings: createDefaultField(),
    fortifiedHome: createDefaultField(),
    woodCoalHeating: createDefaultField(),
    woodCoalHeatingLocation: createDefaultField(),
    woodCoalHeatingQuantity: createDefaultField(),
    gatedAccessToDwelling: createDefaultField(),
    applicantWillingToCompleteDiySurvey: createDefaultField(),
    screenedEnclosure: createDefaultField(),
    dwellingConstructedWithAsbestos: createDefaultField(),
    floodZone: createDefaultField(),
    coastalStormRiskArea: createDefaultField(),
    locatedOnIsland: createDefaultField(),
    conditionOfDwelling: createDefaultField(),
    dogsOwnedOrKept: createDefaultField(),
    specificBreed: createDefaultField(),
    biteHistoryAggressiveBehavior: createDefaultField(),
    isLocationWithinCity: createDefaultField(),
    respondingFireDepartment: createDefaultField(),
    communityName: createDefaultField(),
    within1000FeetOfHydrant: createDefaultField(),
    bridgeAccess: createDefaultField(),
    windHailDeductible: createDefaultField(),
    hurricaneDeductible: createDefaultField(),
    county: createDefaultField(),
    locationInformationOccupancy: createDefaultField(),
    territory: createDefaultField(),
    ownership: createDefaultField(),
    allOtherPerilsDeductible: createDefaultField(),
    distanceToHydrantFeet: createDefaultField(),
    distanceToFireStationMiles: createDefaultField(),
    protectionClass: createDefaultField(),
  }
}

function createDefaultHomePolicyQuestionsInfo(): HomeApiPolicyQuestionsInfo {
  return {
    pleaseExplain: createDefaultField(),
    hasAnyCompanyCanceledRefusedOrDeclinedRenewal: createDefaultField(),
    hasAutoOwnersInsurancePast5Years: createDefaultField(),
    options: createDefaultField(),
    previousPolicyNumber: createDefaultField(),
    hasFiledPersonalBankruptcyOrJudgementsPast5Years: createDefaultField(),
    bankruptcyPleaseExplain: createDefaultField(),
    hasAnyApplicantBeenConvictedOfArson: createDefaultField(),
  }
}

function createDefaultHomeLocationSpecificQuestionsInfo(): HomeApiLocationSpecificQuestionsInfo {
  return {
    dwellingForSale: createDefaultField(),
    isNewVentureNoPreviousLandlordOrRentalPropertyExperience: createDefaultField(),
    areThereAnyOutbuildingsOnPremises: createDefaultField(),
    anyFloodingBrushLandslideOrUnusualHazards: createDefaultField(),
    areDogsAllowed: createDefaultField(),
    anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets: createDefaultField(),
    anyUncorrectedFireCodeViolations: createDefaultField(),
    difficultAccessByFireAndPoliceDepartments: createDefaultField(),
    dwellingNewPurchase: createDefaultField(),
    purchasePrice: createDefaultField(),
    dwellingOccupied: createDefaultField(),
    pleaseExplain: createDefaultField(),
    expectedOccupancyDate: createDefaultField(),
    dayCareOnPremises: createDefaultField(),
    childrenCaredForCount: createDefaultField(),
    farmingOnPremises: createDefaultField(),
    acresFarmedByOthers: createDefaultField(),
    numberOfAnimalsLarge: createDefaultField(),
    numberOfAnimalsMedium: createDefaultField(),
    numberOfAnimalsSmall: createDefaultField(),
    otherBusinessOnPremises: createDefaultField(),
    describeBusiness: createDefaultField(),
    buildingUnderRenovationOrReconstruction: createDefaultField(),
    householdMembersLivingDuringRenovation: createDefaultField(),
    renovationExplanation: createDefaultField(),
    responsesVerifiedWithApplicant: createDefaultField(),
  }
}

/**
 * Create a complete default HomeApiExtractionResult
 */
export function createDefaultHomeApiExtractionResult(): HomeApiExtractionResult {
  return {
    personal: createDefaultHomePersonalInfo(),
    property: createDefaultHomePropertyInfo(),
    householdMember: createDefaultHomeHouseholdMemberInfo(),
    locationDetail: createDefaultHomeLocationDetailInfo(),
    locationInformation: createDefaultHomeLocationInformationInfo(),
    policyQuestions: createDefaultHomePolicyQuestionsInfo(),
    locationSpecificQuestions: createDefaultHomeLocationSpecificQuestionsInfo(),
    safety: createDefaultHomeSafetyInfo(),
    coverage: createDefaultHomeCoverageInfo(),
    claims: createDefaultHomeClaimsHistory(),
    lienholder: createDefaultHomeLienholderInfo(),
    updates: createDefaultHomeUpdatesInfo(),
  }
}

// ============================================================================
// Auto Insurance Default Result
// ============================================================================

/**
 * Create default AutoPersonalInfo
 *
 * CONDITIONAL LOGIC:
 * - spouseFirstName, spouseLastName, spouseDOB, spouseDriversLicense, spouseLicenseState,
 *   spouseOccupation, spouseEducation: Only shown/required if maritalStatus is 'Married' or 'Domestic Partner'
 * - priorStreetAddress, priorCity, priorState, priorZipCode: Required if yearsAtCurrentAddress < 5
 * - garagingStreetAddress, garagingCity, garagingState, garagingZipCode: Only shown if garagingAddressSameAsMailing is false (No)
 */
function createDefaultAutoPersonalInfo(): AutoPersonalInfo {
  return {
    // Policy effective date
    effectiveDate: createDefaultField(),
    // Owner info
    ownerFirstName: createDefaultField(),
    ownerLastName: createDefaultField(),
    ownerDOB: createDefaultField(),
    maritalStatus: createDefaultField(),
    // Spouse fields (conditional: only if maritalStatus is Married or Domestic Partner)
    spouseFirstName: createDefaultField(),
    spouseLastName: createDefaultField(),
    spouseDOB: createDefaultField(),
    // Mailing address
    streetAddress: createDefaultField(),
    city: createDefaultField(),
    state: createDefaultField(),
    zipCode: createDefaultField(),
    // Garaging address (conditional: only if garagingAddressSameAsMailing is No)
    garagingAddressSameAsMailing: createDefaultBooleanField(),
    garagingStreetAddress: createDefaultField(),
    garagingCity: createDefaultField(),
    garagingState: createDefaultField(),
    garagingZipCode: createDefaultField(),
    // Prior address (conditional: required if yearsAtCurrentAddress < 5)
    priorStreetAddress: createDefaultField(),
    priorCity: createDefaultField(),
    priorState: createDefaultField(),
    priorZipCode: createDefaultField(),
    yearsAtCurrentAddress: createDefaultField(),
    // Contact
    phone: createDefaultField(),
    email: createDefaultField(),
    // Auto-specific
    ownerDriversLicense: createDefaultField(),
    ownerLicenseState: createDefaultField(),
    spouseDriversLicense: createDefaultField(),
    spouseLicenseState: createDefaultField(),
    ownerOccupation: createDefaultField(),
    spouseOccupation: createDefaultField(),
    ownerEducation: createDefaultField(),
    spouseEducation: createDefaultField(),
    rideShare: createDefaultBooleanField(),
    delivery: createDefaultBooleanField(),
  }
}

/**
 * Create default AutoCoverageInfo
 */
function createDefaultAutoCoverageInfo(): AutoCoverageInfo {
  return {
    bodilyInjury: createDefaultField(),
    propertyDamage: createDefaultField(),
    uninsuredMotorist: createDefaultField(),
    underinsuredMotorist: createDefaultField(),
    medicalPayments: createDefaultField(),
    towing: createDefaultBooleanField(),
    rental: createDefaultBooleanField(),
    offRoadVehicleLiability: createDefaultBooleanField(),
  }
}

/**
 * Create default AutoPriorInsurance
 */
function createDefaultAutoPriorInsurance(): AutoPriorInsurance {
  return {
    insuranceCompany: createDefaultField(),
    premium: createDefaultField(),
    policyNumber: createDefaultField(),
    expirationDate: createDefaultField(),
  }
}

/**
 * Create a complete default AutoApiExtractionResult
 * Note: Deductibles are now embedded in each vehicle, not a separate array.
 */
export function createDefaultAutoApiExtractionResult(): AutoApiExtractionResult {
  return {
    personal: createDefaultAutoPersonalInfo(),
    additionalDrivers: [],
    vehicles: [],
    coverage: createDefaultAutoCoverageInfo(),
    lienholders: [],
    priorInsurance: createDefaultAutoPriorInsurance(),
    accidentsOrTickets: [],
  }
}

// ============================================================================
// Legacy Default Result (backward compatibility)
// ============================================================================

/**
 * Create a complete default ExtractionResult (legacy)
 * @deprecated Use createDefaultHomeApiExtractionResult for Home insurance
 */
export function createDefaultExtractionResult(): ExtractionResult {
  return {
    personal: {
      firstName: createDefaultField(),
      lastName: createDefaultField(),
      dateOfBirth: createDefaultField(),
      ssn: createDefaultField(),
      address: createDefaultField(),
      city: createDefaultField(),
      state: createDefaultField(),
      zipCode: createDefaultField(),
      phone: createDefaultField(),
      email: createDefaultField(),
    },
    employment: {
      employer: createDefaultField(),
      occupation: createDefaultField(),
      income: createDefaultField(),
      yearsEmployed: createDefaultField(),
    },
    coverage: {
      types: createDefaultField(),
      amounts: createDefaultField(),
    },
    beneficiary: {
      primaryName: createDefaultField(),
      primaryRelationship: createDefaultField(),
      contingentName: createDefaultField(),
      contingentRelationship: createDefaultField(),
    },
    health: {
      conditions: createDefaultField(),
      medications: createDefaultField(),
      tobaccoUse: createDefaultField(),
    },
    policies: {
      existingPolicies: createDefaultField(),
      replacementIntent: createDefaultField(),
    },
    financials: {
      assets: createDefaultField(),
      liabilities: createDefaultField(),
      netWorth: createDefaultField(),
    },
  }
}

// ============================================================================
// Confidence Utilities
// ============================================================================

/**
 * Get confidence rank for comparison
 */
function confidenceRank(confidence: 'high' | 'medium' | 'low'): number {
  return { high: 3, medium: 2, low: 1 }[confidence]
}

// ============================================================================
// Result Merging
// ============================================================================

/**
 * Type guard to check if a value is a valid ExtractionField or ExtractionBooleanField
 */
function isExtractionField(value: unknown): value is ExtractionField | ExtractionBooleanField {
  if (typeof value !== 'object' || value === null) return false
  const field = value as Record<string, unknown>
  return (
    'confidence' in field &&
    'flagged' in field &&
    (field.confidence === 'high' || field.confidence === 'medium' || field.confidence === 'low') &&
    typeof field.flagged === 'boolean'
  )
}

/**
 * Safely get a field from a category record using type guard
 */
function getFieldFromRecord(category: Record<string, unknown>, fieldName: string): ExtractionField | ExtractionBooleanField | undefined {
  const field = category[fieldName]
  return isExtractionField(field) ? field : undefined
}

/**
 * Safely set a field on a category record
 */
function setFieldOnRecord(
  category: Record<string, unknown>,
  fieldName: string,
  value: ExtractionField | ExtractionBooleanField
): void {
  category[fieldName] = value
}

/**
 * Check if a new field should replace an existing field based on confidence
 */
function shouldReplaceField(
  existing: ExtractionField | ExtractionBooleanField,
  incoming: ExtractionField | ExtractionBooleanField
): boolean {
  return (
    existing.flagged ||
    existing.value === null ||
    confidenceRank(incoming.confidence) > confidenceRank(existing.confidence)
  )
}

/**
 * Merge partial Home extraction results into a complete result
 */
function mergeHomeApiExtractionResults(
  partials: Partial<HomeApiExtractionResult>[]
): HomeApiExtractionResult {
  const result = createDefaultHomeApiExtractionResult()

  for (const partial of partials) {
    for (const category of Object.keys(partial) as (keyof HomeApiExtractionResult)[]) {
      const partialCategory = partial[category]
      if (!partialCategory) continue

      const resultCategory = result[category] as unknown as Record<string, unknown>
      const partialCategoryFields = partialCategory as unknown as Record<string, unknown>

      for (const fieldName of Object.keys(partialCategoryFields)) {
        const partialField = getFieldFromRecord(partialCategoryFields, fieldName)
        if (!partialField || partialField.value === null) continue

        const existingField = getFieldFromRecord(resultCategory, fieldName)
        if (existingField && shouldReplaceField(existingField, partialField)) {
          setFieldOnRecord(resultCategory, fieldName, partialField)
        }
      }
    }
  }

  return result
}

/**
 * Merge partial extraction results into a complete result (legacy)
 */
function mergeExtractionResults(
  partials: Partial<ExtractionResult>[]
): ExtractionResult {
  const result = createDefaultExtractionResult()

  for (const partial of partials) {
    for (const category of Object.keys(partial) as (keyof ExtractionResult)[]) {
      const partialCategory = partial[category]
      if (!partialCategory) continue

      const resultCategory = result[category] as unknown as Record<string, unknown>
      const partialCategoryFields = partialCategory as unknown as Record<string, unknown>

      for (const fieldName of Object.keys(partialCategoryFields)) {
        const partialField = getFieldFromRecord(partialCategoryFields, fieldName)
        if (!partialField || partialField.value === null) continue

        const existingField = getFieldFromRecord(resultCategory, fieldName)
        if (existingField && shouldReplaceField(existingField, partialField)) {
          setFieldOnRecord(resultCategory, fieldName, partialField)
        }
      }
    }
  }

  return result
}

// =============================================================================
// Auto-specific deduplication helpers
// =============================================================================

/**
 * Check if two vehicles are duplicates based on VIN
 */
function isVehicleDuplicate(existing: AutoVehicle, incoming: AutoVehicle): boolean {
  return existing.vin?.value === incoming.vin?.value && incoming.vin?.value !== null
}

/**
 * Check if two drivers are duplicates based on license number
 */
function isDriverDuplicate(existing: AutoAdditionalDriver, incoming: AutoAdditionalDriver): boolean {
  return (
    existing.licenseNumber?.value === incoming.licenseNumber?.value &&
    incoming.licenseNumber?.value !== null
  )
}

/**
 * Check if two lienholders are duplicates based on vehicle reference
 */
function isLienholderDuplicate(
  existing: AutoVehicleLienholder,
  incoming: AutoVehicleLienholder
): boolean {
  return (
    existing.vehicleReference?.value === incoming.vehicleReference?.value &&
    incoming.vehicleReference?.value !== null
  )
}

/**
 * Check if two accidents/tickets are duplicates based on date and driver
 */
function isIncidentDuplicate(existing: AutoAccidentOrTicket, incoming: AutoAccidentOrTicket): boolean {
  return (
    existing.date?.value === incoming.date?.value &&
    existing.driverName?.value === incoming.driverName?.value &&
    incoming.date?.value !== null
  )
}

/**
 * Merge partial Auto extraction results into a complete result
 * Handles both object fields (personal, coverage, priorInsurance) and array fields
 */
function mergeAutoApiExtractionResults(
  partials: Partial<AutoApiExtractionResult>[]
): AutoApiExtractionResult {
  const result = createDefaultAutoApiExtractionResult()

  // Object fields to merge
  const objectFields: (keyof AutoApiExtractionResult)[] = ['personal', 'coverage', 'priorInsurance']

  for (const partial of partials) {
    // Merge object fields using type-safe helpers
    for (const category of objectFields) {
      const partialCategory = partial[category]
      if (!partialCategory) continue

      const resultCategory = result[category] as unknown as Record<string, unknown>
      const partialCategoryFields = partialCategory as unknown as Record<string, unknown>

      for (const fieldName of Object.keys(partialCategoryFields)) {
        const partialField = getFieldFromRecord(partialCategoryFields, fieldName)
        if (!partialField || partialField.value === null) continue

        const existingField = getFieldFromRecord(resultCategory, fieldName)
        if (existingField && shouldReplaceField(existingField, partialField)) {
          setFieldOnRecord(resultCategory, fieldName, partialField)
        }
      }
    }

    // Merge vehicles array (dedupe by VIN)
    if (partial.vehicles && Array.isArray(partial.vehicles)) {
      for (const vehicle of partial.vehicles) {
        const isDuplicate = result.vehicles.some(existing => isVehicleDuplicate(existing, vehicle))
        if (!isDuplicate) {
          result.vehicles.push(vehicle)
        }
      }
    }

    // Merge additionalDrivers array (dedupe by license number)
    if (partial.additionalDrivers && Array.isArray(partial.additionalDrivers)) {
      for (const driver of partial.additionalDrivers) {
        const isDuplicate = result.additionalDrivers.some(existing => isDriverDuplicate(existing, driver))
        if (!isDuplicate) {
          result.additionalDrivers.push(driver)
        }
      }
    }

    // Merge lienholders array (dedupe by vehicle reference)
    if (partial.lienholders && Array.isArray(partial.lienholders)) {
      for (const lienholder of partial.lienholders) {
        const isDuplicate = result.lienholders.some(existing => isLienholderDuplicate(existing, lienholder))
        if (!isDuplicate) {
          result.lienholders.push(lienholder)
        }
      }
    }

    // Merge accidentsOrTickets array (dedupe by date and driver)
    if (partial.accidentsOrTickets && Array.isArray(partial.accidentsOrTickets)) {
      for (const incident of partial.accidentsOrTickets) {
        const isDuplicate = result.accidentsOrTickets.some(existing => isIncidentDuplicate(existing, incident))
        if (!isDuplicate) {
          result.accidentsOrTickets.push(incident)
        }
      }
    }
  }

  return result
}

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Generic batch extraction with a custom prompt and merge strategy.
 * Used by carrier-specific schema extraction (e.g. chubb-home.json).
 */
export async function extractWithPromptFromImages<T>(
  images: string[],
  prompt: string,
  options: {
    parseBatch: (content: string) => Partial<T>
    mergePartials: (partials: Partial<T>[]) => T
    createDefault: () => T
    logPrefix?: string
  },
): Promise<T> {
  if (images.length === 0) {
    throw new Error('No images provided for extraction')
  }

  const logPrefix = options.logPrefix ?? '[extractWithPrompt]'
  const partialResults: Partial<T>[] = []

  for (let i = 0; i < images.length; i += MAX_PAGES_PER_BATCH) {
    const batch = images.slice(i, i + MAX_PAGES_PER_BATCH)
    const batchNum = Math.floor(i / MAX_PAGES_PER_BATCH) + 1
    const totalBatches = Math.ceil(images.length / MAX_PAGES_PER_BATCH)

    console.log(`${logPrefix} Processing batch ${batchNum}/${totalBatches} (${batch.length} pages)`)

    try {
      const response = await callClaudeVision(batch, prompt)
      const parsed = options.parseBatch(response)
      partialResults.push(parsed)
    } catch (error) {
      console.error(`${logPrefix} Batch ${batchNum} extraction failed:`, error)
    }
  }

  if (partialResults.length === 0) {
    console.warn(`${logPrefix} No successful extractions, returning default result`)
    return options.createDefault()
  }

  return options.mergePartials(partialResults)
}

/**
 * Extract Home insurance data from PDF images using Claude Vision
 * Processes in batches for multi-page documents
 */
export async function extractHomeFromImages(
  images: string[]
): Promise<HomeApiExtractionResult> {
  if (images.length === 0) {
    throw new Error('No images provided for extraction')
  }

  console.log(`[extractHomeFromImages] Starting extraction from ${images.length} images`)
  console.log(`[extractHomeFromImages] First image length: ${images[0]?.length || 0}`)
  console.log(`[extractHomeFromImages] First image prefix: ${images[0]?.substring(0, 50) || 'N/A'}`)
  const partialResults: Partial<HomeApiExtractionResult>[] = []

  // Process images in batches
  for (let i = 0; i < images.length; i += MAX_PAGES_PER_BATCH) {
    const batch = images.slice(i, i + MAX_PAGES_PER_BATCH)
    const batchNum = Math.floor(i / MAX_PAGES_PER_BATCH) + 1
    const totalBatches = Math.ceil(images.length / MAX_PAGES_PER_BATCH)

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} pages)`)

    try {
      console.log(`[extractHomeFromImages] Calling Claude Vision for batch ${batchNum}`)
      const response = await callClaudeVision(batch, HOME_EXTRACTION_PROMPT)
      console.log(`[extractHomeFromImages] Got response for batch ${batchNum}, length: ${response.length}`)
      const parsed = parseHomeExtractionResponse(response)
      console.log(`[extractHomeFromImages] Parsed batch ${batchNum} successfully with Zod validation`)
      partialResults.push(parsed)
    } catch (error) {
      console.error(`[extractHomeFromImages] Batch ${batchNum} extraction failed:`, error)
      console.error(`[extractHomeFromImages] Error type:`, error instanceof Error ? error.constructor.name : typeof error)
      console.error(`[extractHomeFromImages] Error message:`, error instanceof Error ? error.message : String(error))
      // Continue with other batches
    }
  }

  if (partialResults.length === 0) {
    console.warn('No successful extractions, returning default result')
    return createDefaultHomeApiExtractionResult()
  }

  // Merge all partial results
  return mergeHomeApiExtractionResults(partialResults)
}

/**
 * Extract Auto insurance data from PDF images using Claude Vision
 * Processes in batches for multi-page documents
 * Handles array fields (drivers, vehicles, incidents, etc.)
 */
export async function extractAutoFromImages(
  images: string[]
): Promise<AutoApiExtractionResult> {
  if (images.length === 0) {
    throw new Error('No images provided for extraction')
  }

  console.log(`Starting AUTO extraction from ${images.length} images`)
  const partialResults: Partial<AutoApiExtractionResult>[] = []

  // Process images in batches
  for (let i = 0; i < images.length; i += MAX_PAGES_PER_BATCH) {
    const batch = images.slice(i, i + MAX_PAGES_PER_BATCH)
    const batchNum = Math.floor(i / MAX_PAGES_PER_BATCH) + 1
    const totalBatches = Math.ceil(images.length / MAX_PAGES_PER_BATCH)

    console.log(`Processing AUTO batch ${batchNum}/${totalBatches} (${batch.length} pages)`)

    try {
      const response = await callClaudeVision(batch, AUTO_EXTRACTION_PROMPT)
      const parsed = parseAutoExtractionResponse(response)
      partialResults.push(parsed)
    } catch (error) {
      console.error(`AUTO Batch ${batchNum} extraction failed:`, error)
      // Continue with other batches
    }
  }

  if (partialResults.length === 0) {
    console.warn('No successful AUTO extractions, returning default result')
    return createDefaultAutoApiExtractionResult()
  }

  // Merge all partial results (handles both object and array fields)
  return mergeAutoApiExtractionResults(partialResults)
}

/**
 * Extract data from PDF images using Claude Vision (legacy/generic)
 * Processes in batches for multi-page documents
 * @deprecated Use extractHomeFromImages for Home insurance
 */
export async function extractFromImages(
  images: string[]
): Promise<ExtractionResult> {
  if (images.length === 0) {
    throw new Error('No images provided for extraction')
  }

  console.log(`Starting extraction from ${images.length} images`)
  const partialResults: Partial<ExtractionResult>[] = []

  // Process images in batches
  for (let i = 0; i < images.length; i += MAX_PAGES_PER_BATCH) {
    const batch = images.slice(i, i + MAX_PAGES_PER_BATCH)
    const batchNum = Math.floor(i / MAX_PAGES_PER_BATCH) + 1
    const totalBatches = Math.ceil(images.length / MAX_PAGES_PER_BATCH)

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} pages)`)

    try {
      const response = await callClaudeVision(batch, EXTRACTION_PROMPT)
      const parsed = parseLegacyExtractionResponse(response)
      partialResults.push(parsed)
    } catch (error) {
      console.error(`Batch ${batchNum} extraction failed:`, error)
      // Continue with other batches
    }
  }

  if (partialResults.length === 0) {
    console.warn('No successful extractions, returning default result')
    return createDefaultExtractionResult()
  }

  // Merge all partial results
  return mergeExtractionResults(partialResults)
}

/**
 * Generic extraction function that supports different insurance types
 */
export async function extractFromImagesWithType(
  images: string[],
  insuranceType: InsurancePromptType = 'generic'
): Promise<HomeApiExtractionResult | AutoApiExtractionResult | ExtractionResult> {
  switch (insuranceType) {
    case 'home':
      return extractHomeFromImages(images)
    case 'auto':
      return extractAutoFromImages(images)
    default:
      return extractFromImages(images)
  }
}

// ============================================================================
// Legacy exports - maintained for backward compatibility
// ============================================================================

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
