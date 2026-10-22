import type { Fact, Source } from "./types";

// Reviewed values override proposals only for the same field, service and speech act.
export function evidenceFacts(
  record: Source,
): (Fact & { provisional: boolean })[] {
  const sameField = (a: Fact, b: Fact) =>
    a.key === b.key &&
    (a.serviceRef || "") === (b.serviceRef || "") &&
    (a.kind || "assertion") === (b.kind || "assertion");
  const proposed =
    record.extraction?.status === "proposed" ? record.extraction.facts : [];
  return [
    ...record.facts.map((f) => ({ ...f, provisional: false })),
    ...proposed
      .filter((f) => !record.facts.some((r) => sameField(f, r)))
      .map((f) => ({ ...f, provisional: true })),
  ];
}

export function factScope(record: Source, fact: Fact) {
  if (fact.serviceRef) return fact.serviceRef.toLowerCase();
  const refs = [
    ...new Set(
      evidenceFacts(record)
        .filter(
          (f) =>
            f.key === "reservationRef" && (!f.kind || f.kind === "assertion"),
        )
        .map((f) => f.value.toLowerCase()),
    ),
  ];
  return refs.length === 1 ? refs[0] : "unscoped";
}
