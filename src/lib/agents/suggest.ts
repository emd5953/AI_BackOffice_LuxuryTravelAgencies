import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  callNotes,
  clientPreferences,
  clients,
  messages,
  quotes,
  suggestions,
  suppliers,
  threads,
  trips,
} from "@/db/schema";
import { AGENCY_NAME, DESIGNER_NAME } from "@/lib/constants";
import { recordRun } from "@/lib/telemetry";

const MODEL = "claude-opus-4-8";

const anthropic = new Anthropic();

const SuggestionItem = z.object({
  clientId: z.number().describe("The client this suggestion is about"),
  tripId: z.number().nullable().describe("The trip this suggestion relates to, if any"),
  kind: z.enum(["deadline", "follow_up", "opportunity"]),
  urgency: z.number().describe("1 = act today, 2 = this week, 3 = keep in mind"),
  title: z.string().describe("Short, specific — what needs doing"),
  rationale: z
    .string()
    .describe("Why this matters now, referencing the dates/facts that make it urgent"),
  evidence: z
    .array(z.string())
    .describe("Short verbatim-ish quotes from the context that support this suggestion"),
  sourceRefs: z
    .array(z.string())
    .describe("The ref ids (e.g. 'quote:3', 'call_note:6') this suggestion is built on"),
});

const SuggestOutput = z.object({
  suggestions: z.array(SuggestionItem),
});

const SYSTEM = `You are the proactive layer of ${AGENCY_NAME}'s back office, working alongside ${DESIGNER_NAME}. Given today's date and the full book of business across every client, surface the things a designer would kick themselves for missing:

- Expiring holds and deadlines. Resolve relative dates ("till Friday", "5 days", "decide-by this Friday") against the receivedAt date of the email or call note that stated them — not against today's date.
- Threads awaiting a reply for too long — client or supplier messages that have sat inbound without an outbound response.
- Unconfirmed details that block a booking (a room, a guest, a policy question left hanging).
- Genuine opportunities surfaced by client preferences or history — not generic upsell noise.

Hard rules:
- Every suggestion must cite the refs (clientId, and the specific preference/call_note/trip/thread/quote ref ids) it is built on in sourceRefs.
- Never invent facts, dates, or deadlines that are not in the provided context.
- Never suggest something with no supporting evidence.
- Quality over quantity: an empty list is better than noise. Only surface what a sharp, attentive designer would actually flag.`;

interface ClientRow {
  clientId: number;
  name: string;
  bio: string | null;
  preferences: { ref: string; kind: string; text: string }[];
  callNotes: { ref: string; date: string; body: string }[];
  trips: {
    ref: string;
    tripId: number;
    title: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    partySize: number | null;
    budgetUsd: number | null;
  }[];
  threads: {
    ref: string;
    subject: string;
    counterpart: string;
    lastMessageAt: string;
    lastDirection: "inbound" | "outbound" | null;
  }[];
  quotes: {
    ref: string;
    supplier: string;
    label: string;
    holdExpiry: string | null;
    receivedAt: string;
  }[];
}

