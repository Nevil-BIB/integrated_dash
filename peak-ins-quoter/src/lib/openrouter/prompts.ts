/**
 * OpenRouter Extraction Prompts
 *
 * Prompts for extracting structured data from scanned insurance documents
 * using Claude Vision via the OpenRouter API.
 */

// ============================================================================
// Home Insurance Extraction Prompt
// ============================================================================

export const HOME_EXTRACTION_PROMPT = `You are analyzing scanned HOME INSURANCE fact finder document(s). Extract ALL prospect and property information into a structured JSON format.

IMPORTANT: Return ONLY valid JSON with no additional text or markdown formatting outside the JSON structure.

For each TEXT field, provide an object with:
- "value": The extracted value as a string (null if not found or illegible)
- "confidence": "high" (clearly legible), "medium" (partially legible or inferred), or "low" (uncertain/guessed)
- "flagged": true if the field needs human review (illegible, ambiguous, missing, or uncertain)
- "rawText": The original text exactly as it appears if different from the normalized value (optional)

For each BOOLEAN field (yes/no questions), provide:
- "value": true, false, or null (if not found)
- "confidence": "high", "medium", or "low"
- "flagged": true if needs review
- "rawText": The original text (optional)

Fields marked with [REQUIRED] are critical for quoting - flag them for review if not found.

Extract these categories with their specific fields:

{
  "personal": {
    "firstName": { text field },
    "lastName": { text field },
    "dateOfBirth": { text field - format as YYYY-MM-DD - applicant DOB },
    "ssn": { text field - format as XXX-XX-XXXX, mask middle digits if partially visible },
    "spouseFirstName": { text field },
    "spouseLastName": { text field },
    "spouseDateOfBirth": { text field - format as YYYY-MM-DD },
    "spouseSsn": { text field - format as XXX-XX-XXXX },
    "streetAddress": { text field - current street address },
    "city": { text field - current city },
    "state": { text field - 2-letter state abbreviation },
    "zipCode": { text field - 5 or 9 digit ZIP },
    "priorStreetAddress": { text field - if less than 5 years at current address },
    "priorCity": { text field },
    "priorState": { text field - 2-letter abbreviation },
    "priorZipCode": { text field },
    "yearsAtCurrentAddress": { text field - number of years },
    "phone": { text field - format as (XXX) XXX-XXXX },
    "email": { text field }
  },
  "property": {
    "purchaseDate": { text field - format as YYYY-MM-DD },
    "yearBuilt": { text field - 4-digit year [REQUIRED] },
    "squareFootage": { text field - number only },
    "numberOfStories": { text field - number },
    "numberOfKitchens": { text field - number },
    "kitchenStyle": { text field - Standard, Custom, Builder Grade, etc. },
    "numberOfBathrooms": { text field - number (can be decimal like 2.5) },
    "bathroomStyle": { text field - Standard, Custom, etc. },
    "flooringPercentage": { text field - breakdown by type, e.g., "60% Hardwood, 30% Carpet, 10% Tile" },
    "heatType": { text field - Gas, Electric, Oil, Propane, Heat Pump, etc. },
    "exteriorConstruction": { text field - Brick, Vinyl Siding, Wood, Stucco, Stone, etc. [REQUIRED] },
    "exteriorFeatures": { text field - describe notable exterior features },
    "roofAge": { text field - age in years [REQUIRED] },
    "roofConstruction": { text field - Asphalt Shingle, Metal, Tile, Slate, Flat, etc. },
    "foundationType": { text field - Slab, Full Basement, Partial Basement, Crawl Space, Pier [REQUIRED] },
    "hasFinishedBasement": { boolean field },
    "garageType": { text field - Attached, Detached, Built-in, Carport, None },
    "numberOfCarGarage": { text field - number of cars garage can hold },
    "numberOfFireplaces": { text field - number [REQUIRED] },
    "fireplaceType": { text field - Wood-burning, Gas, Electric, Pellet, etc. },
    "deckPatioDetails": { text field - describe deck, patio, porch, screened porch, etc. },
    "isCondoOrTownhouse": { boolean field },
    "specialFeatures": { text field - pool house, guest house, workshop, etc. }
  },
  "householdMember": {
    "firstName": { text field },
    "lastName": { text field },
    "suffix": { text field },
    "dob": { text field - format as YYYY-MM-DD },
    "ssn": { text field - format as XXX-XX-XXXX },
    "relationship": { text field - Relationship to Insured: Self/Named Insured, Spouse, Resident Relative, Child, Other },
    "maritalStatus": { text field },
    "dlState": { text field - 2-letter state abbreviation },
    "dlNumber": { text field }
  },
  "locationDetail": {
    "locationOccupancy": { text field - Primary, Secondary, Seasonal, Tenant Occupied, Vacant [REQUIRED] },
    "ownerOccupied": { text field - Yes/No [REQUIRED] },
    "vacant": { text field - Yes/No [REQUIRED] },
    "liabilityCoverageOnly": { text field - Yes/No [REQUIRED] },
    "personalPropertyOnly": { text field - Yes/No [REQUIRED] }
  },
  "locationInformation": {
    "program": { text field - Basic or Special [REQUIRED] },
    "type": { text field - Dwelling [REQUIRED] },
    "coverageA": { text field [REQUIRED] },
    "coverageF": { text field [REQUIRED] },
    "personalInjury": { text field - Yes/No [REQUIRED] },
    "coverageG": { text field [REQUIRED] },
    "constructionYear": { text field },
    "construction": { text field [REQUIRED] },
    "foundation": { text field [REQUIRED] },
    "finishedLivingArea": { text field },
    "numberOfFamiliesUnits": { text field [REQUIRED] },
    "replacementCost100": { text field },
    "roofLossSettlementWindstormHail": { text field },
    "roofingMaterial": { text field [REQUIRED] },
    "roofUpdateYear": { text field [REQUIRED] },
    "marketValue": { text field },
    "hasMortgageeContractHolderOrSecuredLineOfCredit": { text field - Yes/No [REQUIRED] },
    "boardingOrLodgingOrStudentRentals": { text field - Yes/No [REQUIRED] },
    "isStudentRental": { text field - Yes/No [REQUIRED] },
    "visibleFromOtherDwellings": { text field - Yes/No [REQUIRED] },
    "fortifiedHome": { text field - Yes/No [REQUIRED] },
    "woodCoalHeating": { text field - Yes/No [REQUIRED] },
    "woodCoalHeatingLocation": { text field - Dwelling, Outbuilding, Outside },
    "woodCoalHeatingQuantity": { text field },
    "gatedAccessToDwelling": { text field - Yes/No [REQUIRED] },
    "applicantWillingToCompleteDiySurvey": { text field - Yes/No [REQUIRED] },
    "screenedEnclosure": { text field - Yes/No [REQUIRED] },
    "dwellingConstructedWithAsbestos": { text field - Yes/No [REQUIRED] },
    "floodZone": { text field - Yes/No [REQUIRED] },
    "coastalStormRiskArea": { text field - Yes/No [REQUIRED] },
    "locatedOnIsland": { text field - Yes/No [REQUIRED] },
    "conditionOfDwelling": { text field },
    "dogsOwnedOrKept": { text field - Yes/No [REQUIRED] },
    "specificBreed": { text field },
    "biteHistoryAggressiveBehavior": { text field - Yes/No [REQUIRED] },
    "isLocationWithinCity": { text field - Yes/No [REQUIRED] },
    "respondingFireDepartment": { text field [REQUIRED] },
    "communityName": { text field [REQUIRED] },
    "within1000FeetOfHydrant": { text field - Yes/No [REQUIRED] },
    "bridgeAccess": { text field - Yes/No [REQUIRED] },
    "windHailDeductible": { text field [REQUIRED] },
    "hurricaneDeductible": { text field [REQUIRED] },
    "county": { text field [REQUIRED] },
    "locationInformationOccupancy": { text field [REQUIRED] },
    "territory": { text field [REQUIRED] },
    "ownership": { text field [REQUIRED] },
    "allOtherPerilsDeductible": { text field [REQUIRED] },
    "distanceToHydrantFeet": { text field [REQUIRED] },
    "distanceToFireStationMiles": { text field [REQUIRED] },
    "protectionClass": { text field [REQUIRED] }
  },
  "policyQuestions": {
    "pleaseExplain": { text field [REQUIRED] },
    "hasAnyCompanyCanceledRefusedOrDeclinedRenewal": { text field - Yes/No [REQUIRED] },
    "hasAutoOwnersInsurancePast5Years": { text field - Yes/No [REQUIRED] },
    "options": { text field },
    "previousPolicyNumber": { text field },
    "hasFiledPersonalBankruptcyOrJudgementsPast5Years": { text field - Yes/No [REQUIRED] },
    "bankruptcyPleaseExplain": { text field },
    "hasAnyApplicantBeenConvictedOfArson": { text field - Yes/No [REQUIRED] }
  },
  "locationSpecificQuestions": {
    "dwellingForSale": { text field - Yes/No [REQUIRED] },
    "isNewVentureNoPreviousLandlordOrRentalPropertyExperience": { text field - Yes/No [REQUIRED] },
    "areThereAnyOutbuildingsOnPremises": { text field - Yes/No [REQUIRED] },
    "anyFloodingBrushLandslideOrUnusualHazards": { text field - Yes/No [REQUIRED] },
    "areDogsAllowed": { text field - Yes/No [REQUIRED] },
    "anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets": { text field - Yes/No [REQUIRED] },
    "anyUncorrectedFireCodeViolations": { text field - Yes/No [REQUIRED] },
    "difficultAccessByFireAndPoliceDepartments": { text field - Yes/No [REQUIRED] },
    "dwellingNewPurchase": { text field - Yes/No [REQUIRED] },
    "purchasePrice": { text field [REQUIRED] },
    "dwellingOccupied": { text field - Yes/No [REQUIRED] },
    "pleaseExplain": { text field },
    "expectedOccupancyDate": { text field - format as YYYY-MM-DD },
    "dayCareOnPremises": { text field - Yes/No [REQUIRED] },
    "childrenCaredForCount": { text field },
    "farmingOnPremises": { text field - Yes/No [REQUIRED] },
    "acresFarmedByOthers": { text field },
    "numberOfAnimalsLarge": { text field },
    "numberOfAnimalsMedium": { text field },
    "numberOfAnimalsSmall": { text field },
    "otherBusinessOnPremises": { text field - Yes/No [REQUIRED] },
    "describeBusiness": { text field },
    "buildingUnderRenovationOrReconstruction": { text field - Yes/No [REQUIRED] },
    "householdMembersLivingDuringRenovation": { text field - Yes/No },
    "renovationExplanation": { text field },
    "responsesVerifiedWithApplicant": { text field - Yes/No [REQUIRED] }
  },
  "safety": {
    "hasAlarmSystem": { boolean field },
    "isAlarmMonitored": { boolean field - by security company },
    "hasPool": { boolean field },
    "hasTrampoline": { boolean field },
    "hasEnclosedYard": { boolean field - fenced yard },
    "hasDog": { boolean field },
    "dogBreed": { text field - if has dog, specify breed }
  },
  "coverage": {
    "dwellingCoverage": { text field - Coverage A amount, numbers only [REQUIRED] },
    "liabilityCoverage": { text field - liability limit, numbers only [REQUIRED] },
    "medicalPayments": { text field - Med Pay amount, numbers only [REQUIRED] },
    "deductible": { text field - deductible amount, numbers only [REQUIRED] },
    "personalPropertyCoverage": { text field - Coverage C amount },
    "lossOfUseCoverage": { text field - Coverage D amount }
  },
  "claims": {
    "claimsInLast5Years": { text field - describe any claims or "None" [REQUIRED] },
    "numberOfClaims": { text field - number },
    "claimDetails": { text field - for each claim: type, date, amount paid }
  },
  "lienholder": {
    "lienholderName": { text field - mortgage company name },
    "lienholderAddress": { text field - mortgagee clause address },
    "loanNumber": { text field },
    "currentInsuranceCompany": { text field },
    "currentPolicyNumber": { text field },
    "currentEffectiveDate": { text field - format as YYYY-MM-DD [REQUIRED] },
    "currentPremium": { text field - numbers only },
    "isEscrowed": { boolean field - insurance paid through escrow },
    "hasBeenCancelledOrDeclined": { boolean field - cancelled, declined, or non-renewed },
    "cancelDeclineDetails": { text field - explain if above is true },
    "referredBy": { text field - referral source }
  },
  "updates": {
    "hvacUpdateYear": { text field - 4-digit year of HVAC update [REQUIRED] },
    "plumbingUpdateYear": { text field - 4-digit year of plumbing update [REQUIRED] },
    "roofUpdateYear": { text field - 4-digit year of roof update [REQUIRED] },
    "electricalUpdateYear": { text field - 4-digit year of electrical update [REQUIRED] },
    "hasCircuitBreakers": { boolean field - true if circuit breakers, false if fuse box [REQUIRED] }
  }
}

Guidelines:
1. Be thorough - examine ALL visible text on EVERY page
2. Flag ANY field where you're not 100% confident
3. Fields marked [REQUIRED] are critical - always flag if not found
4. For dates, normalize to YYYY-MM-DD format when possible
5. For phone numbers, normalize to (XXX) XXX-XXXX format
6. For currency/numbers, include only digits (no $, commas, or text)
7. If a field appears multiple times, use the most recent/clear version
8. If handwriting is present, do your best to interpret it
9. Include rawText when the original differs from your normalized value
10. For boolean fields, look for checkboxes, Yes/No answers, or contextual clues
11. If updates section shows "Original" or year built, use that year for the update fields

Return ONLY the JSON object, no markdown code blocks or explanations.`

