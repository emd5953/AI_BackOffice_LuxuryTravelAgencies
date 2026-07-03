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
    <main className="mx-auto max-w-6xl p-6">
      <Link href="/inbox" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Inbox
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-xl font-semibold">{trip.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">
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
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
                <div>
                  <h2 className="font-semibold text-sm">{supplier?.name}</h2>
                  <p className="text-xs text-zinc-500">
                    {supplier?.location}
                    {supplier?.commissionPct
                      ? ` · standard commission ${supplier.commissionPct}%`
                      : ""}
                  </p>
                </div>
                {thread && (
                  <Link
                    href={`/inbox/${thread.id}`}
                    className="text-xs text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    source email →
                  </Link>
                )}
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
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
                        <tr
                          key={q.id}
                          className="border-b border-zinc-100 dark:border-zinc-900 align-top"
                        >
                          <td className="p-3 font-medium">{q.label}</td>
                          <td className="p-3 font-mono text-xs text-zinc-500">
                            {q.amountAsWritten}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            ${q.amount.toLocaleString()}{" "}
                            <span className="text-xs text-zinc-500">
                              {q.unit === "per_night" ? "/night" : "/stay"} ·{" "}
                              {q.scope.replace("_", " ")}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                                q.basis === "net"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : q.basis === "gross"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {q.basis}
                            </span>
                          </td>
                          <td className="p-3">
                            {est.totalUsd ? (
                              <>
                                <span className="font-semibold">
                                  ${est.totalUsd.toLocaleString()}
                                </span>
                                <p className="text-[10px] text-zinc-400 mt-0.5">{est.formula}</p>
                              </>
                            ) : (
                              "—"
                            )}
                            {est.warnings.map((w, i) => (
                              <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                                ⚠ {w}
                              </p>
                            ))}
                          </td>
                          <td className="p-3 text-xs">{q.holdExpiry ?? "—"}</td>
                          <td className="p-3 text-xs text-zinc-600 dark:text-zinc-400 max-w-56">
                            {q.childPolicy && <p className="mb-1">Children: {q.childPolicy}</p>}
                            {q.caveats.length > 0 && (
                              <ul className="list-disc pl-4 space-y-0.5">
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
          <section className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
              Awaiting extraction
            </h2>
            <ul className="space-y-1">
              {pendingSuppliers.map(({ thread, supplier }) => (
                <li key={thread.id} className="text-sm">
                  <Link
                    href={`/inbox/${thread.id}`}
                    className="text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    {supplier?.name ?? "Unknown"} — open thread to extract →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {bySupplier.size === 0 && pendingSuppliers.length === 0 && (
          <p className="text-sm text-zinc-500">No supplier threads on this trip yet.</p>
        )}
      </div>
    </main>
  );
}