// Assembled once across every client — the model sees the whole book of
// business in one pass so it can compare urgency across clients, not just
// within one thread. Every item carries its own ref id so suggestions can
// cite exactly what they're built on.
async function buildBookOfBusiness(): Promise<ClientRow[]> {
  const [
    allClients,
    allPreferences,
    allCallNotes,
    allTrips,
    allThreads,
    allQuotes,
    allSuppliers,
    allMessages,
  ] = await Promise.all([
    db.select().from(clients),
    db.select().from(clientPreferences),
    db.select().from(callNotes),
    db.select().from(trips),
    db.select().from(threads),
    db.select().from(quotes),
    db.select().from(suppliers),
    db.select().from(messages),
  ]);

  const supplierNameById = new Map(allSuppliers.map((s) => [s.id, s.name]));
  const messageById = new Map(allMessages.map((m) => [m.id, m]));

  // Latest message per thread, for lastDirection — same signal the inbox
  // page uses to flag "awaiting reply".
  const latestMessageByThread = new Map<number, (typeof allMessages)[number]>();
  for (const m of allMessages) {
    const current = latestMessageByThread.get(m.threadId);
    if (!current || m.sentAt > current.sentAt) latestMessageByThread.set(m.threadId, m);
  }

  return allClients.map((client) => {
    const clientTrips = allTrips.filter((t) => t.clientId === client.id);
    const tripIds = new Set(clientTrips.map((t) => t.id));

    const clientThreads = allThreads.filter(
      (th) =>
        th.clientId === client.id || (th.tripId != null && tripIds.has(th.tripId) && th.counterpartType === "supplier"),
    );

    const clientQuotes = allQuotes.filter((q) => tripIds.has(q.tripId));

    return {
      clientId: client.id,
      name: client.name,
      bio: client.bio,
      preferences: allPreferences
        .filter((p) => p.clientId === client.id)
        .map((p) => ({ ref: `preference:${p.id}`, kind: p.kind, text: p.text })),
      callNotes: allCallNotes
        .filter((n) => n.clientId === client.id)
        .map((n) => ({ ref: `call_note:${n.id}`, date: n.createdAt.toISOString(), body: n.body })),
      trips: clientTrips.map((t) => ({
        ref: `trip:${t.id}`,
        tripId: t.id,
        title: t.title,
        status: t.status,
        startDate: t.startDate,
        endDate: t.endDate,
        partySize: t.partySize,
        budgetUsd: t.budgetUsd,
      })),
      threads: clientThreads.map((th) => {
        const last = latestMessageByThread.get(th.id);
        return {
          ref: `thread:${th.id}`,
          subject: th.subject,
          counterpart: th.counterpartType === "client" ? "client" : (supplierNameById.get(th.supplierId!) ?? "Unknown"),
          lastMessageAt: th.lastMessageAt.toISOString(),
          lastDirection: last?.direction ?? null,
        };
      }),
      quotes: clientQuotes.map((q) => ({
        ref: `quote:${q.id}`,
        supplier: supplierNameById.get(q.supplierId) ?? "Unknown",
        label: q.label,
        holdExpiry: q.holdExpiry,
        receivedAt: (messageById.get(q.messageId)?.sentAt ?? q.createdAt).toISOString(),
      })),
    };
  });
}

function contentHashFor(clientId: number, kind: string, title: string): string {
  return createHash("sha256")
    .update(`${clientId}|${kind}|${title.toLowerCase().trim()}`)
    .digest("hex");
}

export async function generateSuggestions(): Promise<{
  inserted: number;
  skippedDismissed: number;
  droppedInvalid: number;
}> {
  const book = await buildBookOfBusiness();
  const today = new Date().toISOString().slice(0, 10);

  const userPrompt = [
    `Today's date: ${today}`,
    "",
    "# Book of business — every client, their trips, threads, quotes, preferences, and call notes",
    JSON.stringify(book, null, 2),
    "",
    "Scan the whole book and surface suggestions worth a designer's attention today.",
  ].join("\n");

  const response = await recordRun({ agent: "suggest", model: MODEL }, async () => {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: zodOutputFormat(SuggestOutput) },
    });
    return { result: response, usage: response.usage };
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model declined to generate suggestions");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Model output did not match the suggestions schema");
  }

  const validClientIds = new Set(book.map((c) => c.clientId));
  const now = new Date();

  return db.transaction(async (tx) => {
    // Regenerating replaces the open set; dismissals persist across regens.
    await tx.delete(suggestions).where(eq(suggestions.status, "open"));

    const dismissedHashes = new Set(
      (
        await tx
          .select({ contentHash: suggestions.contentHash })
          .from(suggestions)
          .where(eq(suggestions.status, "dismissed"))
      ).map((r) => r.contentHash),
    );

    let inserted = 0;
    let skippedDismissed = 0;
    let droppedInvalid = 0;

    for (const s of parsed.suggestions) {
      if (!validClientIds.has(s.clientId)) {
        droppedInvalid++;
        continue;
      }
      const contentHash = contentHashFor(s.clientId, s.kind, s.title);
      if (dismissedHashes.has(contentHash)) {
        skippedDismissed++;
        continue;
      }
      await tx
        .insert(suggestions)
        .values({
          clientId: s.clientId,
          tripId: s.tripId,
          kind: s.kind,
          urgency: s.urgency,
          title: s.title,
          rationale: s.rationale,
          evidence: s.evidence,
          sourceRefs: s.sourceRefs,
          contentHash,
          status: "open",
          model: MODEL,
          createdAt: now,
          resolvedAt: null,
        });
      inserted++;
    }

    return { inserted, skippedDismissed, droppedInvalid };
  });
}
