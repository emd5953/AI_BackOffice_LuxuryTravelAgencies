import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { source } from "./core";
import { tripId, tripReference } from "./imports";
import type { Environment, Fact, Integration, Source, Trip } from "./types";
import { attachmentSources } from "./attachments";

export async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Provider rate limit. Wait before retrying; no data imported."
        : `Provider returned HTTP ${response.status}. Check credentials, permission, and record ID. No data imported.`,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider returned an empty response.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.length;
    if (bytes > 2_000_000) {
      await reader.cancel();
      throw new Error(
        "Provider response exceeds the 2 MB pilot limit. Narrow the import.",
      );
    }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Public, intentionally published DEMO credentials. Never point these at production.
const MEWS_DEMO = {
  ClientToken:
    "E0D439EE522F44368DC78E1BFB03710C-D24FB11DBE31D4621C4817E028D9E1D",
  AccessToken:
    "C66EF7B239D24632943D115EDE9CB810-EA00F8FD8294692C940F6B5A8F9453D",
};
export const MEWS_URL =
  "https://api.mews-demo.com/api/connector/v1/reservations/getAll/2023-06-06";
const mewsSchema = z.object({
  Reservations: z
    .array(
      z.object({
        Id: z.string(),
        Number: z.string(),
        State: z.string(),
        UpdatedUtc: z.string(),
        ScheduledStartUtc: z.string(),
        ScheduledEndUtc: z.string(),
        PersonCounts: z
          .array(z.object({ Count: z.number().int().nonnegative() }))
          .optional(),
      }),
    )
    .max(20),
  Cursor: z.string().nullish(),
});
export function normalizeMews(payload: unknown) {
  const data = mewsSchema.parse(payload);
  const trips: Trip[] = data.Reservations.map((r) => ({
    id: tripId("sandbox", `MEWS-${r.Id}`),
    reference: `MEWS-${r.Id}`,
    title: `Mews demo · reservation ${r.Number}`,
    traveler: "Demo guest (identity not imported)",
    environment: "sandbox",
  }));
  const sources = data.Reservations.map((r, i) => {
    const facts: Fact[] = [
      {
        key: "reservationRef",
        value: r.Number,
        excerpt: `Number: ${r.Number}`,
      },
      {
        key: "reservationStatus",
        value: r.State,
        excerpt: `State: ${r.State}`,
      },
      // Keep timestamps as UTC; never invent the property's local timezone.
      {
        key: "checkIn",
        value: r.ScheduledStartUtc,
        excerpt: `ScheduledStartUtc: ${r.ScheduledStartUtc}`,
      },
      {
        key: "checkOut",
        value: r.ScheduledEndUtc,
        excerpt: `ScheduledEndUtc: ${r.ScheduledEndUtc}`,
      },
    ];
    if (r.PersonCounts?.length)
      facts.push({
        key: "partySize",
        value: String(r.PersonCounts.reduce((sum, p) => sum + p.Count, 0)),
        excerpt: JSON.stringify(r.PersonCounts),
      });
    return source({
      externalId: r.Id,
      provider: "mews",
      environment: "sandbox",
      title: `Mews reservation ${r.Number}`,
      locator: `${MEWS_URL} / Reservations / ${r.Id}`,
      occurredAt: r.UpdatedUtc,
      content: JSON.stringify(r, null, 2),
      facts,
      identifiers: { tripRef: trips[i].reference },
      warnings: [
        "Official public demo. UTC timestamps; property timezone not imported. Reservation status does not establish payment or transfer status.",
      ],
    });
  });
  return { trips, sources, hasMore: Boolean(data.Cursor) };
}
export async function readMewsDemo() {
  return normalizeMews(
    await fetchJson(MEWS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...MEWS_DEMO,
        Client: "Analogue read-only pilot 0.2",
        Limitation: { Count: 10 },
      }),
    }),
  );
}

type MimePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: MimePart[];
};
const gmailMessage = z.object({
  id: z.string(),
  threadId: z.string(),
  internalDate: z.string().regex(/^\d+$/),
  payload: z.custom<MimePart>((v) => !!v && typeof v === "object"),
});
function parts(part: MimePart): MimePart[] {
  return [part, ...(part.parts || []).flatMap(parts)];
}
function decode(data: string) {
  return Buffer.from(data, "base64url").toString("utf8");
}
function header(part: MimePart, name: string) {
  return part.headers?.find((h) => h.name.toLowerCase() === name)?.value || "";
}
export function normalizeGmail(payload: unknown, mailbox: string) {
  const message = gmailMessage.parse(payload);
  const mime = parts(message.payload);
  if (mime.length > 60)
    throw new Error("Too many MIME parts. Import a smaller message.");
  const plain = mime
    .filter((p) => p.mimeType === "text/plain" && !p.filename)
    .map((p) => decode(p.body?.data || ""))
    .join("\n");
  const html = mime
    .filter((p) => p.mimeType === "text/html" && !p.filename)
    .map((p) => decode(p.body?.data || ""))
    .join("\n");
  // HTML is displayed only as inert text. No remote images, scripts, or links are executed.
  const body =
    plain ||
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<(br|\/p|\/div)\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  if (body.length > 100_000)
    throw new Error("Message exceeds 100 KB text limit.");
  const from = header(message.payload, "from");
  const sender = from.match(
    /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  )?.[0];
  const timestamp = new Date(Number(message.internalDate));
  if (isNaN(timestamp.getTime()))
    throw new Error("Invalid Gmail message timestamp.");
  const record = source({
    externalId: `${mailbox}:${message.id}`,
    provider: "gmail",
    environment: "live",
    title: header(message.payload, "subject") || "Email (no subject)",
    locator: `https://mail.google.com/mail/u/${encodeURIComponent(mailbox)}/#all/${message.threadId}`,
    occurredAt: timestamp.toISOString(),
    content: `From: ${from}\nTo: ${header(message.payload, "to")}\n\n${body}`,
    facts: [],
    identifiers: { tripRef: tripReference(body), email: sender },
    warnings: [
      "Email claims require review; forwarded and quoted history may contain superseded details.",
      ...(!plain
        ? ["Converted from HTML; inspect original for tables and formatting."]
        : []),
    ],
  });
  return {
    record,
    attachments: mime.filter((p) => p.filename),
    messageId: message.id,
  };
}
function gmailHeaders() {
  if (!process.env.GMAIL_ACCESS_TOKEN || !process.env.GMAIL_ACCOUNT)
    throw new Error(
      "Set GMAIL_ACCESS_TOKEN (gmail.readonly) and GMAIL_ACCOUNT for the authorized mailbox.",
    );
  return { Authorization: `Bearer ${process.env.GMAIL_ACCESS_TOKEN}` };
}
export async function readGmailThread(threadId: string) {
  const headers = gmailHeaders();
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";
  const profile = z
    .object({ emailAddress: z.string() })
    .parse(await fetchJson(`${base}/profile`, { headers }));
  if (
    profile.emailAddress.toLowerCase() !==
    process.env.GMAIL_ACCOUNT!.toLowerCase()
  )
    throw new Error(
      "OAuth token belongs to a different mailbox than GMAIL_ACCOUNT.",
    );
  const data = z
    .object({ messages: z.array(z.unknown()).max(30) })
    .parse(
      await fetchJson(
        `${base}/threads/${encodeURIComponent(threadId)}?format=full`,
        { headers },
      ),
    );
  const records: Source[] = [];
  for (const item of data.messages) {
    const { record, attachments, messageId } = normalizeGmail(
      item,
      profile.emailAddress,
    );
    records.push(record);
    for (const attachment of attachments) {
      if (
        ["text/plain", "text/csv", "application/pdf"].includes(
          attachment.mimeType || "",
        ) &&
        (attachment.body?.size || 0) <= 1_000_000
      ) {
        const body = attachment.body?.attachmentId
          ? z
              .object({ data: z.string() })
              .parse(
                await fetchJson(
                  `${base}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.body.attachmentId)}`,
                  { headers },
                ),
              ).data
          : attachment.body?.data;
        records.push(
          ...(await attachmentSources(
            Buffer.from(body || "", "base64url"),
            attachment.filename!,
            attachment.mimeType!,
            record,
            `${profile.emailAddress}:${messageId}:attachment:${attachment.partId || attachment.filename}`,
          )),
        );
      } else
        records.push(
          source({
            externalId: `${profile.emailAddress}:${messageId}:attachment:${attachment.partId || attachment.filename}`,
            provider: "gmail",
            environment: "live",
            title: `Attachment · ${attachment.filename}`,
            locator: `${record.locator} / message ${messageId} / attachment ${attachment.filename}`,
            occurredAt: record.occurredAt,
            content: "Attachment retained by reference; not extracted.",
            facts: [],
            identifiers: record.identifiers,
            warnings: [
              "Unsupported or oversized attachment; manual review required. Images, voice, and Office files need separate extraction.",
            ],
          }),
        );
    }
  }
  return { sources: records, trips: [] };
}

