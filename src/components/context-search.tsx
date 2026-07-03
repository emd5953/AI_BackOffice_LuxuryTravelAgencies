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
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-85 disabled:opacity-50"
        >
          {isPending ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && results.length === 0 && !error && (
        <p className="text-sm text-zinc-500">
          No results — has this client been indexed? Run npm run index-context.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((r) => (
            <li
              key={r.chunkId}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {r.sourceType}
                </span>
                <span className="text-xs font-mono text-zinc-500">{r.score.toFixed(2)}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 mb-2">
                <div
                  className="h-1 rounded-full bg-zinc-500"
                  style={{ width: `${Math.max(0, Math.min(1, r.score)) * 100}%` }}
                />
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                {r.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
