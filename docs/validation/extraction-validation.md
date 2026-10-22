# Conversation extraction validation

Date: 2026-10-22

Implemented: raw `.eml` import with an actual one-page PDF attachment, a second supplier email, and two WhatsApp payloads. The scenario seeds only CRM identity. Operational facts are empty before model extraction. The app has no runtime mock mode.

Verified:

- 26 offline tests passed, including real mail/PDF parsing; Anthropic SDK structured-output request and response parsing using an explicitly labeled HTTP double; automatic source matching; unknowns versus requests versus assertions; date conflicts; service-scoped gaps; partial failures and retry; cached results; quote/reference validation; and concurrent operator edits.
- Offline scenario expectation: four sources linked, one namesake message unmatched, zero manually accepted facts. Checks include conflicting hotel dates, missing flight/luggage, pending deposit/transfer, an experience on hold, and requested arrival/bedding changes.
- ESLint, TypeScript and production build passed.
- Production HTTP smoke passed on an isolated localhost server/database: authorization, CSRF, approvals/export, stale evidence, webhook signature rejection, raw sample ingestion and HTTP 503 for unconfigured extraction. No provider request is made when credentials are absent.
- PDF rendered and visually checked; browser confirmed sample loading, source provenance and the unavailable-model state.

Real Anthropic inference has **not** been validated. `npm run validate:extraction` was attempted and stopped before any network request because model credentials were absent. Configure `.env.local`, restart the server, and run that command. Only a successful real run creates `ai-extraction.json`; offline test output must not be represented as model quality evidence.

Limits: text PDFs only (no OCR), no voice transcription, one-source extraction with at most 12 sources per request, three concurrent calls, and a request-scoped pipeline rather than a durable worker queue. Trip identity must exist before automatic linking. Exact quotations establish provenance, not semantic correctness. All extracted details remain provisional until reviewed; no supplier/client messages or booking changes are executed.
