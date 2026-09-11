/** Planning-only example compatible with Roadmap 0.41.2's phase input.
 * Local types keep this example readable without installing Roadmap in Facility.
 * They cover backlog plans, not Roadmap's full runtime/completion validation.
 * The product contract remains in story-acceptance.md. No product checks have run.
 */
type CriterionId = "AC1" | "AC2" | "AC3" | "AC4" | "AC5" | "AC6" | "AC7";
type TaskId = "baseline" | "review-evidence" | "surfaces" | "acceptance";

type PlannedTask = {
  id: TaskId;
  description: string;
  status: "pending";
  steps: Array<{ file: string; description: string; verify: string }>;
  checks: string[];
};

type BacklogPhaseExample = {
  schemaVersion: 1;
  phase: number;
  name: string;
  status: "backlog";
  intent: string;
  dependsOn: number[];
  tasks: PlannedTask[];
  // Executed check results stay empty until real implementation checks run.
  checks: [];
  findings: [];
  limitations: string[];
  // Roadmap permits consumer metadata under extensions. These are example fields,
  // not built-in phase-level acceptance or scheduling fields.
  extensions: {
    facilityPlan: {
      contract: string;
      implementationBranch: string;
      acceptanceCriteria: Record<CriterionId, string>;
      taskCriteria: Record<TaskId, CriterionId[]>;
      nonGoals: string[];
      nextAction: string;
    };
  };
};

