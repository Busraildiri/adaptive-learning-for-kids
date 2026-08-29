import type { z } from "zod";
import type {
  activitySchema,
  activityTypeSchema,
  ageBandSchema,
  assetPresentationSchema,
  assetSchema,
  assetSemanticSchema,
  assetTypeSchema,
  balloonCountingGameSchema,
  bktLevelingSchema,
  choiceSchema,
  classifyAndSortGameSchema,
  contentStatusSchema,
  contentVersionSchema,
  emotionClueRoundSchema,
  emotionCluesGameSchema,
  emotionIdSchema,
  experienceTypeSchema,
  fishPatternsGameSchema,
  gameDifficultyLevelSchema,
  gameExpectedActionSchema,
  gameMechanicSchema,
  gameProductionSourceSchema,
  gameReminderModeSchema,
  gameRuleSchema,
  gameSchema,
  helpActionSchema,
  miniChallengeGameSchema,
  momoCableEndpointSchema,
  momoCableRoundSchema,
  momoCrystalRoundSchema,
  momoPartVisualSchema,
  momoPatternRoundSchema,
  momoRewardChoiceSchema,
  momoShapeSchema,
  momoWorkshopGameSchema,
  momoWorkshopRoundSchema,
  routineItemSchema,
  routineRoundSchema,
  sequenceAndPlaceGameSchema,
  sortObjectSchema,
  sortRoundSchema,
  storyChoiceSchema,
  storyEmotionChoiceSchema,
  storyHelpChoiceSchema,
  storyResolutionSchema,
  storySchema,
  storyStepSchema,
  supportiveFeedbackSchema,
  tapOrWaitGameSchema,
} from "./schemas";

export type AgeBand = z.infer<typeof ageBandSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type EmotionId = z.infer<typeof emotionIdSchema>;
export type ExperienceType = z.infer<typeof experienceTypeSchema>;
export type HelpAction = z.infer<typeof helpActionSchema>;
export type AssetType = z.infer<typeof assetTypeSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetPresentation = z.infer<typeof assetPresentationSchema>;
export type AssetSemantic = z.infer<typeof assetSemanticSchema>;
export type SupportiveFeedback = z.infer<typeof supportiveFeedbackSchema>;
export type StoryResolution = z.infer<typeof storyResolutionSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type StoryChoice = z.infer<typeof storyChoiceSchema>;
export type StoryEmotionChoice = z.infer<typeof storyEmotionChoiceSchema>;
export type StoryHelpChoice = z.infer<typeof storyHelpChoiceSchema>;
export type StoryStep = z.infer<typeof storyStepSchema>;
export type Story = z.infer<typeof storySchema>;
export type GameProductionSource = z.infer<typeof gameProductionSourceSchema>;
export type GameMechanic = z.infer<typeof gameMechanicSchema>;
export type GameReminderMode = z.infer<typeof gameReminderModeSchema>;
export type GameExpectedAction = z.infer<typeof gameExpectedActionSchema>;
export type GameDifficultyLevel = z.infer<typeof gameDifficultyLevelSchema>;
export type GameRule = z.infer<typeof gameRuleSchema>;
export type TapOrWaitGame = z.infer<typeof tapOrWaitGameSchema>;
export type SortObject = z.infer<typeof sortObjectSchema>;
export type SortRound = z.infer<typeof sortRoundSchema>;
export type ClassifyAndSortGame = z.infer<typeof classifyAndSortGameSchema>;
export type Game = z.infer<typeof gameSchema>;
export type RoutineItem = z.infer<typeof routineItemSchema>;
export type RoutineRound = z.infer<typeof routineRoundSchema>;
export type SequenceAndPlaceGame = z.infer<typeof sequenceAndPlaceGameSchema>;
export type EmotionClueRound = z.infer<typeof emotionClueRoundSchema>;
export type EmotionCluesGame = z.infer<typeof emotionCluesGameSchema>;
export type FishPatternsGame = z.infer<typeof fishPatternsGameSchema>;
export type BalloonCountingGame = z.infer<typeof balloonCountingGameSchema>;
export type BktLeveling = z.infer<typeof bktLevelingSchema>;
export type MiniChallengeGame = z.infer<typeof miniChallengeGameSchema>;
export type MomoCableEndpoint = z.infer<typeof momoCableEndpointSchema>;
export type MomoCableRound = z.infer<typeof momoCableRoundSchema>;
export type MomoCrystalRound = z.infer<typeof momoCrystalRoundSchema>;
export type MomoShape = z.infer<typeof momoShapeSchema>;
export type MomoPatternRound = z.infer<typeof momoPatternRoundSchema>;
export type MomoPartVisual = z.infer<typeof momoPartVisualSchema>;
export type MomoRewardChoice = z.infer<typeof momoRewardChoiceSchema>;
export type MomoWorkshopRound = z.infer<typeof momoWorkshopRoundSchema>;
export type MomoWorkshopGame = z.infer<typeof momoWorkshopGameSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type ContentVersion = z.infer<typeof contentVersionSchema>;
