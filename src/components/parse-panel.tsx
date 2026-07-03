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
    <div className="flex items-center gap-3 border-t border-hairline p-4">
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
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white shadow-float transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Extracting…" : quoteCount > 0 ? "Re-extract quotes" : "Extract quotes"}
      </button>

      {quoteCount > 0 && tripId && (
        <Link href={`/trips/${tripId}/quotes`} className="text-sm text-accent hover:underline">
          {quoteCount} option{quoteCount === 1 ? "" : "s"} extracted → view comparison
        </Link>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
