"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const workflowsDirectory = path.join(root, ".github", "workflows");
const scriptsDirectory = path.join(root, "scripts");
const targetWorkflowName = "search-performance-guard.yml";
const targetJobName = "verify-search-workload";
const deploymentJobName = "deploy-cloudflare-pages";
const deploymentCondition = "github.event_name != 'pull_request' && github.ref == 'refs/heads/main'";
const checkoutActionReference = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
const setupNodeActionReference = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const deploymentActionReference = "cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd";
const targetInstallCommand = "npm ci --ignore-scripts";
const targetGuardCommand = "node scripts/verify-workflow-coverage.js";
const targetSyntaxCommand = [
  "node --check app.js",
  "node --check sales-order-revision.js",
  "node --check install-app.js",
  "node --check assets/concierge-pet/concierge-pet.js",
  "",
].join("\n");
const deploymentBuildCommand = "node scripts/build-static-site.js";
const deploymentHeaderCommand = "node scripts/verify-security-response-headers.js dist";
const deploymentActionInputs = Object.freeze({
  apiToken: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
  accountId: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
  wranglerVersion: "4.124.0",
  command: "pages deploy dist --project-name=dcats --branch=main --commit-hash=${{ github.sha }} --commit-dirty=false",
  gitHubToken: "${{ secrets.GITHUB_TOKEN }}",
});
const credentialEnvironment = Object.freeze({
  CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
  CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
});
const credentialCommand = [
  "set -euo pipefail",
  "test -n \"$CLOUDFLARE_API_TOKEN\" || { echo \"CLOUDFLARE_API_TOKEN is not configured.\" >&2; exit 1; }",
  "test -n \"$CLOUDFLARE_ACCOUNT_ID\" || { echo \"CLOUDFLARE_ACCOUNT_ID is not configured.\" >&2; exit 1; }",
  "",
].join("\n");
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
  [checkoutActionReference, 4],
  [setupNodeActionReference, 4],
  [deploymentActionReference, 1],
]);

const requiredPullRequestPaths = [
  ".gitattributes",
  "scripts/verify-*.js",
  "desktop/concierge-companion/**",
  "box-label-print.css",
  "label-print-window.js",
  "print.css",
  "package*.json",
  "vendor/**",
  ".github/workflows/**",
];
const reviewedWorkflowFiles = [
  "postal-data-update.yml",
  "search-performance-guard.yml",
  "security-headers-guard.yml",
];

const forbiddenPullRequestKeys = [
  "types",
  "branches",
  "branches-ignore",
  "paths-ignore",
];

const securityHeaderPaths = [
  "_headers",
  ".gitattributes",
  ".gitignore",
  "assets/icons/**",
  "assets/concierge-pet/**",
  "apple-touch-icon.png",
  "assets/postal/**",
  "favicon.ico",
  "index.html",
  "install-app.js",
  "site.webmanifest",
  "vendor/**",
  "scripts/build-static-site.js",
  "scripts/verify-install-app.js",
  "scripts/verify-concierge-pet.js",
  "scripts/verify-concierge-pet-runtime.js",
  "scripts/verify-security-response-headers.js",
  ".github/workflows/security-headers-guard.yml",
];

const postalDownloadCommand = [
  "set -euo pipefail",
  "mkdir -p \"$RUNNER_TEMP/dcats-postal\"",
  "curl --fail --location --retry 3 \\",
  "  --user-agent \"D-CATS postal data updater\" \\",
  "  \"https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip\" \\",
  "  --output \"$RUNNER_TEMP/dcats-postal/utf_ken_all.zip\"",
  "unzip -q \"$RUNNER_TEMP/dcats-postal/utf_ken_all.zip\" -d \"$RUNNER_TEMP/dcats-postal\"",
  "",
].join("\n");
const postalDetectCommand = [
  "if git diff --quiet -- assets/postal; then",
  "  echo \"changed=false\" >> \"$GITHUB_OUTPUT\"",
  "else",
  "  echo \"changed=true\" >> \"$GITHUB_OUTPUT\"",
  "fi",
  "",
].join("\n");
const postalCommitCommand = [
  "git config user.name \"github-actions[bot]\"",
  "git config user.email \"41898282+github-actions[bot]@users.noreply.github.com\"",
  "git add assets/postal",
  "git commit -m \"Update Japan Post postal data\"",
  "git push origin \"HEAD:${GITHUB_REF_NAME}\"",
  "",
].join("\n");

