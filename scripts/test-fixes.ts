// Exercises the pure logic behind the adversarial-review fixes without
// touching any model API. Run with: npx tsx scripts/test-fixes.ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, drafts, messages, threads, quotes, trips } from "@/db/schema";
import { estimateStayTotal } from "@/lib/quotes";
import { approveDraft } from "@/app/inbox/actions";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`PASS - ${name}`);
  } else {
    fail++;
    console.log(`FAIL - ${name}${detail ? ` (${detail})` : ""}`);
  }
}

// ---------- helpers to build minimal Quote/Trip rows via type assertions ----------

const baseQuote = {
  id: 1,
  tripId: 1,
  supplierId: 1,
  messageId: 1,
  label: "Test room",
  currency: "USD",
  amount: 100,
  amountAsWritten: "USD 100",
  unit: "per_night",
  scope: "whole_party",
  basis: "unstated",
  minNights: null,
  childPolicy: null,
  holdExpiry: null,
  inclusions: [],
  caveats: [],
  model: "test",
  createdAt: new Date(),
} as unknown as typeof quotes.$inferSelect;

const baseTrip = {
  id: 1,
  clientId: 1,
  title: "Test trip",
  destination: "Patagonia",
  status: "planning",
  startDate: "2026-08-01",
  endDate: "2026-08-06", // 5 nights
  partySize: null,
  budgetUsd: null,
  createdAt: new Date(),
} as unknown as typeof trips.$inferSelect;

function quote(overrides: Partial<typeof quotes.$inferSelect>) {
  return { ...baseQuote, ...overrides } as typeof quotes.$inferSelect;
}
function trip(overrides: Partial<typeof trips.$inferSelect>) {
  return { ...baseTrip, ...overrides } as typeof trips.$inferSelect;
}

async function testPureLogic() {
  // Fix 2: per_person + null partySize -> null total with party-size warning
  {
    const r = estimateStayTotal(quote({ scope: "per_person" }), trip({ partySize: null }));
    check(
      "Fix 2: per_person with null partySize returns null total",
      r.totalUsd === null &&
        r.warnings.some((w) => w.includes("Party size unknown — cannot compute a per-person total")),
      JSON.stringify(r),
    );
  }

  // Fix 4: per_room with partySize 4 -> x2 rooms
  {
    const r = estimateStayTotal(quote({ scope: "per_room" }), trip({ partySize: 4 }));
    check(
      "Fix 4: per_room with partySize 4 uses 2 rooms",
      r.formula.includes("× 2 rooms") && r.totalUsd === 100 * 5 * 2,
      JSON.stringify(r),
    );
  }

  // Fix 4: per_room with partySize 6 -> x3 rooms
  {
    const r = estimateStayTotal(quote({ scope: "per_room" }), trip({ partySize: 6 }));
    check(
      "Fix 4: per_room with partySize 6 uses 3 rooms",
      r.formula.includes("× 3 rooms") && r.totalUsd === 100 * 5 * 3,
      JSON.stringify(r),
    );
  }

  // Fix 4: per_room with null partySize -> null total
  {
    const r = estimateStayTotal(quote({ scope: "per_room" }), trip({ partySize: null }));
    check(
      "Fix 4: per_room with null partySize returns null total",
      r.totalUsd === null &&
        r.warnings.some((w) => w.includes("Party size unknown — cannot estimate room count")),
      JSON.stringify(r),
    );
  }

  // Fix 5: minNights 5 vs 3-night trip -> minimum warning
  {
    const r = estimateStayTotal(
      quote({ scope: "whole_party", minNights: 5 }),
      trip({ startDate: "2026-08-01", endDate: "2026-08-04" }), // 3 nights
    );
    check(
      "Fix 5: minNights warning fires when trip is shorter than supplier minimum",
      r.warnings.some((w) => w.includes("Trip is 3 nights but supplier minimum is 5")),
      JSON.stringify(r),
    );
  }

  // Fix 10: endDate before startDate -> null + invalid-dates warning
  {
    const r = estimateStayTotal(
      quote({ scope: "whole_party" }),
      trip({ startDate: "2026-08-06", endDate: "2026-08-01" }),
    );
    check(
      "Fix 10: endDate before startDate returns null with invalid-dates warning",
      r.totalUsd === null &&
        r.warnings.some((w) => w.includes("Trip dates are invalid or zero nights")),
      JSON.stringify(r),
    );
  }

  // Fix 6: caveat "4th night free" -> promo warning
  {
    const r = estimateStayTotal(
      quote({ scope: "whole_party", caveats: ["4th night free"] }),
      trip({}),
    );
    check(
      "Fix 6: '4th night free' caveat trips the promo/discount warning",
      r.warnings.some((w) => w.includes("Possible discount/promo in caveats")),
      JSON.stringify(r),
    );
  }
}

// ---------- Fix 1: concurrency test against the real DB ----------

async function testApproveDraftConcurrency() {
  const now = new Date();

  const [client] = await db
    .insert(clients)
    .values({
      name: "Test Fixes Client",
      email: `test-fixes-${Date.now()}@example.com`,
      bio: null,
      createdAt: now,
    })
    .returning();

  const [thread] = await db
    .insert(threads)
    .values({
      subject: "Test fixes concurrency thread",
      counterpartType: "client",
      clientId: client.id,
      supplierId: null,
      tripId: null,
      lastMessageAt: now,
    })
    .returning();

  const [draft] = await db
    .insert(drafts)
    .values({
      threadId: thread.id,
      body: "Draft body",
      flags: [],
      status: "pending",
      sentBody: null,
      model: "test",
      promptContext: { mode: "full" },
      createdAt: now,
      resolvedAt: null,
    })
    .returning();

  const results = await Promise.allSettled([
    approveDraft(draft.id, "body A"),
    approveDraft(draft.id, "body B"),
  ]);

  const rejected = results.filter((r) => r.status === "rejected");
  const fulfilled = results.filter((r) => r.status === "fulfilled");

  // approveDraft calls revalidatePath, which throws outside a Next request
  // context. Only tolerate that specific failure mode from the *winner*'s
  // path — a rejection whose message is about "Draft is not pending" is the
  // expected loser. Anything else (including revalidate noise) we ignore for
  // the purpose of this assertion and instead check DB state directly below.
  const genuineLoserRejections = rejected.filter((r) =>
    String((r as PromiseRejectedResult).reason?.message ?? "").includes("Draft is not pending"),
  );

  const outboundMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, thread.id));
  const [finalDraft] = await db.select().from(drafts).where(eq(drafts.id, draft.id));

  check(
    "Fix 1: exactly one outbound message written for concurrent approveDraft calls",
    outboundMessages.length === 1,
    `got ${outboundMessages.length}`,
  );
  check(
    "Fix 1: draft ends up approved",
    finalDraft?.status === "approved",
    `status=${finalDraft?.status}`,
  );
  check(
    "Fix 1: exactly one caller lost the race with 'Draft is not pending'",
    genuineLoserRejections.length === 1 || fulfilled.length === 1,
    `rejected=${rejected.length} fulfilled=${fulfilled.length}`,
  );

  // Cleanup
  await db.delete(messages).where(eq(messages.threadId, thread.id));
  await db.delete(drafts).where(eq(drafts.id, draft.id));
  await db.delete(threads).where(eq(threads.id, thread.id));
  await db.delete(clients).where(eq(clients.id, client.id));
}

async function main() {
  await testPureLogic();
  await testApproveDraftConcurrency();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
