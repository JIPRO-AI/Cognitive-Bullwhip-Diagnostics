/**
 * Determinism Self-Test for Structured Cognition Server
 *
 * The repo claims: "same input always produces same output." This file
 * proves it instead of just asserting it in prose. Each of the 6 tools is
 * run N times on a fixed input; the SHA-256 hash of every run must be
 * identical (a deterministic tool yields exactly ONE distinct hash).
 *
 * The only non-deterministic field anywhere in the package is the
 * PrincipleGate audit timestamp. `gate_validate` and `sc_pipeline` therefore
 * accept an optional `decision_timestamp`; with it fixed, their output is
 * fully reproducible. The regression guard at the end also proves the
 * timestamp is the SOLE source of non-determinism — two runs without a
 * fixed timestamp differ ONLY in `audit_trail.decision_timestamp`.
 *
 * This is the test that would have caught the original `new Date()` bug.
 *
 * Run: npx tsx test/determinism.ts   (or: npm run test:determinism)
 */

import { createHash } from "node:crypto";
import { bullwhipDiagnose } from "../src/tools/bullwhip-diagnose.js";
import { anchorClassify } from "../src/tools/anchor-classify.js";
import { logicSequence } from "../src/tools/logic-sequence.js";
import { meshSimulate } from "../src/tools/mesh-simulate.js";
import { gateValidate } from "../src/tools/gate-validate.js";
import { scPipeline } from "../src/tools/sc-pipeline.js";

const RUNS = 100;
const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

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

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Run `fn` RUNS times and return the set of distinct output hashes.
 * A deterministic tool yields a set of size exactly 1.
 */
function distinctHashes(fn: () => unknown): Set<string> {
  const hashes = new Set<string>();
  for (let i = 0; i < RUNS; i++) {
    hashes.add(hash(fn()));
  }
  return hashes;
}

section(`DETERMINISM SELF-TEST (${RUNS} runs per tool)`);

// ─── Tool 1: bullwhip_diagnose — no timestamp, must be fully deterministic ───
const bwInput = [
  { timestamp: "2026-02-26T10:00:00Z", input_summary: "BTC +0.3%", decision_made: "Logged", outcome: "expected" as const, variance_score: 0.08 },
  { timestamp: "2026-02-26T10:05:00Z", input_summary: "Volume spike 1400", decision_made: "Classified bullish, prepared YES order", outcome: "unexpected" as const, variance_score: 0.85 },
  { timestamp: "2026-02-26T10:10:00Z", input_summary: "Same data re-eval", decision_made: "Reversed to bearish, prepared NO order", outcome: "unexpected" as const, variance_score: 0.95 },
  { timestamp: "2026-02-26T10:15:00Z", input_summary: "Both YES/NO queued", decision_made: "Executed both opposing orders", outcome: "error" as const, variance_score: 2.5 },
];
{
  const h = distinctHashes(() =>
    bullwhipDiagnose(bwInput, { agent_count: 3, connected_systems: ["kalshi", "dispatcher"], observation_window: "last_1h" })
  );
  assert(h.size === 1, "bullwhip_diagnose → identical output across all runs", `${h.size} distinct hashes`);
}

// The raw_events -> decision_log conversion (variance strategy applied) must
// also be deterministic — same raw_events + same strategy => same diagnosis.
const bwRawInput = {
  raw_events: [
    { timestamp: "2026-05-14T10:00:00Z", input: "BTC +0.3%", decision: "Logged signal", outcome: "as expected" },
    { timestamp: "2026-05-14T10:05:00Z", input: "Volume spike", decision: "Opened YES position", outcome: "unexpected reversal" },
    { timestamp: "2026-05-14T10:10:00Z", input: "Same data re-eval", decision: "Doubled the position", outcome: "Lost position, -$40" },
    { timestamp: "2026-05-14T10:15:00Z", input: "PnL down", decision: "Recovery trade", outcome: "failed execution, -$120 drawdown" },
  ],
  variance_strategy: "execution_loss" as const,
};
{
  const h = distinctHashes(() => bullwhipDiagnose(bwRawInput));
  assert(h.size === 1, "bullwhip_diagnose (raw_events + variance_strategy) → identical output across all runs", `${h.size} distinct hashes`);
}

// ─── Tool 2: anchor_classify — no timestamp, must be fully deterministic ───
{
  const h = distinctHashes(() =>
    anchorClassify({ raw_input: "maybe we should delete the old customer records, not sure though", input_type: "prompt", context_window: [] })
  );
  assert(h.size === 1, "anchor_classify → identical output across all runs", `${h.size} distinct hashes`);
}

