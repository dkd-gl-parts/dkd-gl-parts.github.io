# Repository update policy

Changes to `main` use pull requests. The required `verify-search-workload` check
must pass on an up-to-date branch and must be reported by GitHub Actions.
This applies to documentation-only changes as well as application changes.

No human approval is mandatory in the current single-operator profile. This is
not independent human review. Administrators are subject to the branch rule;
force pushes and branch deletion are not allowed. Review conversations must
be resolved before merging.

Production environment access is restricted to the `main` branch. The normal
release job runs after main's verification succeeds, never on pull requests.
Postal updates produce candidate artifacts and use the same reviewed PR path
for publication; they do not bypass branch protection.

If a check fails, fix its cause and rerun it. Do not disable protection, forge
checks, or use an administrator bypass to make a failing change mergeable.
Provider settings remain authoritative; this document alone enforces nothing.
