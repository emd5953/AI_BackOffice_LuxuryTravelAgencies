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
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
          The morning, <em className="italic text-accent">curated</em>.
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {AGENCY_NAME} · {today}
        </p>
      </header>

      <div className="space-y-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Suggestions
            </h2>
            <RefreshSuggestionsButton />
          </div>

          {openSuggestions.length === 0 ? (
            <p className="rounded-3xl border border-hairline/60 bg-surface-raised p-4 text-sm text-ink-muted shadow-float">
              No open suggestions — refresh to scan the book of business.
            </p>
          ) : (
            <div className="stagger space-y-3">
              {openSuggestions.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} />
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-hairline/60 bg-surface-raised shadow-float">
          <header className="border-b border-hairline p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Awaiting your reply
            </h2>
          </header>
          {awaitingReply.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">Nothing waiting on you.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {awaitingReply.map((thread) => (
                <li key={thread.id}>
                  <Link
                    href={`/inbox/${thread.id}`}
                    className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{thread.clientName}</p>
                      <p className="truncate text-xs text-ink-muted">{thread.subject}</p>
                    </div>
                    <time className="shrink-0 text-xs text-ink-muted">
                      {thread.lastMessageAt.toLocaleDateString()}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm text-ink-muted">
          <Link href="/inbox" className="text-accent hover:underline">
            {pendingDraftCount} pending draft{pendingDraftCount === 1 ? "" : "s"} in the inbox
          </Link>
        </p>
      </div>
    </div>
  );
}
