import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  callNotes,
  clientPreferences,
  clients,
  intakeForms,
  messages,
  suppliers,
  threads,
  trips,
} from "@/db/schema";

// Explicit context assembly: everything the agent sees goes through here.
// This is the seam Phase 3 (embeddings + retrieval) replaces — for now the
// dataset is small enough to hand the agent a client's full record.

export async function getClientContext(clientId: number) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) throw new Error(`Client ${clientId} not found`);

  const [preferences, notes, forms, clientTrips] = await Promise.all([
    db.select().from(clientPreferences).where(eq(clientPreferences.clientId, clientId)),
    db.select().from(callNotes).where(eq(callNotes.clientId, clientId)),
    db.select().from(intakeForms).where(eq(intakeForms.clientId, clientId)),
    db.select().from(trips).where(eq(trips.clientId, clientId)),
  ]);

  return { client, preferences, callNotes: notes, intakeForms: forms, trips: clientTrips };
}

export async function getThread(threadId: number) {
  const [thread] = await db.select().from(threads).where(eq(threads.id, threadId));
  if (!thread) throw new Error(`Thread ${threadId} not found`);
  return thread;
}

export async function getThreadMessages(threadId: number) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.sentAt));
}

export async function getSupplier(supplierId: number) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
  return supplier;
}
