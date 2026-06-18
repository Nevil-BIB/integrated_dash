# Archway Peak Insurance
Technical & Functional Documentation v1.0

## 1.1) Overview:
This document provides a detailed overview of the technical and functional aspects of the Archway Peak Insurance quoting system. It is intended to serve as a comprehensive guide for understanding the design, functionality, and implementation of the system, offering insights for both technical users and non-technical stakeholders.

From a functional perspective, the document describes the core functionalities, user workflows, and overall objectives of the system. It outlines how the system meets specific business requirements and addresses end-user needs, detailing its features, capabilities, and interactions.

From a technical perspective, the document covers the architecture, technology stack, and system components that power the solution.

## 2.1) Functional Design:

### 2.1.1) Core Functionality:
The main function of this system is to intake insurance fact-finder PDFs, extract structured data using AI, validate and normalize that data, and then run carrier-specific automation to generate quote results and PDFs. It works with Supabase for authentication, storage, and persistence, OpenRouter/Claude for extraction, and a Python FastAPI + Selenium backend for carrier automation.

### 2.1.2) User Interactions:
After login, users upload a fact-finder PDF. The system extracts data and presents editable Home, Auto, or Combined forms. Users review and correct fields as needed, then submit a quote request. The app validates inputs, creates a quote record, and triggers carrier automation. Users can monitor status and download carrier PDFs once available.

### 2.1.3) Input Parameters:
- `PDF Upload`: Fact-finder PDF provided by the user. This is the primary source of intake data.
- `Carrier Selection`: Selected carriers determine which automation scripts run.
- `Home/Auto Form Data`: User-reviewed and edited fields used for validation and automation payloads.
- `Environment Variables`: Required for execution. `OPENROUTER_API_KEY`, `SELENIUM_API_URL`, and `NEXT_PUBLIC_APP_URL`. Optional `WEBHOOK_URL` for downstream integrations.

### 2.1.4) Output Format:
- `Extraction Output`: Structured JSON stored in Supabase `extractions` table.
- `Quote Record`: Submission metadata stored in Supabase `quotes` table.
- `Automation Results`: JSON files written to `results/{job_id}.json` with status and metadata.
- `Quote PDFs`: Carrier PDFs written to `quotes/{Carrier}_{job_id}.pdf` when available.
- `API Responses`: Consistent JSON responses with `success` and `errors` or `error` fields.

## 3.1) Technical Specifications:

### 3.1.1) Tech Stack:
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI, lucide-react.
- **Backend (App)**: Next.js API routes, Supabase SSR client, Zod validation, pdfjs-dist + @napi-rs/canvas for PDF rendering.
- **AI Extraction**: OpenRouter API with Claude (model `anthropic/claude-sonnet-4`).
- **Automation**: Python FastAPI, Selenium WebDriver, Chrome profiles, PyAutoGUI for UI clicks as needed.
- **Data**: Supabase Postgres tables `extractions` and `quotes`, Supabase Storage bucket `fact-finders`.
- **Testing**: Vitest.

### 3.1.2) Requirements:
- Node.js 18+ for the Next.js app.
- Python 3.9+ for the FastAPI automation service.
- Valid API keys and credentials for OpenRouter, Supabase, and carrier portals.
- Chrome installed on the automation host with required profiles under `cincinnati/`, `safeco/`, and `autoowners/`.

### 3.1.3) Installation:
Installation steps are documented in the project `README.md`. Additional setup guidance for the automation backend and PDF extraction is available in `PDF_BACKEND_SETUP.md` and `INTEGRATION.md`.

### 3.1.4) High-level Architecture:
The system is organized into the following major components:
- **Next.js App**: UI, API routes, validation, webhook payload building.
- **Supabase**: Authentication, storage for PDFs, and persistence of extraction and quote records.
- **OpenRouter/Claude**: AI extraction of structured data from PDF images.
- **FastAPI + Selenium**: Carrier automation scripts, status tracking, and PDF generation.

High-level architecture steps:
Step 1: User authenticates in the Next.js app via Supabase.
Step 2: User lands on the main navigation with three primary options: Dashboard, Upload, and Generated Quotes.
Step 3: User selects Upload to start a new quote intake.
Step 4: User chooses a fact-finder PDF and uploads it to Supabase Storage (Fact-finders).
Step 5: The system converts the PDF to images and invokes OpenRouter/Claude for data extraction.
Step 6: Extracted data is normalized and stored in the extractions table.
Step 7: The UI renders editable forms for Home, Auto, or Combined data.
Step 8: User selects carriers for quoting: Safeco, Cincinnati, and/or Auto-Owners.
Step 9: User selects the quote type: Home, Auto, or Both (Combined).
Step 10: The system validates inputs and builds an automation payload.
Step 11: Next.js triggers FastAPI /generate-quote to run selected carrier scripts.
Step 12: FastAPI runs Selenium automation for each carrier and writes results to 
esults/{job_id}.json.
Step 13: Carrier PDFs are generated when supported and saved as quotes/{Carrier}_{job_id}.pdf.
Step 14: The Generated Quotes view polls for available PDFs and exposes downloads to the user.

(Architecture diagram to be added.)

## 4.1) Workflow Sequence:
Step 1: User logs in and uploads a fact-finder PDF.
Step 2: PDF is stored in Supabase Storage (`fact-finders`).
Step 3: `/api/extract` downloads the PDF, converts it to images, and calls OpenRouter for extraction.
Step 4: Extracted data is validated and stored in the `extractions` table.
Step 5: User reviews and edits data in the UI.
Step 6: `/api/quotes/validate` validates the edited inputs.
Step 7: `/api/quotes/submit` creates a quote record and builds the automation payload.
Step 8: The app triggers Python FastAPI `/generate-quote` to run carrier automation.
Step 9: Carrier scripts produce results JSON and quote PDFs where supported.
Step 10: UI polls `/api/quotes/{id}/pdfs` and displays available carrier PDFs for download.

## 4.2) Example Tickets:
(Example screenshots to be added.)
