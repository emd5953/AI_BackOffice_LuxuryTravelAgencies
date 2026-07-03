import { db } from "@/db";
import { clients } from "@/db/schema";
import { indexClientContext } from "@/lib/indexing";

async function main() {
  const allClients = await db.select().from(clients);

  let totalIndexed = 0;
  let totalSkipped = 0;
  let totalDeleted = 0;

  for (const client of allClients) {
    const result = await indexClientContext(client.id);
    console.log(
      `${client.name} (#${client.id}): indexed ${result.indexed}, skipped ${result.skipped}, deleted ${result.deleted}`,
    );
    totalIndexed += result.indexed;
    totalSkipped += result.skipped;
    totalDeleted += result.deleted;
  }

  console.log(
    `\nTotal: indexed ${totalIndexed}, skipped ${totalSkipped}, deleted ${totalDeleted}`,
  );
}

main().then(() => process.exit(0));
