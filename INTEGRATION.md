# Integration: Peak-ins-quoter + Selenium Automation

## Flow
1. User submits quote in web app
2. `/api/quotes/submit` triggers Python API at `localhost:5555`
3. Python API runs Selenium script(s) for selected carriers

## Run
```bash
# Python API (root dir)
uvicorn api:app --port 5555

# Next.js App (peak-ins-quoter)
npm run dev
```

## Payload
The Python API receives the full webhook payload with `carriers` array.
Access data directly: `payload["personal"]["firstName"]`, `payload["home"]["property"]["yearBuilt"]`, etc.
