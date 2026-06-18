# OTP automation (n8n + backend) — handoff notes

Saved summary from project discussion. **Do not put real passwords or secrets in this file.**

## Goal

- **Primary:** n8n reads OTP from `automation@peakinsurance.com` → extracts 6-digit code → `POST` backend webhook `/api/webhooks/otp` with `x-webhook-secret`.
- **Carriers (from client):** AO → TOTP (often backend-side, not email). Travelers → SMS (needs SMS→email or Twilio path to reach an inbox/API n8n can read).
- **Fallback if n8n/email path fails:** Twilio (or similar) for SMS.

## n8n (Docker) — quick reference

- UI: `http://localhost:5678` (after `docker compose up -d` in your n8n folder).
- **Owner account** on `/setup` = *your* n8n admin login — not client mailbox creds.
- **IMAP credential modal:** User = mailbox email, Password = mailbox or app password, Host (e.g. `outlook.office365.com` or `imap.gmail.com`), Port `993`, SSL ON, **Mailbox Name = `INBOX`**, then Test trigger.

## Backend (peak-backend)

- Webhook route exists: `POST .../webhooks/otp` (see `src/routes/quote.routes.ts`).
- Set `WEBHOOK_SECRET` in env; n8n HTTP Request sends header `x-webhook-secret`.
- **Production gap to plan:** correlate OTP with `quoteId`/run (e.g. Redis TTL), avoid logging full OTP in production logs.

## Workflow shape (n8n)

1. Email Trigger (IMAP / Outlook / Gmail).
2. Optional filter (sender/subject).
3. Code node: regex `\b\d{6}\b` on subject + body.
4. IF `valid`.
5. HTTP Request → backend webhook JSON: `carrier`, `otp`, `extractedAt` (+ later: correlation id).

## Windows / install pitfalls (historical)

- Native `npm` n8n can fail on `isolated-vm` → use **Docker** for n8n.
- Docker needs **WSL2** updated; use `host.docker.internal` from container to reach host backend (default port **7001**). Full webhook URL: `http://host.docker.internal:7001/api/webhooks/otp`.

## Security

- Rotate anything ever pasted in chat.
- Client mailbox creds only in n8n Credentials UI / vault — not in repo or Slack.

---

## Client checklist (email-related — what you need from them)

1. **Mailbox access** for `automation@peakinsurance.com`: password; if M365/Gmail blocks IMAP login, **app password** or IT enabling IMAP/basic auth as required.
2. **Provider name:** Microsoft 365 vs Gmail vs custom (for correct IMAP host).
3. **If custom:** IMAP host, port, SSL.
4. **2–3 sample OTP messages** (sender + subject; body redacted OK) for filters.
5. **Forwarding plan:** Carriers do not mail that address by default — they must **forward**:
   - **Email OTP:** inbox rules → forward carrier mails to `automation@peakinsurance.com`.
   - **SMS OTP (Travelers):** SMS-to-email to that address **or** Twilio (or similar) number → n8n.

When (1)–(2) are ready: complete IMAP credentials in n8n → test trigger → add Code + HTTP nodes → activate workflow.
