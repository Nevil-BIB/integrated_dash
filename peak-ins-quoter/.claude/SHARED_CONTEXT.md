# Shared Context for Code Review Remediation

**Generated:** January 13, 2026
**Purpose:** Central reference for all agents working on the peak-quote code review remediation

---

## Project Overview

**Application:** Fact Finder Extraction Application
**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, Supabase, OpenRouter (Claude Vision)
**Core Function:** Extract insurance data from scanned PDF fact finders using AI vision, validate against quote schemas, prepare for RPA automation

---

## Type System Architecture (CRITICAL)

### Type Hierarchy

The codebase has **parallel type hierarchies** that must remain synchronized:

```
API Types (extraction.ts)          UI Form Types (home-extraction.ts, auto-extraction.ts)
--------------------------------   ------------------------------------------------
HomeApiExtractionResult            HomeExtractionResult
AutoApiExtractionResult            AutoExtractionResult
ExtractionResult (legacy)          CombinedUiExtractionData

                    \                    /
                     \                  /
                      v                v
                   ExtractedDataType (database.ts)
                   (Union of all possible types)
```

### Key Type Files

| File | Purpose | Lines |
|------|---------|-------|
| `/src/types/extraction.ts` | API types, field interfaces | 847 |
| `/src/types/home-extraction.ts` | UI form types for Home | 820 |
| `/src/types/auto-extraction.ts` | UI form types for Auto | 656 |
| `/src/types/database.ts` | Supabase schema, ExtractedDataType union | 164 |
| `/src/types/quote.ts` | Quote validation types | 360 |

### ExtractedDataType Union (database.ts:28-36)

```typescript
export type ExtractedDataType =
  | HomeApiExtractionResult      // From API extraction
  | AutoApiExtractionResult      // From API extraction
  | CombinedExtractionData       // API combined (home+auto)
  | HomeExtractionResult         // UI form data
  | AutoExtractionResult         // UI form data
  | CombinedUiExtractionData     // UI combined form
  | ExtractionResult             // Legacy (deprecated)
  | null
```

**Issue #16:** This union has no discriminant field, making type narrowing difficult. Each type should have a `_type` or similar discriminant.

### Shared Base Types

Both API and UI types share these base field types from `extraction.ts`:

```typescript
interface ExtractionField {
  value: string | null;
  confidence: 'high' | 'medium' | 'low';
  flagged: boolean;
  rawText?: string;
}

interface ExtractionBooleanField {
  value: boolean | null;
  confidence: 'high' | 'medium' | 'low';
  flagged: boolean;
  rawText?: string;
}
```

---

## File Ownership and Conflicts

### Files Requiring Multi-Agent Coordination

| File | Primary Agent | Secondary Agent | Conflict Risk |
|------|---------------|-----------------|---------------|
| `/src/lib/openrouter/client.ts` | backend-developer | javascript-pro | HIGH |
| `/src/types/extraction.ts` | javascript-pro | backend-developer | MEDIUM |
| `/src/types/database.ts` | backend-developer | frontend-developer | MEDIUM |
| `/src/components/extraction/extraction-review.tsx` | frontend-developer | nextjs-developer | LOW |
| `/src/components/extraction/auto-extraction-form.tsx` | frontend-developer | ui-designer | LOW |

### Coordination Protocol

1. **Before modifying shared types:** Check with dependent files
2. **When changing ExtractedDataType union:** Update discriminant handling in all consumers
3. **When modifying openrouter/client.ts:** Coordinate on function signatures

---

## Key Files Reference

### API Routes

| Route | File | Issues | Primary Changes |
|-------|------|--------|-----------------|
| POST /api/extract | `/src/app/api/extract/route.ts` | #1, #21, #22 | Remove stack trace exposure, add error handling |
| GET/PATCH/DELETE /api/extractions/[id] | `/src/app/api/extractions/[id]/route.ts` | #5, #9, #23 | Fix type mismatch, add UUID validation |
| POST /api/upload | `/src/app/api/upload/route.ts` | #11, #40 | Improve file validation |

### OpenRouter Client (`/src/lib/openrouter/client.ts` - 934 lines)

**Exports:**
- `extractHomeFromImages(images: string[]): Promise<HomeApiExtractionResult>`
- `extractAutoFromImages(images: string[]): Promise<AutoApiExtractionResult>`
- `extractFromImagesWithType(images: string[], insuranceType: InsurancePromptType)`
- `createDefaultHomeApiExtractionResult(): HomeApiExtractionResult`
- `createDefaultAutoApiExtractionResult(): AutoApiExtractionResult`
- `createDefaultExtractionResult(): ExtractionResult` (deprecated)

