# Peak Quote - Development Progress Tracker

> **Last Updated:** Jun 3, 2026 (Session 23)
>
> **IMPORTANT:** This document should be updated after each development session. See CLAUDE.md for instructions.

## Project Overview

**Peak Quote** (Fact Finder Extraction Application) - A Next.js application for insurance professionals that:
- Allows authenticated users to upload scanned fact finder PDFs
- Extracts prospect data using Claude Vision via OpenRouter
- Validates extracted data against Home/Auto quote schemas
- Prepares data for RPA automation to carrier quote sites

---

## Session Log

### Session: Jun 3, 2026 (Session 23)

**Focus:** Carrier-specific Quote Preview page (Chubb-only fields)

---

#### What was built/changed

- Added `carrier-quote-validation.ts` — `transformCarrierToValidation()` and `buildCarrierSubmitFields()` from `chubb-home.json`.
- `QuotePreviewClient` — when `workflow.carrierOptionId` is set, shows `CarrierExtractionForm` instead of broad field sections + separate Chubb estimator card.
- Submit payload uses schema keys only via `buildCarrierSubmitFields()`; validation uses carrier required fields.
- Exported `isCarrierFieldVisible()` for shared conditional logic between review and quote.

---

#### Next steps

- Dynamic submit endpoint from schema `automation.submitPath` (currently still hardcoded `/chubb`).
- Quote preview read-only summary mode (optional UX polish).

---

### Session: Jun 3, 2026 (Session 22)

**Focus:** Carrier-specific review UI — Chubb-only fields on review page

---

#### What was built/changed

- Added `CarrierExtractionForm` — schema-driven review form with bold **Chubb Home** heading and sections from `chubb-home.json` only.
- Added `schema-field-access.ts` and `validate-carrier-extraction.ts` for field path resolution and required-field validation.
- `ExtractionReview` detects `workflow.carrierOptionId` and shows carrier form instead of full `HomeExtractionForm` when Chubb is selected.
- Save preserves `workflow` + `carrierFields`; proceed-to-quote validates only Chubb required schema fields.

---

#### Next steps

- Apply same carrier-only pattern to Quote preview page.
- Schema-driven quote payload builder from `carrierFields`.

---

### Session: Jun 3, 2026 (Session 21)

**Focus:** Carrier-specific extraction — Chubb Home uses `chubb-home.json` prompt, not broad home schema

---

#### What was built/changed

- Added `carrier-extraction-prompt.ts` — builds Claude Vision prompt from carrier JSON schema sections/fields.
- Added `map-carrier-extraction-to-home.ts` — maps flat schema keys to `HomeExtractionResult` UI paths + `carrierFields` for quote payload.
- Added `extract.ts` — `extractCarrierFromImages()` and `supportsCarrierSchemaExtraction()`.
- Added `extractWithPromptFromImages()` in OpenRouter client for reusable batch extraction.
- `/api/extract` — when `carrierOptionId` is `chubb-home`, runs carrier schema extraction instead of `HOME_EXTRACTION_PROMPT`.

---

#### Key decisions made

- AI returns flat schema keys (`personal.firstName`, `buildingType`, etc.) in a `fields` object; mapper resolves to UI sections (`chubbHomeCoverageEstimator.*`, `personal.address` for street).
- Raw carrier keys preserved in `carrierFields` on saved `extracted_data` for future quote payload builder.
- Broad home prompt remains fallback for non-carrier-schema home extractions.

---

#### Next steps

- Schema-driven review UI (show only Chubb sections + required validation).
- Quote payload builder reading `carrierFields` + schema.

---

### Session: Jun 9, 2026 (Session 20)

**Focus:** Chubb Home carrier JSON schema (Priyansh unified UI — per-carrier schema)

---

#### What was built/changed

- Added `src/lib/carriers/schemas/chubb-home.json` — full Chubb automation field map (9 required + all optional fields from backend), grouped by portal step.
- Added `schema-types.ts`, `load-schema.ts` — registry to load carrier JSON by `carrierOptionId`.
- Refactored `chubb-home-schema.ts` to read from JSON (single source of truth).
- `workflow.schemaVersion` now comes from JSON `version` field.

---

#### Next steps

- Wire extraction prompt to `chubb-home.json` fields only (Phase 4).
- Schema-driven review validation and payload builder.

---

### Session: Jun 9, 2026 (Session 19)

**Focus:** Chubb unified UI — Phase 1 foundation (carrier schema + upload selector)

---

#### What was built/changed

- Added `docs/CHUBB_UNIFIED_UI_IMPLEMENTATION.md` — step-by-step plan for unified carrier quoting (Chubb first, then multi-carrier).
- Added `src/lib/carriers/` — carrier option types, full Chubb Home field schema (required + optional from backend field map), workflow metadata helpers.
- Replaced upload **Home/Auto/Both** selector with **combined carrier quote** selector (`Chubb Home` first enabled option).
- Extract API now accepts `carrierOptionId` and persists `workflow` metadata inside `extracted_data`.

---

#### Key decisions made

- Phase 1 uses JSONB `workflow` metadata (no DB migration) to track selected carrier product.
- Chubb schema file is source of truth for field keys aligned with backend Playwright automation.
- Legacy extractions without `workflow` remain supported (backward compatible).

---

#### Next steps

- Phase 2: Chubb-only review sections + required field validation from schema.
- Phase 3: Schema-driven quote preview payload + dynamic Chubb endpoint.
- Phase 4: Carrier-specific extraction prompts (extract only Chubb fields).

---

### Session: Jun 2, 2026 (Session 18)

**Focus:** Expand Chubb Home Coverage Estimator fields and ensure quote payload includes them consistently

---

#### What was built/changed

- Moved newly added “mortgages / usage / prior carrier / other carrier” fields out of Homeowners Informations and into the Chubb Home Coverage Estimator section, shown on both Review and Quote pages.
- Added additional optional Chubb estimator dropdowns to match portal options: Roof Covering Type, Wind Protection, and Hurricane/Wind-Hail Deductible Type.
- Added optional Chubb checkbox groups for Security, Detectors/Monitors/Protectors, Sprinklers, and Centrally Monitored Alarms, matching visible portal options and excluding dimmed/inactive items.
- Added new optional Chubb dropdowns for Water Leak Protection and Distance from Fire Station with portal-aligned option sets.
- Updated quote submission so Chubb estimator scalar fields are merged into the outbound `fields` array at submit time (without changing request body shape), ensuring the latest Chubb edits are always included.
- Hardened data loading by migrating legacy saved values (if previously stored under the old Homeowners path) into the Chubb estimator on load.

---

#### Bugs fixed

- Fixed Quote Preview crash caused by a missing helper function referenced by Chubb attached-structures/construction-types validation generation.

---

#### Key decisions made

- Kept the existing API request structure unchanged (`fields: [...]`) and only enriched it by merging in Chubb scalar fields right before submit.
- Kept all new Chubb estimator fields optional to avoid blocking quote submission.

---

#### Next steps

- If the Playwright Chubb automation should also fill the newly added roof/wind/deductible UI selects, add corresponding selectors and mappings in the backend Chubb steps.

---

### Session: May 4, 2026 (Session 17)

**Focus:** Keep upload flow intact and improve Home PDF auto-fill coverage by aligning extraction contract with new review fields

---

#### What was built/changed

- Updated `/src/lib/openrouter/prompts.ts` (`HOME_EXTRACTION_PROMPT`) to explicitly request extraction for newly added Home sections used in UI: `householdMember`, `locationDetail`, `locationInformation`, `policyQuestions`, and `locationSpecificQuestions`.
- Expanded Home API extraction types in `/src/types/extraction.ts` with typed interfaces for those sections and added them to `HomeApiExtractionResult`.
- Expanded runtime validation in `/src/lib/openrouter/schemas.ts` with new Zod schemas for those Home sections and included them in `HomeApiExtractionResultSchema` (partial validation still supported via `.partial()`).
- Updated default extraction factories in `/src/lib/openrouter/client.ts` and `/src/lib/openrouter/defaults.ts` to initialize all new Home section fields, so merge logic has stable category objects.
- Updated `/src/lib/extraction/transform.ts` to map the new API sections into UI sections during `homeApiToUiExtraction`, and to include those sections when reconstructing Home data from combined (`quoteType: 'both'`) extraction payloads.
- Updated `/src/app/api/extract/route.ts` combined extraction object to persist new Home sections in `home` for `quoteType: 'both'`.

---

#### Bugs fixed

- Fixed primary extraction contract gap where AI was not instructed/schema-validated for many newly required Home fields, causing frequent manual refill after upload.
- Fixed potential merge-path runtime risk for new Home categories by ensuring default result objects include all new sections before partial merge.
- Fixed combined Home+Auto persistence omission where new Home sections were not included in the saved combined payload.

---

#### Key decisions made

- Kept the existing upload/extract/save/review flow unchanged; only prompt/schema/types/default-transform layers were updated.
- Kept new Home section fields as `ExtractionField` (string-style extraction metadata) to stay consistent with current UI section handling and avoid additional boolean coercion complexity.
- Preserved backward behavior by continuing partial schema validation and fallback-to-raw parsing when model output is imperfect.

---

#### Next steps

- Run an end-to-end upload test with `alex.pdf`/`john.pdf` and verify new sections arrive populated on `/review/[id]` before navigating to quote page.
- If some fields still remain blank from specific document layouts, tune only prompt wording/examples for those exact fields (without changing pipeline flow).
- Optionally add lightweight extraction logs for top missing keys per upload to make future prompt tuning faster.

---

### Session: March 30, 2026 (Session 16)

**Focus:** Fix pdfjs DOMMatrix runtime failure in extraction API

---

#### What was built/changed

- Updated `/src/lib/pdf/converter.ts` to initialize canvas polyfills (`DOMMatrix`, `ImageData`, `Path2D`) from `@napi-rs/canvas` before importing `pdfjs-dist`.
- Refactored pdfjs initialization so module state is cached only after successful import, preventing a failed first import from poisoning later attempts.
- Updated `/src/app/api/extract/route.ts` with `export const runtime = 'nodejs'` to enforce Node runtime for extraction processing.
- Added `/src/instrumentation.ts` to register DOM/canvas polyfills at server startup before any `pdfjs-dist` module evaluation.
- Simplified `/next.config.ts` by removing Turbopack/Webpack canvas alias overrides that could interfere with server-side module behavior.
- Extended `/src/instrumentation.ts` with a `process.getBuiltinModule` polyfill for older Node runtimes to satisfy `pdfjs-dist` v5 node canvas factory expectations.
- Hardened the `process.getBuiltinModule` polyfill so `getBuiltinModule("module")` always returns an object exposing `createRequire`, matching what `pdfjs-dist` expects.

