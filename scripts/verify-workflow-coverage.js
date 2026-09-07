"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const workflowsDirectory = path.join(root, ".github", "workflows");
const scriptsDirectory = path.join(root, "scripts");
const targetWorkflowName = "search-performance-guard.yml";
const targetJobName = "verify-search-workload";
const maximumAliasCount = 20;

const yamlParseOptions = Object.freeze({
  maxAliasCount: maximumAliasCount,
  merge: true,
  prettyErrors: true,
  strict: true,
  uniqueKeys: true,
  version: "1.2",
});

const approvedActionReferences = new Map([
  ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", 4],
  ["actions/setup-node@820762786026740c76f36085b0efc47a31fe5020", 4],
  ["cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd", 1],
]);

const requiredPullRequestPaths = [
  "scripts/verify-*.js",
  "desktop/concierge-companion/**",
  "box-label-print.css",
  "label-print-window.js",
  "print.css",
  "package*.json",
  ".github/workflows/**",
];

const forbiddenPullRequestKeys = [
  "types",
  "branches",
  "branches-ignore",
  "paths-ignore",
];

const exactVerifierCommand = /^node (scripts\/verify-[A-Za-z0-9][A-Za-z0-9._-]*\.js)$/;
const verifierMention = /scripts\/verify-[A-Za-z0-9][A-Za-z0-9._-]*\.js/i;

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(`Workflow coverage guard self-test failed: ${message}`);
}

function parseWorkflowSource(source, workflowFile) {
  try {
    const workflow = YAML.parse(source, yamlParseOptions);
    if (!isMapping(workflow)) {
      throw new Error("the document root must be a mapping");
    }
    return workflow;
  } catch (error) {
    throw new Error(`${workflowFile}: YAML parsing failed: ${error.message}`);
  }
}

function validateRunDefaults(container, scope, violations) {
  if (!hasOwn(container, "defaults")) return;
  const defaults = container.defaults;
  if (!isMapping(defaults)) {
    violations.push(`${scope}.defaults must be a mapping`);
    return;
  }
  if (!hasOwn(defaults, "run")) return;
  if (!isMapping(defaults.run)) {
    violations.push(`${scope}.defaults.run must be a mapping`);
    return;
  }
  if (hasOwn(defaults.run, "shell")) {
    violations.push(`${scope}.defaults.run.shell must be absent`);
  }
  if (hasOwn(defaults.run, "working-directory")) {
    violations.push(`${scope}.defaults.run.working-directory must be absent`);
  }
}

function isExecutionEnvironmentOverride(name) {
  const normalizedName = String(name).normalize("NFKC").toUpperCase();
  return normalizedName === "PATH" ||
    normalizedName === "ENV" ||
    normalizedName === "BASH_ENV" ||
    normalizedName === "SHELLOPTS" ||
    normalizedName === "NODE" ||
    normalizedName.startsWith("NODE_") ||
    normalizedName.startsWith("LD_") ||
    normalizedName.startsWith("DYLD_") ||
    normalizedName === "NPM_CONFIG_NODE_OPTIONS" ||
    normalizedName === "NPM_CONFIG_SCRIPT_SHELL";
}

function validateEnvironment(container, scope, violations) {
  if (!hasOwn(container, "env")) return;
  const environment = container.env;
  if (!isMapping(environment)) {
    violations.push(`${scope}.env must be a mapping`);
    return;
  }
  Object.keys(environment)
    .filter(isExecutionEnvironmentOverride)
    .forEach((name) => {
      violations.push(`${scope}.env must not override execution environment variable ${name}`);
    });
}