**Issues to Fix:**
- Line 77: API key prefix logging (#6)
- Line 152: No runtime validation for parsed JSON (#7)
- Lines 564, 568, 575, etc.: `as any` casts (#14)
- Missing request timeout (#37)
- No retry logic (#38)

### Extraction Transform (`/src/lib/extraction/transform.ts`)

**Critical Functions:**
- `detectExtractionType(data: unknown): string` - Detects API or UI type
- `getHomeExtractionData(data: unknown): HomeExtractionResult | null`
- `getAutoExtractionData(data: unknown): AutoExtractionResult | null`
- `suggestQuoteType(data: unknown): QuoteType`

### Extraction Review Component (`/src/components/extraction/extraction-review.tsx`)

**Props:**
```typescript
interface ExtractionReviewProps {
  extractionId: string
  initialData: unknown  // Issue #13: Should be ExtractedDataType
  className?: string
  onQuoteTypeChange?: (quoteType: QuoteType) => void
}
```

**State:**
- `quoteType: QuoteType` - 'home' | 'auto' | 'both'
- `homeData: HomeExtractionResult`
- `autoData: AutoExtractionResult`

---

## Database Schema

### Extractions Table

```sql
extractions (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES auth.users,
  filename: text NOT NULL,
  storage_path: text NOT NULL,
  insurance_type: 'home' | 'auto' | 'both' | 'life' | 'health' | 'generic',
  extracted_data: jsonb,  -- ExtractedDataType
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'quoted',
  created_at: timestamptz,
  updated_at: timestamptz
)
```

### Quotes Table

```sql
quotes (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES auth.users,
  extraction_id: uuid REFERENCES extractions,
  quote_type: 'home' | 'auto' | 'both',
  quote_data: jsonb,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  rpa_job_id: text,
  carrier_quotes: jsonb[],
  created_at: timestamptz,
  updated_at: timestamptz
)
```

---

## API Patterns

### Standard API Response Format

```typescript
// Success
{ success: true, data: T }

// Error (current - inconsistent)
{ error: string, details?: string }

// Error (proposed - consistent)
{
  success: false,
  error: {
    code: string,
    message: string
  }
}
```

### Authentication Pattern

```typescript
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Component Patterns

### Extraction Form Structure

Both `HomeExtractionForm` and `AutoExtractionForm` follow this pattern:

```typescript
interface FormProps {
  extractionId: string
  initialData: HomeExtractionResult | AutoExtractionResult
  onSave: (data: typeof initialData) => Promise<void>
  className?: string
}
```

### Field Rendering Pattern

```typescript
// Current pattern (not memoized - Issue #33, #34)
const renderField = (key: string, config: FieldConfig, value: ExtractionField) => {
  return (
    <FieldEditor
      key={key}
      label={config.label}
      value={value}
      inputType={config.inputType}
      options={config.options}
      onChange={(newValue) => handleFieldChange(section, key, newValue)}
    />
  )
}
```

### Duplicate QuoteTypeSelector Components (Issue #3)

| Location | API |
|----------|-----|
| `/src/components/extraction/quote-type-selector.tsx` | `value`, `onChange` |
| `/src/components/quote/QuoteTypeSelector.tsx` | `selected`, `onSelect` |

**Resolution:** Consolidate to single component with `value`/`onChange` pattern.

---

## Validation Patterns

### Current Validation Locations (Issue #20)

1. `/src/lib/validation/quote-validator.ts` (801 lines)
2. `/src/lib/quote/validation.ts` (881 lines)
3. `/src/lib/extraction/transform.ts` (868 lines)
4. Various form components

**Resolution:** Consolidate into single validation module with Zod schemas.

---

## Issue Severity Matrix

### CRITICAL (Fix Immediately)

| # | Issue | File | Agent |
|---|-------|------|-------|
| 1 | Stack trace exposure | api/extract/route.ts | backend-developer |
| 6 | API key logging | openrouter/client.ts | backend-developer |
| 5 | API type mismatch | api/extractions/[id]/route.ts | backend-developer |
| 7 | No runtime validation | openrouter/client.ts | javascript-pro |

### HIGH (Security/Type Safety)

| # | Issue | File | Agent |
|---|-------|------|-------|
| 2 | No rate limiting | All API routes | backend-developer |
| 9 | Missing UUID validation | api/extractions/[id]/route.ts | backend-developer |
| 13 | initialData: unknown | extraction-review.tsx | frontend-developer |
| 14 | 10x `as any` casts | openrouter/client.ts | javascript-pro |
| 16 | No discriminant on union | database.ts | javascript-pro |

---

## Constants and Magic Numbers

### Current Locations

```typescript
// openrouter/client.ts
const MAX_PAGES_PER_BATCH = 5

// pdf-upload-zone.tsx
const MAX_FILE_SIZE = 20 * 1024 * 1024  // 20MB (hardcoded string elsewhere)

// Various files
const US_STATES = [...] // Duplicated in home-extraction.ts and auto-extraction.ts
```

**Resolution:** Create `/src/lib/constants.ts` with shared constants.

---

## Testing Gaps (Issue #4)

**Current State:** 99 files with 0 test coverage

**Priority Test Targets:**
1. `/src/lib/openrouter/client.ts` - Parsing, merging logic
2. `/src/lib/extraction/transform.ts` - Type detection, transformation
3. `/src/lib/validation/*.ts` - Field validation logic
4. `/src/app/api/*/route.ts` - API integration tests

---

## Change Coordination Checklist

When making changes, verify:

- [ ] Type changes in `extraction.ts` are reflected in `database.ts`
- [ ] UI type changes in `home-extraction.ts`/`auto-extraction.ts` are compatible
- [ ] API route type expectations match actual data format
- [ ] Transform functions handle all `ExtractedDataType` variants
- [ ] Form components handle both API and UI type formats

---

## Agent-Specific Notes

### backend-developer

Focus files:
- `/src/app/api/**/*.ts`
- `/src/lib/openrouter/client.ts` (security issues only)
- `/src/lib/supabase/*.ts`

Coordinate with javascript-pro on client.ts refactoring.

### javascript-pro

Focus files:
- `/src/lib/openrouter/client.ts` (refactoring, type safety)
- `/src/types/*.ts`
- `/src/lib/extraction/transform.ts`
- `/src/lib/validation/*.ts`

Coordinate with backend-developer on API types.

### frontend-developer

Focus files:
- `/src/components/extraction/*.tsx`
- `/src/components/quote/*.tsx`
- `/src/components/pdf/*.tsx`

Coordinate with ui-designer on accessibility.

### ui-designer

Focus files:
- `/src/components/pdf/pdf-viewer.tsx`
- `/src/components/pdf/pdf-upload-zone.tsx`
- `/src/components/layout/sidebar.tsx`
- `/src/components/extraction/quote-type-selector.tsx`

Add ARIA labels and keyboard navigation.

### nextjs-developer

Focus files:
- `/src/app/(protected)/review/*/page.tsx`
- `/src/middleware.ts`
- Missing `loading.tsx` files

---

## File Path Quick Reference

```
/Users/samruben/peak-quote/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── extract/route.ts
│   │   │   ├── extractions/[id]/route.ts
│   │   │   ├── upload/route.ts
│   │   │   └── quotes/*/route.ts
│   │   └── (protected)/review/[id]/
│   ├── components/
│   │   ├── extraction/
│   │   │   ├── extraction-review.tsx
│   │   │   ├── home-extraction-form.tsx
│   │   │   ├── auto-extraction-form.tsx
│   │   │   └── quote-type-selector.tsx
│   │   ├── quote/
│   │   │   └── QuoteTypeSelector.tsx  (duplicate)
│   │   └── pdf/
│   │       ├── pdf-viewer.tsx
│   │       └── pdf-upload-zone.tsx
│   ├── lib/
│   │   ├── openrouter/
│   │   │   ├── client.ts (934 lines)
│   │   │   └── prompts.ts
│   │   ├── extraction/
│   │   │   └── transform.ts (868 lines)
│   │   ├── validation/
│   │   │   └── quote-validator.ts (801 lines)
│   │   └── quote/
│   │       └── validation.ts (881 lines)
│   └── types/
│       ├── extraction.ts (847 lines)
│       ├── home-extraction.ts (820 lines)
│       ├── auto-extraction.ts (656 lines)
│       ├── database.ts (164 lines)
│       └── quote.ts (360 lines)
└── CODE_REVIEW_ISSUES.md
```

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-13 | context-manager | Initial shared context document |
