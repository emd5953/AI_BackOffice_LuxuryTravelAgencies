"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { parseQuotes } from "@/app/inbox/actions";

export function ParsePanel({
  threadId,
  tripId,
  quoteCount,
}: {
  threadId: number;
  tripId: number | null;
  quoteCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3">
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await parseQuotes(threadId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong");
            }
          });
        }}
        disabled={isPending || !tripId}
        className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-85 disabled:opacity-50"
      >
        {isPending ? "Extracting…" : quoteCount > 0 ? "Re-extract quotes" : "Extract quotes"}
      </button>

      {quoteCount > 0 && tripId && (
        <Link
          href={`/trips/${tripId}/quotes`}
          className="text-sm text-blue-700 dark:text-blue-400 hover:underline"
        >
          {quoteCount} option{quoteCount === 1 ? "" : "s"} extracted → view comparison
        </Link>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
