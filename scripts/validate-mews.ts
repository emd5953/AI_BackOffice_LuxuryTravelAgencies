import { mkdir, writeFile } from "node:fs/promises";
import { readMewsDemo, MEWS_URL } from "../src/lib/operations/connectors";

// Read-only official sandbox check. Store only IDs/counts, never guest or payment data.
async function main() {
  const result = await readMewsDemo();
  const report = {
    checkedAt: new Date().toISOString(),
    endpoint: MEWS_URL,
    environment: "official-public-demo",
    operation: "read-only latest 10 reservations",
    recordCount: result.sources.length,
    hasMore: result.hasMore,
    records: result.sources.map((s) => ({
      externalId: s.externalId,
      digest: s.digest,
      sourceTimestamp: s.occurredAt,
    })),
    limitations:
      "Bounded sample; not a full sync. Sandbox records cannot confirm real agency bookings.",
  };
  await mkdir("docs/validation", { recursive: true });
  await writeFile(
    "docs/validation/mews-sandbox.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Official Mews demo returned ${result.sources.length} reservations. Read-only validation saved to docs/validation/mews-sandbox.json.`,
  );
}
main().catch(() => {
  console.error(
    "Mews sandbox validation failed; no successful result was recorded. Retry later or inspect provider configuration.",
  );
  process.exitCode = 1;
});
