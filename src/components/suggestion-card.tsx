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
    className: "bg-danger/15 text-danger",
  },
  2: {
    label: "this week",
    className: "bg-warn-soft text-warn",
  },
  3: {
    label: "keep in mind",
    className: "bg-hairline text-ink-muted",
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
    <div className="card-in space-y-2 rounded-3xl border border-hairline/60 bg-surface-raised p-5 shadow-float">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${urgency.className}`}
        >
          {urgency.label}
        </span>
        <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
          {suggestion.kind}
        </span>
      </div>

      <p className="text-sm font-medium text-ink">{suggestion.title}</p>

      <Link
        href={`/clients/${suggestion.clientId}`}
        className="text-xs text-accent hover:underline"
      >
        {suggestion.clientName}
      </Link>

      <p className="text-sm leading-relaxed text-ink-muted">{suggestion.rationale}</p>

      {suggestion.evidence.length > 0 && (
        <ul className="space-y-1">
          {suggestion.evidence.map((e, i) => (
            <li
              key={i}
              className="border-l-2 border-hairline pl-2 text-xs leading-relaxed text-ink-muted italic"
            >
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
              className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
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
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white shadow-float transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
        >
          Done
        </button>
        <button
          onClick={() => resolve("dismissed")}
          disabled={isPending}
          className="rounded-full border border-hairline bg-surface-raised px-4 py-1.5 text-xs text-ink-muted shadow-float hover:text-ink disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
