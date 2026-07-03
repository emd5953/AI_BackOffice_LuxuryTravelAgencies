import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drafts } from "@/db/schema";
import { quotes } from "@/db/schema";
import { getClientContext, getSupplier, getThread, getThreadMessages } from "@/lib/context";
import { DraftPanel } from "@/components/draft-panel";
import { ParsePanel } from "@/components/parse-panel";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId: rawId } = await params;
  const threadId = Number(rawId);
  if (!Number.isFinite(threadId)) notFound();

  const thread = await getThread(threadId).catch(() => null);
  if (!thread) notFound();

  const msgs = await getThreadMessages(threadId);
  const clientCtx = thread.clientId ? await getClientContext(thread.clientId) : null;
  const supplier = thread.supplierId ? await getSupplier(thread.supplierId) : null;

  const [pendingDraft] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.threadId, threadId), eq(drafts.status, "pending")))
    .orderBy(desc(drafts.createdAt))
    .limit(1);

  const threadQuotes =
    thread.counterpartType === "supplier" && thread.supplierId && thread.tripId
      ? await db
          .select()
          .from(quotes)
          .where(and(eq(quotes.tripId, thread.tripId), eq(quotes.supplierId, thread.supplierId)))
      : [];

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Conversation */}
        <section className="overflow-hidden rounded-2xl border border-hairline bg-surface-raised lg:col-span-2">
          <header className="border-b border-hairline p-4">
            <h1 className="font-display text-lg text-ink">{thread.subject}</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              {clientCtx?.client.name ?? supplier?.name} · {thread.counterpartType}
            </p>
          </header>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto p-4">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.direction === "inbound" ? "mr-8 bg-surface" : "ml-8 bg-accent-soft"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">{m.fromAddr}</span>
                  <time className="text-xs text-ink-muted">
                    {m.sentAt.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <span className="text-ink">{m.body}</span>
              </div>
            ))}
          </div>

          {thread.counterpartType === "client" ? (
            <DraftPanel
              key={pendingDraft?.id ?? "none"}
              threadId={threadId}
              draft={
                pendingDraft
                  ? { id: pendingDraft.id, body: pendingDraft.body, flags: pendingDraft.flags }
                  : null
              }
            />
          ) : (
            <ParsePanel
              threadId={threadId}
              tripId={thread.tripId}
              quoteCount={threadQuotes.length}
            />
          )}
        </section>

        {/* Context sidebar */}
        <aside className="space-y-4">
          {clientCtx && (
            <>
              <div className="rounded-2xl border border-hairline bg-surface-raised p-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Client
                </h2>
                <Link
                  href={`/clients/${clientCtx.client.id}`}
                  className="text-sm font-medium text-ink hover:text-accent hover:underline"
                >
                  {clientCtx.client.name}
                </Link>
                <p className="text-xs text-ink-muted">{clientCtx.client.email}</p>
                {clientCtx.client.bio && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {clientCtx.client.bio}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-hairline bg-surface-raised p-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Preferences
                </h2>
                <ul className="space-y-2">
                  {clientCtx.preferences.map((p) => (
                    <li key={p.id} className="text-xs leading-snug text-ink">
                      <span
                        className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          p.kind === "confirmed"
                            ? "bg-positive/15 text-positive"
                            : "bg-warn-soft text-warn"
                        }`}
                        title={`Source: ${p.source}`}
                      >
                        {p.kind}
                      </span>
                      {p.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface-raised p-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Call notes
                </h2>
                {clientCtx.callNotes.length === 0 && (
                  <p className="text-xs text-ink-muted">None</p>
                )}
                <ul className="space-y-3">
                  {clientCtx.callNotes.map((n) => (
                    <li key={n.id} className="text-xs leading-relaxed text-ink-muted">
                      <time className="mb-0.5 block text-[10px] text-ink-muted">
                        {n.createdAt.toLocaleDateString()}
                      </time>
                      {n.body}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface-raised p-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Trips
                </h2>
                <ul className="space-y-2">
                  {clientCtx.trips.map((t) => (
                    <li key={t.id} className="text-xs">
                      <p className="font-medium text-ink">{t.title}</p>
                      <p className="text-ink-muted">
                        {t.status} · {t.partySize ?? "?"} pax
                        {t.budgetUsd ? ` · $${t.budgetUsd.toLocaleString()}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {supplier && (
            <div className="rounded-2xl border border-hairline bg-surface-raised p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Supplier
              </h2>
              <p className="text-sm font-medium text-ink">{supplier.name}</p>
              <p className="text-xs text-ink-muted">
                {supplier.type} · {supplier.location}
                {supplier.commissionPct ? ` · ${supplier.commissionPct}% commission` : ""}
              </p>
              {supplier.notes && (
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{supplier.notes}</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
