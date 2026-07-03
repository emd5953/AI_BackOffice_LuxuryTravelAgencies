import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db } from "@/db";
import { drafts } from "@/db/schema";
import { getClientContext, getThread, getThreadMessages } from "@/lib/context";
import { AGENCY_NAME, DESIGNER_NAME } from "@/lib/constants";

const MODEL = "claude-opus-4-8";

const anthropic = new Anthropic();

const DraftOutput = z.object({
  body: z
    .string()
    .describe(
      "The complete email reply, ready to send in the designer's voice. Plain text, no subject line, no placeholders.",
    ),
  flags: z
    .array(z.string())
    .describe(
      "Facts the designer must verify before sending, and questions from the client that could not be answered from the provided context. Empty if the draft is fully grounded.",
    ),
});

const SYSTEM = `You draft email replies on behalf of ${DESIGNER_NAME}, a travel designer at ${AGENCY_NAME}, a luxury travel agency. You write in her voice: warm, precise, unhurried. Her clients pay for judgment and care, and her emails read that way.

Hard rules:
- Never state availability, prices, room configurations, or confirmations that are not in the provided context. If the client asks about one, say Elena is confirming it and will follow up shortly — and add a flag.
- Never invent facts about the trip, suppliers, or the client's history.
- General destination knowledge (climate, seasons, geography) may be used freely.
- Answer every question in the client's most recent message. Anything you cannot answer must be acknowledged in the draft and listed in flags.
- Match the client's communication style, which you can infer from their bio, preferences, and how they write. Clients who write two lines get replies of similar economy.
- The draft is reviewed by Elena before sending. Write it ready-to-send: no placeholders like [DATE], no meta-commentary, no options for her to choose between.`;

export interface PromptContext {
  today: string;
  client: { name: string; email: string; bio: string | null };
  preferences: { kind: string; text: string; source: string }[];
  callNotes: string[];
  intakeForms: unknown[];
  trips: {
    title: string;
    destination: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    partySize: number | null;
    budgetUsd: number | null;
  }[];
  thread: {
    subject: string;
    messages: { direction: string; from: string; body: string; sentAt: string }[];
  };
}

export async function draftReply(threadId: number) {
  const thread = await getThread(threadId);
  if (thread.counterpartType !== "client" || !thread.clientId) {
    throw new Error("Reply drafting only supports client threads in Phase 1");
  }

  const ctx = await getClientContext(thread.clientId);
  const msgs = await getThreadMessages(threadId);

  // Assembled explicitly and persisted with the draft — what the agent saw is
  // always reconstructable for review and evals.
  const promptContext: PromptContext = {
    today: new Date().toISOString().slice(0, 10),
    client: { name: ctx.client.name, email: ctx.client.email, bio: ctx.client.bio },
    preferences: ctx.preferences.map((p) => ({ kind: p.kind, text: p.text, source: p.source })),
    callNotes: ctx.callNotes.map((n) => n.body),
    intakeForms: ctx.intakeForms.map((f) => f.answers),
    trips: ctx.trips.map((t) => ({
      title: t.title,
      destination: t.destination,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      partySize: t.partySize,
      budgetUsd: t.budgetUsd,
    })),
    thread: {
      subject: thread.subject,
      messages: msgs.map((m) => ({
        direction: m.direction,
        from: m.fromAddr,
        body: m.body,
        sentAt: m.sentAt.toISOString(),
      })),
    },
  };

  const userPrompt = [
    `Today's date: ${promptContext.today}`,
    "",
    "# Client",
    JSON.stringify(promptContext.client, null, 2),
    "",
    "# Known preferences (kind: confirmed = client said it, inferred = deduced; treat inferred with more caution)",
    JSON.stringify(promptContext.preferences, null, 2),
    "",
    "# Call notes",
    JSON.stringify(promptContext.callNotes, null, 2),
    "",
    "# Intake forms",
    JSON.stringify(promptContext.intakeForms, null, 2),
    "",
    "# Trips",
    JSON.stringify(promptContext.trips, null, 2),
    "",
    `# Email thread: "${promptContext.thread.subject}"`,
    JSON.stringify(promptContext.thread.messages, null, 2),
    "",
    "Draft Elena's reply to the most recent inbound message.",
  ].join("\n");

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: zodOutputFormat(DraftOutput) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model declined to draft this reply");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Model output did not match the draft schema");
  }

  const [draft] = await db
    .insert(drafts)
    .values({
      threadId,
      body: parsed.body,
      flags: parsed.flags,
      status: "pending",
      model: MODEL,
      promptContext,
      createdAt: new Date(),
    })
    .returning();

  return draft;
}