export function verifyTwilio(
  raw: string,
  signature: string | null,
  url: string,
  token: string,
): boolean {
  const params = new URLSearchParams(raw);
  if ([...params.keys()].some((key, i, keys) => keys.indexOf(key) !== i))
    return false;
  const data =
    url +
    [...params.keys()]
      .sort()
      .map((k) => k + params.get(k))
      .join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  return (
    !!signature &&
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
export function normalizeWhatsApp(raw: string, environment: Environment) {
  const p = new URLSearchParams(raw);
  const sid = z
    .string()
    .regex(/^SM[a-fA-F0-9]{32}$/)
    .parse(p.get("MessageSid"));
  const from = z
    .string()
    .regex(/^whatsapp:\+[1-9]\d{6,14}$/)
    .parse(p.get("From"));
  const body = z
    .string()
    .max(20_000)
    .parse(p.get("Body") || "");
  return source({
    externalId: `${p.get("AccountSid")}:${sid}`,
    provider: "whatsapp",
    environment,
    title: `WhatsApp · ${from.slice(9)}`,
    locator: `Twilio / ${p.get("AccountSid")} / ${sid}`,
    occurredAt: null,
    content: body,
    facts: [],
    identifiers: { tripRef: tripReference(body), phone: from.slice(9) },
    warnings: [
      "Webhook receipt is not the original sent time. Client requests do not confirm supplier fulfillment.",
      ...(Number(p.get("NumMedia") || 0) > 0
        ? [
            "Media / voice note attached; transcription not implemented. Review in the provider console.",
          ]
        : []),
    ],
  });
}

export async function readTravefy(partnerIdentifier: string) {
  if (!process.env.TRAVEFY_PUBLIC_KEY || !process.env.TRAVEFY_USER_TOKEN)
    throw new Error(
      "Travefy requires an approved API platform public key, user token, and a trip associated with that platform.",
    );
  const result = await fetchJson(
    `https://api.travefy.com/api/trips?partnerIdentifier=${encodeURIComponent(partnerIdentifier)}`,
    {
      headers: {
        "X-API-PUBLIC-KEY": process.env.TRAVEFY_PUBLIC_KEY,
        "X-USER-TOKEN": process.env.TRAVEFY_USER_TOKEN,
        "X-API-VERSION": "20241001",
        Accept: "application/json",
      },
    },
  );
  const data = z
    .array(
      z.object({
        Id: z.number(),
        Name: z.string().nullish(),
        PartnerIdentifier: z.string(),
        Status: z.string().nullish(),
        IsProposal: z.boolean().optional(),
        CreatedOn: z.string().nullish(),
      }),
    )
    .max(1)
    .parse(result);
  if (!data.length || data[0].PartnerIdentifier !== partnerIdentifier)
    throw new Error(
      "No exact Travefy partner reference returned. Nothing imported.",
    );
  const t = data[0];
  const trip: Trip = {
    id: tripId("live", partnerIdentifier),
    reference: partnerIdentifier,
    title: t.Name || partnerIdentifier,
    traveler: "Traveler not imported from itinerary API",
    environment: "live",
  };
  const record = source({
    externalId: String(t.Id),
    provider: "travefy",
    environment: "live",
    title: `Travefy · ${trip.title}`,
    locator: `Travefy trip ${t.Id} / partner ${partnerIdentifier}`,
    occurredAt: null,
    content: JSON.stringify(t, null, 2),
    facts: [],
    identifiers: { tripRef: partnerIdentifier },
    warnings: [
      "CRM trip status is not a supplier reservation confirmation. Contact identity, itinerary service details, and last-modified time require further import.",
    ],
  });
  return { trips: [trip], sources: [record] };
}

export function integrations(): Integration[] {
  return [
    {
      id: "gmail",
      name: "Gmail conversations",
      status:
        process.env.GMAIL_ACCESS_TOKEN && process.env.GMAIL_ACCOUNT
          ? "Configured · not verified"
          : "Credentials needed",
      detail:
        "Read a selected thread, plain text / HTML email, text and PDF attachments. Or upload .eml without connecting a mailbox.",
      docs: "https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get",
    },
    {
      id: "whatsapp",
      name: "WhatsApp via Twilio",
      status:
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_WEBHOOK_URL &&
        process.env.WHATSAPP_ENVIRONMENT
          ? "Configured · not verified"
          : "Setup needed",
      detail:
        "Signed inbound webhooks, message deduplication and phone matching. No outbound messages. No historical chat scraping.",
      docs: "https://www.twilio.com/docs/whatsapp/sandbox",
    },
    {
      id: "csv",
      name: "Agency spreadsheets",
      status: "CSV import ready",
      detail:
        "Import reviewed CSV rows with row-level evidence. Google Sheets: export the selected sheet as CSV. Direct Sheets OAuth sync is not implemented.",
      docs: "https://support.google.com/docs/answer/49114",
    },
    {
      id: "travefy",
      name: "Travefy trip context",
      status:
        process.env.TRAVEFY_PUBLIC_KEY && process.env.TRAVEFY_USER_TOKEN
          ? "Configured · not verified"
          : "API access needed",
      detail:
        "Optional exact trip lookup by partner identifier. Does not replace the conversation or prove a booking.",
      docs: "https://intercom.help/travefy/en/articles/15385261-travefy-api",
    },
    {
      id: "mews",
      name: "Mews property sandbox",
      status: "Official demo available",
      detail:
        "Read the 10 latest demo reservations. A bounded sample, not a complete agency booking inventory.",
      docs: "https://docs.mews.com/connector-api/guidelines/environments",
    },
  ];
}
