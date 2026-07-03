import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db } from "@/db";
import { drafts, evalResults } from "@/db/schema";
import { recordRun } from "@/lib/telemetry";

// LLM-judge eval: for every stored draft (any status), a cheap judge model
// checks whether each specific factual claim in the drafted body is
// supported by the exact context the drafting model was given. This is a
// metric to watch over time, not a release gate — it always exits 0.

const JUDGE_MODEL = "claude-haiku-4-5";

const anthropic = new Anthropic();

const GroundingResult = z.object({
  claims: z.array(
    z.object({
      claim: z.string().describe("A specific factual claim from the draft, verbatim-ish"),
      grounded: z
        .boolean()
        .describe("Whether this claim is supported by the provided context JSON"),
      evidence: z
        .string()
        .nullable()
        .describe("The context field/value that supports the claim, or null if ungrounded"),
    }),
  ),
});

const SYSTEM = `You verify a drafted email against the exact context the drafting model was given.

List every specific factual claim in the draft — facts about THIS client, their trip, their history, or their preferences — and whether it is supported by the provided context JSON. Do not list general destination knowledge (weather, geography, seasonality) as a claim; that is not something the context needs to support. If the draft makes no specific factual claims, return an empty claims array.`;

const runId = crypto.randomUUID();

async function main() {
  const allDrafts = await db.select().from(drafts);

  if (allDrafts.length === 0) {
    console.log("No drafts in the database — nothing to grade. Run a draft first.");
    return;
  }

  const rows: { caseName: string; score: number; pass: boolean; detail: string }[] = [];

  for (const draft of allDrafts) {
    const userPrompt = [
      "# Draft body",
      draft.body,
      "",
      "# Context provided to the drafting model",
      JSON.stringify(draft.promptContext, null, 2),
    ].join("\n");

    const judged = await recordRun(
      { agent: "eval_grounding", model: JUDGE_MODEL, threadId: draft.threadId },
      async () => {
        const response = await anthropic.messages.parse({
          model: JUDGE_MODEL,
          max_tokens: 2000,
          system: SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
          output_config: { format: zodOutputFormat(GroundingResult) },
        });
        return { result: response, usage: response.usage };
      },
    );

    if (judged.stop_reason === "refusal" || !judged.parsed_output) {
      const detail = judged.stop_reason === "refusal" ? "judge refused" : "judge output did not parse";
      rows.push({ caseName: `draft-${draft.id}`, score: 0, pass: false, detail });
      continue;
    }

    const { claims } = judged.parsed_output;
    const score = claims.length === 0 ? 1.0 : claims.filter((c) => c.grounded).length / claims.length;
    const ungrounded = claims.filter((c) => !c.grounded);
    const pass = score >= 0.8;

    rows.push({
      caseName: `draft-${draft.id}`,
      score,
      pass,
      detail: JSON.stringify(ungrounded),
    });
  }

  const now = new Date();
  await db.insert(evalResults).values(
    rows.map((r) => ({
      suite: "draft_grounding" as const,
      runId,
      caseName: r.caseName,
      pass: r.pass,
      score: r.score,
      detail: r.detail,
      createdAt: now,
    })),
  );

  console.log(`\nrunId: ${runId}\n`);
  console.log(`${"draft".padEnd(14)} score   result`);
  console.log("-".repeat(50));
  for (const r of rows) {
    console.log(`${r.caseName.padEnd(14)} ${r.score.toFixed(2)}    ${r.pass ? "PASS" : "FAIL"}`);
  }
  const mean = rows.reduce((s, r) => s + r.score, 0) / rows.length;
  console.log(`\nmean grounding score: ${mean.toFixed(2)} across ${rows.length} draft(s)`);
}

main().then(() => process.exit(0));
