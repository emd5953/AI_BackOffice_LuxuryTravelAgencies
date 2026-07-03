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
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight text-ink">{ctx.client.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">{ctx.client.email}</p>
        {ctx.client.bio && (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{ctx.client.bio}</p>
        )}
      </header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-hairline bg-surface-raised p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Preferences
          </h2>
          {ctx.preferences.length === 0 && <p className="text-xs text-ink-muted">None</p>}
          <ul className="space-y-2">
            {ctx.preferences.map((p) => (
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
        </section>

        <section className="rounded-2xl border border-hairline bg-surface-raised p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Call notes
          </h2>
          {ctx.callNotes.length === 0 && <p className="text-xs text-ink-muted">None</p>}
          <ul className="space-y-3">
            {ctx.callNotes.map((n) => (
              <li key={n.id} className="text-xs leading-relaxed text-ink-muted">
                <time className="mb-0.5 block text-[10px] text-ink-muted">
                  {n.createdAt.toLocaleDateString()}
                </time>
                {n.body}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-hairline bg-surface-raised p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Trips
          </h2>
          {ctx.trips.length === 0 && <p className="text-xs text-ink-muted">None</p>}
          <ul className="space-y-2">
            {ctx.trips.map((t) => (
              <li key={t.id} className="text-xs">
                <Link href={`/trips/${t.id}/quotes`} className="font-medium text-accent hover:underline">
                  {t.title}
                </Link>
                <p className="text-ink-muted">
                  {t.status} · {t.partySize ?? "?"} pax
                  {t.budgetUsd ? ` · $${t.budgetUsd.toLocaleString()}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-hairline bg-surface-raised p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Memory search
          </h2>
          <ContextSearch clientId={clientId} />
        </section>
      </div>
    </div>
  );
}
