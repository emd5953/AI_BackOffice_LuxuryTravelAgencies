import { db } from "@/db";
import { agentRuns } from "@/db/schema";

// Cost per million tokens: [input, output]
const COST_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function costForUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const rates = COST_PER_MTOK[model];
  if (!rates) return null;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

interface RunMeta {
  agent: "draft_reply" | "parse_quote" | "eval_grounding" | "suggest";
  model: string;
  threadId?: number;
}

interface RunOutcome<T> {
  result: T;
  usage?: { input_tokens: number; output_tokens: number };
}

// Wraps a single LLM call with timing + a persisted agent_runs row. On
// success, records tokens/cost when usage is provided. On throw, records a
// failed run (error truncated to 500 chars) before rethrowing — the caller
// never sees a swallowed error.
export async function recordRun<T>(
  meta: RunMeta,
  fn: () => Promise<RunOutcome<T>>,
): Promise<T> {
  const start = Date.now();
  try {
    const { result, usage } = await fn();
    const latencyMs = Date.now() - start;
    const costUsd = usage
      ? costForUsage(meta.model, usage.input_tokens, usage.output_tokens)
      : null;
    await db.insert(agentRuns).values({
      agent: meta.agent,
      model: meta.model,
      threadId: meta.threadId ?? null,
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      costUsd,
      latencyMs,
      success: true,
      error: null,
      createdAt: new Date(),
    });
    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(agentRuns).values({
      agent: meta.agent,
      model: meta.model,
      threadId: meta.threadId ?? null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      latencyMs,
      success: false,
      error: message.slice(0, 500),
      createdAt: new Date(),
    });
    throw err;
  }
}
