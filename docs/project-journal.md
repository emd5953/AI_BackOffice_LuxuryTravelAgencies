# Project Journal

The narrative history of this repo — how it went from a job posting to a working
agentic back office. Companion docs: [senior-reviews.md](senior-reviews.md)
(per-phase design defenses, interview prep) and `transcripts/` (raw session logs,
local-only). All dates: July 3, 2026, one long build session.

## Origin

Started from the **Analogue founding-engineer JD** (AI-native travel platform, NYC;
apply: bjarni@travelanalogue.com — resume + note on the hardest thing you've shipped).
The prep strategy: *build the product the JD describes* and learn every skill it
screens for — agents, tool use, structured outputs, retrieval/embeddings, evals,
orchestration, human-in-the-loop trust patterns.

The product thesis (see README): an AI back office for luxury travel designers.
Core pattern: **drafts, not blanks** — agents do the first pass on everything,
the designer keeps the send button.

Fictional test agency: **Meridian Private Travel**, designer Elena Voss. Seeded
clients: the Meyers (Patagonia, kids want horses, Sarah hates boats, grandmother
maybe joining), Victoria Ashford (30th-anniversary Japan, husband's medical
shellfish restriction), Robert Chen (last-minute Kenya, never fills out forms).

## Working method

- **Vertical slices**, each shipping something usable and teaching one JD skill
  cluster. Never horizontal scaffolding.
- **Build → senior review**: every phase ends with "defend these decisions"
  Q&A, logged in senior-reviews.md. Bar: defend every file in the Analogue
  technical interview.
- **Orchestration split** (from Phase 3 onward): Fable plans, specs, triages,
  verifies; Sonnet subagents implement and research; an Opus subagent does
  cold-context adversarial review. Specs must be self-contained — subagents
  start with zero conversation context.

## Phase log

### Phase 0 — Foundation (`116eecc`)
Next.js 16 + TS + Tailwind scaffold; Drizzle + SQLite domain model (clients,
preferences-with-provenance, trips, suppliers, threads, messages, call notes,
intake forms as JSON blobs); realistic seed data including deliberately messy
supplier emails. Key ideas: provenance columns (`kind` confirmed/inferred +
`source`), columns-vs-blob rule, defer cheap-to-reverse decisions.

### Phase 1 — Drafting agent (`2b55577`)
Inbox → agent-drafted client replies → approval queue. `claude-opus-4-8`,
adaptive thinking, structured output `{body, flags}` via `messages.parse()` +
Zod. Drafts persist with `promptContext` (exact context the model saw) and
`sentBody` separate from `body` (edit distance = future eval). Live test:
the Meyer draft answered all four questions, pulled the ground-floor detail
from a call note, and self-flagged its two unverifiable claims. The send
button is the only path to an outbound message — trust by architecture,
not by prompt.

### Phase 2 — Supplier quote parsing (`quotes` + comparison table)
Three lodges quote the same trip, each messy differently: Tierra (European
decimal `USD 1.890` = $1,890, NET, buried supplement), Explora (per-PERSON
double-occupancy pricing, gross/commissionable), Awasi (`US$ 3.290`, NET,
"hold till Friday", stay-10-pay-9 promo). Extraction agent got all of it and
self-flagged a genuine ambiguity. Rule established: **the model extracts, the
code computes** — `estimateStayTotal()` does the math, prints its formula,
and warns instead of guessing.

### Phase 3 — Embeddings + retrieval (Voyage AI)
First orchestrated phase. Researcher subagent verified live docs (current
model is `voyage-4` — training data would have said voyage-3.5). Implementer
built: `context_chunks` (sha256 content-hash idempotent indexing),
`embedDocuments`/`embedQuery` with the document/query `input_type` split,
brute-force cosine retrieval (no vector DB — the math says linear scan wins
at this scale), `/clients/[id]` workspace with semantic memory search, and
retrieval-mode drafting above a 30-chunk threshold with retrieved chunk
ids+scores recorded in `promptContext`. Free-tier constraint: 3 requests/min —
everything batches.

### Adversarial review (Opus, cold context)
Audited Phases 1–2 against five invariants. 10 findings, all fixed by a
Sonnet subagent with a regression suite (10/10):
- **H1** check-then-act race in `approveDraft` → double-send. Fixed with an
  atomic conditional-update claim.
- **H2** `partySize ?? 1` silently produced a 1-person total. Fixed: null +
  warning.
- M1–M5, L1–L3: non-atomic re-extract, hardcoded room count, unapplied
  minNights, narrow promo regex, flag misattribution, stale revalidation,
  orphan drafts, degenerate dates.
- Design note: prompt injection is contained by the human gate, but injected
  email could suppress the flags channel — **model warnings are UX, not a
  security boundary.**

### Phase 4 — Evals + observability (in flight as of this journal entry)
`agent_runs` telemetry (tokens, cost, latency per call), `/dashboard`,
golden eval suite re-running extraction on the seeded traps as regression
tests, Haiku-judged grounding eval verifying every draft claim against its
stored `promptContext`.

## How to resume

```sh
npm run dev                 # app: /inbox, /clients/[id], /trips/[id]/quotes, /dashboard
npm run db:seed             # reset demo data (wipes drafts/quotes/chunks)
npm run index-context       # re-embed client context (needs VOYAGE_API_KEY)
npm run eval:parse          # golden extraction suite (live API)
npm run eval:grounding      # LLM-judge draft grounding (live API)
npx tsx scripts/test-draft.ts       # draft the Meyer reply end to end
npx tsx scripts/test-retrieval.ts boats   # semantic search sanity check
```

Keys in `.env.local`: `ANTHROPIC_API_KEY` (agents), `VOYAGE_API_KEY` (embeddings).
Prefix script runs with `set -a; . ./.env.local; set +a;`.

Claude Code session memory lives in `~/.claude/projects/<this-project>/memory/` —
the working method, project state, and orchestration rules persist there across
sessions.

## Remaining roadmap

- Phase 5: proactive suggestions ("Patagonia availability opened") + Vercel
  deploy (SQLite → Postgres swap)
- Streaming draft generation (known UX gap: blocking ~15–30s server action)
- Gmail API swap-in for the simulated inbox
