import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyState,
  fingerprint,
  ingest,
  matchSource,
  prepareBrief,
  reconcile,
  reviewBrief,
} from "../src/lib/operations/core";
import {
  importCsv,
  SAMPLE_CSV,
  syntheticExample,
} from "../src/lib/operations/imports";
import {
  normalizeGmail,
  normalizeMews,
  normalizeWhatsApp,
  verifyTwilio,
  fetchJson,
} from "../src/lib/operations/connectors";
import {
  importEml,
  attachmentSources,
} from "../src/lib/operations/attachments";
import { validateFacts } from "../src/lib/operations/ai";
import { accessError, mutationError } from "../src/lib/operations/auth";
import { mutate, readState } from "../src/lib/operations/store";
import type { Fact, Trip } from "../src/lib/operations/types";

function fixture() {
  const state = emptyState();
  const input = syntheticExample();
  ingest(state, input.sources, input.trips);
  return state;
}
const arrivalFacts: Fact[] = [
  { key: "checkIn", value: "2027-03-14", excerpt: "arriving 14 March 2027" },
  {
    key: "reservationRef",
    value: "SYN-RYOKAN-84",
    excerpt: "Your confirmation is SYN-RYOKAN-84.",
  },
];
test("synthetic sources never masquerade as actual connector or AI results", () => {
  const state = fixture();
  assert.equal(state.trips.length, 1);
  assert.equal(state.sources.length, 5);
  assert.ok(state.sources.every((s) => s.environment === "synthetic"));
  assert.equal(state.sources.filter((s) => !s.tripId).length, 1);
  assert.equal(
    state.sources.find((s) => s.externalId === "synthetic-email-1")!.facts
      .length,
    0,
  );
  assert.ok(state.sources.every((s) => !s.extraction));
});
test("matching requires exact evidence and never crosses environments", () => {
  const state = fixture();
  const base = state.sources[1];
  const trip = state.trips[0];
  assert.equal(
    matchSource({ ...base, environment: "live" }, state.trips).tripId,
    null,
  );
  const second: Trip = { ...trip, id: "second", reference: "SECOND" };
  assert.equal(
    matchSource({ ...base, identifiers: { email: trip.email } }, [trip, second])
      .tripId,
    null,
  );
  assert.equal(
    matchSource(
      { ...base, identifiers: { tripRef: trip.reference, email: trip.email } },
      [trip, second],
    ).tripId,
    trip.id,
  );
  assert.equal(
    matchSource(
      { ...base, identifiers: { tripRef: "UNKNOWN", email: trip.email } },
      [trip],
    ).tripId,
    null,
  );
  assert.equal(
    matchSource(
      {
        ...base,
        identifiers: { tripRef: trip.reference, email: "someone@example.com" },
      },
      [trip, { ...second, email: "someone@example.com" }],
    ).tripId,
    null,
  );
});
test("CSV parser handles quoted commas / newlines, rejects bad dates, headers and mixed identities atomically", () => {
  const csv =
    'trip_ref,title,traveler,check_in,check_out,special_requests\r\nA,"Kyoto, Japan",Test,2027-03-14,2027-03-19,"Quiet room\nNo feathers"\r\n';
  const result = importCsv(csv, "export.csv", "live");
  assert.equal(result.trips[0].title, "Kyoto, Japan");
  assert.equal(result.sources[0].locator, "export.csv / row 2");
  assert.throws(() =>
    importCsv(
      SAMPLE_CSV.replace("2027-03-15", "2027-02-30"),
      "bad.csv",
      "live",
    ),
  );
  assert.throws(
    () =>
      importCsv("trip_ref,trip_ref,title,traveler\nA,B,C,D", "bad.csv", "live"),
    /duplicate/,
  );
  assert.throws(
    () =>
      importCsv(
        "trip_ref,title,traveler\nA,Trip,One\nA,Trip,Two",
        "bad.csv",
        "live",
      ),
    /conflicting/,
  );
});
test("idempotent replay retains reviewed fields and does not duplicate sources", () => {
  const state = fixture();
  const record = state.sources[1];
  record.facts = arrivalFacts;
  const { sources, trips } = syntheticExample();
  const result = ingest(state, sources, trips);
  assert.equal(result.unchanged, 5);
  assert.equal(state.sources.length, 5);
  assert.deepEqual(state.sources[1].facts, arrivalFacts);
});
test("reviewed date conflict cites both sources; different reservations are not merged", () => {
  const state = fixture();
  state.sources[1].facts = arrivalFacts;
  const records = state.sources.filter((s) => s.tripId);
  const issues = reconcile(
    state.trips[0],
    records,
    new Date("2026-10-22T16:00:00Z"),
  );
  const conflict = issues.find((i) => i.id.startsWith("conflict:checkIn"))!;
  assert.equal(conflict.sourceIds.length, 2);
  assert.ok(issues.some((i) => i.id === "missing:arrivalFlight"));
  state.sources[1].facts = arrivalFacts.map((f) =>
    f.key === "reservationRef" ? { ...f, value: "DIFFERENT-STAY" } : f,
  );
  assert.ok(
    !reconcile(state.trips[0], records).some((i) =>
      i.id.startsWith("conflict:checkIn"),
    ),
  );
});
test("exact source excerpts and explicit dates are required for reviewed facts", () => {
  const record = fixture().sources[1];
  assert.equal(validateFacts(record, arrivalFacts).length, 2);
  assert.throws(
    () =>
      validateFacts(record, [
        { ...arrivalFacts[0], excerpt: "Invented confirmation" },
      ]),
    /exact excerpt/,
  );
  assert.throws(
    () => validateFacts(record, [{ ...arrivalFacts[0], value: "next Friday" }]),
    /YYYY-MM-DD/,
  );
});
test("approval is internal only, snapshots evidence, rejects double review and stale evidence", () => {
  const state = fixture();
  const trip = state.trips[0];
  const records = state.sources.filter((s) => s.tripId === trip.id);
  const brief = prepareBrief(trip, records);
  state.briefs.push(brief);
  assert.match(brief.draft, /not sent/);
  assert.equal(brief.status, "proposed");
  reviewBrief(
    state,
    brief.id,
    "approved",
    "Open issues acknowledged; advisor will follow up.",
    brief.draft,
  );
  assert.equal(brief.status, "approved");
  assert.throws(
    () => reviewBrief(state, brief.id, "approved", "retry", brief.draft),
    /already/,
  );
  const before = brief.fingerprint;
  records[0].facts.push({
    key: "arrivalFlight",
    value: "JL001",
    excerpt: "test",
  });
  assert.notEqual(before, fingerprint(trip, records));
  assert.ok(!brief.evidence[0].facts.some((f) => f.key === "arrivalFlight"));
  const second = prepareBrief(trip, records);
  state.briefs.push(second);
  records[0].digest = "changed";
  assert.throws(
    () => reviewBrief(state, second.id, "approved", "review", second.draft),
    /Evidence changed/,
  );
});
test("Gmail preserves plain MIME text, timestamps, attachment references and email identity", () => {
  const payload = {
    id: "abc123",
    threadId: "thread1",
    internalDate: "1792677600000",
    payload: {
      headers: [
        { name: "From", value: "Alex <alex@example.invalid>" },
        { name: "Subject", value: "Our arrival" },
      ],
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: Buffer.from("Could we arrive a day earlier?").toString(
              "base64url",
            ),
          },
        },
        {
          partId: "2",
          filename: "confirmation.pdf",
          mimeType: "application/pdf",
          body: { attachmentId: "att1", size: 400 },
        },
      ],
    },
  };
  const parsed = normalizeGmail(payload, "advisor@example.invalid");
  assert.match(parsed.record.content, /arrive a day earlier/);
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.record.identifiers.email, "alex@example.invalid");
  assert.equal(parsed.record.facts.length, 0);
});
test("EML import decodes attachment content and keeps original message provenance", async () => {
  const raw =
    'From: Supplier <supplier@example.invalid>\r\nTo: Advisor <advisor@example.invalid>\r\nSubject: Reed arrival\r\nMessage-ID: <synthetic-1@example.invalid>\r\nDate: Thu, 22 Oct 2026 14:00:00 +0000\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="example"\r\n\r\n--example\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nDear Maya, the transfer is still pending.\r\n--example\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="arrival.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
    Buffer.from("Please send the arrival flight.").toString("base64") +
    "\r\n--example--";
  const parsed = await importEml(raw, "synthetic.eml", "synthetic");
  assert.equal(parsed.sources.length, 2);
  assert.match(parsed.sources[1].content, /arrival flight/);
  assert.match(parsed.sources[0].locator, /synthetic-1/);
  assert.equal(parsed.sources[1].facts.length, 0);
});
test("invalid and unsupported PDF attachments remain visible review blockers", async () => {
  const parent = fixture().sources[1];
  const records = await attachmentSources(
    Buffer.from("not a PDF"),
    "bad.pdf",
    "application/pdf",
    parent,
    "att",
  );
  assert.equal(records.length, 1);
  assert.match(records[0].warnings[0], /Manual/);
  assert.equal(records[0].facts.length, 0);
});

