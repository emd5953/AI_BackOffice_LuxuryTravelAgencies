import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, quotes } from "@/db/schema";
import { getSupplier, getThread } from "@/lib/context";
import { recordRun } from "@/lib/telemetry";

const MODEL = "claude-opus-4-8";

const anthropic = new Anthropic();

const QuoteOption = z.object({
  label: z
    .string()
    .describe("The room/villa/programme option as the supplier names it"),
  currency: z.string().describe("ISO currency code, e.g. USD"),
  amount: z
    .number()
    .describe(
      "The normalized numeric rate. Be careful with number formats: many Latin American suppliers use European formatting where '.' separates thousands (USD 1.890 means one thousand eight hundred ninety). Sanity-check magnitude — a luxury Patagonia lodge is not $1.89 a night.",
    ),
  amountAsWritten: z
    .string()
    .describe("The figure exactly as written in the email, e.g. 'USD 1.890'"),
  unit: z.enum(["per_night", "per_stay"]),
  scope: z
    .enum(["per_person", "per_room", "per_unit", "whole_party"])
    .describe(
      "What the amount applies to. per_unit = one villa/suite housing the party. Read carefully: 'per person per night, double occupancy' is per_person.",
    ),
  basis: z
    .enum(["net", "gross", "unstated"])
    .describe(
      "net = non-commissionable, agency adds its own markup. gross = commission included. unstated if the email doesn't say.",
    ),
  minNights: z.number().nullable(),
  childPolicy: z.string().nullable().describe("Child discount terms, verbatim-ish"),
  holdExpiry: z
    .string()
    .nullable()
    .describe(
      "When the hold expires, as stated ('5 days', 'until Friday'). Do not convert relative dates — copy what was written.",
    ),
  inclusions: z.array(z.string()).describe("What the rate includes"),
  caveats: z
    .array(z.string())
    .describe(
      "Anything a designer must know before quoting the client: promos (stay 10 pay 9), supplements, capacity limits, currency ambiguity, scarcity claims",
    ),
});

const QuoteExtraction = z.object({
  options: z.array(QuoteOption),
  flags: z
    .array(z.string())
    .describe("Ambiguities in the email that extraction could not resolve"),
});

const SYSTEM = `You extract structured rate quotes from supplier emails for a luxury travel agency's back office. Designers make purchasing decisions from your extraction, so a wrong number is worse than a missing one.

Rules:
- Extract only what the email states. Never infer a rate, discount, or deadline that isn't there.
- Preserve the supplier's exact figures in amountAsWritten; normalize carefully into amount.
- Every discount, promo, supplement, or capacity restriction goes into childPolicy or caveats — buried footnotes are exactly what designers miss.
- If something material is ambiguous (currency, what the rate covers), extract your best reading AND flag it.`;

export async function parseQuotesFromThread(threadId: number) {
  const thread = await getThread(threadId);
  if (thread.counterpartType !== "supplier" || !thread.supplierId || !thread.tripId) {
    throw new Error("Quote parsing needs a supplier thread linked to a trip");
  }
  const supplier = await getSupplier(thread.supplierId);

  const [latestInbound] = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(desc(messages.sentAt), desc(messages.id));
  if (!latestInbound || latestInbound.direction !== "inbound") {
    throw new Error("No inbound supplier message to parse");
  }

  const userPrompt = [
    `Supplier: ${supplier?.name} (${supplier?.type}, ${supplier?.location})`,
    `Email received: ${latestInbound.sentAt.toISOString()}`,
    "",
    "Email body:",
    "---",
    latestInbound.body,
    "---",
    "",
    "Extract all quoted rate options.",
  ].join("\n");

  const response = await recordRun({ agent: "parse_quote", model: MODEL, threadId }, async () => {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: zodOutputFormat(QuoteExtraction) },
    });
    return { result: response, usage: response.usage };
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model declined to parse this email");
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Model output did not match the quote schema");

  const now = new Date();

  // Re-parse replaces this message's previous extraction. Delete + insert run
  // in one transaction so concurrent re-extracts can't interleave and leave
  // duplicate rows.
  return db.transaction(async (tx) => {
    await tx.delete(quotes).where(eq(quotes.messageId, latestInbound.id));

    if (parsed.options.length === 0) return [];

    return await tx
      .insert(quotes)
      .values(
        parsed.options.map((o) => ({
          tripId: thread.tripId!,
          supplierId: thread.supplierId!,
          messageId: latestInbound.id,
          label: o.label,
          currency: o.currency,
          amount: o.amount,
          amountAsWritten: o.amountAsWritten,
          unit: o.unit,
          scope: o.scope,
          basis: o.basis,
          minNights: o.minNights,
          childPolicy: o.childPolicy,
          holdExpiry: o.holdExpiry,
          inclusions: o.inclusions,
          caveats: [...o.caveats, ...parsed.flags.map((f) => `Email-level note: ${f}`)],
          model: MODEL,
          createdAt: now,
        })),
      )
      .returning();
  });
}
