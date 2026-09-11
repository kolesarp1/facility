/** Portable planning example; no Roadmap runtime dependency or claimed check results. */
type CriterionId = "AC1" | "AC2" | "AC3" | "AC4";
type TaskId = "contract" | "evidence" | "review";
type Plan = {
  schemaVersion: 1;
  phase: number;
  name: string;
  status: "backlog";
  intent: string;
  dependsOn: number[];
  tasks: Array<{
    id: TaskId;
    description: string;
    status: "pending";
    steps: Array<{ file: string; description: string; verify: string }>;
    checks: string[];
  }>;
  checks: [];
  findings: [];
  limitations: string[];
  extensions: {
    facilityPlan: {
      acceptance: Record<CriterionId, { outcome: string; tasks: TaskId[] }>;
      deferred: string[];
    };
  };
};
export default {
  schemaVersion: 1,
  phase: 1,
  name: "Typed acceptance review evidence",
  status: "backlog",
  intent: "Retain reviewer assertions per explicit criterion in existing run evidence.",
  dependsOn: [],
  tasks: [
    {
      id: "contract",
      description: "Define and validate a bounded acceptance-review report.",
      status: "pending",
      steps: [{ file: "packages/agents/src/acceptance-review.ts", description: "Strict Zod schema and terminal final-response parser.", verify: "Unit tests reject malformed, ambiguous and oversized reports." }],
      checks: ["pnpm --filter @facility/agents test"],
    },
    {
      id: "evidence",
      description: "Retain and present reports through existing turn events.",
      status: "pending",
      steps: [{ file: "services/api/src/turns/dispatcher.ts", description: "Record redacted final-response evidence with server-owned run provenance.", verify: "Fake-engine integration and activity projection tests." }],
      checks: ["Dispatcher integration tests with local Postgres", "Turn activity unit tests"],
    },
    {
      id: "review",
      description: "Document the reviewer contract and independently verify the outcome.",
      status: "pending",
      steps: [{ file: "packages/cli/templates/agents/pr-reviewer.md", description: "Report explicit criterion outcomes while preserving GitHub feedback.", verify: "Independent review against AC1–AC4 and pnpm verify." }],
      checks: ["pnpm verify", "Independent implementation review"],
    },
  ],
  checks: [],
  findings: [],
  limitations: ["Planning example only; executed verification is recorded separately.", "Reports are agent assertions, not authoritative story acceptance."],
  extensions: {
    facilityPlan: {
      acceptance: {
        AC1: { outcome: "One met and one unmet criterion are retained and visible with evidence.", tasks: ["contract", "evidence"] },
        AC2: { outcome: "Malformed reports never appear valid or fail otherwise successful work.", tasks: ["contract", "evidence"] },
        AC3: { outcome: "Final-output-only, scoped, redacted evidence; legacy runs unchanged.", tasks: ["evidence"] },
        AC4: { outcome: "Reviewer preserves actionable GitHub feedback and existing repair triggers.", tasks: ["review"] },
      },
      deferred: ["Immutable original baseline and coverage enforcement", "Authoritative acceptance and revision freshness", "Automatic bounded review/repair continuation"],
    },
  },
} satisfies Plan;
