# Senior Review Log

Every phase ends with a review of the decisions a senior engineer would quiz you on.
The bar: **defend every file in this repo in a technical interview.**

---

## Phase 0 — Foundation (`116eecc`)

### 1. Why does `client_preferences` have `kind` (confirmed/inferred) and `source`?

**Q:** "How do you stop the agent confidently repeating something the client never said?"

Provenance is the trust pattern. Every fact the agent uses is traceable to a message, call note, or form. `inferred` facts are displayed differently and weighted lower in drafts; a designer can click through to the source and delete a wrong inference. Without this column, hallucinations become indistinguishable from facts the moment they're written to the DB.

### 2. Why is the Tierra supplier email deliberately messy?

**Q:** "What's actually hard about parsing supplier email?"

Look at the seed: `USD 1.890` (European decimal — that's $1,890, not $1.89), rates marked NET (commission not included, unlike others' gross rates), a 5-day hold buried mid-paragraph, child discount as a footnote. If your test data is clean, your parser is untested. Phase 2's comparison agent must normalize NET vs gross and catch the decimal trap, or it shows the designer a wrong number — worse than no number.

### 3. Why SQLite now, not Postgres?

Defer decisions that are cheap to reverse (one-way vs two-way doors). Drizzle abstracts the database — the swap is config, not a rewrite. The schema *shape* is the expensive-to-reverse part (every query, seed, prompt, and UI depends on it), so that's where the design effort went. Rule: spend design effort in proportion to reversal cost.

### 4. Why is `intake_forms.answers` a JSON blob, not columns?

Agency forms change shape constantly (new questions, per-trip-type variants like safari forms) — columns would mean a migration per change and dozens of mostly-null columns. The only consumer is the LLM, which reads the whole blob as prompt context; nobody runs SQL over intake answers.

**One-liner:** columns are for the database to compute on; blobs are for the agent to read.
**Trade-off to name:** the blob isn't indexed or DB-validated. **Escape hatch:** promote a field to a real column when it needs querying (that's why `budgetUsd` is a column on `trips`).

---

## Phase 1 — Drafting agent (`2b55577`)

### 1. Why is a draft a database row with `status` and `promptContext`, not just UI state?

**Q:** "Why persist drafts at all?"

Three reasons:
- Drafts survive a page refresh (designer steps away mid-review).
- The `status` lifecycle plus `sentBody` vs `body` gives the eval dataset for free — acceptance rate and edit distance are *the* draft-quality metrics for Phase 4, and you can't compute them from data you threw away.
- `promptContext` stores exactly what the agent saw, so when a draft is wrong you can answer "was the context missing, or did the model ignore it?" — the first question in any production AI debugging session.

### 2. Why structured output (`{body, flags}`) instead of free text?

Free text means parsing prose with regex — brittle. The schema forces the model to separate "the email" from "things I couldn't verify," and `flags` is the trust pattern made concrete: the model self-reports uncertainty into a channel the UI renders as "Needs your judgment."

Mechanism matters: `zodOutputFormat` + `messages.parse()` constrains generation server-side (the API guarantees schema-valid JSON) — it's not post-hoc parsing.

### 3. Why does Approve & send write the message, instead of the agent sending directly?

The agent's output never touches the outside world. `draftReply()` can only insert `pending` rows; only the human-triggered server action creates outbound messages. That's an **architectural guarantee, not a prompt instruction** — a prompt saying "don't send" can fail; code with no send path can't.

Interview framing: the difference between "we tell the model to be careful" and "the model structurally cannot act unsupervised."

### 4. Where's the server/client component boundary and why?

Everything is a server component except `DraftPanel` — the only interactive part (textarea state, buttons). Pages read SQLite directly, zero API routes, no JS shipped for the conversation or sidebar.

Subtle bit: `key={pendingDraft?.id}` on `DraftPanel` — when a new draft arrives via `revalidatePath`, the key change remounts the component so `useState(draft.body)` re-initializes. Without it, stale textarea state survives the server refresh.

### Known gap (own it if asked)

Draft generation is a blocking server action (~15–30s of "Drafting…"). Production-grade would stream the draft in. Deliberate v1 cut; revisit with the latency work in Phase 4.

---

## Phase 2 — Supplier quote parsing & comparison

### 1. The model extracts; the code computes

**Q:** "Why doesn't the agent calculate the stay totals?"

The extraction schema captures *facts* (amount, unit, scope, basis); `estimateStayTotal()` in TypeScript does the arithmetic. LLMs are probabilistic — you never let one do deterministic math a designer will quote to a client. Bonus: the UI prints the formula next to every estimate ("$1,095 × 10 nights × 4 pax") so the designer can audit the arithmetic at a glance. Show your math is a trust pattern too.

