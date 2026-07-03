# AI Back Office for Luxury Travel Agencies

An AI-native back office for luxury travel designers — the agentic layer that takes repetitive coordination work off a designer's plate so they can spend their time on judgment, taste, and client relationships.

**The core pattern: drafts, not blanks. Agents do the first pass on everything; the designer keeps the send button.**

---

## The problem

Luxury travel agencies (think Abercrombie & Kent, boutique operators, independent advisors) sell a high-touch, done-for-you service: bespoke itineraries, private guides, exclusive access, on-the-ground management. The product is human judgment and taste.

But most of a designer's day isn't judgment — it's coordination:

- Answering the same intake questions over email
- Chasing three lodges for rates and availability, then re-typing the answers into a comparison
- Copying call notes into a CRM nobody reads
- Rebuilding itinerary documents every time one hotel changes
- Remembering that a client mentioned Patagonia six months ago, when availability finally opens

The context needed to do this well is scattered across forms, inboxes, call notes, PDFs, and the designer's memory. The repetitive work crowds out the work that actually differentiates a great trip.

## The designer's data environment

Everything the system reasons over already exists in an agency today — it's just fragmented:

| Source | Real-world examples |
|---|---|
| **Intake forms** | Trip questionnaires: party size, dates, budget band, pace preference ("two-hotel max"), dietary needs, celebration context ("30th anniversary") |
| **Emails** | Client threads ("can we add two nights in Kyoto?"), supplier threads (rate quotes, room-category availability, contract terms) |
| **Call notes** | "Wife hates boats. Loved the guide in Morocco — ask for someone similar. Kids are 9 and 12, need connecting rooms." |
| **Itineraries** | Day-by-day documents with hotels, private guides, transfers, restaurant reservations, confirmation numbers |
| **Client history** | Past trips, spend patterns, preferences confirmed vs. inferred, anniversaries and birthdays |
| **Supplier records** | Preferred rates, commission terms, on-the-ground contacts, which lodge manager responds fastest |

**Live inventory** is the other half: real-time availability and rates from hotels, lodges, guides, and transfer providers — via APIs where they exist (major hotel groups, GDS), and via structured email parsing where they don't (most boutique lodges and DMCs quote by email). A unified inventory layer normalizes both into: *property, room category, dates, rate, hold expiry*.

## How the agent layer works

![Architecture diagram](docs/agent_architecture.png)

Agents connect the context layer to the inventory layer and do real work on the designer's behalf:

1. **Ingest & structure** — every form, email, and call note is parsed into a per-client context graph (preferences, constraints, history, open threads). Retrieval + embeddings make it queryable.
2. **Draft client communications** — replies to client emails arrive pre-written in the agency's voice, grounded in the client's history and the live state of their trip. The designer edits and sends.
3. **Run supplier coordination** — the agent emails lodges for rates/availability, parses the replies, and tables the options side by side with commission and hold-expiry data.
4. **Assemble itineraries** — first-draft day-by-day itineraries built from the client's stated constraints and live availability, ready for the designer to reshape.
5. **Surface proactive suggestions** — "The Meyers mentioned Patagonia in March; November availability just opened at the lodge they shortlisted."

Every action flows through a **human-oversight gate**: agents draft, compare, and propose — designers approve, edit, or override. Evals track draft-acceptance rates, factual grounding, and the long tail of cases where the model gets it wrong.

## The product surface

The interface a designer lives in day to day:

- **Today view** — the morning queue: drafted client replies awaiting review, supplier responses tabled and compared, proactive nudges ranked by urgency.
- **Client workspace** — one page per client: full context graph, open threads, trip pipeline, preference profile (confirmed vs. inferred, each traceable to its source).
- **Trip builder** — the itinerary canvas: drag-to-reorder days, live availability inline, agent-proposed alternatives when something falls through.
- **Approval queue** — everything the agent wants to send or book, with a diff-style view of what it drafted and why. Nothing leaves the building without a human click.

## Proposed stack

- **Product**: TypeScript, Next.js/React, serverless backend
- **AI**: Claude API for agents and drafting, tool use for supplier/inventory actions, embeddings + retrieval over the context graph, structured evals from day one
- **Integrations**: email (Gmail API), hotel/GDS APIs where available, structured email parsing for the long tail of boutique suppliers

## Status

Concept stage. This repo starts from a written product thesis; next steps are:

1. Model the domain: client, trip, supplier, inventory, thread
2. Build the context-ingestion pipeline (email + forms → context graph)
3. Ship the first agent workflow end to end: supplier rate request → parsed replies → comparison table → designer approval
4. Layer on drafting, itinerary assembly, and proactive suggestions
