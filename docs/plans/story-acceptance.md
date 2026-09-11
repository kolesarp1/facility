# Typed story acceptance — implementation plan

Status: proposed; implementation has not started. Base: `a6fd215b449cbcf5860edcd94cbea21c7808063a`. Branch: `feat/story-acceptance`.

A [typed phase example](story-acceptance.phase.ts) maps this proposal into pending tasks, planned checks and criterion IDs. It is a portable backlog-only example compatible with Roadmap 0.41.2, not a Roadmap installation or implementation of this feature. Its `extensions.facilityPlan` metadata is illustrative; the contract below remains authoritative.

## Outcome and agreed scope

A maintainer records original acceptance criteria once. Each reviewer turn reports a typed result for every criterion against the actual revision it inspected. Facility presents acceptance independently of GitHub delivery and passes unresolved criteria to the existing reviewer/repair agents.

Owner decision: typed acceptance first; use existing review/repair triggers. Do not introduce automatic repair scheduling, another workflow engine, full arc/task planning, a general handover document system, budget changes or new merge policy. This is a bounded vertical slice across the current contracts, storage, dispatcher and story UI, not a few-line prompt edit.

## User journey

1. Start a story normally. Optionally supply acceptance at creation, or ask the architect to plan and then record the agreed criteria while the story has no queued/running turn.
2. Record stable IDs, observable descriptions and optional canonical UX/architecture references. The authenticated setter confirms these are the criteria to track; the server records actor and time. No LLM extraction or automatic approval from conversation.
3. Subsequent agents receive that baseline plus the latest criterion results outside transcript truncation. An older original request cannot disappear merely because the transcript is long or the next review was queued early.
4. A reviewer explicitly configured to report acceptance returns a structured block in its final response. Facility validates it and records the real turn, agent, baseline and Git revision. Missing or malformed reports cannot produce an accepted outcome.
5. The existing repair agent sees unmet/blocked/unverified criteria. It can repair under current triggers and scope, but its own claim that it is finished cannot set reviewer acceptance.
6. The story shows delivery state (including merged/done) separately from acceptance. Passing evidence for an earlier revision becomes stale. Merge continues to suspend compute exactly as today.

## Contract decisions

### One shared typed contract

Create `packages/agents/src/story-acceptance.ts`, exported from the package's existing index. This package already owns Zod-based agent input/output contracts; avoid a second schema in routes or MCP. Add direct workspace dependencies only where needed for the shared contract.

- Baseline input: `schemaVersion: 1`, `criteria: [{ id, description }]`, optional `references: [{ label, target }]`. One to 20 unique criterion IDs (1–64 characters; `[A-Za-z0-9_-]+`), descriptions 1–1,000 characters; up to 10 references, labels up to 120 and targets up to 500 characters. Targets are plain text repository paths or URLs, never fetched automatically.
- Server baseline: immutable ID, scoped story identity, criteria/references, recorded actor and timestamp. No criteria replacement, deletion or amendments in v1. A genuine scope change needs a new story; disclose this limitation in the UI and docs rather than silently weakening criteria.
- Review payload: `schemaVersion`, `baselineId`, `results: [{ criterionId, status, evidence }]`. Status is `met | unmet | blocked | unverified`. Exactly one result for every original criterion; duplicate, unknown or missing IDs reject the report. Evidence is a nonempty bounded observation/reason string, not model-authored authority or a trusted URL. No model-supplied actor, turn ID, timestamps, revision or aggregate accepted boolean.
- Report metadata is attached by Facility: review turn/agent, captured initial/final SHA and dirty state, baseline ID, observed time. Extend start-of-turn Git evidence to capture initial dirty state; a clean final state alone cannot prove the reviewer began from a clean candidate.
- Derived acceptance: `not_configured | unverified | gaps | accepted | stale`. All criteria must be `met` in a valid eligible report for `accepted`. Other criterion states produce `gaps`; no report or an invalid latest eligible attempt produces `unverified`. Unknown/missing/failed Git capture or a changed/dirty review checkout cannot establish accepted evidence.
- Every report is an agent attestation, not proof of truth or authenticated human approval. Agent permissions remain Facility's shared maintainer capability. Independent review is a distinct configured role/context, not a security sandbox.

