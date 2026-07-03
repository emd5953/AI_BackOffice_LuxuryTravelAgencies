import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drafts } from "@/db/schema";
import { getClientContext, getSupplier, getThread, getThreadMessages } from "@/lib/context";
import { DraftPanel } from "@/components/draft-panel";

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

  return (
    <main className="mx-auto max-w-6xl p-6">
      <Link href="/inbox" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Inbox
      </Link>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <section className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <header className="border-b border-zinc-200 dark:border-zinc-800 p-4">
            <h1 className="font-semibold">{thread.subject}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {clientCtx?.client.name ?? supplier?.name} · {thread.counterpartType}
            </p>
          </header>

          <div className="p-4 space-y-4 max-h-[55vh] overflow-y-auto">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.direction === "inbound"
                    ? "bg-zinc-100 dark:bg-zinc-900 mr-8"
                    : "bg-blue-50 dark:bg-blue-950/40 ml-8"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-zinc-500">{m.fromAddr}</span>
                  <time className="text-xs text-zinc-400">
                    {m.sentAt.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {m.body}
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
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-xs text-zinc-500">
                Supplier coordination drafting arrives in Phase 2.
              </p>
            </div>
          )}
        </section>

        {/* Context sidebar */}
        <aside className="space-y-4">
          {clientCtx && (
            <>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Client
                </h2>
                <p className="font-medium text-sm">{clientCtx.client.name}</p>
                <p className="text-xs text-zinc-500">{clientCtx.client.email}</p>
                {clientCtx.client.bio && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                    {clientCtx.client.bio}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Preferences
                </h2>
                <ul className="space-y-2">
                  {clientCtx.preferences.map((p) => (
                    <li key={p.id} className="text-xs leading-snug">
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium mr-1.5 ${
                          p.kind === "confirmed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
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

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Call notes
                </h2>
                {clientCtx.callNotes.length === 0 && (
                  <p className="text-xs text-zinc-400">None</p>
                )}
                <ul className="space-y-3">
                  {clientCtx.callNotes.map((n) => (
                    <li key={n.id} className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <time className="block text-[10px] text-zinc-400 mb-0.5">
                        {n.createdAt.toLocaleDateString()}
                      </time>
                      {n.body}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Trips
                </h2>
                <ul className="space-y-2">
                  {clientCtx.trips.map((t) => (
                    <li key={t.id} className="text-xs">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-zinc-500">
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
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                Supplier
              </h2>
              <p className="font-medium text-sm">{supplier.name}</p>
              <p className="text-xs text-zinc-500">
                {supplier.type} · {supplier.location}
                {supplier.commissionPct ? ` · ${supplier.commissionPct}% commission` : ""}
              </p>
              {supplier.notes && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                  {supplier.notes}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
