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
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">{AGENCY_NAME}</h1>
        <p className="text-sm text-zinc-500">Inbox</p>
      </header>

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800">
        {inbox.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/inbox/${thread.id}`}
              className="flex items-start gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{thread.counterpart}</span>
                  <span className="text-xs rounded-full border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-zinc-500">
                    {thread.counterpartType}
                  </span>
                  {thread.awaitingReply && (
                    <span className="text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 font-medium">
                      awaiting reply
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate mt-0.5">
                  {thread.subject}
                </p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{thread.snippet}</p>
              </div>
              <time className="text-xs text-zinc-400 shrink-0">
                {thread.lastMessageAt.toLocaleDateString()}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