### Frozen baseline and existing permissions

Add a dedicated `story_acceptance` table in the next unused migration under `packages/db/migrations/v0.12/` (currently 0007; verify the number before implementation). Key/scope it by organization, project and story using the same composite FK pattern as existing story evidence. Store the immutable baseline, last valid eligible review snapshot, and latest review-attempt disposition separately. A malformed or missing later report changes aggregate acceptance to unverified but retains prior gaps and evidence for handover; it must not erase what was previously learned. Append acceptance events to existing `storyEvidenceEvents`; do not build a second audit journal.

Set via `PUT /v1/projects/:projectId/workspace-stories/:storyId/acceptance`, using existing `workspaces:execute` authorization and the authenticated actor. Require an idle story, a stable idempotency key and the same scoped story lock as other mutations. Identical retries return the established record; differing payloads or attempts to replace a baseline conflict. This is authenticated user/service intent recording, not a claim that all service clients represent human consent. Reject archived/deleted stories. Creation may accept the same optional baseline shape atomically; duplicate start requests cannot replace it.

Expose `acceptance` on the existing story bundle, plus `facility_set_story_acceptance` with the same permission and route. UI and MCP call the same domain method. Existing stories with no baseline behave as today and return `not_configured`.

### Native review output; no new agent credentials

Extend `AgentManifestFrontmatterSchema.options` with optional `acceptance_review: boolean`, default false. Enable it in the default `pr-reviewer` template only. It describes who may provide acceptance attestations; it does not reduce or expand workspace/GitHub permissions. Existing repository manifests remain unchanged until their owners opt in through normal edits. Preserve this flag through the existing agent-edit API: `UpdateAgentBody`/PATCH currently reconstructs options from reasoning_effort alone. When callers omit the new flag, retain it from the current manifest at the expected commit; reject stale expected commits as today. Explicit API values may update it under existing projects:write authorization. Ordinary description/model/reasoning edits in `apps/web/components/agents/agent-editor.tsx` must not erase opt-in. No role-designer UI is needed.

For a story with acceptance, the dispatcher renders a bounded `Story acceptance` section after conversation history, containing the immutable baseline and current results/revision. It tells implementation roles to repair gaps and configured review roles to return exactly one terminal `<facility-acceptance>{JSON}</facility-acceptance>` block in the final response. Example JSON is generated from the shared contract. Extract only from the engine's final response, never progress, repository text or generic tool output. Keep ordinary conversation output intact apart from removing a valid machine block; preserve malformed output for diagnosis with existing redaction and bounds.

Record a report only from a successful turn whose snapshotted manifest has `acceptance_review: true`; baseline ID and full criterion coverage must match. Capture server-derived provenance. A reviewer must begin and end on the same clean commit to establish accepted results. A report is rejected as stale/unverified if a later turn or GitHub head already superseded its candidate. Duplicate completion delivery does not create a second report. A missing/invalid report records an acceptance diagnostic and invalidates the latest eligible acceptance verdict, without discarding the normal engine result or claiming the engine itself crashed.

Persist the last valid review snapshot or invalid-attempt disposition, acceptance evidence event, and successful `completeTurn` state transition atomically under the existing scoped story transaction. Recheck that the turn is still running and not canceled, its baseline identity and candidate freshness. A failed/canceled or partially persisted turn cannot establish accepted evidence; transaction rollback must leave no new accepted snapshot. Duplicate delivery is idempotent. Compute the redacted candidate disposition before this transaction, but do not publish it as accepted independently of successful completion.

