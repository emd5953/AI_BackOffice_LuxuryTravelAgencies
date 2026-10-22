import { z } from "zod";
import { accessError, mutationError, readLimited } from "@/lib/operations/auth";
import { readState, mutate } from "@/lib/operations/store";
import {
  event,
  fingerprint,
  ingest,
  prepareBrief,
  reviewBrief,
} from "@/lib/operations/core";
import { importCsv, syntheticExample, tripId } from "@/lib/operations/imports";
import { importEml } from "@/lib/operations/attachments";
import {
  integrations,
  readGmailThread,
  readMewsDemo,
  readTravefy,
} from "@/lib/operations/connectors";
import { aiAvailable, factSchema, validateFacts } from "@/lib/operations/ai";
import { analyzeSources, refreshBriefs } from "@/lib/operations/pipeline";
import { extractionExample } from "@/lib/operations/fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const environment = z.enum(["synthetic", "sandbox", "live"]);
const id = z.string().min(1).max(100);
const note = z.string().trim().min(1).max(2000);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sample") }),
  z.object({ action: z.literal("extractionSample") }),
  z.object({
    action: z.literal("analyze"),
    sourceIds: z.array(id).min(1).max(12),
  }),
  z.object({ action: z.literal("mews") }),
  z.object({
    action: z.literal("createTrip"),
    reference: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    title: z.string().trim().min(1).max(200),
    traveler: z.string().trim().min(1).max(150),
    email: z.union([z.email(), z.literal("")]),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$|^$/),
    environment,
  }),
  z.object({
    action: z.literal("csv"),
    content: z.string().max(500_000),
    filename: z.string().min(1).max(150),
    environment,
  }),
  z.object({
    action: z.literal("eml"),
    content: z.string().max(1_000_000),
    filename: z.string().min(1).max(150),
    environment,
  }),
  z.object({
    action: z.literal("gmail"),
    threadId: z.string().regex(/^[a-f0-9]{8,40}$/i),
  }),
  z.object({
    action: z.literal("travefy"),
    reference: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  }),
  z.object({ action: z.literal("link"), sourceId: id, tripId: id, note }),
  z.object({ action: z.literal("extract"), sourceId: id }),
  z.object({
    action: z.literal("dismissExtraction"),
    sourceId: id,
    digest: id,
    note,
  }),
  z.object({
    action: z.literal("acceptFacts"),
    sourceId: id,
    digest: id,
    facts: z.array(factSchema).min(1).max(25),
    note,
  }),
  z.object({ action: z.literal("prepare"), tripId: id }),
  z.object({
    action: z.literal("review"),
    briefId: id,
    decision: z.enum(["approved", "dismissed"]),
    note,
    draft: z.string().trim().min(1).max(20_000),
  }),
]);
function workspace() {
  const state = readState();
  for (const brief of state.briefs) {
    const trip = state.trips.find((t) => t.id === brief.tripId);
    brief.stale =
      !trip ||
      brief.fingerprint !==
        fingerprint(
          trip,
          state.sources.filter((s) => s.tripId === trip.id),
        );
  }
  return {
    ...state,
    integrations: integrations(),
    aiAvailable: aiAvailable(),
  };
}
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const denied = accessError(request);
  if (denied) return denied;
  try {
    const exportId = new URL(request.url).searchParams.get("export");
    if (!exportId) return json(workspace());
    const state = readState();
    const brief = state.briefs.find((b) => b.id === exportId);
    if (!brief || brief.status !== "approved")
      return json(
        { error: "Approve the internal handoff before exporting." },
        409,
      );
    const trip = state.trips.find((t) => t.id === brief.tripId)!;
    if (
      brief.fingerprint !==
      fingerprint(
        trip,
        state.sources.filter((s) => s.tripId === trip.id),
      )
    )
      return json(
        {
          error:
            "Evidence changed after approval. Prepare and review a fresh handoff.",
        },
        409,
      );
    return new Response(
      JSON.stringify(
        {
          purpose: "Internal handoff only. Not sent; no bookings modified.",
          trip,
          brief,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="handoff-${brief.id}.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return json(
      {
        error:
          "Workspace could not be read. Check persistent-disk access and OPS_DB_PATH.",
      },
      500,
    );
  }
}

export async function POST(request: Request) {
  const denied = mutationError(request);
  if (denied) return denied;
  let action = "Import";
  try {
    const c = command.parse(JSON.parse(await readLimited(request)));
    action = c.action;
    if (
      [
        "sample",
        "extractionSample",
        "mews",
        "csv",
        "eml",
        "gmail",
        "travefy",
      ].includes(c.action)
    ) {
      const result =
        c.action === "extractionSample"
          ? await extractionExample()
          : c.action === "sample"
            ? syntheticExample()
            : c.action === "mews"
              ? await readMewsDemo()
              : c.action === "csv"
                ? importCsv(c.content, c.filename, c.environment)
                : c.action === "eml"
                  ? await importEml(c.content, c.filename, c.environment)
                  : c.action === "gmail"
                    ? await readGmailThread(c.threadId)
                    : c.action === "travefy"
                      ? await readTravefy(c.reference)
                      : null;
      if (result) {
        mutate((state) => {
          ingest(state, result.sources, result.trips);
          refreshBriefs(state);
        });
        return json({
          ...workspace(),
          importedSourceIds: result.sources.map((s) => s.id),
        });
      }
    } else if (c.action === "extract" || c.action === "analyze") {
      if (!aiAvailable())
        return json(
          {
            error:
              "AI extraction is not configured. Add model credentials to .env.local and restart the server. Original sources are saved; no AI call was made.",
          },
          503,
        );
      const pipeline = await analyzeSources(
        c.action === "extract" ? [c.sourceId] : c.sourceIds,
        c.action === "extract",
      );
      return json({ ...workspace(), pipeline });
    } else
      mutate((state) => {
        if (c.action === "createTrip") {
          const trip = {
            id: tripId(c.environment, c.reference),
            reference: c.reference,
            title: c.title,
            traveler: c.traveler,
            email: c.email || undefined,
            phone: c.phone || undefined,
            environment: c.environment,
          };
          if (state.trips.some((t) => t.id === trip.id))
            throw new Error(
              "That trip reference already exists in this environment.",
            );
          ingest(state, [], [trip]);
          event(
            state,
            "Trip created",
            `${trip.reference} created by operator. No booking made.`,
            trip.id,
          );
        }
        if (c.action === "link") {
          const record = state.sources.find((s) => s.id === c.sourceId);
          const trip = state.trips.find((t) => t.id === c.tripId);
          if (!record || !trip || record.environment !== trip.environment)
            throw new Error(
              "Choose a trip in the same data environment as the source.",
            );
          record.tripId = trip.id;
          record.linkReason = `Operator: ${c.note}`;
          event(
            state,
            "Source linked",
            `${record.title} → ${trip.reference}. ${c.note}`,
            trip.id,
          );
        }
        if (c.action === "dismissExtraction") {
          const record = state.sources.find((s) => s.id === c.sourceId);
          if (
            !record ||
            record.digest !== c.digest ||
            record.extraction?.status !== "proposed"
          )
            throw new Error("No current extraction proposal to dismiss.");
          record.extraction.status = "dismissed";
          event(
            state,
            "AI proposal dismissed",
            `${record.title}: ${c.note}`,
            record.tripId || undefined,
          );
        }
        if (c.action === "acceptFacts") {
          const record = state.sources.find((s) => s.id === c.sourceId);
          if (!record || record.digest !== c.digest)
            throw new Error("Source changed. Review the latest evidence.");
          const facts = validateFacts(record, c.facts);
          // Replace only matching keys, preserving previously reviewed fields.
          record.facts = [
            ...record.facts.filter(
              (f) =>
                !facts.some(
                  (n) =>
                    n.key === f.key &&
                    (n.serviceRef || "") === (f.serviceRef || "") &&
                    (n.kind || "assertion") === (f.kind || "assertion"),
                ),
            ),
            ...facts,
          ];
          if (
            record.extraction?.facts.every((proposed) =>
              record.facts.some(
                (f) =>
                  f.key === proposed.key &&
                  f.value === proposed.value &&
                  f.excerpt === proposed.excerpt &&
                  f.kind === proposed.kind &&
                  f.serviceRef === proposed.serviceRef,
              ),
            )
          )
            record.extraction.status = "reviewed";
          event(
            state,
            "Facts reviewed",
            `${facts.length} fields recorded from ${record.title}. ${c.note}`,
            record.tripId || undefined,
          );
        }
        if (c.action === "prepare") {
          const trip = state.trips.find((t) => t.id === c.tripId);
          if (!trip) throw new Error("Trip not found.");
          const brief = prepareBrief(
            trip,
            state.sources.filter((s) => s.tripId === trip.id),
          );
          state.briefs
            .filter((b) => b.tripId === trip.id && b.status === "proposed")
            .forEach((b) => {
              b.status = "dismissed";
              b.reviewNote = "Superseded by a new proposal";
            });
          state.briefs.unshift(brief);
          event(
            state,
            "Handoff prepared",
            "Evidence summary and follow-up checklist created for review. Nothing sent.",
            trip.id,
          );
        }
        if (c.action === "review")
          reviewBrief(state, c.briefId, c.decision, c.note, c.draft);
        if (["link", "acceptFacts", "dismissExtraction"].includes(c.action))
          refreshBriefs(state);
      });
    return json(workspace());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Invalid input or provider response. Check fields and supported schema; nothing imported."
        : error instanceof SyntaxError
          ? "Invalid JSON or provider response."
          : error instanceof Error
            ? error.message
            : "Operation failed. Retry after checking configuration.";
    // Error logs contain action and controlled error text, never raw provider payloads or credentials.
    const safeMessage =
      message.length < 600 && !/api[_ -]?key|Bearer\s+\S+/i.test(message)
        ? message
        : "Provider request failed. Check credentials and model access; original data is unchanged.";
    try {
      mutate((state) =>
        event(state, "Operation failed", `${action}: ${safeMessage}`),
      );
    } catch {
      /* Preserve the original failure if disk is unavailable. */
    }
    return json({ error: safeMessage }, 400);
  }
}
