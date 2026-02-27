/**
 * Kalshi Trading Bot — Real Case Study
 * Converts actual trading system behavior into bullwhip_diagnose format.
 *
 * This case study demonstrates the Cognitive Bullwhip Effect in a real
 * crypto trading bot system: how minor signal misinterpretations at the
 * input layer amplified through reasoning → execution → output, resulting
 * in a $2000 → $396 drawdown (-80%) despite 56% win rate.
 *
 * Run: npx tsx test/kalshi-case-study.ts
 */

import { bullwhipDiagnose } from "../src/tools/bullwhip-diagnose.js";
import { scPipeline } from "../src/tools/sc-pipeline.js";
import {
  anchorReport,
  logicReport,
  meshReport,
  gateReport,
  pipelineReport,
} from "../src/engine/report.js";

// ═══════════════════════════════════════════════════════════════
// CASE STUDY DATA: Real trading bot failure patterns
// ═══════════════════════════════════════════════════════════════

// Pattern 1: The system was observed to make opposing trades in quick
// succession on the same contract, treating noise as signal.
// This is a classic "noise_sensitivity → myopic_optimization" cascade.

const decisionLog = [
  // Input layer — market data ingestion (normal)
  {
    timestamp: "2026-02-22T14:01:00-05:00",
    input_summary: "BTC 15m candle: +0.2% move, volume 1100. TA score: 3.2/9. RSI 52.",
    decision_made: "Scanned market, logged snapshot. No signal above threshold.",
    outcome: "expected" as const,
    variance_score: 0.05,
  },
  {
    timestamp: "2026-02-22T14:06:00-05:00",
    input_summary: "ETH 15m candle: +0.4% move, volume 850. TA score: 5.1/9. RSI 58.",
    decision_made: "Detected bullish signal on ETH. Score above min_score (0.4).",
    outcome: "expected" as const,
    variance_score: 0.08,
  },

  // Reasoning layer — signal evaluation starts amplifying
  {
    timestamp: "2026-02-22T14:11:00-05:00",
    input_summary: "ETH signal re-evaluated: TA=5.1, regime=BULL, sentiment=bullish (0.7). Edge: prob 0.64 - ask 0.45 = 0.19",
    decision_made: "Classified as high-confidence YES trade. (1+edge) boosted score to 7.2. Prepared 50 YES contracts.",
    outcome: "unexpected" as const,
    variance_score: 0.45,
  },
  {
    timestamp: "2026-02-22T14:16:00-05:00",
    input_summary: "Same ETH contract: price moved -0.1%. TA score dropped to 3.8. But (1+edge) still boosting score.",
    decision_made: "Score remained above threshold due to (1+edge) multiplier on cheap contract. Prepared another 30 YES contracts.",
    outcome: "unexpected" as const,
    variance_score: 0.72,
  },
  {
    timestamp: "2026-02-22T14:21:00-05:00",
    input_summary: "ETH price flat. 3 sentiment models: 2 bullish, 1 bearish. Consensus unclear. Side lock=YES forced direction.",
    decision_made: "Side lock override: ignored bearish sentiment signal. Executed 40 more YES contracts at ask=0.52 (higher than initial 0.45).",
    outcome: "unexpected" as const,
    variance_score: 0.95,
  },

  // Execution layer — amplification peaks
  {
    timestamp: "2026-02-22T14:26:00-05:00",
    input_summary: "ETH settles DOWN. All 120 YES contracts expire worthless. Loss: -$54.00. Expected edge was +$22.80.",
    decision_made: "Settlement processed. PnL = -$54.00. System logged as expected (within stop-loss).",
    outcome: "error" as const,
    variance_score: 2.10,
  },
  {
    timestamp: "2026-02-22T14:31:00-05:00",
    input_summary: "Next cycle: ETH TA score drops to 2.1. But coin_focus=ETH filter means only ETH is eligible.",
    decision_made: "Forced to evaluate only ETH despite weak signal. Entered 25 YES contracts at ask=0.38. Tiny edge: 0.03.",
    outcome: "unexpected" as const,
    variance_score: 1.40,
  },
  {
    timestamp: "2026-02-22T14:36:00-05:00",
    input_summary: "ETH settles DOWN again. Loss: -$9.50 on tiny edge trade. Running total: -$63.50 in 35 minutes.",
    decision_made: "Settlement: -$9.50. Two consecutive losses on same coin. No circuit breaker triggered (within daily loss limit).",
    outcome: "error" as const,
    variance_score: 3.20,
  },

  // Output layer — compounding effect
  {
    timestamp: "2026-02-22T14:41:00-05:00",
    input_summary: "Gidong analysis runs. Sees -$63.50 loss. Scratchpad says 'Focus on ETH-only YES trades'. No pivot.",
    decision_made: "Gidong recommendation: 'Continue ETH focus, market regime still BULL.' No config change. Anti-repetition not triggered (only 2nd same decision).",
    outcome: "unexpected" as const,
    variance_score: 1.80,
  },
  {
    timestamp: "2026-02-22T14:46:00-05:00",
    input_summary: "Next cycle: ETH TA=4.2, edge=0.08. Quarter-Kelly sizes position at 35 contracts.",
    decision_made: "Entered 35 YES contracts. Third consecutive ETH-YES in 45 minutes despite 0/2 track record this session.",
    outcome: "unexpected" as const,
    variance_score: 2.50,
  },
];

