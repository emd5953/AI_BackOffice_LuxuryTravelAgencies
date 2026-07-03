import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { suggestions } from "@/db/schema";
import { generateSuggestions } from "@/lib/agents/suggest";

async function main() {
  const start = Date.now();
  const result = await generateSuggestions();
  const secs = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`--- generateSuggestions (${secs}s) ---`);
  console.log(
    `inserted: ${result.inserted} | skippedDismissed: ${result.skippedDismissed} | droppedInvalid: ${result.droppedInvalid}`,
  );

  const open = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.status, "open"))
    .orderBy(asc(suggestions.urgency), desc(suggestions.createdAt));

  console.log(`\n--- open suggestions (${open.length}) ---`);
  for (const s of open) {
    console.log(
      `\n[urgency ${s.urgency}] (${s.kind}) ${s.title}\n` +
        `  client: ${s.clientId}\n` +
        `  rationale: ${s.rationale.replace(/\s+/g, " ").slice(0, 200)}\n` +
        `  sourceRefs: ${s.sourceRefs.join(", ")}`,
    );
  }
}

main().then(() => process.exit(0));
