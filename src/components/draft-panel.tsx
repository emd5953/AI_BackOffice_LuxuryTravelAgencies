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
      <div className="border-t border-hairline p-4">
        <button
          onClick={() => run(() => generateDraft(threadId))}
          disabled={isPending}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white shadow-float transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Drafting…" : "Draft reply"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-hairline p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Agent draft — review before sending
        </span>
      </div>

      {draft.flags.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn-soft p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warn">
            Needs your judgment
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {draft.flags.map((flag, i) => (
              <li key={i} className="text-xs text-warn">
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
        className="w-full rounded-2xl border border-hairline bg-surface-raised p-3 text-sm leading-relaxed text-ink shadow-float focus:ring-2 focus:ring-accent/40 focus:outline-none"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => run(() => approveDraft(draft.id, body))}
          disabled={isPending || body.trim().length === 0}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white shadow-float transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Approve & send"}
        </button>
        <button
          onClick={() => run(() => dismissDraft(draft.id))}
          disabled={isPending}
          className="rounded-full border border-hairline bg-surface-raised px-5 py-2 text-sm text-ink-muted shadow-float hover:text-ink disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
