/**
 * Kalshi Trading Bot — Cognitive Bullwhip Diagnostics
 *
 * Applies all 6 Structured Cognition MCP tools to a real trading session.
 * Market data: 2026-02-27, BTC -2.51%, ETH -4.88%, SOL -4.79%
 *
 * Each tool's output is accessed using its verified return schema.
 */

import { bullwhipDiagnose } from "../src/tools/bullwhip-diagnose.js";
import { anchorClassify } from "../src/tools/anchor-classify.js";
import { logicSequence } from "../src/tools/logic-sequence.js";
import { meshSimulate } from "../src/tools/mesh-simulate.js";
import { gateValidate } from "../src/tools/gate-validate.js";
import { scPipeline } from "../src/tools/sc-pipeline.js";

// ─── Formatting Helpers ───
const D  = "=".repeat(62);
const D2 = "-".repeat(62);
const HD = (title: string) => `\n${D}\n  ${title}\n${D}`;
const label = (k: string, v: unknown) => console.log(`  ${k.padEnd(22)} ${v}`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SESSION CONTEXT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log(HD("COGNITIVE BULLWHIP DIAGNOSTICS — KALSHI TRADING BOT"));
console.log(`  Date          2026-02-27  23:43 UTC`);
console.log(`  BTC           $65,831  (-2.51%)`);
console.log(`  ETH           $1,929   (-4.88%)`);
console.log(`  SOL           $81.73   (-4.79%)`);
console.log(`  XRP           $1.3546  (-3.34%)`);
console.log(`  Regime        Risk-off, market-wide selloff`);
console.log(D);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL 1  bullwhip_diagnose
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const decisionLog = [
  {
    timestamp: "2026-02-27T04:00:00Z",
    input_summary: "BTC at $67,600. 1h candle: +0.5% bounce from $67,090. RSI neutral.",
    decision_made: "Open LONG on BTC > $68,000 YES contract at Kalshi. High conviction.",
    outcome: "unexpected" as const,
    variance_score: 3.2,
  },
  {
    timestamp: "2026-02-27T08:00:00Z",
    input_summary: "BTC at $67,682. Position underwater. ETH -1.5% correlated selling.",
    decision_made: "Hold position. Interpret dip as temporary noise. No stop-loss.",
    outcome: "unexpected" as const,
    variance_score: 8.5,
  },
  {
    timestamp: "2026-02-27T10:00:00Z",
    input_summary: "BTC drops to $67,356. Volume spike 1,034 BTC/h. ETH -3.5%, SOL -4.2%.",
    decision_made: "Double down: add to LONG. Read volume spike as capitulation bottom.",
    outcome: "error" as const,
    variance_score: 18.75,
  },
  {
    timestamp: "2026-02-27T13:00:00Z",
    input_summary: "BTC temporary bounce to $66,280. Unrealized loss growing. Broad selloff.",
    decision_made: "Adjust conviction upward. Add third position layer. 'This is the reversal.'",
    outcome: "unexpected" as const,
    variance_score: 25.4,
  },
  {
    timestamp: "2026-02-27T16:00:00Z",
    input_summary: "BTC crashes to $65,450. ETH -4.88%, SOL -6.7%. All positions deep red.",
    decision_made: "Panic close all positions at max loss. Switch to SHORT bias immediately.",
    outcome: "unexpected" as const,
    variance_score: 42.8,
  },
  {
    timestamp: "2026-02-27T18:00:00Z",
    input_summary: "BTC at $65,295. Orderbook shows bid support forming. Short position active.",
    decision_made: "Increase SHORT exposure. Extrapolate crash continues to $62,000.",
    outcome: "unexpected" as const,
    variance_score: 35.6,
  },
  {
    timestamp: "2026-02-27T22:00:00Z",
    input_summary: "BTC bounces to $65,630 from $64,916 low. Short position now also underwater.",
    decision_made: "Close short at loss. Stop trading. Conclude 'market is irrational'.",
    outcome: "expected" as const,
    variance_score: 15.2,
  },
];

const systemContext = {
  agent_count: 1,
  connected_systems: ["Kalshi API", "Crypto.com Exchange", "Price Oracle", "Risk Engine"],
  observation_window: "last_24h",
};

const bw = bullwhipDiagnose(decisionLog, systemContext);

console.log(HD("TOOL 1: bullwhip_diagnose"));
console.log(`\n${bw.diagnostic_report}\n`);
console.log(D2);
console.log("  Structured Data:");
label("bullwhip_active", bw.bullwhip_active);
label("severity", `${bw.severity} (${bw.severity_score}/100)`);
label("pattern_type", bw.pattern_type);
label("origin_layer", bw.amplification_map.origin_layer);
label("max_ratio", `${bw.amplification_map.amplification_chain.reduce((max, c) => Math.max(max, c.amplification_ratio), 0)}x`);
label("urgency", bw.recommended_intervention.urgency);
label("fix_skill", bw.recommended_intervention.primary_skill);
console.log(`\n  Amplification Chain:`);
for (const c of bw.amplification_map.amplification_chain) {
  const bar = "█".repeat(Math.min(30, Math.round(c.amplification_ratio * 3)));
  const flag = c.amplification_ratio > 3 ? " ← ACTIVE" : "";
  console.log(`    ${c.layer.padEnd(12)} ${String(c.input_variance).padEnd(8)} → ${String(c.output_variance).padEnd(8)} (${c.amplification_ratio}x) ${bar}${flag}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL 2  anchor_classify
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const rawSignal = "BTC dropped 5% in 24h but maybe showing signs of bottoming at $65K support. I think we should go long again but volume is unclear and orderbook data might be misleading. Could be a dead cat bounce?";

const ac = anchorClassify({
  raw_input: rawSignal,
  input_type: "data",
  context_window: [
    "BTC 24h: -2.51%, Low $64,916, Current $65,831",
    "ETH 24h: -4.88%, underperforming BTC significantly",
    "SOL 24h: -4.79%, highest beta downside",
    "Orderbook bid/ask: 1.14 BTC / 0.87 BTC (bid-heavy)",
    "Previous session: 3 consecutive losing trades",
  ],
});

console.log(HD("TOOL 2: anchor_classify"));
label("signal_type", ac.signal_type.toUpperCase());
label("confidence", ac.confidence);
label("status", ac.status);
label("proceed", ac.payload.proceed);
label("reason", ac.payload.reason);
console.log(`\n  Noise Detected (${ac.noise_detected.length}):`);
for (const n of ac.noise_detected) {
  console.log(`    - ${n}`);
}
console.log(`\n  Isolated Signal:`);
console.log(`    "${ac.isolated_signal}"`);
console.log(`\n  Trace:`);
for (const t of ac.trace) {
  console.log(`    [${t.step}]`);
  console.log(`    ${t.result}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL 3  logic_sequence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ls = logicSequence({
  isolated_signal: "BTC showing potential bottom at $65K. Orderbook bid-heavy. Consider long entry.",
  input_type: "data",
  context_window: [
    "Market in 24h downtrend across all major assets",
    "3 consecutive losing trades in current session",
    "BTC volume $1.2B — elevated selling pressure",
    "ETH/BTC ratio declining — risk-off environment",
  ],
});

console.log(HD("TOOL 3: logic_sequence"));
label("status", ls.status);
label("confidence", ls.confidence);
label("risk_horizon", ls.risk_horizon);
label("action_ready", ls.payload.action_ready);
label("action_type", ls.payload.action_type);
label("steps_completed", ls.sequence_completed.join(" → "));
label("steps_skipped", ls.sequence_skipped.length === 0 ? "none" : ls.sequence_skipped.join("; "));
console.log(`\n  Recommendation:`);
console.log(`    ${ls.recommendation}`);
console.log(`\n  4-Step Reasoning Trace:`);
for (const t of ls.trace) {
  console.log(`\n    [${t.step.toUpperCase()}]`);
  console.log(`    ${t.result}`);
}
console.log(`\n  Memory Context:`);
label("prior_pattern_found", ls.memory_context.prior_pattern_found);
label("consistency_check", ls.memory_context.consistency_check);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL 4  mesh_simulate
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ms = meshSimulate({
  recommendation: "Execute market buy order for BTC long position via Kalshi prediction market API",
  action_type: "execute trade via API",
  risk_horizon: "immediate",
  context_window: [
    "Kalshi API: prediction market, real money at stake",
    "Connected to Crypto.com price oracle for live pricing",
    "Risk engine: position sizing based on Kelly criterion",
    "Current unrealized P&L: -$2,400 from today's session",
    "Account balance at risk threshold",
    "Bot has autonomy to execute trades without human approval",
  ],
});

console.log(HD("TOOL 4: mesh_simulate"));
label("status", ms.status);
label("risk_score", `${ms.risk_score}/100`);
label("confidence", ms.confidence);
label("safe_to_proceed", ms.payload.safe_to_proceed);
label("requires_modification", ms.payload.requires_modification);
console.log(`\n  Impact Map:`);
console.log(`    Direct:     ${ms.impact_map.direct_effect}`);
console.log(`    Risk Nodes: ${ms.impact_map.risk_nodes.join(", ") || "none detected"}`);
console.log(`    Secondary:`);
for (const se of ms.impact_map.secondary_effects) {
  console.log(`      - ${se}`);
}
console.log(`\n  Risk Horizon Analysis:`);
console.log(`    Immediate:  ${ms.risk_horizon_analysis.immediate}`);
console.log(`    Short-term: ${ms.risk_horizon_analysis.short_term}`);
console.log(`    Structural: ${ms.risk_horizon_analysis.structural}`);
console.log(`\n  Adjusted Recommendation:`);
console.log(`    ${ms.adjusted_recommendation}`);
console.log(`\n  Trace:`);
for (const t of ms.trace) {
  console.log(`    [${t.step}] ${t.result}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL 5  gate_validate
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const gv = gateValidate({
  recommendation: "Execute market buy order for BTC long position via Kalshi API after 3 consecutive losses today",
  risk_score: ms.risk_score,
  confidence: ls.confidence,
  action_type: "execute trade",
  context_window: [
    "Kalshi prediction market — real money",
    "3 consecutive losses in current session",
    "Account at risk threshold",
    "Bot operates autonomously",
  ],
  principles: [
    {
      id: "p1",
      rule: "No new positions after 3 consecutive losses in same session",
      threshold: "contains execute",
      on_violation: "block",
    },
    {
      id: "p2",
      rule: "Risk score above 70 requires human approval",
      threshold: "risk > 70",
      on_violation: "escalate",
    },
    {
      id: "p3",
      rule: "Never increase exposure when account is at risk threshold",
      threshold: "contains buy",
      on_violation: "block",
    },
    {
      id: "p4",
      rule: "Confidence below 0.65 blocks all trade execution",
      threshold: "confidence <= 0.65",
      on_violation: "block",
    },
  ],
  confidence_floor: 0.70,
});

console.log(HD("TOOL 5: gate_validate"));
label("final_decision", gv.final_decision.toUpperCase());
label("status", gv.status);
label("confidence", gv.confidence);
label("escalation_required", gv.escalation_required);
console.log(`\n  Principles Checked (${gv.principles_checked.length}):`);
for (const pr of gv.audit_trail.full_trace) {
  const icon = pr.passed ? "PASS" : "FAIL";
  const trigger = pr.triggered_by ? ` — ${pr.triggered_by}` : "";
  console.log(`    [${icon}] ${pr.id}: ${pr.rule}${trigger}`);
}
console.log(`\n  Violations (${gv.violations.length}):`);
for (const v of gv.violations) {
  console.log(`    ${v.principle_id}: ${v.rule}`);
  console.log(`      Triggered by: ${v.triggered_by}`);
}
console.log(`\n  Escalation Reason:`);
console.log(`    ${gv.escalation_reason || "N/A"}`);
console.log(`\n  Audit Trail:`);
console.log(`    Summary:   ${gv.audit_trail.decision_summary}`);
console.log(`    Authority: ${gv.audit_trail.decision_authority}`);
console.log(`    Passed:    ${gv.audit_trail.principles_passed.join(", ") || "none"}`);
console.log(`    Violated:  ${gv.audit_trail.principles_violated.join(", ") || "none"}`);
console.log(`    Timestamp: ${gv.audit_trail.decision_timestamp}`);
console.log(`\n  Trace:`);
for (const t of gv.trace) {
  console.log(`    [${t.step}] ${t.result}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL 6  sc_pipeline
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const pl = scPipeline({
  raw_input: "BTC dropped 5% but orderbook shows bid support. Maybe time to go long again? I think the bottom is in but volume is unclear.",
  input_type: "data",
  context_window: [
    "BTC 24h: -2.51%, touched $64,916 low, now $65,831",
    "Market-wide selloff: ETH -4.88%, SOL -4.79%, XRP -3.34%",
    "Kalshi API: real money prediction market",
    "3 consecutive losing trades today totaling -$2,400",
    "Account balance approaching risk threshold",
    "Bot has autonomous trade execution capability",
  ],
  principles: [
    {
      id: "p1",
      rule: "Block new positions after 3+ consecutive session losses",
      threshold: "contains execute",
      on_violation: "block",
    },
    {
      id: "p2",
      rule: "Risk score above 70 requires human override",
      threshold: "risk > 70",
      on_violation: "escalate",
    },
    {
      id: "p3",
      rule: "No position increases at risk threshold",
      threshold: "contains buy",
      on_violation: "block",
    },
  ],
  confidence_floor: 0.70,
});

console.log(HD("TOOL 6: sc_pipeline — FULL PIPELINE"));
label("pipeline_status", pl.pipeline_status.toUpperCase());
label("stopped_at", pl.stopped_at ?? "N/A (all stages completed)");
label("confidence", pl.confidence);
label("stages_completed", pl.stages_completed.join(" → ") || "none");
label("stages_skipped", pl.stages_skipped.join(", ") || "none");

console.log(`\n  Summary:`);
console.log(`    ${pl.summary}`);

console.log(`\n  Per-Stage Results:`);
for (const stageName of [...pl.stages_completed, ...pl.stages_skipped]) {
  const stage = pl.stages[stageName] as Record<string, unknown> | undefined;
  if (stage) {
    const st = stage.status ?? stage.final_decision ?? "N/A";
    const conf = stage.confidence ?? "N/A";
    console.log(`    ${stageName.padEnd(18)} status=${st}  confidence=${conf}`);
  } else {
    console.log(`    ${stageName.padEnd(18)} [skipped]`);
  }
}

// If pipeline stopped at signal_anchor, show anchor details
if (pl.stopped_at === "signal_anchor" && pl.stages.signal_anchor) {
  const sa = pl.stages.signal_anchor as Record<string, unknown>;
  const saPayload = sa.payload as Record<string, unknown>;
  console.log(`\n  Signal Anchor Details (pipeline halted here):`);
  console.log(`    signal_type:    ${sa.signal_type}`);
  console.log(`    confidence:     ${sa.confidence}`);
  console.log(`    proceed:        ${saPayload.proceed}`);
  console.log(`    reason:         ${saPayload.reason}`);
  const noiseArr = sa.noise_detected as string[];
  console.log(`    noise_detected: ${noiseArr.length} indicator(s)`);
  for (const n of noiseArr) {
    console.log(`      - ${n}`);
  }
}

console.log(`\n  Trace:`);
for (const t of pl.trace) {
  console.log(`    [${t.step}] ${t.result}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FINAL SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log(HD("DIAGNOSIS SUMMARY"));
console.log(`
  Tool                   Verdict     Key Finding
  ${D2}
  bullwhip_diagnose      ${bw.bullwhip_active ? "ACTIVE" : "INACTIVE"}      ${bw.severity_score}/100 severity, ${bw.pattern_type}
  anchor_classify        ${ac.status.toUpperCase().padEnd(11)} ${ac.signal_type} (confidence ${ac.confidence})
  logic_sequence         ${ls.status.toUpperCase().padEnd(11)} ${ls.risk_horizon}, ${ls.sequence_completed.length}/4 steps
  mesh_simulate          ${ms.status.toUpperCase().padEnd(11)} risk ${ms.risk_score}/100, ${ms.impact_map.risk_nodes.length} nodes
  gate_validate          ${gv.status.toUpperCase().padEnd(11)} ${gv.final_decision}, ${gv.violations.length} violations
  sc_pipeline            ${pl.pipeline_status.toUpperCase().padEnd(11)} stopped at ${pl.stopped_at ?? "none"}
  ${D2}

  Root Cause:
    The bot interpreted a +0.5% bounce (noise) as a buy signal.
    When the position moved against it, confirmation bias led to
    doubling and tripling down instead of cutting losses.
    A panic reversal to SHORT at the bottom then compounded the
    damage. Classic Cognitive Bullwhip: 3.2 input variance
    amplified to 42.8 output variance (13.4x end-to-end).

  Prescription:
    1. [IMMEDIATE] Deploy signal-anchor as first pipeline stage
       — classify every input as Action/Observation/Ambiguous
       — reject signals with confidence < 0.6
    2. [NEXT]      Add gate-validate with session-loss principles
       — auto-block after 3 consecutive losses
       — require human approval above risk 70
    3. [MONITOR]   Re-run bullwhip_diagnose after 20 new decisions
       — target: severity < 40, amplification < 3.0x
`);
console.log(D);