const expectedAuxiliaryWorkflows = new Map([
  ["security-headers-guard.yml", {
    name: "Security response headers guard",
    on: {
      push: { paths: securityHeaderPaths },
      pull_request: { paths: securityHeaderPaths },
      workflow_dispatch: null,
    },
    permissions: { contents: "read" },
    jobs: {
      verify: {
        "runs-on": "ubuntu-latest",
        steps: [
          { uses: checkoutActionReference },
          { uses: setupNodeActionReference, with: { "node-version": 22 } },
          { name: "Verify install experience", run: "node scripts/verify-install-app.js" },
          {
            name: "Verify animated concierge pets",
            run: "node scripts/verify-concierge-pet.js\nnode scripts/verify-concierge-pet-runtime.js\n",
          },
          { name: "Build static deployment", run: deploymentBuildCommand },
          { name: "Verify security response headers", run: deploymentHeaderCommand },
        ],
      },
    },
  }],
  ["postal-data-update.yml", {
    name: "Postal data update",
    on: {
      schedule: [{ cron: "17 3 3 * *" }],
      workflow_dispatch: null,
    },
    permissions: { contents: "write" },
    concurrency: { group: "postal-data-update", "cancel-in-progress": false },
    jobs: {
      update: {
        "runs-on": "ubuntu-latest",
        "timeout-minutes": 15,
        steps: [
          {
            name: "Check out repository",
            uses: checkoutActionReference,
            with: { ref: "${{ github.ref_name }}" },
          },
          {
            name: "Set up Node.js",
            uses: setupNodeActionReference,
            with: { "node-version": 22 },
          },
          { name: "Download current Japan Post data", shell: "bash", run: postalDownloadCommand },
          {
            name: "Generate compact browser data",
            run: "node scripts/update-postal-data.js --input \"$RUNNER_TEMP/dcats-postal/utf_ken_all.csv\"",
          },
          { name: "Verify generated postal data", run: "node scripts/verify-postal-data.js" },
          { name: "Verify postal lookup fallback", run: "node scripts/verify-postal-lookup-fallback.js" },
          { name: "Check application syntax", run: "node --check app.js" },
          { name: "Verify customer order workflow", run: "node scripts/verify-customer-order-workflow.js" },
          { name: "Verify release asset versions", run: "node scripts/verify-app-version-assets.js" },
          { name: "Build static deployment", run: deploymentBuildCommand },
          { name: "Verify response headers", run: deploymentHeaderCommand },
          {
            name: "Detect postal data changes",
            id: "changes",
            shell: "bash",
            run: postalDetectCommand,
          },
          {
            name: "Commit updated postal data",
            if: "steps.changes.outputs.changed == 'true'",
            shell: "bash",
            run: postalCommitCommand,
          },
        ],
      },
    },
  }],
]);

const exactVerifierCommand = /^node (scripts\/verify-[A-Za-z0-9][A-Za-z0-9._-]*\.js)$/;
const verifierMention = /scripts\/verify-[A-Za-z0-9][A-Za-z0-9._-]*\.js/i;

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactEntries(actual, expected) {
  if (!isMapping(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index] && actual[key] === expected[key]);
}

function hasExactKeys(actual, expectedKeys) {
  if (!isMapping(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function deeplyEqual(actual, expected) {
  if (Object.is(actual, expected)) return true;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) => deeplyEqual(value, expected[index]));
  }
  if (!isMapping(actual) || !isMapping(expected)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) =>
      key === expectedKeys[index] && deeplyEqual(actual[key], expected[key]));
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(`Workflow coverage guard self-test failed: ${message}`);
}

