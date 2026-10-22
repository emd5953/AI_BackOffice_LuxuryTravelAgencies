"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { accessError } from "@/lib/operations/auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { drafts, suggestions, threads } from "@/db/schema";
import { draftReply } from "@/lib/agents/draft-reply";
import { parseQuotesFromThread } from "@/lib/agents/parse-quote";
import { generateSuggestions } from "@/lib/agents/suggest";
import { retrieveContext } from "@/lib/retrieval";

async function requireOperator() {
  const h = await headers();
  const denied = accessError(
    new Request(`http://${h.get("host") || "unknown"}/inbox`, { headers: h }),
  );
  if (denied) throw new Error("Operator authentication required.");
}

export async function parseQuotes(threadId: number) {
  await requireOperator();
  const [thread] = await db
    .select({ tripId: threads.tripId })
    .from(threads)
    .where(eq(threads.id, threadId));
  await parseQuotesFromThread(threadId);
  revalidatePath(`/inbox/${threadId}`);
  if (thread?.tripId) revalidatePath(`/trips/${thread.tripId}/quotes`);
}

export async function generateDraft(threadId: number) {
  await requireOperator();
  await draftReply(threadId);
  revalidatePath(`/inbox/${threadId}`);
}

export async function approveDraft(draftId: number, sentBody: string) {
  await requireOperator();
  if (!sentBody.trim() || sentBody.length > 20000)
    throw new Error("Enter a draft under 20,000 characters.");
  const now = new Date();

  // Atomic claim: only one concurrent caller can flip pending -> approved.
  const claimed = await db
    .update(drafts)
    .set({ status: "approved", sentBody, resolvedAt: now })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "pending")))
    .returning();
  const [draft] = claimed;
  if (!draft) throw new Error("Draft is not pending");

  // Approval is internal only. A database row must never masquerade as delivery.

  revalidatePath(`/inbox/${draft.threadId}`);
  revalidatePath("/inbox");
}

// Read-only — the app has no API routes, so this follows the same server
// action pattern as the mutations above.
export async function searchClientContext(clientId: number, query: string) {
  await requireOperator();
  return retrieveContext(clientId, query, 8);
}

export async function dismissDraft(draftId: number) {
  await requireOperator();
  const claimed = await db
    .update(drafts)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "pending")))
    .returning();
  const [draft] = claimed;
  if (!draft) throw new Error("Draft is not pending");
  revalidatePath(`/inbox/${draft.threadId}`);
}

export async function refreshSuggestions() {
  await requireOperator();
  await generateSuggestions();
  revalidatePath("/today");
}

export async function resolveSuggestion(
  id: number,
  outcome: "done" | "dismissed",
) {
  await requireOperator();
  // Atomic claim: only one concurrent caller can flip open -> done/dismissed.
  const claimed = await db
    .update(suggestions)
    .set({ status: outcome, resolvedAt: new Date() })
    .where(and(eq(suggestions.id, id), eq(suggestions.status, "open")))
    .returning();
  const [suggestion] = claimed;
  if (!suggestion) throw new Error("Suggestion is not open");
  revalidatePath("/today");
}
