## Model & Token Routing

Fable (main loop) is for: architecture, planning, hard debugging, final
review/synthesis, and anything ambiguous. Everything else gets delegated
to cheaper models.

When spawning subagents (Agent tool) or workflow agents, set the model explicitly:
- **sonnet** (default for all exploration and analysis): file/code search,
  exploration fan-outs (use the Explore agent type), codebase analysis and
  summarization, log scanning, data extraction, standard implementation from
  a clear spec, QA runs, doc updates. Do NOT use haiku for exploration — a
  subtly wrong exploration summary taken as given by Fable costs more than
  the tokens saved.
- **opus**: complex implementation, code review passes, tricky refactors
- **omit model (inherit Fable)**: only for design decisions, adversarial
  verification of critical findings, or synthesis across many agent results

Effort: use "low" for mechanical stages, session default for normal work,
"high"+ only for verify/judge/design stages.

Subagents must return conclusions with file:line references — never raw file
contents or dumps. Don't pay Fable rates to re-read what a cheaper model
already read; instruct subagents accordingly in their prompts.