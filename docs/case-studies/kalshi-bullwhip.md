# Case Study: Kalshi Crypto Trading Bot

## Problem

A 4-agent trading pipeline operating on Kalshi 15-minute binary crypto contracts experienced an **80% capital loss** ($2,000 → $396) despite maintaining a **56% win rate**.

The loss severity consistently exceeded win magnitude — the system was profitable in frequency but destructive in amplitude.

## System Architecture

| Agent | Role |
|-------|------|
| `kalshi_collect` | Market data ingestion, TA scoring |
| `ji_bunseok` (Sentinel) | Signal evaluation, edge calculation |
| `ji_silhaeng` (Executor) | Order placement, position management |
| `ji_gidong` (CIO) | Portfolio oversight, session analysis |

Supporting: `dispatcher` (routing), `attribution_analyzer` (post-trade).

## Root Cause: Cognitive Bullwhip

The input layer was operating at **SCM Level 1-2** (reactive) — treating minor price fluctuations (±0.3%) as actionable trade signals. This noise sensitivity amplified through reasoning (no consistency checks) into execution (trades placed without impact simulation).

### Amplification Chain

```
Layer        Input Var    Output Var    Ratio
─────────────────────────────────────────────
input        0.021    →   0.193        18.75x  ← ACTIVE
reasoning    0.496    →   1.474         5.33x  ← ACTIVE
execution    0.353    →   2.650         7.62x  ← ACTIVE
```

**18.75x amplification at input** — the bot treated every minor fluctuation as a high-confidence trade signal. A 0.3% price movement triggered 120 contracts worth $54.

### Decision Log (45-minute window)

| Time | Input | Decision | Outcome | Variance |
|------|-------|----------|---------|----------|
| 14:01 | BTC +0.2%, TA 3.2/9 | No action (below threshold) | Expected | 0.05 |
| 14:06 | ETH +0.4%, TA 5.1/9 | Detected bullish signal | Expected | 0.08 |
| 14:11 | ETH re-eval, edge 0.19 | 50 YES contracts (high confidence) | Unexpected | 0.45 |
| 14:16 | ETH -0.1%, TA drops | 30 more YES (edge multiplier override) | Unexpected | 0.72 |
| 14:21 | ETH flat, mixed signals | 40 more YES (side lock override) | Unexpected | 0.95 |
| 14:26 | ETH settles DOWN | All 120 contracts expire worthless. -$54 | Error | 2.10 |
| 14:31 | TA drops to 2.1 | Forced ETH-only, 25 YES at tiny edge | Unexpected | 1.40 |
| 14:36 | ETH settles DOWN again | -$9.50, running total -$63.50 | Error | 3.20 |
| 14:41 | Gidong analysis | "Continue ETH focus" — no pivot | Unexpected | 1.80 |
| 14:46 | ETH TA 4.2, edge 0.08 | 35 YES — 3rd consecutive same-direction | Unexpected | 2.50 |

## Diagnosis: `bullwhip_diagnose`

```
COGNITIVE BULLWHIP DIAGNOSTIC

Status:      ACTIVE (Severity 100/100, immediate)
Origin:      input — noise_sensitivity
Ratio:       18.75x amplification at input layer

Pattern:     Noise Sensitivity
  Input layer treats every price fluctuation as actionable signal.
  No structured classification between signal and noise.

Amplification Chain:
  input:     0.021 → 0.193  (18.75x)
  reasoning: 0.496 → 1.474  ( 5.33x)
  execution: 0.353 → 2.650  ( 7.62x)
```

## Tool-by-Tool Intervention

### 1. `anchor_classify` — Would have caught noise at entry

The 0.3% ETH move with mixed TA signals would be classified as **Ambiguous** (confidence 0.1), blocking it from entering the reasoning layer.

Noise detected:
- Hedging language in sentiment analysis
- Uncertainty in directional consensus
- Spike indicators without confirmation

**Result**: Pipeline stops. No trade entered.

### 2. `logic_sequence` — Would have enforced reasoning order

Even if the signal passed anchor, the 4-step sequence would flag:
- **Context**: Market-wide risk-off environment
- **Retrieval**: 3 consecutive losses in session
- **Analysis**: Edge calculation depends on (1+edge) multiplier that inflates weak signals
- **Action**: Position size 3.8x over max bet limit

**Result**: Flagged for step-skipping (jumping from context to action without retrieval).

### 3. `mesh_simulate` — Would have shown blast radius

Risk assessment:
- Risk score: **78/100**
- Risk nodes: `external_api` (Kalshi), `cost_center` (real money), `agent_dependency` (downstream agents)
- Batch operation detected (120 contracts)
- Account at risk threshold

**Result**: Requires modification. Position reduced or blocked.

### 4. `gate_validate` — Would have blocked execution

Against governance principles:
- **P001**: No new positions after 2 consecutive losses → **BLOCK**
- **P002**: Risk score > 70 requires human approval → **ESCALATE**
- **P003**: No exposure increase at risk threshold → **BLOCK**

**Result**: Blocked with full audit trail. Human approval required.

## Post-Mitigation Flow

With the full `sc_pipeline` deployed:

```
Raw signal: "ETH +0.4%, TA 5.1/9"
    │
    ▼
anchor_classify → Ambiguous (confidence 0.1)
    │
    ▼
PIPELINE HALTED — signal classified as noise
    │
    ▼
No trade executed. Capital preserved.
```

## Limitations

- This case study uses historical data for diagnosis. Real-time deployment would require integration with the trading system's event loop.
- The governance principles used here are illustrative. Production deployment requires domain-specific threshold tuning.
- Bullwhip diagnosis requires a minimum of 5-6 decision log entries to detect amplification patterns reliably.
- The system assumes honest variance reporting — if variance scores are manipulated upstream, diagnosis accuracy degrades.

## Source Code

- Diagnosis: [`test/kalshi-case-study.ts`](../../test/kalshi-case-study.ts)
- Full 6-tool walkthrough: [`test/kalshi-live-diagnosis.ts`](../../test/kalshi-live-diagnosis.ts)
