import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { retrieveContext } from "@/lib/retrieval";

async function main() {
  const query = process.argv[2] ?? "boats";
  const clientName = process.argv[3] ?? "Daniel & Sarah Meyer";

  const [client] = await db.select().from(clients).where(eq(clients.name, clientName));
  if (!client) throw new Error(`Client "${clientName}" not found`);

  console.log(`Query: "${query}" against ${client.name}\n`);
  const results = await retrieveContext(client.id, query, 3);
  for (const r of results) {
    console.log(
      `  ${r.score.toFixed(3)}  [${r.sourceType}#${r.sourceId}]  ${r.text.replace(/\s+/g, " ").slice(0, 110)}…`,
    );
  }
}

main().then(() => process.exit(0));
