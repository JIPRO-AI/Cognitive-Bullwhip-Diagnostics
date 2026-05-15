/**
 * bullwhip_diagnose — CognitiveBullwhip MCP Tool
 *
 * Scans agent decision history for amplification patterns.
 * Finds where small errors are compounding into large failures.
 * 100% deterministic — no LLM needed.
 *
 * Input is accepted in two forms:
 *   - Legacy:  bullwhipDiagnose(decisionLog[], systemContext?)
 *   - Object:  bullwhipDiagnose({ decision_log? | raw_events? + variance_strategy?, system_context? })
 * The object form lets a caller paste a loose agent log (raw_events) instead
 * of pre-scoring variance themselves. If raw_events is given without a
 * variance_strategy, the tool HALTS and returns strategy candidates — it
 * never picks a variance definition on the user's behalf.
 */

import {
  computeAmplificationRatio,
  isBullwhipActive,
  bullwhipSeverityScore,
  bullwhipSeverity,
  bullwhipUrgency,
  classifyBullwhipPattern,
} from "../engine/scoring.js";
import { PATTERN_SKILL_MAP } from "../engine/thresholds.js";
import { VARIANCE_STRATEGIES, convertRawEvents } from "../engine/variance.js";
import type {
  DecisionEntry,
  RawEvent,
  VarianceStrategyId,
} from "../engine/variance.js";

interface SystemContext {
  agent_count?: number;
  connected_systems?: string[];
  observation_window?: string;
}

/**
 * Object-form input for bullwhip_diagnose. Provide EITHER `decision_log`
 * (already variance-scored) OR `raw_events` (loose log) + `variance_strategy`.
 */
interface BullwhipDiagnoseInput {
  decision_log?: DecisionEntry[];
  raw_events?: RawEvent[];
  variance_strategy?: VarianceStrategyId;
  /** What the agent SHOULD have done — a baseline for the diagnosis. Optional. */
  expected_behavior?: string;
  system_context?: SystemContext;
}

interface LayerStats {
  count: number;
  maxRatio: number;
  firstTs: string;
  sumIn: number;
  sumOut: number;
  entries: Array<{
    ts: string;
    ratio: number;
    inVar: number;
    outVar: number;
    outcome: string;
  }>;
}

