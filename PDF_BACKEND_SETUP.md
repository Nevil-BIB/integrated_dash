# PDF Backend Setup - Implementation Complete

## Overview

Successfully configured the backend to handle PDF downloads from Selenium scripts and serve them through FastAPI endpoints.

---

## Changes Made

### 1. Selenium Script (cincinnati_homeowners.py)

#### Directory Setup
```python
RESULTS_DIR = Path("results")
QUOTES_DIR = Path("quotes")
RESULTS_DIR.mkdir(exist_ok=True)
QUOTES_DIR.mkdir(exist_ok=True)  # Creates quotes directory
```

#### Chrome Options for PDF Download
```python
# PDF Download and Printing Settings
prefs = {
    "download.default_directory": str(QUOTES_DIR.resolve()),
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "plugins.always_open_pdf_externally": True  # Disables Chrome PDF Viewer
}
opts.add_experimental_option("prefs", prefs)
opts.add_argument("--kiosk-printing")  # Auto-clicks print
```

#### PDF Download Handling
```python
# After clicking print button
wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[id*='PrintControl_btnPrintNow']"))).click()

# Wait for PDF download
time.sleep(5)

# Find and rename the downloaded PDF
pdf_files = list(QUOTES_DIR.glob("*.pdf"))
if pdf_files:
    latest_pdf = max(pdf_files, key=lambda p: p.stat().st_mtime)
    pdf_path = QUOTES_DIR / f"Cincinnati_{job_id}.pdf"
    latest_pdf.rename(pdf_path)
else:
    pdf_path = None

# Include PDF path in result
result = {
    "status": "completed",
    "job_id": job_id,
    "carrier": "Cincinnati",
    "quote_type": "Homeowners",
    "pdf_path": str(pdf_path) if pdf_path else None,
    "completed_at": datetime.utcnow().isoformat()
}
```

---

### 2. FastAPI Backend (api.py)

#### Added QUOTES_DIR
```python
RESULTS_DIR = Path("results")
QUOTES_DIR = Path("quotes")
RESULTS_DIR.mkdir(exist_ok=True)
QUOTES_DIR.mkdir(exist_ok=True)
```

#### Added FileResponse Import
```python
from fastapi.responses import FileResponse
```

#### New PDF Serving Endpoint
```python
@app.get("/pdf/{job_id}")
def get_pdf(job_id: str):
    # Read job status to get PDF path
    status_file = RESULTS_DIR / f"{job_id}.json"
    if not status_file.exists():
        raise HTTPException(404, "Job not found")
    
    with open(status_file) as f:
        job_data = json.load(f)
    
    # Get PDF path from job data
    pdf_path = job_data.get("pdf_path")
    if not pdf_path:
        raise HTTPException(404, "PDF not found for this job")
    
    # Verify PDF exists
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        raise HTTPException(404, "PDF file does not exist")
    
    # Serve the PDF
    return FileResponse(
        pdf_file,
        media_type="application/pdf",
        filename=pdf_file.name
    )
```

---

## Architecture Flow

```
User submits quote
    ↓
FastAPI creates job_id
    ↓
Selenium script runs
    ↓
Chrome downloads PDF to quotes/{job_id}.pdf
    ↓
Script renames PDF to Cincinnati_{job_id}.pdf
    ↓
Script writes result with pdf_path
    ↓
Frontend polls /job-status/{job_id}
    ↓
Response includes pdf_path
    ↓
Frontend calls /pdf/{job_id}
    ↓
FastAPI serves PDF from quotes directory
```

---

## API Endpoints

### POST /generate-quote
Creates quote jobs and returns job IDs

**Response:**
```json
{
  "success": true,
  "jobs": {
    "Cincinnati": "uuid-here"
  }
}
```

### GET /job-status/{job_id}
Returns job status and PDF path

**Response (when completed):**
```json
{
  "status": "completed",
  "job_id": "uuid-here",
  "carrier": "Cincinnati",
  "quote_type": "Homeowners",
  "pdf_path": "quotes/Cincinnati_uuid-here.pdf",
  "completed_at": "2026-01-28T11:30:00.000000"
}
```

### GET /pdf/{job_id}
Streams the PDF file

**Response:** PDF file download

---

## Directory Structure

```
project/
├── results/                  # Job status JSON files
│   └── {job_id}.json
├── quotes/                   # Generated PDF files
│   └── Cincinnati_{job_id}.pdf
├── selenium_scripts/
│   └── cincinnati_homeowners.py
└── api.py                    # FastAPI backend
```

---

## File Naming Convention

- **Status files**: `results/{job_id}.json`
- **PDF files**: `quotes/{Carrier}_{job_id}.pdf`

Example:
- Status: `results/abc-123.json`
- PDF: `quotes/Cincinnati_abc-123.pdf`

---

## Error Handling

The backend handles the following scenarios:

1. **Job not found**: Returns 404 if job_id doesn't exist
2. **PDF not generated**: Returns 404 if pdf_path is null in job data
3. **File missing**: Returns 404 if PDF file was deleted

---

## Testing

### 1. Test Selenium PDF Download
Run the Selenium script and verify:
- PDF is downloaded to `quotes/` directory
- PDF is renamed to `Cincinnati_{job_id}.pdf`
- `results/{job_id}.json` contains `pdf_path` field

### 2. Test API Endpoints

**Check job status:**
```bash
curl http://localhost:5555/job-status/{job_id}
```

**Download PDF:**
```bash
curl http://localhost:5555/pdf/{job_id} --output test.pdf
```

---

## Next Steps

1. Apply same changes to other Selenium scripts:
   - `safeco_homeowners.py`
   - `autoowners_homeowners.py`

2. Implement frontend PDF display using the `/pdf/{job_id}` endpoint

3. Consider adding PDF cleanup job to remove old PDFs

---

## Summary

✅ **QUOTES_DIR** created and configured  
✅ **Chrome options** set for automatic PDF download  
✅ **PDF renaming** based on job_id  
✅ **PDF path tracking** in job results  
✅ **FastAPI endpoint** to serve PDFs  
✅ **Error handling** for missing files  

The backend is now fully configured to handle PDF downloads and serving in a clean, professional manner.
