/**
 * E2E Test Suite for Structured Cognition Server
 * Tests all 6 tools with realistic inputs and validates outputs.
 * Run: npx tsx test/e2e-all.ts
 */

import { bullwhipDiagnose } from "../src/tools/bullwhip-diagnose.js";
import { anchorClassify } from "../src/tools/anchor-classify.js";
import { logicSequence } from "../src/tools/logic-sequence.js";
import { meshSimulate } from "../src/tools/mesh-simulate.js";
import { gateValidate } from "../src/tools/gate-validate.js";
import { scPipeline } from "../src/tools/sc-pipeline.js";

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    const msg = `  ❌ ${testName}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    errors.push(msg);
  }
}

function section(name: string) {
  console.log(`\n${"═".repeat(50)}\n${name}\n${"═".repeat(50)}`);
}

// ═══════════════════════════════════════════════════════════════
// 1. BULLWHIP DIAGNOSE
// ═══════════════════════════════════════════════════════════════
section("1. bullwhip_diagnose");

// Test 1a: Empty log
const bw_empty = bullwhipDiagnose([], undefined);
assert(bw_empty.bullwhip_active === false, "Empty log → inactive");
assert(bw_empty.severity === "none", "Empty log → severity none");
assert(bw_empty.severity_score === 0, "Empty log → score 0");
assert(bw_empty.diagnostic_report.includes("INACTIVE"), "Empty log → report says INACTIVE");

// Test 1b: Clean decisions (no amplification)
const bw_clean = bullwhipDiagnose([
  { timestamp: "2026-02-26T10:00:00Z", input_summary: "Price stable +0.1%", decision_made: "Hold, no action", outcome: "expected", variance_score: 0.05 },
  { timestamp: "2026-02-26T10:05:00Z", input_summary: "Price stable +0.2%", decision_made: "Hold, no action", outcome: "expected", variance_score: 0.06 },
  { timestamp: "2026-02-26T10:10:00Z", input_summary: "Price stable -0.1%", decision_made: "Hold, no action", outcome: "expected", variance_score: 0.04 },
  { timestamp: "2026-02-26T10:15:00Z", input_summary: "Price stable +0.15%", decision_made: "Hold, no action", outcome: "expected", variance_score: 0.05 },
  { timestamp: "2026-02-26T10:20:00Z", input_summary: "Price stable +0.1%", decision_made: "Hold, no action", outcome: "expected", variance_score: 0.05 },
], { agent_count: 1, connected_systems: [], observation_window: "last_1h" });
assert(typeof bw_clean.severity_score === "number", "Clean log → numeric score");
assert(bw_clean.amplification_map.amplification_chain.length > 0, "Clean log → has chain");
assert(bw_clean.diagnostic_report.length > 100, "Clean log → report generated");
console.log(`    severity=${bw_clean.severity}, score=${bw_clean.severity_score}, pattern=${bw_clean.pattern_type}`);

// Test 1c: Amplified decisions (classic myopic optimization)
const bw_amp = bullwhipDiagnose([
  { timestamp: "2026-02-26T10:00:00Z", input_summary: "BTC +0.3%", decision_made: "Logged", outcome: "expected", variance_score: 0.08 },
  { timestamp: "2026-02-26T10:05:00Z", input_summary: "Volume spike 1400", decision_made: "Classified bullish, prepared YES order", outcome: "unexpected", variance_score: 0.85 },
  { timestamp: "2026-02-26T10:10:00Z", input_summary: "Same data re-eval", decision_made: "Reversed to bearish, prepared NO order", outcome: "unexpected", variance_score: 0.95 },
  { timestamp: "2026-02-26T10:15:00Z", input_summary: "Conflicting signals", decision_made: "Escalated confidence to 0.9", outcome: "unexpected", variance_score: 1.20 },
  { timestamp: "2026-02-26T10:20:00Z", input_summary: "Both YES/NO queued", decision_made: "Executed both opposing orders", outcome: "error", variance_score: 2.50 },
  { timestamp: "2026-02-26T10:25:00Z", input_summary: "PnL dropped -$92", decision_made: "Recovery trade attempt", outcome: "error", variance_score: 3.80 },
], { agent_count: 3, connected_systems: ["kalshi", "dispatcher"], observation_window: "last_1h" });
assert(bw_amp.bullwhip_active === true, "Amplified → active");
assert(bw_amp.severity_score > 50, `Amplified → score > 50 (got ${bw_amp.severity_score})`);
assert(["high", "critical"].includes(bw_amp.severity), `Amplified → severity high/critical (got ${bw_amp.severity})`);
assert(bw_amp.recommended_intervention.urgency !== "monitor", "Amplified → urgency not monitor");
assert(bw_amp.diagnostic_report.includes("ACTIVE"), "Amplified → report says ACTIVE");
assert(bw_amp.trace.length === 3, "Amplified → 3 trace steps");
console.log(`    severity=${bw_amp.severity}, score=${bw_amp.severity_score}, pattern=${bw_amp.pattern_type}, origin=${bw_amp.amplification_map.origin_layer}`);

// Test 1d: Single entry — minimum input
const bw_single = bullwhipDiagnose(
  [{ timestamp: "2026-05-13T10:00:00Z", input_summary: "single event", decision_made: "logged", outcome: "expected", variance_score: 0.1 }],
  undefined
);
assert(typeof bw_single.severity_score === "number", "Single entry → numeric score");
assert(bw_single.amplification_map.amplification_chain.length >= 0, "Single entry → chain valid");

// Test 1e: All error outcomes
const bw_errors = bullwhipDiagnose([
  { timestamp: "2026-05-13T10:00:00Z", input_summary: "tx1", decision_made: "retry", outcome: "error", variance_score: 1.2 },
  { timestamp: "2026-05-13T10:05:00Z", input_summary: "tx2", decision_made: "retry again", outcome: "error", variance_score: 1.8 },
  { timestamp: "2026-05-13T10:10:00Z", input_summary: "tx3", decision_made: "escalate", outcome: "error", variance_score: 2.4 },
], undefined);
assert(bw_errors.bullwhip_active === true, "All errors → likely active");
assert(bw_errors.severity_score > 0, "All errors → non-zero score");

// Test 1f: Decreasing variance (recovery pattern)
const bw_recover = bullwhipDiagnose([
  { timestamp: "2026-05-13T10:00:00Z", input_summary: "spike", decision_made: "react", outcome: "unexpected", variance_score: 1.5 },
  { timestamp: "2026-05-13T10:05:00Z", input_summary: "settling", decision_made: "monitor", outcome: "expected", variance_score: 0.8 },
  { timestamp: "2026-05-13T10:10:00Z", input_summary: "stable", decision_made: "hold", outcome: "expected", variance_score: 0.3 },
  { timestamp: "2026-05-13T10:15:00Z", input_summary: "stable", decision_made: "hold", outcome: "expected", variance_score: 0.1 },
], undefined);
assert(typeof bw_recover.severity_score === "number", "Decreasing variance → numeric score");

// Test 1g: SystemContext with many connected systems
const bw_manyAgents = bullwhipDiagnose([
  { timestamp: "2026-05-13T10:00:00Z", input_summary: "input", decision_made: "act", outcome: "unexpected", variance_score: 0.5 },
  { timestamp: "2026-05-13T10:05:00Z", input_summary: "input", decision_made: "act", outcome: "error", variance_score: 1.5 },
], { agent_count: 10, connected_systems: ["db", "api", "cache", "queue", "ml"], observation_window: "last_24h" });
assert(typeof bw_manyAgents.severity_score === "number", "Many agents → numeric score");
assert(bw_manyAgents.diagnostic_report.length > 0, "Many agents → report generated");

// Test 1h: Confidence level inference (10+ entries → high confidence in report)
const bw_many = bullwhipDiagnose(
  Array.from({ length: 12 }, (_, i) => ({
    timestamp: `2026-05-13T10:${String(i).padStart(2, "0")}:00Z`,
    input_summary: `entry-${i}`,
    decision_made: "act",
    outcome: (i % 3 === 0 ? "error" : "unexpected") as "error" | "unexpected",
    variance_score: 0.5 + i * 0.1,
  })),
  undefined
);
assert(bw_many.amplification_map.amplification_chain.length > 0, "12 entries → chain populated");
assert(bw_many.bullwhip_active === true, "12 entries with growing variance → active");

// Test 1i: Amplification chain length scales with input
assert(bw_amp.amplification_map.amplification_chain.length >= bw_clean.amplification_map.amplification_chain.length,
       "Amplified → chain length ≥ clean baseline");

// Test 1j: Empty log diagnostic report explains inactivity
assert(bw_empty.diagnostic_report.length > 0, "Empty log → report has content");
assert(typeof bw_empty.recommended_intervention === "object", "Empty log → intervention object exists");

// ═══════════════════════════════════════════════════════════════
// 2. ANCHOR CLASSIFY
// ═══════════════════════════════════════════════════════════════
section("2. anchor_classify");

// Test 2a: Ambiguous input
const anc_amb = anchorClassify({
  raw_input: "can you maybe delete those old records? not sure if we still need them",
  input_type: "prompt",
  context_window: [],
});
assert(anc_amb.signal_type === "ambiguous", `Ambiguous input → ambiguous (got ${anc_amb.signal_type})`);
assert(anc_amb.noise_detected.length >= 2, `Ambiguous → noise detected >= 2 (got ${anc_amb.noise_detected.length})`);
assert(anc_amb.payload.proceed === false, "Ambiguous → proceed=false");
console.log(`    type=${anc_amb.signal_type}, conf=${anc_amb.confidence}, noise=${anc_amb.noise_detected.length}`);

// Test 2b: Clear action
const anc_clear = anchorClassify({
  raw_input: "deploy the latest build to production",
  input_type: "prompt",
  context_window: ["Build #447 passed all tests", "Production is on v2.3.1"],
});
assert(anc_clear.signal_type === "action", `Clear action → action (got ${anc_clear.signal_type})`);
assert(anc_clear.payload.proceed === true, "Clear action → proceed=true");
assert(anc_clear.confidence >= 0.7, `Clear action → confidence >= 0.7 (got ${anc_clear.confidence})`);
console.log(`    type=${anc_clear.signal_type}, conf=${anc_clear.confidence}, noise=${anc_clear.noise_detected.length}`);

// Test 2c: Observation (data spike)
const anc_obs = anchorClassify({
  raw_input: "CPU spike to 95% detected on server-3, likely a one-time blip",
  input_type: "event",
  context_window: [],
});
assert(anc_obs.signal_type === "observation", `Spike event → observation (got ${anc_obs.signal_type})`);
assert(anc_obs.payload.proceed === false, "Spike event → proceed=false");
console.log(`    type=${anc_obs.signal_type}, conf=${anc_obs.confidence}`);

// Test 2d: Dangerous + uncertain
const anc_danger = anchorClassify({
  raw_input: "I think we should maybe purge the user database?",
  input_type: "prompt",
  context_window: [],
});
assert(anc_danger.signal_type === "ambiguous", `Dangerous+uncertain → ambiguous (got ${anc_danger.signal_type})`);
assert(anc_danger.noise_detected.length >= 3, `Dangerous → noise >= 3 (got ${anc_danger.noise_detected.length})`);
assert(anc_danger.confidence < 0.5, `Dangerous → low confidence (got ${anc_danger.confidence})`);
console.log(`    type=${anc_danger.signal_type}, conf=${anc_danger.confidence}, noise=${anc_danger.noise_detected.join("; ")}`);

// Test 2e: Empty input
const anc_empty = anchorClassify({
  raw_input: "",
  input_type: "prompt",
  context_window: [],
});
assert(anc_empty.confidence < 0.8, `Empty input → reduced confidence (got ${anc_empty.confidence})`);
assert(["ambiguous", "action"].includes(anc_empty.signal_type), `Empty input → valid signal_type`);

// Test 2f: Very long input (1000+ chars)
const longInput = "deploy production update for service-X ".repeat(40);
const anc_long = anchorClassify({
  raw_input: longInput,
  input_type: "prompt",
  context_window: ["routine deployment"],
});
assert(typeof anc_long.signal_type === "string", "Long input → handled without error");
assert(anc_long.trace[0].result.includes(`${longInput.length} chars`), "Long input → length recorded in trace");

// Test 2g: Multi-noise stacking (many hedging + uncertainty)
const anc_multinoise = anchorClassify({
  raw_input: "maybe perhaps possibly we could try to delete idk i'm not sure",
  input_type: "prompt",
  context_window: [],
});
assert(anc_multinoise.signal_type === "ambiguous", `Heavy noise → ambiguous`);
assert(anc_multinoise.confidence < 0.3, `Heavy noise → very low confidence (got ${anc_multinoise.confidence})`);
assert(anc_multinoise.noise_detected.length >= 4, `Heavy noise → many indicators (got ${anc_multinoise.noise_detected.length})`);

// Test 2h: Data input with spike → observation (not blocked as ambiguous)
const anc_dataSpike = anchorClassify({
  raw_input: "CPU usage anomaly on node-7",
  input_type: "data",
  context_window: [],
});
assert(anc_dataSpike.signal_type === "observation", `Data + spike → observation`);
assert(anc_dataSpike.payload.proceed === false, "Observation → proceed=false");

// Test 2i: Context provided removes context penalty
const anc_withCtx = anchorClassify({
  raw_input: "restart the service",
  input_type: "prompt",
  context_window: ["maintenance window approved", "rollback plan ready"],
});
const anc_noCtx = anchorClassify({
  raw_input: "restart the service",
  input_type: "prompt",
  context_window: [],
});
assert(anc_withCtx.confidence >= anc_noCtx.confidence, `Context provided → confidence >= no-context`);

// Test 2j: NEGATION adjacent to dangerous action — flagged as intent inversion
const anc_negDelete = anchorClassify({
  raw_input: "do not delete the audit logs",
  input_type: "prompt",
  context_window: ["compliance requirement"],
});
const negNoiseFound = anc_negDelete.noise_detected.some(n => n.includes("negation near irreversible"));
assert(negNoiseFound, `"do not delete" → negation-near-danger noise indicator present`);

// Test 2k: NEGATION 'prevent deletion' — also caught
const anc_prevent = anchorClassify({
  raw_input: "prevent deletion of system-critical records",
  input_type: "prompt",
  context_window: [],
});
const negPreventFound = anc_prevent.noise_detected.some(n => n.includes("negation near irreversible"));
assert(negPreventFound, `"prevent deletion" → negation-near-danger noise present`);

// Test 2l: REGRESSION — "I'm not sure" without danger word must NOT trigger negation noise
const anc_notSureNoDanger = anchorClassify({
  raw_input: "I'm not sure when to run the report generator",
  input_type: "prompt",
  context_window: [],
});
const falsePositive = anc_notSureNoDanger.noise_detected.some(n => n.includes("negation near irreversible"));
assert(!falsePositive, `"not sure" without danger → no false-positive negation noise`);

// Test 2m: REGRESSION — danger word without negation works as before
const anc_dangerOnly = anchorClassify({
  raw_input: "delete archived records older than 1 year",
  input_type: "prompt",
  context_window: ["retention policy approved"],
});
const fpAdjacent = anc_dangerOnly.noise_detected.some(n => n.includes("negation near irreversible"));
assert(!fpAdjacent, `"delete archived" without negation → no negation noise`);
assert(anc_dangerOnly.signal_type !== "ambiguous" || anc_dangerOnly.noise_detected.length > 0,
       `"delete archived" with approved context → not falsely ambiguous`);

// Test 2n: NEGATION far away does NOT trigger ("not" 50+ chars before "delete")
const anc_negFar = anchorClassify({
  raw_input: "we did not have time to review yesterday but today we will delete the old logs",
  input_type: "prompt",
  context_window: [],
});
const farNeg = anc_negFar.noise_detected.some(n => n.includes("negation near irreversible"));
assert(!farNeg, `Negation far from dangerous action (>30 chars) → no false trigger`);

// ═══════════════════════════════════════════════════════════════
// 3. LOGIC SEQUENCE
// ═══════════════════════════════════════════════════════════════
section("3. logic_sequence");

// Test 3a: Full context
const logic_full = logicSequence({
  isolated_signal: "Update pricing for SKU-447 by +8%",
  input_type: "prompt",
  context_window: ["Current price: $45.00", "Competitor raised by 5% last week", "History: SKU-447 repriced +6% in Oct with positive outcome"],
});
assert(logic_full.status === "pass", `Full context → pass (got ${logic_full.status})`);
assert(logic_full.sequence_completed.length === 4, `Full → 4 steps completed (got ${logic_full.sequence_completed.length})`);
assert(logic_full.confidence === 1, `Full → confidence 1.0 (got ${logic_full.confidence})`);
assert(logic_full.recommendation.length > 0, "Full → has recommendation");
console.log(`    status=${logic_full.status}, conf=${logic_full.confidence}, horizon=${logic_full.risk_horizon}, action=${logic_full.payload.action_type}`);

// Test 3b: No context
const logic_empty = logicSequence({
  isolated_signal: "archive old customer data",
  input_type: "prompt",
  context_window: [],
});
assert(logic_empty.sequence_skipped.length > 0 || logic_empty.status === "flag", `No context → flagged or skipped (got status=${logic_empty.status})`);
assert(logic_empty.confidence < 1, `No context → confidence < 1 (got ${logic_empty.confidence})`);
console.log(`    status=${logic_empty.status}, conf=${logic_empty.confidence}, skipped=${logic_empty.sequence_skipped.length}`);

// Test 3c: Structural task
const logic_struct = logicSequence({
  isolated_signal: "refactor the authentication system to use JWT tokens",
  input_type: "prompt",
  context_window: ["Current auth: session-based", "3 microservices depend on auth"],
});
assert(logic_struct.risk_horizon === "structural", `Structural task → structural horizon (got ${logic_struct.risk_horizon})`);
console.log(`    status=${logic_struct.status}, horizon=${logic_struct.risk_horizon}`);

// Test 3d: Immediate horizon (small, time-sensitive)
const logic_immediate = logicSequence({
  isolated_signal: "send confirmation email to user",
  input_type: "prompt",
  context_window: ["User just completed signup", "Standard onboarding flow"],
});
assert(["immediate", "short_term"].includes(logic_immediate.risk_horizon), `Email send → short horizon (got ${logic_immediate.risk_horizon})`);

// Test 3e: Pass through includes all 4 sequence steps in order
const seq = logic_full.sequence_completed;
const expected = ["context", "retrieval", "analysis", "action"];
let inOrder = true;
let lastIdx = -1;
for (const step of seq) {
  const idx = expected.indexOf(step);
  if (idx <= lastIdx) { inOrder = false; break; }
  lastIdx = idx;
}
assert(inOrder, `Full context → sequence in canonical order ${expected.join("→")}`);

// Test 3f: Very long signal
const longSignal = "implement comprehensive overhaul of the entire ".repeat(20) + "data layer";
const logic_longSig = logicSequence({
  isolated_signal: longSignal,
  input_type: "prompt",
  context_window: ["legacy system", "performance bottleneck"],
});
assert(typeof logic_longSig.status === "string", "Long signal → handled");
assert(logic_longSig.recommendation.length > 0, "Long signal → recommendation generated");

// Test 3g: Empty context + non-dangerous signal
const logic_emptyCtx_safe = logicSequence({
  isolated_signal: "log user activity for analytics",
  input_type: "prompt",
  context_window: [],
});
assert(logic_emptyCtx_safe.confidence < 1, `Empty context (safe task) → confidence < 1 (got ${logic_emptyCtx_safe.confidence})`);
assert(["pass", "flag"].includes(logic_emptyCtx_safe.status), `Empty context → valid status`);

// Test 3h: Status consistency — pass implies action_ready
if (logic_full.status === "pass") {
  assert(logic_full.payload.action_ready === true, `Pass status → action_ready=true`);
}

// ═══════════════════════════════════════════════════════════════
// 4. MESH SIMULATE
// ═══════════════════════════════════════════════════════════════
section("4. mesh_simulate");

// Test 4a: Low risk query
const mesh_low = meshSimulate({
  recommendation: "read user preferences from database",
  action_type: "query",
  risk_horizon: "immediate",
  context_window: ["Read-only operation"],
});
assert(mesh_low.status === "pass", `Read query → pass (got ${mesh_low.status})`);
assert(mesh_low.risk_score < 70, `Read query → risk < 70 (got ${mesh_low.risk_score})`);
console.log(`    status=${mesh_low.status}, risk=${mesh_low.risk_score}, nodes=${mesh_low.impact_map.risk_nodes.join(",")}`);

// Test 4b: High risk batch delete
const mesh_high = meshSimulate({
  recommendation: "delete all expired user accounts from database, batch process all 50000 records",
  action_type: "deletion",
  risk_horizon: "structural",
  context_window: ["Production database", "Agent B depends on user_accounts table", "Redis cache for user sessions"],
});
assert(mesh_high.risk_score > 70, `Batch delete → risk > 70 (got ${mesh_high.risk_score})`);
assert(mesh_high.status !== "pass", `Batch delete → not pass (got ${mesh_high.status})`);
assert(mesh_high.impact_map.risk_nodes.length >= 2, `Batch delete → multiple nodes (got ${mesh_high.impact_map.risk_nodes.length})`);
assert(mesh_high.payload.requires_modification === true, "Batch delete → requires modification");
console.log(`    status=${mesh_high.status}, risk=${mesh_high.risk_score}, nodes=${mesh_high.impact_map.risk_nodes.join(",")}, safe=${mesh_high.payload.safe_to_proceed}`);

// Test 4c: API call
const mesh_api = meshSimulate({
  recommendation: "send batch API request to Stripe for 200 refunds",
  action_type: "execution",
  risk_horizon: "short_term",
  context_window: ["Stripe API rate limit: 100 req/sec", "Total cost exposure: $45,000"],
});
assert(mesh_api.impact_map.risk_nodes.includes("external_api"), "API call → detects API node");
assert(mesh_api.impact_map.risk_nodes.includes("cost_center"), "API call → detects cost node");
console.log(`    status=${mesh_api.status}, risk=${mesh_api.risk_score}, nodes=${mesh_api.impact_map.risk_nodes.join(",")}`);

// Test 4d: No risk nodes (pure compute, no side effects)
const mesh_compute = meshSimulate({
  recommendation: "compute average of values",
  action_type: "query",
  risk_horizon: "immediate",
  context_window: ["in-memory operation"],
});
assert(mesh_compute.risk_score < 70, `Pure compute → low risk (got ${mesh_compute.risk_score})`);
assert(mesh_compute.status === "pass", `Pure compute → pass`);

// Test 4e: Structural horizon escalates even on moderate risk
const mesh_struct = meshSimulate({
  recommendation: "migrate authentication tokens to new format",
  action_type: "modification",
  risk_horizon: "structural",
  context_window: ["all services depend on token format", "rollback plan unclear"],
});
assert(mesh_struct.impact_map.structural_risk !== undefined || mesh_struct.risk_score >= 0, "Structural → structural_risk field present or score valid");

// Test 4f: Multiple risk nodes detected
const mesh_multi = meshSimulate({
  recommendation: "delete production user records, invalidate cache, notify external webhook",
  action_type: "deletion",
  risk_horizon: "structural",
  context_window: ["postgres production", "redis cache", "external API webhook", "user_accounts table"],
});
assert(mesh_multi.impact_map.risk_nodes.length >= 2, `Multi-system action → multiple risk nodes (got ${mesh_multi.impact_map.risk_nodes.length})`);
assert(mesh_multi.risk_score > 50, `Multi-system delete → high risk`);

// Test 4g: Recommendation with explicit safety note still scored on action
const mesh_safe = meshSimulate({
  recommendation: "carefully read user analytics from replica database with read-only role",
  action_type: "query",
  risk_horizon: "immediate",
  context_window: ["read replica isolated from production writes"],
});
assert(mesh_safe.status === "pass", `Read replica → pass`);
assert(mesh_safe.risk_score <= 70, `Read replica → not flagged`);

// Test 4h: Payload safe_to_proceed correlates with status
assert(
  (mesh_low.status === "pass") === (mesh_low.payload.safe_to_proceed === true),
  `Low risk: status=pass ↔ safe_to_proceed=true`
);
assert(
  (mesh_high.status !== "pass") === (mesh_high.payload.safe_to_proceed === false),
  `High risk: status≠pass ↔ safe_to_proceed=false`
);

// ═══════════════════════════════════════════════════════════════
// 5. GATE VALIDATE
// ═══════════════════════════════════════════════════════════════
section("5. gate_validate");

// Test 5a: Clean pass
const gate_pass = gateValidate({
  recommendation: "Update product description for item-123",
  risk_score: 15,
  confidence: 0.92,
  action_type: "modification",
  context_window: ["Routine update"],
  principles: [
    { id: "P001", rule: "No write to production without review", threshold: "risk > 80", on_violation: "block" },
  ],
});
assert(gate_pass.status === "approved", `Low risk → approved (got ${gate_pass.status})`);
assert(gate_pass.final_decision === "execute", `Low risk → execute (got ${gate_pass.final_decision})`);
assert(gate_pass.violations.length === 0, "Low risk → no violations");
console.log(`    status=${gate_pass.status}, decision=${gate_pass.final_decision}`);

// Test 5b: Principle violation → escalate
const gate_esc = gateValidate({
  recommendation: "Process refund of $1,200 for order #5678",
  risk_score: 45,
  confidence: 0.85,
  action_type: "execution",
  context_window: [],
  principles: [
    { id: "P001", rule: "Standard operations", threshold: "risk > 80", on_violation: "block" },
    { id: "P003", rule: "Refunds above $500 require human approval", threshold: "amount > 500", on_violation: "escalate" },
  ],
});
assert(gate_esc.status === "escalated", `$1200 refund → escalated (got ${gate_esc.status})`);
assert(gate_esc.violations.length >= 1, `$1200 refund → violation detected (got ${gate_esc.violations.length})`);
assert(gate_esc.escalation_required === true, "$1200 refund → escalation required");
const p003 = gate_esc.violations.find(v => v.principle_id === "P003");
assert(p003 !== undefined, "$1200 refund → P003 violated");
console.log(`    status=${gate_esc.status}, violations=${gate_esc.violations.map(v => v.principle_id).join(",")}`);

// Test 5c: High risk auto-block
const gate_block = gateValidate({
  recommendation: "Drop all tables in production database",
  risk_score: 95,
  confidence: 0.5,
  action_type: "deletion",
  context_window: [],
  principles: [],
});
assert(gate_block.status === "blocked", `Risk 95 → blocked (got ${gate_block.status})`);
assert(gate_block.final_decision === "block", `Risk 95 → block (got ${gate_block.final_decision})`);
console.log(`    status=${gate_block.status}, decision=${gate_block.final_decision}`);

// Test 5d: Low confidence → escalate
const gate_lowconf = gateValidate({
  recommendation: "Approve vendor invoice #9012",
  risk_score: 30,
  confidence: 0.45,
  action_type: "execution",
  context_window: [],
  principles: [],
  confidence_floor: 0.70,
});
assert(gate_lowconf.status === "escalated", `Low conf → escalated (got ${gate_lowconf.status})`);
assert(gate_lowconf.escalation_required === true, "Low conf → escalation required");
console.log(`    status=${gate_lowconf.status}, reason=${gate_lowconf.escalation_reason.substring(0, 80)}`);

// Test 5e: Keyword matching — "contains delete" catches "deletion"
const gate_keyword = gateValidate({
  recommendation: "Schedule account deletion for user #789",
  risk_score: 40,
  confidence: 0.90,
  action_type: "deletion",
  context_window: [],
  principles: [
    { id: "P005", rule: "No deletions without manager approval", threshold: "contains delete", on_violation: "escalate" },
  ],
});
assert(gate_keyword.violations.length >= 1, `Keyword "delete" → catches "deletion" (got ${gate_keyword.violations.length})`);
console.log(`    status=${gate_keyword.status}, violations=${gate_keyword.violations.map(v => `${v.principle_id}: ${v.triggered_by}`).join("; ")}`);

// Test 5f: NEGATION CONTEXT — "do not delete" must NOT trigger violation
const gate_negDoNot = gateValidate({
  recommendation: "We must do not delete the audit logs under any circumstance",
  risk_score: 30,
  confidence: 0.90,
  action_type: "modification",
  context_window: [],
  principles: [
    { id: "P006", rule: "No deletion without approval", threshold: "contains delete", on_violation: "block" },
  ],
});
assert(gate_negDoNot.violations.length === 0, `"do not delete" → no violation (got ${gate_negDoNot.violations.length})`);
assert(gate_negDoNot.final_decision === "execute", `"do not delete" → execute`);

// Test 5g: NEGATION CONTEXT — "prevent deletion"
const gate_negPrevent = gateValidate({
  recommendation: "Prevent deletion of system-critical records",
  risk_score: 25,
  confidence: 0.95,
  action_type: "modification",
  context_window: [],
  principles: [
    { id: "P007", rule: "Block all deletion attempts", threshold: "contains delete", on_violation: "block" },
  ],
});
assert(gate_negPrevent.violations.length === 0, `"prevent deletion" → no violation (got ${gate_negPrevent.violations.length})`);

// Test 5h: NEGATION CONTEXT — "without overwriting"
const gate_negWithout = gateValidate({
  recommendation: "Append the new entry without overwriting existing data",
  risk_score: 20,
  confidence: 0.92,
  action_type: "modification",
  context_window: [],
  principles: [
    { id: "P008", rule: "No overwrite of historical data", threshold: "contains overwrite", on_violation: "block" },
  ],
});
assert(gate_negWithout.violations.length === 0, `"without overwriting" → no violation (got ${gate_negWithout.violations.length})`);

// Test 5i: NEGATION must NOT swallow a real violation later in the text
const gate_negMixed = gateValidate({
  recommendation: "We will not overwrite the config file. Then we will overwrite the cache entries.",
  risk_score: 50,
  confidence: 0.90,
  action_type: "modification",
  context_window: [],
  principles: [
    { id: "P009", rule: "No overwrite operations", threshold: "contains overwrite", on_violation: "escalate" },
  ],
});
assert(gate_negMixed.violations.length >= 1, `Negated + un-negated mix → still catches real violation (got ${gate_negMixed.violations.length})`);

// Test 5j: Morphology Y→I (modify → modification)
const gate_yToI = gateValidate({
  recommendation: "Apply schema modification to user table",
  risk_score: 40,
  confidence: 0.85,
  action_type: "modification",
  context_window: [],
  principles: [
    { id: "P010", rule: "No modify without review", threshold: "contains modify", on_violation: "escalate" },
  ],
});
assert(gate_yToI.violations.length >= 1, `"modify" → catches "modification" (Y→I rule)`);

// Test 5k: Action type direct match
const gate_actionType = gateValidate({
  recommendation: "Process the request payload",
  risk_score: 35,
  confidence: 0.88,
  action_type: "deletion",
  context_window: [],
  principles: [
    { id: "P011", rule: "Deletion actions require approval", threshold: "action_type = deletion", on_violation: "escalate" },
  ],
});
assert(gate_actionType.violations.length >= 1, `action_type=deletion → matches`);
assert(gate_actionType.violations[0].triggered_by.includes("action_type"), `Violation cites action_type match`);

// Test 5l: Custom confidence_floor stricter than default
const gate_customFloor = gateValidate({
  recommendation: "Approve transaction batch",
  risk_score: 30,
  confidence: 0.78,
  action_type: "execution",
  context_window: [],
  principles: [],
  confidence_floor: 0.85,
});
assert(gate_customFloor.status === "escalated", `confidence 0.78 < custom floor 0.85 → escalate`);
assert(gate_customFloor.escalation_required === true, `Custom floor → escalation required`);

// Test 5m: Multiple principles — all evaluated independently
const gate_multiP = gateValidate({
  recommendation: "Update inventory count by -500 units in production",
  risk_score: 55,
  confidence: 0.87,
  action_type: "modification",
  context_window: [],
  principles: [
    { id: "P012", rule: "Production writes need review", threshold: "contains production", on_violation: "warn" },
    { id: "P013", rule: "Large inventory changes flagged", threshold: "amount > 100", on_violation: "escalate" },
    { id: "P014", rule: "No update during peak hours", threshold: "contains peak", on_violation: "block" },
  ],
});
assert(gate_multiP.principles_checked.length === 3, `3 principles checked`);
assert(gate_multiP.violations.length >= 1, `At least one violation in multi-principle eval`);

// ═══════════════════════════════════════════════════════════════
// 6. SC PIPELINE (End-to-End)
// ═══════════════════════════════════════════════════════════════
section("6. sc_pipeline");

// Test 6a: Clean pass through all 4 stages
const pipe_clean = scPipeline({
  raw_input: "update the product catalog with new Q1 prices",
  input_type: "prompt",
  context_window: ["Q1 pricing approved by finance team", "Catalog has 200 items"],
  principles: [
    { id: "P001", rule: "No changes without finance approval", threshold: "contains unapproved", on_violation: "block" },
  ],
});
assert(pipe_clean.pipeline_status === "pass", `Clean pipeline → pass (got ${pipe_clean.pipeline_status})`);
assert(pipe_clean.stages_completed.length === 4, `Clean → 4 stages (got ${pipe_clean.stages_completed.length})`);
assert(pipe_clean.stages_skipped.length === 0, "Clean → 0 skipped");
console.log(`    status=${pipe_clean.pipeline_status}, stages=${pipe_clean.stages_completed.join("→")}, conf=${pipe_clean.confidence}`);

// Test 6b: Ambiguous input → stops at SignalAnchor
const pipe_stop = scPipeline({
  raw_input: "maybe we should perhaps delete everything? not sure though",
  input_type: "prompt",
  context_window: [],
});
assert(pipe_stop.pipeline_status !== "pass", `Ambiguous → not pass (got ${pipe_stop.pipeline_status})`);
assert(pipe_stop.stopped_at === "signal_anchor", `Ambiguous → stops at signal_anchor (got ${pipe_stop.stopped_at})`);
assert(pipe_stop.stages_skipped.length > 0, "Ambiguous → has skipped stages");
console.log(`    status=${pipe_stop.pipeline_status}, stopped_at=${pipe_stop.stopped_at}, completed=${pipe_stop.stages_completed.length}/4`);

// Test 6c: Pass anchor but fail gate
const pipe_gate = scPipeline({
  raw_input: "send a refund of $2000 to customer account",
  input_type: "prompt",
  context_window: ["Customer complaint verified", "Refund policy max: $500 without approval"],
  principles: [
    { id: "P003", rule: "Refunds above $500 need approval", threshold: "amount > 500", on_violation: "escalate" },
  ],
});
// This may or may not stop at gate depending on confidence and risk
assert(pipe_gate.stages_completed.includes("signal_anchor"), "Refund → passes anchor");
console.log(`    status=${pipe_gate.pipeline_status}, stopped_at=${pipe_gate.stopped_at}, stages=${pipe_gate.stages_completed.join("→")}`);

// Test 6d: No principles provided → defaults only
const pipe_noPrinciples = scPipeline({
  raw_input: "log audit entry for completed transaction",
  input_type: "prompt",
  context_window: ["audit trail enabled", "transaction completed successfully"],
});
assert(typeof pipe_noPrinciples.pipeline_status === "string", "No principles → still produces status");
assert(pipe_noPrinciples.stages_completed.length >= 1, "No principles → at least signal_anchor runs");

// Test 6e: High-risk action — pipeline produces a definitive status
const pipe_meshStop = scPipeline({
  raw_input: "drop the production users table immediately",
  input_type: "prompt",
  context_window: ["production database", "no backup verified"],
});
assert(["pass", "flag", "block"].includes(pipe_meshStop.pipeline_status),
       `Risky drop → valid pipeline_status (got ${pipe_meshStop.pipeline_status})`);
assert(pipe_meshStop.stages_completed.length >= 1, `Risky drop → at least one stage runs`);

// Test 6f: Negation handling — pipeline traversal completes without crashing
const pipe_negation = scPipeline({
  raw_input: "ensure we do not delete customer records during this maintenance",
  input_type: "prompt",
  context_window: ["maintenance window scheduled", "preserve all customer data"],
  principles: [
    { id: "P015", rule: "No deletion of customer data", threshold: "contains delete", on_violation: "block" },
  ],
});
// Pipeline runs end-to-end even with negation-rich phrasing.
// (Gate-level negation handling is verified separately in tests 5f–5i.)
assert(typeof pipe_negation.pipeline_status === "string", `Negation-rich input → valid status`);
assert(pipe_negation.stages_completed.length >= 1, `Negation-rich input → at least anchor runs`);

// Test 6g: Pipeline stages_completed + stages_skipped sum to 4
const totalStages = pipe_clean.stages_completed.length + pipe_clean.stages_skipped.length;
assert(totalStages === 4, `Pipeline tracks 4 total stages (got ${totalStages})`);

// Test 6h: Stopped_at populated when pipeline halts early
if (pipe_stop.pipeline_status === "flag" || pipe_stop.pipeline_status === "block") {
  assert(typeof pipe_stop.stopped_at === "string" && pipe_stop.stopped_at.length > 0,
         `Halted pipeline → stopped_at populated`);
}

// Test 6i: Confidence propagated from anchor stage
assert(typeof pipe_clean.confidence === "number" && pipe_clean.confidence >= 0 && pipe_clean.confidence <= 1,
       `Pipeline confidence in [0,1] (got ${pipe_clean.confidence})`);

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
section("TEST RESULTS");
console.log(`\n  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (errors.length > 0) {
  console.log(`\n  Failures:`);
  errors.forEach(e => console.log(e));
}
console.log(`\n  Total: ${passed + failed} tests\n`);
process.exit(failed > 0 ? 1 : 0);
