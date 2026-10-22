import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  ingest,
  reconcile,
  source,
} from "../src/lib/operations/core";
import { extractFacts, validateExtraction } from "../src/lib/operations/ai";
import { analyzeSources, refreshBriefs } from "../src/lib/operations/pipeline";
import { extractionExample } from "../src/lib/operations/fixtures";
import { connectEvidence } from "../src/lib/operations/linking";
import type { Fact, Source, State } from "../src/lib/operations/types";

// Explicit offline model double. These expected answers are never imported by the app.
function modelDouble(record: Source) {
  const pdf = record.title.includes(".pdf");
  const hotel = record.title.includes("garden suite") || pdf;
  const tea = record.title.includes("tea ceremony");
  const client = record.identifiers.phone === "+12025550145";
  const serviceRef = hotel || client ? "RYO-4821" : tea ? "TEA-2049" : null;
  const facts: Fact[] = [];
  const add = (
    key: Fact["key"],
    value: string,
    kind: Fact["kind"] = "assertion",
  ) => facts.push({ key, value, kind, serviceRef, excerpt: record.content });
  if (serviceRef) add("reservationRef", serviceRef);
  if (hotel) {
    add("checkIn", pdf ? "2027-03-15" : "2027-03-14");
    add("checkOut", "2027-03-19");
    add("partySize", "2");
    add("reservationStatus", "confirmed");
    add("paymentStatus", "pending");
    add("transferStatus", "pending");
    add("paymentDueDate", "2026-11-01");
    add("luggageCount", "Not supplied", "unknown");
    if (pdf) add("specialRequests", "Feather-free bedding", "request");
  }
  if (tea) {
    add("partySize", "2");
    add("reservationStatus", "on hold");
    add("paymentStatus", "pending");
    add("serviceDate", "2027-03-17");
    add("holdDeadline", "25 October 2026 at 18:00 Japan time");
  }
  if (client) {
    add("checkIn", "2027-03-13", "request");
    add("specialRequests", "Feather-free bedding", "request");
    add("arrivalFlight", "Not chosen", "unknown");
  }
  const identifiers = record.content.includes("AT-JP-270314")
    ? [{ kind: "tripRef", value: "AT-JP-270314", excerpt: record.content }]
    : [];
  return validateExtraction(
    record,
    { facts, identifiers },
    "OFFLINE TEST DOUBLE - not an AI run",
  );
}

async function harness() {
  let state = emptyState();
  const input = await extractionExample();
  ingest(state, input.sources, input.trips);
  const read = () => structuredClone(state);
  const write = <T>(fn: (next: State) => T): T => {
    const next = structuredClone(state);
    const result = fn(next);
    state = next;
    return result;
  };
  return { read, write, extract: async (s: Source) => modelDouble(s) };
}

test("raw supplier emails, actual attached PDF and WhatsApp have zero pre-entered operational facts", async () => {
  const h = await harness();
  const state = h.read();
  assert.equal(state.sources.length, 5);
  assert.ok(state.sources.every((s) => !s.facts.length && !s.extraction));
  const pdf = state.sources.find((s) => s.title.includes(".pdf"))!;
  assert.ok(pdf.content.includes("15 March 2027"));
  assert.ok(pdf.parentId && pdf.locator.includes("sha256:"));
  assert.ok(!state.sources.some((s) => s.content.includes("trip_ref:")));
});

