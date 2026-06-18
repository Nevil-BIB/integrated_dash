# Archway -- Peak Insurance: Project Documentation

**Executive Overview**
This system automates insurance quote intake and carrier quoting by combining a Next.js web app, Supabase storage/database, AI-based PDF extraction, and a Python FastAPI + Selenium automation backend. Users upload a fact-finder PDF, the system extracts structured data via OpenRouter/Claude Vision, validates and normalizes the data, and triggers carrier-specific Selenium scripts that generate quotes and PDFs. Results are persisted in Supabase and local `results/` + `quotes/` folders on the automation host.

**Functional Requirements**
- Upload fact-finder PDFs and store them in Supabase storage.
- Convert PDFs to images server-side for AI extraction.
- Extract structured Home, Auto, or Combined (Home+Auto) data from PDFs.
- Validate extracted and user-edited data before submission.
- Transform validated data to a webhook payload format for automation.
- Trigger Selenium automation per selected carrier.
- Track quote job status and list available carrier PDFs.
- Provide PDF download and preview endpoints.

**System Architecture**
High-level flow (current implementation):
- UI (Next.js) authenticates users via Supabase.
- PDF upload stores file in Supabase storage bucket `fact-finders`.
- `/api/extract` downloads PDF, converts to images, calls OpenRouter for extraction, and writes extraction results to Supabase.
- User reviews/edits extraction data in UI (home/auto forms).
- `/api/quotes/validate` validates inputs.
- `/api/quotes/submit` creates a quote record, transforms data to webhook payload, sends webhook (optional), and triggers Selenium automation via the Python API.
- Python FastAPI `/generate-quote` spawns background jobs that run carrier scripts.
- Carrier scripts save `results/{job_id}.json` and (optionally) `quotes/{Carrier}_{job_id}.pdf`.
- UI polls `/api/quotes/{id}/pdfs` which proxies the Python API `/quote-pdfs/{quote_id}` for available PDFs.
- PDF download/preview routes proxy Python API `/pdf/{job_id}`.

Primary services and boundaries:
- Next.js App: UI, API routes, data validation, webhook payload building.
- Supabase: Authentication, `extractions` and `quotes` tables, PDF storage.
- OpenRouter/Claude: Extracts structured data from PDF images.
- Python FastAPI + Selenium: Carrier automation, quote PDF generation, job status persistence.

**Technology Stack**
- Frontend: Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI, lucide-react.
- Backend (App): Next.js API routes, Supabase SSR client, Zod for schema validation, pdfjs-dist + @napi-rs/canvas for server-side PDF rendering.
- AI extraction: OpenRouter API with Claude (model `anthropic/claude-sonnet-4`).
- Automation: FastAPI + Selenium WebDriver + Chrome profiles; PyAutoGUI used for some UI clicks.
- Data: Supabase Postgres (`extractions`, `quotes` tables), Supabase Storage bucket `fact-finders`.
- Testing: Vitest.

**Environment Variables**
These are required or referenced in code:
- `OPENROUTER_API_KEY` used by OpenRouter client.
- `SELENIUM_API_URL` used by Next.js to call FastAPI `/generate-quote`.
- `WEBHOOK_URL` optional endpoint for webhook delivery.
- `NEXT_PUBLIC_APP_URL` used for OpenRouter `HTTP-Referer` header and CORS allowlist.

**Folder Structure (Top Level)**
```
api.py                      FastAPI service & endpoints
selenium_scripts/           Carrier automation scripts
peak-ins-quoter/            Next.js web app
results/                    Job status JSON files
quotes/                     Generated quote PDFs
cincinnati/                 Chrome profile for Cincinnati automation
safeco/                     Chrome profile for Safeco automation
autoowners/                 Chrome profile for Auto-Owners automation
```

