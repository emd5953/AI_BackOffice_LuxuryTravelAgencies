"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, drafts, messages, threads } from "@/db/schema";
import { draftReply } from "@/lib/agents/draft-reply";
import { parseQuotesFromThread } from "@/lib/agents/parse-quote";
import { DESIGNER_EMAIL } from "@/lib/constants";
import { retrieveContext } from "@/lib/retrieval";

export async function parseQuotes(threadId: number) {
  const [thread] = await db
    .select({ tripId: threads.tripId })
    .from(threads)
    .where(eq(threads.id, threadId));
  await parseQuotesFromThread(threadId);
  revalidatePath(`/inbox/${threadId}`);
  if (thread?.tripId) revalidatePath(`/trips/${thread.tripId}/quotes`);
}

export async function generateDraft(threadId: number) {
  await draftReply(threadId);
  revalidatePath(`/inbox/${threadId}`);
}

export async function approveDraft(draftId: number, sentBody: string) {
  const now = new Date();

  // Atomic claim: only one concurrent caller can flip pending -> approved.
  const claimed = await db
    .update(drafts)
    .set({ status: "approved", sentBody, resolvedAt: now })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "pending")))
    .returning();
  const [draft] = claimed;
  if (!draft) throw new Error("Draft is not pending");

  const [thread] = await db.select().from(threads).where(eq(threads.id, draft.threadId));
  if (!thread?.clientId) throw new Error("Thread has no client");
  const [client] = await db.select().from(clients).where(eq(clients.id, thread.clientId));

  // "Send" = write the outbound message (simulated inbox; Gmail API slots in here later)
  await db.insert(messages).values({
    threadId: draft.threadId,
    direction: "outbound",
    fromAddr: DESIGNER_EMAIL,
    toAddr: client.email,
    body: sentBody,
    sentAt: now,
  });
  await db.update(threads).set({ lastMessageAt: now }).where(eq(threads.id, draft.threadId));

  revalidatePath(`/inbox/${draft.threadId}`);
  revalidatePath("/inbox");
}

// Read-only — the app has no API routes, so this follows the same server
// action pattern as the mutations above.
export async function searchClientContext(clientId: number, query: string) {
  return retrieveContext(clientId, query, 8);
}

export async function dismissDraft(draftId: number) {
  const claimed = await db
    .update(drafts)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "pending")))
    .returning();
  const [draft] = claimed;
  if (!draft) throw new Error("Draft is not pending");
  revalidatePath(`/inbox/${draft.threadId}`);
}
