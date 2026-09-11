import {
  ACCEPTANCE_REVIEW_MAX_CHARS,
  AcceptanceReviewSchema,
  parseAcceptanceReview,
} from "@facility/agents";
import { redactString } from "./redaction.js";

/** No lifecycle authority: any agent may report observations under its own run. */
export function acceptanceReviewEvent(output: string, secrets: string[]) {
  const result = parseAcceptanceReview(output);
  if (result.kind === "absent") return null;
  if (result.kind === "report") {
    // Redact narrative fields, preserving protocol literals and structural keys.
    const report = {
      schemaVersion: result.report.schemaVersion,
      criteria: result.report.criteria.map((item) => ({
        id: redactString(item.id, secrets),
        criterion: redactString(item.criterion, secrets),
        status: item.status,
        evidence: redactString(item.evidence, secrets),
      })),
    };
    if (
      JSON.stringify(report).length <= ACCEPTANCE_REVIEW_MAX_CHARS &&
      AcceptanceReviewSchema.safeParse(report).success
    ) {
      return { type: "acceptance.review_reported", data: report };
    }
  }
  // Never include malformed payloads or parser errors in the diagnostic.
  return {
    type: "acceptance.review_invalid",
    data: {
      reason:
        "Acceptance review could not be validated or safely retained. See the final response.",
    },
  };
}
