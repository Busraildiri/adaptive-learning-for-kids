import { contentVersionSchema } from "@adaptive/content-schema";
import contentJson from "@adaptive/content-schema/content/tr-TR/v1";
import { describe, expect, it } from "vitest";
import { storyBlueprints, videoBranchingBlueprints } from "./storyBlueprints";

const content = contentVersionSchema.parse(contentJson);

function templateFor(blueprint: (typeof storyBlueprints)[number]) {
  const template = content.stories.find((story) => story.id === blueprint.mechanicsSourceStoryId);
  if (!template) throw new Error(`Blueprint "${blueprint.id}" references a missing story.`);
  return template;
}

describe("storyBlueprints / template experienceType consistency", () => {
  it("every blueprint's experienceType equals its referenced template's experienceType", () => {
    for (const blueprint of storyBlueprints) {
      const template = templateFor(blueprint);
      expect(
        template.experienceType,
        `blueprint "${blueprint.id}" declares "${blueprint.experienceType}" but its template ` +
          `"${template.id}" is "${template.experienceType}"`,
      ).toBe(blueprint.experienceType);
    }
  });

  it("the Studio only exposes video_branching blueprints", () => {
    const exposed = videoBranchingBlueprints();
    expect(exposed.length).toBeGreaterThan(0);
    for (const blueprint of exposed) {
      expect(blueprint.experienceType).toBe("video_branching");
    }
  });

  it("existing interactive_ui mino blueprints remain intact and are not exposed to the Studio", () => {
    const legacyIds = [
      "lost-and-found",
      "build-and-try-again",
      "goodbye-and-reconnect",
      "surprise-and-support",
    ];
    for (const id of legacyIds) {
      const blueprint = storyBlueprints.find((candidate) => candidate.id === id);
      expect(blueprint).toBeDefined();
      expect(blueprint?.experienceType).toBe("interactive_ui");
    }
    const exposedIds = videoBranchingBlueprints().map((blueprint) => blueprint.id);
    for (const id of legacyIds) {
      expect(exposedIds).not.toContain(id);
    }
  });

  it("the new video_branching blueprint is exposed and points at the new template", () => {
    const exposedIds = videoBranchingBlueprints().map((blueprint) => blueprint.id);
    expect(exposedIds).toContain("share-and-take-turns");
    const blueprint = storyBlueprints.find((candidate) => candidate.id === "share-and-take-turns");
    expect(blueprint?.mechanicsSourceStoryId).toBe("video-branching-crayons-story");
  });
});