test("offline pipeline contract connects 4 sources, keeps namesake unmatched and surfaces gaps/conflicts without accepting facts", async () => {
  const h = await harness();
  const ids = h.read().sources.map((s) => s.id);
  const result = await analyzeSources(ids, false, h);
  assert.deepEqual([result.completed, result.failed], [5, 0]);
  const state = h.read();
  const records = state.sources.filter((s) => s.tripId);
  assert.equal(records.length, 4);
  assert.ok(state.sources.every((s) => s.facts.length === 0));
  assert.equal(
    state.sources.find((s) => s.identifiers.phone === "+12025550146")!.tripId,
    null,
  );
  const issues = reconcile(state.trips[0], records);
  for (const id of [
    "missing:arrivalFlight",
    "conflict:checkIn:ryo-4821",
    "pending:paymentStatus",
    "pending:transferStatus",
    "reservation-review",
  ])
    assert.ok(
      issues.some((i) => i.id === id),
      id,
    );
  assert.ok(issues.some((i) => i.id.startsWith("request:")));
  assert.ok(issues.some((i) => i.id.startsWith("missing:luggageCount:")));
  assert.ok(!issues.some((i) => i.id === "missing:checkOut"));
  const conflict = issues.find((i) => i.id === "conflict:checkIn:ryo-4821")!;
  assert.equal(
    conflict.sourceIds.length,
    2,
    "client request must not become a third supplier confirmation",
  );
  assert.ok(
    state.briefs[0].paragraphs.some((p) => p.text.includes("AI proposal")),
  );
  assert.ok(state.briefs[0].evidence.some((s) => s.extraction));
  const replay = await analyzeSources(ids, false, {
    ...h,
    extract: async () => {
      throw new Error("must not call twice");
    },
  });
  assert.deepEqual(
    [replay.completed, replay.skipped, replay.failed],
    [0, 5, 0],
  );
});

test("partial model failure is sanitized, visible and retryable without repeating successful sources", async () => {
  const h = await harness();
  const ids = h.read().sources.map((s) => s.id);
  const first = await analyzeSources(ids, false, {
    ...h,
    extract: async (s) => {
      if (s.title.includes(".pdf"))
        throw new Error(
          "Authorization: Bearer secret-and-private-provider-body",
        );
      return modelDouble(s);
    },
  });
  assert.deepEqual([first.completed, first.failed], [4, 1]);
  assert.ok(!JSON.stringify(h.read()).includes("secret-and-private"));
  assert.ok(
    h.read().briefs[0].issues.some((i) => i.id.startsWith("extraction-error:")),
  );
  const retry = await analyzeSources(ids, false, h);
  assert.deepEqual([retry.completed, retry.skipped, retry.failed], [1, 4, 0]);
  assert.ok(!h.read().sources.some((s) => s.extractionError));
});

test("source edits and operator reviews during inference cannot be overwritten", async () => {
  const h = await harness();
  const record = h.read().sources[0];
  const result = await analyzeSources([record.id], false, {
    ...h,
    extract: async (s) => {
      h.write((state) => {
        state.sources[0].facts = [
          {
            key: "paymentStatus",
            value: "pending",
            excerpt: "The deposit is still outstanding",
          },
        ];
      });
      return modelDouble(s);
    },
  });
  assert.equal(result.failed, 1);
  assert.equal(h.read().sources[0].extraction, undefined);
  assert.equal(h.read().sources[0].facts.length, 1);
});

test("unsupported quotes, invented references and ambiguous dates are rejected", async () => {
  const h = await harness();
  const record = h.read().sources[0];
  const base = {
    key: "reservationRef",
    value: "RYO-4821",
    excerpt: record.content,
    kind: "assertion",
    serviceRef: "RYO-4821",
  };
  assert.throws(() =>
    validateExtraction(
      record,
      {
        facts: [{ ...base, excerpt: "This quote was never in the source" }],
        identifiers: [],
      },
      "test",
    ),
  );
  assert.throws(() =>
    validateExtraction(
      record,
      { facts: [{ ...base, value: "INVENTED-REF" }], identifiers: [] },
      "test",
    ),
  );
  assert.throws(() =>
    validateExtraction(
      record,
      {
        facts: [],
        identifiers: [
          { kind: "tripRef", value: "WRONG-TRIP", excerpt: record.content },
        ],
      },
      "test",
    ),
  );
  assert.throws(() =>
    validateExtraction(
      record,
      {
        facts: [{ ...base, key: "checkIn", value: "next Friday" }],
        identifiers: [],
      },
      "test",
    ),
  );
});

