import { z } from "zod";

export const ACCEPTANCE_REVIEW_MAX_CHARS = 48_000;

/** Agent observations only: this schema does not establish authoritative acceptance. */
export const AcceptanceReviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    criteria: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(80),
            criterion: z.string().trim().min(1).max(512),
            status: z.enum(["met", "unmet", "blocked", "unverified"]),
            evidence: z.string().trim().min(1).max(1_024),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (report) => new Set(report.criteria.map((item) => item.id)).size === report.criteria.length,
    {
      message: "Criterion IDs must be unique",
    },
  );

export type AcceptanceReview = z.infer<typeof AcceptanceReviewSchema>;
export type AcceptanceReviewResult =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "report"; report: AcceptanceReview };

/** Call with final output, never progress or transcript text. Keep prose untouched. */
export function parseAcceptanceReview(output: string): AcceptanceReviewResult {
  const open = "<facility-acceptance-review";
  const close = "</facility-acceptance-review";
  if (!output.includes(open) && !output.includes(close)) return { kind: "absent" };
  if (output.split(open).length !== 2 || output.split(close).length !== 2) {
    return { kind: "invalid" };
  }
  const openTag = `${open}>`;
  const closeTag = `${close}>`;
  const start = output.indexOf(openTag);
  const end = output.indexOf(closeTag);
  if (
    start < 0 ||
    (start > 0 && output[start - 1] !== "\n") ||
    end < start + openTag.length ||
    output.slice(end + closeTag.length).trim() !== ""
  ) {
    return { kind: "invalid" };
  }
  const payload = output.slice(start + openTag.length, end);
  if (payload.length > ACCEPTANCE_REVIEW_MAX_CHARS) return { kind: "invalid" };
  try {
    const parsed = AcceptanceReviewSchema.safeParse(JSON.parse(payload));
    return parsed.success ? { kind: "report", report: parsed.data } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}