// ============================================================================
// Auto Insurance Extraction Prompt
// ============================================================================

export const AUTO_EXTRACTION_PROMPT = `You are analyzing scanned AUTO INSURANCE fact finder document(s). Extract ALL driver, vehicle, and coverage information into a structured JSON format.

IMPORTANT: Return ONLY valid JSON with no additional text or markdown formatting outside the JSON structure.

For each TEXT field, provide an object with:
- "value": The extracted value as a string (null if not found or illegible)
- "confidence": "high" (clearly legible), "medium" (partially legible or inferred), or "low" (uncertain/guessed)
- "flagged": true if the field needs human review (illegible, ambiguous, missing, or uncertain)
- "rawText": The original text exactly as it appears if different from the normalized value (optional)

For each BOOLEAN field (yes/no questions), provide:
- "value": true, false, or null (if not found)
- "confidence": "high", "medium", or "low"
- "flagged": true if needs review
- "rawText": The original text (optional)

Fields marked with [REQUIRED] are critical for quoting - flag them for review if not found.

Extract these categories with their specific fields:

{
  "personal": {
    // Shared personal information
    "ownerFirstName": { text field },
    "ownerLastName": { text field },
    "ownerDOB": { text field - format as YYYY-MM-DD },
    "maritalStatus": { text field - Single, Married, Divorced, Widowed, Domestic Partner [REQUIRED] },
    "spouseFirstName": { text field },
    "spouseLastName": { text field },
    "spouseDOB": { text field - format as YYYY-MM-DD },
    "streetAddress": { text field - current street address },
    "city": { text field - current city },
    "state": { text field - 2-letter state abbreviation },
    "zipCode": { text field - 5 or 9 digit ZIP },
    "garagingAddressSameAsMailing": { boolean field - is garaging address same as mailing address },
    "garagingStreetAddress": { text field - garaging street if different from mailing },
    "garagingCity": { text field - garaging city if different },
    "garagingState": { text field - 2-letter state abbreviation },
    "garagingZipCode": { text field - 5 or 9 digit ZIP },
    "priorStreetAddress": { text field - if less than 5 years at current address },
    "priorCity": { text field },
    "priorState": { text field - 2-letter abbreviation },
    "priorZipCode": { text field },
    "yearsAtCurrentAddress": { text field - number of years },
    "phone": { text field - format as (XXX) XXX-XXXX },
    "email": { text field },
    "effectiveDate": { text field - policy effective/start date in YYYY-MM-DD format [REQUIRED] },

    // Auto-specific personal information
    "ownerDriversLicense": { text field - license number [REQUIRED] },
    "ownerLicenseState": { text field - 2-letter abbreviation },
    "spouseDriversLicense": { text field - license number },
    "spouseLicenseState": { text field - 2-letter abbreviation },
    "ownerOccupation": { text field },
    "spouseOccupation": { text field },
    "ownerEducation": { text field - High School, Some College, Bachelor's, etc. },
    "spouseEducation": { text field },
    "rideShare": { boolean field - Uber, Lyft, etc. [REQUIRED] },
    "delivery": { boolean field - DoorDash, Instacart, etc. [REQUIRED] }
  },
  "additionalDrivers": [
    // Array of additional household drivers
    {
      "firstName": { text field [REQUIRED] },
      "lastName": { text field [REQUIRED] },
      "dateOfBirth": { text field - format as YYYY-MM-DD [REQUIRED] },
      "licenseNumber": { text field [REQUIRED] },
      "licenseState": { text field - 2-letter abbreviation },
      "relationship": { text field - Spouse, Child, Parent, Other },
      "goodStudentDiscount": { boolean field - GSD eligible },
      "vehicleAssigned": { text field - which vehicle, e.g., "Vehicle 1" }
    }
    // ... repeat for each additional driver
  ],
  "vehicles": [
    // Array of automobiles to insure (includes deductibles per vehicle)
    {
      // Vehicle identification
      "year": { text field - 4-digit year [REQUIRED] },
      "make": { text field - manufacturer [REQUIRED] },
      "model": { text field - model name [REQUIRED] },
      "vin": { text field - 17 character VIN [REQUIRED] },
      "estimatedMileage": { text field - annual mileage estimate },
      "vehicleUsage": { text field - Pleasure, Commute, Business, Farm },
      "ownership": { text field - Owned, Financed, Leased },
      // Deductibles (per-vehicle)
      "comprehensiveDeductible": { text field - dollar amount or "Liability Only" },
      "collisionDeductible": { text field - dollar amount or "Liability Only" },
      "roadTroubleService": { text field - roadside assistance level (None, $25, $50, $75, $100) },
      "limitedTNCCoverage": { boolean field - Transportation Network Company (Uber/Lyft) coverage },
      "additionalExpenseCoverage": { text field - rental reimbursement amount (None, $15/day, $20/day, $25/day, $30/day) }
    }
    // ... repeat for each vehicle
  ],
  "coverage": {
    "bodilyInjury": { text field - format as "250/500" [REQUIRED] },
    "propertyDamage": { text field - format as "100" [REQUIRED] },
    "uninsuredMotorist": { text field - format as "250/500" or "Reject" },
    "underinsuredMotorist": { text field - format as "250/500" or "Reject" },
    "medicalPayments": { text field - dollar amount },
    "towing": { boolean field },
    "rental": { boolean field },
    "offRoadVehicleLiability": { boolean field - ATV/off-road vehicle liability coverage }
  },
  "lienholders": [
    // Array of lienholder info by vehicle (only for financed/leased)
    {
      "vehicleReference": { text field - which vehicle [REQUIRED] },
      "lienholderName": { text field - finance company name },
      "lienholderAddress": { text field - full address },
      "lienholderCity": { text field },
      "lienholderState": { text field - 2-letter abbreviation },
      "lienholderZip": { text field }
    }
    // ... repeat for each financed/leased vehicle
  ],
  "priorInsurance": {
    "insuranceCompany": { text field - current/prior carrier name },
    "premium": { text field - annual premium, numbers only },
    "policyNumber": { text field },
    "expirationDate": { text field - format as YYYY-MM-DD }
  },
  "accidentsOrTickets": [
    // Array of incidents in last 5 years
    {
      "driverName": { text field - which driver [REQUIRED] },
      "date": { text field - format as YYYY-MM-DD [REQUIRED] },
      "type": { text field - Collision, Ticket, Comprehensive, DUI, etc. [REQUIRED] },
      "description": { text field - details of incident },
      "amount": { text field - claim amount if applicable },
      "atFault": { text field - Yes, No, or NAF [REQUIRED] }
    }
    // ... repeat for each incident
  ]
}

Guidelines:
1. Be thorough - examine ALL visible text on EVERY page
2. Flag ANY field where you're not 100% confident
3. Fields marked [REQUIRED] are critical - always flag if not found
4. For dates, normalize to YYYY-MM-DD format when possible
5. For phone numbers, normalize to (XXX) XXX-XXXX format
6. For coverage limits, use format like "250/500" for split limits
7. VINs must be exactly 17 characters - flag if incomplete or unclear
8. If a field appears multiple times, use the most recent/clear version
9. If handwriting is present, do your best to interpret it
10. Include rawText when the original differs from your normalized value
11. For boolean fields, look for checkboxes, Yes/No answers, or contextual clues
12. Arrays should contain all found items (drivers, vehicles, incidents, etc.)
13. Include empty arrays if no items found (e.g., no additional drivers)
14. For lienholders, only include entries for financed/leased vehicles

Return ONLY the JSON object, no markdown code blocks or explanations.`

