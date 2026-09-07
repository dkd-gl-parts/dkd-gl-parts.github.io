"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const workflowsDirectory = path.join(root, ".github", "workflows");
const scriptsDirectory = path.join(root, "scripts");
const targetWorkflowName = "search-performance-guard.yml";
const targetJobName = "verify-search-workload";

const approvedActionReferences = new Map([
  ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", 4],
  ["actions/setup-node@820762786026740c76f36085b0efc47a31fe5020", 4],
  ["cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd", 1],
]);

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(`Workflow coverage guard self-test failed: ${message}`);
}

function indentation(line) {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}

function extractJobLines(source, jobName) {
  const lines = source.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*(?:#.*)?$/.test(line));
  if (jobsIndex < 0) throw new Error("search-performance-guard.yml is missing the jobs mapping");

  const escapedJobName = jobName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const jobPattern = new RegExp(`^  ${escapedJobName}:\\s*(?:#.*)?$`);
  const jobIndex = lines.findIndex((line, index) => index > jobsIndex && jobPattern.test(line));
  if (jobIndex < 0) throw new Error(`search-performance-guard.yml is missing the ${jobName} job`);

  let jobEnd = lines.length;
  for (let index = jobIndex + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*(?:#.*)?$/.test(lines[index])) {
      jobEnd = index;
      break;
    }
  }
  return lines.slice(jobIndex + 1, jobEnd);
}

function extractSteps(jobLines) {
  const stepsIndex = jobLines.findIndex((line) => /^    steps:\s*(?:#.*)?$/.test(line));
  if (stepsIndex < 0) throw new Error(`${targetJobName} is missing its steps sequence`);

  const steps = [];
  let currentStep = null;
  for (let index = stepsIndex + 1; index < jobLines.length; index += 1) {
    const line = jobLines[index];
    if (/^ {6}-\s+/.test(line)) {
      if (currentStep) steps.push(currentStep);
      currentStep = [line];
      continue;
    }
    if (!currentStep) continue;
    if (line.trim() && indentation(line) <= 4) break;
    currentStep.push(line);
  }
  if (currentStep) steps.push(currentStep);
  return steps;
}

function stepProperty(stepLines, propertyName) {
  const escapedPropertyName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const firstLinePattern = new RegExp(`^ {6}-\\s+${escapedPropertyName}\\s*:\\s*(.*?)\\s*$`);
  const propertyPattern = new RegExp(`^ {8}${escapedPropertyName}\\s*:\\s*(.*?)\\s*$`);
  for (let index = 0; index < stepLines.length; index += 1) {
    const match = stepLines[index].match(index === 0 ? firstLinePattern : propertyPattern);
    if (match) return { present: true, value: match[1] };
  }
  return { present: false, value: "" };
}

function extractRunCommands(stepLines) {
  let runIndex = -1;
  let runIndent = -1;
  let runValue = "";
  for (let index = 0; index < stepLines.length; index += 1) {
    const runMatch = stepLines[index].match(index === 0
      ? /^ {6}-\s+run\s*:\s*(.*?)\s*$/
      : /^ {8}run\s*:\s*(.*?)\s*$/);
    if (!runMatch) continue;
    runIndex = index;
    runIndent = index === 0 ? 6 : 8;
    runValue = runMatch[1];
    break;
  }
  if (runIndex < 0) return [];
  if (!/^\|[+-]?$/.test(runValue)) {
    return runValue && !/^[>|][+-]?$/.test(runValue) ? [runValue] : [];
  }

  const commands = [];
  for (let index = runIndex + 1; index < stepLines.length; index += 1) {
    const blockLine = stepLines[index];
    if (blockLine.trim() && indentation(blockLine) <= runIndent) break;
    if (blockLine.trim()) commands.push(blockLine.slice(runIndent + 2));
  }
  return commands;
}

function standaloneVerifierPath(command) {
  const match = command.trim().match(
    /^node\s+(["']?)(scripts\/verify-[A-Za-z0-9._-]+\.js)\1(?:\s+[^;&|`<>#]+)?$/,
  );
  return match ? match[2] : null;
}

function collectVerifierCoverage(workflowSources) {
  const targetSource = workflowSources.get(targetWorkflowName);
  if (!targetSource) throw new Error(`${targetWorkflowName} is missing`);
  const jobLines = extractJobLines(targetSource, targetJobName);
  const invokedVerifiers = new Set();
  const violations = [];

  if (jobLines.some((line) => /^    if\s*:/.test(line))) {
    violations.push(`${targetJobName} must not declare a job-level if condition`);
  }

  extractSteps(jobLines).forEach((stepLines, index) => {
    const verifierPaths = extractRunCommands(stepLines).map(standaloneVerifierPath).filter(Boolean);
    if (!verifierPaths.length) return;

    const ifProperty = stepProperty(stepLines, "if");
    const continueOnError = stepProperty(stepLines, "continue-on-error");
    if (ifProperty.present) {
      violations.push(`${targetJobName} verifier step ${index + 1} must not declare if: ${ifProperty.value}`);
    }
    if (continueOnError.present && continueOnError.value.toLowerCase() !== "false") {
      violations.push(
        `${targetJobName} verifier step ${index + 1} must fail hard, not continue-on-error: ${continueOnError.value}`,
      );
    }
    if (ifProperty.present || (continueOnError.present && continueOnError.value.toLowerCase() !== "false")) return;
    verifierPaths.forEach((verifierPath) => invokedVerifiers.add(verifierPath));
  });
  return { invokedVerifiers, violations };
}

function missingVerifierPaths(verifierPaths, invokedVerifiers) {
  return verifierPaths.filter((verifierPath) => !invokedVerifiers.has(verifierPath));
}

function extractPullRequestPaths(source) {
  const lines = source.split(/\r?\n/);
  const pullRequestIndex = lines.findIndex((line) => /^  pull_request:\s*(?:#.*)?$/.test(line));
  if (pullRequestIndex < 0) throw new Error(`${targetWorkflowName} is missing pull_request configuration`);
  const pathsIndex = lines.findIndex(
    (line, index) => index > pullRequestIndex && /^    paths:\s*(?:#.*)?$/.test(line),
  );
  if (pathsIndex < 0) throw new Error(`${targetWorkflowName} is missing pull_request.paths`);

  const paths = [];
  for (let index = pathsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && indentation(line) <= 4) break;
    const itemMatch = line.match(/^\s{6}-\s+(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*(?:#.*)?$/);
    if (itemMatch) paths.push(itemMatch[1] || itemMatch[2] || itemMatch[3]);
  }
  return new Set(paths);
}

function validateExternalActionReference(actionReference, location, violations) {
  if (actionReference.startsWith("./")) return null;

  const actionMatch = actionReference.match(/^([^@]+)@([0-9a-f]{40})$/);
  if (!actionMatch) {
    violations.push(`${location} must use an allowlisted action at its exact lowercase 40-character commit SHA: ${actionReference}`);
    return null;
  }

  const [, actionName, commitSha] = actionMatch;
  const normalizedActionName = actionName.normalize("NFKC").toLowerCase();
  if (actionName !== normalizedActionName) {
    violations.push(`${location} must use the canonical lowercase action name, not ${actionName}`);
    return null;
  }

  const normalizedReference = `${normalizedActionName}@${commitSha}`;
  if (!approvedActionReferences.has(normalizedReference)) {
    violations.push(`${location} is not an allowlisted action reference: ${normalizedReference}`);
    return null;
  }
  return normalizedReference;
}

function extractWorkflowActionReferences(source, workflowFile) {
  const lines = source.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => /^jobs\s*:\s*(?:#.*)?$/.test(line));
  if (jobsIndex < 0) throw new Error(`${workflowFile} is missing the jobs mapping`);

  const references = [];
  let insideJob = false;
  let insideSteps = false;
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const lineIndent = indentation(line);
    if (lineIndent === 0) break;

    if (/^ {2}[A-Za-z0-9_-]+\s*:\s*(?:#.*)?$/.test(line)) {
      insideJob = true;
      insideSteps = false;
      continue;
    }
    if (!insideJob) continue;

    const jobUsesMatch = line.match(
      /^ {4}uses\s*:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*(?:#.*)?$/,
    );
    if (jobUsesMatch) {
      references.push({
        actionReference: jobUsesMatch[1] || jobUsesMatch[2] || jobUsesMatch[3],
        location: `${workflowFile}:${index + 1}`,
      });
      insideSteps = false;
      continue;
    }

    if (lineIndent === 4) {
      insideSteps = /^ {4}steps\s*:\s*(?:#.*)?$/.test(line);
      continue;
    }
    if (!insideSteps) continue;

    const stepUsesMatch = line.match(
      /^(?: {6}-\s*| {8})uses\s*:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*(?:#.*)?$/,
    );
    if (stepUsesMatch) {
      references.push({
        actionReference: stepUsesMatch[1] || stepUsesMatch[2] || stepUsesMatch[3],
        location: `${workflowFile}:${index + 1}`,
      });
    }
  }
  return references;
}

function runSelfTests() {
  const fixtureSources = new Map([
    [targetWorkflowName, [
      "jobs:",
      `  ${targetJobName}:`,
      "    steps:",
      "      - name: node scripts/verify-name-decoy.js",
      "        run: |",
      "          echo node scripts/verify-echo-decoy.js",
      "          node scripts/verify-real.js",
      "      - run: node scripts/verify-inline.js --fixture",
      "      - name: conditional verifier decoy",
      "        if: ${{ false }}",
      "        run: node scripts/verify-if-decoy.js",
      "      - name: fail-soft verifier decoy",
      "        continue-on-error: true",
      "        run: node scripts/verify-continue-decoy.js",
      "  unrelated-job:",
      "    steps:",
      "      - run: node scripts/verify-other-job-decoy.js",
    ].join("\n")],
    ["unrelated-workflow.yml", [
      "jobs:",
      "  decoy:",
      "    steps:",
      "      - run: node scripts/verify-other-workflow-decoy.js",
    ].join("\n")],
  ]);
  const coverage = collectVerifierCoverage(fixtureSources);
  const invoked = coverage.invokedVerifiers;
  assertSelfTest(invoked.size === 2, "only two real target-job commands must be counted");
  assertSelfTest(coverage.violations.length === 2, "conditional and fail-soft verifier steps must fail");
  assertSelfTest(invoked.has("scripts/verify-real.js"), "literal-block node command was not counted");
  assertSelfTest(invoked.has("scripts/verify-inline.js"), "inline node command was not counted");
  [
    "scripts/verify-name-decoy.js",
    "scripts/verify-echo-decoy.js",
    "scripts/verify-if-decoy.js",
    "scripts/verify-continue-decoy.js",
    "scripts/verify-other-job-decoy.js",
    "scripts/verify-other-workflow-decoy.js",
  ].forEach((decoy) => assertSelfTest(!invoked.has(decoy), `${decoy} was incorrectly counted`));
  assertSelfTest(
    missingVerifierPaths(["scripts/verify-real.js", "scripts/verify-missing.js"], invoked)
      .includes("scripts/verify-missing.js"),
    "a missing verifier must fail coverage",
  );

  const validReference = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
  const actionProblems = [];
  assertSelfTest(
    validateExternalActionReference(validReference, "self-test", actionProblems) === validReference &&
      actionProblems.length === 0,
    "approved action reference was rejected",
  );
  [
    `unknown/action@${"a".repeat(40)}`,
    "Actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    `actions/checkout@${"a".repeat(40)}`,
  ].forEach((reference) => {
    const problems = [];
    assertSelfTest(
      validateExternalActionReference(reference, "self-test", problems) === null && problems.length > 0,
      `${reference} must be rejected`,
    );
  });

  const structuralActionFixture = [
    "jobs:",
    "  reusable:",
    `    uses : unknown/action@${"a".repeat(40)}`,
    "  steps-job:",
    "    steps:",
    "      - name: run-block action decoy",
    "        run: |",
    "          uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    "      - uses : actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  ].join("\n");
  const actionReferences = extractWorkflowActionReferences(structuralActionFixture, "self-test.yml");
  assertSelfTest(actionReferences.length === 2, "only structural job and step uses keys must be extracted");
  assertSelfTest(
    !actionReferences.some((record) => record.actionReference.startsWith("actions/setup-node@")),
    "a run-block uses decoy must not be extracted",
  );
  const unknownUses = actionReferences.find((record) => record.actionReference.startsWith("unknown/action@"));
  const unknownUsesProblems = [];
  assertSelfTest(
    unknownUses &&
      validateExternalActionReference(unknownUses.actionReference, unknownUses.location, unknownUsesProblems) === null &&
      unknownUsesProblems.length > 0,
    "an unknown action with whitespace before the colon must be rejected",
  );
}

runSelfTests();

const workflowFiles = fs.readdirSync(workflowsDirectory)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const verifierPaths = fs.readdirSync(scriptsDirectory)
  .filter((name) => /^verify-.*\.js$/i.test(name))
  .sort()
  .map((name) => `scripts/${name}`);
const workflowSources = new Map(
  workflowFiles.map((workflowFile) => [
    workflowFile,
    fs.readFileSync(path.join(workflowsDirectory, workflowFile), "utf8"),
  ]),
);

const violations = [];
const coverage = collectVerifierCoverage(workflowSources);
const invokedVerifiers = coverage.invokedVerifiers;
violations.push(...coverage.violations);
const missingVerifiers = missingVerifierPaths(verifierPaths, invokedVerifiers);
const unknownVerifiers = [...invokedVerifiers].filter((verifierPath) => !verifierPaths.includes(verifierPath));
if (missingVerifiers.length) {
  violations.push(`target-job execution coverage is missing: ${missingVerifiers.join(", ")}`);
}
if (unknownVerifiers.length) {
  violations.push(`target job invokes unknown verifiers: ${unknownVerifiers.join(", ")}`);
}

const targetWorkflow = workflowSources.get(targetWorkflowName) || "";
const pullRequestPaths = extractPullRequestPaths(targetWorkflow);
[
  "scripts/verify-*.js",
  "desktop/concierge-companion/**",
  "box-label-print.css",
  "label-print-window.js",
  "print.css",
  ".github/workflows/**",
].forEach((requiredFilter) => {
  if (!pullRequestPaths.has(requiredFilter)) {
    violations.push(`${targetWorkflowName} pull_request.paths must include ${requiredFilter}`);
  }
});

const actionUseCounts = new Map([...approvedActionReferences.keys()].map((reference) => [reference, 0]));
let externalActionUses = 0;
for (const [workflowFile, source] of workflowSources) {
  extractWorkflowActionReferences(source, workflowFile).forEach(({ actionReference, location }) => {
    const normalizedReference = validateExternalActionReference(
      actionReference,
      location,
      violations,
    );
    if (!normalizedReference) return;
    externalActionUses += 1;
    actionUseCounts.set(normalizedReference, actionUseCounts.get(normalizedReference) + 1);
  });
}

for (const [reference, expectedUses] of approvedActionReferences) {
  const actualUses = actionUseCounts.get(reference);
  if (actualUses !== expectedUses) {
    violations.push(`${reference} must be used exactly ${expectedUses} time(s), found ${actualUses}`);
  }
}

if (violations.length) {
  throw new Error(`Workflow supply-chain contract failed:\n- ${violations.join("\n- ")}`);
}

const expectedActionUses = [...approvedActionReferences.values()].reduce((total, count) => total + count, 0);
console.log(
  `workflow supply-chain guard passed (${invokedVerifiers.size}/${verifierPaths.length} target-job verifiers, ` +
  `${externalActionUses}/${expectedActionUses} allowlisted external actions; adversarial self-tests passed)`,
);
