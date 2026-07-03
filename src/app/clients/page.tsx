import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, trips } from "@/db/schema";

export const dynamic = "force-dynamic";

async function getClients() {
  const allClients = await db.select().from(clients).orderBy(asc(clients.name));

  return Promise.all(
    allClients.map(async (client) => {
      const clientTrips = await db.select().from(trips).where(eq(trips.clientId, client.id));
      return { ...client, tripCount: clientTrips.length };
    }),
  );
}

export default async function ClientsPage() {
  const allClients = await getClients();

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
          Clients, <em className="italic text-accent">remembered</em>.
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{allClients.length} in the book</p>
      </header>

      <ul className="stagger space-y-3">
        {allClients.map((client) => (
          <li key={client.id} className="card-in">
            <Link
              href={`/clients/${client.id}`}
              className="flex items-start justify-between gap-3 rounded-3xl border border-hairline/60 bg-surface-raised p-4 shadow-float transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{client.name}</span>
                  <span className="text-xs text-ink-muted">{client.email}</span>
                </div>
                {client.bio && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{client.bio}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                {client.tripCount} trip{client.tripCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
