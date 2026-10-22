import { createHash, randomUUID } from "node:crypto";
import { evidenceFacts, factScope } from "./evidence";
import {
  FACT_LABELS,
  type FactKey,
  type Source,
  type State,
  type Trip,
  type Issue,
  type Brief,
} from "./types";

export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const emptyState = (): State => ({
  version: 1,
  trips: [],
  sources: [],
  briefs: [],
  activity: [],
});
export const normalizedPhone = (value: string) => value.replace(/[^\d+]/g, "");

export function source(
  input: Omit<
    Source,
    "id" | "digest" | "tripId" | "linkReason" | "retrievedAt"
  >,
): Source {
  const id = hash([input.provider, input.environment, input.externalId]).slice(
    0,
    24,
  );
  return {
    ...input,
    id,
    digest: hash(input),
    retrievedAt: new Date().toISOString(),
    tripId: null,
    linkReason: "Awaiting a matching trip",
  };
}

// Never match on a person's name. Multiple or contradictory identities require review.
export function matchSource(
  record: Source,
  trips: Trip[],
): Pick<Source, "tripId" | "linkReason"> {
  const candidates = trips.filter((t) => t.environment === record.environment);
  const { tripRef, email, phone } = record.identifiers;
  const exact = tripRef
    ? candidates.filter(
        (t) => t.reference.toLowerCase() === tripRef.toLowerCase(),
      )
    : [];
  if (tripRef && exact.length !== 1)
    return {
      tripId: null,
      linkReason: "Trip reference is unknown or ambiguous",
    };
  const contacts = candidates.filter(
    (t) =>
      (email && t.email?.toLowerCase() === email.toLowerCase()) ||
      (phone && t.phone && normalizedPhone(t.phone) === normalizedPhone(phone)),
  );
  if (exact.length === 1) {
    const emailMatches = candidates.filter(
      (t) => email && t.email?.toLowerCase() === email.toLowerCase(),
    );
    const phoneMatches = candidates.filter(
      (t) =>
        phone && t.phone && normalizedPhone(t.phone) === normalizedPhone(phone),
    );
    if (
      [emailMatches, phoneMatches].some(
        (matches) =>
          matches.length && !matches.some((t) => t.id === exact[0].id),
      )
    )
      return {
        tripId: null,
        linkReason: "Trip reference and contact identity disagree",
      };
    return {
      tripId: exact[0].id,
      linkReason: `Exact trip reference: ${tripRef}`,
    };
  }
  if (contacts.length === 1)
    return {
      tripId: contacts[0].id,
      linkReason: "Unique exact contact match; review source before approval",
    };
  return {
    tripId: null,
    linkReason: contacts.length
      ? "Contact belongs to multiple trips; choose a trip"
      : "No exact reference or contact match",
  };
}

export function event(
  state: State,
  kind: string,
  detail: string,
  tripId?: string,
) {
  state.activity.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    kind,
    detail,
    tripId,
  });
}

export function ingest(state: State, records: Source[], trips: Trip[] = []) {
  let added = 0,
    updated = 0,
    unchanged = 0;
  for (const trip of trips) {
    const previous = state.trips.find((t) => t.id === trip.id);
    if (previous) Object.assign(previous, trip);
    else state.trips.push(trip);
  }
  for (const record of records) {
    const i = state.sources.findIndex((s) => s.id === record.id);
    const previous = state.sources[i];
    if (previous?.digest === record.digest) {
      unchanged++;
      continue;
    }
    Object.assign(record, matchSource(record, state.trips));
    // A changed source must be matched afresh; old manual links are not silently trusted.
    if (i < 0) {
      state.sources.push(record);
      added++;
    } else {
      state.sources[i] = record;
      updated++;
    }
  }
  // Newly created trips can resolve old unassigned sources.
  for (const record of state.sources.filter((s) => !s.tripId))
    Object.assign(record, matchSource(record, state.trips));
  if (state.sources.length > 5000)
    throw new Error(
      "Pilot capacity reached (5,000 sources). Archive this workspace before importing more.",
    );
  event(
    state,
    "Import completed",
    `${added} new · ${updated} changed · ${unchanged} unchanged. No external records modified.`,
  );
  return { added, updated, unchanged };
}

export function fingerprint(trip: Trip, records: Source[]) {
  return hash([
    trip,
    records
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((s) => [
        s.id,
        s.digest,
        s.linkReason,
        s.facts,
        s.extraction,
        s.extractionError,
      ]),
  ]);
}

