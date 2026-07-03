import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { evalResults, suppliers, threads } from "@/db/schema";
import { parseQuotesFromThread } from "@/lib/agents/parse-quote";

// Golden suite for the extraction agent, run against the three seeded
// Patagonia supplier emails. Assertions cover the "traps" those emails were
// written to contain: European decimal formatting, per-person vs per-room
// pricing, and a promo buried in a caveat. This re-parses (and replaces)
// those threads' quotes rows — expected, since that's what the agent does.

const runId = crypto.randomUUID();

interface Assertion {
  caseName: string;
  pass: boolean;
  detail: string;
}

function assert(caseName: string, cond: boolean, detail: string): Assertion {
  return { caseName, pass: cond, detail: cond ? "" : detail };
}

async function findSupplierThread(supplierName: string) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.name, supplierName));
  if (!supplier) throw new Error(`Supplier not found: ${supplierName}`);
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.supplierId, supplier.id), eq(threads.counterpartType, "supplier")));
  if (!thread) throw new Error(`No supplier thread found for: ${supplierName}`);
  return thread;
}

async function main() {
  const assertions: Assertion[] = [];

  // ---------- Tierra Patagonia — European decimal trap ----------
  {
    const thread = await findSupplierThread("Tierra Patagonia");
    const options = await parseQuotesFromThread(thread.id);
    assertions.push(
      assert("tierra/option-count-2", options.length === 2, `got ${options.length} options`),
    );

    const familia = options.find((o) => /familia/i.test(o.label));
    assertions.push(assert("tierra/familia-found", Boolean(familia), "no Familia Suite option found"));
    if (familia) {
      assertions.push(
        assert("tierra/familia-amount-1890", familia.amount === 1890, `amount was ${familia.amount}`),
      );
      assertions.push(
        assert(
          "tierra/familia-unit-per_night",
          familia.unit === "per_night",
          `unit was ${familia.unit}`,
        ),
      );
      assertions.push(
        assert("tierra/familia-basis-net", familia.basis === "net", `basis was ${familia.basis}`),
      );
    }

    const standard = options.find((o) => /standard/i.test(o.label));
    assertions.push(
      assert("tierra/standard-found", Boolean(standard), "no standard-rooms option found"),
    );
    if (standard) {
      assertions.push(
        assert("tierra/standard-amount-1420", standard.amount === 1420, `amount was ${standard.amount}`),
      );
      assertions.push(
        assert(
          "tierra/standard-scope-per_room",
          standard.scope === "per_room",
          `scope was ${standard.scope}`,
        ),
      );
    }

    const hasHold5Day = options.some((o) => o.holdExpiry && /5\s*day/i.test(o.holdExpiry));
    assertions.push(
      assert(
        "tierra/hold-expiry-5-day",
        hasHold5Day,
        `holdExpiry values: ${options.map((o) => o.holdExpiry).join(" | ")}`,
      ),
    );
  }

  // ---------- Explora Patagonia — per-person pricing trap ----------
  {
    const thread = await findSupplierThread("Explora Patagonia");
    const options = await parseQuotesFromThread(thread.id);
    assertions.push(
      assert("explora/option-count-1", options.length === 1, `got ${options.length} options`),
    );
    const opt = options[0];
    if (opt) {
      assertions.push(assert("explora/amount-1095", opt.amount === 1095, `amount was ${opt.amount}`));
      assertions.push(
        assert("explora/scope-per_person", opt.scope === "per_person", `scope was ${opt.scope}`),
      );
      assertions.push(assert("explora/basis-gross", opt.basis === "gross", `basis was ${opt.basis}`));
      assertions.push(
        assert(
          "explora/hold-expiry-7-day",
          Boolean(opt.holdExpiry && /7\s*day/i.test(opt.holdExpiry)),
          `holdExpiry was ${opt.holdExpiry}`,
        ),
      );
      assertions.push(
        assert(
          "explora/child-policy-present",
          opt.childPolicy != null,
          `childPolicy was ${opt.childPolicy}`,
        ),
      );
    }
  }

  // ---------- Awasi Patagonia — relative hold date + buried promo ----------
  {
    const thread = await findSupplierThread("Awasi Patagonia");
    const options = await parseQuotesFromThread(thread.id);
    assertions.push(
      assert("awasi/option-count-1", options.length === 1, `got ${options.length} options`),
    );
    const opt = options[0];
    if (opt) {
      assertions.push(assert("awasi/amount-3290", opt.amount === 3290, `amount was ${opt.amount}`));
      assertions.push(assert("awasi/unit-per_night", opt.unit === "per_night", `unit was ${opt.unit}`));
      assertions.push(assert("awasi/basis-net", opt.basis === "net", `basis was ${opt.basis}`));
      assertions.push(
        assert(
          "awasi/hold-expiry-friday",
          Boolean(opt.holdExpiry && /friday/i.test(opt.holdExpiry)),
          `holdExpiry was ${opt.holdExpiry}`,
        ),
      );
      const caveatsJoined = opt.caveats.join(" ");
      assertions.push(
        assert(
          "awasi/caveats-stay-10-pay-9",
          /stay\s*10\s*pay\s*9/i.test(caveatsJoined),
          `caveats: ${caveatsJoined}`,
        ),
      );
    }
  }

  const now = new Date();
  await db.insert(evalResults).values(
    assertions.map((a) => ({
      suite: "parse_golden" as const,
      runId,
      caseName: a.caseName,
      pass: a.pass,
      score: a.pass ? 1 : 0,
      detail: a.detail || null,
      createdAt: now,
    })),
  );

  const passCount = assertions.filter((a) => a.pass).length;
  console.log(`\nrunId: ${runId}\n`);
  console.log(`${"case".padEnd(32)} result  detail`);
  console.log("-".repeat(80));
  for (const a of assertions) {
    console.log(`${a.caseName.padEnd(32)} ${a.pass ? "PASS" : "FAIL"}    ${a.detail}`);
  }
  console.log(`\n${passCount}/${assertions.length} passed`);

  if (passCount < assertions.length) {
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0));