export default {
  schemaVersion: 1,
  phase: 1,
  name: "Typed story acceptance with existing review and repair triggers",
  status: "backlog",
  intent:
    "Preserve original acceptance criteria, pass current gaps between agents, and show criterion-level verification independently of PR merge.",
  dependsOn: [],
  extensions: {
    facilityPlan: {
      contract: "docs/plans/story-acceptance.md",
      implementationBranch: "feat/story-acceptance",
      acceptanceCriteria: {
        AC1: "A user can record/read a bounded baseline; duplicate IDs and silent replacement are rejected; legacy stories still work.",
        AC2: "Both engine paths receive original criteria/current gaps outside transcript truncation and the queued-request cutoff.",
        AC3: "Only a complete, matching, eligible review with clean unchanged server-captured Git evidence can establish acceptance.",
        AC4: "Newer changed, dirty or unknown evidence makes acceptance stale/unverified; squash merge preserves the reviewed PR-head verdict.",
        AC5: "UI and MCP expose the same criteria, results and provenance; repair agents receive gaps; delivery remains separate.",
        AC6: "Deterministic unit/integration tests cover permissions, tenant isolation, redaction and replay conflicts without live credentials.",
        AC7: "No automatic repair scheduler, new permission profile, budget bypass, merge gate or unrelated pipeline/conversation fix is added.",
      },
      taskCriteria: {
        baseline: ["AC1", "AC6"],
        "review-evidence": ["AC2", "AC3", "AC4", "AC6"],
        surfaces: ["AC1", "AC5", "AC6"],
        acceptance: ["AC1", "AC2", "AC3", "AC4", "AC5", "AC6", "AC7"],
      },
      nonGoals: [
        "Automatic repair scheduling or a second orchestration engine",
        "Acceptance amendments, full arc planning or a general task board",
        "New merge policy, role permission isolation or budget behavior",
        "Installing Roadmap as a Facility product dependency",
      ],
      nextAction:
        "Review the proposed contract with the owner and upstream maintainers before implementing baseline. Execute the four tasks in listed order.",
    },
  },
  tasks: [
    {
      id: "baseline",
      description: "Record original criteria once through the existing scoped story boundary.",
      status: "pending",
      steps: [
        {
          file: "packages/agents/src/story-acceptance.ts",
          description:
            "Create/export bounded baseline and review schemas; extend manifest options with acceptance_review. Use the exact rules in the contract.",
          verify: "Duplicate IDs, invalid shapes and incomplete criterion coverage are rejected.",
        },
        {
          file: "packages/db/src/schema.ts",
          description:
            "Add scoped story_acceptance storage and an additive migration; keep immutable baseline, last valid results and latest attempt disposition separate.",
          verify: "Legacy absence, cross-tenant references and repeat/conflicting writes behave correctly.",
        },
        {
          file: "services/api/src/stories/acceptance.ts",
          description:
            "Create domain helpers used by the existing story service; wire the idle-story setter, bundle projection and existing permission/idempotency handling.",
          verify: "Set/read succeeds; busy, archived, deleted, denied and replacement cases fail without mutation.",
        },
      ],
      checks: [
        "Run shared-schema unit tests with pnpm --filter @facility/agents test.",
        "Run scoped DB and story integration tests using the repository's guarded disposable database setup.",
      ],
    },
    {
      id: "review-evidence",
      description: "Give the next agent typed gaps and record a review only with valid provenance.",
      status: "pending",
      steps: [
        {
          file: "services/api/src/turns/dispatcher.ts",
          description:
            "Inject acceptance outside transcript clipping. Parse only the final response's terminal review block; retain redaction and bounds.",
          verify: "Both engines receive criteria even after a long conversation or an early-queued review request.",
        },
        {
          file: "services/api/src/turns/git-evidence.ts",
          description:
            "Capture initial dirty state and use initial/final revision evidence to determine eligibility and observed freshness.",
          verify: "Dirty-start/clean-end, changed SHA and unavailable capture cannot establish accepted results.",
        },
        {
          file: "services/api/src/stories/service.ts",
          description:
            "Commit review disposition, evidence event and successful turn completion atomically under the scoped story lock; preserve prior gaps after malformed reviews.",
          verify: "Cancellation, rollback, replay and stale candidate cases never leave false accepted evidence.",
        },
        {
          file: "services/api/src/routes/v1/story-workspaces.ts",
          description:
            "Preserve acceptance_review from the expected-commit manifest when existing agent-edit callers omit it.",
          verify: "Description/model/reasoning edits keep reviewer opt-in; stale expected commits remain rejected.",
        },
        {
          file: "packages/cli/templates/agents/pr-reviewer.md",
          description:
            "Opt the default reviewer in; publish unmet criteria as GitHub review feedback as well as the typed report. Teach address-review to use recorded gaps.",
          verify: "A submitted-review event exercises the existing repair activation; a machine block alone does not claim scheduling.",
        },
      ],
      checks: [
        "Run meaningful report-parser and freshness unit tests plus deterministic turn-dispatcher integration cases.",
        "Cover valid gap → malformed next review, role eligibility, exact criterion coverage, server provenance and cross-story baseline IDs.",
      ],
    },
    {
      id: "surfaces",
      description: "Expose one acceptance record through the existing human and automation interfaces.",
      status: "pending",
      steps: [
        {
          file: "packages/mcp/src/tools.ts",
          description:
            "Add facility_set_story_acceptance and expose the bundle's acceptance projection; regenerate OpenAPI/SDK using the existing command.",
          verify: "MCP and REST share authorization and semantics; do not hand-edit generated SDK declarations.",
        },
        {
          file: "apps/web/components/story/story-acceptance.tsx",
          description:
            "Create a compact baseline editor and criterion-results panel; integrate it into the story page using existing components.",
          verify: "Read-only members can inspect results; authorized idle-story users can set once; merged-with-gaps remains visible.",
        },
        {
          file: "apps/docs/docs/reference/lifecycle.md",
          description:
            "Document acceptance separately from delivery; update operations/manifest/MCP references for opt-in and v1 limitations.",
          verify: "Explain that a typed attestation is not proof of truth and no automatic repair scheduler is introduced.",
        },
      ],
      checks: [
        "Run MCP boundary tests, story component tests and web typecheck.",
        "Exercise mixed, accepted, stale and failed-refresh states without fetching arbitrary reference URLs.",
      ],
    },
    {
      id: "acceptance",
      description: "Independently verify AC1–AC7 through the actual existing review/repair boundaries.",
      status: "pending",
      steps: [
        {
          file: "services/api/test/story-acceptance.integration.test.ts",
          description:
            "Create the deterministic journey: baseline → review gap → submitted-review trigger → repair/new revision → complete review → merge.",
          verify: "Also merge with an unresolved criterion and show delivery done while acceptance still has a gap.",
        },
        {
          file: "docs/testing.md",
          description:
            "Follow required verification, obtain independent diff/behavior review and run the Docker workspace tier when the execution-boundary policy applies.",
          verify: "Run pnpm verify and applicable workspace acceptance; unavailable checks remain unresolved rather than passed.",
        },
      ],
      checks: [
        "Independently compare the implemented behavior with AC1–AC7 and the full contract.",
        "pnpm verify",
        "Apply docs/testing.md's Docker-backed workspace E2E policy to changed dispatcher/Git-capture boundaries.",
      ],
    },
  ],
  checks: [],
  findings: [],
  limitations: [
    "This is a backlog planning example, not an implemented or accepted feature.",
    "Planned task checks are intentions; top-level checks will contain actual observed results only after execution.",
    "The local example types do not enforce runtime uniqueness, truthful observations or the full done-state contract.",
  ],
} satisfies BacklogPhaseExample;
