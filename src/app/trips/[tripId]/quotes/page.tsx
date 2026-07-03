import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, quotes, suppliers, threads, trips } from "@/db/schema";
import { estimateStayTotal, nightsBetween } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId: rawId } = await params;
  const tripId = Number(rawId);
  if (!Number.isFinite(tripId)) notFound();

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip) notFound();
  const [client] = await db.select().from(clients).where(eq(clients.id, trip.clientId));

  const tripQuotes = await db.select().from(quotes).where(eq(quotes.tripId, tripId));
  const allSuppliers = await db.select().from(suppliers);
  const supplierThreads = await db
    .select()
    .from(threads)
    .where(eq(threads.tripId, tripId));

  const bySupplier = new Map<number, typeof tripQuotes>();
  for (const q of tripQuotes) {
    const list = bySupplier.get(q.supplierId) ?? [];
    list.push(q);
    bySupplier.set(q.supplierId, list);
  }

  const nights =
    trip.startDate && trip.endDate ? nightsBetween(trip.startDate, trip.endDate) : null;

  // Suppliers with a thread on this trip but no extraction yet
  const pendingSuppliers = supplierThreads
    .filter((t) => t.counterpartType === "supplier" && t.supplierId && !bySupplier.has(t.supplierId))
    .map((t) => ({
      thread: t,
      supplier: allSuppliers.find((s) => s.id === t.supplierId),
    }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight text-ink">{trip.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {client?.name} · {trip.destination} · {trip.startDate} → {trip.endDate}
          {nights ? ` (${nights} nights)` : ""} · {trip.partySize} pax
          {trip.budgetUsd ? ` · budget $${trip.budgetUsd.toLocaleString()}` : ""}
        </p>
      </header>

      <div className="space-y-6">
        {[...bySupplier.entries()].map(([supplierId, supplierQuotes]) => {
          const supplier = allSuppliers.find((s) => s.id === supplierId);
          const thread = supplierThreads.find((t) => t.supplierId === supplierId);
          return (
            <section
              key={supplierId}
              className="overflow-hidden rounded-2xl border border-hairline bg-surface-raised"
            >
              <header className="flex items-center justify-between border-b border-hairline p-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{supplier?.name}</h2>
                  <p className="text-xs text-ink-muted">
                    {supplier?.location}
                    {supplier?.commissionPct
                      ? ` · standard commission ${supplier.commissionPct}%`
                      : ""}
                  </p>
                </div>
                {thread && (
                  <Link
                    href={`/inbox/${thread.id}`}
                    className="text-xs text-accent hover:underline"
                  >
                    source email →
                  </Link>
                )}
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-ink-muted">
                      <th className="p-3 font-medium">Option</th>
                      <th className="p-3 font-medium">As written</th>
                      <th className="p-3 font-medium">Normalized</th>
                      <th className="p-3 font-medium">Basis</th>
                      <th className="p-3 font-medium">Est. stay total</th>
                      <th className="p-3 font-medium">Hold</th>
                      <th className="p-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierQuotes.map((q) => {
                      const est = estimateStayTotal(q, trip);
                      return (
                        <tr key={q.id} className="border-b border-hairline align-top">
                          <td className="p-3 font-medium text-ink">{q.label}</td>
                          <td className="p-3 font-mono text-xs text-ink-muted">
                            {q.amountAsWritten}
                          </td>
                          <td className="p-3 whitespace-nowrap text-ink">
                            ${q.amount.toLocaleString()}{" "}
                            <span className="text-xs text-ink-muted">
                              {q.unit === "per_night" ? "/night" : "/stay"} ·{" "}
                              {q.scope.replace("_", " ")}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                                q.basis === "net"
                                  ? "bg-warn-soft text-warn"
                                  : q.basis === "gross"
                                    ? "bg-positive/15 text-positive"
                                    : "bg-hairline text-ink-muted"
                              }`}
                            >
                              {q.basis}
                            </span>
                          </td>
                          <td className="p-3">
                            {est.totalUsd ? (
                              <>
                                <span className="font-semibold text-ink">
                                  ${est.totalUsd.toLocaleString()}
                                </span>
                                <p className="mt-0.5 text-[10px] text-ink-muted">{est.formula}</p>
                              </>
                            ) : (
                              "—"
                            )}
                            {est.warnings.map((w, i) => (
                              <p key={i} className="mt-0.5 text-[10px] text-warn">
                                ⚠ {w}
                              </p>
                            ))}
                          </td>
                          <td className="p-3 text-xs text-ink">{q.holdExpiry ?? "—"}</td>
                          <td className="max-w-56 p-3 text-xs text-ink-muted">
                            {q.childPolicy && <p className="mb-1">Children: {q.childPolicy}</p>}
                            {q.caveats.length > 0 && (
                              <ul className="list-disc space-y-0.5 pl-4">
                                {q.caveats.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {pendingSuppliers.length > 0 && (
          <section className="rounded-2xl border border-dashed border-hairline p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Awaiting extraction
            </h2>
            <ul className="space-y-1">
              {pendingSuppliers.map(({ thread, supplier }) => (
                <li key={thread.id} className="text-sm">
                  <Link href={`/inbox/${thread.id}`} className="text-accent hover:underline">
                    {supplier?.name ?? "Unknown"} — open thread to extract →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {bySupplier.size === 0 && pendingSuppliers.length === 0 && (
          <p className="text-sm text-ink-muted">No supplier threads on this trip yet.</p>
        )}
      </div>
    </div>
  );
}
