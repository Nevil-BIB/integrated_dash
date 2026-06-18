# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Fact Finder Extraction Application** - A Next.js application for insurance professionals that:
- Allows authenticated users to upload scanned fact finder PDFs
- Extracts prospect data using Claude Vision via OpenRouter
- Validates data against Home/Auto quote schemas
- Prepares validated data for RPA automation to carrier sites
- Stores extraction history with confidence scoring

> **Development Progress:** See `PROGRESS.md` for detailed implementation status and next steps.

## IMPORTANT: Keep Progress Updated

**After each development session, update `PROGRESS.md` with:**

1. **Session date and focus area**
2. **What was built/changed** - New files, updated files, features added
3. **Bugs fixed** - Description and solution
4. **Key decisions made** - Architecture choices, tradeoffs
5. **Next steps** - What remains to be done

This ensures continuity between sessions and helps track project evolution. The document serves as both a changelog and a reference for understanding what exists in the codebase.

## Mandatory: Use Custom Agents

**CRITICAL**: This project has custom Claude Code agents configured in `.claude/agents/`. Always use the appropriate specialized agent for tasks:

| Task Type | Agent to Use |
|-----------|--------------|
| React components, UI, forms, styling | `frontend-developer` |
| API routes, Supabase, authentication | `backend-developer` |
| Next.js App Router, server actions, SSR | `nextjs-developer` |
| Complex async operations, streams | `javascript-pro` |
| Visual design, accessibility, design systems | `ui-designer` |
| Error investigation, root cause analysis, debugging | `error-detective` |
| Multi-part features (3+ domains) | `agent-organizer` first |
| State sync between features | `context-manager` |

**Workflow**: For any non-trivial task, evaluate which agent applies → launch via Task tool → implement.

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth/DB/Storage**: Supabase
- **AI**: Claude Vision (anthropic/claude-sonnet-4) via OpenRouter API

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
```

## Architecture

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth route group (login, etc.)
│   ├── (protected)/         # Protected routes (dashboard, upload, review)
│   ├── api/                 # API routes
│   │   ├── extract/         # PDF extraction endpoint
│   │   └── upload/          # File upload handling
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── pdf/                 # PDF viewer, upload components
│   ├── extraction/          # Extraction review, field editors
│   └── forms/               # Form template components
├── lib/
│   ├── supabase/            # Supabase client configs
│   ├── openrouter/          # OpenRouter API client
│   └── pdf/                 # PDF to image conversion
├── types/                   # TypeScript type definitions
└── utils/                   # Shared utilities
```

## Core Features

### Authentication (Supabase Auth)
- Email/password login
- All routes except `/login` protected via middleware
- Redirect unauthenticated users to login
- Users access only their own data (RLS)

### PDF Processing Pipeline
1. Upload PDF (max 20MB, scanned/image-based documents)
2. Convert each page to base64 image
3. Send to Claude Vision via OpenRouter
4. Return structured JSON with confidence indicators
5. Store PDF in Supabase Storage, metadata in database

### Extraction Data Structure
```typescript
interface ExtractionResult {
  fields: {
    [key: string]: {
      value: string | null;
      confidence: 'high' | 'medium' | 'low';
      flagged: boolean;  // illegible, ambiguous, or missing
      rawText?: string;
    };
  };
  // Field categories: personal, employment, coverage, beneficiary, health, policies, financials
}
```

### Review Interface
- Side-by-side: original PDF | extracted data form
- Editable fields before submission
- Visual highlighting for low-confidence and flagged fields
- Field mapping to target insurance form template (TBD)

## Database Schema (Supabase)

```sql
-- extractions table
id: uuid (PK)
user_id: uuid (FK to auth.users)
filename: text
storage_path: text
extracted_data: jsonb
status: text ('pending' | 'processing' | 'completed' | 'failed')
created_at: timestamptz
updated_at: timestamptz
```

## OpenRouter Integration

```typescript
// Endpoint: https://openrouter.ai/api/v1/chat/completions
// Model: anthropic/claude-sonnet-4

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://your-domain.com',
    'X-Title': 'Fact Finder Extraction',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'anthropic/claude-sonnet-4',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Extract all prospect information...' },
        { type: 'image_url', url: `data:image/png;base64,${base64Image}` }
      ]
    }]
  })
});
```

## Key Implementation Notes

### PDF to Image Conversion (CRITICAL)

