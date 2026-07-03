"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { parseQuotes } from "@/app/inbox/actions";
import { AgentProgress } from "@/components/agent-progress";

const STEPS = [
  { at: 0, label: "Reading the supplier email" },
  { at: 0.15, label: "Extracting rates, holds, and caveats" },
  { at: 0.85, label: "Normalizing amounts" },
];

export function ParsePanel({
  threadId,
  tripId,
  quoteCount,
  etaMs,
}: {
  threadId: number;
  tripId: number | null;
  quoteCount: number;
  etaMs: number;
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
      {isPending && <AgentProgress title="Extracting quotes" etaMs={etaMs} steps={STEPS} />}
    </div>
  );
}
