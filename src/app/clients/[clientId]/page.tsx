import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientContext } from "@/lib/context";
import { ContextSearch } from "@/components/context-search";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId: rawId } = await params;
  const clientId = Number(rawId);
  if (!Number.isFinite(clientId)) notFound();

  const ctx = await getClientContext(clientId).catch(() => null);
  if (!ctx) notFound();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/inbox" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Inbox
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-xl font-semibold">{ctx.client.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">{ctx.client.email}</p>
        {ctx.client.bio && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
            {ctx.client.bio}
          </p>
        )}
      </header>

      <div className="space-y-6">
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            Preferences
          </h2>
          {ctx.preferences.length === 0 && <p className="text-xs text-zinc-400">None</p>}
          <ul className="space-y-2">
            {ctx.preferences.map((p) => (
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
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            Call notes
          </h2>
          {ctx.callNotes.length === 0 && <p className="text-xs text-zinc-400">None</p>}
          <ul className="space-y-3">
            {ctx.callNotes.map((n) => (
              <li key={n.id} className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                <time className="block text-[10px] text-zinc-400 mb-0.5">
                  {n.createdAt.toLocaleDateString()}
                </time>
                {n.body}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            Trips
          </h2>
          {ctx.trips.length === 0 && <p className="text-xs text-zinc-400">None</p>}
          <ul className="space-y-2">
            {ctx.trips.map((t) => (
              <li key={t.id} className="text-xs">
                <Link
                  href={`/trips/${t.id}/quotes`}
                  className="font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  {t.title}
                </Link>
                <p className="text-zinc-500">
                  {t.status} · {t.partySize ?? "?"} pax
                  {t.budgetUsd ? ` · $${t.budgetUsd.toLocaleString()}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            Memory search
          </h2>
          <ContextSearch clientId={clientId} />
        </section>
      </div>
    </main>
  );
}