---

#### Bugs fixed

- Fixed extraction crash in dev/runtime path where `pdfjs-dist/legacy/build/pdf.mjs` failed with `ReferenceError: DOMMatrix is not defined`, which caused `/api/extract` to return `500`.
- Fixed initialization ordering issue where `pdfjsInitialized` could be set before a successful `pdfjs` import, making retries unreliable after an early failure.
- Fixed subsequent extraction crash where `pdfjs-dist` called `process.getBuiltinModule("module")` on Node versions that do not expose that API.
- Fixed follow-up crash where `getBuiltinModule("module")` resolved to `undefined` and `pdfjs-dist` failed on `.createRequire(...)`.

---

#### Key decisions made

- Kept `@napi-rs/canvas` as the source for DOM/canvas polyfills instead of adding a separate polyfill dependency.
- Applied polyfills at converter initialization time to guarantee they exist before loading `pdfjs`, since `pdfjs` touches DOM globals during module evaluation.
- Explicitly pinned extraction route runtime to Node.js to avoid environment drift in framework defaults.
- Moved critical polyfill setup to startup instrumentation so Turbopack external module loading cannot race ahead of converter-level initialization.

---

#### Next steps

- Re-run upload + extraction flow in the active dev server to confirm `convertPDFToImages()` executes and pages render without `DOMMatrix` errors.
- If any remaining pdfjs runtime warnings persist, add targeted debug logging around polyfill presence during converter init and remove after verification.
- Once stable, run full `npm run lint` and `npm run type-check` as a final regression check.

---

### Session: January 13, 2026 (Session 15)

**Focus:** Webhook Payload Implementation for Quote Submission

---

#### Summary

Implemented the webhook payload structure for sending quote data to an external RPA system when users click "Submit Quote". The payload transforms validated quote data into a clean, structured JSON format suitable for RPA consumption.

---

#### Files Created

| File | Description |
|------|-------------|
| `/src/types/webhook.ts` | TypeScript types for webhook payload structure |
| `/src/lib/webhook/transform.ts` | Transform functions to convert quote data to webhook format |
| `/src/lib/webhook/index.ts` | Export module for webhook utilities |
| `/docs/examples/webhook-payload-example.json` | Example JSON payload using Smith Family test data |

---

#### Files Updated

| File | Changes |
|------|---------|
| `/src/app/api/quotes/submit/route.ts` | Added webhook payload transformation and preparation |

---

#### Webhook Payload Structure

The webhook payload includes:

**1. Metadata**
```typescript
{
  quoteId: string,
  extractionId: string,
  userId: string,
  filename: string,
  submittedAt: string,  // ISO 8601
  quoteType: 'home' | 'auto' | 'both',
  version: '1.0.0'
}
```

**2. Personal Information**
- First/last name, DOB, SSN, phone, email
- Spouse information (if applicable)
- Address with prior address support

**3. Home Insurance Data** (if applicable)
- Property details (year built, sq ft, construction, roof, etc.)
- Occupancy information
- Safety features
- Coverage amounts
- Scheduled items (jewelry, valuables)
- Insurance/lienholder details

**4. Auto Insurance Data** (if applicable)
- Drivers array (primary, spouse, additional)
- Vehicles array with deductibles and lienholders
- Coverage limits
- Prior insurance
- Incidents/tickets

---

#### Example Usage

When a quote is submitted, the API now:
1. Validates and stores the quote in the database
2. Transforms the quote data to webhook format
3. Prepares the webhook payload (logs it for now)
4. Returns the payload in the response for verification

**To enable actual webhook sending:**
Add `WEBHOOK_URL` environment variable and uncomment the fetch logic in `/src/lib/webhook/transform.ts`.

---

#### Example Webhook JSON Location

See `/docs/examples/webhook-payload-example.json` for a complete example using the Smith Family test record data (Home & Auto combined quote).

---

#### Type Validation

All TypeScript type checks pass: `npm run type-check`

---

---

### Session: January 13, 2026 (Session 14)

**Focus:** Fix Confirmation Page "Not Provided" Bug - Save Before Navigation

---

#### Problem

On the quote confirmation page (`/review/[id]/quote`), all fields displayed "Not provided" even though values were entered on the previous edit page. The counter showed "24 of 43 fields complete" but all field values appeared empty.

---

#### Root Cause Analysis

**Race condition between auto-save and navigation:**

1. **Edit page** - User edits fields, auto-save has **1500ms debounce** before saving to DB
2. **User clicks "Proceed to Quote"** - Navigation happens immediately via `<Link>` component
3. **Confirmation page** - Server component fetches data fresh from database
4. **Result:** Database fetch happens before auto-save completes → stale data with "Not provided"

**Contributing factors:**
- Auto-save debounce delay of 1500ms (`HomeExtractionForm.tsx:117`)
- Quote page had no `export const dynamic = 'force-dynamic'` (Next.js could cache)
- No mechanism to wait for save before navigation

---

#### Solution Implemented

**1. Force dynamic rendering on quote page**

Added `export const dynamic = 'force-dynamic'` to prevent Next.js from serving cached data.

**File:** `/src/app/(protected)/review/[id]/quote/page.tsx`

**2. Exposed save function from ExtractionReview via ref**

Used React's `forwardRef` and `useImperativeHandle` to expose a `saveBeforeNavigation()` method that parent components can call.

**Files Updated:**
- `/src/components/extraction/ExtractionReview.tsx` - Added `forwardRef`, `useImperativeHandle`
- `/src/components/extraction/index.ts` - Exported `ExtractionReviewHandle` type

**New Interface:**
```typescript
export interface ExtractionReviewHandle {
  saveBeforeNavigation: () => Promise<boolean>
}
```

**3. Updated navigation to wait for save**

Changed the "Proceed to Quote" button from a `<Link>` to a `<Button>` with programmatic navigation that waits for save to complete.

**File:** `/src/app/(protected)/review/[id]/review-page-client.tsx`

**Changes:**
- Added `useRouter` for programmatic navigation
- Added `useRef<ExtractionReviewHandle>` to get save function
- Added loading state while saving (`isNavigating`)
- Button shows "Saving..." spinner during save
- Shows toast error if save fails
- Only navigates after successful save

---

#### Files Updated

| File | Changes |
|------|---------|
| `/src/app/(protected)/review/[id]/quote/page.tsx` | Added `export const dynamic = 'force-dynamic'` |
| `/src/components/extraction/ExtractionReview.tsx` | Added `forwardRef`, `useImperativeHandle` with `saveBeforeNavigation()` |
| `/src/components/extraction/index.ts` | Exported `ExtractionReviewHandle` type |
| `/src/app/(protected)/review/[id]/review-page-client.tsx` | Changed from `<Link>` to programmatic navigation with save-before-navigate |

---

#### Technical Details

**ExtractionReview imperative handle:**
```typescript
useImperativeHandle(ref, () => ({
  saveBeforeNavigation: async (): Promise<boolean> => {
    try {
      if (quoteType === 'home') {
        await handleSaveHome(homeData)
      } else if (quoteType === 'auto') {
        await handleSaveAuto(autoData)
      } else if (quoteType === 'both') {
        await handleSaveCombined('home', homeData)
        await handleSaveCombined('auto', autoData)
      }
      return true
    } catch (error) {
      console.error('[ExtractionReview] saveBeforeNavigation failed:', error)
      return false
    }
  },
}), [quoteType, homeData, autoData, handleSaveHome, handleSaveAuto, handleSaveCombined])
```

**ReviewPageClient navigation handler:**
```typescript
const handleProceedToQuote = useCallback(async () => {
  setIsNavigating(true)
  try {
    if (extractionReviewRef.current) {
      const saveSuccess = await extractionReviewRef.current.saveBeforeNavigation()
      if (!saveSuccess) {
        toast.error('Failed to save changes. Please try again.')
        setIsNavigating(false)
        return
      }
    }
    router.push(quoteUrl)
  } catch (error) {
    toast.error('An error occurred. Please try again.')
    setIsNavigating(false)
  }
}, [quoteUrl, router])
```

---

#### User Experience Improvement

**Before:**
- Click "Proceed to Quote" → Immediate navigation → All fields show "Not provided"

**After:**
- Click "Proceed to Quote" → Button shows "Saving..." spinner → Wait for save → Navigate → All fields display correctly

---

#### Type Validation

All TypeScript type checks pass: `npm run type-check`

Production build succeeds: `npm run build`

---

#### Verification

Fix was verified working via debug logging. Console output confirmed:
- `[QuotePreviewClient] first required field: {key: 'personal.firstName', label: 'First Name', value: 'Nicholas', status: 'valid', confidence: 'high', …}`
- `[QuotePreviewClient] completedRequired: 46`

All field values now display correctly on the confirmation page after the save-before-navigation fix.

---

#### Why Counter Showed "24 of 43 Complete" Before Fix

The counter appeared to work while fields showed "Not provided" because:
1. **Counter logic** (`FieldSection` line 179): `fields.filter(f => f.status === 'valid').length`
2. **Optional fields with no value** get `status: 'valid'` (per `determineFieldStatus` in validation.ts)
3. **Display logic** (`FieldDisplay` line 109): `field.value !== null && field.value !== ''`

So optional empty fields counted as "complete" but displayed as "Not provided". Once the actual data was saved before navigation, both counter and display showed correct values.

---

---

### Session: January 13, 2026 (Session 13)

**Focus:** Auto-Save Functionality for Extraction Review Forms

---

#### Summary

Implemented auto-save functionality for both Home and Auto extraction review forms. Changes are now automatically saved with a 1.5-second debounce after the user stops typing, eliminating the need for manual save actions while still providing a "Save Now" button for immediate saves.

---

#### Files Created

| File | Description |
|------|-------------|
| `/src/hooks/use-auto-save.ts` | Custom hook for debounced auto-save with status tracking |
| `/src/components/extraction/AutoSaveIndicator.tsx` | Visual feedback component showing save status |

---

#### Files Updated

| File | Changes |
|------|---------|
| `/src/components/extraction/HomeExtractionForm.tsx` | Integrated auto-save hook, replaced manual save with debounced auto-save |
| `/src/components/extraction/AutoExtractionForm.tsx` | Integrated auto-save hook, replaced manual save with debounced auto-save |
| `/src/hooks/index.ts` | Exported new auto-save hook |

---

#### Features

**useAutoSave Hook:**
- Debounces saves (configurable, default 1500ms)
- Detects actual data changes via JSON comparison
- Handles race conditions (data changes during save)
- Tracks status: `idle`, `pending`, `saving`, `saved`, `error`
- Provides `saveNow()` for immediate saves
- Handles component unmount gracefully
- Shows toast notifications on save success/error

