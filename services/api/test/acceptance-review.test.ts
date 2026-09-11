import { AcceptanceReviewSchema } from "@facility/agents";
import { describe, expect, it } from "vitest";
import { acceptanceReviewEvent } from "../src/turns/acceptance-review.js";
import { ACTIVITY_TEXT_LIMIT, presentTurnEvent } from "../src/turns/activity.js";

const wrap = (criteria: unknown[]) =>
  `<facility-acceptance-review>${JSON.stringify({ schemaVersion: 1, criteria })}</facility-acceptance-review>`;
const criterion = {
  id: "AC1",
  criterion: "Saved bookmarks persist.",
  status: "met",
  evidence: "Refreshed; bookmark persisted.",
};
const present = (item: NonNullable<ReturnType<typeof acceptanceReviewEvent>>) =>
  presentTurnEvent({ ...item, seq: 3, turnId: "turn_review", createdAt: new Date() });

describe("acceptance review evidence", () => {
  it("shows mixed observations and run provenance through existing activity", () => {
    const event = acceptanceReviewEvent(
      wrap([
        criterion,
        { ...criterion, id: "AC2", status: "unmet", evidence: "Cannot reach Save with Tab." },
      ]),
      [],
    );
    expect(event).not.toBeNull();
    if (!event) throw new Error("expected report");
    expect(present(event)).toMatchObject({
      turn_id: "turn_review",
      kind: "result",
      title: "Acceptance review (agent-reported)",
      truncated: false,
    });
    expect(present(event).text).toContain("AC1 — met: Saved bookmarks persist.");
    expect(present(event).text).toContain("AC2 — unmet:");
    expect(present(event).text).toContain("Cannot reach Save with Tab.");
  });
  it("redacts narrative strings without changing protocol literals", () => {
    const event = acceptanceReviewEvent(
      wrap([{ ...criterion, evidence: "Token secret-value", criterion: "secret-value" }]),
      ["secret-value", "met"],
    );
    expect(JSON.stringify(event)).not.toContain("secret-value");
    expect(event?.data).toMatchObject({
      criteria: [{ status: "met", criterion: "[REDACTED]", evidence: "Token [REDACTED]" }],
    });
  });
  it("diagnoses reports that cannot retain valid structure after redaction", () => {
    expect(
      acceptanceReviewEvent(wrap([{ ...criterion, evidence: "x".repeat(1024) }]), ["x"])?.type,
    ).toBe("acceptance.review_invalid");
  });
  it("retains a largest-field report intact while bounding its activity preview", () => {
    const criteria = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`.padEnd(80, "a"),
      criterion: "c".repeat(512),
      status: "unverified",
      evidence: "e".repeat(1024),
    }));
    const event = acceptanceReviewEvent(wrap(criteria), ["absent-secret"]);
    expect(event?.type).toBe("acceptance.review_reported");
    expect(event?.data).toEqual({ schemaVersion: 1, criteria });
    expect(AcceptanceReviewSchema.safeParse(event?.data).success).toBe(true);
    if (!event) throw new Error("expected report");
    expect(present(event).truncated).toBe(true);
    expect(present(event).text?.length).toBeLessThanOrEqual(ACTIVITY_TEXT_LIMIT + 1);
  });
  it("does not present corrupted storage as valid evidence", () => {
    expect(
      presentTurnEvent({
        seq: 1,
        turnId: "turn_review",
        createdAt: new Date(),
        type: "acceptance.review_reported",
        data: {},
      }).title,
    ).toBe("Invalid acceptance review");
  });
  it("does not include malformed payloads in diagnostics or break unstructured output", () => {
    const event = acceptanceReviewEvent("<facility-acceptance-review>secret-value", [
      "secret-value",
    ]);
    expect(event?.type).toBe("acceptance.review_invalid");
    expect(JSON.stringify(event)).not.toContain("secret-value");
    expect(acceptanceReviewEvent("No structured criteria supplied.", [])).toBeNull();
  });
});
