import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, drafts, messages, suggestions, threads } from "@/db/schema";
import { AGENCY_NAME } from "@/lib/constants";
import { SuggestionCard } from "@/components/suggestion-card";
import { RefreshSuggestionsButton } from "@/components/refresh-suggestions-button";

export const dynamic = "force-dynamic";

async function getOpenSuggestions() {
  const open = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.status, "open"))
    .orderBy(asc(suggestions.urgency), desc(suggestions.createdAt));

  const allClients = await db.select().from(clients);
  const nameById = new Map(allClients.map((c) => [c.id, c.name]));

  return open.map((s) => ({
    id: s.id,
    clientId: s.clientId,
    clientName: nameById.get(s.clientId) ?? "Unknown client",
    kind: s.kind,
    urgency: s.urgency,
    title: s.title,
    rationale: s.rationale,
    evidence: s.evidence,
    sourceRefs: s.sourceRefs,
  }));
}

async function getAwaitingReply() {
  const clientThreads = await db
    .select()
    .from(threads)
    .where(eq(threads.counterpartType, "client"))
    .orderBy(desc(threads.lastMessageAt));

  const withDirection = await Promise.all(
    clientThreads.map(async (thread) => {
      const [last] = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, thread.id))
        .orderBy(desc(messages.sentAt))
        .limit(1);
      const client = thread.clientId
        ? (await db.select().from(clients).where(eq(clients.id, thread.clientId)))[0]
        : undefined;
      return {
        ...thread,
        clientName: client?.name ?? "Unknown",
        awaitingReply: last?.direction === "inbound",
      };
    }),
  );

  return withDirection.filter((t) => t.awaitingReply);
}

async function getPendingDraftCount() {
  const pending = await db.select().from(drafts).where(eq(drafts.status, "pending"));
  return pending.length;
}

export default async function TodayPage() {
  const [openSuggestions, awaitingReply, pendingDraftCount] = await Promise.all([
    getOpenSuggestions(),
    getAwaitingReply(),
    getPendingDraftCount(),
  ]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Today</h1>
          <p className="text-sm text-zinc-500">
            {AGENCY_NAME} · {today}
          </p>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/inbox"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Inbox →
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Dashboard →
          </Link>
        </nav>
      </header>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Suggestions
            </h2>
            <RefreshSuggestionsButton />
          </div>

          {openSuggestions.length === 0 ? (
            <p className="text-sm text-zinc-500 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              No open suggestions — refresh to scan the book of business.
            </p>
          ) : (
            <div className="space-y-3">
              {openSuggestions.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <header className="border-b border-zinc-200 dark:border-zinc-800 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Awaiting your reply
            </h2>
          </header>
          {awaitingReply.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">Nothing waiting on you.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {awaitingReply.map((thread) => (
                <li key={thread.id}>
                  <Link
                    href={`/inbox/${thread.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{thread.clientName}</p>
                      <p className="text-xs text-zinc-500 truncate">{thread.subject}</p>
                    </div>
                    <time className="text-xs text-zinc-400 shrink-0">
                      {thread.lastMessageAt.toLocaleDateString()}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm text-zinc-500">
          <Link href="/inbox" className="text-blue-700 dark:text-blue-400 hover:underline">
            {pendingDraftCount} pending draft{pendingDraftCount === 1 ? "" : "s"} in the inbox
          </Link>
        </p>
      </div>
    </main>
  );
}