**AutoSaveIndicator Component:**
- Shows "Unsaved changes" when pending
- Shows "Saving..." with spinner during save
- Shows "Saved" with checkmark on success
- Shows "Failed to save" with retry option on error
- Displays relative time ("Saved 2 minutes ago") when idle

**UI Changes:**
- Removed prominent "Save Changes" button (auto-save handles it)
- Added subtle "Save Now" button that appears only when there are pending changes
- Added auto-save status indicator in both header and footer of forms

---

#### Technical Notes

- Auto-save uses JSON serialization for change detection (configurable via `isEqual` option)
- The hook supports custom equality comparisons for complex data types
- Race condition handling ensures latest data is always saved even if user continues editing during save
- `forceSave` alias provided for `saveNow` for semantic clarity

---

### Session: January 13, 2026 (Session 12)

**Focus:** Backend - Restructure Auto Extraction to Embed Deductibles in Vehicles

---

#### Summary

Completed the backend restructuring to move deductibles FROM a separate array INTO the vehicle object. This eliminates the vehicleReference field (which was error-prone for linking deductibles to vehicles) and simplifies the data model by keeping all per-vehicle information together.

---

#### Architectural Change

**Before (Old Structure):**
```typescript
interface AutoApiExtractionResult {
  vehicles: AutoVehicle[]           // Basic vehicle info only
  deductibles: AutoVehicleDeductible[]  // Separate array with vehicleReference field
}
```

**After (New Structure):**
```typescript
interface AutoApiExtractionResult {
  vehicles: AutoVehicle[]           // Vehicle info + deductibles combined
  // deductibles array REMOVED
}

interface AutoVehicle {
  // Vehicle identification
  year, make, model, vin, mileage, usage, ownership
  // Deductibles (per-vehicle) - NEW
  comprehensiveDeductible, collisionDeductible, roadTroubleService,
  limitedTNCCoverage, additionalExpenseCoverage
}
```

---

#### Files Updated

| File | Changes |
|------|---------|
| `/src/types/extraction.ts` | Added deductible fields to `AutoVehicle`, marked `AutoVehicleDeductible` as deprecated, removed `deductibles` from `AutoApiExtractionResult`, updated field labels |
| `/src/types/auto-extraction.ts` | Updated `AUTO_VEHICLE_FIELDS` with deductible configs, removed deductibles section from `AUTO_SECTIONS`, updated `createEmptyAutoVehicle()`, marked `createEmptyAutoDeductible()` deprecated |
| `/src/lib/openrouter/prompts.ts` | Updated `AUTO_EXTRACTION_PROMPT` to include deductibles in vehicle section |
| `/src/lib/openrouter/schemas.ts` | Updated `AutoVehicleSchema` with deductible fields, marked `AutoVehicleDeductibleSchema` deprecated, removed deductibles from `AutoApiExtractionResultSchema` |
| `/src/lib/openrouter/client.ts` | Removed `AutoVehicleDeductible` import, updated `createDefaultAutoApiExtractionResult()`, renamed deduplication function to `isLienholderDuplicate()`, removed deductibles merge section |
| `/src/lib/openrouter/defaults.ts` | Removed `deductibles: []` from default result |
| `/src/lib/openrouter/merge.ts` | Removed `AutoVehicleDeductible` import, renamed function, removed deductibles merge section |
| `/src/lib/extraction/transform.ts` | Updated vehicle transformation to include deductible fields, removed deductibles transformation section, updated documentation |
| `/src/app/api/extract/route.ts` | Removed `deductibles` from combined extraction result |
| `/scripts/test-auto-transform.ts` | Updated test data to embed deductibles in vehicles, updated test assertions |

---

#### TypeScript Build Status

All TypeScript compilation passes. Run `npm run type-check` to verify.

---

#### Breaking Change Notes

- Old extraction data with separate `deductibles` arrays will need migration
- The `AutoVehicleDeductible` interface and `createEmptyAutoDeductible()` function are deprecated but kept for backward compatibility
- Quote validation types (`AutoQuoteData.deductibles`) remain unchanged as they serve a different purpose (carrier-specific output format)

---

---

### Session: January 13, 2026 (Session 11)

**Focus:** Auto Form UI - Move Deductibles Into Vehicle Cards

---

#### Summary

Restructured the Auto extraction form UI to display deductibles within each vehicle card instead of as a separate section. This aligns with the backend change where deductibles are now part of the `AutoVehicle` interface.

---

#### Changes Made

**1. Updated `/src/components/extraction/AutoExtractionForm.tsx`**

- Removed separate "Deductibles by Vehicle" section
- Each vehicle card now displays:
  - Vehicle info fields (year, make, model, VIN, mileage, usage, ownership)
  - A "Coverage" subsection with deductible fields (comprehensive, collision, road trouble, TNC coverage, additional expense)
- Updated `handleVehicleFieldChange` to handle boolean field (`limitedTNCCoverage`)
- Removed deductible-related handlers (`handleAddDeductible`, `handleRemoveDeductible`, `handleDeductibleFieldChange`)
- Removed unused imports (`AutoVehicleDeductible`, `AUTO_DEDUCTIBLE_FIELDS`, `createEmptyAutoDeductible`, `CreditCard` icon)
- Updated vehicle section stats calculation
- Updated form stats to no longer reference `data.deductibles` array

**2. Updated `/src/types/auto-extraction.ts`** (already updated by backend)

- `AutoExtractionResult` no longer has `deductibles` array
- `AUTO_VEHICLE_FIELDS` now includes deductible fields
- `createEmptyAutoVehicle()` now includes deductible fields
- `AUTO_SECTIONS` no longer has deductibles section

---

#### Visual Layout (Per Vehicle Card)

```
Vehicle 1 (2023 Toyota Camry)
+-- Year: [2023]
+-- Make: [Toyota]
+-- Model: [Camry]
+-- VIN: [1HGBH41JXMN109186]
+-- Est. Annual Mileage: [12000]
+-- Vehicle Usage: [Commute]
+-- Ownership: [Owned]
+-- ~~~ Coverage ~~~
+-- Comprehensive Deductible: [$500]
+-- Collision Deductible: [$500]
+-- Road Trouble Service: [None]
+-- Limited TNC Coverage: [No]
+-- Additional Expense Coverage: [None]
```

---

#### Files Updated

| File | Changes |
|------|---------|
| `/src/components/extraction/AutoExtractionForm.tsx` | Moved deductibles into vehicle cards, removed separate deductibles section |
| `/src/types/auto-extraction.ts` | (backend already updated) Deductibles now part of vehicles |

---

---

### Session: January 13, 2026 (Session 10)

**Focus:** Fix "Home & Auto" Combined Extraction - Auto-Specific Personal Fields Missing

---

#### Problem Identified

When user selects "Home & Auto" (both) quote type, the Auto-specific personal fields were being lost during extraction and data transformation.

**Root Cause:** The `CombinedExtractionData` type was designed to share personal info between Home and Auto, but Auto has many personal fields that Home doesn't need:

- `effectiveDate` (policy effective date)
- `maritalStatus`
- `garagingAddressSameAsMailing`, `garagingStreetAddress`, `garagingCity`, `garagingState`, `garagingZipCode`
- `ownerDriversLicense`, `ownerLicenseState`
- `spouseDriversLicense`, `spouseLicenseState`
- `ownerOccupation`, `spouseOccupation`
- `ownerEducation`, `spouseEducation`
- `rideShare`, `delivery`

The extraction API was extracting these correctly from Auto, but then discarding them when creating the combined result because the `CombinedExtractionData.auto` property was typed as `Omit<AutoApiExtractionResult, 'personal'>`, which excluded the entire personal section.

---

#### Solution Implemented

**1. Created New Type: `AutoSpecificPersonalInfo`**

Added a new interface in `/src/types/extraction.ts` to capture Auto-specific personal fields that aren't shared with Home:

```typescript
export interface AutoSpecificPersonalInfo {
  effectiveDate: ExtractionField;
  maritalStatus: ExtractionField;
  garagingAddressSameAsMailing: ExtractionBooleanField;
  garagingStreetAddress: ExtractionField;
  garagingCity: ExtractionField;
  garagingState: ExtractionField;
  garagingZipCode: ExtractionField;
  ownerDriversLicense: ExtractionField;
  ownerLicenseState: ExtractionField;
  spouseDriversLicense: ExtractionField;
  spouseLicenseState: ExtractionField;
  ownerOccupation: ExtractionField;
  spouseOccupation: ExtractionField;
  ownerEducation: ExtractionField;
  spouseEducation: ExtractionField;
  rideShare: ExtractionBooleanField;
  delivery: ExtractionBooleanField;
}
```

**2. Updated `CombinedExtractionData` Interface**

Added the `autoPersonal` property to the combined data structure:

```typescript
export interface CombinedExtractionData {
  shared: SharedPersonalInfo;
  autoPersonal: AutoSpecificPersonalInfo;  // NEW
  home: Omit<HomeApiExtractionResult, 'personal'> | null;
  auto: Omit<AutoApiExtractionResult, 'personal'> | null;
  quoteType: 'home' | 'auto' | 'both';
}
```

**3. Updated API Route**

Modified `/src/app/api/extract/route.ts` to populate `autoPersonal` from the Auto extraction result:

```typescript
case 'both':
  const [homeResult, autoResult] = await Promise.all([...])

  extractedData = {
    shared: { /* shared fields from homeResult */ },
    autoPersonal: {
      effectiveDate: autoResult.personal.effectiveDate,
      maritalStatus: autoResult.personal.maritalStatus,
      // ... all 17 Auto-specific fields
    },
    home: { /* home-specific sections */ },
    auto: { /* auto-specific sections (excluding personal) */ },
    quoteType: 'both',
  }
```

**4. Updated Data Transformation**

Modified `/src/lib/extraction/transform.ts` in `getAutoExtractionData()` to use `autoPersonal` when reconstructing Auto data from combined format:

```typescript
case 'both':
  const combined = data as CombinedExtractionData
  const autoPersonal = combined.autoPersonal || {}

  return autoApiToUiExtraction({
    personal: {
      // Shared fields from combined.shared
      ownerFirstName: combined.shared.ownerFirstName,
      // ...
      // Auto-specific fields from autoPersonal (with fallback for backward compatibility)
      effectiveDate: autoPersonal?.effectiveDate || createEmptyAutoField(),
      maritalStatus: autoPersonal?.maritalStatus || createEmptyAutoField(),
      // ...
    },
    // ... rest of auto data
  })
```

---

#### Files Updated

