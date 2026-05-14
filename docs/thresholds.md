# Thresholds

Every numeric constant in `src/engine/thresholds.ts` is an *empirical default*.
This page documents the reasoning behind each one and how to safely tune it.

The package is "100% deterministic" — given input, output is fixed. But the
boundary between "OK" and "flagged" is set by these constants. **Tune them
for your domain.** Defaults reflect the public case studies (Kalshi crypto
bot, generic AI agent scenarios), not your specific risk surface.

---

## BULLWHIP

### `RATIO_CONFIRM = 3.0`

Amplification ratio (output variance ÷ input variance) above which the
bullwhip is treated as *active* at that layer.

**Why 3.0?** Lee, Padmanabhan & Whang (1997) treat any amplification ratio
> 1.0 as evidence of bullwhip. Empirically, ratios in the 1.0–2.0 range
often reflect noise in the variance measurement itself. We chose 3.0 as a
conservative "clearly above noise" floor that triggers actionable alerts
without firing on every small fluctuation.

**Tuning**:
- *Lower (e.g. 2.0)* if your domain has stable inputs and you want earlier alerts.
- *Higher (e.g. 4.0–5.0)* if your inputs are inherently noisy (financial markets, sensor data).

### `SEVERITY.NONE_MAX = 20`, `LOW_MAX = 40`, `MODERATE_MAX = 60`, `HIGH_MAX = 80`

Severity score is on 0–100. Bands are evenly spaced at 20-point intervals
(none / low / moderate / high / critical) — chosen for human readability,
not from a formal distribution.

**Tuning**: shift bands toward zero if you want more findings to appear
"critical" in dashboards. Leave alone if these bands match your existing
incident scale.

### `URGENCY.IMMEDIATE_ABOVE = 70`, `SCHEDULED_ABOVE = 40`

How fast a recommended intervention should be applied:
- > 70 → immediate (act now)
- 40–70 → scheduled (within current sprint / week)
- < 40 → monitor (passive watching)

**Tuning**: lower both if you have spare engineering capacity to act on
flags. Raise them if alert fatigue is a real concern.

---

## ANCHOR

### `CONFIDENCE_AUTO_FLAG = 0.6`

When `anchor_classify` computes confidence below 0.6, the signal is forced
to `ambiguous` regardless of how the noise/danger pattern classification
would otherwise route it.

**Why 0.6?** Two observations:
1. Below 0.5, the agent is essentially guessing — definitely flag.
2. Between 0.5–0.6, agents in the Kalshi case study made decisions that
   later proved to be the start of the amplification chain. Setting the
   floor at 0.6 catches these "barely above coin-flip" cases.

**Tuning**:
- *Lower (e.g. 0.5)* if you tolerate more autonomous action on uncertain input.
- *Higher (e.g. 0.7–0.8)* in high-stakes domains where any uncertainty should escalate to human.

---

## MESH

### `RISK.FLAG_ABOVE = 70`, `RISK.BLOCK_ABOVE = 90`

Risk score 0–100. Above 70 = flag; above 90 = block.

**Why 70 / 90?** These map to common operational risk language:
- "yellow" alert band ~70+
- "red" hard-block band ~90+

The choice is operational, not statistical. Validate against your incident
log: if too few incidents historically reached "risk_score > 70", lower the
flag threshold.

**Tuning**: keep the 20-point gap between flag and block (90 - 70 = 20). It
reflects a deliberate buffer for "human review can prevent escalation".

### `STRUCTURAL_ESCALATE_ABOVE = 50`

For risk_horizon = `structural` actions, a lower threshold escalates
earlier because structural changes are *harder to reverse*.

**Why 50?** Empirically, structural changes (schema migrations, auth
rewrites, etc.) that crossed the 50 mark in test cases tended to require
post-hoc rollback work. Earlier escalation reduces that cost.

---

## GATE

### `DEFAULT_CONFIDENCE_FLOOR = 0.70`

If no `confidence_floor` is provided per call, this is the floor below
which the gate auto-escalates regardless of risk score or principle
checks.

**Why 0.70?** Aligns with the standard "high confidence required for
autonomous action" guidance in agent safety literature. Above 0.70, the
agent is confident enough that the *other* gates (risk score, principles)
determine outcome.

**Tuning**: override per call by passing `confidence_floor` in the input.
Keep this default conservative for the no-config case.

### `RISK_AUTO_BLOCK = 90`

Risk score 90+ blocks regardless of principles or confidence.

**Why 90?** Matches `MESH.RISK.BLOCK_ABOVE`. Risk that mesh says block-level
should not pass gate either, even if principles silently allow it. This is
a "safety net" against principle gaps.

---

## PATTERN_SKILL_MAP

Maps a detected bullwhip pattern → which tool to deploy as the primary
intervention. Mapping is **conceptual, not empirical** — based on the
4-pattern × 4-layer correspondence in the README's *Pattern Types* table.

The `compound` pattern (multi-layer amplification) is mapped to
`logic-stack` by convention: enforcing reasoning sequence usually
contains the most cross-layer drift in our case studies. If your
intervention budget allows multiple skills, deploy by layer-of-origin
(input → anchor, reasoning → logic, execution → mesh, output → gate).

---

## How to tune safely

1. **Measure your baseline** before changing any threshold. Run the tools
   over a representative sample of decisions with defaults; look at the
   distribution of `severity_score`, `risk_score`, `confidence`.
2. **Change one constant at a time**. If you raise `RATIO_CONFIRM` from
   3.0 to 4.0 and *also* lower `CONFIDENCE_AUTO_FLAG` from 0.6 to 0.5,
   you cannot attribute the effect to either.
3. **Re-run the test suite** after every tuning change. The 117 assertions
   in `test/e2e-all.ts` are conservative — they pass with defaults *and*
   with reasonable tuning ranges. If you break them, your tuning is
   probably too aggressive.
4. **Document the tuned values** in a `thresholds.local.ts` or via env
   vars. Do not edit the source defaults in-tree unless you intend to PR
   the change upstream.
