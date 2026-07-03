"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { resolveSuggestion } from "@/app/inbox/actions";

interface Suggestion {
  id: number;
  clientId: number;
  clientName: string;
  kind: string;
  urgency: number;
  title: string;
  rationale: string;
  evidence: string[];
  sourceRefs: string[];
}

const URGENCY_STYLES: Record<number, { label: string; className: string }> = {
  1: {
    label: "act today",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  2: {
    label: "this week",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  3: {
    label: "keep in mind",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const urgency = URGENCY_STYLES[suggestion.urgency] ?? URGENCY_STYLES[3];

  const resolve = (outcome: "done" | "dismissed") => {
    setError(null);
    startTransition(async () => {
      try {
        await resolveSuggestion(suggestion.id, outcome);
        setResolved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  if (resolved) return null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${urgency.className}`}>
          {urgency.label}
        </span>
        <span className="text-xs rounded-full border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-zinc-500">
          {suggestion.kind}
        </span>
      </div>

      <p className="text-sm font-medium">{suggestion.title}</p>

      <Link
        href={`/clients/${suggestion.clientId}`}
        className="text-xs text-blue-700 dark:text-blue-400 hover:underline"
      >
        {suggestion.clientName}
      </Link>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {suggestion.rationale}
      </p>

      {suggestion.evidence.length > 0 && (
        <ul className="space-y-1">
          {suggestion.evidence.map((e, i) => (
            <li key={i} className="text-xs text-zinc-500 italic">
              &ldquo;{e}&rdquo;
            </li>
          ))}
        </ul>
      )}

      {suggestion.sourceRefs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.sourceRefs.map((ref) => (
            <span
              key={ref}
              className="text-[10px] font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5"
            >
              {ref}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => resolve("done")}
          disabled={isPending}
          className="rounded-lg bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-600 disabled:opacity-50"
        >
          Done
        </button>
        <button
          onClick={() => resolve("dismissed")}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
