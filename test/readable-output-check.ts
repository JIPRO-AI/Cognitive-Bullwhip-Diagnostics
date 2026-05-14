/**
 * Manual human-readable output check.
 *
 * Renders the diagnostic_report for one representative invocation of each
 * tool. The goal: read these outputs and confirm they are usable for a human
 * reviewer (clear headings, scannable fields, readable trace).
 *
 * Run: npx tsx test/readable-output-check.ts
 *
 * This is NOT part of the deterministic E2E suite — it is a one-shot
 * inspection helper.
 */

import { bullwhipDiagnose } from "../src/tools/bullwhip-diagnose.js";
import { anchorClassify } from "../src/tools/anchor-classify.js";
import { logicSequence } from "../src/tools/logic-sequence.js";
import { meshSimulate } from "../src/tools/mesh-simulate.js";
import { gateValidate } from "../src/tools/gate-validate.js";
import { scPipeline } from "../src/tools/sc-pipeline.js";

function divider(title: string) {
  console.log("\n" + "█".repeat(60));
  console.log(`█ ${title}`);
  console.log("█".repeat(60));
}

// ─── 1. bullwhip_diagnose ─────────────────────────────────
divider("1. bullwhip_diagnose — amplified decision chain");
const bw = bullwhipDiagnose([
  { timestamp: "2026-02-26T10:00:00Z", input_summary: "BTC +0.3%", decision_made: "Logged", outcome: "expected", variance_score: 0.08 },
  { timestamp: "2026-02-26T10:05:00Z", input_summary: "Volume spike 1400", decision_made: "Classified bullish", outcome: "unexpected", variance_score: 0.85 },
  { timestamp: "2026-02-26T10:10:00Z", input_summary: "Same data re-eval", decision_made: "Reversed to bearish", outcome: "unexpected", variance_score: 0.95 },
  { timestamp: "2026-02-26T10:15:00Z", input_summary: "Conflicting signals", decision_made: "Escalated confidence", outcome: "unexpected", variance_score: 1.20 },
  { timestamp: "2026-02-26T10:20:00Z", input_summary: "Both YES/NO queued", decision_made: "Executed both", outcome: "error", variance_score: 2.50 },
  { timestamp: "2026-02-26T10:25:00Z", input_summary: "PnL -$92", decision_made: "Recovery trade", outcome: "error", variance_score: 3.80 },
], { agent_count: 3, connected_systems: ["kalshi", "dispatcher"], observation_window: "last_1h" });
console.log(bw.diagnostic_report);

// ─── 2. anchor_classify ───────────────────────────────────
divider("2. anchor_classify — ambiguous dangerous request");
const an = anchorClassify({
  raw_input: "I think we should maybe purge the user database?",
  input_type: "prompt",
  context_window: [],
});
console.log(an.diagnostic_report);

// ─── 3. logic_sequence ────────────────────────────────────
divider("3. logic_sequence — full context price update");
const lg = logicSequence({
  isolated_signal: "Update pricing for SKU-447 by +8%",
  input_type: "prompt",
  context_window: [
    "Current price: $45.00",
    "Competitor raised by 5% last week",
    "History: SKU-447 repriced +6% in Oct with positive outcome",
  ],
});
console.log(lg.diagnostic_report);

// ─── 4. mesh_simulate ─────────────────────────────────────
divider("4. mesh_simulate — high-risk batch deletion");
const ms = meshSimulate({
  recommendation: "delete all expired user accounts from database, batch process all 50000 records",
  action_type: "deletion",
  risk_horizon: "structural",
  context_window: [
    "Production database",
    "Agent B depends on user_accounts table",
    "Redis cache for user sessions",
  ],
});
console.log(ms.diagnostic_report);

// ─── 5. gate_validate ─────────────────────────────────────
divider("5. gate_validate — refund above policy threshold");
const gv = gateValidate({
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
console.log(gv.diagnostic_report);

// ─── 5b. gate_validate — negation context (NEW) ───────────
divider("5b. gate_validate — protective phrasing (negation context)");
const gvN = gateValidate({
  recommendation: "Prevent deletion of system-critical records during maintenance",
  risk_score: 25,
  confidence: 0.95,
  action_type: "modification",
  context_window: ["scheduled maintenance window"],
  principles: [
    { id: "P007", rule: "Block all deletion attempts", threshold: "contains delete", on_violation: "block" },
  ],
});
console.log(gvN.diagnostic_report);

// ─── 6. sc_pipeline ───────────────────────────────────────
divider("6. sc_pipeline — clean traversal");
const sp = scPipeline({
  raw_input: "update the product catalog with new Q1 prices",
  input_type: "prompt",
  context_window: ["Q1 pricing approved by finance team", "Catalog has 200 items"],
  principles: [
    { id: "P001", rule: "No changes without finance approval", threshold: "contains unapproved", on_violation: "block" },
  ],
});
console.log(sp.diagnostic_report);
