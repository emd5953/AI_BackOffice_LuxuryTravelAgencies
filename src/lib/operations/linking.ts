import { matchSource } from "./core";
import { evidenceFacts } from "./evidence";
import type { Source, State } from "./types";

// Recompute inferred links from original anchors, so dismissing evidence removes
// dependent links. A name match is never an anchor. Environments stay separate.
export function connectEvidence(state: State) {
  const anchors = new Map<string, Set<string>>();
  const blocked = new Set<string>();
  const edges = new Map(state.sources.map((s) => [s.id, new Set<string>()]));
  for (const record of state.sources) {
    const ids = new Set<string>();
    if (record.linkReason.startsWith("Operator:") && record.tripId) {
      ids.add(record.tripId);
    } else {
      const direct = matchSource(record, state.trips);
      if (direct.tripId) ids.add(direct.tripId);
      if (
        /disagree|unknown or ambiguous|multiple trips/.test(direct.linkReason)
      )
        blocked.add(record.id);
      record.tripId = direct.tripId;
      record.linkReason = direct.linkReason;
      for (const identifier of record.extraction?.status !== "dismissed"
        ? record.extraction?.identifiers || []
        : []) {
        const match = matchSource(
          { ...record, identifiers: { [identifier.kind]: identifier.value } },
          state.trips,
        );
        if (match.tripId) ids.add(match.tripId);
        if (
          /disagree|unknown or ambiguous|multiple trips/.test(match.linkReason)
        )
          blocked.add(record.id);
      }
    }
    anchors.set(record.id, ids);
  }
  const refs = new Map<string, Source[]>();
  for (const record of state.sources) {
    const parent = state.sources.find(
      (s) => s.id === record.parentId && s.environment === record.environment,
    );
    if (parent) {
      edges.get(record.id)!.add(parent.id);
      edges.get(parent.id)!.add(record.id);
    }
    for (const fact of evidenceFacts(record).filter(
      (f) => f.key === "reservationRef" && (!f.kind || f.kind === "assertion"),
    )) {
      const key = `${record.environment}:${fact.value.trim().toLowerCase()}`;
      refs.set(key, [...(refs.get(key) || []), record]);
    }
  }
  for (const records of refs.values()) {
    const first = records[0];
    for (const record of records.slice(1)) {
      edges.get(first.id)!.add(record.id);
      edges.get(record.id)!.add(first.id);
    }
  }
  const visited = new Set<string>();
  for (const start of state.sources) {
    if (visited.has(start.id)) continue;
    const component: string[] = [];
    const queue = [start.id];
    while (queue.length) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(id);
      queue.push(...edges.get(id)!);
    }
    const matches = new Set(component.flatMap((id) => [...anchors.get(id)!]));
    const ambiguous =
      matches.size > 1 || component.some((id) => blocked.has(id));
    for (const id of component) {
      const record = state.sources.find((s) => s.id === id)!;
      if (record.linkReason.startsWith("Operator:")) continue;
      if (ambiguous) {
        record.tripId = null;
        record.linkReason =
          "Conflicting or ambiguous trip identities; review required";
      } else if (matches.size === 1 && !record.tripId) {
        record.tripId = [...matches][0];
        record.linkReason =
          "Automatic provisional connection: exact quoted identity, attachment, or shared reservation reference";
      }
    }
  }
}
