# Cognitive Bullwhip Diagnostics

**Deterministic middleware for detecting and correcting reasoning failures in LLM-based agent systems.**

[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io/)
[![Tests](https://img.shields.io/badge/tests-58%20passing-green)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem

In physical supply chains, the **Bullwhip Effect** describes how small demand fluctuations at the retail level amplify into massive production swings upstream — a 5% change in consumer demand can cause a 40% production variance at the manufacturer (Lee, Padmanabhan & Whang, 1997; Forrester, 1961).

The same amplification dynamic exists inside **multi-layer AI agent systems**. A minor misclassification at the input layer propagates through reasoning, execution, and output — compounding at each stage. By the time the failure is visible, the root cause is buried 3-4 layers back.

This project implements the diagnostic and intervention layer of the **Structured Cognition Model (SCM)** — a six-level cognitive maturity framework paired with an eight-step reasoning protocol, originally developed to reduce interpretation variance in operational environments (Ji, 2026). When AI systems began exhibiting the same interpretation flaws as early-stage human cognition, the model evolved into an enforceable reasoning layer for enterprise AI.

---

## Theoretical Foundation

### The Cognitive Bullwhip Effect

The **Cognitive Bullwhip Effect** (Ji, 2026) extends the supply chain amplification model to cognitive decision pipelines. Just as minor demand fluctuations cause massive upstream volatility in physical supply chains, minor differences in signal interpretation cause massive variance in agent decision-making.

> *"Processes can be standardized, but if the reasoning behind those processes remains unstandardized, variance simply migrates from execution to interpretation."*
> — SCM White Paper v2.4

**The mechanism**: In a multi-agent pipeline, a single ambiguous input (e.g., a 0.3% price movement) is interpreted by the first agent. If that agent lacks structured signal classification, it may treat noise as signal. The next agent amplifies the misclassification through its own reasoning. By the execution layer, a trivial fluctuation has become a high-confidence trade, a database write, or an irreversible API call.

| Layer | Supply Chain Analog | Agent System | Cognitive Failure Mode |
|-------|-------------------|--------------|----------------------|
| **Input** | Retail demand signal | Raw prompt / event / data | Noise treated as signal (Levels 1-2) |
| **Reasoning** | Distributor forecasting | Context retrieval + analysis | Step-skipping, inconsistent logic (Level 2-3) |
| **Execution** | Manufacturer production | API calls, DB writes, tool use | Local optimization without global impact (Level 3-4) |
| **Output** | Supplier raw materials | Final decision / response | Governance violations, drift (Level 4-5) |

**Amplification ratio** = output variance / input variance at each layer. A ratio > 3.0x at any single layer indicates active bullwhip.

### The Structured Cognition Model (SCM)

SCM defines six levels of cognitive maturity observed across 135+ operational cycles:

| Level | Label | Reasoning Mode | Decision Variance | Agent Analog |
|-------|-------|---------------|-------------------|--------------|
| 1 | **Responder** | Reactive — single metric, no context | High | Raw LLM with no guardrails |
| 2 | **Actor** | Adds basic checks before reacting | High | LLM with simple prompts |
| 3 | **Designer** | Builds repeatable analysis templates | Moderate | Agent with structured prompts |
| 4 | **Operator** | Runs structured logic every cycle | Low | Agent with enforced protocol |
| 5 | **Architect** | Cross-functional causality, system-level | Very Low | Agent with full SCM pipeline |
| 6 | **Shaper** | Defines rules the system must follow | Minimal | Human governance layer |

The model maps directly to the **eight-step reasoning protocol**:

```
1. Signal Isolation      → What specifically changed?
2. Context Definition    → What type of data? What environment?
3. Structural Breakdown  → What dependencies exist?
4. Priority Determination → What matters most right now?
5. Risk Horizon Scan     → What's the relevant timeframe?
6. Pattern Recognition   → Signal or noise?
7. System Interpretation → How do pieces connect?
8. Principled Conclusion → Does it align with governance constraints?
```

**Sequence is non-negotiable**: Signal precedes context; context precedes structure; priority precedes risk; risk precedes pattern; pattern precedes system interpretation; principles are applied last.

### Four Pattern Types

When amplification is detected, the origin layer determines the pattern type and prescribed intervention:

| Pattern | Origin Layer | Mechanism | SCM Level Gap | Intervention |
|---------|-------------|-----------|--------------|-------------|
| **Noise Sensitivity** | Input | Agent reacts to every fluctuation as a command | L1-2 behavior at input | `anchor_classify` |
| **Reasoning Drift** | Reasoning | Non-deterministic logic produces different outputs per run | L2-3 step-skipping | `logic_sequence` |
| **Myopic Optimization** | Execution | Local task completion breaks downstream systems | L3-4 missing system view | `mesh_simulate` |
| **Misaligned Autonomy** | Output | Decisions violate governance rules without audit trail | L4-5 missing L6 principles | `gate_validate` |

### Simulation Evidence

Monte Carlo simulation (320 runs, 120 SKUs, 26 weeks) from the SCM White Paper v2.4 demonstrates the cost of cognitive variance:

| Cognitive Policy | Mean Total Cost | Mean Stockout Units | Interpretation |
|-----------------|----------------|--------------------|----|
| **Level 1 (Reactive)** | $1.19M | 1,688 | Overreacts to noise, amplifies variance |
| **Level 3 (Structured)** | $0.29M | 2,649 | Reduces cost 75%, tolerates more stockouts |
| **Level 5 (Systemic)** | $0.34M | 318 | 81% fewer stockouts vs L1, deliberate robustness |

Level 5 demonstrates that structured reasoning with deliberate safety margins outperforms both reactive and template-only approaches under operational stress.

---

## Architecture

This project implements the SCM reasoning protocol as six deterministic MCP tools:

```
                          ┌───────────────────┐
                          │ bullwhip_diagnose │  Diagnostic Layer
                          │ Scans decision    │  (SCM Steps 1, 6, 7)
                          │ history for       │  Detects active amplification
                          │ amplification     │  Recommends intervention tool
                          └───────────────────┘

Raw Input
    │
    ▼
┌──────────────────┐
│  anchor_classify │  Signal Classification (SCM Steps 1-2)
│  Action / Obs /  │  Noise isolation, confidence scoring
│  Ambiguous       │  → blocks ambiguous signals
└────────┬─────────┘
         │ (if Action)
         ▼
┌──────────────────┐
│  logic_sequence  │  Reasoning Enforcement (SCM Steps 3-4)
│  Context →       │  4-step fixed sequence
│  Retrieval →     │  Historical consistency check
│  Analysis →      │  → blocks on step-skip
│  Action          │
└────────┬─────────┘
         │ (if pass)
         ▼
┌──────────────────┐
│  mesh_simulate   │  Impact Simulation (SCM Steps 5-7)
│  Risk 0-100      │  Maps all downstream system nodes
│  Horizon analysis│  → adjusts action if risk > threshold
└────────┬─────────┘
         │ (if safe)
         ▼
┌──────────────────┐
│  gate_validate   │  Governance Validation (SCM Step 8)
│  Principles check│  Keyword matching (morphology-aware)
│  Audit trail     │  → blocks/escalates on violation
└────────┬─────────┘
         │
         ▼
    Final Decision
```

The **sc_pipeline** tool chains all four stages with automatic gating — if any stage returns `block` or `flag`, downstream stages are skipped and the blocking reason is propagated.

## Tools

| Tool | SCM Steps | Function | Output |
|------|-----------|----------|--------|
| `bullwhip_diagnose` | 1, 6, 7 | Scans decision history for amplification across 4 layers | Severity 0-100, amplification map, pattern type, recommended fix |
| `anchor_classify` | 1-2 | Classifies input as Action / Observation / Ambiguous | Signal type, confidence score, noise isolation log |
| `logic_sequence` | 3-4 | Enforces Context → Retrieval → Analysis → Action | Completed steps, risk horizon, historical consistency |
| `mesh_simulate` | 5-7 | Simulates downstream impact across connected nodes | Risk score 0-100, impact map, adjusted recommendation |
| `gate_validate` | 8 | Validates against governance rules | Approve / Escalate / Block + timestamped audit trail |
| `sc_pipeline` | 1-8 | Chains all 4 core tools with auto-gating | Per-stage results, final decision, blocking reason |

### Design Principles

- **100% Deterministic**: All scoring uses pure threshold-based analysis — no LLM calls inside any tool. This ensures Level 4 (Operator) consistency: same input always produces same output.
- **Dual-block Output**: Each tool returns (1) human-readable diagnostic report + (2) structured JSON — matching SCM's requirement for both auditability and programmatic use.
- **Auto-gating Pipeline**: If any stage blocks, downstream stages are skipped. This enforces the SCM sequence dependency: signal must be classified before reasoning can proceed.
- **Morphology-aware Matching**: Keyword detection catches inflected forms (e.g., "deletion" from "delete", "overwritten" from "overwrite") — critical for governance validation in natural language contexts.

---

## Quick Start

Add to your MCP client configuration (Claude Desktop, Cursor, etc.):

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

Or run directly:

```bash
npx @agdp/structured-cognition
```

---

## Case Study: Kalshi Crypto Trading Bot

A 4-agent trading pipeline operating on Kalshi 15-minute binary crypto contracts experienced an 80% capital loss ($2,000 → $396) despite maintaining a 56% win rate. The loss severity consistently exceeded win magnitude — the system was profitable in frequency but destructive in amplitude.

This is a textbook Cognitive Bullwhip Effect: the input layer was operating at Level 1-2 (reactive), treating minor price fluctuations as actionable signals, which amplified through Level 3 reasoning (no consistency checks) into Level 4 execution (trades executed without impact simulation).

**Diagnosis** (`bullwhip_diagnose`):

```
COGNITIVE BULLWHIP DIAGNOSTIC

Status:      ACTIVE (Severity 100/100, immediate)
Origin:      input — noise_sensitivity
Ratio:       18.75x amplification at input layer

Amplification Chain:
  input:     0.021 → 0.193  (18.75x)
  reasoning: 0.496 → 1.474  ( 5.33x)
  execution: 0.353 → 2.650  ( 7.62x)
```

**Finding**: 18.75x amplification at input confirms Level 1 reactive cognition — the bot treated ±0.3% market noise as high-confidence trade signals.

**Prescribed intervention**: `anchor_classify` to enforce signal classification before downstream execution.

Full case study: [`test/kalshi-case-study.ts`](test/kalshi-case-study.ts)

---

## Testing

```bash
npm test     # 58 E2E tests across all 6 tools
```

Coverage includes:
- Empty, clean, and amplified decision logs (`bullwhip_diagnose`)
- Ambiguous, clear, spike, and dangerous inputs (`anchor_classify`)
- Full context, missing context, and structural risk scenarios (`logic_sequence`)
- Low risk, batch operations, and API calls (`mesh_simulate`)
- Pass, escalate, block, low confidence, and morphology matching (`gate_validate`)
- Clean pass, ambiguous stop, and gate escalation pipelines (`sc_pipeline`)

---

## Development

```bash
git clone https://github.com/JIPRO-AI/Cognitive-Bullwhip-Diagnotics.git
cd Cognitive-Bullwhip-Diagnotics
npm install
npm run dev     # Development mode (tsx)
npm run build   # TypeScript compile
npm test        # 58 E2E tests
```

---

## References

### Primary Framework
- Ji, R. (2026). "SCM — The Structured Cognition Model: A Reasoning Architecture for Human and AI Operations." White Paper v2.4, Enterprise Edition.
- Ji, R. (2026). "The Architecture of a Hybrid Mind: How a Cognition Model, a Domain OS, and an AI Partnership Evolved into One System."

### Bullwhip Effect (Supply Chain)
- Lee, H.L., Padmanabhan, V., & Whang, S. (1997). "Information Distortion in a Supply Chain: The Bullwhip Effect." *Management Science*, 43(4), 546-558.
- Forrester, J.W. (1961). *Industrial Dynamics*. MIT Press.
- Sterman, J.D. (1989). "Modeling Managerial Behavior: Misperceptions of Feedback in a Dynamic Decision Making Experiment." *Management Science*, 35(3), 321-339.
- Chen, F., Drezner, Z., Ryan, J.K., & Simchi-Levi, D. (2000). "Quantifying the Bullwhip Effect in a Simple Supply Chain." *Management Science*, 46(3), 436-443.

### Cognitive Architecture & Decision Theory
- Kahneman, D. (2011). *Thinking, Fast and Slow*. Farrar, Straus and Giroux.
- Simon, H.A. (1947). *Administrative Behavior: A Study of Decision-Making Processes in Administrative Organizations*. Macmillan.
- Tversky, A. & Kahneman, D. (1974). "Judgment under Uncertainty: Heuristics and Biases." *Science*, 185(4157), 1124-1131.
- Klein, G.A. (1998). *Sources of Power: How People Make Decisions*. MIT Press.

### Technical Standards
- Model Context Protocol — [modelcontextprotocol.io](https://modelcontextprotocol.io/)

---

## License

MIT — [JIPRO-AI](https://github.com/JIPRO-AI)
