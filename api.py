from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from datetime import datetime
from uuid import uuid4
from pathlib import Path
import json
import selenium_scripts

app = FastAPI()

RESULTS_DIR = Path("results")
RESULTS_DIR.mkdir(exist_ok=True)

CARRIER_SCRIPT_MAP = {
    "Safeco": "safeco_run",
    "Safeco_Auto": "safeco_auto_run",
    "Auto-Owners": "ao_run",
    "Auto-Owners_Auto": "ao_auto_run",
    "Cincinnati": "cincinnati_run",
    "Cincinnati_Auto": "cincinnati_auto_run"
}


def run_job(fn_name: str, payload: dict, job_id: str):
    try:
        fn = getattr(selenium_scripts, fn_name, None)
        if not callable(fn):
            raise Exception(f"Function '{fn_name}' not found")
        fn(payload, job_id)
    except Exception as e:
        with open(RESULTS_DIR / f"{job_id}.json", "w") as f:
            json.dump({"status": "failed", "error": str(e)}, f)


@app.post("/generate-quote")
async def run_selenium(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    metadata = payload.get("metadata", {})
    carriers = metadata.get("carriers", [])
    quote_id = metadata.get("quoteId")
    
    if not carriers:
        raise HTTPException(400, "No carriers specified")

    jobs = {}
    for carrier in carriers:
        if carrier not in CARRIER_SCRIPT_MAP:
            continue
        
        # Use quoteId from peak-ins-quoter as the job_id base
        # Add carrier suffix to ensure uniqueness per carrier job
        job_id = f"{quote_id}_{carrier}" if quote_id else str(uuid4())
        
        with open(RESULTS_DIR / f"{job_id}.json", "w") as f:
            json.dump({"status": "queued"}, f)
        
        background_tasks.add_task(run_job, CARRIER_SCRIPT_MAP[carrier], payload, job_id)
        jobs[carrier] = job_id

    if not jobs:
        raise HTTPException(400, "No valid carriers found")

    return {"success": True, "jobs": jobs}


@app.get("/job-status/{job_id}")
def job_status(job_id: str):
    file_path = RESULTS_DIR / f"{job_id}.json"
    if not file_path.exists():
        raise HTTPException(404, "Job not found")
    with open(file_path) as f:
        return json.load(f)


@app.get("/quote-pdfs/{quote_id}")
def get_quote_pdfs(quote_id: str):
    """List all completed PDFs for a specific quote UUID across all carriers"""
    pdfs = []
    found_any_job = False
    
    for carrier in CARRIER_SCRIPT_MAP.keys():
        job_id = f"{quote_id}_{carrier}"
        status_file = RESULTS_DIR / f"{job_id}.json"
        
        if status_file.exists():
            found_any_job = True
            with open(status_file) as f:
                try:
                    data = json.load(f)
                    if data.get("status") == "completed":
                        pdf_path = data.get("pdf_path") or f"quotes/{carrier}_{job_id}.pdf"
                        pdfs.append({
                            "id": job_id,
                            "carrier": carrier,
                            "pdf_name": f"{carrier}_Quote.pdf",
                            "file_size": Path(pdf_path).stat().st_size if Path(pdf_path).exists() else 0,
                            "created_at": data.get("completed_at") or datetime.utcnow().isoformat()
                        })
                except Exception:
                    continue
                    
    if not found_any_job:
        return {"status": "pending", "pdfs": []}
        
    return {
        "status": "ready" if pdfs else "processing",
        "pdfs": pdfs
    }


@app.get("/pdf/{job_id}")
def get_pdf(job_id: str):
    """Download PDF file for a specific job"""
    status_file = RESULTS_DIR / f"{job_id}.json"
    
    print(f"[PDF Download] Requested: {job_id}")
    print(f"[PDF Download] Status file exists: {status_file.exists()}")
    
    if not status_file.exists():
        raise HTTPException(404, "Job not found")
    
    with open(status_file) as f:
        data = json.load(f)
    
    print(f"[PDF Download] Job status: {data.get('status')}")
    
    if data.get("status") != "completed":
        raise HTTPException(400, f"Job not completed. Current status: {data.get('status')}")
    
    pdf_path = data.get("pdf_path")
    if not pdf_path:
        raise HTTPException(404, "No PDF path in job result")
    
    # Normalize path to work on Windows and Unix
    pdf_file = Path(pdf_path).resolve()
    
    print(f"[PDF Download] Looking for PDF at: {pdf_file}")
    print(f"[PDF Download] File exists: {pdf_file.exists()}")
    print(f"[PDF Download] File is file: {pdf_file.is_file()}")
    
    if not pdf_file.exists():
        # Try relative paths in case the PDF was saved elsewhere
        alt_paths = [
            Path(pdf_path),
            Path(".") / pdf_path,
            Path(pdf_path).name,  # Just the filename
        ]
        
        for alt_path in alt_paths:
            print(f"[PDF Download] Trying alt path: {alt_path}")
            if alt_path.exists():
                pdf_file = alt_path.resolve()
                print(f"[PDF Download] Found at: {pdf_file}")
                break
        else:
            raise HTTPException(404, f"PDF file not found at {pdf_path}")
    
    return FileResponse(
        str(pdf_file),
        media_type="application/pdf",
        filename=f"{job_id}.pdf"
    )
