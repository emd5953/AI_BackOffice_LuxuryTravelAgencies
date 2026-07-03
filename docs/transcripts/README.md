# Session transcripts (local only)

Raw Claude Code session logs (`.jsonl`) for this project, copied from
`~/.claude/projects/-Users-enrinjr-Documents-GitHub-AI-BackOffice-LuxuryTravelAgencies/`.

**Gitignored on purpose: they contain API-key material captured in tool output.**
Do not commit them. If you need a fresh copy, re-run the copy from the path above.

Each line is one JSON event (user message, assistant message, tool call/result).
Readable enough with `jq`:

```sh
jq -r 'select(.type=="user" or .type=="assistant") | .message.content | if type=="string" then . else (.[.|length-1].text // "") end' <file>.jsonl | less
```

For the curated history, read `../project-journal.md` (narrative) and
`../senior-reviews.md` (per-phase design defenses).
