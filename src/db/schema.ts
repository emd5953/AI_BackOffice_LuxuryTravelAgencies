import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ---------- Clients ----------

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Free-form designer notes: who they are, how they like to be handled
  bio: text("bio"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// A single preference fact about a client, always traceable to where we
// learned it. `confirmed` = client said it; `inferred` = agent deduced it.
export const clientPreferences = sqliteTable("client_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  kind: text("kind", { enum: ["confirmed", "inferred"] }).notNull(),
  text: text("text").notNull(),
  // e.g. "message:42", "call_note:3", "form:1" — the provenance of the fact
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ---------- Trips ----------

export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  title: text("title").notNull(),
  destination: text("destination").notNull(),
  status: text("status", {
    enum: ["inquiry", "planning", "proposal_sent", "booked", "traveling", "completed"],
  }).notNull(),
  startDate: text("start_date"), // ISO date; nullable while still an inquiry
  endDate: text("end_date"),
  partySize: integer("party_size"),
  budgetUsd: integer("budget_usd"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ---------- Suppliers ----------

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["hotel", "lodge", "dmc", "guide", "transfer", "restaurant"],
  }).notNull(),
  location: text("location").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email").notNull(),
  commissionPct: real("commission_pct"),
  // Institutional knowledge: "manager responds within hours", "holds expire fast"
  notes: text("notes"),
});

// ---------- Communication ----------

export const threads = sqliteTable("threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subject: text("subject").notNull(),
  counterpartType: text("counterpart_type", { enum: ["client", "supplier"] }).notNull(),
  clientId: integer("client_id").references(() => clients.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  tripId: integer("trip_id").references(() => trips.id),
  lastMessageAt: integer("last_message_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id")
    .notNull()
    .references(() => threads.id),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
  fromAddr: text("from_addr").notNull(),
  toAddr: text("to_addr").notNull(),
  body: text("body").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }).notNull(),
});

export const callNotes = sqliteTable("call_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  tripId: integer("trip_id").references(() => trips.id),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Structured rate quotes extracted by the parsing agent from supplier emails.
// One row per quoted option; messageId is the provenance — every number in the
// comparison table traces back to the exact email it came from.
export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripId: integer("trip_id")
    .notNull()
    .references(() => trips.id),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id),
  label: text("label").notNull(),
  currency: text("currency").notNull(),
  amount: real("amount").notNull(),
  // The figure exactly as the supplier wrote it (e.g. "USD 1.890") — lets a
  // designer eyeball whether normalization (European decimals!) went wrong
  amountAsWritten: text("amount_as_written").notNull(),
  unit: text("unit", { enum: ["per_night", "per_stay"] }).notNull(),
  scope: text("scope", {
    enum: ["per_person", "per_room", "per_unit", "whole_party"],
  }).notNull(),
  basis: text("basis", { enum: ["net", "gross", "unstated"] }).notNull(),
  minNights: integer("min_nights"),
  childPolicy: text("child_policy"),
  holdExpiry: text("hold_expiry"),
  inclusions: text("inclusions", { mode: "json" }).$type<string[]>().notNull(),
  caveats: text("caveats", { mode: "json" }).$type<string[]>().notNull(),
  model: text("model").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Agent-generated reply drafts. Never sent directly — a designer approves,
// edits, or dismisses every one (the human-oversight gate).
export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id")
    .notNull()
    .references(() => threads.id),
  body: text("body").notNull(),
  // Open questions the agent couldn't answer from context — designer must resolve
  flags: text("flags", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status", { enum: ["pending", "approved", "dismissed"] }).notNull(),
  // What the designer actually sent (may differ from body) — the edit distance
  // between body and sentBody is the core draft-quality eval signal
  sentBody: text("sent_body"),
  model: text("model").notNull(),
  // Exact context the agent saw when drafting — audit trail now, eval dataset later
  promptContext: text("prompt_context", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
});

// Structured trip questionnaires as submitted by the client
export const intakeForms = sqliteTable("intake_forms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  tripId: integer("trip_id").references(() => trips.id),
  // JSON blob of question → answer; schema varies per agency form version
  answers: text("answers", { mode: "json" }).notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),
});

// One row per retrievable fact about a client. Embedded once, retrieved by
// cosine similarity; contentHash makes re-indexing idempotent.
export const contextChunks = sqliteTable("context_chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  sourceType: text("source_type", {
    enum: ["message", "call_note", "intake_answer", "preference"],
  }).notNull(),
  sourceId: integer("source_id").notNull(),
  text: text("text").notNull(),
  contentHash: text("content_hash").notNull().unique(),
  embedding: text("embedding", { mode: "json" }).$type<number[]>().notNull(),
  model: text("model").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
