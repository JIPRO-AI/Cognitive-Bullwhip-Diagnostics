/**
 * Variance strategy engine — deterministic raw_events -> decision_log conversion.
 *
 * `bullwhip_diagnose` needs a `variance_score` per decision. The package does
 * NOT invent that score: "variance" means different things in different
 * domains (a loss in trading, a flip-flop in reasoning, an outcome deviation
 * in a general workflow). So instead of guessing, the caller selects a
 * *variance strategy* and this module applies it as a fixed, deterministic
 * rule.
 *
 * No LLM, no Date, no randomness — every function here is pure.
 */

export interface DecisionEntry {
  timestamp: string;
  input_summary: string;
  decision_made: string;
  outcome: "expected" | "unexpected" | "error";
  variance_score: number;
}

/**
 * A loose, paste-friendly event shape — what a user actually has on hand from
 * an agent log. `convertRawEvents` turns it into a strict DecisionEntry.
 */
export interface RawEvent {
  /** Optional — synthesized deterministically ("synthetic-event-N") if absent. */
  timestamp?: string;
  /** What the agent received. */
  input: string;
  /** What the agent did. */
  decision: string;
  /** Free-text result. Classified into expected/unexpected/error. */
  outcome: string;
  /** Optional extra context. */
  notes?: string;
}

export type VarianceStrategyId =
  | "outcome_deviation"
  | "decision_flip"
  | "execution_loss";

export interface VarianceStrategy {
  id: VarianceStrategyId;
  best_for: string;
  meaning: string;
}

/**
 * The variance-definition options offered to the caller when raw_events are
 * provided without a strategy. The calling agent MUST surface these to the
 * human and let them choose — it must not pick one automatically. Picking the
 * variance definition is a judgement call that belongs to the user, not the
 * tool, because it determines what the whole diagnosis measures.
 */
export const VARIANCE_STRATEGIES: VarianceStrategy[] = [
  {
    id: "outcome_deviation",
    best_for: "general agent workflows",
    meaning:
      "Variance is how far each outcome drifted from expected behavior. Use this when you mainly care that the agent did something other than what it should have.",
  },
  {
    id: "decision_flip",
    best_for: "reasoning drift / inconsistent outputs",
    meaning:
      "Variance is how often a decision reverses the previous one (yes->no, buy->sell, approve->reject). Use this when the agent keeps changing its mind on similar input.",
  },
  {
    id: "execution_loss",
    best_for: "trading / production systems",
    meaning:
      "Variance is how much an action cost -- loss, failed execution, rollback. Use this when the damage of a wrong action matters more than the wrongness itself.",
  },
];

// ─── Outcome text classification (shared) ───

const ERROR_RE =
  /\b(error|errors|fail|failed|failing|failure|crash|crashed|exception|rollback|reverted|revert|lost|loss|drawdown|wiped|liquidated|broke|broken)\b/i;
const UNEXPECTED_RE =
  /\b(unexpected|unanticipated|surprising|surprise|surprised|deviated|deviation|different|differed|wrong|incorrect|mismatch|mismatched|inconsistent|unintended)\b/i;

/**
 * Map a free-text outcome string to the strict DecisionEntry outcome enum.
 * Deterministic keyword classification; error > unexpected > expected.
 */
export function classifyOutcome(
  outcomeText: string
): "expected" | "unexpected" | "error" {
  if (ERROR_RE.test(outcomeText)) return "error";
  if (UNEXPECTED_RE.test(outcomeText)) return "unexpected";
  return "expected";
}

// ─── Reversal detection for the decision_flip strategy ───

const FLIP_PAIRS: Array<[string, string]> = [
  ["yes", "no"],
  ["buy", "sell"],
  ["long", "short"],
  ["open", "close"],
  ["opened", "closed"],
  ["approve", "reject"],
  ["approved", "rejected"],
  ["accept", "decline"],
  ["enable", "disable"],
  ["add", "remove"],
  ["start", "stop"],
  ["increase", "decrease"],
  ["bullish", "bearish"],
  ["grant", "revoke"],
  ["allow", "deny"],
];

const SELF_REVERSAL_RE =
  /\b(reverse|reversed|reversal|switch|switched|flip|flipped|undo|undid|backtrack|backtracked)\b/i;

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

/**
 * Detect whether `decision` reverses `priorDecision`. Deterministic
 * opposite-direction keyword pairing — not semantic analysis.
 */
function isReversal(decision: string, priorDecision: string): boolean {
  for (const [a, b] of FLIP_PAIRS) {
    const curA = hasWord(decision, a);
    const curB = hasWord(decision, b);
    const priorA = hasWord(priorDecision, a);
    const priorB = hasWord(priorDecision, b);
    if ((priorA && curB) || (priorB && curA)) return true;
  }
  return false;
}

// ─── Per-strategy variance scoring (all pure, all deterministic) ───

function scoreOutcomeDeviation(
  classified: "expected" | "unexpected" | "error"
): number {
  if (classified === "error") return 1.2;
  if (classified === "unexpected") return 0.7;
  return 0.1;
}

function scoreDecisionFlip(
  event: RawEvent,
  priorEvent: RawEvent | undefined
): number {
  if (SELF_REVERSAL_RE.test(event.decision)) return 0.85;
  if (!priorEvent) return 0.1; // first event — nothing prior to flip from
  if (isReversal(event.decision, priorEvent.decision)) return 0.95;
  return 0.15;
}

const STRONG_LOSS_RE =
  /\b(lost|loss|drawdown|liquidated|wiped|margin call)\b/i;
const MONEY_LOSS_RE = /-\s*\$?\s*\d/; // "-$92", "- 92", "-92"
const EXEC_FAIL_RE =
  /\b(error|failed|failure|crash|crashed|exception|rollback|reverted)\b/i;

function scoreExecutionLoss(
  event: RawEvent,
  classified: "expected" | "unexpected" | "error"
): number {
  const o = event.outcome;
  if (STRONG_LOSS_RE.test(o) || MONEY_LOSS_RE.test(o)) return 1.5;
  if (EXEC_FAIL_RE.test(o)) return 1.0;
  if (classified === "unexpected") return 0.4;
  return 0.1;
}

/** Exhaustive dispatch over the closed VarianceStrategyId union. */
function computeVarianceScore(
  event: RawEvent,
  priorEvent: RawEvent | undefined,
  classified: "expected" | "unexpected" | "error",
  strategy: VarianceStrategyId
): number {
  switch (strategy) {
    case "outcome_deviation":
      return scoreOutcomeDeviation(classified);
    case "decision_flip":
      return scoreDecisionFlip(event, priorEvent);
    case "execution_loss":
      return scoreExecutionLoss(event, classified);
  }
}

/**
 * Convert paste-friendly raw events into strict DecisionEntry records using
 * the selected variance strategy. Fully deterministic — the same raw_events
 * and the same strategy always produce the same decision_log.
 */
export function convertRawEvents(
  rawEvents: RawEvent[],
  strategy: VarianceStrategyId
): DecisionEntry[] {
  return rawEvents.map((event, i) => {
    const classified = classifyOutcome(event.outcome);
    const variance_score = computeVarianceScore(
      event,
      rawEvents[i - 1],
      classified,
      strategy
    );

    const input_summary = event.notes
      ? `${event.input} (note: ${event.notes})`
      : event.input;

    return {
      timestamp: event.timestamp ?? `synthetic-event-${i}`,
      input_summary,
      decision_made: event.decision,
      outcome: classified,
      variance_score,
    };
  });
}