| File | Changes |
|------|---------|
| `/src/types/extraction.ts` | Added `AutoSpecificPersonalInfo` interface, updated `CombinedExtractionData` |
| `/src/types/index.ts` | Added export for `AutoSpecificPersonalInfo` |
| `/src/app/api/extract/route.ts` | Populated `autoPersonal` in combined extraction |
| `/src/lib/extraction/transform.ts` | Use `autoPersonal` when reconstructing Auto data |

---

#### Backward Compatibility

The transform function includes fallback logic (`autoPersonal?.field || createEmptyAutoField()`) to handle older combined extractions that don't have the `autoPersonal` property. These older extractions will show empty defaults for the Auto-specific personal fields, but the UI will still render correctly.

---

#### Type Validation

All TypeScript type checks pass: `npm run type-check`

Production build succeeds: `npm run build`

---

---

### Session: January 13, 2026 (Session 9)

**Focus:** Fix "Home & Auto" Quote Type - Auto Fields Not Showing on Review Page

---

#### Problem Identified

When user selects "Home & Auto" on the upload page and proceeds to the review page, only Home fields were showing - Auto fields were missing.

**Root Cause:** The `insurance_type` from the database was NOT being passed through to the review page components:

1. `ReviewPage` (server component) fetched `extraction.insurance_type` but didn't pass it
2. `ReviewPageClient` didn't receive or use the insurance type
3. `ExtractionReview` tried to detect the quote type from data structure instead of using the stored value
4. A redundant `QuoteTypeSelector` was shown on the review page (user already selected type at upload)

---

#### Solution Implemented

**1. Pass `insurance_type` from Server to Client**

Updated `/src/app/(protected)/review/[id]/page.tsx`:
- Now passes `insuranceType={extraction.insurance_type || 'home'}` to `ReviewPageClient`

**2. Updated ReviewPageClient**

Updated `/src/app/(protected)/review/[id]/review-page-client.tsx`:
- Added `insuranceType: InsuranceType` to props interface
- Added `insuranceTypeToQuoteType()` helper function to map InsuranceType -> QuoteType
- Removed `useState` and `useCallback` for quote type selection (no longer needed)
- Passes `quoteType` prop to `ExtractionReview`
- Removed disabled state on "Proceed to Quote" button (always enabled now)

**3. Simplified ExtractionReview**

Updated `/src/components/extraction/ExtractionReview.tsx`:
- Changed `quoteType` from internal state to required prop
- Removed `onQuoteTypeChange` callback prop (no longer needed)
- Removed `QuoteTypeSelector` component from render
- Removed auto-detection logic (`detectExtractionType`, `suggestQuoteType`)
- Removed unused imports (`useMemo`, detection functions)
- Now directly uses the `quoteType` prop to determine which form(s) to render

---

#### Files Updated

| File | Changes |
|------|---------|
| `/src/app/(protected)/review/[id]/page.tsx` | Pass `insuranceType` to `ReviewPageClient` |
| `/src/app/(protected)/review/[id]/review-page-client.tsx` | Accept `insuranceType` prop, convert to `quoteType`, pass to `ExtractionReview`, remove state management |
| `/src/components/extraction/ExtractionReview.tsx` | Accept `quoteType` as required prop, remove `QuoteTypeSelector`, remove detection logic |

---

#### Expected Behavior (Now Fixed)

**Upload Page:**
1. User selects file
2. User selects insurance type: Home, Auto, or Home & Auto (stored as 'home', 'auto', 'both')
3. User clicks "Upload & Extract"
4. System extracts data based on selected type

**Review Page:**
1. No quote type selector shown (already decided at upload)
2. For 'home': Shows `HomeExtractionForm` only
3. For 'auto': Shows `AutoExtractionForm` only
4. For 'both': Shows tabbed interface with Home and Auto tabs
5. "Proceed to Quote" button always enabled

---

#### Type Validation

All TypeScript type checks pass: `npm run type-check`

---

---

### Session: January 13, 2026 (Session 8)

**Focus:** Next.js App Router Architecture Fixes - Loading States, Error Boundaries, and Server/Client Boundary Verification

---

#### Summary of All Changes

This session addressed Next.js App Router best practices including proper loading states, error boundaries, and verified server/client component separation.

---

#### 1. Server/Client Boundary Audit (Issue #18)

**Audited Files:**
- `/src/app/(protected)/review/[id]/page.tsx` - Server Component (correctly handles data fetching)
- `/src/app/(protected)/review/[id]/review-page-client.tsx` - Client Component (correctly marked with 'use client')
- `/src/app/(protected)/review/[id]/quote/page.tsx` - Server Component (correctly handles data fetching)
- `/src/app/(protected)/review/[id]/quote/QuotePreviewClient.tsx` - Client Component (correctly marked with 'use client')

**Result:** Server/client boundary is properly implemented. Server components handle data fetching, client components handle interactivity with hooks (useState, useCallback, etc.).

---

#### 2. Loading.tsx Files Created (Issue #74)

Created route-level loading states with skeleton UI matching page layouts:

| File | Purpose |
|------|---------|
| `/src/app/(protected)/dashboard/loading.tsx` | Stats cards + extraction cards skeleton grid |
| `/src/app/(protected)/upload/loading.tsx` | Upload zone + feature cards skeleton |
| `/src/app/(protected)/review/[id]/loading.tsx` | Header + quote type selector + form sections skeleton |
| `/src/app/(protected)/review/[id]/quote/loading.tsx` | Quote preview header + validation summary + field sections skeleton |

**Features:**
- All loading states use the existing `Skeleton` component from shadcn/ui
- Layouts match the actual page structures for smooth transitions
- Consistent styling with `bg-muted/30` backgrounds
- Responsive grid layouts matching actual pages

---

#### 3. Error.tsx Files Created (Issue #74)

Created route-level error boundaries with user-friendly error UI:

| File | Purpose |
|------|---------|
| `/src/app/(protected)/dashboard/error.tsx` | Dashboard error with retry + home navigation |
| `/src/app/(protected)/upload/error.tsx` | Upload error with retry + back to dashboard |
| `/src/app/(protected)/review/[id]/error.tsx` | Review error with retry + back to dashboard |
| `/src/app/(protected)/review/[id]/quote/error.tsx` | Quote error with retry + back to review |

**Features:**
- All error components marked with 'use client' (required by Next.js)
- Error logging via `useEffect` for monitoring integration
- Displays error digest ID when available
- "Try Again" button calls `reset()` to retry
- Contextual back navigation based on route
- Red-themed warning cards with AlertTriangle icon
- Dark mode support

---

#### 4. Middleware Protection Verification

**Reviewed Files:**
- `/src/middleware.ts` - Routes through `updateSession()`
- `/src/lib/supabase/middleware.ts` - Authentication logic

**Architecture:**
- Page routes redirect unauthenticated users to `/login`
- API routes are intentionally excluded from middleware redirects
- API routes handle auth internally with `supabase.auth.getUser()` returning 401 status codes

**Verified API Routes:**
| Route | Auth Check |
|-------|------------|
| `/api/upload/route.ts` | `supabase.auth.getUser()` - Returns 401 if not authenticated |
| `/api/extract/route.ts` | `supabase.auth.getUser()` - Returns 401 if not authenticated |
| `/api/extractions/[id]/route.ts` | `supabase.auth.getUser()` - Returns 401 if not authenticated |
| `/api/quotes/submit/route.ts` | `supabase.auth.getUser()` - Returns 401 if not authenticated |
| `/api/quotes/validate/route.ts` | `supabase.auth.getUser()` - Returns 401 if not authenticated |

**Result:** All API routes properly protected. The middleware architecture is correct - page routes redirect, API routes return 401 status codes for proper REST behavior.

---

#### Files Created This Session

| File | Purpose |
|------|---------|
| `/src/app/(protected)/dashboard/loading.tsx` | Dashboard loading skeleton |
| `/src/app/(protected)/dashboard/error.tsx` | Dashboard error boundary |
| `/src/app/(protected)/upload/loading.tsx` | Upload page loading skeleton |
| `/src/app/(protected)/upload/error.tsx` | Upload page error boundary |
| `/src/app/(protected)/review/[id]/loading.tsx` | Review page loading skeleton |
| `/src/app/(protected)/review/[id]/error.tsx` | Review page error boundary |
| `/src/app/(protected)/review/[id]/quote/loading.tsx` | Quote preview loading skeleton |
| `/src/app/(protected)/review/[id]/quote/error.tsx` | Quote preview error boundary |

---

#### Key Improvements

1. **Better UX during navigation** - Users now see skeleton loading states instead of blank screens
2. **Graceful error handling** - Errors are caught and displayed with recovery options
3. **Verified architecture** - Server/client boundaries confirmed to be properly implemented
4. **Security verification** - All API routes confirmed to have authentication checks

---

#### Pre-existing Issues Noted

The build process revealed some pre-existing issues unrelated to this session:
- Case sensitivity issues with component imports (e.g., `./form-section` vs `./FormSection`)
- These are in the extraction components and existed before this session

---

---

### Session: January 13, 2026 (Session 7)

**Focus:** Carrier Field Mapping, Insurance Type Selection, Quote Preview Data Flow Fix

---

#### Summary of All Changes

This session involved comprehensive validation of carrier requirements against the existing implementation, fixing multiple data flow issues, and improving the overall UX.

---

#### 1. Carrier Requirements Cross-Reference

**Analyzed quote-fields documents:**
- `quote-fields/Home_owners.pdf` - Safeco, Auto-Owners, Cincinnati Insurance fields
- `quote-fields/Auto_owners.pdf` - Auto insurance required fields

**Gap analysis performed** to identify missing fields for carrier compliance.

---

#### 2. Home Extraction Type Updates

**File:** `/src/types/home-extraction.ts`

**New Personal Fields:**
| Field | Type | Required |
|-------|------|----------|
| `maritalStatus` | Select | Yes |
| `coApplicantPresent` | Select | Yes |
| `occupation` | Text | No |

**New Property Fields:**
| Field | Type | Required |
|-------|------|----------|
| `bedroomCount` | Select | Yes |
| `dwellingType` | Select | Yes |
| `constructionStyle` | Select | Yes |
| `constructionQuality` | Select | No |
| `homeUnderConstruction` | Select | No |
| `roofShape` | Select | No |
| `distanceToFireDepartment` | Select | No |
| `waterSupplyType` | Select | No |

**New Occupancy Section (HomeExtractionOccupancy):**
| Field | Type | Required |
|-------|------|----------|
| `dwellingOccupancy` | Select | Yes |
| `businessOnPremises` | Select | No |
| `shortTermRental` | Select | No |
| `daysRentedToOthers` | Select | No (conditional) |
| `horsesOrLivestock` | Select | No |
| `numberOfFamilies` | Select | No |

