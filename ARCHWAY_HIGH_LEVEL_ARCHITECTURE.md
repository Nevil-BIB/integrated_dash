# Archway Peak Insurance
High-level Architecture and End-to-End Process

## Overview
This document provides a detailed, step-by-step description of the full Archway Peak Insurance workflow, from user authentication through carrier automation and quote delivery. It is intended to describe the complete system behavior in a format suitable for building a high-level architecture diagram and for onboarding technical or operational stakeholders.

## Actors and Systems
- **User**: Insurance agent or internal staff using the web app.
- **Next.js App**: UI and API routes for intake, validation, and orchestration.
- **Supabase**: Auth, storage (PDFs), and Postgres data store.
- **OpenRouter/Claude**: AI extraction service for reading PDFs.
- **FastAPI + Selenium**: Carrier automation engine.
- **Carrier Portals**: Safeco, Cincinnati, Auto-Owners web systems.

## End-to-End Process (Detailed)

### 1) Authentication and Entry
- Step 1: User navigates to the Archway Peak Insurance web app.
- Step 2: User authenticates via Supabase Authentication.
- Step 3: After login, the user lands on the main UI with three primary options: Dashboard, Upload, and Generated Quotes.

### 2) Upload and Intake
- Step 4: User selects Upload.
- Step 5: User chooses a fact-finder PDF and uploads it.
- Step 6: The file is stored in Supabase Storage under the `fact-finders` bucket.
- Step 7: A new extraction record is created in Supabase `extractions` with status `pending`.

### 3) AI Extraction
- Step 8: The Next.js API route `/api/extract` downloads the PDF from Supabase Storage.
- Step 9: The PDF is converted into page images on the server.
- Step 10: Images are sent to OpenRouter/Claude with a structured extraction prompt.
- Step 11: Claude returns structured JSON for Home, Auto, or Combined data.
- Step 12: The response is validated with Zod schemas.
- Step 13: Extraction results are normalized and persisted to the `extractions` table.
- Step 14: The extraction status is updated to `completed` (or error if failed).

### 4) Data Review and Editing
- Step 15: The UI loads the extraction data and renders editable forms for Home and/or Auto fields.
- Step 16: The user reviews and corrects any extracted fields.
- Step 17: The user selects desired carriers for quoting: Safeco, Cincinnati, and/or Auto-Owners.
- Step 18: The user selects the quote type: Home, Auto, or Both (Combined).

### 5) Validation and Quote Submission
- Step 19: The app calls `/api/quotes/validate` to validate edited data.
- Step 20: Validation results are displayed; any errors must be resolved by the user.
- Step 21: The user submits the quote request.
- Step 22: `/api/quotes/submit` creates a new record in the `quotes` table.
- Step 23: The system transforms the data into the carrier automation payload format.
- Step 24: If configured, the system sends the payload to a `WEBHOOK_URL` for integration.

### 6) Automation Trigger (FastAPI)
- Step 25: Next.js calls the Python FastAPI `/generate-quote` endpoint with the payload and carrier selections.
- Step 26: FastAPI creates a job per carrier with a `job_id` based on the `quoteId`.
- Step 27: Each carrier job is queued as a background process.

### 7) Carrier Automation (Selenium)
- Step 28: For each carrier, the corresponding Selenium script is launched:
  - Safeco homeowners: `selenium_scripts/safeco_homeowners.py`
  - Cincinnati homeowners: `selenium_scripts/cincinnati_homeowners.py`
  - Auto-Owners homeowners: `selenium_scripts/autoowners_homeowners.py`
- Step 29: The script logs into the carrier portal using a configured Chrome profile.
- Step 30: The script navigates the quoting workflow and fills all required fields.
- Step 31: The script submits the quote and captures the result details.
- Step 32: A status JSON is written to `results/{job_id}.json` with status and timestamps.
- Step 33: If PDF generation is supported, a PDF is downloaded and stored in `quotes/{Carrier}_{job_id}.pdf`.
- Step 34: If a carrier flow fails, the script returns a failed status and logs details.

### 8) Result Tracking and Delivery
- Step 35: The UI periodically calls `/api/quotes/{id}/pdfs`.
- Step 36: The Next.js API proxies the request to FastAPI `/quote-pdfs/{quote_id}`.
- Step 37: The system returns a list of available carrier PDFs and statuses.
- Step 38: The user downloads PDFs via `/api/pdfs/[pdfId]/download` or previews them.
- Step 39: The Generated Quotes view reflects completion status per carrier.

## Data Flow Summary
- **Input**: User-uploaded PDF, user-edited form fields, carrier selection, quote type.
- **Intermediate**: Extracted structured JSON, normalized validation payload.
- **Output**: Quote results JSON, carrier PDFs, and UI-accessible download links.

## Primary Data Stores
- **Supabase Storage**: `fact-finders` bucket for uploaded PDFs.
- **Supabase Postgres**:
  - `extractions` table for AI extraction output and status.
  - `quotes` table for quote submissions and carrier job references.
- **Automation Host**:
  - `results/{job_id}.json` for job status and metadata.
  - `quotes/{Carrier}_{job_id}.pdf` for carrier PDFs.

## Major System Boundaries
- **UI Boundary**: Browser-based Next.js app.
- **App API Boundary**: Next.js API routes for extraction, validation, and quote submission.
- **AI Boundary**: OpenRouter/Claude extraction service.
- **Automation Boundary**: FastAPI + Selenium with carrier portal access.
- **Storage Boundary**: Supabase Storage and local automation filesystem.

## Failure Handling (High-Level)
- Extraction errors return a 500 with safe error messaging; failures are logged server-side.
- Validation errors block submission and return field-level details.
- Automation failures write a failed status JSON and surface in the UI as failed carriers.
- Cincinnati homeowners may fail without persisting error status in some cases (known issue).

## Notes for Diagramming
- Show three main UI entry points: Dashboard, Upload, Generated Quotes.
- Emphasize the split between Next.js API and FastAPI automation.
- Represent carrier selection and quote type selection as decision nodes.
- Show separate lanes for Supabase, OpenRouter, and Selenium automation.
- Include a polling loop from UI to retrieve PDF availability.
