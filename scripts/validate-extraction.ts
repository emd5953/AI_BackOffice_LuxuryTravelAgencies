import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aiAvailable } from "../src/lib/operations/ai";
import { extractionExample } from "../src/lib/operations/fixtures";
import { analyzeSources } from "../src/lib/operations/pipeline";
import { ingest, reconcile } from "../src/lib/operations/core";
import { mutate, readState } from "../src/lib/operations/store";

async function main() {
  loadEnvConfig(process.cwd());
  if (!aiAvailable())
    throw new Error(
      "Model credentials are not configured in .env.local. No AI request was made. Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL, then rerun.",
    );
  const directory = mkdtempSync(
    join(tmpdir(), "travel-extraction-validation-"),
  );
  process.env.OPS_DB_PATH = join(directory, "isolated.sqlite");
  try {
    const fixture = await extractionExample();
    mutate((state) => ingest(state, fixture.sources, fixture.trips));
    const result = await analyzeSources(fixture.sources.map((s) => s.id));
    assert.equal(
      result.failed,
      0,
      "Some sources failed. Check model access and retry.",
    );
    const state = readState();
    const linked = state.sources.filter(
      (s) => s.tripId === fixture.trips[0].id,
    );
    const issues = reconcile(fixture.trips[0], linked);
    assert.equal(
      linked.length,
      4,
      "Four sources should connect; the namesake must stay unmatched.",
    );
    assert.ok(
      state.sources.every((s) => !s.facts.length),
      "AI output must remain provisional.",
    );
    for (const id of [
      "missing:arrivalFlight",
      "conflict:checkIn:ryo-4821",
      "pending:paymentStatus",
      "pending:transferStatus",
      "reservation-review",
    ])
      assert.ok(
        issues.some((i) => i.id === id),
        `Missing expected check: ${id}`,
      );
    assert.ok(
      issues.some((i) => i.id.startsWith("request:")),
      "Client changes must remain requests.",
    );
    const receipt = {
      at: new Date().toISOString(),
      kind: "Real Anthropic API run on synthetic evidence",
      model: process.env.ANTHROPIC_MODEL,
      result,
      linked: linked.length,
      unmatched: state.sources.length - linked.length,
      issues: issues.map((i) => ({ id: i.id, title: i.title })),
      sources: state.sources.map((s) => ({
        title: s.title,
        digest: s.digest,
        fields: s.extraction?.facts.length,
        engine: s.extraction?.engine,
      })),
      noManualFacts: true,
      noExternalMessages: true,
    };
    mkdirSync("docs/validation", { recursive: true });
    writeFileSync(
      "docs/validation/ai-extraction.json",
      JSON.stringify(receipt, null, 2) + "\n",
    );
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Validation failed");
  process.exitCode = 1;
});
