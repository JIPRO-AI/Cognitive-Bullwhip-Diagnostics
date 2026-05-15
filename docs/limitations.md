# Limitations

This page is the canonical limitations index. Cross-linked from the README.

Read this before deploying any tool in production. We list what the package
does *not* claim to do, where the current implementation is heuristic,
and known failure modes.

---

## 1. Thresholds are empirical, not derived

All threshold constants in `src/engine/thresholds.ts` are *empirical defaults*
chosen for the demonstration case studies. They are not derived from a
formal model. Specifically:

- `BULLWHIP.RATIO_CONFIRM = 3.0` — chosen by analogy with Lee, Padmanabhan & Whang (1997) where any *measurable* amplification is treated as significant; we adopted 3× as a "clearly significant" floor to reduce false positives.
- `ANCHOR.CONFIDENCE_AUTO_FLAG = 0.6` — a heuristic floor based on observed agent behavior in the Kalshi case study. Below this, signal type is forced to ambiguous regardless of pattern match.
- `MESH.RISK_FLAG = 70`, `MESH.RISK_BLOCK = 90` — common-practice operational risk bands. No formal validation on a benchmark dataset.
- `GATE.DEFAULT_CONFIDENCE_FLOOR = 0.70`, `GATE.RISK_AUTO_BLOCK = 90` — operational defaults; override per principle if your domain tolerates more risk.

**Recommendation**: calibrate to your domain. See [`thresholds.md`](thresholds.md)
for the per-constant justification and how to adjust safely.

---

## 2. Anchor uses English-only substring matching

`anchor_classify` does noise detection and dangerous-action detection by
*substring search* on a fixed English keyword list. This is intentional —
the tool runs without an LLM inside.

Consequences:

- **Non-English input is not classified.** Korean, Japanese, etc. will likely route to `action` with default confidence regardless of the actual intent.
- **Morphology is partial.** We added common noun forms (e.g. `delete` + `deletion`, `remove` + `removal`, `destroy` + `destruction`) so phrasings like "schedule deletion" are caught. Other inflections (`deleting`, `destroyed`, `removed`) match through the verb form. But arbitrary morphology is *not* handled in anchor — that lives in `gate_validate`.
- **Synonyms are not recognized.** "Erase", "obliterate", "nuke", "zap" are not on the dangerous-action list. Add them at the call site if your domain uses different vocabulary.

If you need broader matching, extend the `dangerousActions` list in
`src/tools/anchor-classify.ts` or pre-process input before calling the tool.

---

## 3. Negation handling is window-based

Both `anchor_classify` (intent-inversion detection near dangerous verbs) and
`gate_validate` (false-positive suppression for principle violations) look at
a short character window before a match (~30–40 chars) for negation markers:
`no`, `not`, `don't`, `never`, `prevent`, `prevents`, `preventing`, `avoid`,
`avoiding`, `without`, `cannot`, `can't`, `won't`, `prohibit`, `prohibits`,
`forbid`, `forbids`, `disallow`, `disallows`.

Cases this catches:
- "do not delete X" (negation 7 chars before dangerous verb)
- "prevent deletion of Y" (negation 8 chars before dangerous noun)
- "without overwriting Z" (negation 9 chars before dangerous verb)

Cases this misses (intentional, to avoid false positives):
- "we did **not** have time to review yesterday; today we will **delete** the old logs" — negation ~50 chars away from `delete`. Not treated as negation context.
- Complex multi-clause negation ("we will refrain from any action that could be interpreted as deletion") — no explicit negation marker.
- Negation in *following* context: "we will delete X. however, do not delete Y" — the second `delete` is *not* negated even though the sentence is protective.

If your domain demands strict negation handling, post-process tool output
with a sentence-level negation parser.

---

## 4. Bullwhip variance is caller-defined, not package-invented

`bullwhip_diagnose` never decides what "variance" means for your domain.
There are two supported ways to provide it, and both keep the definition in
your hands:

1. **Pre-scored `decision_log`** — you pass `DecisionEntry[]` with a
   `variance_score` you computed yourself (PnL volatility, schema divergence,
   time-to-resolution variance, decision flip-flopping, or any custom proxy).
2. **`raw_events` + `variance_strategy`** — you pass a loose event log and
   *select* one of three fixed strategies (`outcome_deviation`,
   `decision_flip`, `execution_loss`). The tool then applies that strategy as
   a deterministic scoring rule (`src/engine/variance.ts`). It does **not**
   estimate variance on its own.

