"use client";

import { storySchema } from "@adaptive/content-schema";
import { storyNarratives } from "../../lib/storyCopy";
import type { ReviewItem } from "../../lib/reviewQueue";
import { StoryCopyList } from "./StoryCopyList";

/** The Studio's mandatory human-review gate (Phase 5 Decision 1). Reuses
 * content_review_queue as-is -- Draft/Needs Review/Approved/Rejected map
 * 1:1 onto the existing 'pending'/'approved'/'rejected'/'expired' backend
 * states, no second approval state machine. Purely presentational: the
 * queue fetch and decide_content_review call live in
 * ContentProductionStudio, which is also the thing deriving the overall
 * pipeline stage from the same data -- one fetch, one source of truth.
 *
 * Phase 5 Decision 5: only Approve is offered here. The existing
 * decide_content_review('rejected') call is destructive (erases the story
 * body) and is intentionally NOT exposed as a primary Studio action --
 * that capability still exists in the legacy review workspace for
 * backward compatibility, but this card never calls it. */
export function StoryReviewCard({
  item,
  busy,
  error,
  onApprove,
}: {
  item: ReviewItem;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
}) {
  const parsedStory = item.story ? storySchema.safeParse(item.story) : null;
  const story = parsedStory?.success ? parsedStory.data : null;

  return (
    <section className="story-review-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">İNCELEME BEKLİYOR</p>
          <h2>{story?.title ?? item.story_id}</h2>
        </div>
      </div>
      {story ? (
        <div className="story-review-preview">
          <div className="review-story-copy">
            <p className="review-greeting">{story.greetingTemplate}</p>
            <StoryCopyList narratives={storyNarratives(story)} />
            <p className="generation-help">
              Yaş aralığı: {story.ageBands.join(", ")} · Hedef beceriler:{" "}
              {story.targetSkills.join(", ")}
            </p>
          </div>
        </div>
      ) : (
        <p className="alert">Hikâye taslağı bu ekranda çözümlenemedi.</p>
      )}
      <details className="technical-story-json">
        <summary>Teknik JSON’u göster</summary>
        <pre>{JSON.stringify(item.story, null, 2)}</pre>
      </details>
      {error ? <p className="alert">{error}</p> : null}
      <div className="decision-bar">
        <button className="primary" disabled={busy || !story} onClick={onApprove} type="button">
          {busy ? "Onaylanıyor…" : "Onayla ve Devam Et"}
        </button>
      </div>
      <p className="generation-help">
        Bu ekranda yalnızca onay sunulur. Reddetme gerekiyorsa mevcut İnceleme Kuyruğu
        ekranı üzerinden yapılabilir.
      </p>
    </section>
  );
}
