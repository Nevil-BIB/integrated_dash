# Playwright Standalone

This folder is intentionally separate from your backend architecture.
No route/controller/service from `src/` imports this code.

## Required `.env`

- `AUTO_OWNERS_USERNAME`
- `AUTO_OWNERS_PASSWORD`
- `AUTO_OWNERS_TOTP_SECRET`

## Run

1. Create a payload JSON file (example: `playwright-standalone/payload.json`).
2. Run:

```bash
node playwright-standalone/run-from-json.js playwright-standalone/payload.json
```

It executes the block flow in this order:
- login
- start-new-business
- check-score-disclosure
- attempt-fire-dwelling-quote
- fill-household-member
- handle-insurance-score
- location
- location-information
- information-continued