test("text-bearing PDF attachment extracts a page with its original reference", async () => {
  // Minimal generated PDF: explicitly synthetic, no external document or client data.
  const content =
    "BT /F1 12 Tf 50 700 Td (Synthetic supplier voucher: arrival 14 March 2027) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const records = await attachmentSources(
    Buffer.from(pdf),
    "synthetic-voucher.pdf",
    "application/pdf",
    fixture().sources[1],
    "synthetic-pdf",
  );
  assert.equal(records.length, 1);
  assert.match(records[0].content, /arrival 14 March 2027/);
  assert.match(records[0].locator, /page 1/);
  assert.match(records[0].locator, /sha256:/);
});

test("same-origin local preview uses Host without trusting forwarded-host", () => {
  const original = process.env.OPS_ACCESS_TOKEN;
  process.env.OPS_ACCESS_TOKEN = "a".repeat(32);
  try {
    const request = new Request("http://localhost:3000/api/operations", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        authorization: `Bearer ${"a".repeat(32)}`,
        "x-forwarded-host": "evil.example",
      },
    });
    assert.equal(mutationError(request), null);
  } finally {
    if (original === undefined) delete process.env.OPS_ACCESS_TOKEN;
    else process.env.OPS_ACCESS_TOKEN = original;
  }
});
test("Twilio signature validates the configured URL and all parameters; tampering and duplicates fail", () => {
  const url = "https://pilot.example/api/webhooks/whatsapp";
  const token = "synthetic-test-secret";
  const params = {
    AccountSid: "ACtest",
    MessageSid: "SM" + "a".repeat(32),
    From: "whatsapp:+12025550123",
    To: "whatsapp:+12025550124",
    Body: "Need feather-free bedding",
    NumMedia: "1",
  };
  const raw = new URLSearchParams(params).toString();
  const signature = createHmac("sha1", token)
    .update(
      url +
        Object.keys(params)
          .sort()
          .map((k) => k + params[k as keyof typeof params])
          .join(""),
    )
    .digest("base64");
  assert.ok(verifyTwilio(raw, signature, url, token));
  assert.ok(!verifyTwilio(raw + "&Body=changed", signature, url, token));
  assert.ok(!verifyTwilio(raw, signature, url + "?changed", token));
  const record = normalizeWhatsApp(raw, "sandbox");
  assert.equal(record.environment, "sandbox");
  assert.equal(record.occurredAt, null);
  assert.ok(record.warnings.some((w) => w.includes("voice")));
});
test("Mews mapping uses current scheduled fields and PersonCounts, preserving unknowns", () => {
  const parsed = normalizeMews({
    Reservations: [
      {
        Id: "reservation1",
        Number: "42",
        State: "Canceled",
        UpdatedUtc: "2026-10-22T14:00:00Z",
        ScheduledStartUtc: "2027-03-14T14:00:00Z",
        ScheduledEndUtc: "2027-03-19T12:00:00Z",
        PersonCounts: [{ Count: 2 }, { Count: 1 }],
      },
    ],
    Cursor: "next",
  });
  assert.equal(
    parsed.sources[0].facts.find((f) => f.key === "partySize")!.value,
    "3",
  );
  assert.equal(parsed.sources[0].environment, "sandbox");
  assert.ok(parsed.hasMore);
  assert.ok(!parsed.sources[0].facts.some((f) => f.key === "paymentStatus"));
});
test("provider failures and rate limits never create successful imports", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("secret provider body", { status: 429 });
    await assert.rejects(
      () => fetchJson("https://example.invalid"),
      /rate limit/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("private API access and cross-origin mutation checks fail closed", () => {
  const original = process.env.OPS_ACCESS_TOKEN;
  process.env.OPS_ACCESS_TOKEN = "a".repeat(32);
  try {
    assert.equal(
      accessError(new Request("https://pilot.example/api/operations"))?.status,
      401,
    );
    assert.equal(
      accessError(
        new Request("https://pilot.example/api/operations", {
          headers: { Authorization: `Bearer ${"a".repeat(32)}` },
        }),
      ),
      null,
    );
    assert.equal(
      mutationError(
        new Request("https://pilot.example/api/operations", {
          headers: { Origin: "https://evil.example" },
        }),
      )?.status,
      403,
    );
  } finally {
    if (original === undefined) delete process.env.OPS_ACCESS_TOKEN;
    else process.env.OPS_ACCESS_TOKEN = original;
  }
});
test("SQLite persists state and rolls back a failed import transaction", () => {
  const folder = mkdtempSync(join(tmpdir(), "analogue-test-"));
  const original = process.env.OPS_DB_PATH;
  process.env.OPS_DB_PATH = join(folder, "ops.sqlite");
  try {
    const f = syntheticExample();
    mutate((s) => ingest(s, f.sources, f.trips));
    assert.equal(readState().sources.length, 5);
    assert.throws(() =>
      mutate((s) => {
        s.trips.length = 0;
        throw new Error("abort");
      }),
    );
    assert.equal(readState().trips.length, 1);
  } finally {
    if (original === undefined) delete process.env.OPS_DB_PATH;
    else process.env.OPS_DB_PATH = original;
    rmSync(folder, { recursive: true, force: true });
  }
});
