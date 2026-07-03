"use client";

import { useState, useTransition } from "react";
import { refreshSuggestions } from "@/app/inbox/actions";

export function RefreshSuggestionsButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        await refreshSuggestions();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div>
      <button
        onClick={run}
        disabled={isPending}
        className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-85 disabled:opacity-50"
      >
        {isPending ? "Thinking…" : "Refresh suggestions"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
