# Agent Coordination Protocol for Code Review Remediation

**Purpose:** Prevent conflicts, ensure consistent changes, and track progress across multi-agent remediation work.

---

## Conflict Zones and Resolution

### Zone 1: Type System (HIGH CONFLICT RISK)

**Files involved:**
- `/src/types/database.ts`
- `/src/types/extraction.ts`
- `/src/types/home-extraction.ts`
- `/src/types/auto-extraction.ts`
- `/src/types/quote.ts`

**Primary owner:** javascript-pro
**Secondary stakeholders:** backend-developer, frontend-developer

**Coordination rules:**
1. All type changes MUST be reviewed before implementation
2. When adding a discriminant to `ExtractedDataType`, update ALL type guards in `transform.ts`
3. Changes to `ExtractionField` or `ExtractionBooleanField` affect 20+ files

**Proposed discriminant addition:**
```typescript
// Each type should have a _type discriminant
interface HomeApiExtractionResult {
  _type: 'home_api';
  personal: HomePersonalInfo;
  // ...
}

interface AutoApiExtractionResult {
  _type: 'auto_api';
  personal: AutoPersonalInfo;
  // ...
}

// Update ExtractedDataType to use discriminated union
export type ExtractedDataType =
  | (HomeApiExtractionResult & { _type: 'home_api' })
  | (AutoApiExtractionResult & { _type: 'auto_api' })
  // ...
```

### Zone 2: OpenRouter Client (HIGH CONFLICT RISK)

**File:** `/src/lib/openrouter/client.ts` (934 lines)

**Primary owner for:**
- Security fixes (lines 75-77, 117): backend-developer
- Type safety and refactoring: javascript-pro
- Performance (timeout, retry): backend-developer

**Coordination rules:**
1. Backend-developer handles security fixes FIRST
2. JavaScript-pro handles type safety AFTER security fixes are merged
3. Any function signature changes require updating callers:
   - `/src/app/api/extract/route.ts`
   - Any tests (when added)

**Recommended split into modules:**
```
/src/lib/openrouter/
├── client.ts          -> index.ts (exports only)
├── api.ts             (API calls: callClaudeVision, sendToOpenRouter)
├── parsing.ts         (parseExtractionResponse, cleanBase64)
├── defaults.ts        (createDefaultXxxResult functions)
├── merging.ts         (mergeXxxExtractionResults functions)
└── types.ts           (OpenRouterMessage, OpenRouterResponse)
```

### Zone 3: API Route Type Handling (MEDIUM CONFLICT RISK)

**Issue:** API expects `ExtractionResult` but receives `HomeExtractionResult` or `AutoExtractionResult`

**File:** `/src/app/api/extractions/[id]/route.ts`

**Current (line 49):**
```typescript
const { extracted_data } = await request.json() as { extracted_data: ExtractionResult }
```

**Fixed:**
```typescript
import { ExtractedDataType } from '@/types/database'

const { extracted_data } = await request.json() as { extracted_data: ExtractedDataType }
```

**Coordination:** This change is safe for backend-developer to make independently.

### Zone 4: Extraction Components (LOW CONFLICT RISK)

**Files:**
- `/src/components/extraction/extraction-review.tsx`
- `/src/components/extraction/home-extraction-form.tsx`
- `/src/components/extraction/auto-extraction-form.tsx`

**Primary owner:** frontend-developer
**Secondary stakeholder:** ui-designer (for accessibility)

**Coordination rules:**
1. frontend-developer handles React patterns, memoization, type fixes
2. ui-designer handles ARIA labels, keyboard navigation
3. Changes can be made in parallel - low conflict risk

---

## Change Sequencing

### Phase 1: Security (backend-developer)

