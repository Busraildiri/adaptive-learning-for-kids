export type ReviewStatus = "pending" | "approved" | "rejected" | "expired";

export interface ReviewItem {
  id: string;
  request_id: string;
  story_id: string;
  story_version: number;
  content_version: string;
  status: ReviewStatus;
  suspicion_reasons: string[];
  story: Record<string, unknown> | null;
  queued_at: string;
  expires_at: string;
  decided_at: string | null;
}

export function pendingReviewItems(items: ReviewItem[]): ReviewItem[] {
  return items.filter((item) => item.status === "pending");
}

export function daysUntilExpiry(expiresAt: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}

export function storyTitle(item: ReviewItem): string {
  const title = item.story?.title;
  return typeof title === "string" && title.trim() ? title : item.story_id;
}
