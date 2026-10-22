import { extractFacts, EXTRACTION_VERSION } from "./ai";
import { connectEvidence } from "./linking";
import { event, fingerprint, hash, prepareBrief } from "./core";
import { mutate, readState } from "./store";
import type { Source, State, Workspace } from "./types";

export function refreshBriefs(state: State) {
  connectEvidence(state);
  for (const trip of state.trips) {
    const records = state.sources.filter((s) => s.tripId === trip.id);
    if (!records.length) continue;
    const latest = state.briefs.find((b) => b.tripId === trip.id);
    if (latest?.fingerprint === fingerprint(trip, records)) continue;
    for (const brief of state.briefs.filter(
      (b) => b.tripId === trip.id && b.status === "proposed",
    )) {
      brief.status = "dismissed";
      brief.reviewNote = "Superseded as source evidence changed";
    }
    state.briefs.unshift(prepareBrief(trip, records));
  }
}

export function safeExtractionError(error: unknown) {
  // Provider response bodies can contain credentials or client text. Never persist them.
  if (
    error instanceof Error &&
    error.message ===
      "Source changed during extraction. Retry on the current evidence."
  )
    return error.message;
  return "Extraction failed or returned invalid evidence. Check model access and retry; original source is preserved.";
}

type Dependencies = {
  read: () => State;
  write: typeof mutate;
  extract: (source: Source) => Promise<NonNullable<Source["extraction"]>>;
};
// Dependencies are injectable for offline contract tests, never via an HTTP request.
export async function analyzeSources(
  sourceIds: string[],
  force = false,
  deps: Dependencies = {
    read: readState,
    write: mutate,
    extract: extractFacts,
  },
): Promise<NonNullable<Workspace["pipeline"]>> {
  const snapshot = deps.read();
  const ids = [...new Set(sourceIds)];
  if (!ids.length || ids.length > 12)
    throw new Error("Analyze between 1 and 12 sources per batch.");
  const records = ids.map((id) => {
    const record = snapshot.sources.find((s) => s.id === id);
    if (!record) throw new Error("Source not found. Refresh the workspace.");
    return record;
  });
  const result: NonNullable<Workspace["pipeline"]> = {
    completed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  const pending = records.filter((s) => {
    if (
      !force &&
      !s.extractionError &&
      (s.extraction?.version === EXTRACTION_VERSION || s.facts.length > 0)
    ) {
      result.skipped++;
      return false;
    }
    return true;
  });
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (index < pending.length) {
        const record = pending[index++];
        // Ignore automatic linking changes by other workers; protect concurrent human edits.
        const revision = (s: Source) =>
          hash([
            s.digest,
            s.facts,
            s.extraction,
            s.linkReason.startsWith("Operator:")
              ? [s.tripId, s.linkReason]
              : null,
          ]);
        try {
          const extraction = await deps.extract(record);
          deps.write((state) => {
            const current = state.sources.find((s) => s.id === record.id);
            if (!current || revision(current) !== revision(record))
              throw new Error(
                "Source changed during extraction. Retry on the current evidence.",
              );
            current.extraction = extraction;
            delete current.extractionError;
            refreshBriefs(state);
            event(
              state,
              "AI extraction completed",
              `${record.title}: ${extraction.facts.length} quoted fields. Provisional trip checks updated automatically.`,
              current.tripId || undefined,
            );
          });
          result.completed++;
        } catch (error) {
          const message = safeExtractionError(error);
          result.failed++;
          result.errors.push({ sourceId: record.id, message });
          deps.write((state) => {
            const current = state.sources.find((s) => s.id === record.id);
            if (current && revision(current) === revision(record))
              current.extractionError = message;
            refreshBriefs(state);
            event(
              state,
              "AI extraction failed",
              `${record.title}: ${message}`,
              current?.tripId || undefined,
            );
          });
        }
      }
    }),
  );
  return result;
}
