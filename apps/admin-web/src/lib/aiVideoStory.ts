import type { SceneEmotion } from "./media/types";

export const CHARACTER_NAME_TOKEN = "{{characterName}}";

export const AI_VIDEO_HELP_ACTIONS = [
  "hug",
  "new_balloon",
  "pet_head",
  "say_love",
  "give_gift",
] as const;

export type AiVideoHelpAction = (typeof AI_VIDEO_HELP_ACTIONS)[number];
export type AiVideoTargetEmotion = Exclude<SceneEmotion, "happy" | "neutral">;

export interface AiVideoGenerationRequest {
  characterPrompt: string;
  storyPrompt: string;
}

export interface AiVideoScenePlan {
  event: string;
  narration: string;
  visualPrompt: string;
  duration: number;
}

// introSetup is the one scene whose emotional starting point genuinely
// varies by story (a story can open already sad/hungry, not always happy)
// -- the AI must say what it is so the image-generation prompt matches,
// rather than the app forcing "happy" on every story.
export interface AiVideoIntroSetupScenePlan extends AiVideoScenePlan {
  emotion: SceneEmotion;
}

export interface AiVideoEmotionOption {
  emotion: Exclude<SceneEmotion, "neutral">;
  label: string;
  feedback: string;
}

export interface AiVideoHelpOptionTemplate {
  action: AiVideoHelpAction;
  label: string;
  acknowledgement: string;
  ending: AiVideoScenePlan;
}

export interface AiVideoStoryPlanTemplate {
  nameCandidates: string[];
  title: string;
  characterDescription: string;
  visualStyle: string;
  settingDescription: string;
  targetEmotion: AiVideoTargetEmotion;
  // Split into two clips (not one) so each gets its own accurate visual:
  // one static image per HyperFrames clip can't depict an emotional
  // transition. introSetup's own emotion varies by story (not always
  // happy); introIncident is where the event happens and ends on the held
  // emotional frame (targetEmotion) the question screens sit behind.
  introSetup: AiVideoIntroSetupScenePlan;
  introIncident: AiVideoScenePlan;
  emotionQuestion: {
    question: string;
    options: [AiVideoEmotionOption, AiVideoEmotionOption];
    explanation: string;
  };
  helpQuestion: {
    question: string;
    options: [AiVideoHelpOptionTemplate, AiVideoHelpOptionTemplate];
  };
}

export interface AiVideoStoryPlan extends Omit<AiVideoStoryPlanTemplate, "nameCandidates"> {
  storyId: string;
  characterName: string;
}

export interface AiVideoPlaybackClip {
  id: string;
  kind: "linear" | "decision" | "ending";
  sourceSceneId: string;
  role?: string;
  nextClipId?: string;
  choice?: {
    question: string;
    options: Array<{ id: string; label: string; nextClipId: string }>;
  };
}

export interface AiVideoMediaJobSpec {
  sceneId: string;
  mediaKind: "video" | "audio";
  audioRole?: "question" | "choice";
  choiceId?: string;
  narration: string;
  event: string;
  visualPrompt: string;
  emotion: SceneEmotion;
  duration: number;
}

export interface AiVideoPlaybackGraphRpcInput {
  target_story_id: string;
  target_story_version: number;
  target_source_request_id: null;
  target_start_clip_id: string;
  target_clips: AiVideoPlaybackClip[];
}

const BASELINE_USED_CHARACTER_NAMES = [
  "Mino",
  "Mırmır",
  "Noni",
  "Lila",
  "Pati",
  "Tomo",
  "Duru",
  "Bobi",
  "Pofi",
  "Nino",
  "Maya",
  "Riko",
  "Zuzu",
  "Kiki",
  "Lina",
] as const;

