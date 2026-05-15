# Library Framework Mapping

This package is the *implementation layer* of a set of diagnostic frameworks
developed in the [Ji Research Library](https://jipro-ai.github.io/profji-library/).

The library publishes structured essays on AI judgment, cognition, and
organizational impact. This repository is one of the public surfaces where
those frameworks become testable code.

This file documents the explicit mapping. If you came here from the library,
you can see which tool operationalizes which essay. If you came from this
repo, you can trace each tool back to the reasoning that justified its
design.

---

## Direct mappings

### `bullwhip_diagnose` ↔ Judgment Reproduction Crisis (JRC) + Measurement Asymmetry

- Library essays:
  - [Judgment Reproduction Crisis (JRC)](https://jipro-ai.github.io/profji-library/articles/judgment-reproduction-crisis/) — what happens to organizational judgment when AI shortcuts the apprentice path.
  - [Measurement Asymmetry — the trap of measuring AI impact](https://jipro-ai.github.io/profji-library/articles/ai-impact-measurement-trap/) — why the cost of cognitive amplification stays invisible until it is large.

- What the tool does:
  - Scans a decision log for variance amplification across input → reasoning → execution → output layers.
  - Flags the layer where output variance exceeds input variance by ≥ 3×.
  - Reports the *origin layer* — the place where small errors began compounding.

- Why this maps:
  - JRC describes a *judgment failure cycle* where the visible metric (KPI) improves while the *invisible reproduction* of judgment ability erodes.
  - Measurement Asymmetry explains *why* it stays invisible — the measurable side of the asymmetry (output volume, speed) is bright, the unmeasurable side (judgment quality reproduction) is dark.
  - `bullwhip_diagnose` makes the *amplification ratio* between input variance and output variance into a quantifiable signal — i.e. it surfaces the dark side that KPIs do not.

### `anchor_classify` ↔ Automation Bias + Signal Isolation

- Library essay:
  - [Automation Bias and Decision Making](https://jipro-ai.github.io/profji-library/articles/automation-bias-decision-making/) — the cognitive trap where humans (and now agents) accept automated output as more authoritative than it is.

- What the tool does:
  - Classifies raw input as `action` / `observation` / `ambiguous`.
  - Detects hedging language, uncertainty markers, spike indicators, dangerous-action keywords, and **negation adjacent to dangerous verbs**.
  - Forces ambiguous classification below confidence 0.6.

- Why this maps:
  - Automation bias says agents will *act* on signals they should *question*.
  - `anchor_classify` is the *signal isolation* gate — refuses to pass ambiguous inputs downstream regardless of how confidently the LLM phrases them.
  - The negation-adjacent detection ("do not delete" / "prevent deletion") catches the most expensive failure mode: protective phrasing misread as command.

### `logic_sequence` ↔ Hybrid Mind sequencing

- Library essay:
  - [Hybrid Mind](https://jipro-ai.github.io/profji-library/articles/hybrid-mind/) — a 4-layer model of human-AI cognitive collaboration: division → verification → realignment → meta.

- What the tool does:
  - Enforces a fixed Context → Retrieval → Analysis → Action sequence.
  - Checks consistency with prior runs on similar input.
  - Flags step-skipping and reasoning drift.

- Why this maps:
  - Hybrid Mind argues that *reasoning drift* (non-deterministic logic between runs) is the primary failure of unstructured human-AI collaboration.
  - The 4-step sequence in `logic_sequence` is the operational form of Hybrid Mind's division/verification/realignment layer — a hard structure the agent cannot quietly skip.

### `gate_validate` ↔ Governance / Principle gating

- Library reference:
  - The Hybrid Mind essay's 4-layer design includes a *meta layer* — explicit, named principles that the agent must check before commit. `gate_validate` is the canonical operational form of that meta layer.

- What the tool does:
  - Validates a recommendation against declared `PrincipleConfig[]` (id, rule, threshold, on_violation).
  - Supports numeric thresholds (`amount > 500`), keyword matching with morphology (`contains delete` catches `deletion`), and action-type matching.
  - Negation-aware: skips false-positive matches preceded by negation markers within a 40-char window.
  - Produces an audit trail with timestamps, principles_passed, principles_violated.

- Why this maps:
  - Governance failures are *output-layer* failures — the agent reasoned correctly but violated a declared rule.
  - `gate_validate` is the final commit-time check, with the audit trail demanded by the library's "self-exposing > self-correcting" principle.

### `sc_pipeline` ↔ Pipeline composition

- Library reference:
  - The 4-layer Hybrid Mind model composed end-to-end. No single article — this is the pipeline form.

- What the tool does:
  - Chains anchor → logic → mesh → gate with auto-gating: if any stage returns `block` or `flag`, downstream stages are skipped.
  - Reports which stages ran, which were skipped, and where the pipeline stopped.

- Why this maps:
  - Hybrid Mind's design principle: *signal must be classified before reasoning can proceed; reasoning must be validated before impact estimation; impact must be assessed before governance gate*. The order matters and the short-circuit matters.

---

## Partial mapping

### `mesh_simulate` ↔ Multi-Agent Paradox (partial)

- Library essay:
  - [Multi-Agent Paradox](https://jipro-ai.github.io/profji-library/articles/multi-agent-paradox/) — coordination failures when multiple agents share state.

- Why partial:
  - `mesh_simulate` covers the *downstream blast radius* part of Multi-Agent Paradox (Agent B depends on this table; this delete cascades).
  - It does **not** cover the *coordination* part (two agents racing on shared state, lock contention, eventual consistency). That part is unimplemented in this package.
  - Treat `mesh_simulate` as "blast radius mapping for a single proposed action", not as a multi-agent coordination model.

- If you need full multi-agent coordination handling, this package is not the right layer. Combine with a workflow orchestrator (e.g. LangGraph, Temporal) that owns state coordination.

---

## How to use this mapping

- If you are **reading the library essays first**, treat each tool as one
  way to operationalize the diagnostic. The essay defines the *failure
  mode*; the tool produces a *measurable signal* for it.

- If you are **using the tools first**, read the corresponding essay when
  you want to understand *why* the threshold or sequence exists — most of
  the design decisions are explained in the library, not in code comments.

- If you find a failure mode in your own agent system that is *not*
  covered by any of these six tools: write up the failure (root cause,
  reproducibility, your domain context). That is the kind of input that
  produces the next library essay → next tool cycle.
