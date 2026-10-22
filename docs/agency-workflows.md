# Agency workflows and data priorities

Research checked 22 October 2026. This prioritization follows documented workflows, not a market-share ranking. No agency survey or claim about a particular agency's installed tools is implied.

## Conversations establish the work

A luxury/FIT trip spans hotels, DMCs, guides, transfers, restaurants and events. A client's request for an earlier arrival does not amend the hotel reservation. A provisional hold is not a confirmation; a confirmed room does not imply payment or an allocated driver.

Tourwriter documents separate availability, booking, amendment and cancellation cycles, supplier references, private notes and supplier replies. Suppliers can confirm, decline, waitlist or hold a request. This supports preserving the source behind each status rather than collapsing everything into “booked.” [Tourwriter supplier workflow](https://learn.tourwriter.com/portal/en/kb/articles/making-bookings-and-emailing-suppliers)

Virtuoso training separates client discovery/confidentiality, preferences, itinerary feasibility, supplier selection and hotel quotations. Its pre-voyage email asks advisors for occasions, dietary/mobility needs and other context. These details often live in prose; a preference or request must not become a claim of supplier acceptance. [Training objectives](https://static.virtuoso.com/division-nps/Travel%20Basics/Travel%20Basics%20Objectives.pdf), [advisor email example](https://static.virtuoso.com/division-nps/Virtuoso%20Voyages/Pre%20Voyage%20Host%20to%20Advisor%20Email%20Sample.pdf)

Travefy can import original booking-confirmation emails from supported suppliers, but its documented importer excludes quotes, supplier PDFs, wholesalers and complex FIT itineraries. This is a concrete reason to prioritize generic conversation/attachment ingestion over only connecting an itinerary API. [Travefy import limits](https://intercom.help/travefy/en/articles/1520595-how-to-forward-booking-confirmation-emails)

## Priorities

| Priority | Data boundary | Rationale and scope |
|---|---|---|
| 1 | Email: Gmail, then Microsoft 365 | Cross-supplier requests and commitments. Implemented original EML and selected Gmail threads. Microsoft Graph is a next adapter, not implemented. |
| 1 | Conversation attachments | Extract text-bearing PDFs by page; preserve document references. Scans, voice and unsupported files need explicit review. |
| 2 | WhatsApp Business | Client changes and preferences arrive separately from supplier commitments. Use an official inbound provider, not personal-chat scraping. |
| 2 | Spreadsheet records | Practical bridge for existing trip/supplier registers. CSV preserves row references without presuming API-enabled CRMs. |
| 3 | Itinerary/CRM systems | Supporting client/trip context and future approved-output destinations. Proposal/CRM status is not supplier fulfillment. |
| 4 | Inventory and property APIs | Verify/enrich specific services when authorized. A property PMS is not an agency-wide inbox or universal booking database. |

Gmail offers thread reads and MIME attachment retrieval with read-only scopes. This pilot reads only the requested thread. Production needs consent, encrypted refresh tokens, incremental cursors, push handling and deletions. [Gmail threads](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get), [attachments](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get)

Twilio's WhatsApp sandbox works with joined test participants. Its webhook/signature scheme supports official inbound ingestion; it does not unlock historical personal chats. The implementation returns empty TwiML and sends no reply. [Sandbox](https://www.twilio.com/docs/whatsapp/sandbox), [webhook fields](https://www.twilio.com/docs/messaging/guides/webhook-request), [signature verification](https://www.twilio.com/docs/usage/security)

## Representative systems

- **Travefy:** trip/proposal and CRM APIs. The pilot implements narrow partner-identifier lookup using published OpenAPI. Platform/user provisioning is required; CRM access has manual approval and does not expose every sensitive field. [API overview](https://intercom.help/travefy/en/articles/15385261-travefy-api), [OpenAPI](https://api.travefy.com/docs/openapi/v20241001.json)
- **Wetu:** booking-system integrations and service mapping for itinerary production. Relevant when already in use; no Wetu adapter is claimed. [Integration docs](https://knowledge.wetu.com/integrations-enterprise-solutions)
- **Tourwriter:** bespoke itinerary/service/supplier workflows, including booking requests and confirmations. No direct adapter implemented. [Product](https://www.tourwriter.com/)
- **TravelJoy:** forms, invoices, payments/authorizations and group bookings. An invoice or card authorization must not imply the supplier has been paid. No direct adapter implemented. [Payment workflow](https://help.traveljoy.com/hc/en-us/articles/9483414497812-Collect-payments-or-authorizations-from-your-clients)
- **Amadeus:** representative travel inventory and booking APIs; they do not replace negotiated supplier-email commitments. Application credentials/enterprise access are required. No availability or pricing is fabricated, and no booking endpoints are invoked. [Hotel API guide](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/hotels/), [enterprise booking](https://developers.amadeus.com/enterprise/category/hotel/api/booking)
- **Mews:** property-scoped reservation access. Implemented the current `reservations/getAll/2023-06-06`, scheduled UTC dates and `PersonCounts`. Public demo access enables real API validation. Demo records must stay separate and must never contain real client data. Production authorization/certification is separate. [Reservations](https://docs.mews.com/connector-api/operations/reservations), [environments](https://docs.mews.com/connector-api/guidelines/environments)

## Original implementation audit

The legacy seed invents five clients and supplier conversations, deletes/recreates tables, and lacks source-environment metadata. Relative seeded timestamps can make invented communication look current. Source references were internal IDs, not external message/document IDs. There was no Gmail, spreadsheet, WhatsApp or attachment ingestion. “Send” only inserted a local outbound row, without provider acknowledgement.

Changes: a separately labeled source store; no automatic seed; destructive-seed opt-in; external references and content fingerprints; environment-separated matching; explicit interpretation review; evidence-sensitive approvals; persistent activity history; removal of simulated delivery. AI proposes fields only. The handoff summary and missing-data checks are deterministic and labeled.

Remaining product work: agency interviews; supplier/service identities beyond reservation references; multi-room/group occupancy; quote currency/tax/NET-vs-gross math; exact timezone handling for hold deadlines; agency contact ownership; durable sync queues; retention; individual staff authorization. This pilot handles arrival-readiness triage, not autonomous booking or accounting.
