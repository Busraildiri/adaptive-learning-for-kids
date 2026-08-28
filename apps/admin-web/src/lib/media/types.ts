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

export type MediaKind = "image" | "video";

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
  renderManifest: MediaGenerationInput;
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
  renderManifest: MediaGenerationInput;
}