The reviewer template must also publish unmet criteria as actionable feedback on the existing GitHub PR review. The terminal machine block does not emit a GitHub review event: `address-review` activates on `pull_request_review: submitted`. Tests must drive that configured event path, not manually invoke a repair while claiming trigger coverage. Missing platform/credential access is a reported blocker, not invented GitHub feedback.

The review block consumes existing output and does not need an API credential inside the workspace or another MCP endpoint for model-written reports. Structured acceptance is injected independently of the ordinary message cutoff; upstream issue #306's broader conversation-order defect is separate work, not silently fixed here.

### Revision freshness and merge

Use existing turn Git evidence and mirrored PR heads. Compare the accepted candidate with the latest known story/PR revision; any newer changed/dirty or failed/unknown capture makes acceptance stale/unverified conservatively. At turn start, avoid displaying an in-flight prior pass as current acceptance. Read-only story rendering must not wake compute to run Git. Clearly label the evidence as 'verified at commit …' based on observed state, not continuous monitoring of unobserved edits.

Merge itself does not establish acceptance. Preserve an already accepted PR head through squash/rebase merge by comparing against the mirrored PR `headSha` (the reviewed candidate), not demanding equality with a different merge commit. If the merged head differs or is unknown, display stale/unverified. Never change `markMerged` to wait for an acceptance verdict or trigger more work.

### Small UI

Add `apps/web/components/story/story-acceptance.tsx` and integrate it into the existing story page. Reuse Facility UI components and brand. Show original criteria, per-criterion state and evidence, review agent/turn/revision, canonical reference labels, and aggregate acceptance separately from Task phase. Render all agent evidence as text; safe external links only if supported by the existing URL policy. References must not trigger server-side fetching.

Allow authorized users to set criteria once while idle using a compact editor on that panel; read-only members can view results. No new status dashboard, role designer, UX design tool, amendment editor or generic task board. The existing start form can remain unchanged if it links to the story panel; API/MCP creation can carry acceptance optionally. Setting a baseline after planning is a normal path, not an error.

## Implementation tasks

1. **Contract and baseline vertical slice.** Add/export the shared schemas; add optional manifest review flag; create additive scoped storage and baseline domain methods; add the one setter route and bundle read projection. Unit-test bounds, duplicate IDs, exact coverage and aggregate rules. Integration-test set/read/idempotent replay/immutability, busy-story refusal, legacy absence and scope/permission denials. New code homes: shared contract above and `services/api/src/stories/acceptance.ts`, used by the existing story service/dispatcher, not a parallel domain service stack.
2. **Reviewer evidence and agent handover.** Extend Git evidence's initial dirty capture; inject the immutable baseline/current gaps outside transcript clipping; parse final response reports; attach server provenance and persist eligible/invalid results plus existing timeline events. Integrate freshness with Git evidence and mirrored heads. Update default reviewer and repair prompt templates, including criterion gaps in normal published review feedback. Preserve existing agent-editor option round-trips. Deterministic dispatcher tests must drive valid, malformed, missing, stale and unauthorized-role reports, same-commit read-only review, dirty-start/clean-end review, queued review and cross-story references; atomic completion rollback/cancellation, duplicate completion and valid-gap → malformed-review preservation. Reuse real fake-engine/runtime seams; do not assert copied prompt text as the only test.
3. **MCP/SDK/UI journey and documentation.** Expose setter and bundle projection via existing adapters; regenerate OpenAPI/SDK with `pnpm --filter @facility/api openapi` (never hand-edit generated SDK schema). Add the compact story panel and baseline editor. Cover permitted/read-only clients, denied writes, mixed results, accepted vs merged, stale revisions and failed refreshes. Update story operations/lifecycle and agent manifest references, clearly documenting explicit opt-in, first-version scope-change limitation and no automatic scheduling. Update tool-count documentation only where affected.
4. **Independent acceptance and required verification.** In deterministic local integration, set two criteria; reviewer reports one gap; a submitted GitHub review event activates the existing repair agent and changes the revision; next eligible review reports both met; merge retains delivery and acceptance as separate facts. Also show that merging with a gap leaves the acceptance gap visible. No live model/GitHub credentials in CI. Independently review the diff and run the required repository verification tier; report any unavailable check honestly.