function validatePullRequestTrigger(workflow, workflowFile, violations) {
  if (!isMapping(workflow.on)) {
    violations.push(`${workflowFile}.on must be a mapping with pull_request configuration`);
    return;
  }
  if (!hasOwn(workflow.on, "pull_request")) {
    violations.push(`${workflowFile}.on must include pull_request`);
    return;
  }
  const pullRequest = workflow.on.pull_request;
  if (!isMapping(pullRequest)) {
    violations.push(`${workflowFile}.on.pull_request must be a mapping with required paths`);
    return;
  }

  forbiddenPullRequestKeys.forEach((key) => {
    if (hasOwn(pullRequest, key)) {
      violations.push(`${workflowFile}.on.pull_request.${key} must be absent`);
    }
  });

  if (!Array.isArray(pullRequest.paths)) {
    violations.push(`${workflowFile}.on.pull_request.paths must be a sequence`);
    return;
  }
  const pathFilters = [];
  pullRequest.paths.forEach((pathFilter, index) => {
    if (typeof pathFilter !== "string") {
      violations.push(`${workflowFile}.on.pull_request.paths[${index}] must be a string`);
      return;
    }
    pathFilters.push(pathFilter);
    if (pathFilter.trimStart().startsWith("!")) {
      violations.push(`${workflowFile}.on.pull_request.paths must not contain negative filter ${pathFilter}`);
    }
  });
  requiredPullRequestPaths.forEach((requiredPath) => {
    if (!pathFilters.includes(requiredPath)) {
      violations.push(`${workflowFile}.on.pull_request.paths must include ${requiredPath}`);
    }
  });
}

function validateFailHard(container, scope, violations) {
  if (hasOwn(container, "if")) {
    violations.push(`${scope}.if must be absent`);
  }
  if (hasOwn(container, "continue-on-error") && container["continue-on-error"] !== false) {
    violations.push(`${scope}.continue-on-error must be absent or boolean false`);
  }
}

function validateTargetRuntime(job, scope, violations) {
  if (job["runs-on"] !== "ubuntu-latest") {
    violations.push(`${scope}.runs-on must be exactly ubuntu-latest`);
  }
  if (hasOwn(job, "container")) {
    violations.push(`${scope}.container must be absent`);
  }
}

function collectTargetVerifierCoverage(workflow, workflowFile, violations) {
  validatePullRequestTrigger(workflow, workflowFile, violations);
  validateRunDefaults(workflow, workflowFile, violations);
  validateEnvironment(workflow, workflowFile, violations);

  if (!isMapping(workflow.jobs)) {
    violations.push(`${workflowFile}.jobs must be a mapping`);
    return new Set();
  }
  const targetJob = workflow.jobs[targetJobName];
  if (!isMapping(targetJob)) {
    violations.push(`${workflowFile}.jobs.${targetJobName} must be a mapping`);
    return new Set();
  }

  const jobScope = `${workflowFile}.jobs.${targetJobName}`;
  validateFailHard(targetJob, jobScope, violations);
  validateTargetRuntime(targetJob, jobScope, violations);
  validateRunDefaults(targetJob, jobScope, violations);
  validateEnvironment(targetJob, jobScope, violations);

  if (!Array.isArray(targetJob.steps)) {
    violations.push(`${jobScope}.steps must be a sequence`);
    return new Set();
  }

  const invokedVerifiers = new Set();
  targetJob.steps.forEach((step, index) => {
    const stepScope = `${jobScope}.steps[${index}]`;
    if (!isMapping(step)) {
      violations.push(`${stepScope} must be a mapping`);
      return;
    }
    if (typeof step.run !== "string" || !verifierMention.test(step.run)) return;

    const stepViolations = [];
    validateFailHard(step, stepScope, stepViolations);
    validateEnvironment(step, stepScope, stepViolations);
    if (hasOwn(step, "shell")) {
      stepViolations.push(`${stepScope}.shell must be absent`);
    }
    if (hasOwn(step, "working-directory")) {
      stepViolations.push(`${stepScope}.working-directory must be absent`);
    }
    if (hasOwn(step, "uses")) {
      stepViolations.push(`${stepScope} must not combine run and uses`);
    }

    const commands = [];
    const nonEmptyLines = step.run.split(/\r?\n/).filter((line) => line.trim().length > 0);
    nonEmptyLines.forEach((line) => {
      const match = line.match(exactVerifierCommand);
      if (!match) {
        stepViolations.push(
          `${stepScope}.run contains a non-exact verifier command: ${JSON.stringify(line)}`,
        );
        return;
      }
      commands.push(match[1]);
    });
    if (!nonEmptyLines.length) {
      stepViolations.push(`${stepScope}.run must contain an exact verifier command`);
    }

    if (stepViolations.length) {
      violations.push(...stepViolations);
      return;
    }
    commands.forEach((command) => invokedVerifiers.add(command));
  });
  return invokedVerifiers;
}

