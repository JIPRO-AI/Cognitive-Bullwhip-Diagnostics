# Sample Reports — What the User Actually Sees

Every tool returns two blocks:

1. **`diagnostic_report`** — human-readable text (shown below)
2. **structured JSON** — the same findings as machine-readable fields

This page shows the *human-readable* block for a representative call of each
tool. These are real outputs, captured from `test/readable-output-check.ts`
(`npx tsx test/readable-output-check.ts`).

Every report ends with a **`Counterfactual:`** line — a *descriptive*
statement of what would have stayed unseen without the tool. It is never a
claim that the tool "prevented" anything: this is a diagnostic/middleware
package, not a proven incident-prevention system.

When an MCP client (Claude Desktop, Cursor) calls a tool and the user says
"run it" / "diagnose" / "show me", the client shows Block 1 as-is. When the
user says "fix this based on the diagnosis", the client reads Block 2 (JSON)
and reasons over it.

---

## 1. `bullwhip_diagnose` — historical amplification scan

**Scenario**: a 6-step trading decision log where variance grows from 0.08
to 3.80 — classic compounding failure.

```
---------------------------------------------
COGNITIVE BULLWHIP DIAGNOSTIC
---------------------------------------------

Status:      ACTIVE (Severity 100/100, immediate)
Origin:      reasoning -- reasoning_drift
Ratio:       35.42x amplification at reasoning layer
Confidence:  medium (events analyzed: 6)

Impact Forecast (24h):
  If unchanged, reasoning drift will continue amplifying. Estimated severity: 100/100 within 24 hours without intervention.

Amplification Path:
  Origin: reasoning layer (decision #2)
  The reasoning layer shows the widest gap between input and output variance (35.42x). First decision in this layer: "Classified bullish" (outcome: unexpected).
  - input_to_reasoning: Average output variance amplified (0.08 -> 1) across the input -> reasoning boundary.
  - reasoning_to_execution: Average output variance amplified (1 -> 3.15) across the reasoning -> execution boundary.

Recommended Actions:
  1. [NOW]   Apply logic-stack -- Reasoning layer produces inconsistent logic across runs...
  2. [NEXT]  Enable step trace logging for each run
  3. [LATER] Re-measure after 10-20 new decisions

Logic Trace:

  1. VARIANCE SCAN
     Scanned 6 decisions over last_1h. 2 layer(s) showed output variance exceeding input variance by more than 3x...

  2. ORIGIN TRACE
     Amplification originated at reasoning layer. First anomaly detected at 2026-02-26T10:05:00Z -- Classified bullish...

  3. PATTERN CLASSIFICATION
     Classified as reasoning_drift. Evidence: agent applied different evaluation criteria across consecutive runs...

Diagnostic Completeness:
  Score: 0.8 / 1.00 (high)
  Limitations:
    - 6 decision entries provided -- usable, but 10+ gives a higher-confidence pattern.
    - Variance scores were supplied by the caller -- the diagnosis is only as reliable as those scores.
    - No expected_behavior provided -- outcomes are classified on their own text, not against a stated baseline.
    - Layer assignment is heuristic (inferred from outcome/variance progression), not a traced execution graph.
  To improve this diagnosis:
    - Add ~10+ decisions for a higher-confidence diagnosis.
    - Provide expected_behavior: what the agent SHOULD have done.

Counterfactual:
  Without this diagnosis, the 35.42x amplification at the reasoning layer would keep compounding with its origin and pattern unattributed.
```

**What the user gets**: a one-line verdict (`ACTIVE`, severity 100), the
*origin layer* (reasoning, not execution — the failure started 2 steps
before it became visible), the **Amplification Path** showing how variance
grew across each layer boundary, a **Diagnostic Completeness** score that
says how much to trust this read given the inputs, and a prioritized
NOW / NEXT / LATER action list.