The PDF conversion uses `pdfjs-dist` with `@napi-rs/canvas` for server-side rendering in Next.js API routes.

**Why this specific setup:**
- `pdfjs-dist` requires a web worker, which doesn't work in Next.js server environment
- The solution pre-loads the worker on `globalThis.pdfjsWorker` before importing pdfjs
- Uses `@napi-rs/canvas` instead of `node-canvas` for better compatibility with scanned PDFs

**Key files:**
- `/src/lib/pdf/converter.ts` - PDF to base64 image conversion
- `/src/types/pdfjs-worker.d.ts` - Type declaration for worker module
- `/next.config.ts` - Server external packages configuration

**Worker initialization pattern:**
```typescript
// Pre-load worker on globalThis BEFORE importing pdfjs
const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
(globalThis as Record<string, unknown>).pdfjsWorker = {
  WorkerMessageHandler: worker.WorkerMessageHandler,
};

// Now import pdfjs - it finds the worker already available
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
```

**next.config.ts requirements:**
```typescript
serverExternalPackages: [
  "pdfjs-dist",
  "@napi-rs/canvas",
],
```

### OpenRouter API Integration

**Model ID:** `anthropic/claude-sonnet-4` (NOT `claude-sonnet-4-20250514`)

**Image format requirements:**
- Images must be PNG format with correct mime type: `data:image/png;base64,...`
- Base64 must be cleaned (no whitespace, newlines, or existing prefixes)
- The converter outputs PNG by default

**Base64 cleaning:**
```typescript
function cleanBase64(base64: string): string {
  let cleaned = base64.replace(/^data:image\/[a-z]+;base64,/i, '')
  cleaned = cleaned.replace(/[\s\n\r]/g, '')
  return cleaned
}
```

### General Notes

- **Chunking**: Process max 5 pages per API call to stay within context limits
- **Confidence Scoring**: Claude assesses field clarity and returns high/medium/low confidence
- **Flagging**: Fields that are illegible, ambiguous, or missing are flagged for review
- **Error Handling**: Graceful handling with fallback to default extraction result
- **Progress UI**: Real-time status during upload and multi-page extraction

## Troubleshooting

### PDF Worker Errors

**Error:** `Setting up fake worker failed: "Cannot find module 'pdf.worker.mjs'"`

**Solution:** The worker must be pre-loaded on `globalThis.pdfjsWorker` before importing pdfjs. Check:
1. `src/lib/pdf/converter.ts` - Uses `initializePdfJs()` with worker pre-loading
2. `next.config.ts` - Has `pdfjs-dist` in `serverExternalPackages`
3. Clear `.next` cache: `rm -rf .next`

### OpenRouter API Errors

**Error:** `anthropic/claude-sonnet-4-20250514 is not a valid model ID`
**Solution:** Use `anthropic/claude-sonnet-4` (without date suffix)

**Error:** `invalid base64 data`
**Solution:**
1. Ensure images use correct mime type (`image/png` for PNG output)
2. Clean base64 data to remove whitespace/prefixes
3. Check `src/lib/openrouter/client.ts` - `cleanBase64()` function

### Canvas/Rendering Errors

**Error:** `@napi-rs/canvas is not available in this environment`
**Solution:** Add `@napi-rs/canvas` to `serverExternalPackages` in `next.config.ts`

**Error:** `Image or Canvas expected`
**Solution:** Use `@napi-rs/canvas` instead of `canvas` (node-canvas) for better pdfjs compatibility

### Database/Storage Errors

**Error:** `new row violates row-level security policy`
**Solution:** Run the migrations in `supabase/migrations/` to set up RLS policies

## Custom Agents Reference

Located in `.claude/agents/`:

| Agent | Primary Use |
|-------|-------------|
| `frontend-developer` | UI components, forms, styling, accessibility, React patterns |
| `backend-developer` | API routes, Supabase integration, auth flows, data validation |
| `nextjs-developer` | App Router structure, server components, server actions, SSR/SSG |
| `javascript-pro` | Async patterns, streams, file processing, performance |
| `ui-designer` | Visual design, color schemes, typography, dark mode, design systems |
| `error-detective` | Error pattern analysis, root cause investigation, debugging cascading failures |
| `agent-organizer` | Decompose complex features, coordinate multiple agents |
| `context-manager` | Sync state across related features, manage shared context |

**Always prefer using these agents over manual implementation for their respective domains.**
