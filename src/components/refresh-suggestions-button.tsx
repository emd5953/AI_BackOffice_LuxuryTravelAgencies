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
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white shadow-float transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Thinking…" : "Refresh suggestions"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