function collectWorkflowActionReferences(workflows, violations) {
  const references = [];
  for (const [workflowFile, workflow] of workflows) {
    if (!isMapping(workflow.jobs)) {
      violations.push(`${workflowFile}.jobs must be a mapping`);
      continue;
    }
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const jobScope = `${workflowFile}.jobs.${jobName}`;
      if (!isMapping(job)) {
        violations.push(`${jobScope} must be a mapping`);
        continue;
      }
      if (hasOwn(job, "uses")) {
        references.push({ actionReference: job.uses, location: `${jobScope}.uses` });
      }
      if (!hasOwn(job, "steps")) continue;
      if (!Array.isArray(job.steps)) {
        violations.push(`${jobScope}.steps must be a sequence`);
        continue;
      }
      job.steps.forEach((step, index) => {
        if (!isMapping(step)) {
          violations.push(`${jobScope}.steps[${index}] must be a mapping`);
          return;
        }
        if (hasOwn(step, "uses")) {
          references.push({
            actionReference: step.uses,
            location: `${jobScope}.steps[${index}].uses`,
          });
        }
      });
    }
  }
  return references;
}

function validateExternalActionReference(actionReference, location, violations) {
  if (typeof actionReference !== "string") {
    violations.push(`${location} must be a string`);
    return null;
  }
  if (actionReference !== actionReference.trim()) {
    violations.push(`${location} must not contain surrounding whitespace`);
    return null;
  }
  if (actionReference.startsWith("./")) {
    violations.push(`${location} must not use a repository-local action or reusable workflow: ${actionReference}`);
    return null;
  }
  const match = actionReference.match(/^([^@\s]+)@([0-9a-f]{40})$/);
  if (!match) {
    violations.push(`${location} must use an external action pinned to a lowercase 40-character SHA`);
    return null;
  }
  const actionName = match[1];
  const normalizedActionName = actionName.normalize("NFKC").toLowerCase();
  if (actionName !== normalizedActionName) {
    violations.push(`${location} action name must already be lowercase NFKC-normalized text`);
    return null;
  }
  const normalizedReference = `${normalizedActionName}@${match[2]}`;
  if (!approvedActionReferences.has(normalizedReference)) {
    violations.push(`${location} uses an action or SHA outside the allowlist: ${actionReference}`);
    return null;
  }
  return normalizedReference;
}

function validateActionInventory(workflows, violations) {
  const counts = new Map([...approvedActionReferences.keys()].map((reference) => [reference, 0]));
  let externalActionUses = 0;
  collectWorkflowActionReferences(workflows, violations).forEach(({ actionReference, location }) => {
    externalActionUses += 1;
    const normalizedReference = validateExternalActionReference(actionReference, location, violations);
    if (!normalizedReference) return;
    counts.set(normalizedReference, counts.get(normalizedReference) + 1);
  });
  for (const [reference, expectedUses] of approvedActionReferences) {
    const actualUses = counts.get(reference);
    if (actualUses !== expectedUses) {
      violations.push(`${reference} must be used exactly ${expectedUses} time(s), found ${actualUses}`);
    }
  }
  return externalActionUses;
}

function addCoverageProblems(verifierPaths, invokedVerifiers, violations) {
  const knownVerifiers = new Set(verifierPaths);
  const missingVerifiers = verifierPaths.filter((verifierPath) => !invokedVerifiers.has(verifierPath));
  const unknownVerifiers = [...invokedVerifiers].filter((verifierPath) => !knownVerifiers.has(verifierPath));
  if (missingVerifiers.length) {
    violations.push(`target-job execution coverage is missing: ${missingVerifiers.join(", ")}`);
  }
  if (unknownVerifiers.length) {
    violations.push(`target job invokes unknown verifiers: ${unknownVerifiers.join(", ")}`);
  }
}

function makeTargetFixture(options = {}) {
  const pathEntries = options.pathEntries || requiredPullRequestPaths;
  const pullRequestProperties = options.pullRequestProperties || [];
  const workflowProperties = options.workflowProperties || [];
  const jobProperties = options.jobProperties || [];
  const runsOn = options.runsOn || "ubuntu-latest";
  const steps = options.steps || ["      - run: node scripts/verify-real.js"];
  const otherJobs = options.otherJobs || [];
  return [
    "name: fixture",
    "on:",
    "  pull_request:",
    "    paths:",
    ...pathEntries.map((entry) => `      - ${JSON.stringify(entry)}`),
    ...pullRequestProperties,
    ...workflowProperties,
    "jobs:",
    `  "${targetJobName}":`,
    `    runs-on: ${runsOn}`,
    ...jobProperties,
    "    steps:",
    ...steps,
    ...otherJobs,
  ].join("\n");
}

