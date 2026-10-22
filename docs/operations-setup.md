# Operations setup and validation contracts

## Storage and access

Node 24 is required. The new SQLite store uses transactional updates, WAL and a busy timeout. Failed mutations roll back. One agency/shared operator is supported; no multi-tenant or staff-role system is claimed. Use persistent private disk and backups, not an ephemeral serverless filesystem. Retention/archive policies are needed for sustained use because activity and evidence snapshots grow.

Limits: 200 CSV rows/import; 1 MB uploaded file; 20 pages/PDF attachment; 30 messages/Gmail thread; 2 MB/provider response; 5,000 stored sources. Local development binds to `127.0.0.1`. Hosting requires HTTPS and a 32+ character `OPS_ACCESS_TOKEN`. Browser Basic auth uses any username and the token as password; API callers may use Bearer auth. Operations handlers authenticate themselves. Proxy also gates workspace pages. Browser mutations reject cross-origin requests. WhatsApp uses its own provider signature.

## Email and attachments

Export an original email as `.eml` and choose its environment on upload. The importer retains sender, Message-ID, header date, text and attachment fingerprints/page numbers. Exported headers do not prove authenticity. HTML is rendered only as inert text. No remote images are fetched. PDF text ordering may differ from the visual table; inspect the original before accepting figures. Invalid/encrypted/large PDFs, image-only scans, audio and Office files are review blockers. Original binary attachments remain in the source email/file; this is not a binary archive.

For genuine Gmail validation, supply an authorized short-lived OAuth token scoped `https://www.googleapis.com/auth/gmail.readonly`, set `GMAIL_ACCOUNT`, then enter a Gmail API thread ID (hex). Browser URL IDs may use different encoding. `/users/me/profile` is checked first to prevent wrong-account ingestion. OAuth login, token refresh, history cursors, push subscriptions and background sync are not implemented. Verify bodies and attachments against the thread. Failure/rate limits produce an error without partial commit.

## WhatsApp via the official Twilio sandbox

Create a Twilio WhatsApp sandbox and have an authorized participant join it. Expose a public HTTPS `/api/webhooks/whatsapp` endpoint. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_TO` (with `whatsapp:+` prefix), exact externally visible `TWILIO_WEBHOOK_URL`, and `WHATSAPP_ENVIRONMENT=sandbox`. Configure that URL for incoming sandbox messages.

The signature uses the configured public URL verbatim, including query strings; it does not trust forwarded-host values. All parameters are signed; duplicates, wrong account and wrong recipient are rejected. Send a test message and inspect the desk; replay must not duplicate the source. Exact unique phones can match a trip. Original send time remains unknown; receipt time is separate. Media/voice is flagged, not transcribed. Empty TwiML sends no reply. Live sender onboarding is separate; changing the environment flag does not migrate sandbox records.

## Spreadsheet bridge

Required CSV columns: `trip_ref,title,traveler`. The template lists optional email, E.164 phone, ISO dates, party size, reference/status, flight, transfer/payment status and requests. Export Google Sheets as CSV. Errors identify rows and reject the batch. Source identity is filename plus logical CSV row number: new filenames create new sources; reordered rows update those identities. Preserve the order/name or review the changes. No direct Sheets sync or XLSX support is claimed.

## AI interpretation

Set `ANTHROPIC_API_KEY` and a model your account supports in `ANTHROPIC_MODEL`, then restart the server. “Analyze evidence” sends at most 12 selected sources (up to 60,000 text characters each) to Anthropic, three requests at a time, with a 30-second request timeout and no SDK retries. The synthetic sample starts analysis automatically when configured. The importer itself never supplies extracted answers.

Extraction uses [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), with strict local validation after parsing. Facts quote exact source text. Dates, occupancy, reservation references, identifiers and service scope receive additional validation. Assertion, request and unknown are distinct speech acts: requested arrival changes cannot silently alter confirmed dates, and “flight not chosen” does not complete the arrival-flight field. An exact excerpt proves provenance, not semantic correctness; staff still need to review model interpretation.

Proposals immediately populate the trip view, deterministic gap/conflict checks and a new internal handoff. They stay marked as unreviewed AI proposals. Reviewed fields, extraction dismissal and changed originals refresh derived links/checks. Automatic matching uses explicit trip/contact evidence, attachment parentage and shared reservation references within an environment. Conflicting identity components and names-only matches remain unassigned. No automatic trip creation from names is attempted: a CRM identity or operator-created trip is still required.

Every successful source is persisted independently. Partial failure retains successful results and presents source-level errors. Re-running a batch skips completed/reviewed/dismissed results and retries failures; “Propose fields with AI” explicitly reruns one source. Source or operator edits while a model request is in flight reject stale results. Original evidence is never overwritten by model output. This is request-scoped processing, not a durable background queue; after interruption, reload and retry unfinished sources.

`npm run test:operations` includes offline model-double contract tests; these are not real AI validation. `npm run validate:extraction` loads `.env.local`, calls the real model against only fictional sample evidence in an isolated temporary database, verifies expected links/conflicts/gaps, and writes a receipt only on success. Missing credentials fail clearly without a fallback. There is no runtime mock mode.

## Structured context

Mews: public demo credentials are intentionally published in the provider documentation. The read uses only the demo hostname and latest 10 reservations; no production endpoint or write API is exposed. The validator reports whether more pages exist. Minimal reservation data is retained, excluding guest/payment details. UTC times are not converted into a guessed property timezone.

Travefy: provision platform API access and associated user access. Set `TRAVEFY_PUBLIC_KEY` and `TRAVEFY_USER_TOKEN`; enter the trip's exact `PartnerIdentifier`. The request uses `X-API-VERSION: 20241001` and `/api/trips?partnerIdentifier=...`. Imported trip status is supporting context, not confirmation of individual services. This is unvalidated until authorized credentials are provided.

## Review and action semantics

Synthetic, sandbox and live data cannot auto-link across environments. Names are never used for matching. Unknown references, ambiguous contacts and contradictory identities stay unmatched. Operator linking requires an explanation and the same environment.

Service-specific comparisons group by reservation reference. Multiple rooms under one confirmation and missing references require judgment. Recorded source statements are claims, not guaranteed truth. Approval snapshots the sources, checks and edited draft for an internal handoff. It neither resolves supplier conflicts nor sends messages. Changed sources, links, trip identities, extractions or reviewed fields invalidate export approval. Repeated approval is rejected transactionally.

Before production: individual agency/staff access, consent, encrypted PII/credentials, retention/deletion, backups, service identities, provider sync/cursors, queues and monitoring. Future send/booking execution needs separate explicit authorization and a delivery ledger with provider acknowledgements. Earlier telemetry/evals do not establish current integration accuracy.
