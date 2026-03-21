# Integration Patterns

Three common patterns for integrating Cognitive Bullwhip Diagnostics into existing systems.

---

## Pattern A: Pre-Execution Gate

The most common pattern. Place the full pipeline between your agent's reasoning output and any irreversible action.

```
LLM Agent Output
    │
    ▼
┌─────────────┐
│ sc_pipeline  │  anchor → logic → mesh → gate
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
 pass    block/escalate
   │       │
   ▼       ▼
Execute  Human Review
```

**When to use**: Any system where an AI agent can trigger real-world actions — API calls, database writes, trades, deployments, emails.

**MCP configuration**:

```json
{
  "mcpServers": {
    "structured-cognition": {
      "command": "npx",
      "args": ["@agdp/structured-cognition"]
    }
  }
}
```

Your agent calls `sc_pipeline` before executing any action. If the pipeline returns `pass`, proceed. If `flag` or `block`, route to human review or retry with modified parameters.

**Key principle configuration**:

```json
{
  "principles": [
    {
      "id": "P001",
      "rule": "No database writes without backup confirmation",
      "threshold": "contains write",
      "on_violation": "escalate"
    },
    {
      "id": "P002",
      "rule": "API calls to production require risk < 50",
      "threshold": "risk > 50",
      "on_violation": "block"
    }
  ],
  "confidence_floor": 0.70
}
```

---

## Pattern B: Historical Audit

Use `bullwhip_diagnose` to analyze past decisions and detect amplification patterns retroactively. No pipeline integration required — works on decision logs.

```
Decision Log (last N decisions)
    │
    ▼
┌────────────────────┐
│ bullwhip_diagnose   │  Scans for amplification
└──────────┬─────────┘
           │
    ┌──────┴──────┐
    │             │
 inactive      ACTIVE
    │             │
    ▼             ▼
 Continue    Deploy recommended
             intervention tool
```

**When to use**: Post-incident analysis, weekly system health checks, monitoring agent quality over time.

**Input format**: Array of decision log entries with timestamps, summaries, outcomes, and variance scores.

```json
{
  "decision_log": [
    {
      "timestamp": "2026-03-15T10:00:00Z",
      "input_summary": "Customer complaint about order #1234",
      "decision_made": "Issued full refund without review",
      "outcome": "unexpected",
      "variance_score": 0.85
    }
  ],
  "system_context": {
    "agent_count": 3,
    "connected_systems": ["CRM", "Payment Gateway", "Inventory"],
    "observation_window": "last_7d"
  }
}
```

**Reading the output**:
- `severity_score` > 60 = active problem, deploy recommended tool
- `amplification_map.origin_layer` = where the distortion starts
- `pattern_type` = which failure mode (noise_sensitivity, reasoning_drift, myopic_optimization, misaligned_autonomy)
- `recommended_intervention.primary_skill` = which tool to deploy first

---

## Pattern C: Pipeline Middleware

Embed individual tools at specific points in a multi-agent workflow. Use this when you need surgical intervention at one layer, not the full pipeline.

```
Agent A (Research)
    │
    ├── anchor_classify ← classify signal before passing downstream
    │
    ▼
Agent B (Analysis)
    │
    ├── logic_sequence ← enforce reasoning order
    │
    ▼
Agent C (Execution)
    │
    ├── mesh_simulate ← check blast radius before action
    │
    ▼
Agent D (Governance)
    │
    ├── gate_validate ← final governance check
    │
    ▼
Output
```

**When to use**: Multi-agent systems where you know which layer has the highest amplification risk. Deploy the matching tool at that layer.

**Tool-to-layer mapping**:

| If amplification at... | Deploy... | At... |
|----------------------|-----------|-------|
| Input layer | `anchor_classify` | Before first agent processes signal |
| Reasoning layer | `logic_sequence` | Between research and analysis agents |
| Execution layer | `mesh_simulate` | Before any agent executes real-world actions |
| Output layer | `gate_validate` | Before final output is committed |

**Example — adding `anchor_classify` to an existing agent**:

Your agent calls `anchor_classify` with the raw input before processing:

```
Tool call: anchor_classify
Input: { "raw_input": "<user message>", "input_type": "prompt", "context_window": [...] }

If result.status === "pass" → proceed with normal agent logic
If result.status === "flag" → request clarification from user
If result.status === "block" → reject input, explain why
```

---

## Threshold Tuning

All thresholds are in `src/engine/thresholds.ts`. Key values:

| Threshold | Default | Effect |
|-----------|---------|--------|
| `ANCHOR.CONFIDENCE_AUTO_FLAG` | 0.6 | Inputs below this confidence are auto-flagged |
| `MESH.RISK.FLAG_ABOVE` | 70 | Risk scores above this trigger flag |
| `MESH.RISK.BLOCK_ABOVE` | 90 | Risk scores above this auto-block |
| `GATE.DEFAULT_CONFIDENCE_FLOOR` | 0.70 | Agent confidence below this escalates |
| `GATE.RISK_AUTO_BLOCK` | 90 | Risk above this blocks regardless of principles |
| `BULLWHIP.RATIO_CONFIRM` | 3.0 | Amplification ratio above this confirms active bullwhip |

Adjust these based on your system's risk tolerance. Lower thresholds = more conservative (more blocks). Higher thresholds = more permissive (fewer interruptions).
