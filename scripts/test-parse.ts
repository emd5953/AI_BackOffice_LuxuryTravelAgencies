import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, threads } from "@/db/schema";
import { parseQuotesFromThread } from "@/lib/agents/parse-quote";

async function main() {
  const supplierThreads = await db
    .select()
    .from(threads)
    .where(eq(threads.counterpartType, "supplier"));

  for (const thread of supplierThreads) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, thread.supplierId!));
    console.log(`\n=== ${supplier.name} (thread ${thread.id}) ===`);
    const start = Date.now();
    const extracted = await parseQuotesFromThread(thread.id);
    console.log(`(${((Date.now() - start) / 1000).toFixed(1)}s)`);
    for (const q of extracted) {
      console.log(
        `  ${q.label}\n` +
          `    written: "${q.amountAsWritten}" → normalized: ${q.currency} ${q.amount.toLocaleString()} ${q.unit} ${q.scope}\n` +
          `    basis: ${q.basis} | hold: ${q.holdExpiry ?? "—"} | children: ${q.childPolicy ?? "—"}\n` +
          `    caveats: ${q.caveats.join(" | ") || "—"}`,
      );
    }
  }
}

main().then(() => process.exit(0));
