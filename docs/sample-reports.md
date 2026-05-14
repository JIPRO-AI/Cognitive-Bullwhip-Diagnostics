# Sample Reports — What the User Actually Sees

Every tool returns two blocks:

1. **`diagnostic_report`** — human-readable text (shown below)
2. **structured JSON** — the same findings as machine-readable fields

This page shows the *human-readable* block for a representative call of each
tool. These are real outputs, captured from `test/readable-output-check.ts`
(`npx tsx test/readable-output-check.ts`).

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

Recommended Actions:
  1. [NOW]   Apply logic-stack -- Reasoning layer produces inconsistent logic across runs...
  2. [NEXT]  Enable step trace logging for each run
  3. [LATER] Re-measure after 10-20 new decisions

Logic Trace:

  1. VARIANCE SCAN
     Scanned 6 decisions over last_1h. 2 layer(s) showed output variance exceeding input variance by more than 3x. Highest amplification: 35.42x at reasoning layer.

  2. ORIGIN TRACE
     Amplification originated at reasoning layer. First anomaly detected at 2026-02-26T10:05:00Z -- Classified bullish. This 35.42x variance propagated through execution, compounding at each step.

  3. PATTERN CLASSIFICATION
     Classified as reasoning_drift. Evidence: agent applied different evaluation criteria across consecutive runs on similar input...
```

**What the user gets**: a one-line verdict (`ACTIVE`, severity 100), the
*origin layer* (reasoning, not execution — the failure started 2 steps
before it became visible), the exact amplification ratio, and a prioritized
NOW / NEXT / LATER action list. The Logic Trace explains *how* the tool
reached the verdict — no black box.

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
```

**What the user gets**: an immediate `PROCEED: NO`, the *exact noise items*
that lowered confidence (so the user knows what to clarify), and a "cleaned
signal" with the hedging stripped out — useful if they want to re-submit a
clear version.

---

## 3. `logic_sequence` — reasoning sequence enforcement

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

Reasoning Trace:
  1. CONTEXT
     Context verified: 3 context item(s) available...
  2. RETRIEVAL
     No critical information gaps identified...
  3. ANALYSIS
     Analyzed prompt signal against 3 context item(s). Signal content is consistent with provided context...
  4. ACTION
     Proceed with modification action on prompt input...
```

**What the user gets**: confirmation that all 4 reasoning steps ran *in
order* (no step-skipping), the risk horizon, and a per-step trace. If a step
had been skipped, it would show under `Skipped:` and the status would not be
`COMPLETE`.

---

## 4. `mesh_simulate` — downstream impact simulation

**Scenario**: a batch deletion of 50,000 records on a production database
with known dependents.

```
--------------------------------------------------
CAUSAL MESH -- IMPACT SIMULATION
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
  Modified: ... -- Suggested: split into smaller batches with intervals between each; add a dry-run or preview step before final execution; execute sequentially with health checks between each system

Modification Reason:
  Risk score 100 exceeds safe threshold. 3 system nodes affected -- multi-system impact increases cascading risk.
```

**What the user gets**: a hard `BLOCKED` with risk 100, the *specific
systems* that would be affected (database, cache, dependent agents), the
secondary effects, and — importantly — an **adjusted recommendation**: a
safer way to do the same thing (smaller batches, dry-run, health checks).
The tool does not just say "no", it says "not like this — like this instead."

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

Principles Checked: 2
  Passed:   [P001]
  Violated: [P003]

Violations:
  1. P003: Refunds above $500 require human approval
     Triggered by: amount: 1200 > 500

Decision Summary:
  Escalated: "Process refund of $1,200 for order #5678" -- 1 principle violation(s) require human review.

Audit Trace:
  1. PRINCIPLE_CHECK   Checked 2 principle(s). 1 passed, 1 violated. Violations: P003.
  2. CONFIDENCE_RISK_CHECK   Confidence 0.85 above floor. Risk 45/100 within range.
  3. FINAL_DECISION   Escalation required. P003 triggered by amount: 1200 > 500.
```

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
```

**What the user gets**: in Scenario A, an `ESCALATED` verdict with the
*exact principle and the exact reason* it fired (`amount: 1200 > 500`), plus
an audit trace with a timestamp — defensible later. In Scenario B, the tool
correctly *does not* fire on "delete" because it is negated ("prevent
deletion") — no false-positive escalation on protective phrasing.

---

## 6. `sc_pipeline` — full auto-gating pipeline

`sc_pipeline` runs all four core tools in order and stops at the first
`block` / `flag`. Its report begins with a one-screen summary, then includes
each stage's full report:

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
  ... (full anchor / logic / mesh / gate reports follow) ...
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
every time. There is no LLM inside the tools — the report is assembled from
threshold-based analysis only.