> **`raw_events` input variant.** Instead of a pre-scored `decision_log`,
> you can pass a loose `raw_events` log plus a `variance_strategy`
> (`outcome_deviation` / `decision_flip` / `execution_loss`). If you pass
> `raw_events` *without* a strategy, the report instead reads
> `Status: NEEDS INPUT -- variance strategy not selected` and lists the
> candidate strategies for the user to choose from — the tool never picks a
> variance definition on the user's behalf. See
> [`limitations.md`](limitations.md#4-bullwhip-variance-is-caller-defined-not-package-invented).

---

## 2. `anchor_classify` — input signal classification

**Scenario**: a hedged, dangerous request — `"I think we should maybe purge
the user database?"`

```
--------------------------------------------------
SIGNAL ANCHOR -- INPUT CLASSIFICATION
--------------------------------------------------

Status:      FLAGGED
Signal Type: ambiguous
Confidence:  0.1
Proceed:     NO

Noise Detected (4):
  1. hedging language: 'maybe'
  2. hedging language: 'i think'
  3. uncertainty marker: '?'
  4. irreversible action keyword combined with uncertainty

Cleaned Signal:
  "we should purge the user database?"

Decision:
  Confidence 0.1 below threshold 0.6. Input contains too much noise or insufficient context to classify safely. Clarification required before any action.

Logic Trace:

  1. SIGNAL_ISOLATION
     Received prompt input (48 chars). Detected 4 noise indicator(s)...
  2. CONTEXT_DEFINITION
     Context window contains 0 item(s). No background context provided...

Counterfactual:
  Without SignalAnchor, this input would have continued into the reasoning stage with its signal type unverified -- an ambiguous or observation-only signal treated as a clear action.
```

**What the user gets**: an immediate `PROCEED: NO`, the *exact noise items*
that lowered confidence (so the user knows what to clarify), a "cleaned
signal" with the hedging stripped out, and a counterfactual that names what
this input would have done downstream without the check.

---

## 3. `logic_sequence` — reasoning sequence check

**Scenario**: a well-formed price update with full context.

```
--------------------------------------------------
LOGIC STACK -- REASONING SEQUENCE
--------------------------------------------------

Status:       COMPLETE
Confidence:   1
Risk Horizon: short_term
Action Ready: YES
Action Type:  modification

Sequence: Context -> Retrieval -> Analysis -> Action
  Completed: [context -> retrieval -> analysis -> action]

Recommendation:
  Proceed with modification action on prompt input...

Consistency Check:
  Prior Pattern: NO
  Status: no_history

Reasoning Trace:

  1. CONTEXT
     Context verified: 3 context item(s) available...
  2. RETRIEVAL
     No critical information gaps identified...
  3. ANALYSIS
     Analyzed prompt signal against 3 context item(s). Signal content is consistent with provided context...
  4. ACTION
     Proceed with modification action on prompt input...

Counterfactual:
  Without LogicStack, there would be no record that the full Context -> Retrieval -> Analysis -> Action sequence ran before this action.
```

**What the user gets**: confirmation that all 4 reasoning steps ran *in
order* (no step-skipping), the risk horizon, a per-step trace, and a
counterfactual. If a step had been skipped, it would show under `Skipped:`
and the status would not be `COMPLETE`. (The consistency check is a
placeholder — it always reports `no_history`; see
[`limitations.md`](limitations.md).)

---

## 4. `mesh_simulate` — downstream impact estimation

**Scenario**: a batch deletion of 50,000 records on a production database
with known dependents.

```
--------------------------------------------------
CAUSAL MESH -- IMPACT ESTIMATION
--------------------------------------------------

Status:      BLOCKED
Risk Score:  100/100
Confidence:  0.7
Safe:        NO

Direct Effect:
  deletion action: delete all expired user accounts from database, batch process all 50000 records

Risk Nodes (3):
  1. database
  2. cache_layer
  3. agent_dependency

Secondary Effects:
  1. Data integrity impact on dependent tables/caches
  2. Cache invalidation may affect downstream read performance
  3. Downstream agents may be blocked or receive inconsistent input

Adjusted Recommendation:
  Modified: ... -- Suggested: split into smaller batches with intervals between each; add a dry-run or preview step before final execution...

Modification Reason:
  Risk score 100 exceeds safe threshold. 3 system nodes affected -- multi-system impact increases cascading risk.

Estimation Trace:
  1. NODE_MAPPING ...
  2. RISK_SIMULATION ...
  3. HORIZON_ANALYSIS ...

Counterfactual:
  Without CausalMesh, this action would proceed with no estimate of the downstream systems it touches.
```

**What the user gets**: a hard `BLOCKED` with risk 100, the *specific
systems* that would be affected (database, cache, dependent agents), the
secondary effects, an **adjusted recommendation** (a safer way to do the
same thing), and a counterfactual. Note the name: this is an *estimation*
from the text you provided — it scans for keywords, it does not read a real
dependency graph. See [`limitations.md`](limitations.md#4b-mesh_simulate-is-keyword-based-heuristic-estimation-not-graph-simulation).

---

## 5. `gate_validate` — governance check

**Scenario A**: a $1,200 refund where policy requires approval above $500.

```
--------------------------------------------------
PRINCIPLE GATE -- GOVERNANCE CHECK
--------------------------------------------------

Status:       ESCALATED
Decision:     escalate
Confidence:   0.85
Authority:    human
Timestamp:    2026-01-01T00:00:00.000Z

Principles Checked: 2
  Passed:   [P001]
  Violated: [P003]

Violations:
  1. P003: Refunds above $500 require human approval
     Triggered by: amount: 1200 > 500

Escalation Required: YES
  Reason: 1 principle violation(s) detected: P003...

Decision Summary:
  Escalated: "Process refund of $1,200 for order #5678" -- 1 principle violation(s) require human review.

Audit Trace:
  1. PRINCIPLE_CHECK   Checked 2 principle(s). 1 passed, 1 violated. Violations: P003.
  2. CONFIDENCE_RISK_CHECK   Confidence 0.85 above floor. Risk 45/100 within range.
  3. FINAL_DECISION   Escalation required. P003 triggered by amount: 1200 > 500.

Counterfactual:
  Without PrincipleGate, this action would have proceeded autonomously instead of being routed for human review.
```

> The `Timestamp:` line above is fixed because the call passed an explicit
> `decision_timestamp`. Omit it and the gate stamps runtime instead — that
> audit timestamp is the *only* non-deterministic field in the whole
> package. See [Design Principles](../README.md#design-principles).

**Scenario B** (negation context): protective phrasing — `"Prevent deletion
of system-critical records during maintenance"` — with a principle that
blocks anything containing "delete".

```
--------------------------------------------------
PRINCIPLE GATE -- GOVERNANCE CHECK
--------------------------------------------------

Status:       APPROVED
Decision:     execute

Principles Checked: 1
  Passed:   [P007]
  Violated: [none]

Decision Summary:
  Approved: "Prevent deletion of system-critical records during maintenance" -- all principles passed.

Counterfactual:
  Without PrincipleGate, this action would still proceed, but with no audit trail of the principles it was checked against.
```

**What the user gets**: in Scenario A, an `ESCALATED` verdict with the
*exact principle and the exact reason* it fired (`amount: 1200 > 500`), an
audit trace with a timestamp, and a counterfactual stating what would have
happened to the action without the gate. In Scenario B, the tool correctly
*does not* fire on "delete" because it is negated ("prevent deletion") — no
false-positive escalation on protective phrasing.

---

## 6. `sc_pipeline` — full auto-gating pipeline

`sc_pipeline` runs all four core tools in order and stops at the first
`block` / `flag`. Its report begins with a one-screen summary, then includes
each stage's full report (each carrying its own `Counterfactual:` line):

```
==================================================
STRUCTURED COGNITION PIPELINE
==================================================

Result:     ALL CLEAR
Stopped At: (completed all stages)
Confidence: 0.84
Stages:     4/4 completed

Stage Summary:
  [PASS] SignalAnchor   conf=0.8  signal=action, noise=0
  [PASS] LogicStack     conf=1    steps=4/4, horizon=short_term
  [PASS] CausalMesh     conf=0.56 risk=20/100, nodes=0
  [PASS] PrincipleGate  conf=1    decision=execute, violations=0

==================================================
STAGE DETAILS
==================================================
  ... (full anchor / logic / mesh / gate reports follow, each ending in a Counterfactual line) ...
```

**What the user gets**: a single scannable verdict line, a 4-row stage
summary (which stage passed/failed at a glance), and — below it — the full
per-stage detail. If the pipeline had stopped early, `Stopped At:` would
name the stage and the skipped stages would be listed.

---

## Reading guidance for MCP clients

| User says... | Client should... |
|---|---|
| "run it" / "diagnose" / "show me" | Show **Block 1** (`diagnostic_report`) as-is. Do not summarize. |
| "fix this based on the diagnosis" | Read **Block 2** (JSON), reason over the structured fields, propose changes. |
| "explain" / "what's wrong" | Use both — JSON for facts, report for the human framing. |

All reports are deterministic: the same input produces the same report,
every time (the audit timestamp aside — pass `decision_timestamp` to pin
that too). There is no LLM inside the tools — the report is assembled from
threshold-based analysis only. Verified by `npm run test:determinism`.
