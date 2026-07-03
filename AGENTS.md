<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent routing

This repo defines scoped subagents in `.claude/agents/`: `implementer`, `researcher`, `reviewer`. When delegating work, use the scoped agent that matches the task instead of a general-purpose one — it has a tighter tool set and a precise spec, so it burns less context and stays on task.

- Precisely-specified code change → `implementer`
- Read-only codebase/docs question → `researcher`
- Diff review or hard-bug root-cause → `reviewer`
- Only fall back to a general-purpose agent for tasks that don't fit any of the above.