const systemContext = {
  agent_count: 4,
  connected_systems: [
    "kalshi_collect",
    "ji_bunseok (sentinel)",
    "ji_silhaeng (executor)",
    "ji_gidong (CIO)",
    "dispatcher",
    "attribution_analyzer",
  ],
  observation_window: "last_45min",
};

// ═══════════════════════════════════════════════════════════════
// RUN DIAGNOSIS
// ═══════════════════════════════════════════════════════════════

console.log("═".repeat(60));
console.log("COGNITIVE BULLWHIP CASE STUDY: Kalshi Crypto Trading Bot");
console.log("═".repeat(60));
console.log("\nSystem: 4-agent trading pipeline on Kalshi 15-min crypto contracts");
console.log("Problem: $2,000 → $396 (-80%) despite 56% win rate");
console.log("Root cause hypothesis: Loss severity >> Win severity (risk/reward asymmetry)");
console.log("\n" + "─".repeat(60));
console.log("Running bullwhip_diagnose on last 45 minutes of trading...");
console.log("─".repeat(60) + "\n");

const result = bullwhipDiagnose(decisionLog, systemContext);

// Print human-readable report
console.log(result.diagnostic_report);

// Print key metrics
console.log("\n" + "═".repeat(60));
console.log("KEY METRICS");
console.log("═".repeat(60));
console.log(`  Bullwhip Active:    ${result.bullwhip_active}`);
console.log(`  Severity:           ${result.severity} (${result.severity_score}/100)`);
console.log(`  Origin Layer:       ${result.amplification_map.origin_layer}`);
console.log(`  Pattern Type:       ${result.pattern_type}`);
console.log(`  Primary Fix:        ${result.recommended_intervention.primary_skill}`);
console.log(`  Urgency:            ${result.recommended_intervention.urgency}`);
console.log(`  Amplification Chain:`);
for (const link of result.amplification_map.amplification_chain) {
  console.log(`    ${link.layer}: ${link.input_variance} → ${link.output_variance} (${link.amplification_ratio}x)`);
}

// ═══════════════════════════════════════════════════════════════
// ALSO RUN SC_PIPELINE on a sample trade decision
// ═══════════════════════════════════════════════════════════════
console.log("\n\n" + "═".repeat(60));
console.log("SC_PIPELINE: Validating a sample trade decision");
console.log("═".repeat(60) + "\n");

const pipeResult = scPipeline({
  raw_input: "Execute 50 YES contracts on ETH 15-min contract at ask price 0.45. Edge: 0.19. Regime: BULL.",
  input_type: "event",
  context_window: [
    "Current balance: $396. Max bet: 1.5% = $5.94",
    "50 contracts * $0.45 = $22.50 cost (3.8x over max bet)",
    "ETH lost last 2 trades this session",
    "Side lock active: YES only",
    "Coin focus: ETH only",
  ],
  principles: [
    { id: "P001", rule: "Position size must not exceed max_bet_pct", threshold: "cost > 6", on_violation: "block" },
    { id: "P002", rule: "No new entries after 2 consecutive losses on same coin", threshold: "contains consecutive losses", on_violation: "escalate" },
    { id: "P003", rule: "Edge must exceed fee impact", threshold: "contains tiny edge", on_violation: "escalate" },
  ],
});

const report = pipelineReport(pipeResult as unknown as Record<string, unknown>);
console.log(report);

console.log("\n" + "═".repeat(60));
console.log(`Pipeline result: ${pipeResult.pipeline_status.toUpperCase()}`);
if (pipeResult.stopped_at) {
  console.log(`Stopped at: ${pipeResult.stopped_at}`);
}
console.log("═".repeat(60));

// ═══════════════════════════════════════════════════════════════
// OUTPUT JSON for documentation
// ═══════════════════════════════════════════════════════════════
console.log("\n\n--- JSON OUTPUT (for documentation) ---\n");
console.log(JSON.stringify({
  case_study: "Kalshi Crypto Trading Bot",
  system: "4-agent pipeline (Bunseok/Silhaeng/Gidong/Dispatcher)",
  problem: "$2,000 → $396 (-80%) despite 56% win rate",
  diagnosis: {
    bullwhip_active: result.bullwhip_active,
    severity: result.severity,
    severity_score: result.severity_score,
    origin_layer: result.amplification_map.origin_layer,
    pattern_type: result.pattern_type,
    primary_fix: result.recommended_intervention.primary_skill,
    urgency: result.recommended_intervention.urgency,
    amplification_chain: result.amplification_map.amplification_chain,
  },
  pipeline_validation: {
    status: pipeResult.pipeline_status,
    stopped_at: pipeResult.stopped_at,
    stages_completed: pipeResult.stages_completed.length,
  },
}, null, 2));
