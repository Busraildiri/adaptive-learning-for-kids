import type { MiniChallengeGame } from "@adaptive/content-schema";

type MiniChallengeRound = MiniChallengeGame["rounds"][number];
type RhythmRound = MiniChallengeRound;

const rhythmChoices: RhythmRound["choices"] = [
  { id: "drum", label: "Davul", icon: "drum" },
  { id: "clap", label: "Alkış", icon: "clap" },
  { id: "bell", label: "Zil", icon: "bell" },
  { id: "maracas", label: "Marakas", icon: "maracas" },
  { id: "tambourine", label: "Tef", icon: "tambourine" },
  { id: "triangle", label: "Üçgen", icon: "triangle-instrument" },
  { id: "xylophone", label: "Ksilofon", icon: "xylophone" },
  { id: "cymbals", label: "Simbal", icon: "cymbals" },
  { id: "trumpet", label: "Trompet", icon: "trumpet" },
  { id: "guitar", label: "Gitar", icon: "guitar" },
  { id: "wood-block", label: "Tahta Blok", icon: "wood-block" },
];

const firstFinalRhythmPlanIndex = 5;

const rhythmPlans = [
  {
    choices: ["drum", "tambourine", "xylophone", "triangle"],
    sequence: ["drum", "tambourine"],
  },
  {
    choices: ["drum", "tambourine", "xylophone", "triangle"],
    sequence: ["xylophone", "triangle"],
  },
  {
    choices: ["drum", "tambourine", "xylophone", "triangle"],
    sequence: ["tambourine", "xylophone", "triangle"],
  },
  {
    choices: ["guitar", "trumpet", "wood-block", "maracas"],
    sequence: ["guitar", "wood-block", "trumpet"],
  },
  {
    choices: ["bell", "guitar", "trumpet", "wood-block"],
    sequence: ["trumpet", "bell", "guitar"],
  },
  {
    choices: ["guitar", "trumpet", "wood-block", "cymbals"],
    sequence: ["guitar", "wood-block", "trumpet", "cymbals"],
  },
  {
    choices: ["drum", "tambourine", "xylophone", "triangle"],
    sequence: ["drum", "tambourine", "xylophone", "triangle"],
  },
  {
    choices: ["clap", "bell", "maracas", "cymbals"],
    sequence: ["clap", "bell", "maracas", "cymbals"],
  },
] as const;

export function adaptRhythmRound(round: RhythmRound, challengeIndex: number): RhythmRound {
  const finalPlanOffset = Math.max(0, challengeIndex - firstFinalRhythmPlanIndex);
  const finalPlanCount = rhythmPlans.length - firstFinalRhythmPlanIndex;
  const planIndex =
    challengeIndex < firstFinalRhythmPlanIndex
      ? challengeIndex
      : firstFinalRhythmPlanIndex + (finalPlanOffset % finalPlanCount);
  const plan = rhythmPlans[planIndex] ?? rhythmPlans[0];
  const choices = plan.choices
    .map((id) => rhythmChoices.find((choice) => choice.id === id))
    .filter((choice): choice is RhythmRound["choices"][number] => Boolean(choice));
  const correctSequence = [...plan.sequence];
  const sequenceLength = correctSequence.length;

  return {
    ...round,
    id: `${round.id}-adaptive-${challengeIndex}-${sequenceLength}`,
    prompt: `${sequenceLength} sesi dinle ve aynı sırayla seç.`,
    choices,
    correctSequence,
    demoSequence: correctSequence,
  };
}

export function expectedChoiceId(
  round: MiniChallengeRound,
  enteredCount: number,
): string | undefined {
  const expectedIndex = round.kind === "single" ? 0 : enteredCount;
  return round.correctSequence[expectedIndex];
}

export function choicesAfterCorrectAnswer(
  round: MiniChallengeRound,
  entered: string[],
  choiceId: string,
): string[] {
  return round.kind === "single" ? [choiceId] : [...entered, choiceId];
}
