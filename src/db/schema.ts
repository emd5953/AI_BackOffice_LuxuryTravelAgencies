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