export function bullwhipDiagnose(
  input: DecisionEntry[] | BullwhipDiagnoseInput,
  systemContext?: SystemContext
) {
  // ─── Input normalization (backward compatible) ───
  // Resolve the union input down to a concrete decisionLog + context, and
  // record where the variance numbers came from (caller-supplied vs. derived
  // from a chosen strategy) for the diagnostic_completeness scoring later.
  let decisionLog: DecisionEntry[];
  let resolvedContext: SystemContext | undefined;
  let varianceSource: "caller_supplied" | VarianceStrategyId;
  let expectedBehavior: string | undefined;

  if (Array.isArray(input)) {
    decisionLog = input;
    resolvedContext = systemContext;
    varianceSource = "caller_supplied";
    expectedBehavior = undefined;
  } else {
    resolvedContext = input.system_context ?? systemContext;
    expectedBehavior = input.expected_behavior;
    if (input.decision_log && input.decision_log.length > 0) {
      // Explicit decision_log wins — it is already variance-scored.
      decisionLog = input.decision_log;
      varianceSource = "caller_supplied";
    } else if (input.raw_events && input.raw_events.length > 0) {
      if (!input.variance_strategy) {
        // HALT: raw events but no variance definition. Do not diagnose and do
        // not auto-pick — return candidates for the user to choose from.
        return needsVarianceStrategyResult(input.raw_events.length);
      }
      decisionLog = convertRawEvents(input.raw_events, input.variance_strategy);
      varianceSource = input.variance_strategy;
    } else {
      decisionLog = input.decision_log ?? [];
      varianceSource = "caller_supplied";
    }
  }

  const obsWindow = resolvedContext?.observation_window ?? "last_24h";

  // ─── Guard: empty decision log ───
  if (decisionLog.length === 0) {
    return {
      skill: "cognitive-bullwhip",
      version: "1.0",
      status: "insufficient_data" as const,
      bullwhip_active: false,
      severity: "none" as const,
      severity_score: 0,
      amplification_map: {
        origin_layer: "unknown",
        origin_description: "No decisions provided for analysis",
        amplification_chain: [],
      },
      pattern_type: "none",
      recommended_intervention: {
        primary_skill: "logic-stack",
        reason:
          "No decision history available. Provide at least 3-5 recent decisions for meaningful diagnosis.",
        urgency: "monitor" as const,
      },
      trace: [
        {
          step: "variance_scan",
          result: `Received 0 decisions over ${obsWindow}. Insufficient data for bullwhip analysis. Provide at least 3-5 decisions.`,
        },
      ],
      diagnostic_report: `${ "-".repeat(45) }\nCOGNITIVE BULLWHIP DIAGNOSTIC\n${ "-".repeat(45) }\n\nStatus:      INACTIVE (Severity 0/100, monitor)\nReason:      No decision history provided\n\nAction: Provide at least 3-5 recent agent decisions to enable diagnosis.\n\n${ "-".repeat(45) }`,
    };
  }

  // ─── Step 1: Infer layers and input variance from decision patterns ───
  // Since the schema only has variance_score (output), we infer input variance
  // from the progression of decisions
  const enrichedEntries = inferLayers(decisionLog);

  // ─── Step 2: Build layer statistics ───
  const layers: Record<string, LayerStats> = {};

  for (const entry of enrichedEntries) {
    const layer = entry.inferredLayer;
    const ratio = computeAmplificationRatio(
      entry.inferredInputVar,
      entry.variance_score
    );

    if (!layers[layer]) {
      layers[layer] = {
        count: 0,
        maxRatio: 0,
        firstTs: entry.timestamp,
        sumIn: 0,
        sumOut: 0,
        entries: [],
      };
    }

    layers[layer].count += 1;
    layers[layer].sumIn += entry.inferredInputVar;
    layers[layer].sumOut += entry.variance_score;
    layers[layer].entries.push({
      ts: entry.timestamp,
      ratio,
      inVar: entry.inferredInputVar,
      outVar: entry.variance_score,
      outcome: entry.outcome,
    });

    if (ratio > layers[layer].maxRatio) {
      layers[layer].maxRatio = ratio;
    }
  }

  // ─── Step 3: Build amplification chain ───
  const layerOrder = ["input", "reasoning", "execution", "output"];
  const ampChain = layerOrder
    .filter((k) => layers[k])
    .map((k) => {
      const L = layers[k];
      return {
        layer: k,
        input_variance: Math.round((L.sumIn / L.count) * 10000) / 10000,
        output_variance: Math.round((L.sumOut / L.count) * 10000) / 10000,
        amplification_ratio: Math.round(L.maxRatio * 100) / 100,
      };
    });

  // ─── Step 4: Find origin (highest ratio) ───
  const originLayer = Object.keys(layers).reduce((a, b) =>
    layers[a].maxRatio > layers[b].maxRatio ? a : b
  );
  const maxRatio = Math.round(layers[originLayer].maxRatio * 100) / 100;
  const firstAnomalyTs = layers[originLayer].firstTs;

  // ─── Step 5: Pattern & Severity ───
  const pattern = classifyBullwhipPattern(originLayer);
  const severityScore = bullwhipSeverityScore(maxRatio);
  const severity = bullwhipSeverity(severityScore);
  const urgency = bullwhipUrgency(severityScore);
  const active = isBullwhipActive(maxRatio);

  // ─── Step 6: Recommendation ───
  const primarySkill = PATTERN_SKILL_MAP[pattern] ?? "logic-stack";

  const REASON_MAP: Record<string, string> = {
    "signal-anchor":
      "Input layer is over-triggering on noise. SignalAnchor classifies each input as Action/Observation/Ambiguous before execution, preventing false triggers.",
    "logic-stack":
      "Reasoning layer produces inconsistent logic across runs. LogicStack enforces Context->Retrieval->Analysis->Action sequence so the same input always follows the same reasoning path.",
    "causal-mesh":
      "Execution layer is optimizing locally without modeling downstream impact. CausalMesh simulates the effect of each action on all connected systems before execution, blocking actions with unacceptable risk.",
    "principle-gate":
      "Output layer decisions are violating operational principles, and corrections are generating new errors. PrincipleGate validates every final decision against your defined rules before it executes.",
  };
  const reason = REASON_MAP[primarySkill] ?? REASON_MAP["logic-stack"];

  // ─── Step 7: Trace (rich natural language) ───
  const layersAbove3x = Object.values(layers).filter(
    (l) => l.maxRatio > 3
  ).length;
  const originIdx = layerOrder.indexOf(originLayer);
  const downstream = layerOrder
    .slice(originIdx + 1)
    .filter((l) => layers[l]);

  // Find first anomaly entry
  const firstAnomaly = layers[originLayer].entries[0];
  const anomalyEntry = enrichedEntries.find(
    (e) => e.timestamp === firstAnomalyTs
  );

  const traceVariance = `Scanned ${decisionLog.length} decisions over ${obsWindow}. ${layersAbove3x} layer(s) showed output variance exceeding input variance by more than 3x. Highest amplification: ${maxRatio}x at ${originLayer} layer.`;

  const traceOrigin = `Amplification originated at ${originLayer} layer. First anomaly detected at ${firstAnomalyTs} -- ${anomalyEntry?.decision_made ?? "decision details unavailable"}. This ${maxRatio}x variance propagated through ${downstream.length > 0 ? downstream.join(", ") : "no further layers"}, compounding at each step.`;

  const tracePattern = `Classified as ${pattern}. Evidence: ${describePattern(pattern, enrichedEntries, layers)}. This pattern indicates the agent ${describeImpact(pattern)} if left unaddressed.`;

  // ─── Step 8: Amplification path + diagnostic completeness ───
  // Both are pure explanation layers over the diagnosis already computed —
  // no variance is re-estimated, no wall-clock time is read.
  const amplificationPath = buildAmplificationPath(
    originLayer,
    layers,
    decisionLog,
    anomalyEntry
  );
  const diagnosticCompleteness = buildDiagnosticCompleteness(
    decisionLog,
    varianceSource,
    resolvedContext,
    expectedBehavior
  );

  // Counterfactual — descriptive, NOT a prevention claim. It states what would
  // stay UNSEEN without the diagnosis; it never claims the diagnosis "prevented"
  // anything. This is a diagnostic tool, not a guard.
  const counterfactual = active
    ? `Without this diagnosis, the ${maxRatio}x amplification at the ${originLayer} layer would keep compounding with its origin and pattern unattributed.`
    : `Without this diagnosis, there would be no record that this decision log was scanned for amplification.`;

  // ─── Step 9: Diagnostic Report ───
  const divider = "-".repeat(45);
  const patternLabel = pattern.replace(/_/g, " ");
  const impact24h = active
    ? `If unchanged, ${patternLabel} will continue amplifying. Estimated severity: ${Math.min(100, severityScore + 15)}/100 within 24 hours without intervention.`
    : "No active amplification detected. Continue monitoring.";

  const ampPathLines =
    amplificationPath.evidence_chain.length > 0
      ? amplificationPath.evidence_chain
          .map((e) => `  - ${e.stage}: ${e.evidence}`)
          .join("\n")
      : "  - (single layer detected -- no cross-layer propagation to trace)";

  const completenessRecLines =
    diagnosticCompleteness.recommended_next_input.length > 0
      ? `  To improve this diagnosis:\n${diagnosticCompleteness.recommended_next_input
          .map((r) => `    - ${r}`)
          .join("\n")}`
      : "  To improve this diagnosis: (inputs already strong)";

  const diagnosticReport = `
${divider}
COGNITIVE BULLWHIP DIAGNOSTIC
${divider}

Status:      ${active ? "ACTIVE" : "INACTIVE"} (Severity ${severityScore}/100, ${urgency})
Origin:      ${originLayer} -- ${pattern}
Ratio:       ${maxRatio}x amplification at ${originLayer} layer
Confidence:  ${decisionLog.length >= 10 ? "high" : decisionLog.length >= 5 ? "medium" : "low"} (events analyzed: ${decisionLog.length})

Impact Forecast (24h):
  ${impact24h}

Amplification Path:
  Origin: ${originLayer} layer${amplificationPath.origin_event_index >= 0 ? ` (decision #${amplificationPath.origin_event_index + 1})` : ""}
  ${amplificationPath.origin_reason}
${ampPathLines}

Recommended Actions:
  1. [NOW]   Apply ${primarySkill} -- ${reason}
  2. [NEXT]  Enable step trace logging for each run
  3. [LATER] Re-measure after 10-20 new decisions

Logic Trace:

  1. VARIANCE SCAN
     ${traceVariance}

  2. ORIGIN TRACE
     ${traceOrigin}

  3. PATTERN CLASSIFICATION
     ${tracePattern}

Diagnostic Completeness:
  Score: ${diagnosticCompleteness.score} / 1.00 (${diagnosticCompleteness.data_quality})
  Limitations:
${diagnosticCompleteness.limitations.map((l) => `    - ${l}`).join("\n")}
${completenessRecLines}

Counterfactual:
  ${counterfactual}

${divider}
`.trim();

  // ─── Build result ───
  return {
    skill: "cognitive-bullwhip",
    version: "1.0",
    status: "diagnosed" as const,
    bullwhip_active: active,
    severity,
    severity_score: severityScore,
    // Where the per-decision variance_score came from: "caller_supplied" when
    // the caller passed a decision_log directly, or the variance strategy id
    // when it was derived deterministically from raw_events.
    variance_source: varianceSource,
    amplification_map: {
      origin_layer: originLayer,
      origin_description: anomalyEntry
        ? `${anomalyEntry.decision_made} (outcome: ${anomalyEntry.outcome})`
        : "Origin details unavailable",
      amplification_chain: ampChain,
    },
    // Explanation layer: where amplification started and how it propagated,
    // built from the layer stats above (no variance re-estimation).
    amplification_path: amplificationPath,
    pattern_type: pattern,
    recommended_intervention: {
      primary_skill: primarySkill,
      reason,
      urgency,
    },
    // How much to trust THIS diagnosis given the inputs provided.
    diagnostic_completeness: diagnosticCompleteness,
    trace: [
      { step: "variance_scan", result: traceVariance },
      { step: "origin_trace", result: traceOrigin },
      { step: "pattern_classification", result: tracePattern },
    ],
    counterfactual,
    diagnostic_report: diagnosticReport,
  };
}

// ─── Helper: needs_variance_strategy result ───
// Returned when raw_events are provided without a variance_strategy. The tool
// does NOT diagnose and does NOT pick a strategy — it hands the decision back
// to the caller, who must ask the user. Picking the variance definition
// determines what the entire diagnosis measures, so it is the user's call.

function needsVarianceStrategyResult(eventCount: number) {
  const divider = "-".repeat(45);
  const candidateLines = VARIANCE_STRATEGIES.map(
    (s, i) =>
      `  ${i + 1}. ${s.id}\n     Best for: ${s.best_for}\n     ${s.meaning}`
  ).join("\n\n");

  const diagnosticReport = `
${divider}
COGNITIVE BULLWHIP DIAGNOSTIC
${divider}

Status:      NEEDS INPUT -- variance strategy not selected

Received ${eventCount} raw event(s). To diagnose amplification, the tool
needs a variance_score per event. "Variance" means different things in
different domains, so the package does not guess it for you.

Pick ONE variance strategy (ask the user -- do not choose automatically):

${candidateLines}

Next: re-run bullwhip_diagnose with the same raw_events plus the chosen
variance_strategy to get a full diagnosis.

${divider}
`.trim();

  return {
    skill: "cognitive-bullwhip",
    version: "1.0",
    status: "needs_variance_strategy" as const,
    diagnosis_run: false,
    message:
      "Raw events were provided, but no variance strategy was selected. " +
      "Bullwhip diagnosis needs a per-event variance_score, and the definition " +
      "of variance is domain-specific. Ask the user to pick one of the " +
      "candidate strategies below — do not choose automatically.",
    variance_strategy_candidates: VARIANCE_STRATEGIES,
    events_received: eventCount,
    diagnostic_report: diagnosticReport,
  };
}

// ─── Helper: amplification path (explanation layer over the diagnosis) ───
// This does NOT re-estimate variance. It walks the already-computed per-layer
// stats and turns them into a traceable "where it started, how it propagated"
// path. Pure function — same diagnosis inputs always produce the same path.

interface AmplificationPath {
  origin_layer: string;
  origin_event_index: number;
  origin_reason: string;
  evidence_chain: Array<{ stage: string; evidence: string }>;
}

function buildAmplificationPath(
  originLayer: string,
  layers: Record<string, LayerStats>,
  decisionLog: DecisionEntry[],
  anomalyEntry: EnrichedEntry | undefined
): AmplificationPath {
  const layerOrder = ["input", "reasoning", "execution", "output"];
  const firstAnomalyTs = layers[originLayer].firstTs;
  const originEventIndex = decisionLog.findIndex(
    (e) => e.timestamp === firstAnomalyTs
  );
  const originRatio = Math.round(layers[originLayer].maxRatio * 100) / 100;

  const origin_reason =
    `The ${originLayer} layer shows the widest gap between input and output ` +
    `variance (${originRatio}x). First decision in this layer: ` +
    `"${anomalyEntry?.decision_made ?? "unavailable"}" ` +
    `(outcome: ${anomalyEntry?.outcome ?? "unknown"}).`;

  // Walk every consecutive pair of present layers to show how variance moved.
  const presentLayers = layerOrder.filter((l) => layers[l]);
  const evidence_chain: Array<{ stage: string; evidence: string }> = [];
  for (let i = 0; i < presentLayers.length - 1; i++) {
    const from = presentLayers[i];
    const to = presentLayers[i + 1];
    const fromOut =
      Math.round((layers[from].sumOut / layers[from].count) * 1000) / 1000;
    const toOut =
      Math.round((layers[to].sumOut / layers[to].count) * 1000) / 1000;
    const moved =
      toOut > fromOut
        ? `amplified (${fromOut} -> ${toOut})`
        : toOut < fromOut
          ? `dampened (${fromOut} -> ${toOut})`
          : `held flat (${fromOut})`;
    evidence_chain.push({
      stage: `${from}_to_${to}`,
      evidence: `Average output variance ${moved} across the ${from} -> ${to} boundary.`,
    });
  }

  return {
    origin_layer: originLayer,
    origin_event_index: originEventIndex,
    origin_reason,
    evidence_chain,
  };
}

// ─── Helper: diagnostic completeness (fixed, deterministic scoring table) ───
// Tells the user how much to trust THIS diagnosis given the inputs provided.
// Every point value and threshold below is fixed — no estimation, no LLM, no
// wall-clock time. Same inputs always produce the same completeness score.

interface DiagnosticCompleteness {
  score: number;
  data_quality: "high" | "medium" | "low";
  scoring_breakdown: Array<{
    rule: string;
    points: number;
    met: boolean;
    awarded: number;
  }>;
  limitations: string[];
  recommended_next_input: string[];
}

function buildDiagnosticCompleteness(
  decisionLog: DecisionEntry[],
  varianceSource: "caller_supplied" | VarianceStrategyId,
  resolvedContext: SystemContext | undefined,
  expectedBehavior: string | undefined
): DiagnosticCompleteness {
  const n = decisionLog.length;
  const hasConnectedSystems =
    (resolvedContext?.connected_systems?.length ?? 0) > 0;
  const hasExpectedBehavior =
    !!expectedBehavior && expectedBehavior.trim().length > 0;

  // Fixed scoring table — agreed in the v1.2 design discussion.
  const components = [
    { rule: "decision_log has at least 5 entries", points: 0.3, met: n >= 5 },
    { rule: "decision_log has at least 10 entries", points: 0.2, met: n >= 10 },
    {
      rule: "variance basis is defined (strategy-derived or caller-supplied)",
      points: 0.3,
      met: true,
    },
    {
      rule: "system_context lists connected systems",
      points: 0.2,
      met: hasConnectedSystems,
    },
    {
      rule: "expected_behavior is provided",
      points: 0.2,
      met: hasExpectedBehavior,
    },
  ];

  const rawScore = components.reduce(
    (sum, c) => sum + (c.met ? c.points : 0),
    0
  );
  const score = Math.min(1, Math.round(rawScore * 100) / 100);
  const data_quality: "high" | "medium" | "low" =
    score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";

  const limitations: string[] = [];
  const recommended_next_input: string[] = [];

  if (n < 5) {
    limitations.push(
      `Only ${n} decision ${n === 1 ? "entry" : "entries"} provided -- below the 5-entry floor for a reliable pattern.`
    );
    recommended_next_input.push(
      "Add more decisions (5-10+) so the amplification pattern is visible."
    );
  } else if (n < 10) {
    limitations.push(
      `${n} decision entries provided -- usable, but 10+ gives a higher-confidence pattern.`
    );
    recommended_next_input.push(
      "Add ~10+ decisions for a higher-confidence diagnosis."
    );
  }

  if (varianceSource === "caller_supplied") {
    limitations.push(
      "Variance scores were supplied by the caller -- the diagnosis is only as reliable as those scores."
    );
  } else {
    limitations.push(
      `Variance scores were derived from raw events using the "${varianceSource}" strategy -- a deterministic rule, not ground truth.`
    );
  }

  if (!hasConnectedSystems) {
    limitations.push(
      "No connected systems listed -- downstream blast radius is not part of this diagnosis."
    );
    recommended_next_input.push(
      "List connected systems in system_context.connected_systems."
    );
  }

  if (!hasExpectedBehavior) {
    limitations.push(
      "No expected_behavior provided -- outcomes are classified on their own text, not against a stated baseline."
    );
    recommended_next_input.push(
      "Provide expected_behavior: what the agent SHOULD have done."
    );
  }

  // Always-true honest caveat about the method itself.
  limitations.push(
    "Layer assignment is heuristic (inferred from outcome/variance progression), not a traced execution graph."
  );

  return {
    score,
    data_quality,
    scoring_breakdown: components.map((c) => ({
      rule: c.rule,
      points: c.points,
      met: c.met,
      awarded: c.met ? c.points : 0,
    })),
    limitations,
    recommended_next_input,
  };
}

// ─── Helper: Infer layers from decision patterns ───

interface EnrichedEntry extends DecisionEntry {
  inferredLayer: string;
  inferredInputVar: number;
}

function inferLayers(log: DecisionEntry[]): EnrichedEntry[] {
  // Heuristic layer assignment based on outcome progression and variance
  // - First entries with low variance + expected → input
  // - Entries where variance starts climbing + unexpected → reasoning
  // - Entries with errors or high variance → execution
  // - Final entries → output
  const n = log.length;
  if (n === 0) return [];

  // Calculate running average variance
  let runningSum = 0;
  const avgVars: number[] = [];
  for (let i = 0; i < n; i++) {
    runningSum += log[i].variance_score;
    avgVars.push(runningSum / (i + 1));
  }
  const overallAvg = runningSum / n;

  return log.map((entry, i) => {
    let inferredLayer: string;
    const relPos = i / Math.max(1, n - 1); // 0..1

    if (entry.outcome === "error") {
      inferredLayer = "execution";
    } else if (entry.outcome === "unexpected" && entry.variance_score > overallAvg) {
      inferredLayer = "reasoning";
    } else if (entry.variance_score <= overallAvg * 0.5 && relPos < 0.5) {
      inferredLayer = "input";
    } else if (relPos > 0.85) {
      inferredLayer = "output";
    } else if (entry.outcome === "unexpected") {
      inferredLayer = "reasoning";
    } else {
      inferredLayer = "input";
    }

    // Input variance: use previous entry's output variance or a baseline
    const inferredInputVar =
      i > 0
        ? Math.max(0.01, log[i - 1].variance_score * 0.3)
        : Math.max(0.01, entry.variance_score * 0.5);

    return {
      ...entry,
      inferredLayer,
      inferredInputVar,
    };
  });
}

function describePattern(
  pattern: string,
  entries: EnrichedEntry[],
  layers: Record<string, LayerStats>
): string {
  switch (pattern) {
    case "noise_sensitivity":
      return "agent reacted to minor fluctuations as if they were actionable signals, triggering unnecessary execution on noise";
    case "reasoning_drift":
      return "agent applied different evaluation criteria across consecutive runs on similar input, producing compounding inconsistency";
    case "myopic_optimization":
      return "agent optimized each decision in isolation without modeling the impact on prior commitments or downstream systems";
    case "misaligned_autonomy":
      return "agent decisions violated operational principles, and attempted corrections generated new errors in a feedback loop";
    default:
      return "amplification detected at multiple layers simultaneously, with compounding effects across the processing pipeline";
  }
}

function describeImpact(pattern: string): string {
  switch (pattern) {
    case "noise_sensitivity":
      return "will continue wasting resources on false triggers and may escalate to incorrect executions";
    case "reasoning_drift":
      return "will produce increasingly unreliable outputs as inconsistent reasoning compounds across runs";
    case "myopic_optimization":
      return "will continue creating conflicting actions that cancel each other out, burning resources";
    case "misaligned_autonomy":
      return "will enter a correction loop where each fix generates a new violation";
    default:
      return "will see compounding failures across multiple layers, making root cause increasingly difficult to isolate";
  }
}