// ─── Tool 3: logic_sequence — no timestamp, must be fully deterministic ───
{
  const h = distinctHashes(() =>
    logicSequence({ isolated_signal: "refactor the auth module and migrate the user schema immediately", input_type: "prompt", context_window: ["legacy system", "no test coverage"] })
  );
  assert(h.size === 1, "logic_sequence → identical output across all runs", `${h.size} distinct hashes`);
}

// ─── Tool 4: mesh_simulate — no timestamp, must be fully deterministic ───
{
  const h = distinctHashes(() =>
    meshSimulate({ recommendation: "drop the production users table and clear the redis cache", action_type: "deletion", risk_horizon: "immediate", context_window: ["production database", "redis cache", "billing api"] })
  );
  assert(h.size === 1, "mesh_simulate → identical output across all runs", `${h.size} distinct hashes`);
}

// ─── Tool 5: gate_validate — deterministic ONCE the audit timestamp is fixed ───
const gateInput = {
  recommendation: "delete all archived customer records older than 90 days",
  risk_score: 65,
  confidence: 0.8,
  action_type: "deletion",
  context_window: ["GDPR retention policy", "no backup verified"],
  principles: [
    { id: "P001", rule: "No deletion of customer data without review", threshold: "contains delete", on_violation: "escalate" as const },
  ],
};
{
  const h = distinctHashes(() => gateValidate({ ...gateInput, decision_timestamp: FIXED_TIMESTAMP }));
  assert(h.size === 1, "gate_validate (fixed timestamp) → identical output across all runs", `${h.size} distinct hashes`);
}

// ─── Tool 6: sc_pipeline — deterministic ONCE the audit timestamp is fixed ───
{
  const h = distinctHashes(() =>
    scPipeline({
      raw_input: "delete all archived customer records older than 90 days now",
      input_type: "prompt",
      context_window: ["GDPR retention policy", "production database", "no backup verified"],
      principles: [
        { id: "P001", rule: "No deletion of customer data without review", threshold: "contains delete", on_violation: "escalate" as const },
      ],
      decision_timestamp: FIXED_TIMESTAMP,
    })
  );
  assert(h.size === 1, "sc_pipeline (fixed timestamp) → identical output across all runs", `${h.size} distinct hashes`);
}

// ─── Regression guard: the audit timestamp is the SOLE source of non-determinism ───
// Strategy: run gate_validate with two DIFFERENT fixed timestamps.
//   - Raw outputs must differ        → proves the timestamp actually flows into output.
//   - Normalized outputs must match  → proves NOTHING ELSE depends on wall-clock time.
// If any other field drifted, the normalized comparison would fail — which is
// exactly the class of bug this self-test exists to catch.
// (Note: we use two explicit timestamps rather than two un-fixed runs, because
// two un-fixed runs can land in the same millisecond and be coincidentally equal.)
section("REGRESSION GUARD — audit timestamp is the only non-deterministic field");
{
  const TS_A = "2026-01-01T00:00:00.000Z";
  const TS_B = "2099-12-31T23:59:59.999Z";

  const normalize = (r: Record<string, unknown>) => {
    const clone = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    (clone.audit_trail as Record<string, unknown>).decision_timestamp = "<normalized>";
    // The human-readable report embeds the same timestamp — normalize it too.
    clone.diagnostic_report = String(clone.diagnostic_report).replace(
      /Timestamp:\s*\S+/,
      "Timestamp: <normalized>"
    );
    return clone;
  };

  const runA = gateValidate({ ...gateInput, decision_timestamp: TS_A }) as unknown as Record<string, unknown>;
  const runB = gateValidate({ ...gateInput, decision_timestamp: TS_B }) as unknown as Record<string, unknown>;

  assert(
    hash(runA) !== hash(runB),
    "gate_validate → a different decision_timestamp produces different raw output",
  );
  assert(
    hash(normalize(runA)) === hash(normalize(runB)),
    "gate_validate → timestamp is the SOLE difference (outputs match once it is normalized out)",
  );

  const fixedA = gateValidate({ ...gateInput, decision_timestamp: TS_A });
  const fixedB = gateValidate({ ...gateInput, decision_timestamp: TS_A });
  assert(
    hash(fixedA) === hash(fixedB),
    "gate_validate → the same fixed decision_timestamp makes raw output byte-identical",
  );
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
section("DETERMINISM TEST RESULTS");
console.log(`\n  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (errors.length > 0) {
  console.log(`\n  Failures:`);
  errors.forEach((e) => console.log(e));
}
console.log(`\n  Total: ${passed + failed} checks\n`);
process.exit(failed > 0 ? 1 : 0);