export function reconcile(
  trip: Trip,
  records: Source[],
  now = new Date(),
): Issue[] {
  const issues: Issue[] = [];
  const required: FactKey[] = [
    "checkIn",
    "checkOut",
    "partySize",
    "reservationRef",
    "reservationStatus",
    "arrivalFlight",
    "transferStatus",
    "paymentStatus",
  ];
  for (const key of required) {
    const evidence = records.flatMap((s) =>
      evidenceFacts(s)
        .filter((f) => f.key === key && (!f.kind || f.kind === "assertion"))
        .map((f) => ({
          ...f,
          sourceId: s.id,
          service: factScope(s, f),
        })),
    );
    const values = [
      ...new Set(evidence.map((f) => f.value.trim().toLowerCase())),
    ];
    if (!values.length)
      issues.push({
        id: `missing:${key}`,
        severity: "review",
        title: `${FACT_LABELS[key]} missing`,
        detail:
          "No supported value in the linked evidence. Requests and explicitly unknown details do not fill this field. Ask the advisor or supplier.",
        sourceIds: [],
      });
    // Different hotel stays or experiences can legitimately have different dates / occupancy.
    const perService = [
      "checkIn",
      "checkOut",
      "partySize",
      "reservationStatus",
      "paymentStatus",
    ].includes(key);
    const groups = perService
      ? [...new Set(evidence.map((f) => f.service))]
      : ["trip"];
    if (key !== "reservationRef")
      for (const group of groups) {
        const scoped = perService
          ? evidence.filter((f) => f.service === group)
          : evidence;
        if (new Set(scoped.map((f) => f.value.trim().toLowerCase())).size > 1)
          issues.push({
            id: `conflict:${key}:${group}`,
            severity: "blocker",
            title: `${FACT_LABELS[key]} conflict${perService ? ` · ${group}` : ""}`,
            detail:
              scoped.map((f) => f.value).join(" / ") +
              ". Resolve with the source owner; the latest message does not automatically override a reservation. Unscoped records may describe different services.",
            sourceIds: [...new Set(scoped.map((f) => f.sourceId))],
          });
      }
    if (
      key === "reservationStatus" &&
      evidence.some(
        (f) =>
          !["confirmed", "started", "processed"].includes(
            f.value.toLowerCase(),
          ),
      )
    )
      issues.push({
        id: "reservation-review",
        severity: "blocker",
        title: "Reservation is not confirmed in all sources",
        detail:
          "An inquiry, hold, cancellation, or unknown status must not be described as a confirmed booking.",
        sourceIds: evidence.map((f) => f.sourceId),
      });
    if (
      (key === "transferStatus" || key === "paymentStatus") &&
      evidence.some((f) =>
        /pending|unknown|unpaid|requested|not confirmed/i.test(f.value),
      )
    )
      issues.push({
        id: `pending:${key}`,
        severity: "review",
        title: `${FACT_LABELS[key]} needs follow-up`,
        detail:
          "Recorded as unresolved. Obtain explicit confirmation before telling the traveler this is complete.",
        sourceIds: evidence.map((f) => f.sourceId),
      });
  }
  for (const record of records) {
    const facts = evidenceFacts(record);
    for (const [index, fact] of facts.entries()) {
      if (
        fact.kind === "unknown" &&
        !required.includes(fact.key) &&
        !records.some((s) =>
          evidenceFacts(s).some(
            (f) =>
              f.key === fact.key &&
              (!f.kind || f.kind === "assertion") &&
              factScope(s, f) === factScope(record, fact),
          ),
        )
      )
        issues.push({
          id: `missing:${fact.key}:${record.id}`,
          severity: "review",
          title: `${FACT_LABELS[fact.key]} missing`,
          detail:
            "The source explicitly asks for this detail or says it is unknown.",
          sourceIds: [record.id],
        });
      if (fact.kind === "request")
        issues.push({
          id: `request:${record.id}:${index}`,
          severity: "review",
          title: `${FACT_LABELS[fact.key]} requested · awaiting confirmation`,
          detail: `${fact.value}. A request does not update the confirmed arrangement.`,
          sourceIds: [record.id],
        });
    }
    if (record.extractionError)
      issues.push({
        id: `extraction-error:${record.id}`,
        severity: "review",
        title: "Extraction failed · retry needed",
        detail: record.extractionError,
        sourceIds: [record.id],
      });
    if (!facts.length && record.provider !== "travefy")
      issues.push({
        id: `unstructured:${record.id}`,
        severity: "review",
        title: "Unstructured source needs interpretation",
        detail:
          "Extract proposed details with AI, or record a reviewed fact with an exact excerpt. The message remains evidence even when no structured facts are available.",
        sourceIds: [record.id],
      });
    if (record.extraction?.status === "proposed")
      issues.push({
        id: `extraction:${record.id}`,
        severity: "review",
        title: "AI extraction awaiting review",
        detail:
          "These quoted fields already inform provisional trip checks. They remain unreviewed; inspect the sources before using the handoff.",
        sourceIds: [record.id],
      });
    const relevantWarnings = record.warnings.filter(
      (w) => !w.startsWith("Synthetic test fixture"),
    );
    if (relevantWarnings.length)
      issues.push({
        id: `source:${record.id}`,
        severity: "review",
        title: `Review ${record.title}`,
        detail: relevantWarnings.join(" "),
        sourceIds: [record.id],
      });
    const age = record.occurredAt
      ? now.getTime() - new Date(record.occurredAt).getTime()
      : NaN;
    if (
      record.environment !== "synthetic" &&
      (!Number.isFinite(age) || age > 7 * 86400000 || age < -300000)
    )
      issues.push({
        id: `age:${record.id}`,
        severity: "review",
        title: "Source freshness needs review",
        detail:
          "Source is more than 7 days old, future-dated, or has no verified timestamp. Reconfirm time-sensitive information.",
        sourceIds: [record.id],
      });
  }
  // One complete reservation must not hide missing fields on another service.
  const scopedFacts = records.flatMap((s) =>
    evidenceFacts(s)
      .filter((f) => !f.kind || f.kind === "assertion")
      .map((f) => ({ ...f, scope: factScope(s, f), sourceId: s.id })),
  );
  for (const scope of new Set(
    scopedFacts.filter((f) => f.key === "reservationRef").map((f) => f.scope),
  )) {
    if (scope === "unscoped") continue;
    const service = scopedFacts.filter((f) => f.scope === scope);
    const hotel = service.some(
      (f) => f.key === "checkIn" || f.key === "checkOut",
    );
    const keys: FactKey[] = hotel
      ? [
          "checkIn",
          "checkOut",
          "partySize",
          "reservationStatus",
          "paymentStatus",
        ]
      : ["reservationStatus", "paymentStatus"];
    for (const key of keys)
      if (
        !service.some((f) => f.key === key) &&
        !issues.some((i) => i.id === `missing:${key}`)
      )
        issues.push({
          id: `missing:${key}:${scope}`,
          severity: "review",
          title: `${FACT_LABELS[key]} missing · ${scope}`,
          detail:
            "Details from a different reservation do not complete this service.",
          sourceIds: [...new Set(service.map((f) => f.sourceId))],
        });
  }
  if (trip.environment !== "live")
    issues.push({
      id: "non-live",
      severity: "review",
      title: `${trip.environment === "synthetic" ? "Synthetic fixture" : "Sandbox"} trip`,
      detail:
        "These records cannot establish a real booking, price, or traveler commitment.",
      sourceIds: records.map((s) => s.id),
    });
  return issues;
}