**New Safety & Risk Fields:**
| Field | Type |
|-------|------|
| `windMitigation` | Select |
| `stormShutters` | Select |
| `impactGlass` | Select |

**New Insurance Details Fields:**
| Field | Type | Required |
|-------|------|----------|
| `propertySameAsMailing` | Select | No |
| `reasonForPolicy` | Select | No |
| `currentlyInsured` | Select | Yes |
| `maintenanceCondition` | Select | No |
| `numberOfLosses5Years` | Select | No |
| `effectiveDate` | Date | Yes |

**New Updates Fields:**
| Field | Type |
|-------|------|
| `wiringUpdate` | Select |
| `wiringYear` | Number |

---

#### 3. Auto Extraction Type Updates

**Files:** `/src/types/extraction.ts`, `/src/types/auto-extraction.ts`

**New Personal Fields:**
| Field | Type | Required |
|-------|------|----------|
| `maritalStatus` | Select | Yes |
| `effectiveDate` | Date | Yes |
| `garagingAddressSameAsMailing` | Boolean | Yes |
| `garagingStreetAddress` | Text | No (conditional) |
| `garagingCity` | Text | No (conditional) |
| `garagingState` | Select | No (conditional) |
| `garagingZipCode` | Text | No (conditional) |

**New Coverage Fields:**
| Field | Type |
|-------|------|
| `offRoadVehicleLiability` | Boolean |

**New Deductible Fields (per vehicle):**
| Field | Type |
|-------|------|
| `roadTroubleService` | Select |
| `limitedTNCCoverage` | Boolean |
| `additionalExpenseCoverage` | Select |

---

#### 4. Required Field Updates

**Home Fields Marked Required:**
- `constructionStyle`
- `bathroomCount`
- `effectiveDate` (insurance details)

**Auto Fields Marked Required:**
- `comprehensiveDeductible`
- `collisionDeductible`

---

#### 5. AUTO_EXTRACTION_PROMPT Fix (Critical)

**File:** `/src/lib/openrouter/prompts.ts`

**Problem:** New fields were added to type interfaces but NOT to the Claude extraction prompt, causing them to never be extracted.

**Fields Added to Prompt:**

Personal section:
- `maritalStatus`
- `garagingAddressSameAsMailing`
- `garagingStreetAddress`, `garagingCity`, `garagingState`, `garagingZipCode`
- `effectiveDate`

Coverage section:
- `offRoadVehicleLiability`

Deductibles section:
- `roadTroubleService`
- `limitedTNCCoverage`
- `additionalExpenseCoverage`

---

#### 6. Insurance Type Selector (Critical Fix)

**Problem:** Upload flow was NOT passing `insuranceType` to the extract API. All extractions defaulted to 'home'.

**Files Updated:**

| File | Change |
|------|--------|
| `/src/hooks/use-upload.ts` | Added `insuranceType` parameter to `upload()` function |
| `/src/components/pdf/pdf-upload-zone.tsx` | Added insurance type toggle (Home/Auto/Both) |

**New Upload Flow:**
```
User selects file → User selects insurance type → Upload & Extract
                              ↓
              API receives { extractionId, insuranceType: 'auto' }
                              ↓
              Correct extraction function called
```

**UI Design:**
- Three-button toggle group with icons (Home, Car, Home+Car)
- Default selection: Home
- Active state: white background with shadow
- Displays when file is selected, before "Upload & Extract" button

---

#### 7. Category Name Mismatch Fix

**Problem:** Field definitions used category names like `'Personal Information'` but `categoryConfig` in QuotePreviewClient used lowercase keys like `'personal'`.

**File:** `/src/app/(protected)/review/[id]/quote/QuotePreviewClient.tsx`

**Solution:** Updated `categoryConfig` to use full category names:

```typescript
const categoryConfig = {
  // Home categories
  'Personal Information': { icon: User, label: 'Personal Information', order: 1 },
  'Property Information': { icon: Home, label: 'Property Information', order: 2 },
  'Occupancy Information': { icon: Home, label: 'Occupancy & Use', order: 3 },
  'Safety Information': { icon: Shield, label: 'Safety & Risk', order: 4 },
  'Coverage Information': { icon: Shield, label: 'Coverage Details', order: 5 },
  // ... Auto categories
  'Vehicle Information': { icon: Car, label: 'Vehicle Information', order: 10 },
  'Driver Information': { icon: Users, label: 'Driver Information', order: 11 },
  // ... Legacy lowercase keys for backward compatibility
}
```

---

#### 8. Required Fields Alert Component

**File Created:** `/src/components/quote/RequiredFieldsAlert.tsx`

**Features:**
- Amber warning banner when required fields are missing
- Lists missing fields grouped by category
- Clickable field names to edit directly
- "Go back to edit" button
- Dark mode support

**Integration:** Added to QuotePreviewClient with `missingRequiredFields` computed value.

---

#### 9. Quote Page Data Transformation (Critical Fix)

**Problem:** Quote preview page received raw API-format data but validation expected UI-format data.

| API Format (stored in DB) | UI Format (expected) |
|---------------------------|---------------------|
| `personal.streetAddress` | `personal.address` |
| `personal.dateOfBirth` | `personal.applicantDOB` |
| `safety.*` | `safetyRisk.*` |
| `lienholder.*` | `insuranceDetails.*` |
| `claims.*` | `claimsHistory.*` |

**File:** `/src/app/(protected)/review/[id]/quote/page.tsx`

**Solution:** Transform data before passing to QuotePreviewClient:

```typescript
import { getHomeExtractionData, getAutoExtractionData } from '@/lib/extraction/transform'

let transformedData = rawExtractedData
if (quoteType === 'home') {
  transformedData = getHomeExtractionData(rawExtractedData) || rawExtractedData
} else if (quoteType === 'auto') {
  transformedData = getAutoExtractionData(rawExtractedData) || rawExtractedData
} else if (quoteType === 'both') {
  // Transform both home and auto parts
}
```

---

#### 10. Validation.ts Field Mapping Updates

**File:** `/src/lib/quote/validation.ts`

**Changes:**
- Dynamic field definition generation from actual field configs
- Proper handling of array fields (vehicles, drivers, deductibles, etc.)
- Correct extraction paths matching UI type structure
- Export of `FieldDefinition` type and getter functions

---

#### Files Created This Session

| File | Purpose |
|------|---------|
| `/src/components/quote/RequiredFieldsAlert.tsx` | Warning alert for missing required fields |
| `/src/components/ui/alert.tsx` | shadcn Alert component |

---

#### Files Updated This Session

| File | Changes |
|------|---------|
| `/src/types/home-extraction.ts` | 25+ new carrier fields, occupancy section, conditional logic |
| `/src/types/extraction.ts` | Auto personal, coverage, deductible new fields |
| `/src/types/auto-extraction.ts` | Field configs, helper functions updated |
| `/src/lib/openrouter/prompts.ts` | AUTO_EXTRACTION_PROMPT with missing fields |
| `/src/lib/extraction/transform.ts` | Transform function updates |
| `/src/lib/openrouter/client.ts` | Default factory functions updated |
| `/src/lib/quote/validation.ts` | Comprehensive field mapping overhaul |
| `/src/hooks/use-upload.ts` | Added insuranceType parameter |
| `/src/components/pdf/pdf-upload-zone.tsx` | Insurance type selector UI |
| `/src/components/extraction/home-extraction-form.tsx` | Occupancy section, conditional fields |
| `/src/components/extraction/auto-extraction-form.tsx` | New fields, conditional rendering |
| `/src/components/extraction/field-editor.tsx` | Checkbox input type |
| `/src/app/(protected)/review/[id]/quote/page.tsx` | Data transformation before display |
| `/src/app/(protected)/review/[id]/quote/QuotePreviewClient.tsx` | Category config, RequiredFieldsAlert |
| `/src/components/quote/RequiredFieldsAlert.tsx` | Category ordering update |
| `/src/components/quote/index.ts` | Export RequiredFieldsAlert |

---

#### Key Bugs Fixed

1. **Auto extraction never ran** - `insuranceType` not passed to extract API (defaulted to 'home')
2. **All fields showed "Not provided"** - Raw API data passed to quote preview instead of transformed UI data
3. **Fields in wrong category** - Category name case mismatch (Personal vs personal)
4. **New fields not extracted** - AUTO_EXTRACTION_PROMPT missing new field instructions
5. **Missing required field validation** - No UI warning for incomplete required fields

---

#### Type Validation

All TypeScript type checks pass: `npm run type-check`

---

---

### Session: January 13, 2026 (Session 6)

**Focus:** Fix API-to-UI Data Format Transformation in Quote Page

#### What Was Done:

**1. Fixed Data Format Mismatch in Quote Page**

The quote preview page was receiving raw API-format data (`HomeApiExtractionResult`, `AutoApiExtractionResult`) from the database, but the validation logic expected UI-format data (`HomeExtractionResult`, `AutoExtractionResult`).

**Problem:**
- Database stores API format with field paths like `personal.streetAddress`, `personal.dateOfBirth`
- Validation expects UI format with paths like `personal.address`, `personal.applicantDOB`
- This caused validation to fail and fields to not display correctly

**Solution:**
Updated `/src/app/(protected)/review/[id]/quote/page.tsx` to transform data before passing to `QuotePreviewClient`:

1. **Added imports** for transform functions:
   - `getHomeExtractionData` - Transforms any format to `HomeExtractionResult`
   - `getAutoExtractionData` - Transforms any format to `AutoExtractionResult`
   - `detectExtractionType` - Identifies the current data format
   - `isCombinedUiExtractionData` - Checks if already in UI format

2. **Transform logic by quote type:**
   - `home` - Transforms to `HomeExtractionResult`
   - `auto` - Transforms to `AutoExtractionResult`
   - `both` - Transforms to `CombinedUiExtractionData` with both home and auto

3. **Pass transformed data** to `QuotePreviewClient` instead of raw data

---

#### Key Code Changes:

```typescript
// Before: Passed raw API-format data
const extractedData = extraction.extracted_data as ExtractedData
<QuotePreviewClient extractedData={extractedData} ... />

// After: Transform based on quote type
const rawExtractedData = extraction.extracted_data as ExtractedData
let transformedData: ExtractedData = rawExtractedData

if (quoteType === 'home') {
  const homeData = getHomeExtractionData(rawExtractedData)
  if (homeData) transformedData = homeData
} else if (quoteType === 'auto') {
  const autoData = getAutoExtractionData(rawExtractedData)
  if (autoData) transformedData = autoData
} else if (quoteType === 'both') {
  // Handle combined format
  const homeData = getHomeExtractionData(rawExtractedData)
  const autoData = getAutoExtractionData(rawExtractedData)
  if (homeData && autoData) {
    transformedData = { quoteType: 'both', home: homeData, auto: autoData }
  }
}

<QuotePreviewClient extractedData={transformedData} ... />
```