**Folder Structure (Next.js App)**
```
peak-ins-quoter/
  src/
    app/                    App Router pages + API routes
    components/             UI and form components
    hooks/                  React hooks (auto-save, upload, etc.)
    lib/                    Domain logic (extraction, webhook, validation, pdf)
    types/                  Shared types
    __tests__/              Unit tests
  supabase/                 Migrations and configuration
  docs/examples/            Sample payloads
```

**Code Structure & Standards**
- Frontend uses App Router conventions under `peak-ins-quoter/src/app`.
- API routes are colocated in `src/app/api/*/route.ts`.
- Shared domain logic lives in `src/lib`.
- Types are centralized in `src/types` and consumed across UI and API.
- Supabase migrations in `peak-ins-quoter/supabase/migrations`.
- Python automation uses one `run(payload, job_id)` entry point per carrier script and is dispatched via `selenium_scripts/__init__.py`.

**Naming Conventions**
- React components use `PascalCase` filenames and exports, for example `HomeExtractionForm.tsx`.
- Hooks use `useX` naming, for example `use-auto-save.ts`.
- Utility and module files use `kebab-case` or lower-case, for example `quote-validator.ts`, `client.ts`.
- Functions and variables use `camelCase`.
- Constants use `UPPER_SNAKE_CASE`, for example `HOME_PROPERTY_FIELDS`.
- Python scripts use `snake_case` and define `run()` as the public entry.

**Coding Standards**
- TypeScript strict mode enabled (`tsconfig.json`).
- ESLint configured with Next.js core-web-vitals and TypeScript rules (`eslint.config.mjs`).
- Centralized alias `@/*` for imports (`tsconfig.json`).
- JSON responses use consistent `success` + `errors` or `error` patterns in API routes.
- Supabase RLS policies in migrations ensure user isolation.

**Design Patterns Used**
- Layered architecture: UI → API routes → lib services → external services.
- Transformation layer: `src/lib/webhook/transform.ts` converts UI/DB models into automation payloads.
- Validation layer: `src/lib/validation/quote-validator.ts` and OpenRouter Zod schemas.
- Adapter/service wrapper: `src/lib/selenium/client.ts` encapsulates HTTP calls to FastAPI.
- Data normalization: `src/lib/extraction/transform.ts` reconciles API, UI, and legacy extraction formats.
- Batch processing: OpenRouter extraction operates in batches of pages with merging logic.

**Carrier Quote Types and How Each Works**

Safeco (Homeowners)
- Entry point: `selenium_scripts/safeco_homeowners.py` `run(payload, job_id)`.
- Uses persistent Chrome profile under `safeco/`.
- Logs into Safeco portal and navigates to homeowners quote flow.
- Fills policy details, personal info, property, occupancy, safety, coverage, updates.
- Generates report menu, selects print options, and downloads PDF via HTTP request to current URL.
- Writes result JSON to `results/{job_id}.json` with `pdf_path` and `completed_at`.
- Returns `status: completed` or `status: failed`.

Auto-Owners (Homeowners)
- Entry point: `selenium_scripts/autoowners_homeowners.py` `run(payload, job_id)`.
- Uses incognito Chrome; logs into Auto-Owners portal.
- Starts proposal, fills property and insured data.
- Calls replacement cost estimator and completes valuation.
- Writes result JSON with `status: completed` and timestamps.
- PDF generation is not implemented in this script.

Cincinnati (Homeowners)
- Entry point: `selenium_scripts/cincinnati_homeowners.py` `run(payload, job_id)`.
- Uses persistent Chrome profile under `cincinnati/`.
- Logs in to Cincinnati portal and navigates to Personal Lines Processing.
- Registers client, fills household and property data.
- Navigates through coverage pages and form options.
- Prints and downloads PDF via Chrome kiosk printing.
- Renames most recent PDF to `quotes/Cincinnati_{job_id}.pdf`.
- Writes result JSON with `pdf_path` on success.
- Current error path returns an error but does not always persist it to `results/`.

