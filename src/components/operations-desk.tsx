"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  FACT_LABELS,
  type Brief,
  type Environment,
  type Source,
  type Workspace,
} from "@/lib/operations/types";
import { CSV_TEMPLATE } from "@/lib/operations/import-template";
import { evidenceFacts } from "@/lib/operations/evidence";
import "./operations.css";

type Command = Record<string, unknown>;
const labels = {
  gmail: "Email",
  whatsapp: "WhatsApp",
  csv: "Spreadsheet",
  mews: "Property API",
  travefy: "Itinerary",
};
const envLabel = {
  synthetic: "Synthetic fixture",
  sandbox: "Sandbox data",
  live: "Live / uploaded",
};
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`ops-badge ${tone}`}>{children}</span>;
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function OperationsDesk() {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [view, setView] = useState<"desk" | "imports" | "activity">("desk");
  const [tripId, setTripId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [environment, setEnvironment] = useState<Environment>("live");
  const [notice, setNotice] = useState("");
  async function refresh() {
    try {
      const res = await fetch("/api/operations");
      if (!res.ok)
        throw new Error(
          "Could not open the workspace. Check access configuration and persistent storage.",
        );
      setData(await res.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace unavailable");
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/operations")
      .then(async (res) => {
        if (!res.ok)
          throw new Error(
            "Could not open the workspace. Check access configuration and persistent storage.",
          );
        return res.json();
      })
      .then((next) => {
        if (active) setData(next);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Workspace unavailable");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!sourceId) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".ops-inspector");
    dialog?.querySelector<HTMLButtonElement>(".ops-close")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSourceId("");
      if (e.key !== "Tab" || !dialog) return;
      const nodes = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select, textarea:not(:disabled), summary, a[href]",
        ),
      ].filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [sourceId]);
  async function run(command: Command) {
    setBusy(String(command.action));
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!res.headers.get("content-type")?.includes("application/json"))
        throw new Error((await res.text()).slice(0, 600) || "Operation failed");
      const next: Workspace & { error?: string } = await res.json();
      if (!res.ok) throw new Error(next.error || "Operation failed");
      setData(next);
      setNotice(
        next.pipeline
          ? `Analysis finished: ${next.pipeline.completed} extracted, ${next.pipeline.skipped} already processed, ${next.pipeline.failed} need retry. Trip details and checks updated.`
          : command.action === "review"
            ? "Review saved. No message sent and no booking changed."
            : "Workspace updated.",
      );
      if (
        command.action === "sample" ||
        command.action === "extractionSample" ||
        command.action === "createTrip"
      )
        setView("desk");
      if (command.action === "extractionSample") {
        setTripId(
          next.trips.find(
            (t) =>
              t.reference === "AT-JP-270314" && t.environment === "synthetic",
          )?.id || "",
        );
        if (next.aiAvailable && next.importedSourceIds?.length)
          return await run({
            action: "analyze",
            sourceIds: next.importedSourceIds.slice(0, 12),
          });
        setNotice(
          "Raw supplier emails, PDF and WhatsApp samples loaded. Configure model access to extract their details; no facts have been pre-filled.",
        );
      }
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Operation failed. Please retry.",
      );
      return false;
    } finally {
      setBusy("");
    }
  }
  const trip = data?.trips.find((t) => t.id === tripId) || data?.trips[0];
  const sources = data?.sources.filter((s) => s.tripId === trip?.id) || [];
  const unassigned = data?.sources.filter((s) => !s.tripId) || [];
  const selectedSource = data?.sources.find((s) => s.id === sourceId);
  const brief = data?.briefs.find((b) => b.tripId === trip?.id);
  const analysisIds =
    data?.sources
      .filter(
        (s) =>
          s.environment === trip?.environment &&
          (s.tripId === trip?.id || !s.tripId) &&
          !s.facts.length &&
          (!s.extraction || s.extractionError),
      )
      .slice(0, 12)
      .map((s) => s.id) || [];
  const busyNow = Boolean(busy);
  const form = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };

  return (
    <div className="ops-app">
      <aside className="ops-sidebar">
        <Link className="ops-brand" href="/operations">
          analogue<span>THE ADVISOR’S BACK OFFICE</span>
        </Link>
        <div className="ops-workspace-label">
          <span className="ops-dot" /> Private agency workspace
        </div>
        <nav aria-label="Workspace navigation">
          <button
            className={view === "desk" ? "active" : ""}
            onClick={() => setView("desk")}
          >
            <span>◫</span> Conversation desk{" "}
            <small>{data?.trips.length || 0}</small>
          </button>
          <button
            className={view === "imports" ? "active" : ""}
            onClick={() => setView("imports")}
          >
            <span>↙</span> Sources & imports
          </button>
          <button
            className={view === "activity" ? "active" : ""}
            onClick={() => setView("activity")}
          >
            <span>◷</span> Activity history
          </button>
        </nav>
        <div className="ops-sidebar-section">
          <span>TRIP WORKSPACES</span>
          <button aria-label="Create a trip" onClick={() => setView("imports")}>
            +
          </button>
        </div>
        <div className="ops-trip-list">
          {data?.trips.map((t) => (
            <button
              key={t.id}
              className={trip?.id === t.id ? "selected" : ""}
              onClick={() => {
                setTripId(t.id);
                setSourceId("");
                setView("desk");
              }}
            >
              <strong>{t.title}</strong>
              <span>{envLabel[t.environment]}</span>
            </button>
          ))}
        </div>
        <div className="ops-sidebar-bottom">
          <div className="ops-avatar">A</div>
          <div>
            Agency pilot<span>Local, persistent workspace</span>
          </div>
        </div>
      </aside>

      <div className="ops-main">
        <header className="ops-topbar">
          <span>
            Workspace <span className="ops-slash">/</span>{" "}
            {view === "desk"
              ? "Conversation desk"
              : view === "imports"
                ? "Sources & imports"
                : "Activity history"}
          </span>
          <Badge tone="green">Read & prepare only</Badge>
        </header>
        <main className="ops-content">
          <div className="ops-heading">
            <div>
              <div className="ops-eyebrow">LESS CHASING. MORE CONTEXT.</div>
              <h1>
                {view === "desk"
                  ? "Every conversation, connected."
                  : view === "imports"
                    ? "Start with the original."
                    : "A record of every step."}
              </h1>
              <p>
                {view === "desk"
                  ? "Bring client requests and supplier details into one reviewable trip record."
                  : view === "imports"
                    ? "Emails, attachments and messages are the evidence. Integrations add context."
                    : "Imports and internal reviews are recorded separately from external actions."}
              </p>
            </div>
            <button
              className="ops-button primary"
              onClick={() => setView(view === "imports" ? "desk" : "imports")}
            >
              {view === "imports" ? "Back to desk" : "+ Add evidence"}
            </button>
          </div>
          {error && (
            <div className="ops-alert error" role="alert">
              <strong>Couldn’t complete that step.</strong> {error}{" "}
              <button onClick={() => void refresh()}>Refresh workspace</button>
            </div>
          )}
          {notice && (
            <p className="ops-notice" role="status">
              {notice}
            </p>
          )}
          {busy && (
            <p className="ops-notice" role="status">
              {busy === "analyze"
                ? "Reading evidence with AI… connecting trip details and checking gaps. Each completed source is saved; this can take a minute."
                : `Working on ${busy}… Your evidence stays available.`}
            </p>
          )}
          {!data && !error && (
            <div className="ops-empty" role="status">
              Opening your workspace…
            </div>
          )}

          {view === "desk" && data && (
            <>
              <div className="ops-stats">
                <div>
                  <span>Linked sources</span>
                  <strong>{sources.length.toString().padStart(2, "0")}</strong>
                  <small>for this trip</small>
                </div>
                <div>
                  <span>Needs matching</span>
                  <strong>
                    {unassigned.length.toString().padStart(2, "0")}
                  </strong>
                  <small>waiting for a trip</small>
                </div>
                <div>
                  <span>Review checks</span>
                  <strong>
                    {(brief?.issues.length || 0).toString().padStart(2, "0")}
                  </strong>
                  <small>
                    {brief
                      ? "in latest handoff"
                      : "prepare a handoff to assess"}
                  </small>
                </div>
                <div>
                  <span>External actions</span>
                  <strong>00</strong>
                  <small>sending & booking disabled</small>
                </div>
              </div>
              {!trip ? (
                <div className="ops-empty">
                  <div className="ops-empty-mark">↙</div>
                  <h2>Your next trip starts with a conversation.</h2>
                  <p>
                    Upload an email with its attachments, create a trip
                    workspace, then connect the evidence. Or explore a clearly
                    labeled synthetic example.
                  </p>
                  <div className="ops-row">
                    <button
                      disabled={busyNow}
                      className="ops-button primary"
                      onClick={() => setView("imports")}
                    >
                      Import a conversation
                    </button>
                    <button
                      disabled={busyNow}
                      className="ops-button"
                      onClick={() => void run({ action: "extractionSample" })}
                    >
                      Try email + PDF + WhatsApp sample
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="ops-trip-heading">
                    <div>
                      <Badge
                        tone={trip.environment === "live" ? "green" : "amber"}
                      >
                        {envLabel[trip.environment]}
                      </Badge>
                      <h2>{trip.title}</h2>
                      <p>
                        {trip.traveler} <span>·</span> {trip.reference}
                      </p>
                    </div>
                    <div className="ops-row">
                      <button
                        disabled={
                          busyNow || !data.aiAvailable || !analysisIds.length
                        }
                        className="ops-button primary"
                        onClick={() =>
                          void run({
                            action: "analyze",
                            sourceIds: analysisIds,
                          })
                        }
                      >
                        Analyze evidence
                        {analysisIds.length ? ` (${analysisIds.length})` : ""}
                      </button>
                      <button
                        disabled={busyNow || !sources.length}
                        className="ops-button"
                        onClick={() =>
                          void run({ action: "prepare", tripId: trip.id })
                        }
                      >
                        Prepare internal handoff <span>↗</span>
                      </button>
                    </div>
                  </div>
                  {trip.environment !== "live" && (
                    <div className="ops-environment">
                      {trip.environment === "synthetic"
                        ? "This is a synthetic scenario. Names, messages and reservations are invented; no provider supplied these records."
                        : "Sandbox workspace. Check each source’s provider and provenance; these records do not establish real client bookings."}
                    </div>
                  )}
                  {!data.aiAvailable && (
                    <div className="ops-environment">
                      AI is not connected yet. Configure the extraction model
                      using the project setup guide, restart the server, then
                      analyze. Raw evidence is saved; no extracted answers are
                      simulated.
                    </div>
                  )}
                  <section className="ops-panel ops-details">
                    <div className="ops-panel-title">
                      <h3>Trip details from evidence</h3>
                      <span>Source-linked · provisional until reviewed</span>
                    </div>
                    <p className="ops-section-note">
                      AI reads the conversations and attachments. Requested
                      changes stay separate from supplier assertions. Unmatched
                      sources in this environment are included in analysis.
                    </p>
                    <div className="ops-facts-grid">
                      {Object.entries(FACT_LABELS).map(([key, label]) => {
                        const entries = sources.flatMap((s) =>
                          evidenceFacts(s)
                            .filter((f) => f.key === key)
                            .map((f) => ({ ...f, source: s })),
                        );
                        return (
                          <div className="ops-fact-cell" key={key}>
                            <h4>{label}</h4>
                            {!entries.length && (
                              <span className="ops-fact-missing">
                                Not supplied
                              </span>
                            )}
                            {entries.map((f, i) => (
                              <button
                                className="ops-fact-value"
                                key={`${f.source.id}-${i}`}
                                onClick={() => setSourceId(f.source.id)}
                              >
                                <strong>{f.value}</strong>
                                <span>
                                  {f.serviceRef ? `${f.serviceRef} · ` : ""}
                                  {f.kind === "request"
                                    ? "Requested, not confirmed"
                                    : f.kind === "unknown"
                                      ? "Still unknown"
                                      : "Source assertion"}
                                </span>
                                <small>
                                  {f.provisional ? "AI proposal" : "Recorded"} ·{" "}
                                  {labels[f.source.provider]} ↗
                                </small>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <div className="ops-desk-grid">
                    <section className="ops-panel">
                      <div className="ops-panel-title">
                        <h3>Conversation & evidence</h3>
                        <span>{sources.length} sources</span>
                      </div>
                      <p className="ops-section-note">
                        Open a source to read the original, review proposed
                        details, or change its trip link.
                      </p>
                      <div className="ops-source-list">
                        {sources.map((s) => (
                          <button
                            key={s.id}
                            className={`ops-source-card ${s.id === sourceId ? "selected" : ""}`}
                            onClick={() => setSourceId(s.id)}
                          >
                            <div className="ops-row spread">
                              <Badge>{labels[s.provider]}</Badge>
                              <span className="ops-tiny">
                                {s.extractionError
                                  ? "Extraction failed · retry"
                                  : s.extraction?.status === "proposed"
                                    ? `${s.extraction.facts.length} AI fields · provisional`
                                    : s.facts.length
                                      ? `${s.facts.length} recorded fields`
                                      : "Unstructured"}
                              </span>
                            </div>
                            <strong>{s.title}</strong>
                            <p>
                              {s.content.replace(/\s+/g, " ").slice(0, 145)}
                              {s.content.length > 145 ? "…" : ""}
                            </p>
                            <span className="ops-source-footer">
                              {s.occurredAt
                                ? date(s.occurredAt)
                                : "Original time unknown"}{" "}
                              <span>Read source ↗</span>
                            </span>
                          </button>
                        ))}
                      </div>
                      {!sources.length && (
                        <p className="ops-section-note">
                          No linked evidence yet. Import an email or match a
                          source below.
                        </p>
                      )}
                    </section>
                    <section className="ops-panel ops-handoff">
                      <div className="ops-panel-title">
                        <h3>Review & handoff</h3>
                        <span>Internal only</span>
                      </div>
                      {brief ? (
                        <BriefReview
                          key={brief.id}
                          brief={brief}
                          busy={busyNow}
                          run={run}
                        />
                      ) : (
                        <div className="ops-handoff-empty">
                          <span>✧</span>
                          <h3>From scattered detail to a clear next step.</h3>
                          <p>
                            Prepare a handoff to compare recorded facts, surface
                            missing details, and create a follow-up checklist
                            with source references.
                          </p>
                          <p className="ops-tiny">
                            AI extraction is{" "}
                            {data.aiAvailable
                              ? "configured — review proposals in each source"
                              : "not configured. Connect a model to populate details automatically"}
                            .
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
              {unassigned.length > 0 && (
                <section className="ops-panel ops-unassigned">
                  <div className="ops-panel-title">
                    <h3>Needs a trip match</h3>
                    <Badge tone="amber">{unassigned.length} to review</Badge>
                  </div>
                  {unassigned.map((s) => (
                    <button key={s.id} onClick={() => setSourceId(s.id)}>
                      <div>
                        <strong>{s.title}</strong>
                        <span>{s.linkReason}</span>
                      </div>
                      <span>Review & link ↗</span>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}

          {view === "imports" && data && (
            <div className="ops-import-grid">
              <section className="ops-panel ops-form">
                <div className="ops-panel-title">
                  <h3>01 / Import a conversation</h3>
                  <Badge>Start here</Badge>
                </div>
                <p>
                  Export an original email as <strong>.eml</strong> to include
                  headers and attachments. Text and PDF pages are extracted;
                  scans and voice notes stay flagged for review.
                </p>
                <label>
                  Data environment
                  <select
                    value={environment}
                    onChange={(e) =>
                      setEnvironment(e.target.value as Environment)
                    }
                  >
                    <option value="live">
                      Authorized real data / uploaded export
                    </option>
                    <option value="synthetic">Synthetic test fixture</option>
                    <option value="sandbox">Official sandbox export</option>
                  </select>
                </label>
                <label className="ops-upload">
                  Choose .eml or .csv file
                  <input
                    type="file"
                    accept=".eml,.csv"
                    disabled={busyNow}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1_000_000) {
                        setError("Choose a file under 1 MB.");
                        return;
                      }
                      const content = await file.text();
                      await run({
                        action: file.name.toLowerCase().endsWith(".eml")
                          ? "eml"
                          : "csv",
                        filename: file.name,
                        content,
                        environment,
                      });
                      e.target.value = "";
                    }}
                  />
                  <span>1 MB maximum · PDF: 20 pages per attachment</span>
                </label>
                <div className="ops-row">
                  <button
                    className="ops-text-button"
                    onClick={() =>
                      download("reservation-template.csv", CSV_TEMPLATE)
                    }
                  >
                    Download CSV headers ↓
                  </button>
                  <button
                    disabled={busyNow}
                    className="ops-text-button"
                    onClick={() => void run({ action: "extractionSample" })}
                  >
                    Try email + PDF + WhatsApp sample
                  </button>
                </div>
                <p className="ops-tiny">
                  <a
                    className="ops-text-button"
                    href="/examples/extraction/ryokan-confirmation.eml"
                    download
                  >
                    Download supplier email with PDF voucher ↓
                  </a>
                  <br />
                  Choose “Synthetic test fixture” when importing this example.
                </p>
                <p className="ops-tiny">
                  Only import data you are authorized to use. The environment
                  label is your declaration for uploaded files.
                </p>
              </section>
              <section className="ops-panel ops-form">
                <div className="ops-panel-title">
                  <h3>02 / Create a trip workspace</h3>
                  <Badge>No booking created</Badge>
                </div>
                <form
                  onSubmit={(e) => {
                    const values = form(e);
                    void run({ action: "createTrip", ...values });
                  }}
                >
                  <div className="ops-field-pair">
                    <label>
                      Trip reference
                      <input
                        name="reference"
                        required
                        placeholder="JAPAN-2027-01"
                        pattern="[A-Za-z0-9_-]+"
                      />
                    </label>
                    <label>
                      Environment
                      <select name="environment">
                        <option value="live">Live / uploaded</option>
                        <option value="synthetic">Synthetic</option>
                        <option value="sandbox">Sandbox</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Trip title
                    <input
                      name="title"
                      required
                      placeholder="Kyoto & Naoshima · spring journey"
                    />
                  </label>
                  <label>
                    Lead traveler
                    <input
                      name="traveler"
                      required
                      placeholder="Traveler name"
                    />
                  </label>
                  <div className="ops-field-pair">
                    <label>
                      Email
                      <input name="email" type="email" placeholder="Optional" />
                    </label>
                    <label>
                      WhatsApp phone
                      <input
                        name="phone"
                        placeholder="+12025550123"
                        pattern="\+[1-9][0-9]{6,14}|^$"
                      />
                    </label>
                  </div>
                  <button disabled={busyNow} className="ops-button primary">
                    Create workspace
                  </button>
                </form>
                <p className="ops-tiny">
                  Exact email or phone matches help connect client messages.
                  Supplier emails without a unique trip reference remain in the
                  matching queue.
                </p>
              </section>
              <section className="ops-panel ops-form">
                <div className="ops-panel-title">
                  <h3>Connected sources</h3>
                  <Badge>Read access only</Badge>
                </div>
                {data.integrations.map((i) => (
                  <div className="ops-integration" key={i.id}>
                    <div className="ops-row spread">
                      <strong>{i.name}</strong>
                      <Badge>{i.status}</Badge>
                    </div>
                    <p>{i.detail}</p>
                    <a href={i.docs} target="_blank" rel="noreferrer">
                      Setup documentation ↗
                    </a>
                    {i.id === "gmail" && (
                      <form
                        className="ops-inline-form"
                        onSubmit={(e) => {
                          const values = form(e);
                          void run({ action: "gmail", ...values });
                        }}
                      >
                        <input
                          name="threadId"
                          required
                          aria-label="Gmail API thread ID"
                          placeholder="Gmail API thread ID (hex)"
                        />
                        <button disabled={busyNow} className="ops-button">
                          Read thread
                        </button>
                      </form>
                    )}
                    {i.id === "travefy" && (
                      <form
                        className="ops-inline-form"
                        onSubmit={(e) => {
                          const values = form(e);
                          void run({ action: "travefy", ...values });
                        }}
                      >
                        <input
                          name="reference"
                          required
                          aria-label="Travefy partner identifier"
                          placeholder="Exact partner identifier"
                        />
                        <button disabled={busyNow} className="ops-button">
                          Read trip
                        </button>
                      </form>
                    )}
                    {i.id === "mews" && (
                      <button
                        disabled={busyNow}
                        className="ops-button"
                        onClick={() => void run({ action: "mews" })}
                      >
                        Read official demo reservations
                      </button>
                    )}
                  </div>
                ))}
              </section>
              <section className="ops-panel ops-principles">
                <div className="ops-eyebrow">HOW THE DESK WORKS</div>
                <h2>
                  Evidence first.
                  <br />
                  Judgment stays with you.
                </h2>
                <ol>
                  <li>
                    <strong>Collect the original.</strong>
                    <p>
                      Retain sender, timestamp, message ID, attachment page and
                      import provenance.
                    </p>
                  </li>
                  <li>
                    <strong>Connect carefully.</strong>
                    <p>
                      Use exact references or a unique contact match. Review
                      ambiguous messages yourself.
                    </p>
                  </li>
                  <li>
                    <strong>Review extracted details.</strong>
                    <p>
                      AI fields are proposals with exact excerpts. Approving
                      them records your interpretation, not supplier
                      fulfillment.
                    </p>
                  </li>
                  <li>
                    <strong>Prepare the next step.</strong>
                    <p>
                      Compare evidence and approve an internal handoff. No
                      messages or booking changes are sent.
                    </p>
                  </li>
                </ol>
              </section>
            </div>
          )}
          {view === "activity" && data && (
            <section className="ops-panel">
              <div className="ops-panel-title">
                <h3>Workspace history</h3>
                <Badge>{data.activity.length} events</Badge>
              </div>
              {!data.activity.length && (
                <p className="ops-section-note">
                  Your imports and reviews will appear here.
                </p>
              )}
              <ol className="ops-timeline">
                {data.activity.map((a) => (
                  <li key={a.id}>
                    <span className="ops-timeline-dot" />
                    <div>
                      <strong>{a.kind}</strong>
                      <p>{a.detail}</p>
                      <time>{date(a.at)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <footer className="ops-footer">
            Built for the work between the conversations.
            <span>No outbound delivery or booking writes enabled.</span>
          </footer>
        </main>
      </div>
      {selectedSource && data && (
        <div className="ops-inspector-backdrop" onClick={() => setSourceId("")}>
          <aside
            className="ops-inspector"
            role="dialog"
            aria-modal="true"
            aria-label="Source review"
            onClick={(e) => e.stopPropagation()}
          >
            <SourceReview
              key={`${selectedSource.id}:${selectedSource.extraction?.createdAt || ""}`}
              record={selectedSource}
              error={error}
              data={data}
              run={run}
              busy={busyNow}
              close={() => setSourceId("")}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function BriefReview({
  brief,
  busy,
  run,
}: {
  brief: Brief;
  busy: boolean;
  run: (c: Command) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(brief.draft);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [exportError, setExportError] = useState("");
  const [evidenceId, openSource] = useState("");
  const evidence = brief.evidence.find((s) => s.id === evidenceId);
  return (
    <div className="ops-brief">
      <div className="ops-row spread">
        <Badge tone={brief.status === "approved" ? "green" : "amber"}>
          {brief.status === "approved"
            ? "Approved internal handoff"
            : brief.status === "proposed"
              ? "Proposed · needs review"
              : "Dismissed"}
        </Badge>
        <span className="ops-tiny">Not sent</span>
      </div>
      <p className="ops-tiny">
        {brief.engine} · {date(brief.createdAt)}
      </p>
      {brief.stale && (
        <div className="ops-alert" role="status">
          Evidence changed since this handoff. Prepare and review a fresh one
          before exporting.
        </div>
      )}
      {evidence && (
        <div className="ops-source-original">
          <div className="ops-row spread">
            <strong>Evidence snapshot · {evidence.title}</strong>
            <button className="ops-text-button" onClick={() => openSource("")}>
              Close snapshot
            </button>
          </div>
          <p className="ops-tiny ops-break">
            {evidence.locator} · captured with this handoff
          </p>
          <pre>{evidence.content}</pre>
          {evidenceFacts(evidence).map((f, i) => (
            <p className="ops-tiny" key={i}>
              {FACT_LABELS[f.key]}: {f.value} — “{f.excerpt}”
            </p>
          ))}
        </div>
      )}
      <details open>
        <summary>Open checks ({brief.issues.length})</summary>
        <div className="ops-checks">
          {brief.issues.map((i) => (
            <div key={i.id} className={`ops-check ${i.severity}`}>
              <span>{i.severity === "blocker" ? "!" : "·"}</span>
              <div>
                <strong>{i.title}</strong>
                <p>{i.detail}</p>
                {i.sourceIds.map((s, j) => (
                  <button key={`${s}-${j}`} onClick={() => openSource(s)}>
                    Source {j + 1} ↗
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary>Evidence summary</summary>
        {brief.paragraphs.map((p, i) => (
          <p className="ops-summary" key={i}>
            {p.text}{" "}
            {p.sourceIds.map((s) => (
              <button key={s} onClick={() => openSource(s)}>
                Read source ↗
              </button>
            ))}
          </p>
        ))}
      </details>
      <label className="ops-draft-label">
        Internal handoff / proposed follow-up
        <textarea
          aria-label="Handoff draft"
          rows={9}
          value={draft}
          disabled={brief.status !== "proposed"}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      {brief.status === "proposed" ? (
        <>
          <label className="ops-draft-label">
            Review note
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Acknowledge unresolved items and who should follow up."
            />
          </label>
          <label className="ops-checkbox">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />{" "}
            I reviewed the evidence and open checks. This approves an internal
            handoff only.
          </label>
          <div className="ops-row">
            <button
              disabled={
                busy || brief.stale || !ack || !note.trim() || !draft.trim()
              }
              className="ops-button primary"
              onClick={() =>
                void run({
                  action: "review",
                  briefId: brief.id,
                  decision: "approved",
                  note,
                  draft,
                })
              }
            >
              Approve handoff
            </button>
            <button
              disabled={busy || !note.trim()}
              className="ops-button"
              onClick={() =>
                void run({
                  action: "review",
                  briefId: brief.id,
                  decision: "dismissed",
                  note,
                  draft,
                })
              }
            >
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ops-tiny">Review: {brief.reviewNote}</p>
          {brief.status === "approved" && (
            <button
              className="ops-button"
              disabled={brief.stale}
              onClick={async () => {
                const res = await fetch(`/api/operations?export=${brief.id}`);
                if (!res.ok) {
                  const body = await res.json();
                  setExportError(body.error);
                  return;
                }
                download(`handoff-${brief.id}.json`, await res.text());
              }}
            >
              Download approved handoff ↓
            </button>
          )}
          {exportError && (
            <p role="alert" className="ops-export-error">
              {exportError}
            </p>
          )}
        </>
      )}
      <p className="ops-tiny">
        New evidence or reviewed fields require a fresh handoff. Approval does
        not resolve a booking conflict.
      </p>
    </div>
  );
}

function SourceReview({
  record,
  error,
  data,
  run,
  busy,
  close,
}: {
  record: Source;
  error: string;
  data: Workspace;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
  close: () => void;
}) {
  const [link, setLink] = useState(record.tripId || "");
  const [linkNote, setLinkNote] = useState("");
  const [key, setKey] = useState<keyof typeof FACT_LABELS>("specialRequests");
  const [value, setValue] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [note, setNote] = useState("");
  return (
    <>
      <div className="ops-inspector-header">
        <div>
          <Badge>{labels[record.provider]}</Badge>{" "}
          <Badge tone="amber">{envLabel[record.environment]}</Badge>
        </div>
        <button
          className="ops-close"
          aria-label="Close source review"
          onClick={close}
        >
          ×
        </button>
      </div>
      <h2>{record.title}</h2>
      <p className="ops-tiny ops-break">{record.locator}</p>
      <p className="ops-tiny">
        Original: {record.occurredAt ? date(record.occurredAt) : "unknown"}
        <br />
        Imported: {date(record.retrievedAt)}
        <br />
        Content fingerprint: {record.digest.slice(0, 16)}
      </p>
      <div className="ops-source-original">
        <h3>Original source text</h3>
        <pre>{record.content}</pre>
      </div>
      {record.warnings.map((warning, i) => (
        <p className="ops-source-warning" key={i}>
          {warning}
        </p>
      ))}
      <section className="ops-inspector-section">
        <h3>Trip connection</h3>
        <p>{record.linkReason}</p>
        <label>
          Trip
          <select value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">Choose a trip</option>
            {data.trips
              .filter((t) => t.environment === record.environment)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Why these records belong together
          <input
            value={linkNote}
            onChange={(e) => setLinkNote(e.target.value)}
            placeholder="e.g. supplier reference verified in original confirmation"
          />
        </label>
        <button
          disabled={busy || !link || !linkNote.trim()}
          className="ops-button"
          onClick={() =>
            void run({
              action: "link",
              sourceId: record.id,
              tripId: link,
              note: linkNote,
            })
          }
        >
          Save trip link
        </button>
      </section>
      <section className="ops-inspector-section">
        <div className="ops-row spread">
          <h3>Interpret the conversation</h3>
          <button
            disabled={busy || !data.aiAvailable}
            className="ops-button"
            onClick={() => void run({ action: "extract", sourceId: record.id })}
          >
            Propose fields with AI
          </button>
        </div>
        <p>
          {data.aiAvailable
            ? "AI receives this source’s text. Quoted proposals automatically populate trip details and checks; review before relying on them."
            : "Connect the model in .env.local to extract details automatically."}
        </p>
        {record.extractionError && (
          <p className="ops-alert error" role="alert">
            {record.extractionError}
          </p>
        )}
        {record.extraction && (
          <div className="ops-extraction">
            <Badge tone="amber">
              {record.extraction.status} · {record.extraction.engine}
            </Badge>
            {record.extraction.facts.length === 0 && (
              <p>No supported facts extracted. Review the original manually.</p>
            )}
            {record.extraction.facts.map((f, i) => (
              <div key={i}>
                <strong>
                  {FACT_LABELS[f.key]}: {f.value}
                </strong>
                <p className="ops-tiny">
                  {f.serviceRef || "Service unspecified"} ·{" "}
                  {f.kind || "assertion"} · AI proposal
                </p>
                <blockquote>{f.excerpt}</blockquote>
              </div>
            ))}
            {record.extraction.status === "proposed" &&
              record.extraction.facts.length > 0 && (
                <>
                  <label>
                    Review note
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Checked each proposed fact against its excerpt"
                    />
                  </label>
                  <button
                    disabled={busy || !note.trim()}
                    className="ops-button"
                    onClick={() =>
                      void run({
                        action: "acceptFacts",
                        sourceId: record.id,
                        digest: record.digest,
                        facts: record.extraction!.facts,
                        note,
                      })
                    }
                  >
                    Accept reviewed fields
                  </button>
                  <button
                    disabled={busy || !note.trim()}
                    className="ops-button"
                    onClick={() =>
                      void run({
                        action: "dismissExtraction",
                        sourceId: record.id,
                        digest: record.digest,
                        note,
                      })
                    }
                  >
                    Dismiss AI proposal
                  </button>
                  <p className="ops-tiny">
                    If any field is wrong, record only the correct fields
                    manually below.
                  </p>
                </>
              )}
          </div>
        )}
        <details>
          <summary>Record a fact manually</summary>
          <label>
            Field
            <select
              value={key}
              onChange={(e) =>
                setKey(e.target.value as keyof typeof FACT_LABELS)
              }
            >
              {Object.entries(FACT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Value
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Preserve requests, conditions and uncertainty"
            />
          </label>
          <label>
            Exact excerpt from original
            <textarea
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Copy the words that support this fact"
            />
          </label>
          <label>
            Review note
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button
            disabled={
              busy || !value.trim() || excerpt.length < 6 || !note.trim()
            }
            className="ops-button primary"
            onClick={() =>
              void run({
                action: "acceptFacts",
                sourceId: record.id,
                digest: record.digest,
                facts: [{ key, value, excerpt }],
                note,
              })
            }
          >
            Record reviewed fact
          </button>
        </details>
      </section>
      <section className="ops-inspector-section">
        <h3>Recorded fields</h3>
        {error && (
          <p className="ops-alert" role="alert">
            {error}
          </p>
        )}
        {!record.facts.length && (
          <p>
            No structured facts recorded. The original message is still
            retained.
          </p>
        )}
        {record.facts.map((f, i) => (
          <div className="ops-recorded-fact" key={i}>
            <strong>
              {FACT_LABELS[f.key]}: {f.value}
            </strong>
            <blockquote>{f.excerpt}</blockquote>
          </div>
        ))}
      </section>
    </>
  );
}
