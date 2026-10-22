# Analogue — a conversation-first travel back office

Luxury travel work arrives as client emails, supplier confirmations, PDF attachments, and WhatsApp requests. **`/operations` turns those sources into a reviewable trip record and internal handoff.** It preserves evidence, keeps AI interpretations pending human review, and never sends messages or changes bookings.

This is a **single-agency local pilot**, not a production multi-tenant system. No real client data is preloaded. The sample is synthetic; Mews data comes from its official public demo. See [workflow research](docs/agency-workflows.md) and [integration setup](docs/operations-setup.md).

## Run

Requires Node **24 or newer** (built-in SQLite).

```sh
npm ci
cp .env.example .env.local
npm run dev
# http://127.0.0.1:3000/operations
```

No database server or API key is required for file imports, manual review, or the sample. State persists in `.data/operations.sqlite`, excluded from Git. Before hosting, set a random `OPS_ACCESS_TOKEN` of at least 32 characters; production access fails closed without it. Use HTTPS and persistent private storage. This shared-operator gate does not provide individual staff roles.

## Try it

1. Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in `.env.local`, using a model available to your account that supports structured outputs, and restart the server.
2. **Sources & imports → Try email + PDF + WhatsApp sample.** Loads two fictional supplier emails, an actual attached PDF voucher, and two WhatsApp messages through the real parsers. Only the CRM trip identity is seeded: there are **zero pre-entered operational facts**. When configured, AI analysis starts automatically. Without credentials, only raw evidence loads; click **Analyze evidence** after connecting the model.
3. AI quotes facts, connects four sources by agency reference, attachment or reservation reference, and leaves the namesake message unmatched. The provisional details and handoff update automatically. Expected checks: email/PDF arrival-date conflict, missing flight, pending transfer and deposit, an experience on hold, and unconfirmed client changes. No manual field entry or acceptance is needed for checks.
4. Edit the internal follow-up, acknowledge open issues, and approve. Download the JSON handoff and evidence snapshot. **Nothing is sent.** Changed evidence or reviewed fields invalidate approval for export.
5. **Read official demo reservations** tests Mews. Those sandbox trips remain separate from the invented scenario.

## Boundaries

| Source | Implemented | Still requires / out of scope |
|---|---|---|
| Email files | `.eml`, MIME, original IDs/headers, text and PDF attachment pages | Authenticity verification, OCR, voice, Office files and large attachments |
| Gmail | Exact thread read, account check, plain/HTML text and attachments | Authorized `gmail.readonly` token; no OAuth sign-in/refresh or background sync |
| WhatsApp | Twilio inbound signatures/account/recipient checks, deduplication, phone matching | Official sandbox setup and joined participant; no history scraping or outbound messages |
| Spreadsheets | Validated CSV rows with source locations; Sheets CSV exports | Direct Sheets OAuth sync and XLSX |
| Mews | Latest 10 official-demo reservations, current API fields | Full synchronization and authorized production property access |
| Travefy | Exact partner-identifier trip lookup | Provisioned platform/user credentials; CRM/service ingestion and writeback |
| AI | Batch Anthropic extraction, quoted fields, automatic matching, provisional details/checks, per-source retry | Credentials/model access; offline contract tests do not establish live model quality |

The sample has **no pre-generated AI output or runtime mock mode**. Tests inject an explicitly labeled model double. Runtime extraction always calls Anthropic. AI proposals inform deterministic checks immediately, while remaining clearly separate from reviewed facts. Client requests and unknown values do not become confirmed details. Service-specific comparisons use reservation references; unscoped/multi-room records still need judgment.

Raw examples are in [public/examples/extraction](public/examples/extraction): two `.eml` files, the PDF voucher and inbound WhatsApp fixture payloads. Rebuild with `python scripts/create-extraction-fixtures.py` (ReportLab). Scanned PDFs and voice notes remain explicit limitations.

## Validate

```sh
npm run test:operations
npm run validate:extraction # real model, synthetic data, isolated temporary database
npm run validate:sandbox
npm run lint
npm run build
```

The extraction validator writes `docs/validation/ai-extraction.json` only after a real model run passes the scenario checks. The Mews validator records counts/IDs/hashes in [docs/validation/mews-sandbox.json](docs/validation/mews-sandbox.json). Offline regression tests are not evidence of live provider connectivity.

## Earlier prototype

`/today`, `/inbox`, `/clients`, and `/dashboard` are the older Postgres/Drizzle prototype and need separate configuration. Their seed is fictional. The fake email-send path was removed: legacy approval is internal only. Destructive seeding requires `SEED_SYNTHETIC=1` on a dedicated demo database. Historical cost/eval claims in journal files describe earlier experiments, not current integration validation.
