export type SceneEmotion = "happy" | "sad" | "angry" | "scared" | "neutral";

export interface SceneGenerationSpec {
  sceneId: string;
  storyId: string;
  characterId?: string;
  emotion: SceneEmotion;
  event: string;
  narration: string;
  visualPrompt: string;
  duration: number;
}

export type MediaKind = "image" | "video" | "audio";
export type AudioRole = "question" | "choice";

export type MediaMode = "local_animation" | "static_image";
export type ImageQuality = "low" | "medium" | "high" | "auto";

export interface MediaGenerationInput {
  scene: SceneGenerationSpec;
  mode: MediaMode;
  aspectRatio: string;
  imagePath?: string;
  imageProvider?: string;
  imageModel?: string;
  imageQuality?: ImageQuality;
  imageSize?: string;
  voiceModel?: string;
}

export interface StoryVideoInput {
  storyId: string;
  title: string;
  scenes: SceneGenerationSpec[];
  mode: MediaMode;
  aspectRatio: string;
  characterDescription?: string;
  visualStyle?: string;
  imagePaths?: Record<string, string>;
  imageProvider?: string;
  imageModel?: string;
  imageQuality?: ImageQuality;
  imageSize?: string;
  voiceModel?: string;
}

// The audio counterpart of MediaGenerationInput -- immutable render input
// for one decision question/option audio job. `text` is the frozen,
// approved narration/label captured at job-creation time; the worker never
// looks the Story back up to re-derive it. Mirrors
// services/media-worker/media_worker/render_manifest.py's DecisionAudioInput.
export interface DecisionAudioRenderManifest {
  kind: "decision_audio";
  text: string;
  decisionClipId: string;
  audioRole: AudioRole;
  choiceId?: string;
  voiceModel?: string;
}

export interface MediaGenerationResult {
  kind: MediaKind;
  assetUri: string;
  mimeType: string;
  durationMs?: number;
  width?: number;
  height?: number;
}

export type MediaJobStatus =
  | "queued"
  | "generating_audio"
  | "planning_scenes"
  | "generating_visuals"
  | "rendering"
  | "uploading"
  | "ready"
  | "failed";

export interface MediaJob {
  id: string;
  storyId: string;
  sceneId?: string;
  provider: string;
  mode: MediaMode;
  renderManifest: MediaGenerationInput | DecisionAudioRenderManifest;
  // Phase 4: graph-aware fields. Undefined/absent on legacy single-scene
  // jobs (graphId null), which keep working exactly as before.
  graphId?: string;
  mediaKind: MediaKind;
  audioRole?: AudioRole;
  choiceId?: string;
  // Durable object-storage identity (Phase 3's deterministic path). asset_url
  // is a signed URL and may be stale/expired -- never treat it as durable;
  // for graph jobs it is not written at all (see the signed-url route).
  storagePath?: string;
  renderId?: string;
  status: MediaJobStatus;
  progress: number;
  assetUrl?: string;
  error?: string;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaJobInput {
  storyId: string;
  sceneId?: string;
  provider: string;
  mode: MediaMode;
  renderManifest: MediaGenerationInput | DecisionAudioRenderManifest;
  graphId?: string;
  mediaKind?: MediaKind;
  audioRole?: AudioRole;
  choiceId?: string;
}

// Mirrors get_story_media_readiness()'s RETURNS TABLE (Phase 4). Always
// re-derived from live clip/choice-audio state -- never a stored aggregate,
// so this type is a read result, never something the Studio persists itself.
export interface StoryMediaReadiness {
  totalClips: number;
  readyClips: number;
  failedClips: number;
  pendingClips: number;
  totalChoiceAudio: number;
  readyChoiceAudio: number;
  failedChoiceAudio: number;
  pendingChoiceAudio: number;
}