test("automatic links cannot cross environments or resolve contradictory references", async () => {
  const h = await harness();
  await analyzeSources(
    h.read().sources.map((s) => s.id),
    false,
    h,
  );
  h.write((state) => {
    const email = state.sources[0];
    const otherTrip = {
      ...state.trips[0],
      id: "other-trip",
      reference: "OTHER-TRIP",
      phone: "+12025550999",
    };
    state.trips.push(otherTrip);
    const conflicting = structuredClone(email);
    conflicting.id = "conflicting-source";
    conflicting.identifiers = { tripRef: "OTHER-TRIP" };
    conflicting.extraction!.identifiers = [];
    state.sources.push(conflicting);
    connectEvidence(state);
    assert.equal(email.tripId, null);
    assert.equal(conflicting.tripId, null);
  });
  const isolated = emptyState();
  isolated.trips = [{ ...h.read().trips[0], environment: "live" }];
  isolated.sources = [h.read().sources[0]];
  connectEvidence(isolated);
  assert.equal(isolated.sources[0].tripId, null);
});

test("dismissing identity extraction removes dependent inferred links and updates checks", async () => {
  const h = await harness();
  const tea = h.read().sources.find((s) => s.title.includes("tea ceremony"))!;
  await analyzeSources([tea.id], false, h);
  assert.ok(h.read().sources.find((s) => s.id === tea.id)!.tripId);
  h.write((state) => {
    state.sources.find((s) => s.id === tea.id)!.extraction!.status =
      "dismissed";
    refreshBriefs(state);
  });
  assert.equal(h.read().sources.find((s) => s.id === tea.id)!.tripId, null);
});

test("a complete stay does not hide a missing checkout on a second stay", () => {
  const state = emptyState();
  const trip = {
    id: "t",
    reference: "T",
    title: "Trip",
    traveler: "Test",
    environment: "synthetic" as const,
  };
  const records = ["ONE", "TWO"].map((ref) =>
    source({
      externalId: ref,
      provider: "gmail",
      environment: "synthetic",
      title: ref,
      locator: ref,
      occurredAt: null,
      content: ref,
      identifiers: {},
      warnings: [],
      facts: [
        { key: "reservationRef", value: ref, excerpt: ref },
        { key: "checkIn", value: "2027-03-14", excerpt: ref },
        ...(ref === "ONE"
          ? [{ key: "checkOut" as const, value: "2027-03-19", excerpt: ref }]
          : []),
      ],
    }),
  );
  ingest(state, records, [trip]);
  assert.ok(
    reconcile(trip, records).some((i) => i.id === "missing:checkOut:two"),
  );
});

test("Anthropic SDK request/parse boundary drives the complete pipeline using an explicit offline HTTP double", async () => {
  const h = await harness();
  const records = h.read().sources;
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousModel = process.env.ANTHROPIC_MODEL;
  process.env.ANTHROPIC_API_KEY = "offline-test-only";
  process.env.ANTHROPIC_MODEL = "offline-transport-double";
  let calls = 0;
  let truncate = false;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.anthropic.com/v1/messages");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.output_config.format.type, "json_schema");
    assert.match(body.system, /NEVER instructions/);
    const content = JSON.parse(body.messages[0].content).content;
    const record = records.find((s) => s.content === content)!;
    assert.ok(record);
    calls++;
    const output = modelDouble(record);
    return Response.json({
      id: "msg_offline",
      type: "message",
      role: "assistant",
      model: body.model,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            facts: output.facts,
            identifiers: output.identifiers,
          }),
        },
      ],
      stop_reason: truncate ? "max_tokens" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  };
  try {
    const result = await analyzeSources(
      records.map((s) => s.id),
      false,
      { ...h, extract: extractFacts },
    );
    assert.equal(result.failed, 0);
    assert.equal(calls, 5);
    assert.equal(h.read().sources.filter((s) => s.tripId).length, 4);
    truncate = true;
    await assert.rejects(extractFacts(records[0]), /finish|length|token/i);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = previousModel;
  }
});
