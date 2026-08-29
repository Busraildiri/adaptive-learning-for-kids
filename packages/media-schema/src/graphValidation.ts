/**
 * Cross-referential graph invariants that per-clip schema validation alone
 * cannot express (dangling references, cycles, reachability). Deliberately
 * typed against a minimal structural shape (not the Zod-inferred PlaybackClip)
 * so this module has zero dependency on schemas.ts -- schemas.ts depends on
 * this module (via superRefine), not the other way around.
 *
 * MVP does not support cyclic story graphs: a cycle would let StoryPlayer
 * loop forever between clips with no ending in reach. Cycles are rejected
 * here, at the data-contract boundary, specifically so StoryPlayer itself
 * never needs a runtime loop-guard -- any graph it receives has already
 * been proven acyclic and ending-reachable.
 */

export interface GraphIssue {
  message: string;
  path?: (string | number)[];
}

interface GraphClipLike {
  id: string;
  kind: "linear" | "decision" | "ending";
  nextClipId?: string;
  choice?: { options: { id: string; nextClipId: string }[] };
}

interface GraphLike {
  startClipId: string;
  clips: GraphClipLike[];
}

function nextIdsOf(clip: GraphClipLike): string[] {
  if (clip.kind === "linear" && clip.nextClipId) return [clip.nextClipId];
  if (clip.kind === "decision" && clip.choice) {
    return clip.choice.options.map((option) => option.nextClipId);
  }
  return [];
}

export function collectGraphIssues(graph: GraphLike): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const byId = new Map<string, GraphClipLike>();

  graph.clips.forEach((clip, index) => {
    if (byId.has(clip.id)) {
      issues.push({ message: `Duplicate clip id "${clip.id}"`, path: ["clips", index, "id"] });
      return;
    }
    byId.set(clip.id, clip);
  });

  if (!byId.has(graph.startClipId)) {
    issues.push({
      message: `startClipId "${graph.startClipId}" does not match any clip`,
      path: ["startClipId"],
    });
  }

  graph.clips.forEach((clip, index) => {
    if (clip.kind === "linear" && clip.nextClipId && !byId.has(clip.nextClipId)) {
      issues.push({
        message: `Clip "${clip.id}" has a dangling nextClipId "${clip.nextClipId}"`,
        path: ["clips", index, "nextClipId"],
      });
    }
    if (clip.kind === "decision" && clip.choice) {
      const seenOptionIds = new Set<string>();
      clip.choice.options.forEach((option, optionIndex) => {
        if (seenOptionIds.has(option.id)) {
          issues.push({
            message: `Decision clip "${clip.id}" has duplicate option id "${option.id}"`,
            path: ["clips", index, "choice", "options", optionIndex, "id"],
          });
        }
        seenOptionIds.add(option.id);
        if (!byId.has(option.nextClipId)) {
          issues.push({
            message: `Option "${option.id}" on clip "${clip.id}" has a dangling nextClipId "${option.nextClipId}"`,
            path: ["clips", index, "choice", "options", optionIndex, "nextClipId"],
          });
        }
      });
    }
  });

  if (byId.has(graph.startClipId)) {
    const visitState = new Map<string, "visiting" | "done">();
    const visited = new Set<string>();

    const visit = (id: string, path: string[]): void => {
      if (visitState.get(id) === "done") return;
      if (visitState.get(id) === "visiting") {
        issues.push({ message: `Cycle detected: ${[...path, id].join(" -> ")}` });
        return;
      }
      const clip = byId.get(id);
      if (!clip) return; // already reported above as a dangling reference
      visitState.set(id, "visiting");
      visited.add(id);
      for (const nextId of nextIdsOf(clip)) visit(nextId, [...path, id]);
      visitState.set(id, "done");
    };
    visit(graph.startClipId, []);

    const reachesEnding = [...visited].some((id) => byId.get(id)?.kind === "ending");
    if (!reachesEnding) {
      issues.push({ message: "No ending clip is reachable from startClipId" });
    }
  }

  return issues;
}
