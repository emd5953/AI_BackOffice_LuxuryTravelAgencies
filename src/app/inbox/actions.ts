"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, drafts, messages, threads } from "@/db/schema";
import { draftReply } from "@/lib/agents/draft-reply";
import { parseQuotesFromThread } from "@/lib/agents/parse-quote";
import { DESIGNER_EMAIL } from "@/lib/constants";
import { retrieveContext } from "@/lib/retrieval";

export async function parseQuotes(threadId: number) {
  const inserted = await parseQuotesFromThread(threadId);
  revalidatePath(`/inbox/${threadId}`);
  if (inserted[0]) revalidatePath(`/trips/${inserted[0].tripId}/quotes`);
}

export async function generateDraft(threadId: number) {
  await draftReply(threadId);
  revalidatePath(`/inbox/${threadId}`);
}

export async function approveDraft(draftId: number, sentBody: string) {
  const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId));
  if (!draft || draft.status !== "pending") throw new Error("Draft is not pending");

  const [thread] = await db.select().from(threads).where(eq(threads.id, draft.threadId));
  if (!thread?.clientId) throw new Error("Thread has no client");
  const [client] = await db.select().from(clients).where(eq(clients.id, thread.clientId));

  const now = new Date();
  // "Send" = write the outbound message (simulated inbox; Gmail API slots in here later)
  await db.insert(messages).values({
    threadId: draft.threadId,
    direction: "outbound",
    fromAddr: DESIGNER_EMAIL,
    toAddr: client.email,
    body: sentBody,
    sentAt: now,
  });
  await db
    .update(drafts)
    .set({ status: "approved", sentBody, resolvedAt: now })
    .where(eq(drafts.id, draftId));
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
  const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId));
  if (!draft || draft.status !== "pending") throw new Error("Draft is not pending");
  await db
    .update(drafts)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(eq(drafts.id, draftId));
  revalidatePath(`/inbox/${draft.threadId}`);
}
