import { describe, expect, it } from "vitest";
import { storyPlaybackGraphSchema } from "./schemas";

function validGraph() {
  return {
    id: "graph-1",
    storyId: "story-1",
    storyVersion: 1,
    sourceRequestId: "req-1",
    startClipId: "scene-01",
    clips: [
      { kind: "linear", id: "scene-01", sourceSceneId: "scene-01", nextClipId: "scene-02" },
      {
        kind: "decision",
        id: "scene-02",
        sourceSceneId: "scene-02",
        choice: {
          question: "Mırmır'a nasıl yardım etmek istersin?",
          options: [
            { id: "hug", label: "Sarıl", nextClipId: "scene-03-hug" },
            { id: "balloon", label: "Balon bul", nextClipId: "scene-03-balloon" },
          ],
        },
      },
      { kind: "ending", id: "scene-03-hug", sourceSceneId: "scene-03" },
      { kind: "ending", id: "scene-03-balloon", sourceSceneId: "scene-03" },
    ],
  };
}

describe("storyPlaybackGraphSchema", () => {
  it("accepts a valid linear -> decision -> two endings graph", () => {
    expect(storyPlaybackGraphSchema.safeParse(validGraph()).success).toBe(true);
  });

  it("rejects a decision with only one option", () => {
    const graph = validGraph();
    // @ts-expect-error deliberately invalid for the test
    graph.clips[1].choice.options = [graph.clips[1].choice.options[0]];
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects a decision with three options", () => {
    const graph = validGraph();
    // @ts-expect-error deliberately invalid for the test
    graph.clips[1].choice.options.push({ id: "third", label: "x", nextClipId: "scene-03-hug" });
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects an ending clip carrying nextClipId (structurally impossible, not just disallowed)", () => {
    const graph = validGraph();
    // nextClipId is inferred as an optional property on the merged clip
    // element type here (validGraph() isn't asserted against PlaybackClip[]),
    // so this write is type-valid -- only Zod's discriminated union at
    // parse time actually rejects an "ending" clip carrying nextClipId.
    graph.clips[2].nextClipId = "scene-03-balloon";
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects a duplicate clip id", () => {
    const graph = validGraph();
    graph.clips[3].id = "scene-03-hug";
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects a duplicate option id within one decision", () => {
    const graph = validGraph();
    // @ts-expect-error deliberately invalid for the test
    graph.clips[1].choice.options[1].id = "hug";
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects a startClipId that matches no clip", () => {
    const graph = validGraph();
    graph.startClipId = "does-not-exist";
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects a dangling linear nextClipId", () => {
    const graph = validGraph();
    // Type-valid write (nextClipId is a plain string field); "nowhere" is
    // only invalid at the graph-reachability level, which Zod checks below.
    graph.clips[0].nextClipId = "nowhere";
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects a dangling choice option nextClipId", () => {
    const graph = validGraph();
    // @ts-expect-error deliberately invalid for the test
    graph.clips[1].choice.options[0].nextClipId = "nowhere";
    expect(storyPlaybackGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("rejects a cyclic graph with no reachable ending (MVP: cycles unsupported)", () => {
    const cyclic = {
      id: "graph-2",
      storyId: "story-1",
      storyVersion: 1,
      startClipId: "a",
      clips: [
        { kind: "linear", id: "a", sourceSceneId: "a", nextClipId: "b" },
        { kind: "linear", id: "b", sourceSceneId: "b", nextClipId: "a" },
      ],
    };
    const result = storyPlaybackGraphSchema.safeParse(cyclic);
    expect(result.success).toBe(false);
  });

  it("rejects a graph where no ending is reachable from startClipId", () => {
    const graph = validGraph();
    graph.clips = graph.clips.filter((clip) => clip.kind !== "ending");
    // scene-02's choices now dangle since their targets were removed -- still
    // exercises the "no reachable ending" path once dangling refs are fixed.
    graph.clips[1] = {
      kind: "linear",
      id: "scene-02",
      sourceSceneId: "scene-02",
      nextClipId: "scene-01",
    } as (typeof graph.clips)[number];
    const result = storyPlaybackGraphSchema.safeParse(graph);
    expect(result.success).toBe(false);
  });
});
