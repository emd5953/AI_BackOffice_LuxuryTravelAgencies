import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  callNotes,
  clientPreferences,
  contextChunks,
  intakeForms,
  messages,
  threads,
} from "@/db/schema";
import { EMBEDDING_MODEL, embedDocuments } from "@/lib/embeddings";

type SourceType = "message" | "call_note" | "intake_answer" | "preference";

interface Candidate {
  sourceType: SourceType;
  sourceId: number;
  text: string;
  contentHash: string;
}

function hashCandidate(clientId: number, sourceType: SourceType, sourceId: number, text: string): string {
  return createHash("sha256").update(`${clientId}|${sourceType}|${sourceId}|${text}`).digest("hex");
}

function candidate(clientId: number, sourceType: SourceType, sourceId: number, text: string): Candidate {
  return { sourceType, sourceId, text, contentHash: hashCandidate(clientId, sourceType, sourceId, text) };
}

async function buildCandidates(clientId: number): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  const clientMessages = await db
    .select({ message: messages, thread: threads })
    .from(messages)
    .innerJoin(threads, eq(messages.threadId, threads.id))
    .where(eq(threads.clientId, clientId));

  for (const { message, thread } of clientMessages) {
    const text = `Email ${message.direction === "inbound" ? "from" : "to"} client, ${message.sentAt.toISOString().slice(0, 10)}, subject "${thread.subject}":\n${message.body}`;
    candidates.push(candidate(clientId, "message", message.id, text));
  }

  const notes = await db.select().from(callNotes).where(eq(callNotes.clientId, clientId));
  for (const note of notes) {
    const text = `Call note (${note.createdAt.toISOString().slice(0, 10)}):\n${note.body}`;
    candidates.push(candidate(clientId, "call_note", note.id, text));
  }

  const forms = await db.select().from(intakeForms).where(eq(intakeForms.clientId, clientId));
  for (const form of forms) {
    const answers = form.answers as Record<string, unknown>;
    for (const [key, value] of Object.entries(answers)) {
      const text = `Intake form answer — ${key}: ${value}`;
      candidates.push(candidate(clientId, "intake_answer", form.id, text));
    }
  }

  const preferences = await db
    .select()
    .from(clientPreferences)
    .where(eq(clientPreferences.clientId, clientId));
  for (const pref of preferences) {
    const text = `Preference (${pref.kind}, source ${pref.source}): ${pref.text}`;
    candidates.push(candidate(clientId, "preference", pref.id, text));
  }

  return candidates;
}

export async function indexClientContext(
  clientId: number,
): Promise<{ indexed: number; skipped: number; deleted: number }> {
  const candidates = await buildCandidates(clientId);
  const candidateHashes = new Set(candidates.map((c) => c.contentHash));

  const existing = await db
    .select({ id: contextChunks.id, contentHash: contextChunks.contentHash })
    .from(contextChunks)
    .where(eq(contextChunks.clientId, clientId));
  const existingHashes = new Set(existing.map((e) => e.contentHash));

  // Stale: previously indexed but no longer a candidate (edited/removed source).
  const staleIds = existing.filter((e) => !candidateHashes.has(e.contentHash)).map((e) => e.id);
  if (staleIds.length > 0) {
    await db.delete(contextChunks).where(inArray(contextChunks.id, staleIds));
  }

  const newCandidates = candidates.filter((c) => !existingHashes.has(c.contentHash));

  if (newCandidates.length > 0) {
    // One embed call for all new candidates — free-tier rate limit is 3
    // requests/min, so never loop one-request-per-text.
    const embeddings = await embedDocuments(newCandidates.map((c) => c.text));
    const now = new Date();
    await db.insert(contextChunks).values(
      newCandidates.map((c, i) => ({
        clientId,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        text: c.text,
        contentHash: c.contentHash,
        embedding: embeddings[i],
        model: EMBEDDING_MODEL,
        createdAt: now,
      })),
    );
  }

  return {
    indexed: newCandidates.length,
    skipped: candidates.length - newCandidates.length,
    deleted: staleIds.length,
  };
}
