import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, evalResults } from "@/db/schema";
import { draftLifecycleMetrics } from "@/lib/eval-metrics";

export const dynamic = "force-dynamic";

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

const AGENT_LABELS: Record<string, string> = {
  draft_reply: "draft_reply",
  parse_quote: "parse_quote",
  eval_grounding: "eval_grounding",
};

const SUITES = ["parse_golden", "draft_grounding"] as const;

async function getDashboardData() {
  const runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt));

  const totalRuns = runs.length;
  const successCount = runs.filter((r) => r.success).length;
  const successRate = totalRuns > 0 ? successCount / totalRuns : null;
  const totalCost = runs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const medianLatency = median(runs.map((r) => r.latencyMs));

  const byAgent = new Map<string, typeof runs>();
  for (const r of runs) {
    const list = byAgent.get(r.agent) ?? [];
    list.push(r);
    byAgent.set(r.agent, list);
  }
  const perAgent = [...byAgent.entries()].map(([agent, agentRunsList]) => {
    const succ = agentRunsList.filter((r) => r.success).length;
    const inputTokens = agentRunsList
      .map((r) => r.inputTokens)
      .filter((t): t is number => t != null);
    const outputTokens = agentRunsList
      .map((r) => r.outputTokens)
      .filter((t): t is number => t != null);
    return {
      agent,
      runs: agentRunsList.length,
      successPct: (succ / agentRunsList.length) * 100,
      avgInputTokens: mean(inputTokens),
      avgOutputTokens: mean(outputTokens),
      totalCost: agentRunsList.reduce((s, r) => s + (r.costUsd ?? 0), 0),
      medianLatency: median(agentRunsList.map((r) => r.latencyMs)),
    };
  });

  const lifecycle = await draftLifecycleMetrics();

  const latestEvals: {
    suite: string;
    runId: string | null;
    cases: (typeof evalResults.$inferSelect)[];
  }[] = [];
  for (const suite of SUITES) {
    const [latest] = await db
      .select()
      .from(evalResults)
      .where(eq(evalResults.suite, suite))
      .orderBy(desc(evalResults.createdAt))
      .limit(1);
    if (!latest) {
      latestEvals.push({ suite, runId: null, cases: [] });
      continue;
    }
    const cases = await db
      .select()
      .from(evalResults)
      .where(eq(evalResults.runId, latest.runId))
      .orderBy(evalResults.caseName);
    latestEvals.push({ suite, runId: latest.runId, cases });
  }

  const recentRuns = runs.slice(0, 20);

  return {
    totalRuns,
    successRate,
    totalCost,
    medianLatency,
    perAgent,
    lifecycle,
    latestEvals,
    recentRuns,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
          Operations, <em className="italic text-accent">measured</em>.
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Agent telemetry, evals, and draft quality</p>
      </header>

      <div className="stagger space-y-6">
        {/* Stat cards */}
        <section className="card-in stagger grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card-in rounded-3xl border border-hairline/60 bg-surface-raised p-4 shadow-float">
            <p className="text-xs text-ink-muted">Total agent runs</p>
            <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">{data.totalRuns}</p>
          </div>
          <div className="card-in rounded-3xl border border-hairline/60 bg-surface-raised p-4 shadow-float">
            <p className="text-xs text-ink-muted">Success rate</p>
            <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">
              {data.successRate != null ? `${(data.successRate * 100).toFixed(0)}%` : "—"}
            </p>
          </div>
          <div className="card-in rounded-3xl border border-hairline/60 bg-surface-raised p-4 shadow-float">
            <p className="text-xs text-ink-muted">Total cost</p>
            <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">
              ${data.totalCost.toFixed(2)}
            </p>
          </div>
          <div className="card-in rounded-3xl border border-hairline/60 bg-surface-raised p-4 shadow-float">
            <p className="text-xs text-ink-muted">Median latency</p>
            <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">
              {data.medianLatency != null ? `${Math.round(data.medianLatency).toLocaleString()}ms` : "—"}
            </p>
          </div>
        </section>

        {/* Per-agent table */}
        <section className="card-in overflow-hidden rounded-3xl border border-hairline/60 bg-surface-raised shadow-float">
          <header className="border-b border-hairline p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Per-agent
            </h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-ink-muted">
                  <th className="p-3 font-medium">Agent</th>
                  <th className="p-3 font-medium">Runs</th>
                  <th className="p-3 font-medium">Success %</th>
                  <th className="p-3 font-medium">Avg input tok</th>
                  <th className="p-3 font-medium">Avg output tok</th>
                  <th className="p-3 font-medium">Total cost</th>
                  <th className="p-3 font-medium">Median latency</th>
                </tr>
              </thead>
              <tbody>
                {data.perAgent.length === 0 && (
                  <tr>
                    <td className="p-3 text-xs text-ink-muted" colSpan={7}>
                      No agent runs yet.
                    </td>
                  </tr>
                )}
                {data.perAgent.map((a) => (
                  <tr key={a.agent} className="border-b border-hairline">
                    <td className="p-3 font-medium text-ink">{AGENT_LABELS[a.agent] ?? a.agent}</td>
                    <td className="p-3 text-ink">{a.runs}</td>
                    <td className="p-3 text-ink">{a.successPct.toFixed(0)}%</td>
                    <td className="p-3 text-ink">
                      {a.avgInputTokens != null ? Math.round(a.avgInputTokens).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-ink">
                      {a.avgOutputTokens != null ? Math.round(a.avgOutputTokens).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-ink">${a.totalCost.toFixed(2)}</td>
                    <td className="p-3 text-ink">
                      {a.medianLatency != null ? `${Math.round(a.medianLatency).toLocaleString()}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Draft lifecycle */}
        <section className="card-in rounded-3xl border border-hairline/60 bg-surface-raised p-5 shadow-float">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Draft lifecycle
          </h2>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-ink-muted">By status</p>
              <p className="mt-1 text-sm text-ink">
                {Object.keys(data.lifecycle.counts).length === 0
                  ? "No drafts yet"
                  : Object.entries(data.lifecycle.counts)
                      .map(([status, n]) => `${status}: ${n}`)
                      .join(" · ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Acceptance rate</p>
              <p className="mt-1 text-sm text-ink">
                {data.lifecycle.acceptanceRate != null
                  ? `${(data.lifecycle.acceptanceRate * 100).toFixed(0)}%`
                  : "n/a — no approved/dismissed drafts yet"}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Mean edit distance</p>
              <p className="mt-1 text-sm text-ink">
                {data.lifecycle.meanEditDistance != null
                  ? `${data.lifecycle.meanEditDistance.toFixed(3)} (n=${data.lifecycle.editedSampleSize})`
                  : "n/a — no edited approved drafts yet"}
              </p>
            </div>
          </div>
        </section>

        {/* Latest evals */}
        <section className="card-in rounded-3xl border border-hairline/60 bg-surface-raised p-5 shadow-float">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Latest evals
          </h2>
          <div className="space-y-4">
            {data.latestEvals.map(({ suite, runId, cases }) => (
              <div key={suite}>
                <p className="text-sm font-medium text-ink">{suite}</p>
                {cases.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    No eval runs yet — npm run {suite === "parse_golden" ? "eval:parse" : "eval:grounding"}
                  </p>
                ) : (
                  <>
                    <p className="mt-0.5 text-[10px] text-ink-muted">run {runId}</p>
                    <ul className="mt-2 space-y-1">
                      {cases.map((c) => (
                        <li key={c.id} className="flex items-start gap-2 text-xs">
                          <span
                            className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                              c.pass ? "bg-positive" : "bg-danger"
                            }`}
                          />
                          <span className="font-mono text-ink">{c.caseName}</span>
                          {c.score != null && (
                            <span className="text-ink-muted tabular-nums">
                              score {c.score.toFixed(2)}
                            </span>
                          )}
                          {c.detail && (
                            <span className="max-w-md truncate text-ink-muted">
                              {c.detail.slice(0, 140)}
                              {c.detail.length > 140 ? "…" : ""}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Recent runs */}
        <section className="card-in overflow-hidden rounded-3xl border border-hairline/60 bg-surface-raised shadow-float">
          <header className="border-b border-hairline p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Recent runs
            </h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-ink-muted">
                  <th className="p-3 font-medium">Agent</th>
                  <th className="p-3 font-medium">Model</th>
                  <th className="p-3 font-medium">Tokens</th>
                  <th className="p-3 font-medium">Cost</th>
                  <th className="p-3 font-medium">Latency</th>
                  <th className="p-3 font-medium">Success</th>
                  <th className="p-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.length === 0 && (
                  <tr>
                    <td className="p-3 text-xs text-ink-muted" colSpan={7}>
                      No runs yet.
                    </td>
                  </tr>
                )}
                {data.recentRuns.map((r) => (
                  <tr key={r.id} className="border-b border-hairline">
                    <td className="p-3 text-ink">{AGENT_LABELS[r.agent] ?? r.agent}</td>
                    <td className="p-3 font-mono text-xs text-ink">{r.model}</td>
                    <td className="p-3 text-xs text-ink">
                      {r.inputTokens != null && r.outputTokens != null
                        ? `${r.inputTokens.toLocaleString()} in / ${r.outputTokens.toLocaleString()} out`
                        : "—"}
                    </td>
                    <td className="p-3 text-xs text-ink">
                      {r.costUsd != null ? `$${r.costUsd.toFixed(4)}` : "—"}
                    </td>
                    <td className="p-3 text-xs text-ink">{r.latencyMs.toLocaleString()}ms</td>
                    <td className="p-3">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          r.success ? "bg-positive" : "bg-danger"
                        }`}
                        title={r.error ?? undefined}
                      />
                    </td>
                    <td className="p-3 text-xs text-ink-muted">
                      {r.createdAt.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