## Acceptance criteria for this change

- AC1: A user can record and read a bounded typed baseline; duplicate IDs and silent replacement are rejected; legacy stories still work.
- AC2: Both native engine paths receive the same baseline/current gaps regardless of ordinary transcript length or queued-request cutoff. The baseline is not inferred from model prose.
- AC3: Only an eligible review turn with complete matching results and clean unchanged server-captured revision can establish accepted status. Missing results, malformed output, unknown IDs, forged provenance and self-certification by a non-review role cannot.
- AC4: Changed, dirty or unknown newer evidence makes acceptance stale/unverified; failed latest review attempts cannot leave an apparently current pass. Squash merge preserves acceptance of the actual reviewed PR head without treating merge as new acceptance.
- AC5: Story UI and MCP expose the same baseline/results/provenance, with acceptance independent of delivery and per-criterion gaps available to the existing repair agent.
- AC6: Tenant scoping, permission checks, redaction and idempotency are covered by unit and deterministic integration tests, including cross-tenant baseline IDs/turn references and replay conflicts. No new live network/credential requirement for default CI.
- AC7: No automatic repair jobs, permission profiles, budget bypass, new merge gate, consumer Roadmap installation or unrelated conversation/pipeline fixes are introduced.

## Verification plan

During implementation, use existing package commands with exact affected files, then `pnpm verify` for final repository acceptance. Core targets: `pnpm --filter @facility/agents test`; API tests under `services/api/test/story-workspaces.integration.test.ts`, `turn-dispatcher.integration.test.ts`, new `story-acceptance.test.ts` / `story-acceptance.integration.test.ts`; DB migration/constraint tests; `pnpm --filter @facility/mcp test`; web story component tests and typecheck. Follow `docs/testing.md` and the isolated database guards. Because dispatcher and workspace Git capture change, evaluate and run the documented Docker-backed workspace tier if its execution-boundary policy applies; do not claim a static fake proves native end-to-end operation. Planning runs no product test suite.

## Evidence, delivery and unresolved items

- Story input, scope lock and merge completion: `services/api/src/stories/service.ts` (`StartStoryInput`, `lockStory`, `markMerged`).
- Prompt and engine result seam: `services/api/src/turns/dispatcher.ts` (`buildPrompt`, `engine.run`, `evidence.complete`, `completeTurn`).
- Git evidence: `services/api/src/turns/git-evidence.ts`; mirror: `services/api/src/github/mirror.ts`.
- Shared contracts: `packages/agents/src/index.ts`; story routes: `services/api/src/routes/v1/story-workspaces.ts`; MCP: `packages/mcp/src/tools.ts`.
- Existing UI: `apps/web/app/(app)/projects/[projectId]/stories/[number]/page.tsx`; SDK types/client are under `packages/sdk/src/`.
- [Upstream #306](https://github.com/theam/facility/issues/306) documents the queued-review transcript omission. Structured baseline/results must not depend on that transcript path. [#286](https://github.com/theam/facility/issues/286) addresses post-merge outcome durability in an older architecture, not this proposed record; do not reuse its obsolete source paths.
- `CONTRIBUTING.md` requires an upstream issue before implementing behavior-changing work. Prepare a public product-only issue from this plan; do not post the owner's private workflow or company context. No upstream issue or PR has been posted in this planning step.
- Fork: `kolesarp1/facility`; branch `feat/story-acceptance` is pushed there for review. No upstream issue or pull request has been posted.
- Independent plan review: initial review identified option-loss during agent edits, atomic completion/report disposition, and the need to exercise the actual GitHub review trigger. The plan incorporates all three; the independent focused recheck returned clean. Product implementation and final verification: not started.