**Order:**
1. Remove stack trace from `/src/app/api/extract/route.ts` (Issue #1)
2. Remove API key logging from `/src/lib/openrouter/client.ts` (Issue #6)
3. Add UUID validation to `/src/app/api/extractions/[id]/route.ts` (Issue #9)
4. Fix API type mismatch in same file (Issue #5)

**No dependencies on other agents.**

### Phase 2: Type Safety (javascript-pro)

**Prerequisites:** Security fixes committed (Phase 1)

**Order:**
1. Add discriminant to `ExtractedDataType` in `/src/types/database.ts` (Issue #16)
2. Update type guards in `/src/lib/extraction/transform.ts`
3. Add Zod schemas for `/src/lib/openrouter/client.ts` parsing (Issue #7)
4. Replace `as any` casts in `/src/lib/openrouter/client.ts` (Issue #14)

**Notify frontend-developer when discriminant is added.**

### Phase 3: Frontend Fixes (frontend-developer)

**Prerequisites:** Type discriminant added (Phase 2, step 1)

**Order:**
1. Fix `initialData: unknown` in extraction-review.tsx (Issue #13)
2. Fix unsafe type assertions in auto-extraction-form.tsx (Issue #15)
3. Add memoization to render functions (Issues #33, #34)
4. Consolidate QuoteTypeSelector components (Issue #3)

**Can work in parallel with Phase 2, steps 2-4.**

### Phase 4: Accessibility (ui-designer)

**No dependencies. Can run in parallel with any phase.**

**Order:**
1. Add ARIA labels to pdf-viewer.tsx (Issues #25, #31)
2. Add ARIA labels to sidebar.tsx (Issue #26)
3. Add ARIA roles to pdf-upload-zone.tsx (Issues #27, #30)
4. Fix radio semantics in quote-type-selector.tsx (Issue #28)

---

## Lock Protocol

When an agent begins work on a high-conflict file, they should:

1. **Announce intent** in PROGRESS.md under "Active Work"
2. **Complete work quickly** (ideally single session)
3. **Announce completion** when done

### Lock Format in PROGRESS.md

```markdown
## Active Work (Locks)

| File | Agent | Started | Status |
|------|-------|---------|--------|
| /src/lib/openrouter/client.ts | backend-developer | 2026-01-13 10:00 | In Progress |
| /src/types/database.ts | javascript-pro | - | Waiting on backend-developer |
```

---

## Merge Order for Parallel Changes

When multiple agents make changes to the same file category:

### Type Files (`/src/types/*.ts`)
1. javascript-pro changes merge first (discriminant, structural)
2. Other agents rebase on those changes

### API Routes (`/src/app/api/*`)
1. Security fixes merge first (backend-developer)
2. Validation/type fixes merge second
3. Performance fixes merge last

### Components (`/src/components/*`)
1. Type fixes merge first (frontend-developer)
2. Memoization fixes merge second
3. Accessibility fixes merge last (ui-designer)

---

## Communication Protocol

### Before Starting Work

Check PROGRESS.md "Active Work" section. If the file is locked:
- Wait for lock release, OR
- Coordinate with locking agent for parallel sections

### During Work

If you discover:
- **New issues:** Add to CODE_REVIEW_ISSUES.md under "Discovered During Remediation"
- **Blockers:** Document in PROGRESS.md and pause
- **Type changes needed in another file:** Notify owning agent

### After Completing Work

1. Update PROGRESS.md with completed items
2. Release any file locks
3. Document any breaking changes or migration notes

---

## Testing Coordination

When javascript-pro sets up test infrastructure:

### Test File Locations
```
/__tests__/
├── unit/
│   ├── lib/openrouter/
│   ├── lib/extraction/
│   └── lib/validation/
├── integration/
│   └── api/
└── component/
    └── extraction/
```

### Test Priority by Agent

| Agent | Test Focus | Priority Files |
|-------|------------|----------------|
| javascript-pro | Unit tests | openrouter/client.ts, transform.ts |
| backend-developer | Integration tests | API routes |
| frontend-developer | Component tests | Extraction forms |

---

## Rollback Protocol

If a change causes unexpected issues:

1. **Immediate:** Revert the specific commit
2. **Document:** Add to PROGRESS.md under "Reverted Changes" with reason
3. **Reassess:** Determine if approach needs modification
4. **Retry:** With adjusted approach after coordination

---

## Success Criteria

A change is considered complete when:

1. **No TypeScript errors** (`npm run type-check` passes)
2. **Lint passes** (`npm run lint` passes)
3. **Build succeeds** (`npm run build` passes)
4. **Manual verification** for UI changes
5. **Documentation updated** in PROGRESS.md