// ============================================================================
// Legacy Generic Extraction Prompt (backward compatibility)
// ============================================================================

export const EXTRACTION_PROMPT = `You are analyzing scanned insurance fact finder document(s). Extract ALL prospect information into a structured JSON format.

IMPORTANT: Return ONLY valid JSON with no additional text or markdown formatting outside the JSON structure.

For each field, provide an object with:
- "value": The extracted value as a string (null if not found or illegible)
- "confidence": "high" (clearly legible), "medium" (partially legible or inferred), or "low" (uncertain/guessed)
- "flagged": true if the field needs human review (illegible, ambiguous, missing, or uncertain)
- "rawText": The original text exactly as it appears if different from the normalized value (optional)

Extract these categories with their specific fields:

{
  "personal": {
    "firstName": { field object },
    "lastName": { field object },
    "dateOfBirth": { field object - format as YYYY-MM-DD if possible },
    "ssn": { field object - format as XXX-XX-XXXX, mask middle digits with X if partially visible },
    "address": { field object - street address },
    "city": { field object },
    "state": { field object - use 2-letter abbreviation },
    "zipCode": { field object },
    "phone": { field object - format as (XXX) XXX-XXXX },
    "email": { field object }
  },
  "employment": {
    "employer": { field object - company/organization name },
    "occupation": { field object - job title/role },
    "income": { field object - annual income, numbers only },
    "yearsEmployed": { field object - number of years }
  },
  "coverage": {
    "types": { field object - comma-separated list: life, health, disability, etc. },
    "amounts": { field object - requested coverage amounts }
  },
  "beneficiary": {
    "primaryName": { field object - primary beneficiary full name },
    "primaryRelationship": { field object - relationship to applicant },
    "contingentName": { field object - contingent beneficiary name },
    "contingentRelationship": { field object - relationship to applicant }
  },
  "health": {
    "conditions": { field object - list any medical conditions mentioned },
    "medications": { field object - list any medications },
    "tobaccoUse": { field object - "yes", "no", or "unknown" }
  },
  "policies": {
    "existingPolicies": { field object - describe any existing insurance },
    "replacementIntent": { field object - "yes" or "no" if replacing existing policy }
  },
  "financials": {
    "assets": { field object - total assets value },
    "liabilities": { field object - total liabilities/debts },
    "netWorth": { field object - calculated or stated net worth }
  }
}

Guidelines:
1. Be thorough - examine all visible text on every page
2. Flag ANY field where you're not 100% confident
3. For dates, normalize to YYYY-MM-DD format when possible
4. For phone numbers, normalize to (XXX) XXX-XXXX format
5. For currency, include only numbers (no $ or commas in value)
6. If a field appears multiple times, use the most recent/clear version
7. If handwriting is present, do your best to interpret it
8. Include rawText when the original differs from your normalized value

Return ONLY the JSON object, no markdown code blocks or explanations.`

// ============================================================================
// Single Field Extraction Prompt
// ============================================================================

export const SINGLE_FIELD_PROMPT = (fieldName: string, fieldDescription: string) => `
Extract the following specific field from this document image:

Field: ${fieldName}
Description: ${fieldDescription}

Return a JSON object with:
{
  "value": "extracted value or null",
  "confidence": "high" | "medium" | "low",
  "flagged": true/false,
  "rawText": "original text if different"
}

Return ONLY the JSON object.
`

// ============================================================================
// Prompt Selection Helper
// ============================================================================

export type InsurancePromptType = 'home' | 'auto' | 'life' | 'health' | 'generic'

/**
 * Get the appropriate extraction prompt for the insurance type
 */
export function getExtractionPrompt(type: InsurancePromptType = 'generic'): string {
  switch (type) {
    case 'home':
      return HOME_EXTRACTION_PROMPT
    case 'auto':
      return AUTO_EXTRACTION_PROMPT
    // Future prompts can be added here:
    // case 'life':
    //   return LIFE_EXTRACTION_PROMPT
    default:
      return EXTRACTION_PROMPT
  }
}