Auto Quote Implementations (Current Status)
- `selenium_scripts/cincinnati_auto.py` contains a `run` function but is not wired into `api.py`.
- `selenium_scripts/safeco_auto.py` is a standalone `main()` with partial logic and not integrated.
- `selenium_scripts/autoowners_auto.py` is empty.
- `api.py` only maps Homeowners runs via `CARRIER_SCRIPT_MAP`.

**API Endpoints**
Python FastAPI (`api.py`):
- `POST /generate-quote` queues a job per carrier.
- `GET /job-status/{job_id}` returns job status JSON from `results/`.
- `GET /quote-pdfs/{quote_id}` lists PDFs for a quote across carriers.
- `GET /pdf/{job_id}` streams a PDF file for a specific carrier job.

Next.js API:
- `POST /api/extract` runs PDF extraction and stores results.
- `GET /api/extract?id=...` fetches extraction status.
- `POST /api/quotes/validate` returns field-level validation results.
- `POST /api/quotes/submit` creates a quote, sends webhook payload, triggers Selenium automation.
- `GET /api/quotes/[id]/pdfs` proxies to Python `/quote-pdfs/{quote_id}`.
- `GET /api/pdfs/[pdfId]/download` and `/preview` proxy to Python `/pdf/{job_id}`.

**Database Schema**
Supabase tables:
- `extractions`: tracks uploaded PDFs, extraction results, and status.
- `quotes`: tracks submissions, RPA job IDs, and carrier quotes.
RLS policies restrict access to authenticated users’ records.

**Error Handling Strategy**
Next.js API:
- Validates content type and request body parsing.
- Returns explicit `4xx` errors for invalid input or unauthorized access.
- Uses `try/catch` to return `500` with safe, generic messages.
- Extraction route logs full errors server-side but only returns generic failure.

OpenRouter Extraction:
- Validates parsed JSON with Zod schemas.
- Logs validation issues and continues with partial data if schema fails.
- Batches pages; failed batches do not abort the entire extraction.

Python Automation:
- Each carrier script wraps the main flow in `try/except`.
- On success, writes a completed status JSON to `results/{job_id}.json`.
- On failure, writes a failed status JSON for Safeco and Auto-Owners.
- Cincinnati homeowners has a `write_result` on success but the failure branch currently returns without persisting the error.

**Logging Strategy**
Next.js:
- Uses `console.log` and `console.error` extensively in API routes and OpenRouter client.
- Logs include request flow markers and error stack traces server-side.

Python:
- Uses `print()` statements and sometimes `pdb.set_trace()` for debugging.
- No centralized logging or structured log format.

**Notable Implementation Details**
- Job IDs in Python are based on `quoteId` plus carrier suffix when available: `{quoteId}_{Carrier}`.
- PDF path expectations: `quotes/{Carrier}_{job_id}.pdf`.
- Extraction results store carrier selections under `_meta.carriers` for downstream filtering.
- `HomeExtractionForm.tsx` renders sections with carrier-specific field groupings and supports auto-save.

**Security and Data Handling Notes**
- `selenium_scripts/config.py` currently stores plaintext carrier credentials and URLs.
- OpenRouter API key is read from environment and never logged.
- Supabase RLS policies prevent cross-user data access.

**Relevant Files**
- FastAPI: `api.py`
- Selenium entry points: `selenium_scripts/__init__.py`
- Safeco homeowners: `selenium_scripts/safeco_homeowners.py`
- Auto-Owners homeowners: `selenium_scripts/autoowners_homeowners.py`
- Cincinnati homeowners: `selenium_scripts/cincinnati_homeowners.py`
- Extraction API: `peak-ins-quoter/src/app/api/extract/route.ts`
- Quote submit API: `peak-ins-quoter/src/app/api/quotes/submit/route.ts`
- Webhook transform: `peak-ins-quoter/src/lib/webhook/transform.ts`
- Extraction transform: `peak-ins-quoter/src/lib/extraction/transform.ts`
- OpenRouter client: `peak-ins-quoter/src/lib/openrouter/client.ts`
- Supabase migrations: `peak-ins-quoter/supabase/migrations/*.sql`
