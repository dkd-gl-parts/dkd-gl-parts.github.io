"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const workflowsDirectory = path.join(root, ".github", "workflows");
const scriptsDirectory = path.join(root, "scripts");

const approvedActionPins = new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
  ["cloudflare/wrangler-action", "9acf94ace14e7dc412b076f2c5c20b8ce93c79cd"],
]);

const workflowFiles = fs.readdirSync(workflowsDirectory)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const verifierPaths = fs.readdirSync(scriptsDirectory)
  .filter((name) => /^verify-.*\.js$/i.test(name))
  .sort()
  .map((name) => `scripts/${name}`);

const workflowSources = new Map();
const invokedVerifiers = new Set();
const externalActions = [];
const violations = [];

for (const workflowFile of workflowFiles) {
  const source = fs.readFileSync(path.join(workflowsDirectory, workflowFile), "utf8");
  workflowSources.set(workflowFile, source);

  source.split(/\r?\n/).forEach((line, index) => {
    if (line.trimStart().startsWith("#")) return;

    const verifierPattern = /\bnode\s+["']?(scripts\/verify-[A-Za-z0-9._-]+\.js)["']?(?=\s|$)/g;
    for (const match of line.matchAll(verifierPattern)) {
      invokedVerifiers.add(match[1]);
    }

    const usesMatch = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
    if (!usesMatch) return;

    const actionReference = usesMatch[1];
    if (actionReference.startsWith("./")) return;

    const actionMatch = actionReference.match(/^([^@]+)@([0-9a-f]{40})$/i);
    if (!actionMatch) {
      violations.push(`${workflowFile}:${index + 1} must pin ${actionReference} to a full 40-character commit SHA`);
      return;
    }

    const [, actionName, commitSha] = actionMatch;
    externalActions.push({ workflowFile, line: index + 1, actionName, commitSha: commitSha.toLowerCase() });
    const approvedSha = approvedActionPins.get(actionName);
    if (approvedSha && commitSha.toLowerCase() !== approvedSha) {
      violations.push(`${workflowFile}:${index + 1} pins ${actionName} to an unapproved commit ${commitSha}`);
    }
  });
}

const missingVerifiers = verifierPaths.filter((verifierPath) => !invokedVerifiers.has(verifierPath));
if (missingVerifiers.length) {
  violations.push(`workflow execution coverage is missing: ${missingVerifiers.join(", ")}`);
}

const searchWorkflow = workflowSources.get("search-performance-guard.yml") || "";
[
  '"scripts/verify-*.js"',
  '"desktop/concierge-companion/**"',
  '"box-label-print.css"',
  '"label-print-window.js"',
  '"print.css"',
  '".github/workflows/**"',
].forEach((requiredFilter) => {
  if (!searchWorkflow.includes(requiredFilter)) {
    violations.push(`search-performance-guard.yml pull_request paths must include ${requiredFilter}`);
  }
});

for (const [actionName, approvedSha] of approvedActionPins) {
  if (!externalActions.some((action) => action.actionName === actionName && action.commitSha === approvedSha)) {
    violations.push(`approved action pin is not used: ${actionName}@${approvedSha}`);
  }
}

if (violations.length) {
  throw new Error(`Workflow supply-chain contract failed:\n- ${violations.join("\n- ")}`);
}

console.log(
  `workflow supply-chain guard passed (${invokedVerifiers.size}/${verifierPaths.length} verifiers, ` +
  `${externalActions.length}/${externalActions.length} external actions pinned to full SHA)`,
);
