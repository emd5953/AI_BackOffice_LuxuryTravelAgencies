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
