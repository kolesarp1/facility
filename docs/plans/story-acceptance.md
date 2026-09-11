# Typed acceptance review: first iteration

## Problem and outcome

Reviewers already check story acceptance criteria and publish actionable GitHub feedback. Make their per-criterion observations machine-readable and visible with the existing reviewer run. This is the first evidence-building step toward durable original-intent acceptance, not a new completion gate.

## Scope

- Export a bounded, strict Zod acceptance-review schema from `@facility/agents`: version 1, 1–20 criteria, unique explicit IDs, criterion text, status (`met`, `unmet`, `blocked`, `unverified`), and nonempty evidence or explanation.
- Default `pr-reviewer` instructions append one terminal `<facility-acceptance-review>` JSON block when the story supplies explicitly identified acceptance criteria. Preserve IDs and wording; include every supplied criterion; do not invent a baseline when absent. Findings still go to GitHub through the existing review path.
- Parse only the completed final response after the existing attention marker is handled. Missing reports leave current behavior unchanged; malformed, oversized, repeated or nonterminal reports produce an invalid-report diagnostic, never valid evidence.
- Retain a validated report as an existing turn event, with server-owned organization/project/story/turn provenance. Redact report strings using existing secret redaction before storage. No identity fields are accepted from the report.
- Present criterion status, wording and evidence in existing run activity. Keep the existing bounded presentation and raw-event access; do not change the frontend or SDK contract.

The report is an agent assertion associated with its run. Runtime validation establishes its shape, not the truth, completeness against an immutable baseline, reviewer independence or freshness. Reports do not change story status or schedule work. A later run never erases prior evidence.

## Acceptance criteria

- AC1: A completed run reporting two explicit criteria, one met and one unmet, retains both results and shows both in run activity with criterion text and evidence.
- AC2: Invalid JSON, unknown fields, duplicate IDs, empty evidence, too many criteria and malformed envelope placement cannot produce a valid report; invalid reporting does not fail otherwise successful work.
- AC3: Reports are sourced only from final output, carry existing turn provenance and use existing secret redaction. Unstructured runs behave unchanged.
- AC4: The default reviewer describes the contract and continues publishing actionable unmet criteria through GitHub review. Existing review/repair triggers and lifecycle behavior remain unchanged.

## Work and verification

1. Shared report schema and final-response parser; unit tests for bounds, statuses, envelopes and invalid inputs.
2. Dispatcher retention and activity projection; deterministic dispatcher integration with fake engine and local Postgres proving valid/invalid/no-report behavior, provenance and redaction, plus presentation tests.
3. Reviewer template and documentation; independently review the implementation against AC1–AC4, run focused tests and the repository `pnpm verify` gate. Record environmental or baseline failures accurately.

## Deferred to the proposal

Immutable original acceptance baseline, baseline edits and revision identity, completeness enforcement, independently authorized acceptance, accepted-versus-merged status, and automatic review/repair continuation within scope and budget. No new tables, routes, MCP tools, agent options or scheduler in this iteration.

`story-acceptance.phase.ts` is a portable typed planning example; Facility keeps its existing TypeScript/Zod, run evidence and template conventions. The example does not install a Roadmap runtime.

## Observed verification (2026-09-11)

- `pnpm verify` passed: lint, clean typecheck/build, critical local-Postgres integration suites, remaining uncached tests, repository guards and the dependency audit under the repository's existing audit policy.
- Focused verification after the parser fix: 38 agents-package tests and 24 API acceptance/activity/dispatcher tests passed. Package/API typechecks and the portable phase example's strict TypeScript check also passed.
- Independent implementation review identified regex backtracking on malformed envelopes. Replaced it with deterministic envelope parsing; the reviewer independently reran all 28 parser cases and confirmed the fix with no remaining scoped finding.
- The dispatcher integration exercises met/unmet results through existing activity and raw-event reads, invalid reports, final-output-only ingestion, redaction, successful turn completion and cross-organization/project denial. These are deterministic engine observations; no live model or GitHub review was invoked.
