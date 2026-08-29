import { describe, expect, it } from "vitest";
import {
  buildAiVideoMediaJobs,
  buildAiVideoPlaybackClips,
  buildAiVideoPlaybackGraphRpcInput,
  instantiateAiVideoStoryPlan,
  normalizeCharacterName,
  parseAiVideoGenerationRequest,
  parseAiVideoStoryPlanTemplate,
} from "./aiVideoStory";

const validTemplate = {
  nameCandidates: ["Pofik", "Tombi", "Zıpır", "Lokum", "Tarçın", "Boncuk", "Fındık", "Minik"],
  title: "{{characterName}} ve Kırmızı Balon",
  characterDescription:
    "A small round orange kitten with large green eyes, a purple collar and consistent proportions.",
  visualStyle:
    "Soft polished 3D children's animation with rounded shapes and gentle warm lighting.",
  settingDescription:
    "A sunny flower-filled neighborhood park with one wooden bench and soft grass.",
  targetEmotion: "sad",
  introSetup: {
    event: "Balonla oynar.",
    narration: "{{characterName}} kırmızı balonuyla neşeyle oynuyor.",
    visualPrompt: "The same orange kitten happily plays with a red balloon string, smiling.",
    duration: 6,
    emotion: "happy",
  },
  introIncident: {
    event: "Balon oynarken patlar.",
    narration: "Pat! Balonu patladı ve {{characterName}} üzgün görünüyor.",
    visualPrompt:
      "The same orange kitten sits safely beside the string of a popped red balloon, visibly sad.",
    duration: 6,
  },
  emotionQuestion: {
    question: "{{characterName}} nasıl hissediyor olabilir?",
    options: [
      { emotion: "sad", label: "Üzgün", feedback: "Üzgün olabileceğini düşündün." },
      {
        emotion: "scared",
        label: "Korkmuş",
        feedback: "Patlama sesinden korkmuş olabileceğini düşündün.",
      },
    ],
    explanation: "Bu hikâyede balonu patladığı için üzgün hissediyor.",
  },
  helpQuestion: {
    question: "{{characterName}} için ne yapmak istersin?",
    options: [
      {
        action: "new_balloon",
        label: "{{characterName}} için yeni bir balon ver",
        acknowledgement: "Yeni bir balon vermeyi seçtin. Haydi yardım edelim.",
        ending: {
          event: "Yeni bir balon verilir.",
          narration: "{{characterName}} yeni balonunu aldı ve yeniden gülümsedi.",
          visualPrompt: "The same kitten receives a new red balloon and smiles with relief.",
          duration: 6,
        },
      },
      {
        action: "pet_head",
        label: "{{characterName}} karakterinin başını okşa",
        acknowledgement: "Başını okşamayı seçtin. Haydi yanında olalım.",
        ending: {
          event: "Başı nazikçe okşanır.",
          narration: "{{characterName}} başı okşanınca rahatladı ve gülümsedi.",
          visualPrompt: "A gentle hand pets the same kitten's head and the kitten smiles calmly.",
          duration: 6,
        },
      },
    ],
  },
};

