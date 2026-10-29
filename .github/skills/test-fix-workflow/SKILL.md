---
name: test-fix-workflow
description: 'Debug failing Node/TypeScript tests and fix the root cause with a repeatable validation loop. Use for regression investigation, single-test reproduction, code repair, or verifying app behavior in this repo.'
argument-hint: 'Target a failing test file or error message, then reproduce and fix the root cause.'
user-invocable: true
disable-model-invocation: false
---

# Test Fix Workflow

## When to Use
- A test fails in this repository, especially in the Node/TypeScript test suite
- A regression needs root-cause analysis before a code change
- A feature is expected to behave according to specification but the implementation disagrees
- You need a fast, repeatable debugging workflow for local validation

## Goal
Fix the underlying issue with the smallest safe patch, then confirm it with the relevant test command and a quick sanity check.

## Procedure

1. Reproduce the failure exactly
   - Run the smallest relevant command first, not the entire suite.
   - For this repo, prefer the direct test file or a single `node --test` invocation.
   - Example:
     - `node --import tsx --test tests/growth-worker-center.test.ts`
     - `npm run test:unit -- --test-name-pattern "growth worker center"`

2. Read the failing assertion and identify the contract
   - Map each failed assertion to the real product expectation.
   - Check whether the failure is:
     - implementation bug
     - stale or wrong test expectation
     - missing data contract
     - environment/setup issue

3. Trace the root cause before editing
   - Follow the specific function or module behind the failure.
   - Confirm the data shape, status values, and edge conditions that drive the assertion.
   - Prefer source-level evidence over assumptions.
   - If a test is checking a generated object, inspect the exact builder or domain code that creates it.

4. Make the minimal fix
   - Patch only the production logic or test expectation that is genuinely wrong.
   - Keep the change narrow and aligned with the actual contract.
   - Do not broaden scope while the failure is unresolved.

5. Validate the fix immediately
   - Re-run the same targeted test command.
   - If the test passes, run one adjacent sanity check if needed, such as the relevant unit test group or TypeScript validation.
   - For this project, `npm run lint` is the lightweight compile check.

6. Confirm completion with evidence
   - Only call the issue fixed when the relevant test command passes and the root cause is addressed.
   - Report:
     - the failing behavior
     - the root cause
     - the fix
     - the validation command and result

## Decision Points

### If the assertion is failing because the implementation is wrong
- Update the code that builds or filters the object, state, or data.
- Preserve the intended contract and avoid unrelated refactors.

### If the assertion is failing because the test is asserting the wrong behavior
- Validate against the product requirement or domain contract.
- Adjust the assertion only after confirming the intended behavior.

### If the data shape is inconsistent or incomplete
- Inspect the source object, builder, and downstream transforms.
- Fix the data contract at the source rather than papering over it in the test.

### If the environment is the issue
- Reduce scope to the single reproducer.
- Check prerequisites, env vars, database state, or bootstrapping steps before continuing.

## Quality Bar
A change is ready when all of the following are true:
- The failure was reproduced explicitly
- The root cause was identified from code and test evidence
- The patch is minimal and consistent with the intended contract
- The exact failing command passes after the fix
- No obvious adjacent regression was introduced

## Repo-Specific Notes
This project uses Node test runner with TypeScript via `tsx`, and the typical validation pattern is:
- targeted unit test file for a failing scenario
- then `npm run lint` or adjacent test commands if needed

Relevant examples in this workspace include:
- [tests/growth-worker-center.test.ts](../../tests/growth-worker-center.test.ts)
- [package.json](../../package.json)

## Example Prompts
- "Fix the failing growth worker center test and explain the root cause."
- "Reproduce this regression in the smallest test and patch the implementation."
- "Why is this test asserting a 'migration_required' availability value? Validate the contract before changing the code."
- "Run the targeted test, fix the failing logic, and verify the result with the smallest valid command."
