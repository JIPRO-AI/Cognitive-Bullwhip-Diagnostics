/**
 * demo:replay -- Cognitive Bullwhip Diagnostics demo runner.
 *
 * Replays the example agent scenarios in examples/ through the ACTUAL tools
 * and prints each tool's human-readable report. This is the 60-second
 * "see it work" path: clone, npm install, npm run demo:replay.
 *
 * Every example pins a fixed decision_timestamp where the tool would
 * otherwise stamp runtime, so the demo output is reproducible run to run
 * (verify with: npm run test:determinism).
 *
 * Run: npm run demo:replay
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bullwhipDiagnose } from "../src/tools/bullwhip-diagnose.js";
import { scPipeline } from "../src/tools/sc-pipeline.js";

const examplesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "examples"
);

interface Example {
  title: string;
  scenario: string;
  tool: "bullwhip_diagnose" | "sc_pipeline";
  input: Record<string, unknown>;
  what_to_notice: string;
}

function runExample(ex: Example): string {
  switch (ex.tool) {
    case "bullwhip_diagnose":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return bullwhipDiagnose(ex.input as any).diagnostic_report;
    case "sc_pipeline":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return scPipeline(ex.input as any).diagnostic_report;
    default:
      return `(unknown tool: ${ex.tool})`;
  }
}

const files = readdirSync(examplesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

const bar = "=".repeat(64);
console.log("\n" + bar);
console.log("  COGNITIVE BULLWHIP DIAGNOSTICS -- DEMO REPLAY");
console.log(`  ${files.length} example scenario(s), replayed through the real tools`);
console.log(bar);

for (const file of files) {
  const ex = JSON.parse(
    readFileSync(join(examplesDir, file), "utf8")
  ) as Example;

  console.log("\n\n" + "#".repeat(64));
  console.log(`# ${ex.title}`);
  console.log(`# tool: ${ex.tool}   (examples/${file})`);
  console.log("#".repeat(64));
  console.log(`\nScenario:\n  ${ex.scenario}`);
  console.log("\n" + runExample(ex));
  console.log(`\nWhat to notice:\n  ${ex.what_to_notice}`);
}

console.log("\n" + bar);
console.log("  End of demo. Each report above is one tool's actual output --");
console.log("  same input always produces the same report.");
console.log("  Verify: npm run test:determinism");
console.log(bar + "\n");