---

#### Files Updated:

| File | Change |
|------|--------|
| `/src/app/(protected)/review/[id]/quote/page.tsx` | Added transform imports, data transformation logic |

---

#### Type Validation:

All TypeScript type checks pass. Run `npm run type-check` to verify.

---

---

### Session: January 13, 2026 (Session 5)

**Focus:** Complete Field Mapping Fix for Quote Preview Validation

#### What Was Done:

**1. Fixed `transformExtractionToValidation` Function**

The validation.ts file was completely overhauled to correctly map ALL extraction fields to the quote preview display.

**Key Issues Resolved:**
- Auto extractions using `ownerFirstName`/`ownerLastName` now correctly mapped
- Home extractions using `firstName`/`lastName` now correctly mapped
- All array fields (vehicles, drivers, deductibles, lienholders, accidents/tickets) now included
- Required flag properly propagated from field configs to UI validation
- Fields grouped logically by category for display

**Changes Made:**

| Change | Description |
|--------|-------------|
| Added imports | Imported all field configurations from home-extraction.ts and auto-extraction.ts |
| `convertInputType()` | New utility to convert between field config input types and validation input types |
| `createFieldDefinitionsFromConfig()` | Dynamically creates FieldDefinition arrays from extraction configs |
| `getHomeFieldDefinitions()` | Exported function to get all Home fields dynamically |
| `getAutoFieldDefinitions()` | Exported function to get all Auto fields dynamically |
| `extractArrayFields()` | New function to extract vehicles, drivers, deductibles, lienholders, accidents |
| `AUTO_ARRAY_CONFIGS` | Configuration for all Auto array sections |
| Updated `transformExtractionToValidation()` | Now handles array fields for Auto and claims/scheduled items for Home |

**2. Comprehensive Field Definitions**

Updated both Home and Auto required/optional field arrays to include ALL fields:

**Home Fields Added:**
- Personal: maritalStatus, coApplicantPresent, occupation, prior address fields
- Property: bedroomCount, bathroomCount, dwellingType, constructionStyle, constructionQuality, roofShape, distanceToFireDepartment, waterSupplyType
- Occupancy: dwellingOccupancy, businessOnPremises, shortTermRental, numberOfFamilies, daysRentedToOthers, horsesOrLivestock
- Safety & Risk: windMitigation, stormShutters, impactGlass, enclosedYard
- Insurance Details: propertySameAsMailing, reasonForPolicy, currentlyInsured, lienholder fields, escrowed, insuranceCancelledDeclined, maintenanceCondition, numberOfLosses5Years
- Updates: All update fields with years

**Auto Fields Added:**
- Personal: effectiveDate, maritalStatus, garagingAddressSameAsMailing, garaging address fields, prior address fields, spouse fields, education fields
- Coverage: offRoadVehicleLiability
- Array sections: vehicles, additionalDrivers, deductibles, lienholders, accidentsOrTickets

**3. Exported Types and Functions**

| Export | Purpose |
|--------|---------|
| `FieldDefinition` interface | For consumers needing field definition types |
| `getHomeFieldDefinitions()` | Dynamic field generation from configs |
| `getAutoFieldDefinitions()` | Dynamic field generation from configs |

---

#### Files Updated:

| File | Change |
|------|--------|
| `/src/lib/quote/validation.ts` | Major overhaul with comprehensive field mapping |

---

#### Type Validation:

All TypeScript type checks pass. Run `npm run type-check` to verify.

#### Lint Validation:

No lint errors in validation.ts. Run `npm run lint -- /src/lib/quote/validation.ts` to verify.

---

#### How It Works Now:

1. **For scalar fields**: Uses static field definitions that map extraction paths like `personal.ownerFirstName` to UI labels like "Owner First Name"

2. **For array fields** (Auto only): The `extractArrayFields()` function iterates through arrays like `vehicles[]` and creates UIFieldValidation entries for each item, e.g., "Vehicle 1 - Year", "Vehicle 1 - Make"

3. **For Home arrays**: Claims history and scheduled items are also extracted as optional fields

4. **Categories**: All fields have a category assigned for grouping in the UI

5. **Required flag**: Pulled from the original field configuration and included in the UIFieldValidation output

---

---

### Session: January 13, 2026 (Session 4)

**Focus:** Required Field Validation Alert for Quote Preview Page

#### What Was Done:

**1. Created RequiredFieldsAlert Component**

New component that displays a prominent warning when required fields are missing before quote submission.

**Features:**
- Amber warning styling using shadcn Alert component
- Clear message: "Please fill in the following required fields before continuing:"
- Fields grouped by category (Personal, Property, Coverage, Insurance, Safety, Other)
- Clickable field labels to open edit dialog directly
- "Go back to edit" button to return to review page
- Dark mode support

**File Created:**
`/src/components/quote/RequiredFieldsAlert.tsx`

---

**2. Updated QuotePreviewClient**

Integrated the RequiredFieldsAlert into the quote preview page.

**Changes:**
- Added import for `RequiredFieldsAlert` component
- Added `missingRequiredFields` computed value using `useMemo`
- Alert displays after ValidationSummary when there are missing fields
- Click on field name opens the edit dialog (using existing `handleEditField`)

---

**3. Validation Logic**

Missing required fields are identified by checking:
- `status === 'missing'`
- `value` is null or empty string
- `value.trim() === ''`

The existing submit button is already disabled when `validationResult.isValid` is false, so no changes needed there.

---

#### Files Created/Updated:

| File | Change |
|------|--------|
| `/src/components/quote/RequiredFieldsAlert.tsx` | NEW - Alert component for missing required fields |
| `/src/components/quote/index.ts` | Added export for RequiredFieldsAlert |
| `/src/app/(protected)/review/[id]/quote/QuotePreviewClient.tsx` | Integrated RequiredFieldsAlert |

---

#### Type Validation:

All TypeScript type checks pass. Run `npm run type-check` to verify.

#### Build Validation:

Production build succeeds. Run `npm run build` to verify.

---

---

### Session: January 13, 2026 (Session 3)

**Focus:** Home Extraction Type Updates for Carrier Requirements (Safeco, Auto-Owners, Cincinnati)

#### What Was Done:

**1. Personal Section - Added Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `maritalStatus` | Select | Single, Married, Divorced, Widowed, Domestic Partner |
| `occupation` | Text | Cincinnati requires this field |

**Conditional Logic:**
- Spouse fields (spouseFirstName, spouseLastName, spouseDOB, spouseSSN) only shown if `coApplicantPresent = 'Yes'`
- Prior address fields required if `yearsAtCurrentAddress < 5`

---

**2. Property Section - Added Fields:**

| Field | Type | Options |
|-------|------|---------|
| `bedroomCount` | Select | 1, 2, 3, 4, 5+ |
| `dwellingType` | Select | Single Family, Condo, Townhouse, Mobile Home, Manufactured Home, Duplex, Triplex, Rowhouse, Other |
| `constructionStyle` | Select | Ranch, Colonial, Cape Cod, Split Level, Contemporary, Victorian, Tudor, Craftsman, Mediterranean, Other |
| `constructionQuality` | Select | Economy, Standard, Custom, Premium |
| `homeUnderConstruction` | Select | Yes/No |
| `roofShape` | Select | Gable, Hip, Flat, Mansard, Gambrel, Shed, Other |
| `distanceToFireDepartment` | Select | Under 5 miles, 5-10 miles, Over 10 miles |
| `waterSupplyType` | Select | Public, Well, Cistern |

---

**3. Occupancy Section - Redesigned (NEW Interface):**

| Field | Type | Options |
|-------|------|---------|
| `dwellingOccupancy` | Select | Owner Occupied, Tenant Occupied, Vacant, Secondary/Seasonal |
| `businessOnPremises` | Select | Yes/No |
| `shortTermRental` | Select | Yes/No (Airbnb, VRBO, etc.) |
| `daysRentedToOthers` | Select | None, 1-30, 31-90, 91-180, 181+ (Conditional: shortTermRental = Yes) |
| `horsesOrLivestock` | Select | Yes/No |
| `numberOfFamilies` | Select | 1, 2, 3, 4+ |

---

**4. Safety & Risk Section - Added Fields:**

| Field | Type | Options |
|-------|------|---------|
| `windMitigation` | Select | None, Basic, Moderate, Superior |
| `stormShutters` | Select | Yes/No |
| `impactGlass` | Select | Yes/No |

---

**5. Insurance Details Section - Added Fields:**

| Field | Type | Options |
|-------|------|---------|
| `propertySameAsMailing` | Select | Yes/No |
| `reasonForPolicy` | Select | New Purchase, Existing Home, Refinance |
| `currentlyInsured` | Select | Yes - Same Carrier, Yes - Different Carrier, No - New Purchase, No - Lapse |
| `maintenanceCondition` | Select | Excellent, Good, Average, Fair, Poor |
| `numberOfLosses5Years` | Select | 0, 1, 2, 3, 4, 5+ |

---

**6. Updates Section - Added Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `wiringUpdate` | Select | Yes/No |
| `wiringYear` | Number | Conditional: wiringUpdate = Yes |

**Conditional Logic Added to All Update Fields:**
- `hvacYear` only shown if `hvacUpdate = 'Yes'`
- `plumbingYear` only shown if `plumbingUpdate = 'Yes'`
- `roofYear` only shown if `roofUpdate = 'Yes'`
- `electricalYear` only shown if `electricalUpdate = 'Yes'`
- `wiringYear` only shown if `wiringUpdate = 'Yes'`

---

**7. Field Configuration Enhancements:**

Added `conditionalOn` and `conditionalValue` properties to `HomeFieldConfig`:

```typescript
export interface HomeFieldConfig {
  label: string
  inputType: HomeFieldInputType
  required: boolean
  options?: string[]
  placeholder?: string
  conditionalOn?: string      // NEW: Field that controls visibility
  conditionalValue?: string | string[]  // NEW: Value(s) to trigger visibility
}
```

Added utility functions:
- `shouldShowField()` - Check if conditional field should be displayed
- `getVisibleFields()` - Get all visible fields based on current section data

---

**8. Files Updated:**

| File | Changes |
|------|---------|
| `src/types/home-extraction.ts` | Complete rewrite with carrier fields, conditional logic, helper functions |
| `src/components/extraction/field-editor.tsx` | Added 'checkbox' to FieldInputType |
| `src/components/extraction/home-extraction-form.tsx` | Updated conditional logic for new occupancy fields |

