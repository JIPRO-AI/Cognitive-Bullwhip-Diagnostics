# @agdp/structured-cognition

**MCP server for diagnosing and fixing reasoning failures in AI agent systems.**

6 middleware tools that sit between your agent's input and execution. Each targets a specific failure layer — noisy inputs, reasoning drift, cascading side effects, governance violations. Every output is deterministic, structured JSON with a full audit trace.

Built on the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP).

## Quick Start

```bash
npx @agdp/structured-cognition
```

Or add to your MCP config (Claude Desktop, OpenClaw, etc.):

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

## Tools

| Tool | What It Does | When to Use |
|------|-------------|-------------|
| `bullwhip_diagnose` | Scans decision history for amplification patterns | Agent outputs are erratic or failing unpredictably |
| `anchor_classify` | Classifies input as Action / Observation / Ambiguous | Before acting on user input or events |
| `logic_sequence` | Enforces Context > Retrieval > Analysis > Action | Same input produces different outputs across runs |
| `mesh_simulate` | Simulates downstream impact before execution | Action touches APIs, databases, or other agents |
| `gate_validate` | Validates against governance rules + audit trail | Before any irreversible action |
| `sc_pipeline` | Runs all 4 core tools in sequence with auto-gating | End-to-end validation |

## Architecture

```
Input --> [SignalAnchor] --> [LogicStack] --> [CausalMesh] --> [PrincipleGate] --> Output
              |                  |                |                  |
           Classify          Sequence         Simulate          Validate
         Action/Obs/Amb    4-step enforce    Risk 0-100      Approve/Block
```

The pipeline auto-gates: if any stage flags or blocks, downstream stages are skipped and the blocking reason is returned.

## How It Works

Each tool returns **two content blocks**:
1. **Human-readable report** — show directly when user says "diagnose" or "check this"
2. **Structured JSON** — use programmatically to fix code or explain findings

All scoring is **100% deterministic** — no LLM inside the tools. Pure threshold-based analysis.

## Example: Cognitive Bullwhip Diagnostic

```typescript
bullwhip_diagnose({
  decision_log: [
    { timestamp: "...", input_summary: "BTC +0.3%", decision_made: "Logged", outcome: "expected", variance_score: 0.08 },
    { timestamp: "...", input_summary: "Volume spike", decision_made: "Prepared YES order", outcome: "unexpected", variance_score: 0.85 },
    // ... more decisions showing amplification
  ],
  system_context: { agent_count: 3, observation_window: "last_1h" }
})
```

Output:
```
COGNITIVE BULLWHIP DIAGNOSTIC
Status:  ACTIVE (Severity 100/100, immediate)
Origin:  input -- noise_sensitivity
Ratio:   18.75x amplification at input layer

Recommended: SignalAnchor ($0.30)
  Input layer is over-triggering on noise. SignalAnchor classifies
  each input as Action/Observation/Ambiguous before execution.
```

## Tool Details

### bullwhip_diagnose
Detects cognitive bullwhip — where small input variations produce disproportionate output swings. Classifies patterns into 4 types: noise_sensitivity, reasoning_drift, myopic_optimization, misaligned_autonomy.

### anchor_classify
Classifies input signals before execution. Detects hedging language, uncertainty markers, spike indicators, and dangerous action keywords. Returns cleaned signal with noise removed.

### logic_sequence
Enforces 4-step reasoning sequence (Context > Retrieval > Analysis > Action). Checks for information gaps, classifies risk horizon (immediate/short-term/structural), and validates historical consistency.

### mesh_simulate
Maps system nodes affected by a proposed action. Evaluates risk across APIs, databases, caches, agents, cost centers. Returns adjusted recommendation when risk is too high.

### gate_validate
Validates decisions against user-defined governance rules. Supports keyword matching with English morphology (catches "deletion" from "delete", "overwritten" from "overwrite"), numeric thresholds, and action type matching.

### sc_pipeline
Chains all 4 tools: SignalAnchor > LogicStack > CausalMesh > PrincipleGate. Each stage gates the next — if one blocks, pipeline stops and returns the blocking reason.

## Testing

```bash
npm test     # Runs 58 E2E tests across all 6 tools
```

## Case Study

See `test/kalshi-case-study.ts` for a real-world case study diagnosing a crypto trading bot:
- 4-agent system on Kalshi 15-min binary contracts
- 18.75x amplification detected at input layer
- Pattern: noise_sensitivity (treating market noise as actionable signals)
- Recommended fix: SignalAnchor middleware

## Development

```bash
git clone https://github.com/JIPRO-AI/structured-cognition-server.git
cd structured-cognition-server
npm install
npm run dev     # Development mode (tsx)
npm run build   # TypeScript compile
npm test        # Run E2E tests
```

## Links

- [AGDP Marketplace](https://agdp.io/agent/3387) — Axiom Agent #3387
- [GitHub](https://github.com/JIPRO-AI/structured-cognition-server)

## License

MIT