export const baselineUsedCharacterNames: readonly string[] = BASELINE_USED_CHARACTER_NAMES;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new Error(`${field} metin olmalı.`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} ${min}-${max} karakter arasında olmalı.`);
  }
  return normalized;
}

function boundedDuration(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 4 || value > 12) {
    throw new Error(`${field} 4-12 saniye arasında olmalı.`);
  }
  return Math.round(value);
}

function parseScene(value: unknown, field: string): AiVideoScenePlan {
  if (!isRecord(value)) throw new Error(`${field} geçersiz.`);
  return {
    event: boundedString(value.event, `${field}.event`, 5, 260),
    narration: boundedString(value.narration, `${field}.narration`, 5, 320),
    visualPrompt: boundedString(value.visualPrompt, `${field}.visualPrompt`, 20, 900),
    duration: boundedDuration(value.duration, `${field}.duration`),
  };
}

function parseSceneEmotion(value: unknown, field: string): SceneEmotion {
  if (
    value !== "happy" &&
    value !== "sad" &&
    value !== "angry" &&
    value !== "scared" &&
    value !== "neutral"
  ) {
    throw new Error(`${field} desteklenmeyen duygu içeriyor.`);
  }
  return value;
}

function parseIntroSetupScene(value: unknown, field: string): AiVideoIntroSetupScenePlan {
  if (!isRecord(value)) throw new Error(`${field} geçersiz.`);
  return {
    ...parseScene(value, field),
    emotion: parseSceneEmotion(value.emotion, `${field}.emotion`),
  };
}

function parseEmotion(value: unknown, field: string): Exclude<SceneEmotion, "neutral"> {
  if (value !== "happy" && value !== "sad" && value !== "angry" && value !== "scared") {
    throw new Error(`${field} desteklenmeyen duygu içeriyor.`);
  }
  return value;
}

function parseTargetEmotion(value: unknown): AiVideoTargetEmotion {
  if (value !== "sad" && value !== "angry" && value !== "scared") {
    throw new Error("targetEmotion üzgün, kızgın veya korkmuş olmalı.");
  }
  return value;
}

function parseHelpAction(value: unknown): AiVideoHelpAction {
  if (!AI_VIDEO_HELP_ACTIONS.includes(value as AiVideoHelpAction)) {
    throw new Error("Yardım seçeneği izin verilen eylem havuzunda değil.");
  }
  return value as AiVideoHelpAction;
}

function exactPair(value: unknown, field: string): [unknown, unknown] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${field} tam olarak iki seçenek içermeli.`);
  }
  return [value[0], value[1]];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceCandidateNameReferences<T>(value: T, candidates: string[]): T {
  if (typeof value === "string") {
    let result: string = value;
    for (const candidate of [...candidates].sort((left, right) => right.length - left.length)) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(candidate)}(?![\\p{L}\\p{N}])`,
        "giu",
      );
      result = result.replace(pattern, CHARACTER_NAME_TOKEN);
    }
    return result as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceCandidateNameReferences(item, candidates)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        replaceCandidateNameReferences(child, candidates),
      ]),
    ) as T;
  }
  return value;
}

export function normalizeCharacterName(value: string): string {
  return value
    .trim()
    .replace(/[ÇĞİIÖŞÜçğııöşü]/gu, (character) => {
      const map: Record<string, string> = {
        Ç: "C",
        Ğ: "G",
        İ: "I",
        I: "I",
        Ö: "O",
        Ş: "S",
        Ü: "U",
        ç: "c",
        ğ: "g",
        ı: "i",
        i: "i",
        ö: "o",
        ş: "s",
        ü: "u",
      };
      return map[character] ?? character;
    })
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, "");
}

export function parseAiVideoGenerationRequest(value: unknown): AiVideoGenerationRequest {
  if (!isRecord(value)) throw new Error("Geçersiz üretim isteği.");
  return {
    characterPrompt: boundedString(value.characterPrompt, "Karakter promptu", 20, 600),
    storyPrompt: boundedString(value.storyPrompt, "Hikâye fikri", 20, 600),
  };
}

export function parseAiVideoStoryPlanTemplate(value: unknown): AiVideoStoryPlanTemplate {
  if (!isRecord(value)) throw new Error("AI hikâye planı geçersiz.");
  if (!Array.isArray(value.nameCandidates) || value.nameCandidates.length !== 8) {
    throw new Error("AI tam olarak sekiz karakter adı adayı üretmeli.");
  }
  const normalizedCandidates = new Set<string>();
  const nameCandidates = value.nameCandidates.map((candidate, index) => {
    const name = boundedString(candidate, `nameCandidates[${index}]`, 2, 20);
    if (!/^[A-Za-zÇĞİIÖŞÜçğııöşü]+$/u.test(name)) {
      throw new Error("Karakter adı yalnızca harflerden oluşmalı.");
    }
    const normalized = normalizeCharacterName(name);
    if (normalizedCandidates.has(normalized))
      throw new Error("Karakter adı adayları benzersiz olmalı.");
    normalizedCandidates.add(normalized);
    return name;
  });

  const targetEmotion = parseTargetEmotion(value.targetEmotion);
  const emotionQuestionValue = value.emotionQuestion;
  if (!isRecord(emotionQuestionValue)) throw new Error("emotionQuestion geçersiz.");
  const emotionPair = exactPair(emotionQuestionValue.options, "emotionQuestion.options");
  const emotionOptions = emotionPair.map((option, index): AiVideoEmotionOption => {
    if (!isRecord(option)) throw new Error(`emotionQuestion.options[${index}] geçersiz.`);
    return {
      emotion: parseEmotion(option.emotion, `emotionQuestion.options[${index}].emotion`),
      label: boundedString(option.label, `emotionQuestion.options[${index}].label`, 2, 40),
      feedback: boundedString(
        option.feedback,
        `emotionQuestion.options[${index}].feedback`,
        5,
        260,
      ),
    };
  }) as [AiVideoEmotionOption, AiVideoEmotionOption];
  if (emotionOptions[0].emotion === emotionOptions[1].emotion) {
    throw new Error("Duygu seçenekleri birbirinden farklı olmalı.");
  }
  if (!emotionOptions.some((option) => option.emotion === targetEmotion)) {
    throw new Error("Duygu seçeneklerinden biri hikâyenin hedef duygusu olmalı.");
  }

  const helpQuestionValue = value.helpQuestion;
  if (!isRecord(helpQuestionValue)) throw new Error("helpQuestion geçersiz.");
  const helpPair = exactPair(helpQuestionValue.options, "helpQuestion.options");
  const helpOptions = helpPair.map((option, index): AiVideoHelpOptionTemplate => {
    if (!isRecord(option)) throw new Error(`helpQuestion.options[${index}] geçersiz.`);
    return {
      action: parseHelpAction(option.action),
      label: boundedString(option.label, `helpQuestion.options[${index}].label`, 3, 80),
      acknowledgement: boundedString(
        option.acknowledgement,
        `helpQuestion.options[${index}].acknowledgement`,
        5,
        180,
      ),
      ending: parseScene(option.ending, `helpQuestion.options[${index}].ending`),
    };
  }) as [AiVideoHelpOptionTemplate, AiVideoHelpOptionTemplate];
  if (helpOptions[0].action === helpOptions[1].action) {
    throw new Error("Yardım seçenekleri birbirinden farklı olmalı.");
  }

  const result: AiVideoStoryPlanTemplate = {
    nameCandidates,
    title: boundedString(value.title, "title", 3, 100),
    characterDescription: boundedString(
      value.characterDescription,
      "characterDescription",
      20,
      600,
    ),
    visualStyle: boundedString(value.visualStyle, "visualStyle", 20, 500),
    settingDescription: boundedString(value.settingDescription, "settingDescription", 20, 500),
    targetEmotion,
    introSetup: parseIntroSetupScene(value.introSetup, "introSetup"),
    introIncident: parseScene(value.introIncident, "introIncident"),
    emotionQuestion: {
      question: boundedString(emotionQuestionValue.question, "emotionQuestion.question", 5, 160),
      options: emotionOptions,
      explanation: boundedString(
        emotionQuestionValue.explanation,
        "emotionQuestion.explanation",
        5,
        260,
      ),
    },
    helpQuestion: {
      question: boundedString(helpQuestionValue.question, "helpQuestion.question", 5, 160),
      options: helpOptions,
    },
  };

  const { nameCandidates: preservedCandidates, ...storyContent } = result;
  const normalizedContent = replaceCandidateNameReferences(storyContent, nameCandidates);
  if (!normalizedContent.emotionQuestion.question.includes(CHARACTER_NAME_TOKEN)) {
    normalizedContent.emotionQuestion.question = `${CHARACTER_NAME_TOKEN} nasıl hissediyor?`;
  }
  if (!normalizedContent.helpQuestion.question.includes(CHARACTER_NAME_TOKEN)) {
    normalizedContent.helpQuestion.question = `${CHARACTER_NAME_TOKEN} için ne yapmak istersin?`;
  }
  return { nameCandidates: preservedCandidates, ...normalizedContent };
}

function replaceCharacterName<T>(value: T, characterName: string): T {
  if (typeof value === "string") {
    return value.replaceAll(CHARACTER_NAME_TOKEN, characterName) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceCharacterName(item, characterName)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        replaceCharacterName(child, characterName),
      ]),
    ) as T;
  }
  return value;
}

export function instantiateAiVideoStoryPlan(
  template: AiVideoStoryPlanTemplate,
  characterName: string,
  storyId: string,
): AiVideoStoryPlan {
  const { nameCandidates: _nameCandidates, ...planTemplate } = template;
  return {
    ...replaceCharacterName(planTemplate, characterName),
    storyId,
    characterName,
  };
}

function safeId(value: string): string {
  return normalizeCharacterName(value) || "choice";
}

export function buildAiVideoPlaybackClips(plan: AiVideoStoryPlan): AiVideoPlaybackClip[] {
  const [firstEmotion, secondEmotion] = plan.emotionQuestion.options;
  const [firstHelp, secondHelp] = plan.helpQuestion.options;
  const firstEndingId = `ending-${safeId(firstHelp.action)}`;
  const secondEndingId = `ending-${safeId(secondHelp.action)}`;
  return [
    {
      id: "intro-setup",
      kind: "linear",
      sourceSceneId: "intro-setup",
      role: "setup",
      nextClipId: "intro-event",
    },
    {
      id: "intro-event",
      kind: "linear",
      sourceSceneId: "intro-event",
      role: "incident",
      nextClipId: "emotion-question",
    },
    {
      id: "emotion-question",
      kind: "decision",
      sourceSceneId: "emotion-question",
      role: "emotion_recognition",
      choice: {
        question: plan.emotionQuestion.question,
        options: [firstEmotion, secondEmotion].map((option) => ({
          id: `emotion-${option.emotion}`,
          label: option.label,
          nextClipId: "help-question",
        })),
      },
    },
    {
      id: "help-question",
      kind: "decision",
      sourceSceneId: "help-question",
      role: "support_choice",
      choice: {
        question: plan.helpQuestion.question,
        options: [
          { id: `help-${firstHelp.action}`, label: firstHelp.label, nextClipId: firstEndingId },
          { id: `help-${secondHelp.action}`, label: secondHelp.label, nextClipId: secondEndingId },
        ],
      },
    },
    {
      id: firstEndingId,
      kind: "ending",
      sourceSceneId: firstEndingId,
      role: "resolution",
    },
    {
      id: secondEndingId,
      kind: "ending",
      sourceSceneId: secondEndingId,
      role: "resolution",
    },
  ];
}

export function buildAiVideoPlaybackGraphRpcInput(
  plan: AiVideoStoryPlan,
): AiVideoPlaybackGraphRpcInput {
  return {
    target_story_id: plan.storyId,
    target_story_version: 1,
    // This provenance FK belongs to content_generation_runs, not ai_video_story_requests.
    target_source_request_id: null,
    target_start_clip_id: "intro-setup",
    target_clips: buildAiVideoPlaybackClips(plan),
  };
}

function audioJob(
  sceneId: string,
  audioRole: "question" | "choice",
  narration: string,
  choiceId?: string,
): AiVideoMediaJobSpec {
  return {
    sceneId,
    mediaKind: "audio",
    audioRole,
    choiceId,
    narration,
    event: narration,
    visualPrompt: "Audio-only interactive story narration.",
    emotion: "neutral",
    duration: 6,
  };
}

export function buildAiVideoMediaJobs(plan: AiVideoStoryPlan): AiVideoMediaJobSpec[] {
  const [firstHelp, secondHelp] = plan.helpQuestion.options;
  return [
    {
      sceneId: "intro-setup",
      mediaKind: "video",
      narration: plan.introSetup.narration,
      event: plan.introSetup.event,
      visualPrompt: [plan.settingDescription, plan.introSetup.visualPrompt].join(" "),
      emotion: plan.introSetup.emotion,
      duration: plan.introSetup.duration,
    },
    {
      sceneId: "intro-event",
      mediaKind: "video",
      narration: plan.introIncident.narration,
      event: plan.introIncident.event,
      visualPrompt: [plan.settingDescription, plan.introIncident.visualPrompt].join(" "),
      emotion: plan.targetEmotion,
      duration: plan.introIncident.duration,
    },
    audioJob("emotion-question", "question", plan.emotionQuestion.question),
    ...plan.emotionQuestion.options.map((option) =>
      audioJob(
        "emotion-question",
        "choice",
        `${option.feedback} ${plan.emotionQuestion.explanation}`,
        `emotion-${option.emotion}`,
      ),
    ),
    audioJob("help-question", "question", plan.helpQuestion.question),
    ...plan.helpQuestion.options.map((option) =>
      audioJob("help-question", "choice", option.acknowledgement, `help-${option.action}`),
    ),
    {
      sceneId: `ending-${safeId(firstHelp.action)}`,
      mediaKind: "video",
      narration: firstHelp.ending.narration,
      event: firstHelp.ending.event,
      visualPrompt: [plan.settingDescription, firstHelp.ending.visualPrompt].join(" "),
      emotion: "happy",
      duration: firstHelp.ending.duration,
    },
    {
      sceneId: `ending-${safeId(secondHelp.action)}`,
      mediaKind: "video",
      narration: secondHelp.ending.narration,
      event: secondHelp.ending.event,
      visualPrompt: [plan.settingDescription, secondHelp.ending.visualPrompt].join(" "),
      emotion: "happy",
      duration: secondHelp.ending.duration,
    },
  ];
}

export const aiVideoStoryPlanJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "nameCandidates",
    "title",
    "characterDescription",
    "visualStyle",
    "settingDescription",
    "targetEmotion",
    "introSetup",
    "introIncident",
    "emotionQuestion",
    "helpQuestion",
  ],
  properties: {
    nameCandidates: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 20 },
    },
    title: { type: "string", minLength: 3, maxLength: 100 },
    characterDescription: { type: "string", minLength: 20, maxLength: 600 },
    visualStyle: { type: "string", minLength: 20, maxLength: 500 },
    settingDescription: { type: "string", minLength: 20, maxLength: 500 },
    targetEmotion: { type: "string", enum: ["sad", "angry", "scared"] },
    introSetup: {
      type: "object",
      additionalProperties: false,
      required: ["event", "narration", "visualPrompt", "duration", "emotion"],
      properties: {
        event: { type: "string", minLength: 5, maxLength: 260 },
        narration: { type: "string", minLength: 5, maxLength: 320 },
        visualPrompt: { type: "string", minLength: 20, maxLength: 900 },
        duration: { type: "number", minimum: 4, maximum: 12 },
        emotion: { type: "string", enum: ["happy", "sad", "angry", "scared", "neutral"] },
      },
    },
    introIncident: { $ref: "#/$defs/scene" },
    emotionQuestion: {
      type: "object",
      additionalProperties: false,
      required: ["question", "options", "explanation"],
      properties: {
        question: { type: "string", minLength: 5, maxLength: 160 },
        explanation: { type: "string", minLength: 5, maxLength: 260 },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["emotion", "label", "feedback"],
            properties: {
              emotion: { type: "string", enum: ["happy", "sad", "angry", "scared"] },
              label: { type: "string", minLength: 2, maxLength: 40 },
              feedback: { type: "string", minLength: 5, maxLength: 260 },
            },
          },
        },
      },
    },
    helpQuestion: {
      type: "object",
      additionalProperties: false,
      required: ["question", "options"],
      properties: {
        question: { type: "string", minLength: 5, maxLength: 160 },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "label", "acknowledgement", "ending"],
            properties: {
              action: { type: "string", enum: [...AI_VIDEO_HELP_ACTIONS] },
              label: { type: "string", minLength: 3, maxLength: 80 },
              acknowledgement: { type: "string", minLength: 5, maxLength: 180 },
              ending: { $ref: "#/$defs/scene" },
            },
          },
        },
      },
    },
  },
  $defs: {
    scene: {
      type: "object",
      additionalProperties: false,
      required: ["event", "narration", "visualPrompt", "duration"],
      properties: {
        event: { type: "string", minLength: 5, maxLength: 260 },
        narration: { type: "string", minLength: 5, maxLength: 320 },
        visualPrompt: { type: "string", minLength: 20, maxLength: 900 },
        duration: { type: "number", minimum: 4, maximum: 12 },
      },
    },
  },
};