---

**9. Type Validation:**

All TypeScript type checks pass. Run `npm run type-check` to verify.

---

### Session: January 13, 2026 (Session 2)

**Focus:** Auto Extraction Type Updates for Carrier Requirements

#### What Was Done:

**1. Auto Personal Info Fields - Added:**

| Field | Type | Description |
|-------|------|-------------|
| `maritalStatus` | Select | Single, Married, Divorced, Widowed, Domestic Partner |
| `effectiveDate` | Date | Policy start date |
| `garagingAddressSameAsMailing` | Boolean | Is garaging address same as mailing? |
| `garagingStreetAddress` | Text | Conditional: only if garaging differs |
| `garagingCity` | Text | Conditional: only if garaging differs |
| `garagingState` | Select | Conditional: only if garaging differs |
| `garagingZipCode` | Text | Conditional: only if garaging differs |

**Conditional Logic Documented:**
- Spouse fields: Only shown if `maritalStatus` is 'Married' or 'Domestic Partner'
- Prior address fields: Required if `yearsAtCurrentAddress` < 5
- Garaging address fields: Only shown if `garagingAddressSameAsMailing` is false (No)

---

**2. Auto Coverage Info Fields - Added:**

| Field | Type | Description |
|-------|------|-------------|
| `offRoadVehicleLiability` | Boolean | Coverage for ATVs, dirt bikes, etc. |

---

**3. Auto Deductible Fields (Per Vehicle) - Added:**

| Field | Type | Options |
|-------|------|---------|
| `roadTroubleService` | Select | None, $25, $50, $75, $100 |
| `limitedTNCCoverage` | Boolean | Transportation Network Company (Uber/Lyft) coverage |
| `additionalExpenseCoverage` | Select | None, $15/day, $20/day, $25/day, $30/day |

---

**4. Files Updated:**

| File | Changes |
|------|---------|
| `src/types/extraction.ts` | Added new fields to `AutoPersonalInfo`, `AutoCoverageInfo`, `AutoVehicleDeductible` interfaces; Updated `AUTO_REQUIRED_FIELDS` and `AUTO_FIELD_LABELS` |
| `src/types/auto-extraction.ts` | Field configs already updated (linter sync); Verified helper functions include new fields |
| `src/lib/extraction/transform.ts` | Updated `autoApiToUiExtraction()` to transform new fields |
| `src/lib/openrouter/client.ts` | Updated `createDefaultAutoPersonalInfo()` and `createDefaultAutoCoverageInfo()` |
| `scripts/test-auto-transform.ts` | Updated test data with new fields |

---

**5. Type Validation:**

All TypeScript type checks pass. Run `npm run type-check` to verify.

---

---

### Session: January 13, 2026 (Session 1)

**Focus:** Complete Home & Auto Quote Field Implementation

#### What Was Done:

**1. Comprehensive Field Schema Implementation**

Added all required fields for Home and Auto insurance quotes:

**Home Quote Fields:**
- Personal Information (19 fields): Owner/Spouse names, addresses, contact, DOB, SSN
- Property Information (23 fields): Year built, construction, roof, foundation, garage, etc.
- Safety & Risk (7 fields): Alarm, pool, trampoline, dog, etc.
- Coverage (6 fields): Dwelling, liability, medical payments, deductible
- Claims History (3 fields): Claims in last 5 years
- Lienholder & Insurance (11 fields): Current carrier, policy info, lienholder
- Updates (5 fields): HVAC, plumbing, roof, electrical, circuit breakers
- Scheduled Items (NEW): Jewelry and other valuables arrays

**Auto Quote Fields:**
- Personal Information (27 fields): Licenses, occupation, education, ride share, delivery
- Additional Drivers (array): Name, DOB, license, GSD, vehicle assignment
- Vehicles (array): Year, make, model, VIN, mileage, usage
- Coverages (7 fields): BI, PD, UM, UIM, medical payments, towing, rental
- Deductibles by Vehicle (array): Comprehensive, collision per vehicle
- Lienholders by Vehicle (array): Name, address per financed vehicle
- Prior Insurance (4 fields): Company, premium, policy number, expiration
- Accidents/Tickets (array): Driver, date, type, amount, at-fault

**Shared Fields (collected once for both):**
- Owner Name, Spouse Name, Address, Prior Address, Phone, Email, Owner DOB, Spouse DOB

---

**2. Type System Overhaul**

Created comprehensive TypeScript types:

| File | Purpose |
|------|---------|
| `src/types/extraction.ts` | API extraction types (HomeApiExtractionResult, AutoApiExtractionResult) |
| `src/types/home-extraction.ts` | UI form types for Home (HomeExtractionResult) |
| `src/types/auto-extraction.ts` | UI form types for Auto (AutoExtractionResult) |
| `src/types/database.ts` | Database types including CombinedUiExtractionData |

Key type additions:
- `SharedPersonalInfo` - Common fields for both quote types
- `InsuranceType` - 'home' | 'auto' | 'both' | 'generic'
- Field configurations with labels, input types, required flags, dropdown options

---

**3. OpenRouter Extraction Prompts**

Created specialized extraction prompts:

| File | Prompt |
|------|--------|
| `src/lib/openrouter/prompts.ts` | `HOME_EXTRACTION_PROMPT` - Detailed instructions for Home fields |
| `src/lib/openrouter/prompts.ts` | `AUTO_EXTRACTION_PROMPT` - Detailed instructions for Auto fields |

Features:
- Structured JSON output format
- Confidence scoring instructions (high/medium/low)
- Field flagging for illegible/missing data
- Required field markers

---

**4. Extraction API Updates**

Updated `/src/app/api/extract/route.ts`:
- Accepts `insuranceType` parameter (home, auto, both)
- Calls appropriate extraction function based on type
- Stores `insurance_type` in database
- Returns typed extraction results

Database migration: `20260113000000_add_insurance_type_to_extractions.sql`
- Added `insurance_type` column to extractions table

---

**5. Data Transformation Layer**

Created `/src/lib/extraction/transform.ts`:

**Type Detection:**
- `detectExtractionType()` - Identifies data format (home, auto, home_api, auto_api, legacy, combined, unknown)

**Transformation Functions:**
- `homeApiToUiExtraction()` - Converts HomeApiExtractionResult → HomeExtractionResult
- `autoApiToUiExtraction()` - Converts AutoApiExtractionResult → AutoExtractionResult
- `getHomeExtractionData()` - Gets Home data from any format
- `getAutoExtractionData()` - Gets Auto data from any format

**Field Mapping:**
| API Field | UI Field |
|-----------|----------|
| `personal.dateOfBirth` | `personal.applicantDOB` |
| `personal.streetAddress` | `personal.address` |
| `safety.*` | `safetyRisk.*` |
| `claims.*` | `claimsHistory.*` |
| `lienholder.*` | `insuranceDetails.*` |

---

**6. UI Components**

**New Components Created:**

| Component | Purpose |
|-----------|---------|
| `src/components/extraction/extraction-review.tsx` | Main wrapper with quote type detection |
| `src/components/extraction/quote-type-selector.tsx` | Home/Auto/Both toggle |
| `src/components/extraction/home-extraction-form.tsx` | Complete Home form with 7 sections |
| `src/components/extraction/auto-extraction-form.tsx` | Complete Auto form with 8 sections |
| `src/components/extraction/form-section.tsx` | Collapsible section with icons and stats |
| `src/components/extraction/field-editor.tsx` | Individual field with confidence indicators |
| `src/components/extraction/claims-editor.tsx` | Dynamic claims array editor |
| `src/components/extraction/scheduled-items-editor.tsx` | Jewelry/valuables array editor |

**Form Features:**
- Collapsible accordion sections with icons
- Progress bar showing completion percentage
- Confidence badges (high=green, medium=yellow, low=orange)
- Required field asterisks
- Dynamic array fields (add/remove items)
- Real-time save to Supabase

---

**7. State Management Hooks**

Created `/src/hooks/`:

| Hook | Purpose |
|------|---------|
| `use-array-field.ts` | Generic array CRUD operations |
| `use-persisted-array-field.ts` | With localStorage persistence |
| `use-form-arrays.ts` | Manages all form arrays together |

Created `/src/lib/array-fields/`:

| Utility | Purpose |
|---------|---------|
| `vehicle-references.ts` | Vehicle label generation, dependency tracking |
| `driver-references.ts` | Driver options including owner/spouse |
| `validation.ts` | VIN, coverage limits, date validation |
| `persistence.ts` | Draft state with version migrations |
| `confidence.ts` | Aggregation, required field tracking |
| `factories.ts` | Default item creators |
| `synchronization.ts` | Auto-create deductibles, reference cleanup |

---

**8. Layout Improvements**

**Removed:** PDF side-by-side preview (was taking up space)

**Updated Layout:**
- Full-width centered form (`max-w-5xl`)
- Sticky header with backdrop blur
- Muted background (`bg-muted/30`)
- Increased section spacing (`space-y-6` to `space-y-8`)
- Larger grid gaps (`gap-6`)
- Better section padding (`p-6` header, `pb-8` content)
- Section icons (User, Home, Shield, Car, etc.)
- Progress bar with completion percentage

---

**9. Field Highlighting Fix**

Updated `/src/components/extraction/field-editor.tsx`:

| Condition | Styling |
|-----------|---------|
| Required + flagged/empty | Red border, red label, help text |
| Required + low confidence | Orange border, orange label |
| Required + medium confidence | Yellow border, yellow label |
| **Non-required + any condition** | **No special styling** |

Only required fields now show warning indicators.

---

**10. Quote Validation Updates**

Updated `/src/lib/quote/validation.ts`:
- Home and Auto field definitions
- `detectExtractionType()` for validation
- Vehicle and driver array extraction

Updated `/src/app/(protected)/review/[id]/quote/QuoteValidationClient.tsx`:
- Vehicles Summary card for Auto quotes
- Drivers Summary card for Auto quotes
- Detection notice for suggested quote type

---

#### Files Created This Session:

