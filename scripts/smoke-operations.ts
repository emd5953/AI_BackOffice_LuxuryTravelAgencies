import assert from "node:assert/strict";
import type { Workspace } from "../src/lib/operations/types";

// Run against an isolated local server/database, never a user's agency workspace.
async function main() {
  const base = process.env.OPS_SMOKE_URL;
  const token = process.env.OPS_ACCESS_TOKEN;
  if (
    !base ||
    !token ||
    !["127.0.0.1", "localhost"].includes(new URL(base).hostname)
  )
    throw new Error(
      "Set OPS_SMOKE_URL to an isolated localhost server and OPS_ACCESS_TOKEN.",
    );
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const endpoint = `${base}/api/operations`;
  const post = async (input: unknown) =>
    fetch(endpoint, { method: "POST", headers, body: JSON.stringify(input) });
  const noAuth = await fetch(endpoint);
  assert.equal(noAuth.status, 401);
  const csrf = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, Origin: "https://untrusted.example" },
    body: '{"action":"sample"}',
  });
  assert.equal(csrf.status, 403);
  let response = await post({ action: "sample" });
  assert.equal(response.status, 200);
  let state: Workspace = await response.json();
  const trip = state.trips.find((t) => t.reference === "SYN-KYO-01")!;
  const record = state.sources.find(
    (s) => s.externalId === "synthetic-email-1",
  )!;
  response = await post({
    action: "acceptFacts",
    sourceId: record.id,
    digest: record.digest,
    note: "Synthetic automated test",
    facts: [
      {
        key: "checkIn",
        value: "2027-03-14",
        excerpt: "arriving 14 March 2027",
      },
      {
        key: "reservationRef",
        value: "SYN-RYOKAN-84",
        excerpt: "Your confirmation is SYN-RYOKAN-84.",
      },
    ],
  });
  assert.equal(response.status, 200);
  response = await post({ action: "prepare", tripId: trip.id });
  assert.equal(response.status, 200);
  state = await response.json();
  const brief = state.briefs.find((b) => b.tripId === trip.id)!;
  assert.ok(brief.issues.some((i) => i.id.startsWith("conflict:checkIn")));
  assert.equal(
    (await fetch(`${endpoint}?export=${brief.id}`, { headers })).status,
    409,
  );
  const review = {
    action: "review",
    briefId: brief.id,
    decision: "approved",
    note: "Synthetic smoke test: unresolved checks acknowledged",
    draft: brief.draft,
  };
  const approvals = await Promise.all([post(review), post(review)]);
  assert.deepEqual(approvals.map((r) => r.status).sort(), [200, 400]);
  response = await fetch(`${endpoint}?export=${brief.id}`, { headers });
  assert.equal(response.status, 200);
  const exported = await response.json();
  assert.match(exported.purpose, /Not sent/);
  assert.equal(exported.brief.evidence.length, 4);
  response = await post({
    action: "acceptFacts",
    sourceId: record.id,
    digest: record.digest,
    note: "Add remaining detail",
    facts: [
      {
        key: "checkOut",
        value: "2027-03-19",
        excerpt: "departing 19 March 2027",
      },
    ],
  });
  assert.equal(response.status, 200);
  state = await response.json();
  assert.equal(state.briefs.find((b) => b.id === brief.id)!.stale, true);
  assert.equal(
    (await fetch(`${endpoint}?export=${brief.id}`, { headers })).status,
    409,
  );
  response = await fetch(`${base}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "MessageSid=invalid",
  });
  assert.ok([403, 503].includes(response.status));
  assert.equal((await post({ action: "send", briefId: brief.id })).status, 400);
  response = await post({ action: "extractionSample" });
  assert.equal(response.status, 200);
  state = await response.json();
  assert.equal(state.importedSourceIds?.length, 5);
  const rawSources = state.sources.filter((s) =>
    state.importedSourceIds!.includes(s.id),
  );
  assert.ok(rawSources.every((s) => !s.facts.length && !s.extraction));
  assert.ok(
    rawSources.some((s) => s.parentId && s.content.includes("15 March 2027")),
  );
  if (!state.aiAvailable) {
    response = await post({
      action: "analyze",
      sourceIds: state.importedSourceIds,
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /No AI call was made/i);
  }
  console.log(
    "HTTP smoke passed: private access, CSRF, import → reviewed facts → conflict → approval → export; concurrent review, stale export, unsigned webhook, send-command rejection, raw EML/PDF/WhatsApp sample and missing-model handling.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke failed");
  process.exitCode = 1;
});
