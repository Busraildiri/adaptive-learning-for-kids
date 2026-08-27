import { describe, expect, it } from "vitest";
import { daysUntilExpiry, pendingReviewItems, type ReviewItem, storyTitle } from "./reviewQueue";

const item = (status: ReviewItem["status"]): ReviewItem => ({
  id: status,
  request_id: `request-${status}`,
  story_id: "mino-story",
  story_version: 1,
  content_version: "1.0.0",
  status,
  suspicion_reasons: ["low_confidence"],
  story: { title: "Mino'nun Hikâyesi" },
  queued_at: "2026-08-27T00:00:00.000Z",
  expires_at: "2026-09-11T00:00:00.000Z",
  decided_at: null,
});

describe("review queue presentation", () => {
  it("shows only pending items in the active queue", () => {
    expect(pendingReviewItems([item("approved"), item("pending"), item("expired")])).toHaveLength(
      1,
    );
  });

  it("calculates whole remaining review days without going negative", () => {
    expect(daysUntilExpiry("2026-09-11T00:00:00.000Z", new Date("2026-09-10T01:00:00.000Z"))).toBe(
      1,
    );
    expect(daysUntilExpiry("2026-09-09T00:00:00.000Z", new Date("2026-09-10T00:00:00.000Z"))).toBe(
      0,
    );
  });

  it("falls back to story id when erased content has no title", () => {
    expect(storyTitle({ ...item("rejected"), story: null })).toBe("mino-story");
  });
});
