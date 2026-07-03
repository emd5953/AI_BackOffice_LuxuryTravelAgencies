"use client";

import { useState, useTransition } from "react";
import { searchClientContext } from "@/app/inbox/actions";

interface Result {
  chunkId: number;
  sourceType: string;
  sourceId: number;
  text: string;
  score: number;
}

export function ContextSearch({ clientId }: { clientId: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const runSearch = () => {
    if (!query.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const found = await searchClientContext(clientId, query);
        setResults(found);
      } catch (e) {
        setResults(null);
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this client's history…"
          className="flex-1 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-surface-raised hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {results && results.length === 0 && !error && (
        <p className="text-sm text-ink-muted">
          No results — has this client been indexed? Run npm run index-context.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((r) => (
            <li key={r.chunkId} className="rounded-xl border border-hairline p-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="inline-block rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  {r.sourceType}
                </span>
                <span className="font-mono text-xs text-ink-muted tabular-nums">
                  {r.score.toFixed(2)}
                </span>
              </div>
              <div className="mb-2 h-1 w-full rounded-full bg-hairline">
                <div
                  className="h-1 rounded-full bg-accent"
                  style={{ width: `${Math.max(0, Math.min(1, r.score)) * 100}%` }}
                />
              </div>
              <p className="line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap text-ink-muted">
                {r.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