describe("AI video story planning", () => {
  it("accepts only two bounded prompts", () => {
    expect(
      parseAiVideoGenerationRequest({
        characterPrompt: "Mor tasmalı turuncu yavru kedi oluştur.",
        storyPrompt: "Parkta kırmızı balonuyla oynarken balonu patlasın.",
      }),
    ).toMatchObject({ characterPrompt: expect.stringContaining("turuncu") });
  });

  it("normalizes Turkish spelling variants into one name identity", () => {
    expect(normalizeCharacterName("Mırmır")).toBe("mirmir");
    expect(normalizeCharacterName("MIRMIR")).toBe("mirmir");
    expect(normalizeCharacterName("Mirmir")).toBe("mirmir");
  });

  it("parses a two-stage story and never accepts breathing as a help action", () => {
    const parsed = parseAiVideoStoryPlanTemplate(validTemplate);
    expect(parsed.helpQuestion.options.map((option) => option.action)).toEqual([
      "new_balloon",
      "pet_head",
    ]);
    expect(() =>
      parseAiVideoStoryPlanTemplate({
        ...validTemplate,
        helpQuestion: {
          ...validTemplate.helpQuestion,
          options: [
            { ...validTemplate.helpQuestion.options[0], action: "breathe" },
            validTemplate.helpQuestion.options[1],
          ],
        },
      }),
    ).toThrow("izin verilen eylem");
  });

  it("repairs missing internal name tokens instead of exposing a validation error", () => {
    const parsed = parseAiVideoStoryPlanTemplate({
      ...validTemplate,
      title: "Kırmızı Top Çalılarda",
      emotionQuestion: {
        ...validTemplate.emotionQuestion,
        question: "Sence köpek nasıl hissediyor?",
      },
      helpQuestion: {
        ...validTemplate.helpQuestion,
        question: "Köpeğe nasıl yardım etmek istersin?",
        options: validTemplate.helpQuestion.options.map((option) => ({
          ...option,
          label: option.action === "new_balloon" ? "Yeni bir top ver" : "Başını okşa",
        })),
      },
    });

    expect(parsed.title).toBe("Kırmızı Top Çalılarda");
    expect(parsed.helpQuestion.options.map((option) => option.label)).toEqual([
      "Yeni bir top ver",
      "Başını okşa",
    ]);
    expect(parsed.emotionQuestion.question).toContain("{{characterName}}");
    expect(parsed.helpQuestion.question).toContain("{{characterName}}");
  });

  it("replaces leaked candidate names with the finally reserved character name", () => {
    const parsed = parseAiVideoStoryPlanTemplate({
      ...validTemplate,
      title: "Pofik ve Kırmızı Balon",
      introSetup: {
        ...validTemplate.introSetup,
        narration: "Pofik kırmızı balonuyla neşeyle oynuyor.",
      },
    });
    const plan = instantiateAiVideoStoryPlan(parsed, "Sufi", "sufi-interactive-12345678");

    expect(plan.title).toBe("Sufi ve Kırmızı Balon");
    expect(plan.introSetup.narration).toContain("Sufi");
    expect(JSON.stringify(plan)).not.toContain("Pofik");
  });

  it("creates two converging emotion choices and two branching help endings", () => {
    const plan = instantiateAiVideoStoryPlan(
      parseAiVideoStoryPlanTemplate(validTemplate),
      "Pofik",
      "pofik-interactive-12345678",
    );
    const clips = buildAiVideoPlaybackClips(plan);
    const decisions = clips.filter((clip) => clip.kind === "decision");
    expect(decisions).toHaveLength(2);
    expect(decisions[0]?.choice?.options.map((option) => option.nextClipId)).toEqual([
      "help-question",
      "help-question",
    ]);
    expect(new Set(decisions[1]?.choice?.options.map((option) => option.nextClipId)).size).toBe(2);
    expect(JSON.stringify(plan)).not.toContain("{{characterName}}");
  });

  it("does not send the AI request id to the unrelated graph provenance foreign key", () => {
    const plan = instantiateAiVideoStoryPlan(
      parseAiVideoStoryPlanTemplate(validTemplate),
      "Pofik",
      "pofik-interactive-12345678",
    );

    const input = buildAiVideoPlaybackGraphRpcInput(plan);
    expect(input.target_source_request_id).toBeNull();
    expect(input.target_story_id).toBe(plan.storyId);
    expect(input.target_start_clip_id).toBe("intro-setup");
    expect(input.target_clips).toHaveLength(6);
    expect(input.target_clips.map((clip) => clip.id)).toEqual([
      "intro-setup",
      "intro-event",
      "emotion-question",
      "help-question",
      "ending-newballoon",
      "ending-pethead",
    ]);
  });

  it("creates four video jobs and six decision-audio jobs", () => {
    const plan = instantiateAiVideoStoryPlan(
      parseAiVideoStoryPlanTemplate(validTemplate),
      "Pofik",
      "pofik-interactive-12345678",
    );
    const jobs = buildAiVideoMediaJobs(plan);
    expect(jobs.filter((job) => job.mediaKind === "video")).toHaveLength(4);
    expect(jobs.filter((job) => job.mediaKind === "audio")).toHaveLength(6);
    expect(jobs).toHaveLength(10);
    expect(jobs.map((job) => job.sceneId).filter((id) => id.startsWith("intro"))).toEqual([
      "intro-setup",
      "intro-event",
    ]);
  });

  it("uses the story's own introSetup emotion instead of always forcing happy", () => {
    const parsed = parseAiVideoStoryPlanTemplate({
      ...validTemplate,
      introSetup: { ...validTemplate.introSetup, emotion: "sad" },
    });
    const plan = instantiateAiVideoStoryPlan(parsed, "Pofik", "pofik-interactive-12345678");
    const jobs = buildAiVideoMediaJobs(plan);
    const introSetupJob = jobs.find((job) => job.sceneId === "intro-setup");
    expect(introSetupJob?.emotion).toBe("sad");
  });
});