function evaluateTargetFixture(source, verifierPaths = ["scripts/verify-real.js"]) {
  const workflow = parseWorkflowSource(source, "fixture.yml");
  const violations = [];
  const invokedVerifiers = collectTargetVerifierCoverage(workflow, "fixture.yml", violations);
  addCoverageProblems(verifierPaths, invokedVerifiers, violations);
  return { invokedVerifiers, violations };
}

function assertTargetRejected(name, source, expectedMessage) {
  const result = evaluateTargetFixture(source);
  assertSelfTest(
    result.violations.some((violation) => violation.includes(expectedMessage)),
    `${name} was not rejected (${result.violations.join("; ")})`,
  );
}

function runSelfTests() {
  const valid = evaluateTargetFixture(makeTargetFixture());
  assertSelfTest(valid.violations.length === 0, `valid fixture was rejected: ${valid.violations.join("; ")}`);
  assertSelfTest(valid.invokedVerifiers.has("scripts/verify-real.js"), "valid verifier was not counted");

  const decoys = evaluateTargetFixture(makeTargetFixture({
    steps: [
      "      - name: node scripts/verify-name-decoy.js",
      "        run: echo harmless",
      "      - run: node scripts/verify-real.js",
    ],
    otherJobs: [
      "  other-job:",
      "    steps:",
      "      - run: node scripts/verify-other-job-decoy.js",
    ],
  }));
  assertSelfTest(decoys.violations.length === 0, "name or other-job decoy changed target coverage");
  assertSelfTest(!decoys.invokedVerifiers.has("scripts/verify-name-decoy.js"), "name decoy was counted");
  assertSelfTest(!decoys.invokedVerifiers.has("scripts/verify-other-job-decoy.js"), "other-job decoy was counted");

  const otherWorkflow = parseWorkflowSource([
    "jobs:",
    "  decoy:",
    "    steps:",
    "      - run: node scripts/verify-other-workflow-decoy.js",
  ].join("\n"), "other.yml");
  const actionStructureProblems = [];
  const referencesFromOtherWorkflow = collectWorkflowActionReferences(
    new Map([["other.yml", otherWorkflow]]),
    actionStructureProblems,
  );
  assertSelfTest(actionStructureProblems.length === 0, "other-workflow structural fixture was invalid");
  assertSelfTest(referencesFromOtherWorkflow.length === 0, "run content was treated as an action use");

  assertTargetRejected("echo decoy", makeTargetFixture({
    steps: [
      "      - run: echo node scripts/verify-echo-decoy.js",
      "      - run: node scripts/verify-real.js",
    ],
  }), "non-exact verifier command");
  assertTargetRejected("quoted if", makeTargetFixture({
    steps: [
      "      - \"if\": \"${{ false }}\"",
      "        run: node scripts/verify-real.js",
    ],
  }), ".if must be absent");
  assertTargetRejected("quoted continue-on-error", makeTargetFixture({
    steps: [
      "      - \"continue-on-error\": true",
      "        run: node scripts/verify-real.js",
    ],
  }), ".continue-on-error must be absent or boolean false");
  assertTargetRejected("custom shell", makeTargetFixture({
    steps: [
      "      - shell: bash",
      "        run: node scripts/verify-real.js",
    ],
  }), ".shell must be absent");
  assertTargetRejected("custom working directory", makeTargetFixture({
    steps: [
      "      - working-directory: fixture",
      "        run: node scripts/verify-real.js",
    ],
  }), ".working-directory must be absent");
  assertTargetRejected("continuation and fail-soft suffix", makeTargetFixture({
    steps: [
      "      - run: |",
      "          node scripts/verify-real.js \\",
      "            || true",
    ],
  }), "non-exact verifier command");

  assertTargetRejected("job if", makeTargetFixture({
    jobProperties: ["    \"if\": \"${{ true }}\""],
  }), ".if must be absent");
  assertTargetRejected("job continue-on-error expression", makeTargetFixture({
    jobProperties: ["    continue-on-error: \"${{ true }}\""],
  }), ".continue-on-error must be absent or boolean false");
  assertTargetRejected("self-hosted target runner", makeTargetFixture({
    runsOn: "self-hosted",
  }), ".runs-on must be exactly ubuntu-latest");
  assertTargetRejected("target job container", makeTargetFixture({
    jobProperties: ["    container: { image: node:22, env: { PATH: /tmp/bin } }"],
  }), ".container must be absent");
  assertTargetRejected("workflow default shell", makeTargetFixture({
    workflowProperties: ["defaults:", "  run: { shell: bash }"],
  }), ".defaults.run.shell must be absent");
  assertTargetRejected("job default shell", makeTargetFixture({
    jobProperties: ["    defaults:", "      run:", "        shell: bash"],
  }), ".defaults.run.shell must be absent");
  assertTargetRejected("workflow PATH override", makeTargetFixture({
    workflowProperties: ["env: { PATH: /tmp/bin }"],
  }), ".env must not override execution environment variable PATH");
  assertTargetRejected("job NODE_OPTIONS override", makeTargetFixture({
    jobProperties: ["    env:", "      NODE_OPTIONS: --require ./skip.js"],
  }), ".env must not override execution environment variable NODE_OPTIONS");
  assertTargetRejected("step PATH override", makeTargetFixture({
    steps: [
      "      - env: { Path: /tmp/bin }",
      "        run: node scripts/verify-real.js",
    ],
  }), ".env must not override execution environment variable Path");

  assertTargetRejected("merged fail-soft step", makeTargetFixture({
    workflowProperties: [
      "x-step-policy: &step-policy",
      "  continue-on-error: true",
    ],
    steps: [
      "      - <<: *step-policy",
      "        run: node scripts/verify-real.js",
    ],
  }), ".continue-on-error must be absent or boolean false");

  assertTargetRejected("negative path filter", makeTargetFixture({
    pathEntries: [...requiredPullRequestPaths, "!scripts/verify-*.js"],
  }), "must not contain negative filter");
  ["types", "branches", "branches-ignore", "paths-ignore"].forEach((key) => {
    assertTargetRejected(`pull_request ${key}`, makeTargetFixture({
      pullRequestProperties: [`    \"${key}\": [main]`],
    }), `.on.pull_request.${key} must be absent`);
  });
  assertTargetRejected("missing package path", makeTargetFixture({
    pathEntries: requiredPullRequestPaths.filter((entry) => entry !== "package*.json"),
  }), ".on.pull_request.paths must include package*.json");

  const additionallyIndentedSource = [
    "name: fixture",
    "on:",
    "    pull_request:",
    "        paths:",
    ...requiredPullRequestPaths.map((entry) => `          - ${JSON.stringify(entry)}`),
    "jobs:",
    `    "${targetJobName}":`,
    "        runs-on: ubuntu-latest",
    "        steps:",
    "          - run: node scripts/verify-real.js",
  ].join("\n");
  const additionallyIndented = evaluateTargetFixture(additionallyIndentedSource);
  assertSelfTest(
    additionallyIndented.violations.length === 0,
    `additional indentation was not structurally parsed: ${additionallyIndented.violations.join("; ")}`,
  );

  const knownReference = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
  const knownProblems = [];
  assertSelfTest(
    validateExternalActionReference(knownReference, "self-test", knownProblems) === knownReference &&
      knownProblems.length === 0,
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

  [
    "./.github/actions/proxy",
    ".//.github/actions/proxy",
    "./.github/actions/../actions/proxy",
    " ./.github/actions/proxy",
    ".\\.github\\actions\\proxy",
    "../.github/actions/proxy",
    "\uff0e\uff0f.github/actions/proxy",
  ].forEach((reference) => {
    const problems = [];
    assertSelfTest(
      validateExternalActionReference(reference, "self-test", problems) === null && problems.length > 0,
      `repository-local path variant ${reference} must be rejected`,
    );
  });

  const unknownReference = `unknown/action@${"a".repeat(40)}`;
  const structuralSource = [
    `x-action: &unknown-action ${unknownReference}`,
    "jobs:",
    "  reusable:",
    "    \"uses\" : *unknown-action",
    "  steps-job: { steps: [ { run: \"echo uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020\" },",
    `                         { \"uses\" : \"${knownReference}\" } ] }`,
  ].join("\n");
  const structuralWorkflow = parseWorkflowSource(structuralSource, "structural.yml");
  const structuralProblems = [];
  const structuralReferences = collectWorkflowActionReferences(
    new Map([["structural.yml", structuralWorkflow]]),
    structuralProblems,
  );
  assertSelfTest(structuralProblems.length === 0, "flow-map action fixture was structurally invalid");
  assertSelfTest(structuralReferences.length === 2, "only structural job and step uses were extracted");
  assertSelfTest(
    !structuralReferences.some(({ actionReference }) =>
      typeof actionReference === "string" && actionReference.startsWith("actions/setup-node@")),
    "run-block approved-action decoy was extracted",
  );
  const unknownAction = structuralReferences.find(({ actionReference }) => actionReference === unknownReference);
  const unknownProblems = [];
  assertSelfTest(
    unknownAction &&
      validateExternalActionReference(unknownAction.actionReference, unknownAction.location, unknownProblems) === null &&
      unknownProblems.length > 0,
    "anchored unknown job-level action was not rejected",
  );

  const localStructuralSource = [
    "x-local-action: &local-action ./.github/actions/proxy",
    "jobs:",
    "  reusable:",
    "    uses: *local-action",
    "  flow-step: { steps: [ { \"uses\" : *local-action } ] }",
  ].join("\n");
  const localStructuralWorkflow = parseWorkflowSource(localStructuralSource, "local-structural.yml");
  const localStructureProblems = [];
  const localReferences = collectWorkflowActionReferences(
    new Map([["local-structural.yml", localStructuralWorkflow]]),
    localStructureProblems,
  );
  assertSelfTest(localStructureProblems.length === 0, "local-action structural fixture was invalid");
  assertSelfTest(localReferences.length === 2, "aliased local uses were not structurally extracted");
  localReferences.forEach(({ actionReference, location }) => {
    const problems = [];
    assertSelfTest(
      validateExternalActionReference(actionReference, location, problems) === null &&
        problems.some((problem) => problem.includes("must not use a repository-local action")),
      `structural local uses escaped rejection at ${location}`,
    );
  });

  const aliasBomb = `value: &value [scalar]\nexpanded: [${Array(25).fill("*value").join(", ")}]`;
  let aliasLimitApplied = false;
  try {
    parseWorkflowSource(aliasBomb, "alias-limit.yml");
  } catch (error) {
    aliasLimitApplied = /Excessive alias count/.test(error.message);
  }
  assertSelfTest(aliasLimitApplied, `maxAliasCount=${maximumAliasCount} was not enforced`);
}

runSelfTests();

const workflowFiles = fs.readdirSync(workflowsDirectory)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const verifierPaths = fs.readdirSync(scriptsDirectory)
  .filter((name) => /^verify-.*\.js$/i.test(name))
  .sort()
  .map((name) => `scripts/${name}`);
const workflows = new Map(workflowFiles.map((workflowFile) => {
  const source = fs.readFileSync(path.join(workflowsDirectory, workflowFile), "utf8");
  return [workflowFile, parseWorkflowSource(source, workflowFile)];
}));

const violations = [];
const targetWorkflow = workflows.get(targetWorkflowName);
let invokedVerifiers = new Set();
if (!targetWorkflow) {
  violations.push(`${targetWorkflowName} is missing`);
} else {
  invokedVerifiers = collectTargetVerifierCoverage(targetWorkflow, targetWorkflowName, violations);
  addCoverageProblems(verifierPaths, invokedVerifiers, violations);
}
const externalActionUses = validateActionInventory(workflows, violations);

if (violations.length) {
  throw new Error(`Workflow supply-chain contract failed:\n- ${violations.join("\n- ")}`);
}

const expectedActionUses = [...approvedActionReferences.values()].reduce((total, count) => total + count, 0);
console.log(
  `workflow supply-chain guard passed (${invokedVerifiers.size}/${verifierPaths.length} target-job verifiers, ` +
  `${externalActionUses}/${expectedActionUses} allowlisted external actions; YAML adversarial self-tests passed)`,
);
