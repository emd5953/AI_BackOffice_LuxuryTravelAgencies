import { eq } from "drizzle-orm";
import { db } from "@/db";
import { threads } from "@/db/schema";
import { draftReply } from "@/lib/agents/draft-reply";

async function main() {
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.counterpartType, "client"))
    .limit(1);
  if (!thread) throw new Error("No client thread in DB — run npm run db:seed");

  console.log(`Drafting reply for thread ${thread.id}: "${thread.subject}"\n`);
  const start = Date.now();
  const draft = await draftReply(thread.id);
  const secs = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`--- draft #${draft.id} (${draft.model}, ${secs}s) ---\n`);
  console.log(draft.body);
  console.log("\n--- flags ---");
  for (const f of draft.flags) console.log(`• ${f}`);
  if (draft.flags.length === 0) console.log("(none)");
}

main().then(() => process.exit(0));
