import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, messages, suppliers, threads } from "@/db/schema";
import { AGENCY_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function getInbox() {
  const allThreads = await db.select().from(threads).orderBy(desc(threads.lastMessageAt));

  return Promise.all(
    allThreads.map(async (thread) => {
      const counterpart =
        thread.counterpartType === "client" && thread.clientId
          ? (await db.select().from(clients).where(eq(clients.id, thread.clientId)))[0]?.name
          : thread.supplierId
            ? (await db.select().from(suppliers).where(eq(suppliers.id, thread.supplierId)))[0]
                ?.name
            : "Unknown";

      const threadMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, thread.id))
        .orderBy(desc(messages.sentAt))
        .limit(1);
      const last = threadMessages[0];

      return {
        ...thread,
        counterpart,
        snippet: last?.body.replace(/\s+/g, " ").slice(0, 120) ?? "",
        awaitingReply: last?.direction === "inbound",
      };
    }),
  );
}

export default async function InboxPage() {
  const inbox = await getInbox();

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight text-ink">{AGENCY_NAME}</h1>
        <p className="mt-1 text-sm text-ink-muted">Inbox</p>
      </header>

      <ul className="divide-y divide-hairline rounded-2xl border border-hairline bg-surface-raised">
        {inbox.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/inbox/${thread.id}`}
              className="flex items-start gap-3 p-4 hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{thread.counterpart}</span>
                  <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                    {thread.counterpartType}
                  </span>
                  {thread.awaitingReply && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                      awaiting reply
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink">{thread.subject}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{thread.snippet}</p>
              </div>
              <time className="shrink-0 text-xs text-ink-muted">
                {thread.lastMessageAt.toLocaleDateString()}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