```
src/
├── components/extraction/
│   ├── extraction-review.tsx
│   ├── quote-type-selector.tsx
│   ├── home-extraction-form.tsx
│   ├── auto-extraction-form.tsx
│   ├── form-section.tsx
│   ├── field-editor.tsx (updated)
│   ├── claims-editor.tsx
│   ├── scheduled-items-editor.tsx
│   └── index.ts
├── hooks/
│   ├── use-array-field.ts
│   ├── use-persisted-array-field.ts
│   ├── use-form-arrays.ts
│   └── index.ts
├── lib/
│   ├── extraction/
│   │   └── transform.ts
│   ├── array-fields/
│   │   ├── types.ts
│   │   ├── vehicle-references.ts
│   │   ├── driver-references.ts
│   │   ├── validation.ts
│   │   ├── persistence.ts
│   │   ├── confidence.ts
│   │   ├── factories.ts
│   │   ├── synchronization.ts
│   │   └── index.ts
│   └── openrouter/
│       └── prompts.ts (updated)
├── types/
│   ├── extraction.ts (updated)
│   ├── home-extraction.ts
│   ├── auto-extraction.ts
│   └── database.ts (updated)
└── app/
    ├── api/extract/route.ts (updated)
    └── (protected)/review/[id]/
        ├── page.tsx (updated)
        └── quote/
            ├── page.tsx (updated)
            └── QuoteValidationClient.tsx (updated)

supabase/migrations/
└── 20260113000000_add_insurance_type_to_extractions.sql
```

---

---

**11. Dashboard Page Redesign**

Updated `/src/app/(protected)/dashboard/page.tsx`:

**New Card Layout:**
- Responsive grid (1 col mobile, 2 cols tablet, 3 cols desktop)
- Color-coded status bars on cards (green=completed, blue=processing, amber=pending, red=failed)
- Hover effects with shadow and border color change
- Dropdown menu for actions (View, Delete)
- Context-aware quick action buttons per status

**Visual Improvements:**
- Stats cards with colored icon backgrounds
- "Success Rate" percentage instead of just "Failed" count
- Relative timestamps ("2h ago", "Yesterday")
- Better dark mode support throughout
- Empty state with large icon and CTA

---

**12. Streamlined Quote Flow**

Reduced clicks in the quote submission process:

**Before (too many clicks):**
```
Review → Select Type → Edit → Proceed → Select Type AGAIN → Submit
```

**After (streamlined):**
```
Review → Select Type → Edit → Proceed → Final Preview → Submit
```

**Files Created/Updated:**

| File | Change |
|------|--------|
| `src/app/(protected)/review/[id]/review-page-client.tsx` | NEW - Tracks quote type, floating proceed button |
| `src/components/extraction/extraction-review.tsx` | Added `onQuoteTypeChange` callback |
| `src/app/(protected)/review/[id]/page.tsx` | Uses ReviewPageClient, simplified header |
| `src/app/(protected)/review/[id]/quote/page.tsx` | Reads type from URL params (`?type=home`) |
| `src/app/(protected)/review/[id]/quote/QuotePreviewClient.tsx` | NEW - Read-only final preview |

**Flow Changes:**
- Quote type passed via URL: `/review/[id]/quote?type=home`
- No redundant quote type selector on preview page
- "Proceed to Quote" button disabled until type selected
- Invalid type redirects back to review page

---

**13. Quote Preview Page Redesign**

Updated `/src/app/(protected)/review/[id]/quote/QuotePreviewClient.tsx`:

**Removed:**
- PDF preview (not needed on final submit page)
- Split-panel layout
- Inline editing (go back to review page for that)

**New Layout:**
- Full-width centered content (`max-w-4xl`)
- Fields grouped by category with icons:
  - Personal Information (User icon)
  - Address Details (Home icon)
  - Property Information (Home icon)
  - Coverage Details (Shield icon)
  - Vehicle Information (Car icon)
  - Driver Information (Users icon)
- 2-column grid for fields on desktop
- Empty values shown as "Not provided" in muted italic
- First 3 sections expanded by default

**Features:**
- Collapsible sections with expand/collapse
- Badges for flagged fields and confidence levels
- Edit button on hover for individual fields
- Validation summary showing completion status

**Sticky Action Bar:**
- Fixed at bottom, always visible
- Status indicator (ready/X fields missing)
- "Back to Edit" and "Submit Quote" buttons

---

**14. Upload Page Improvements**

Updated `/src/app/(protected)/upload/page.tsx`:

**Page Layout:**
- Proper header section with border and background
- "Back to Dashboard" navigation link
- Increased container width (`max-w-4xl`)
- Full-page muted background (`bg-muted/30`)
- Three feature cards:
  - PDF Format (up to 20MB)
  - AI Extraction capabilities
  - Secure Processing

Updated `/src/components/pdf/pdf-upload-zone.tsx`:

**Upload Zone:**
- Increased padding (`py-16 px-8`) for spacious feel
- Larger icon container (20x20)
- `CloudUpload` icon for clearer visual
- Hover and drag states with scale effect
- Larger buttons (`size="lg"`)
- Better spacing throughout
- Improved success/error/processing states

---

#### Files Created/Updated (UX Improvements):

```
src/
├── app/(protected)/
│   ├── dashboard/page.tsx (redesigned)
│   ├── upload/page.tsx (spacing fixes)
│   └── review/[id]/
│       ├── page.tsx (simplified)
│       ├── review-page-client.tsx (NEW)
│       └── quote/
│           ├── page.tsx (reads URL params)
│           └── QuotePreviewClient.tsx (NEW - replaces QuoteValidationClient)
├── components/
│   ├── pdf/pdf-upload-zone.tsx (spacing fixes)
│   ├── extraction/extraction-review.tsx (onQuoteTypeChange callback)
│   └── dashboard/delete-extraction-button.tsx (asMenuItem prop)
```

---

#### Bugs Fixed This Session:

1. **Home fields not mapping** - API format (HomeApiExtractionResult) wasn't being transformed to UI format (HomeExtractionResult). Fixed with `homeApiToUiExtraction()`.

2. **Auto fields not mapping** - Same issue as Home. Fixed with `autoApiToUiExtraction()`.

3. **All fields showing "needs review"** - Non-required fields were incorrectly showing warning styling. Fixed by checking `required` prop in field-editor.tsx.

4. **Cramped layout** - Removed PDF preview, increased spacing throughout, added better visual hierarchy.

5. **Too many clicks to submit** - User had to select quote type twice. Fixed by passing type via URL params.

---

## Completed Phases

### Phase 1: Project Foundation ✅
- Next.js 14+ with App Router, TypeScript, Tailwind CSS + shadcn/ui
- Supabase integration (Auth, Database, Storage)
- OpenRouter API client for Claude Vision

### Phase 2: PDF Processing Pipeline ✅
- PDF to image conversion using pdfjs-dist + @napi-rs/canvas
- Worker pre-loading pattern for Next.js compatibility
- Multi-page batch processing

### Phase 3: Data Extraction ✅
- OpenRouter API integration for Claude Vision
- Extraction prompts for Home and Auto insurance fields
- JSON response parsing with confidence scoring

### Phase 4: Authentication & Storage ✅
- Supabase Auth with email/password
- Protected route middleware
- PDF storage and extraction records with RLS

### Phase 5: Extraction Review Interface ✅
- Dashboard with extraction history
- Upload page with drag-and-drop
- Review page with extraction forms

### Phase 6: Quote Validation & Form Mapping ✅
- Quote type selection (Home, Auto, Both)
- Complete Home and Auto quote schemas
- Field validation and normalization
- Quote submission API

### Phase 7: Comprehensive Field Implementation ✅ (This Session)
- All Home insurance fields (70+ fields)
- All Auto insurance fields (80+ fields)
- Shared fields management
- API-to-UI data transformation
- Array field management (vehicles, drivers, claims, etc.)
- Improved UI layout and spacing

### Phase 8: UX Polish & Flow Optimization ✅ (This Session)
- Dashboard page redesign with card layout and status indicators
- Streamlined quote flow (removed redundant quote type selection)
- Quote preview page as read-only final review
- Upload page spacing and visual improvements
- Sticky action bars and floating buttons
- Better empty states and loading states

---

## Current Architecture

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (protected)/
│   │   ├── dashboard/
│   │   ├── upload/
│   │   ├── review/[id]/
│   │   │   ├── page.tsx          # Extraction review
│   │   │   └── quote/            # Quote validation
│   │   └── quotes/[id]/          # Quote status
│   └── api/
│       ├── extract/              # PDF extraction
│       ├── upload/               # File upload
│       └── quotes/               # Quote validation/submission
├── components/
│   ├── ui/                       # shadcn/ui
│   ├── pdf/                      # PDF upload
│   ├── extraction/               # Extraction forms (Home, Auto)
│   └── quote/                    # Quote validation UI
├── hooks/                        # Array field management
├── lib/
│   ├── supabase/                 # Database clients
│   ├── openrouter/               # Claude Vision API
│   ├── pdf/                      # PDF conversion
│   ├── extraction/               # Data transformation
│   ├── array-fields/             # Array utilities
│   ├── validation/               # Quote validation
│   └── quote/                    # Quote utilities
└── types/                        # TypeScript definitions
```

---

## Pending Phases

### Phase 9: RPA Integration 🔜

**Status:** Not Started

**Requirements:**
- Trigger RPA automation when quote is submitted
- Connect to carrier quote sites (Progressive, State Farm, etc.)
- Fill forms with validated quote data
- Return premium quotes from each carrier

**Database fields ready:**
- `quotes.rpa_job_id` - Track RPA execution
- `quotes.rpa_started_at` / `rpa_completed_at` - Timing
- `quotes.rpa_error` - Error tracking
- `quotes.carrier_quotes` - Results storage

---

## Quick Reference

### Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run type-check       # TypeScript validation
npm run lint             # ESLint
npx supabase db push     # Push migrations
```

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
```

### Key Files

| Purpose | File |
|---------|------|
| Extraction API | `/src/app/api/extract/route.ts` |
| Data transformation | `/src/lib/extraction/transform.ts` |
| Home form | `/src/components/extraction/home-extraction-form.tsx` |
| Auto form | `/src/components/extraction/auto-extraction-form.tsx` |
| Field editor | `/src/components/extraction/field-editor.tsx` |
| OpenRouter prompts | `/src/lib/openrouter/prompts.ts` |
| Dashboard | `/src/app/(protected)/dashboard/page.tsx` |
| Upload page | `/src/app/(protected)/upload/page.tsx` |
| Review page | `/src/app/(protected)/review/[id]/page.tsx` |
| Review client | `/src/app/(protected)/review/[id]/review-page-client.tsx` |
| Quote preview | `/src/app/(protected)/review/[id]/quote/QuotePreviewClient.tsx` |
| Upload zone | `/src/components/pdf/pdf-upload-zone.tsx` |

---

## Contributors

- Development assisted by Claude Code agents:
  - `frontend-developer` - UI components, forms, styling
  - `backend-developer` - API routes, data transformation
  - `ui-designer` - Layout design, spacing, visual hierarchy
  - `javascript-pro` - State management hooks, type utilities
  - `error-detective` - Root cause analysis, debugging
  - `nextjs-developer` - Page structure, server components
