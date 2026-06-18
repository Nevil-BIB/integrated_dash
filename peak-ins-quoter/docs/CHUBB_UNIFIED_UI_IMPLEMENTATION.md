# Chubb Unified UI — Implementation Plan

**Project:** Peak Quote (Fact Finder)  
**Carrier (Phase 1):** Chubb Home  
**Aligned with:** Priyansh unified UI approach — one combined carrier/product selector, carrier-specific JSON schema, per-carrier review, per-carrier execute  
**Backend reference:** Chubb Playwright automation field map (required + optional payload keys)  
**Last updated:** Jun 9, 2026

---

## 1. Goal

Evolve the existing Fact Finder UI into a **single unified quoting interface** starting with **Chubb Home**. Each carrier/product combination will have its own schema that drives extraction, review, validation, and automation payload — instead of one broad home schema shared across all carriers.

---

## 2. Architecture (target state)

```
Upload PDF
    ↓
Select carrier product (e.g. Chubb Home)
    ↓
Extract using carrier-specific schema
    ↓
Review / edit carrier-specific fields only
    ↓
Validate required fields (schema-driven)
    ↓
Execute → POST /generate-quote/playwright/chubb
    ↓
Poll job status → show carrier-specific result
```

**Source of truth:** `src/lib/carriers/chubb-home-schema.ts` mirrors backend automation field keys, required/optional flags, types, and portal steps.

---

## 3. Chubb field contract (from backend)

### Required (automation fails if missing)

| Field key | Step | Type |
|-----------|------|------|
| `insuranceDetails.effectiveDate` | Policy information | date (MM/DD/YYYY) |
| `personal.firstName` | Client info | text |
| `personal.lastName` | Client info | text |
| `personal.applicantDOB` / `personal.dateOfBirth` | Client info | date |
| `property.streetAddress` / `personal.address` | Residence address | text (autocomplete) |
| `buildingType` | HCE modal | dropdown |
| `livingAreaSqFt` | HCE modal | number |
| `yearBuilt` | HCE modal | dropdown/number |
| `classification` | HCE modal | dropdown |

> Building value is **not** in payload — filled by Calculate in HCE modal (automation).

### Optional

Grouped by portal step: HCE modal extras, residence main form, risk section, state detail, discount detail, losses. See `src/lib/carriers/chubb-home-schema.ts` for the full list.

### Not from payload (env / hardcoded)

- Producer / sub-producer codes → env
- Occupation → hardcoded in automation
- Residence type → always "House"
- Login credentials, MFA OTP → env / webhook

---

## 4. Implementation phases

### Phase 1 — Foundation (current session)

| Step | File(s) | What we do |
|------|---------|------------|
| 1.1 | `docs/CHUBB_UNIFIED_UI_IMPLEMENTATION.md` | This document |
| 1.2 | `src/lib/carriers/types.ts` | Carrier option IDs, field definition types |
| 1.3 | `src/lib/carriers/chubb-home-schema.ts` | Full Chubb field map (required + optional, steps, keys) |
| 1.4 | `src/lib/carriers/index.ts` | Public exports |
| 1.5 | `src/components/pdf/pdf-upload-zone.tsx` | Combined carrier/product selector (Chubb Home first) |
| 1.6 | `src/hooks/use-upload.ts` | Pass `carrierOptionId` to extract API |
| 1.7 | `src/app/api/extract/route.ts` | Accept `carrierOptionId`, persist `workflow.carrierOptionId` in `extracted_data` |

**Outcome:** User selects **Chubb Home** at upload; extraction record stores which carrier product was chosen.

---

### Phase 2 — Schema-driven review UI

| Step | File(s) | What we do |
|------|---------|------------|
| 2.1 | `src/components/extraction/ChubbReviewSections.tsx` (new) | Render only Chubb-relevant sections from schema |
| 2.2 | `ExtractionReview.tsx` | When `workflow.carrierOptionId === 'chubb-home'`, show Chubb sections only |
| 2.3 | `home-extraction.ts` | Mark HCE required fields (`buildingType`, `livingAreaSqFt`, `yearBuilt`, `classification`) as `required: true` in schema alignment |
| 2.4 | `review-page-client.tsx` | Block "Proceed to Quote" until Chubb required fields pass |

