"use client";

import { useState, useTransition } from "react";
import { approveDraft, dismissDraft, generateDraft } from "@/app/inbox/actions";

interface PendingDraft {
  id: number;
  body: string;
  flags: string[];
}

export function DraftPanel({
  threadId,
  draft,
}: {
  threadId: number;
  draft: PendingDraft | null;
}) {
  const [body, setBody] = useState(draft?.body ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  if (!draft) {
    return (
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
        <button
          onClick={() => run(() => generateDraft(threadId))}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-85 disabled:opacity-50"
        >
          {isPending ? "Drafting…" : "Draft reply"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Agent draft — review before sending
        </span>
      </div>

      {draft.flags.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Needs your judgment
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {draft.flags.map((flag, i) => (
              <li key={i} className="text-xs text-amber-800 dark:text-amber-300">
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={14}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-zinc-400"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => run(() => approveDraft(draft.id, body))}
          disabled={isPending || body.trim().length === 0}
          className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Approve & send"}
        </button>
        <button
          onClick={() => run(() => dismissDraft(draft.id))}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