If you pass `raw_events` with **no** `variance_strategy`, the tool returns
`status: "needs_variance_strategy"` with the candidate strategies and does
not diagnose — selecting the variance definition is a judgement call that
belongs to the user, because it determines what the whole diagnosis measures.

Consequences:

- The three built-in strategies are **deterministic keyword/structure rules**,
  not learned models. `execution_loss` keys on loss/error/rollback language,
  `decision_flip` on opposite-direction decision pairs, `outcome_deviation` on
  the classified outcome. They are a convenience layer, not ground truth — the
  `diagnostic_completeness` block in the output says exactly that.
- Whichever path you use, the amplification *ratio* `bullwhip_diagnose`
  reports is only as reliable as the variance definition behind it.

---

## 4a. logic_sequence consistency check is a placeholder

`logic_sequence` does two things:

1. **Sequence check** — verifies the input produced a Context → Retrieval →
   Analysis → Action sequence with no skipped steps. **This is fully
   functional.**
2. **Consistency check** — was meant to compare the current decision against
   prior decisions on similar input (`aligned` / `diverged` / `no_history`).
   **This is a placeholder.** There is no persistent cross-call memory, so
   `checkConsistency()` always returns `no_history`. The `diverged` branch
   in the code is currently unreachable; it is wired in and reserved for a
   future persistent-memory backend.

In short: trust `logic_sequence` for "did the agent follow the required
reasoning steps". Do not rely on it for "is this decision consistent with
past decisions" — that half is not implemented yet.

---

## 4b. mesh_simulate is keyword-based heuristic estimation, not graph simulation

`mesh_simulate` does **not** read an actual dependency graph of your
systems. It estimates blast radius by scanning the recommendation and
context for keywords (`database`, `cache`, `api`, `agent`, `cost`,
`storage`, etc.) and mapping those to risk nodes.

This means:
- It catches *named* systems and *common* patterns well.
- It will **miss** a downstream dependency that is real but not mentioned in
  the input text.
- It will **over-flag** if a keyword appears in a context where the system
  is not actually affected.

Treat the "blast radius" as a *heuristic estimate from the text you
provided*, not a verified impact map. For real dependency-aware simulation,
feed `mesh_simulate` a context_window that explicitly lists the dependent
systems, or use a dedicated infrastructure dependency tracker.

---

## 5. Case study is retrospective, not prospective

The Kalshi crypto trading case (see `docs/case-studies/`) is a **post-hoc
analysis** of a real $2000 → $396 drawdown event. It demonstrates *what
each tool would have surfaced* given the decision log of that incident.

It does **not** prove:

- That the tools would have prevented the loss in a live system.
- That the same thresholds work across other domains.
- A specific precision / recall on a benchmark dataset.

Prospective validation (deploy in a live agent system, measure
false-positive and false-negative rates over time) is your responsibility.

---

## 6. MCP-shaped by default

The package runs as an MCP server. It is currently distributed via GitHub
(`npx -y github:JIPRO589/Cognitive-Bullwhip-Diagnostics`) — **not yet
published to npm**, so the `@agdp/structured-cognition` name in
`package.json` is a declared-but-unpublished identifier. The tools are also
importable directly (used heavily in the test suite), but:

- **Not on the npm registry yet.** Install via the GitHub form above, or clone.
- **Direct adapters for LangChain, CrewAI, AutoGen are not bundled.**
- **No HTTP/REST wrapper.** Tools are TypeScript functions + MCP stdio.
- **No language bindings beyond Node/TS.** If you need Python, wrap the MCP server.

Contributions welcome for non-MCP integration paths.

---

## 7. What this package is NOT trying to be

- A retrieval system (use a vector DB).
- A truthfulness checker (use a hallucination detector / fact-checking layer).
- A model fine-tuning toolkit (use the model vendor's API).
- A generic chatbot guardrail for every scenario (Guardrails AI / NeMo Guardrails fit better for format and topic).
- A replacement for human review in high-stakes decisions (gate_validate's `escalate` exists for a reason).

---

## See also

- [`thresholds.md`](thresholds.md) — per-constant justification and tuning.
- [`integrations.md`](integrations.md) — integration patterns.
- [`case-studies/`](case-studies/) — worked examples.
