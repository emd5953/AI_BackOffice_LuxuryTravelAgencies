import { db } from "@/db";
import { drafts } from "@/db/schema";

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Two-row Levenshtein DP — no need to keep the full matrix in memory.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

// Levenshtein distance / max(len) over whitespace-normalized strings. 0 = identical.
export function normalizedEditDistance(a: string, b: string): number {
  const na = normalizeWhitespace(a);
  const nb = normalizeWhitespace(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  return levenshtein(na, nb) / maxLen;
}

export interface DraftLifecycleMetrics {
  counts: Record<string, number>;
  acceptanceRate: number | null;
  meanEditDistance: number | null;
  editedSampleSize: number;
}

// Draft outcomes: counts by status, approval-vs-dismissal rate, and how much
// designers edit approved drafts before sending — the core draft-quality signal.
export async function draftLifecycleMetrics(): Promise<DraftLifecycleMetrics> {
  const allDrafts = await db.select().from(drafts);

  const counts: Record<string, number> = {};
  for (const d of allDrafts) {
    counts[d.status] = (counts[d.status] ?? 0) + 1;
  }

  const approved = counts["approved"] ?? 0;
  const dismissed = counts["dismissed"] ?? 0;
  const denominator = approved + dismissed;
  const acceptanceRate = denominator > 0 ? approved / denominator : null;

  const editedApproved = allDrafts.filter(
    (d) => d.status === "approved" && d.sentBody != null,
  );
  const editedSampleSize = editedApproved.length;
  const meanEditDistance =
    editedSampleSize > 0
      ? editedApproved.reduce((sum, d) => sum + normalizedEditDistance(d.body, d.sentBody!), 0) /
        editedSampleSize
      : null;

  return { counts, acceptanceRate, meanEditDistance, editedSampleSize };
}
