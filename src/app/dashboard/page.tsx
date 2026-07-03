import Link from "next/link";
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
    <main className="mx-auto max-w-5xl p-6">
      <Link href="/inbox" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Inbox
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Agent telemetry, evals, and draft quality</p>
      </header>

      <div className="space-y-6">
        {/* Stat cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">Total agent runs</p>
            <p className="text-2xl font-semibold mt-1">{data.totalRuns}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">Success rate</p>
            <p className="text-2xl font-semibold mt-1">
              {data.successRate != null ? `${(data.successRate * 100).toFixed(0)}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">Total cost</p>
            <p className="text-2xl font-semibold mt-1">${data.totalCost.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">Median latency</p>
            <p className="text-2xl font-semibold mt-1">
              {data.medianLatency != null ? `${Math.round(data.medianLatency).toLocaleString()}ms` : "—"}
            </p>
          </div>
        </section>

        {/* Per-agent table */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <header className="border-b border-zinc-200 dark:border-zinc-800 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Per-agent
            </h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
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
                    <td className="p-3 text-xs text-zinc-400" colSpan={7}>
                      No agent runs yet.
                    </td>
                  </tr>
                )}
                {data.perAgent.map((a) => (
                  <tr key={a.agent} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="p-3 font-medium">{AGENT_LABELS[a.agent] ?? a.agent}</td>
                    <td className="p-3">{a.runs}</td>
                    <td className="p-3">{a.successPct.toFixed(0)}%</td>
                    <td className="p-3">
                      {a.avgInputTokens != null ? Math.round(a.avgInputTokens).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">
                      {a.avgOutputTokens != null ? Math.round(a.avgOutputTokens).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">${a.totalCost.toFixed(2)}</td>
                    <td className="p-3">
                      {a.medianLatency != null ? `${Math.round(a.medianLatency).toLocaleString()}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Draft lifecycle */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
            Draft lifecycle
          </h2>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-zinc-500">By status</p>
              <p className="text-sm mt-1">
                {Object.keys(data.lifecycle.counts).length === 0
                  ? "No drafts yet"
                  : Object.entries(data.lifecycle.counts)
                      .map(([status, n]) => `${status}: ${n}`)
                      .join(" · ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Acceptance rate</p>
              <p className="text-sm mt-1">
                {data.lifecycle.acceptanceRate != null
                  ? `${(data.lifecycle.acceptanceRate * 100).toFixed(0)}%`
                  : "n/a — no approved/dismissed drafts yet"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Mean edit distance</p>
              <p className="text-sm mt-1">
                {data.lifecycle.meanEditDistance != null
                  ? `${data.lifecycle.meanEditDistance.toFixed(3)} (n=${data.lifecycle.editedSampleSize})`
                  : "n/a — no edited approved drafts yet"}
              </p>
            </div>
          </div>
        </section>

        {/* Latest evals */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
            Latest evals
          </h2>
          <div className="space-y-4">
            {data.latestEvals.map(({ suite, runId, cases }) => (
              <div key={suite}>
                <p className="text-sm font-medium">{suite}</p>
                {cases.length === 0 ? (
                  <p className="text-xs text-zinc-400 mt-1">
                    No eval runs yet — npm run {suite === "parse_golden" ? "eval:parse" : "eval:grounding"}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-zinc-400 mt-0.5">run {runId}</p>
                    <ul className="mt-2 space-y-1">
                      {cases.map((c) => (
                        <li key={c.id} className="text-xs flex items-start gap-2">
                          <span
                            className={`mt-1 inline-block h-2 w-2 rounded-full shrink-0 ${
                              c.pass ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          <span className="font-mono">{c.caseName}</span>
                          {c.score != null && (
                            <span className="text-zinc-500">score {c.score.toFixed(2)}</span>
                          )}
                          {c.detail && (
                            <span className="text-zinc-500 truncate max-w-md">
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
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <header className="border-b border-zinc-200 dark:border-zinc-800 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Recent runs
            </h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
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
                    <td className="p-3 text-xs text-zinc-400" colSpan={7}>
                      No runs yet.
                    </td>
                  </tr>
                )}
                {data.recentRuns.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="p-3">{AGENT_LABELS[r.agent] ?? r.agent}</td>
                    <td className="p-3 font-mono text-xs">{r.model}</td>
                    <td className="p-3 text-xs">
                      {r.inputTokens != null && r.outputTokens != null
                        ? `${r.inputTokens.toLocaleString()} in / ${r.outputTokens.toLocaleString()} out`
                        : "—"}
                    </td>
                    <td className="p-3 text-xs">{r.costUsd != null ? `$${r.costUsd.toFixed(4)}` : "—"}</td>
                    <td className="p-3 text-xs">{r.latencyMs.toLocaleString()}ms</td>
                    <td className="p-3">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          r.success ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        title={r.error ?? undefined}
                      />
                    </td>
                    <td className="p-3 text-xs text-zinc-400">
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
    </main>
  );
}