### 2. Why store `amountAsWritten` next to the normalized `amount`?

It's the normalization audit trail. "USD 1.890" → 1,890 involved a judgment call (European decimal); putting both in the table lets a designer catch a wrong normalization in one glance. It's also a free eval: any row where written and normalized diverge suspiciously is a test case.

### 3. Why is `holdExpiry` stored verbatim ("till Friday"), not resolved to a date?

The model doesn't know which Friday matters — resolution depends on when the email arrived, and delegating date math to the model invites silent errors. Verbatim + the email timestamp (via `messageId` provenance) means code *could* resolve it deterministically later; meanwhile the ambiguity is surfaced, not hidden. Same philosophy as #1: the model transcribes, code interprets.

### 4. When code can't compute honestly, it refuses

`estimateStayTotal` returns `null` + warning for non-USD, appends "child discounts NOT applied" on flat per-person math, and doesn't apply promos. A wrong number in a comparison table is worse than a dash — the designer trusts the table or the tool is dead. Every shortcut the code takes is a visible ⚠ warning, never silent.

### Observed extraction quality (worth citing in interview)

The model self-flagged a *genuine* ambiguity unprompted: Tierra's "USD 1.890 per night" for a family suite with a child discount could read per-suite or per-person — it chose per-unit and wrote "confirm with supplier" into caveats. That's the flag channel working as designed.

---

## Phase 3 — Embeddings + retrieval (Voyage AI)

### 1. Why no vector database?

**Q:** "You built RAG without pgvector/Pinecone — why?"

Do the math: a few hundred chunks × 1024-dim floats, brute-force cosine in TypeScript, is microseconds per query. A vector DB buys approximate-nearest-neighbor speed you need at ~100K+ vectors, at the cost of infra, an index to keep consistent, and recall trade-offs. "I measured, linear scan wins at this scale, and the swap is isolated to one function in retrieval.ts" is the senior answer. Same cheap-to-reverse logic as SQLite-vs-Postgres.

### 2. Why `input_type: "document"` at index time and `"query"` at search time?

Asymmetric retrieval: a query ("boats") and a document ("Call note: Sarah hates boats…") are different kinds of text. Voyage prepends different internal instruction prefixes to each so they land closer in embedding space. Omitting it silently degrades retrieval quality — a classic invisible-quality bug, since everything still *runs*.

### 3. Why `contentHash` on every chunk?

Idempotent indexing. Re-running the indexer embeds only new/changed facts (hash miss), deletes stale ones, skips the rest — so indexing can run on every data change without burning embedding quota or duplicating rows. Embeddings are cache-shaped: content-addressed, invalidated by content change.

### 4. Why does `draftReply` only use retrieval above a chunk threshold?

Retrieval adds a failure mode — the right fact might not make top-k. Below ~30 chunks the full record fits comfortably in context, so retrieval is pure risk with zero benefit. Above it, `promptContext.mode` + retrieved chunk ids/scores are persisted, so a bad draft decomposes into "retrieval missed the fact" (fix indexing/k) vs "model ignored it" (fix prompt). Distinguishing those two failures is the core skill of debugging RAG in production.

### Research note

Training-data recall said `voyage-3.5`; live docs said the current generation is `voyage-4`. Model names drift faster than model knowledge — verify provider APIs against live docs before speccing, every time.

---

## Adversarial review findings (Phases 1–2) — lessons

A cold-context Opus reviewer audited the agent layer. Ten findings accepted, all fixed. The two with interview-grade lessons:

**Check-then-act races in server actions.** `approveDraft` read the draft, checked `status === "pending"`, then wrote — as separate awaited statements. Two concurrent submissions both pass the check → the same draft sends twice, breaking the "exactly once" invariant. The client-side `disabled` button only protects one tab. Fix: atomic claim — `UPDATE … WHERE id = ? AND status = 'pending'` and proceed only if a row was actually claimed. Lesson: **enforce invariants in the database write, not in a read that precedes it.**

**`?? fallback` can hide a violated invariant.** `trip.partySize ?? 1` turned "party size unknown" into a confident single-person total — a 4× undercount rendered as fact, in the exact function whose contract was "never show a wrong number silently". Every `??` on data that feeds a displayed number deserves the question: *is this a safe default, or an assumption that must surface as a warning?*

**Prompt-injection posture (design note, not a bug).** Injection via email bodies is contained by the human gate: no tools, no auto-send, structured outputs, one send path. But an injected email can instruct the model to return empty `flags`/`caveats` — suppressing the "needs your judgment" panel while producing a confident wrong draft. The gate holds; the lesson is that **model-generated warnings are a UX aid, not a security boundary** — never build a trust decision on a channel the input can influence.