export function prepareBrief(trip: Trip, records: Source[]): Brief {
  if (!records.length)
    throw new Error("Link evidence before preparing a handoff.");
  const issues = reconcile(trip, records);
  const paragraphs = records.map((s) => ({
    text: `${s.title}: ${
      evidenceFacts(s).length
        ? evidenceFacts(s)
            .map(
              (f) =>
                `${FACT_LABELS[f.key]}${f.serviceRef ? ` (${f.serviceRef})` : ""}: ${f.value} [${f.provisional ? "AI proposal; " : "recorded; "}${f.kind || "assertion"}]`,
            )
            .join("; ")
        : "Unstructured message — inspect the original source."
    }`,
    sourceIds: [s.id],
  }));
  const operationalIssues = issues.filter((i) =>
    /^(missing:|conflict:|pending:|request:|reservation-review)/.test(i.id),
  );
  const draft = [
    `Internal handoff — ${trip.title}`,
    `Trip reference: ${trip.reference} · ${trip.environment.toUpperCase()}`,
    "",
    "Proposed supplier / advisor follow-up (not sent):",
    ...operationalIssues.map((i) => `• Please verify: ${i.title}. ${i.detail}`),
    "",
    "Advisor review: read remaining unstructured messages and attachments, including requests that may not yet be reflected in the reservation.",
    "Do not represent any unresolved item as confirmed. No message has been sent and no reservation has been changed.",
  ].join("\n");
  return {
    id: randomUUID(),
    tripId: trip.id,
    createdAt: new Date().toISOString(),
    engine: records.some((s) => s.extraction?.status === "proposed")
      ? "Evidence summary with unreviewed AI proposals"
      : "Deterministic evidence summary · no AI call",
    status: "proposed",
    fingerprint: fingerprint(trip, records),
    paragraphs,
    draft,
    issues,
    evidence: structuredClone(records),
  };
}

export function reviewBrief(
  state: State,
  id: string,
  decision: "approved" | "dismissed",
  note: string,
  draft: string,
) {
  const brief = state.briefs.find((b) => b.id === id);
  if (!brief || brief.status !== "proposed")
    throw new Error(
      "This proposal has already been reviewed. Refresh the workspace.",
    );
  const trip = state.trips.find((t) => t.id === brief.tripId)!;
  if (
    brief.fingerprint !==
    fingerprint(
      trip,
      state.sources.filter((s) => s.tripId === trip.id),
    )
  )
    throw new Error(
      "Evidence changed. Prepare a new handoff before reviewing.",
    );
  if (decision === "approved" && !note.trim())
    throw new Error("Add a review note acknowledging the open issues.");
  brief.status = decision;
  brief.reviewedAt = new Date().toISOString();
  brief.reviewNote = note;
  brief.draft = draft;
  event(
    state,
    `Handoff ${decision}`,
    "Operator reviewed internal handoff. Delivery not attempted; bookings unchanged.",
    trip.id,
  );
}
