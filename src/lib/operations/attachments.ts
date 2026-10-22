import { simpleParser } from "mailparser";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { hash, source } from "./core";
import { tripReference } from "./imports";
import type { Environment, Source } from "./types";

export async function attachmentSources(
  bytes: Buffer,
  filename: string,
  mimeType: string,
  parent: Source,
  externalId: string,
): Promise<Source[]> {
  const attachmentHash = createHash("sha256").update(bytes).digest("hex");
  const locator = `${parent.locator} / ${filename} / sha256:${attachmentHash}`;
  const base = {
    provider: parent.provider,
    environment: parent.environment,
    occurredAt: parent.occurredAt,
    identifiers: parent.identifiers,
    facts: [],
    parentId: parent.id,
  };
  if (bytes.length > 1_000_000)
    return [
      source({
        ...base,
        externalId,
        title: `Attachment · ${filename}`,
        locator,
        content: "Attachment exceeds the 1 MB extraction limit.",
        warnings: ["Open the original attachment and review manually."],
      }),
    ];
  if (mimeType === "text/plain" || mimeType === "text/csv")
    return [
      source({
        ...base,
        externalId,
        title: `Attachment · ${filename}`,
        locator,
        content: bytes.toString("utf8"),
        warnings: ["Text extracted from attachment; details require review."],
      }),
    ];
  if (mimeType === "application/pdf") {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      try {
        if (pdf.numPages > 20)
          throw new Error("PDF exceeds 20-page pilot limit");
        const { text } = await extractText(pdf, { mergePages: false });
        return text.map((page, i) =>
          source({
            ...base,
            externalId: `${externalId}:page:${i + 1}`,
            title: `${filename} · page ${i + 1}`,
            locator: `${locator} / page ${i + 1}`,
            content:
              page.slice(0, 100_000) || "No extractable text on this page.",
            warnings: [
              page.trim()
                ? "PDF text order may differ from the visual document. Verify tables and amounts in the original."
                : "Scanned/image-only PDF: OCR is not implemented. Manual review required.",
            ],
          }),
        );
      } finally {
        await pdf.loadingTask.destroy();
      }
    } catch {
      return [
        source({
          ...base,
          externalId,
          title: `Attachment · ${filename}`,
          locator,
          content:
            "PDF could not be extracted (encrypted, invalid, or over 20 pages).",
          warnings: ["Manual document review required. No fields inferred."],
        }),
      ];
    }
  }
  return [
    source({
      ...base,
      externalId,
      title: `Attachment · ${filename}`,
      locator,
      content: `Unsupported attachment type: ${mimeType}`,
      warnings: [
        "Image, audio, Office documents, and other binary attachments require manual review. No OCR or voice transcription performed.",
      ],
    }),
  ];
}

export async function importEml(
  raw: string,
  filename: string,
  environment: Environment,
) {
  if (Buffer.byteLength(raw) > 1_000_000)
    throw new Error("Email import limit is 1 MB.");
  const mail = await simpleParser(raw, {
    skipHtmlToText: false,
    skipTextToHtml: true,
    skipImageLinks: true,
  });
  if (!mail.from?.value.length || (!mail.text && !mail.attachments.length))
    throw new Error(
      "Expected an RFC 822 .eml file with a From header and body or attachment.",
    );
  if (mail.attachments.length > 20)
    throw new Error("Email contains more than 20 attachments.");
  const body = mail.text || "No plain text body.";
  const record = source({
    provider: "gmail",
    environment,
    externalId: `eml:${mail.messageId || hash(raw)}`,
    title: mail.subject || filename,
    locator: `Uploaded ${filename} / Message-ID: ${mail.messageId || "missing"} / sha256:${createHash("sha256").update(raw).digest("hex")}`,
    occurredAt:
      mail.date && !isNaN(mail.date.getTime()) ? mail.date.toISOString() : null,
    content: `From: ${mail.from.text}\nSubject: ${mail.subject || ""}\n\n${body}`,
    facts: [],
    identifiers: {
      email: mail.from.value[0].address,
      tripRef: tripReference(body),
    },
    warnings: [
      "User-uploaded email; sender authenticity not verified. Inspect forwarded/quoted history before accepting facts.",
    ],
  });
  const sources = [record];
  for (const [i, attachment] of mail.attachments.entries())
    sources.push(
      ...(await attachmentSources(
        attachment.content,
        attachment.filename || `attachment-${i + 1}`,
        attachment.contentType,
        record,
        `${record.externalId}:attachment:${i + 1}`,
      )),
    );
  return { sources, trips: [] };
}
