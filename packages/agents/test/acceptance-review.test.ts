import { describe, expect, it } from "vitest";
import { AcceptanceReviewSchema, parseAcceptanceReview } from "../src/acceptance-review.js";

const criterion = {
  id: "AC1",
  criterion: "Bookmarks survive refresh.",
  status: "met",
  evidence: "Saved a bookmark and refreshed; it remained visible.",
};
const report = {
  schemaVersion: 1,
  criteria: [
    criterion,
    { ...criterion, id: "AC2", status: "unmet", evidence: "Keyboard focus never reaches Save." },
  ],
};
const wrap = (value: unknown) =>
  `<facility-acceptance-review>\n${JSON.stringify(value)}\n</facility-acceptance-review>`;

describe("acceptance review contract", () => {
  it("preserves mixed results from a terminal report after prose", () => {
    expect(parseAcceptanceReview(`Findings first.\n${wrap(report)}\n`)).toEqual({
      kind: "report",
      report,
    });
  });
  it.each([
    "met",
    "unmet",
    "blocked",
    "unverified",
  ])("supports %s with an explanation", (status) => {
    expect(
      AcceptanceReviewSchema.safeParse({ ...report, criteria: [{ ...criterion, status }] }).success,
    ).toBe(true);
  });
  it.each([
    { ...report, orgId: "forged" },
    { ...report, schemaVersion: 2 },
    { ...report, criteria: [] },
    { ...report, criteria: [criterion, criterion] },
    { ...report, criteria: [criterion, { ...criterion, id: " AC1 " }] },
    { ...report, criteria: [{ ...criterion, status: "accepted" }] },
    { ...report, criteria: [{ ...criterion, evidence: " " }] },
    { ...report, criteria: [{ ...criterion, criterion: "x".repeat(513) }] },
    { ...report, criteria: [{ ...criterion, evidence: "x".repeat(1025) }] },
    { ...report, criteria: [{ ...criterion, id: "x".repeat(81) }] },
    { ...report, criteria: [{ ...criterion, reviewerId: "forged" }] },
    { ...report, criteria: Array.from({ length: 21 }, (_, i) => ({ ...criterion, id: `AC${i}` })) },
  ])("rejects invalid shape %#", (value) => {
    expect(parseAcceptanceReview(wrap(value))).toEqual({ kind: "invalid" });
  });
  it.each([
    "<facility-acceptance-review>{bad json}</facility-acceptance-review>",
    "<facility-acceptance-review>{}",
    "</facility-acceptance-review>",
    `${wrap(report)}\n${wrap(report)}`,
    `${wrap(report)}\nMore prose`,
    `<facility-acceptance-review>${" ".repeat(48_001)}${JSON.stringify(report)}</facility-acceptance-review>`,
    `<facility-acceptance-review>${" ".repeat(48_000)}</facility-acceptance-review malformed>`,
    `Inline ${wrap(report)}`,
    `\`\`\`json\n${wrap(report)}\n\`\`\``,
    `<facility-acceptance-review>${" ".repeat(49_000)}{}</facility-acceptance-review>`,
  ])("rejects malformed or ambiguous envelopes %#", (output) => {
    expect(parseAcceptanceReview(output)).toEqual({ kind: "invalid" });
  });
  it("leaves ordinary output alone", () => {
    expect(parseAcceptanceReview("Review complete, see GitHub findings.")).toEqual({
      kind: "absent",
    });
  });
});
