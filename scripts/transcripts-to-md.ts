/**
 * Convert Claude Code session transcripts (JSONL) into readable markdown.
 *
 * Input:  docs/transcripts/*.jsonl  (raw session logs, gitignored — contain secrets)
 * Output: docs/sessions/<n>-<date>-<id>.md  (redacted, committable)
 *
 * Usage: npx tsx scripts/transcripts-to-md.ts
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const IN_DIR = "docs/transcripts";
const OUT_DIR = "docs/sessions";

// Redact anything that looks like key material before it hits a committable file
function redact(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "[REDACTED_ANTHROPIC_KEY]")
    .replace(/\bpa-[A-Za-z0-9_-]{16,}/g, "[REDACTED_VOYAGE_KEY]")
    .replace(/(ANTHROPIC_API_KEY|VOYAGE_API_KEY)=(?!\s|$)[^\s"']+/g, "$1=[REDACTED]");
}

type Block = {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
};

type Line = {
  type?: string;
  timestamp?: string;
  isMeta?: boolean;
  message?: { role?: string; content?: string | Block[] };
};

function briefInput(input: unknown): string {
  const s = typeof input === "string" ? input : JSON.stringify(input ?? {});
  const flat = s.replace(/\s+/g, " ");
  return flat.length > 160 ? flat.slice(0, 160) + "…" : flat;
}

function renderContent(content: string | Block[] | undefined): string[] {
  if (!content) return [];
  if (typeof content === "string") return content.trim() ? [content] : [];

  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && block.text?.trim()) {
      parts.push(block.text);
    } else if (block.type === "tool_use") {
      parts.push(`> 🔧 **${block.name}** \`${briefInput(block.input)}\``);
    } else if (block.type === "tool_result") {
      const size =
        typeof block.content === "string"
          ? block.content.length
          : JSON.stringify(block.content ?? "").length;
      parts.push(`> ↳ tool result (${size.toLocaleString()} chars, omitted)`);
    }
    // thinking blocks intentionally skipped — not part of the visible conversation
  }
  return parts;
}

function convert(file: string): { md: string; turns: number; first?: string; last?: string } {
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const out: string[] = [];
  let turns = 0;
  let first: string | undefined;
  let last: string | undefined;

  for (const raw of lines) {
    let line: Line;
    try {
      line = JSON.parse(raw);
    } catch {
      continue; // malformed line — skip
    }
    if (line.isMeta) continue;
    if (line.type !== "user" && line.type !== "assistant") continue;

    const parts = renderContent(line.message?.content);
    if (parts.length === 0) continue;

    // A user turn that is ONLY tool results is loop machinery, not conversation
    if (line.type === "user" && parts.every((p) => p.startsWith("> ↳"))) continue;

    const ts = line.timestamp ? new Date(line.timestamp) : null;
    const stamp = ts
      ? ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "";
    if (ts) {
      first ??= ts.toISOString();
      last = ts.toISOString();
    }

    const who = line.type === "user" ? "🧑 **User**" : "🤖 **Claude**";
    out.push(`### ${who}${stamp ? ` · ${stamp}` : ""}\n\n${parts.join("\n\n")}\n`);
    turns++;
  }

  return { md: redact(out.join("\n---\n\n")), turns, first, last };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(IN_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => join(IN_DIR, f))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);

  const index: string[] = [
    "# Session history (readable)",
    "",
    "Full chat transcripts converted from the raw JSONL logs (which stay local-only",
    "in `../transcripts/`). Key material is redacted. Regenerate any time:",
    "`npx tsx scripts/transcripts-to-md.ts`",
    "",
  ];

  files.forEach((file, i) => {
    const id = basename(file, ".jsonl");
    const { md, turns, first, last } = convert(file);
    const date = (first ?? new Date().toISOString()).slice(0, 10);
    const name = `${String(i + 1).padStart(2, "0")}-${date}-${id.slice(0, 8)}.md`;

    const meta = [
      `- Source: \`docs/transcripts/${basename(file)}\` (local-only)`,
      `- Turns: ${turns}`,
    ];
    if (first && last) meta.push(`- Span: ${first} → ${last}`);
    const header = `# Session ${i + 1} — ${date}\n\n${meta.join("\n")}\n\n---\n\n`;

    writeFileSync(join(OUT_DIR, name), header + md + "\n");
    index.push(`- [${name}](${name}) — ${turns} turns`);
    console.log(`${name}: ${turns} turns`);
  });

  writeFileSync(join(OUT_DIR, "README.md"), index.join("\n") + "\n");
  console.log(`\nWrote ${files.length} sessions + index to ${OUT_DIR}/`);
}

main();