**Outcome:** Review page shows carrier-scoped fields with correct required validation.

---

### Phase 3 — Schema-driven quote preview & payload

| Step | File(s) | What we do |
|------|---------|------------|
| 3.1 | `src/lib/carriers/chubb-payload.ts` (new) | Map `HomeExtractionResult` → flat `fields[]` for Chubb API |
| 3.2 | `QuotePreviewClient.tsx` | Use Chubb schema for required/optional validation instead of ad-hoc lists |
| 3.3 | `QuotePreviewClient.tsx` | Dynamic endpoint from `carrierOptionId` (remove hardcoded Chubb comment switching) |
| 3.4 | Job status UI | Show Chubb step names from `GET .../chubb/:jobId` |

**Outcome:** Submit sends a payload that matches backend automation exactly.

---

### Phase 4 — Extraction alignment

| Step | File(s) | What we do |
|------|---------|------------|
| 4.1 | OpenRouter prompts | When `carrierOptionId` is Chubb Home, extract only Chubb schema fields |
| 4.2 | `src/app/api/extract/route.ts` | Branch extraction prompt by carrier schema |
| 4.3 | Reduce noise | Stop extracting Safeco/Cincinnati-only fields for Chubb workflows |

**Outcome:** PDF extraction returns only data Chubb needs.

---

### Phase 5 — Multi-carrier expansion (future)

| Step | What we do |
|------|------------|
| 5.1 | Add more entries to combined selector (Geico Auto, Cincinnati Home, Progressive Auto, …) |
| 5.2 | One schema file per carrier product |
| 5.3 | Multi-select → multiple review tabs + multiple execute jobs |
| 5.4 | Per-carrier quote delivery (Save / Email / in-portal) |

---

## 5. Data model changes

### Workflow metadata (stored in `extracted_data`)

```typescript
workflow: {
  carrierOptionId: 'chubb-home'   // combined selector value
  carrierId: 'chubb'
  productType: 'home'
  schemaVersion: '1'
}
```

No database migration required for Phase 1 — metadata lives inside existing `extracted_data` JSONB.

---

## 6. Key mapping rules (UI → backend)

| UI section | Canonical payload prefix |
|------------|--------------------------|
| Personal | `personal.*` |
| Policy | `insuranceDetails.*` |
| Address | `property.streetAddress`, `personal.address` |
| HCE + coverage amounts | `chubbHomeCoverageEstimator.*` or flat keys |
| Homeowners risk fields | `homeownersInformations.*` |
| Location | `locationDetail.*` |
| Property extras | `property.*` |
| Losses | `hasHomeownersLossesPast7Years`, `claimsHistory.claims[]` |

Backend resolves aliases automatically; UI should prefer **canonical keys** from `chubb-home-schema.ts`.

---

## 7. Testing checklist

- [ ] Upload with **Chubb Home** selected → `workflow.carrierOptionId` saved
- [ ] Review page loads Chubb sections for Chubb workflow
- [ ] Required Chubb fields block proceed when empty
- [ ] Quote submit payload includes all required keys
- [ ] Optional fields omitted when empty (automation skips them)
- [ ] Job status polling works on Chubb endpoint
- [ ] Legacy extractions without `workflow` still load (backward compatible)

---

## 8. Out of scope (Phase 1)

- New database column for carrier (using JSONB metadata instead)
- Multi-carrier selection in one session
- Carrier-specific extraction prompts (Phase 4)
- Quote delivery UI (Save / Email) — depends on portal behavior per carrier

---

## 9. References

- Backend field map: provided by backend team (Chubb automation field map)
- Meeting alignment: combined dropdown + per-carrier JSON schema (Priyansh)
- Existing Chubb UI: `ChubbHomeCoverageEstimatorEditor.tsx`, `QuotePreviewClient.tsx`
- Backend automation: `peak-backend/src/playwright-automation/playwrightChubb.*.ts`