function parseWorkflowSource(source, workflowFile) {
  try {
    const document = YAML.parseDocument(source, yamlParseOptions);
    if (document.errors.length) {
      throw new Error(document.errors.map((error) => error.message).join("; "));
    }
    if (document.warnings.length) {
      throw new Error(document.warnings.map((warning) => warning.message).join("; "));
    }
    const workflow = document.toJS({ maxAliasCount: maximumAliasCount });
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

function validateNoEnvironment(container, scope, violations) {
  if (hasOwn(container, "env")) {
    violations.push(`${scope}.env must be absent`);
  }
}

function validateWorkflowEnvelope(workflow, workflowFile, violations, enforceJobSet = true) {
  if (!hasExactKeys(workflow, ["name", "on", "permissions", "concurrency", "jobs"])) {
    violations.push(`${workflowFile} must contain only the reviewed top-level workflow keys`);
  }
  if (workflow.name !== "Search performance guard") {
    violations.push(`${workflowFile}.name must remain Search performance guard`);
  }
  if (!hasExactEntries(workflow.permissions, { contents: "read" })) {
    violations.push(`${workflowFile}.permissions must be exactly contents:read`);
  }
  if (!hasExactEntries(workflow.concurrency, {
    group: "frontend-release-${{ github.ref }}",
    "cancel-in-progress": true,
  })) {
    violations.push(`${workflowFile}.concurrency must match the reviewed frontend release policy`);
  }
  validateNoEnvironment(workflow, workflowFile, violations);
  if (enforceJobSet && !hasExactKeys(workflow.jobs, [targetJobName, deploymentJobName])) {
    violations.push(`${workflowFile}.jobs must contain exactly ${targetJobName} and ${deploymentJobName}`);
  }
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
  if (hasOwn(job, "needs")) {
    violations.push(`${scope}.needs must be absent`);
  }
  if (hasOwn(job, "strategy")) {
    violations.push(`${scope}.strategy must be absent`);
  }
  if (hasOwn(job, "services")) {
    violations.push(`${scope}.services must be absent`);
  }
  if (hasOwn(job, "environment")) {
    violations.push(`${scope}.environment must be absent`);
  }
  if (hasOwn(job, "permissions")) {
    violations.push(`${scope}.permissions must be absent`);
  }
  if (job["timeout-minutes"] !== 5) {
    violations.push(`${scope}.timeout-minutes must be exactly 5`);
  }
  if (!hasExactKeys(job, ["runs-on", "timeout-minutes", "steps"])) {
    violations.push(`${scope} must contain only runs-on, timeout-minutes, and steps`);
  }
}

function validateTargetExecutionContract(job, scope, violations) {
  const checkoutIndex = validateRequiredActionStep(
    job.steps,
    checkoutActionReference,
    null,
    scope,
    violations,
  );
  const setupIndex = validateRequiredActionStep(
    job.steps,
    setupNodeActionReference,
    { "node-version": 22 },
    scope,
    violations,
  );
  const installIndex = validateRequiredDeploymentRun(job.steps, targetInstallCommand, scope, violations);
  const guardIndex = validateRequiredDeploymentRun(job.steps, targetGuardCommand, scope, violations);
  const syntaxIndex = validateRequiredDeploymentRun(job.steps, targetSyntaxCommand, scope, violations);
  const buildIndex = validateRequiredDeploymentRun(job.steps, deploymentBuildCommand, scope, violations);
  if (checkoutIndex !== 0 || setupIndex !== 1 || installIndex !== 2 || guardIndex !== 3 || syntaxIndex !== 4) {
    violations.push(`${scope} must start with exact checkout, setup, npm ci, guard, and syntax steps`);
  }
  if (buildIndex < 5) {
    violations.push(`${scope} must retain its exact static build step after bootstrap`);
  }

  const allowedNonVerifierRuns = new Set([
    targetInstallCommand,
    targetSyntaxCommand,
    deploymentBuildCommand,
  ]);
  job.steps.forEach((step, index) => {
    if (!isMapping(step)) return;
    if (hasOwn(step, "uses")) {
      if (index !== checkoutIndex && index !== setupIndex) {
        violations.push(`${scope}.steps[${index}] contains an unreviewed action step`);
      }
      return;
    }
    if (typeof step.run !== "string") {
      violations.push(`${scope}.steps[${index}] must be a reviewed run or action step`);
      return;
    }
    if (step.run === targetGuardCommand || verifierMention.test(step.run)) return;
    if (!allowedNonVerifierRuns.has(step.run)) {
      violations.push(`${scope}.steps[${index}] contains an unreviewed non-verifier run step`);
    }
  });
}

function validatePushTrigger(workflow, workflowFile, violations) {
  if (!isMapping(workflow.on) ||
      !hasExactKeys(workflow.on, ["push", "pull_request", "workflow_dispatch"]) ||
      workflow.on.workflow_dispatch !== null) {
    violations.push(`${workflowFile}.on must contain exactly push, pull_request, and empty workflow_dispatch`);
  }
  if (!isMapping(workflow.on) || !isMapping(workflow.on.push)) {
    violations.push(`${workflowFile}.on.push must be a mapping restricted to main`);
    return;
  }
  const push = workflow.on.push;
  if (!hasExactKeys(push, ["branches"])) {
    violations.push(`${workflowFile}.on.push must contain only branches`);
  }
  if (!Array.isArray(push.branches) || push.branches.length !== 1 || push.branches[0] !== "main") {
    violations.push(`${workflowFile}.on.push.branches must be exactly [main]`);
  }
  ["branches-ignore", "paths", "paths-ignore", "tags", "tags-ignore"].forEach((key) => {
    if (hasOwn(push, key)) {
      violations.push(`${workflowFile}.on.push.${key} must be absent`);
    }
  });
}

function validateRequiredDeploymentRun(steps, command, jobScope, violations) {
  const matches = [];
  steps.forEach((step, index) => {
    if (isMapping(step) && step.run === command) matches.push({ step, index });
  });
  if (matches.length !== 1) {
    violations.push(`${jobScope} must contain exactly one fail-hard run step: ${command}`);
    return -1;
  }
  const { step, index } = matches[0];
  const stepScope = `${jobScope}.steps[${index}]`;
  validateFailHard(step, stepScope, violations);
  ["shell", "working-directory", "uses", "env", "timeout-minutes"].forEach((key) => {
    if (hasOwn(step, key)) violations.push(`${stepScope}.${key} must be absent`);
  });
  return index;
}

function validateRequiredActionStep(steps, reference, expectedWith, jobScope, violations) {
  const matches = [];
  steps.forEach((step, index) => {
    if (isMapping(step) && step.uses === reference) matches.push({ step, index });
  });
  if (matches.length !== 1) {
    violations.push(`${jobScope} must contain exactly one fail-hard action step using ${reference}`);
    return -1;
  }
  const { step, index } = matches[0];
  const stepScope = `${jobScope}.steps[${index}]`;
  validateFailHard(step, stepScope, violations);
  ["shell", "working-directory", "run", "env", "timeout-minutes"].forEach((key) => {
    if (hasOwn(step, key)) violations.push(`${stepScope}.${key} must be absent`);
  });
  if (expectedWith === null) {
    if (hasOwn(step, "with")) violations.push(`${stepScope}.with must be absent`);
  } else if (!hasExactEntries(step.with, expectedWith)) {
    violations.push(`${stepScope}.with does not match the reviewed action inputs`);
  }
  return index;
}

function validateDeploymentContract(workflow, workflowFile, violations) {
  validatePushTrigger(workflow, workflowFile, violations);
  if (!isMapping(workflow.jobs) || !isMapping(workflow.jobs[deploymentJobName])) {
    violations.push(`${workflowFile}.jobs.${deploymentJobName} must be a mapping`);
    return;
  }
  const job = workflow.jobs[deploymentJobName];
  const jobScope = `${workflowFile}.jobs.${deploymentJobName}`;
  if (job.name !== "Deploy verified frontend to Cloudflare Pages") {
    violations.push(`${jobScope}.name must remain Deploy verified frontend to Cloudflare Pages`);
  }
  if (job.if !== deploymentCondition) {
    violations.push(`${jobScope}.if must exactly restrict deployment to non-PR main refs`);
  }
  if (job.needs !== targetJobName) {
    violations.push(`${jobScope}.needs must be exactly ${targetJobName}`);
  }
  if (job["runs-on"] !== "ubuntu-latest") {
    violations.push(`${jobScope}.runs-on must be exactly ubuntu-latest`);
  }
  if (hasOwn(job, "continue-on-error") && job["continue-on-error"] !== false) {
    violations.push(`${jobScope}.continue-on-error must be absent or boolean false`);
  }
  if (hasOwn(job, "container")) violations.push(`${jobScope}.container must be absent`);
  if (hasOwn(job, "strategy")) violations.push(`${jobScope}.strategy must be absent`);
  if (hasOwn(job, "services")) violations.push(`${jobScope}.services must be absent`);
  if (job["timeout-minutes"] !== 10) {
    violations.push(`${jobScope}.timeout-minutes must be exactly 10`);
  }
  if (!hasExactKeys(job, [
    "name",
    "if",
    "needs",
    "runs-on",
    "timeout-minutes",
    "permissions",
    "environment",
    "steps",
  ])) {
    violations.push(`${jobScope} contains an unreviewed job-level key`);
  }
  validateRunDefaults(job, jobScope, violations);
  validateNoEnvironment(job, jobScope, violations);

  const expectedPermissions = { contents: "read", deployments: "write" };
  if (!hasExactEntries(job.permissions, expectedPermissions)) {
    violations.push(`${jobScope}.permissions must be exactly contents:read and deployments:write`);
  }
  if (!hasExactEntries(job.environment, {
    name: "production",
    url: "https://dcats.daiko-denki.co.jp",
  })) {
    violations.push(`${jobScope}.environment must be exactly the production D-CATS deployment environment`);
  }
  if (!Array.isArray(job.steps)) {
    violations.push(`${jobScope}.steps must be a sequence`);
    return;
  }

  if (job.steps.length !== 6) {
    violations.push(`${jobScope}.steps must contain exactly the six reviewed release steps`);
  }
  const checkoutIndex = validateRequiredActionStep(
    job.steps,
    checkoutActionReference,
    null,
    jobScope,
    violations,
  );
  const setupIndex = validateRequiredActionStep(
    job.steps,
    setupNodeActionReference,
    { "node-version": 22 },
    jobScope,
    violations,
  );
  const credentialStep = job.steps[2];
  if (!isMapping(credentialStep) ||
      credentialStep.name !== "Confirm Cloudflare credentials" ||
      credentialStep.run !== credentialCommand ||
      credentialStep.shell !== "bash" ||
      !hasExactEntries(credentialStep.env, credentialEnvironment) ||
      hasOwn(credentialStep, "if") ||
      (hasOwn(credentialStep, "continue-on-error") && credentialStep["continue-on-error"] !== false) ||
      hasOwn(credentialStep, "uses") ||
      hasOwn(credentialStep, "working-directory") ||
      hasOwn(credentialStep, "timeout-minutes") ||
      !hasExactKeys(credentialStep, ["name", "shell", "env", "run"])) {
    violations.push(`${jobScope}.steps[2] must exactly preserve the fail-hard Cloudflare credential preflight`);
  }
  const buildIndex = validateRequiredDeploymentRun(job.steps, deploymentBuildCommand, jobScope, violations);
  const headerIndex = validateRequiredDeploymentRun(job.steps, deploymentHeaderCommand, jobScope, violations);
  const deploymentIndex = validateRequiredActionStep(
    job.steps,
    deploymentActionReference,
    deploymentActionInputs,
    jobScope,
    violations,
  );
  if (deploymentIndex < 0) return;
  if (checkoutIndex !== 0 || setupIndex !== 1 || buildIndex !== 3 || headerIndex !== 4 || deploymentIndex !== 5) {
    violations.push(`${jobScope} must preserve checkout, setup, preflight, build, header, and deploy step order`);
  }
}

function collectTargetVerifierCoverage(workflow, workflowFile, violations, enforceJobSet = true) {
  validateWorkflowEnvelope(workflow, workflowFile, violations, enforceJobSet);
  validatePullRequestTrigger(workflow, workflowFile, violations);
  validateRunDefaults(workflow, workflowFile, violations);

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
  validateNoEnvironment(targetJob, jobScope, violations);

  if (!Array.isArray(targetJob.steps)) {
    violations.push(`${jobScope}.steps must be a sequence`);
    return new Set();
  }
  validateTargetExecutionContract(targetJob, jobScope, violations);

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
    validateNoEnvironment(step, stepScope, stepViolations);
    if (hasOwn(step, "shell")) {
      stepViolations.push(`${stepScope}.shell must be absent`);
    }
    if (hasOwn(step, "working-directory")) {
      stepViolations.push(`${stepScope}.working-directory must be absent`);
    }
    if (hasOwn(step, "timeout-minutes")) {
      stepViolations.push(`${stepScope}.timeout-minutes must be absent`);
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

function validateAuxiliaryWorkflowContracts(workflows, violations) {
  for (const [workflowFile, expectedWorkflow] of expectedAuxiliaryWorkflows) {
    const workflow = workflows.get(workflowFile);
    if (!workflow) {
      violations.push(`${workflowFile} is missing`);
    } else if (!deeplyEqual(workflow, expectedWorkflow)) {
      violations.push(`${workflowFile} must exactly match its reviewed static workflow contract`);
    }
  }
}

function validateWorkflowFileSet(workflows, violations) {
  const workflowFiles = [...workflows.keys()].sort();
  if (workflowFiles.length !== reviewedWorkflowFiles.length ||
      workflowFiles.some((workflowFile, index) => workflowFile !== reviewedWorkflowFiles[index])) {
    violations.push(`workflow files must be exactly: ${reviewedWorkflowFiles.join(", ")}`);
  }
}

function cloneWorkflow(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeAuxiliaryWorkflowFixtures() {
  return new Map([...expectedAuxiliaryWorkflows].map(([workflowFile, workflow]) => [
    workflowFile,
    cloneWorkflow(workflow),
  ]));
}

function assertAuxiliaryWorkflowRejected(name, workflowFile, mutate) {
  const workflows = makeAuxiliaryWorkflowFixtures();
  mutate(workflows.get(workflowFile));
  const violations = [];
  validateAuxiliaryWorkflowContracts(workflows, violations);
  assertSelfTest(
    violations.some((violation) => violation.startsWith(`${workflowFile} must exactly match`)),
    `${name} was not rejected (${violations.join("; ")})`,
  );
}

function makeTargetFixture(options = {}) {
  const pathEntries = options.pathEntries || requiredPullRequestPaths;
  const pullRequestProperties = options.pullRequestProperties || [];
  const workflowProperties = options.workflowProperties || [];
  const jobProperties = options.jobProperties || [];
  const runsOn = options.runsOn || "ubuntu-latest";
  const timeoutMinutes = options.timeoutMinutes ?? 5;
  const workflowPermissions = options.workflowPermissions || { contents: "read" };
  const checkoutProperties = options.checkoutProperties || [];
  const setupProperties = options.setupProperties || [];
  const setupWith = options.setupWith || { "node-version": 22 };
  const preGuardSteps = options.preGuardSteps || [];
  const verifierSteps = options.steps || ["      - run: node scripts/verify-real.js"];
  const otherJobs = options.otherJobs || [];
  return [
    "name: Search performance guard",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "    paths:",
    ...pathEntries.map((entry) => `      - ${JSON.stringify(entry)}`),
    ...pullRequestProperties,
    "  workflow_dispatch:",
    ...workflowProperties,
    `permissions: ${JSON.stringify(workflowPermissions)}`,
    "concurrency:",
    "  group: frontend-release-${{ github.ref }}",
    "  cancel-in-progress: true",
    "jobs:",
    `  "${targetJobName}":`,
    `    runs-on: ${runsOn}`,
    `    timeout-minutes: ${timeoutMinutes}`,
    ...jobProperties,
    "    steps:",
    `      - uses: ${checkoutActionReference}`,
    ...checkoutProperties,
    `      - uses: ${setupNodeActionReference}`,
    `        with: ${JSON.stringify(setupWith)}`,
    ...setupProperties,
    `      - run: ${targetInstallCommand}`,
    ...preGuardSteps,
    `      - run: ${targetGuardCommand}`,
    "      - run: |",
    "          node --check app.js",
    "          node --check sales-order-revision.js",
    "          node --check install-app.js",
    "          node --check assets/concierge-pet/concierge-pet.js",
    ...verifierSteps,
    `      - run: ${deploymentBuildCommand}`,
    ...otherJobs,
  ].join("\n");
}

function evaluateTargetFixture(
  source,
  verifierPaths = ["scripts/verify-workflow-coverage.js", "scripts/verify-real.js"],
) {
  const workflow = parseWorkflowSource(source, "fixture.yml");
  const violations = [];
  const invokedVerifiers = collectTargetVerifierCoverage(workflow, "fixture.yml", violations, false);
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

function makeDeploymentFixture(options = {}) {
  const pushBranches = options.pushBranches || ["main"];
  const pushProperties = options.pushProperties || [];
  const extraEvents = options.extraEvents || [];
  const jobIf = options.jobIf || deploymentCondition;
  const needs = options.needs || targetJobName;
  const runsOn = options.runsOn || "ubuntu-latest";
  const timeoutMinutes = options.timeoutMinutes ?? 10;
  const permissions = options.permissions || { contents: "read", deployments: "write" };
  const environment = options.environment || {
    name: "production",
    url: "https://dcats.daiko-denki.co.jp",
  };
  const jobProperties = options.jobProperties || [];
  const checkoutProperties = options.checkoutProperties || [];
  const setupProperties = options.setupProperties || [];
  const setupWith = options.setupWith || { "node-version": 22 };
  const buildProperties = options.buildProperties || [];
  const headerProperties = options.headerProperties || [];
  const deploymentProperties = options.deploymentProperties || [];
  const actionInputs = { ...deploymentActionInputs, ...(options.actionInputs || {}) };
  const extraSteps = options.extraSteps || [];
  return [
    "name: deployment fixture",
    "on:",
    "  push:",
    `    branches: ${JSON.stringify(pushBranches)}`,
    ...pushProperties,
    "  pull_request:",
    "  workflow_dispatch:",
    ...extraEvents,
    "jobs:",
    `  ${deploymentJobName}:`,
    "    name: Deploy verified frontend to Cloudflare Pages",
    `    if: ${JSON.stringify(jobIf)}`,
    `    needs: ${JSON.stringify(needs)}`,
    `    runs-on: ${runsOn}`,
    `    timeout-minutes: ${timeoutMinutes}`,
    "    permissions:",
    ...Object.entries(permissions).map(([key, value]) => `      ${key}: ${value}`),
    "    environment:",
    ...Object.entries(environment).map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`),
    ...jobProperties,
    "    steps:",
    `      - uses: ${checkoutActionReference}`,
    ...checkoutProperties,
    `      - uses: ${setupNodeActionReference}`,
    `        with: ${JSON.stringify(setupWith)}`,
    ...setupProperties,
    "      - name: Confirm Cloudflare credentials",
    "        shell: bash",
    "        env:",
    `          CLOUDFLARE_API_TOKEN: ${JSON.stringify(credentialEnvironment.CLOUDFLARE_API_TOKEN)}`,
    `          CLOUDFLARE_ACCOUNT_ID: ${JSON.stringify(credentialEnvironment.CLOUDFLARE_ACCOUNT_ID)}`,
    "        run: |",
    "          set -euo pipefail",
    "          test -n \"$CLOUDFLARE_API_TOKEN\" || { echo \"CLOUDFLARE_API_TOKEN is not configured.\" >&2; exit 1; }",
    "          test -n \"$CLOUDFLARE_ACCOUNT_ID\" || { echo \"CLOUDFLARE_ACCOUNT_ID is not configured.\" >&2; exit 1; }",
    `      - run: ${JSON.stringify(deploymentBuildCommand)}`,
    ...buildProperties,
    `      - run: ${JSON.stringify(deploymentHeaderCommand)}`,
    ...headerProperties,
    `      - uses: ${deploymentActionReference}`,
    ...deploymentProperties,
    "        with:",
    ...Object.entries(actionInputs).map(([key, value]) => `          ${key}: ${JSON.stringify(value)}`),
    ...extraSteps,
  ].join("\n");
}

function evaluateDeploymentFixture(source) {
  const workflow = parseWorkflowSource(source, "deployment-fixture.yml");
  const violations = [];
  validateDeploymentContract(workflow, "deployment-fixture.yml", violations);
  return violations;
}

function assertDeploymentRejected(name, source, expectedMessage) {
  const violations = evaluateDeploymentFixture(source);
  assertSelfTest(
    violations.some((violation) => violation.includes(expectedMessage)),
    `${name} was not rejected (${violations.join("; ")})`,
  );
}

function runSelfTests() {
  const valid = evaluateTargetFixture(makeTargetFixture());
  assertSelfTest(valid.violations.length === 0, `valid fixture was rejected: ${valid.violations.join("; ")}`);
  assertSelfTest(valid.invokedVerifiers.has("scripts/verify-real.js"), "valid verifier was not counted");

  const decoys = evaluateTargetFixture(makeTargetFixture({
    steps: [
      "      - name: node scripts/verify-name-decoy.js",
      "        run: node scripts/verify-real.js",
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
  assertTargetRejected("short target timeout", makeTargetFixture({
    timeoutMinutes: 1,
  }), ".timeout-minutes must be exactly 5");
  assertTargetRejected("target job container", makeTargetFixture({
    jobProperties: ["    container: { image: node:22, env: { PATH: /tmp/bin } }"],
  }), ".container must be absent");
  assertTargetRejected("target job dependency skip", makeTargetFixture({
    jobProperties: ["    needs: blocker"],
    otherJobs: ["  blocker:", "    if: \"${{ false }}\"", "    runs-on: ubuntu-latest", "    steps: []"],
  }), ".needs must be absent");
  assertTargetRejected("target job strategy", makeTargetFixture({
    jobProperties: ["    strategy: { matrix: { node: [22] } }"],
  }), ".strategy must be absent");
  assertTargetRejected("target job services", makeTargetFixture({
    jobProperties: ["    services: { proxy: { image: attacker/proxy:latest } }"],
  }), ".services must be absent");
  assertTargetRejected("target deployment environment", makeTargetFixture({
    jobProperties: ["    environment: production"],
  }), ".environment must be absent");
  assertTargetRejected("target permission override", makeTargetFixture({
    jobProperties: ["    permissions: { contents: write }"],
  }), ".permissions must be absent");
  assertTargetRejected("workflow permission expansion", makeTargetFixture({
    workflowPermissions: { contents: "write", "id-token": "write" },
  }), ".permissions must be exactly contents:read");
  assertTargetRejected("target checkout input override", makeTargetFixture({
    checkoutProperties: ["        with: { repository: attacker/repository }"],
  }), ".with must be absent");
  assertTargetRejected("target setup mirror override", makeTargetFixture({
    setupWith: { "node-version": 22, mirror: "https://attacker.invalid" },
  }), ".with does not match the reviewed action inputs");
  assertTargetRejected("pre-guard PATH replacement", makeTargetFixture({
    preGuardSteps: ["      - run: echo /tmp/fake-node >> $GITHUB_PATH"],
  }), "contains an unreviewed non-verifier run step");

  const validDeployment = evaluateDeploymentFixture(makeDeploymentFixture());
  assertSelfTest(
    validDeployment.length === 0,
    `valid deployment fixture was rejected: ${validDeployment.join("; ")}`,
  );
  assertDeploymentRejected("disabled deployment job", makeDeploymentFixture({
    jobIf: "${{ false }}",
  }), ".if must exactly restrict deployment");
  assertDeploymentRejected("deployment dependency bypass", makeDeploymentFixture({
    needs: "blocker",
  }), `.needs must be exactly ${targetJobName}`);
  assertDeploymentRejected("self-hosted deployment", makeDeploymentFixture({
    runsOn: "self-hosted",
  }), ".runs-on must be exactly ubuntu-latest");
  assertDeploymentRejected("containerized deployment", makeDeploymentFixture({
    jobProperties: ["    container: node:22"],
  }), ".container must be absent");
  assertDeploymentRejected("deployment services", makeDeploymentFixture({
    jobProperties: ["    services: { proxy: { image: attacker/proxy:latest } }"],
  }), ".services must be absent");
  assertDeploymentRejected("deployment strategy", makeDeploymentFixture({
    jobProperties: ["    strategy: { matrix: { node: [22] } }"],
  }), ".strategy must be absent");
  assertDeploymentRejected("fail-soft deployment job", makeDeploymentFixture({
    jobProperties: ["    continue-on-error: true"],
  }), ".continue-on-error must be absent or boolean false");
  assertDeploymentRejected("restricted main push paths", makeDeploymentFixture({
    pushProperties: ["    paths: [app.js]"],
  }), ".on.push.paths must be absent");
  assertDeploymentRejected("wrong push branch", makeDeploymentFixture({
    pushBranches: ["release"],
  }), ".on.push.branches must be exactly [main]");
  assertDeploymentRejected("unexpected schedule trigger", makeDeploymentFixture({
    extraEvents: ["  schedule: [{ cron: \"0 * * * *\" }]"],
  }), ".on must contain exactly push, pull_request, and empty workflow_dispatch");
  assertDeploymentRejected("short deployment timeout", makeDeploymentFixture({
    timeoutMinutes: 1,
  }), ".timeout-minutes must be exactly 10");
  assertDeploymentRejected("expanded deployment permissions", makeDeploymentFixture({
    permissions: { contents: "write", deployments: "write" },
  }), ".permissions must be exactly");
  assertDeploymentRejected("wrong deployment environment", makeDeploymentFixture({
    environment: { name: "staging", url: "https://dcats.daiko-denki.co.jp" },
  }), ".environment must be exactly");
  assertDeploymentRejected("conditional deploy checkout", makeDeploymentFixture({
    checkoutProperties: ["        if: \"${{ false }}\""],
  }), ".if must be absent");
  assertDeploymentRejected("deploy checkout ref override", makeDeploymentFixture({
    checkoutProperties: ["        with: { ref: main }"],
  }), ".with must be absent");
  assertDeploymentRejected("deploy setup mirror", makeDeploymentFixture({
    setupWith: { "node-version": 22, mirror: "https://attacker.invalid" },
  }), ".with does not match the reviewed action inputs");
  assertDeploymentRejected("conditional deployment build", makeDeploymentFixture({
    buildProperties: ["        if: \"${{ false }}\""],
  }), ".if must be absent");
  assertDeploymentRejected("deployment build step timeout", makeDeploymentFixture({
    buildProperties: ["        timeout-minutes: 1"],
  }), ".timeout-minutes must be absent");
  assertDeploymentRejected("fail-soft deployment header check", makeDeploymentFixture({
    headerProperties: ["        continue-on-error: true"],
  }), ".continue-on-error must be absent or boolean false");
  assertDeploymentRejected("conditional wrangler deployment", makeDeploymentFixture({
    deploymentProperties: ["        if: \"${{ false }}\""],
  }), ".if must be absent");
  assertDeploymentRejected("fail-soft wrangler deployment", makeDeploymentFixture({
    deploymentProperties: ["        continue-on-error: true"],
  }), ".continue-on-error must be absent or boolean false");
  assertDeploymentRejected("no-op wrangler command", makeDeploymentFixture({
    actionInputs: { command: "wrangler --version" },
  }), ".with does not match the reviewed action inputs");
  assertDeploymentRejected("wrangler pre-command injection", makeDeploymentFixture({
    actionInputs: { preCommands: "echo bypass" },
  }), ".with does not match the reviewed action inputs");
  assertDeploymentRejected("extra release step", makeDeploymentFixture({
    extraSteps: ["      - run: echo bypass"],
  }), ".steps must contain exactly the six reviewed release steps");

  const exactJobSetWorkflow = parseWorkflowSource(makeTargetFixture(), "job-set.yml");
  const deploymentFixtureWorkflow = parseWorkflowSource(makeDeploymentFixture(), "deploy-job.yml");
  exactJobSetWorkflow.jobs[deploymentJobName] = deploymentFixtureWorkflow.jobs[deploymentJobName];
  const exactJobSetProblems = [];
  validateWorkflowEnvelope(exactJobSetWorkflow, "job-set.yml", exactJobSetProblems);
  assertSelfTest(
    exactJobSetProblems.length === 0,
    `reviewed two-job workflow was rejected: ${exactJobSetProblems.join("; ")}`,
  );
  exactJobSetWorkflow.jobs["unreviewed-production-job"] = {
    "runs-on": "ubuntu-latest",
    if: "github.event_name != 'pull_request'",
    environment: "production",
    steps: [{ run: "echo unreviewed" }],
  };
  const thirdJobProblems = [];
  validateWorkflowEnvelope(exactJobSetWorkflow, "job-set.yml", thirdJobProblems);
  assertSelfTest(
    thirdJobProblems.some((problem) => problem.includes(".jobs must contain exactly")),
    "a third release-workflow job was not rejected",
  );

  const validAuxiliaryWorkflows = makeAuxiliaryWorkflowFixtures();
  const validAuxiliaryProblems = [];
  validateAuxiliaryWorkflowContracts(validAuxiliaryWorkflows, validAuxiliaryProblems);
  assertSelfTest(
    validAuxiliaryProblems.length === 0,
    `valid auxiliary workflow contracts were rejected: ${validAuxiliaryProblems.join("; ")}`,
  );
  assertAuxiliaryWorkflowRejected(
    "security checkout repository override",
    "security-headers-guard.yml",
    (workflow) => { workflow.jobs.verify.steps[0].with = { repository: "attacker/repository" }; },
  );
  assertAuxiliaryWorkflowRejected(
    "security setup mirror override",
    "security-headers-guard.yml",
    (workflow) => { workflow.jobs.verify.steps[1].with.mirror = "https://attacker.invalid"; },
  );
  assertAuxiliaryWorkflowRejected(
    "security arbitrary secret step",
    "security-headers-guard.yml",
    (workflow) => {
      workflow.jobs.verify.steps.push({ run: "echo ${{ secrets.GITHUB_TOKEN }}" });
    },
  );
  assertAuxiliaryWorkflowRejected(
    "security extra job",
    "security-headers-guard.yml",
    (workflow) => {
      workflow.jobs.unreviewed = { "runs-on": "ubuntu-latest", steps: [{ run: "echo bypass" }] };
    },
  );
  assertAuxiliaryWorkflowRejected(
    "security conditional checkout",
    "security-headers-guard.yml",
    (workflow) => { workflow.jobs.verify.steps[0].if = "${{ false }}"; },
  );
  assertAuxiliaryWorkflowRejected(
    "security fail-soft setup",
    "security-headers-guard.yml",
    (workflow) => { workflow.jobs.verify.steps[1]["continue-on-error"] = true; },
  );
  assertAuxiliaryWorkflowRejected(
    "postal checkout repository override",
    "postal-data-update.yml",
    (workflow) => { workflow.jobs.update.steps[0].with.repository = "attacker/repository"; },
  );
  assertAuxiliaryWorkflowRejected(
    "postal checkout ref override",
    "postal-data-update.yml",
    (workflow) => { workflow.jobs.update.steps[0].with.ref = "main"; },
  );
  assertAuxiliaryWorkflowRejected(
    "postal setup mirror override",
    "postal-data-update.yml",
    (workflow) => { workflow.jobs.update.steps[1].with.mirror = "https://attacker.invalid"; },
  );
  assertAuxiliaryWorkflowRejected(
    "postal arbitrary secret step",
    "postal-data-update.yml",
    (workflow) => {
      workflow.jobs.update.steps.splice(2, 0, { run: "echo ${{ secrets.GITHUB_TOKEN }}" });
    },
  );
  assertAuxiliaryWorkflowRejected(
    "postal extra job",
    "postal-data-update.yml",
    (workflow) => {
      workflow.jobs.unreviewed = { "runs-on": "ubuntu-latest", steps: [{ run: "echo bypass" }] };
    },
  );
  assertAuxiliaryWorkflowRejected(
    "postal conditional checkout",
    "postal-data-update.yml",
    (workflow) => { workflow.jobs.update.steps[0].if = "${{ false }}"; },
  );
  assertAuxiliaryWorkflowRejected(
    "postal fail-soft setup",
    "postal-data-update.yml",
    (workflow) => { workflow.jobs.update.steps[1]["continue-on-error"] = true; },
  );
  const reviewedFileSet = new Map(reviewedWorkflowFiles.map((workflowFile) => [workflowFile, {}]));
  const reviewedFileSetProblems = [];
  validateWorkflowFileSet(reviewedFileSet, reviewedFileSetProblems);
  assertSelfTest(reviewedFileSetProblems.length === 0, "reviewed workflow file set was rejected");
  reviewedFileSet.set("unreviewed-side-effect.yml", {});
  const extraWorkflowProblems = [];
  validateWorkflowFileSet(reviewedFileSet, extraWorkflowProblems);
  assertSelfTest(
    extraWorkflowProblems.some((problem) => problem.startsWith("workflow files must be exactly")),
    "an unreviewed workflow file was not rejected",
  );
  assertTargetRejected("workflow default shell", makeTargetFixture({
    workflowProperties: ["defaults:", "  run: { shell: bash }"],
  }), ".defaults.run.shell must be absent");
  assertTargetRejected("job default shell", makeTargetFixture({
    jobProperties: ["    defaults:", "      run:", "        shell: bash"],
  }), ".defaults.run.shell must be absent");
  assertTargetRejected("workflow PATH override", makeTargetFixture({
    workflowProperties: ["env: { PATH: /tmp/bin }"],
  }), ".env must be absent");
  assertTargetRejected("job NODE_OPTIONS override", makeTargetFixture({
    jobProperties: ["    env:", "      NODE_OPTIONS: --require ./skip.js"],
  }), ".env must be absent");
  assertTargetRejected("step PATH override", makeTargetFixture({
    steps: [
      "      - env: { Path: /tmp/bin }",
      "        run: node scripts/verify-real.js",
    ],
  }), ".env must be absent");

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
  assertTargetRejected("missing vendor path", makeTargetFixture({
    pathEntries: requiredPullRequestPaths.filter((entry) => entry !== "vendor/**"),
  }), ".on.pull_request.paths must include vendor/**");

  const additionallyIndentedSource = [
    "name: Search performance guard",
    "on:",
    "    push:",
    "        branches: [main]",
    "    pull_request:",
    "        paths:",
    ...requiredPullRequestPaths.map((entry) => `          - ${JSON.stringify(entry)}`),
    "    workflow_dispatch:",
    "permissions: { contents: read }",
    "concurrency:",
    "    group: frontend-release-${{ github.ref }}",
    "    cancel-in-progress: true",
    "jobs:",
    `    "${targetJobName}":`,
    "        runs-on: ubuntu-latest",
    "        timeout-minutes: 5",
    "        steps:",
    `          - uses: ${checkoutActionReference}`,
    `          - uses: ${setupNodeActionReference}`,
    "            with: { node-version: 22 }",
    `          - run: ${targetInstallCommand}`,
    `          - run: ${targetGuardCommand}`,
    "          - run: |",
    "              node --check app.js",
    "              node --check sales-order-revision.js",
    "              node --check install-app.js",
    "              node --check assets/concierge-pet/concierge-pet.js",
    "          - run: node scripts/verify-real.js",
    `          - run: ${deploymentBuildCommand}`,
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

  let customTagRejected = false;
  try {
    parseWorkflowSource("jobs: !unreviewed {}", "custom-tag.yml");
  } catch (error) {
    customTagRejected = /Unresolved tag/.test(error.message);
  }
  assertSelfTest(customTagRejected, "unknown YAML tag warning was not rejected");
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
validateWorkflowFileSet(workflows, violations);
const targetWorkflow = workflows.get(targetWorkflowName);
let invokedVerifiers = new Set();
if (!targetWorkflow) {
  violations.push(`${targetWorkflowName} is missing`);
} else {
  invokedVerifiers = collectTargetVerifierCoverage(targetWorkflow, targetWorkflowName, violations);
  addCoverageProblems(verifierPaths, invokedVerifiers, violations);
  validateDeploymentContract(targetWorkflow, targetWorkflowName, violations);
}
const externalActionUses = validateActionInventory(workflows, violations);
validateAuxiliaryWorkflowContracts(workflows, violations);

if (violations.length) {
  throw new Error(`Workflow supply-chain contract failed:\n- ${violations.join("\n- ")}`);
}

const expectedActionUses = [...approvedActionReferences.values()].reduce((total, count) => total + count, 0);
console.log(
  `workflow supply-chain guard passed (${invokedVerifiers.size}/${verifierPaths.length} target-job verifiers, ` +
  `${externalActionUses}/${expectedActionUses} allowlisted external actions; YAML adversarial self-tests passed)`,
);
