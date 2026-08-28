import type { MiniChallengeGame as MiniGameContent } from "@adaptive/content-schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";

const rhythm: Record<string, ImageSourcePropType> = {
  clap: require("../../../assets/game/rhythm/rhythm-clap-v1.png"),
  bell: require("../../../assets/game/rhythm/rhythm-bell-v1.png"),
  drum: require("../../../assets/game/rhythm/rhythm-drum-v1.png"),
};
const illustratedIcons: Record<string, ImageSourcePropType> = {
  "maya-brush": require("../../../assets/game/mini/maya-brush.png"),
  "maya-shirt": require("../../../assets/game/mini/maya-shirt.png"),
  "maya-breakfast": require("../../../assets/game/mini/maya-breakfast.png"),
  "riko-inside": require("../../../assets/game/mini/riko-inside.png"),
  "riko-under": require("../../../assets/game/mini/riko-under.png"),
  "riko-on": require("../../../assets/game/mini/riko-on.png"),
  "zuzu-circle": require("../../../assets/game/mini/zuzu-circle.png"),
  "zuzu-square": require("../../../assets/game/mini/zuzu-square.png"),
  "zuzu-triangle": require("../../../assets/game/mini/zuzu-triangle.png"),
  "zuzu-star": require("../../../assets/game/mini/zuzu-star.png"),
  "kiki-small-apple": require("../../../assets/game/mini/kiki-small-apple.png"),
  "kiki-large-apple": require("../../../assets/game/mini/kiki-large-apple.png"),
  "kiki-small-acorn": require("../../../assets/game/mini/kiki-small-acorn.png"),
  "kiki-large-acorn": require("../../../assets/game/mini/kiki-large-acorn.png"),
};
const icons: Record<string, string> = {
  toothbrush: "toothbrush",
  shirt: "tshirt-crew",
  breakfast: "food-croissant",
  box: "package-variant",
  ball: "basketball",
  chair: "chair-rolling",
  circle: "circle-outline",
  square: "square-outline",
  triangle: "triangle-outline",
  star: "star-outline",
  "small-bear": "teddy-bear",
  "large-bear": "teddy-bear",
};

const blockPieces: Record<string, [number, number][]> = {
  "zuzu-circle": [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  "zuzu-square": [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  "zuzu-triangle": [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  "zuzu-star": [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
};

function BlockPiece({ icon }: { icon: string }) {
  const cells = blockPieces[icon] ?? [];
  return (
    <View style={styles.pieceCanvas}>
      {cells.map(([column, row]) => (
        <View
          key={`${column}-${row}`}
          style={[styles.pieceCell, { left: column * 27, top: row * 27 }]}
        />
      ))}
    </View>
  );
}

function BlockBoard({ roundId, solved }: { roundId: string; solved: boolean }) {
  const holes =
    roundId === "star" ? new Set(["0-1", "1-1", "2-1", "1-2"]) : new Set(["1-1", "1-2", "2-2"]);
  return (
    <View style={styles.blockBoard}>
      {Array.from({ length: 16 }, (_, index) => {
        const key = `${index % 4}-${Math.floor(index / 4)}`;
        const hole = holes.has(key);
        return (
          <View
            key={key}
            style={[styles.boardCell, hole && !solved ? styles.boardHole : styles.boardFilled]}
          />
        );
      })}
    </View>
  );
}

export function MiniChallengeGame({ game, onExit }: { game: MiniGameContent; onExit: () => void }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [entered, setEntered] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [locked, setLocked] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState(false);
  const round = game.rounds[roundIndex];
  const speak = useCallback(
    (text: string, done?: () => void) => {
      if (!game.presentation.playAudioInstructions) return done?.();
      void Speech.stop();
      Speech.speak(text, { language: "tr-TR", rate: 0.84, onDone: done, onStopped: done });
    },
    [game.presentation.playAudioInstructions],
  );
  const demonstrate = useCallback(() => {
    if (!round.demoSequence?.length) return setLocked(false);
    setLocked(true);
    round.demoSequence.forEach((id, index) => {
      setTimeout(() => {
        setHighlight(id);
        const label = round.choices.find((choice) => choice.id === id)?.label;
        if (label) Speech.speak(label, { language: "tr-TR", rate: 0.9 });
      }, index * 1000);
      setTimeout(() => setHighlight(null), index * 1000 + 700);
    });
    setTimeout(() => setLocked(false), round.demoSequence.length * 1000);
  }, [round]);
  useEffect(() => {
    setEntered([]);
    setWrong(0);
    setHighlight(null);
    setFeedback("");
    setLocked(true);
    const text =
      roundIndex === 0 ? `${game.presentation.introNarration} ${round.prompt}` : round.prompt;
    speak(text, demonstrate);
    return () => void Speech.stop();
  }, [demonstrate, game.presentation.introNarration, round.prompt, roundIndex, speak]);
  useEffect(() => {
    if (locked || completed) return;
    const timer = setTimeout(() => {
      const expected = round.correctSequence[entered.length];
      setHighlight(expected ?? null);
      const message = "Doğru seçenek parlıyor. Ona dokunabilirsin.";
      setFeedback(message);
      speak(message);
    }, game.difficulty.inactivityHintMs);
    return () => clearTimeout(timer);
  }, [
    completed,
    entered.length,
    game.difficulty.inactivityHintMs,
    locked,
    round.correctSequence,
    speak,
  ]);
  const finish = () => {
    setLocked(true);
    setFeedback(game.feedback.matched);
    Vibration.vibrate(35);
    speak(game.feedback.matched, () => {
      if (roundIndex === game.rounds.length - 1) {
        setCompleted(true);
        speak(game.presentation.closingNarration);
      } else setRoundIndex((value) => value + 1);
    });
  };
  const choose = (id: string) => {
    if (locked) return;
    const expected = round.correctSequence[entered.length];
    if (id !== expected) {
      if (wrong >= 1) {
        setHighlight(expected);
        const label = round.choices.find((choice) => choice.id === expected)?.label;
        const message = `Doğru cevap ${label}. Parlayan seçeneğe dokun.`;
        setFeedback(message);
        speak(message);
      } else {
        setWrong(1);
        setFeedback(game.feedback.retry);
        speak(game.feedback.retry, round.kind === "rhythm" ? demonstrate : undefined);
      }
      return;
    }
    const next = [...entered, id];
    setEntered(next);
    setHighlight(null);
    Vibration.vibrate(25);
    if (next.length === round.correctSequence.length) finish();
  };
  if (completed)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.finish}>
          <MaterialCommunityIcons name="star-circle" color="#F4B942" size={92} />
          <Text style={styles.finishTitle}>{game.title} tamamlandı!</Text>
          <Text style={styles.copy}>{game.presentation.closingNarration}</Text>
          <Pressable onPress={onExit} style={styles.exit}>
            <Text style={styles.exitText}>Oyunlara dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        accessibilityLabel="Oyundan çık"
        hitSlop={10}
        onPress={onExit}
        style={styles.close}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <View style={styles.dots}>
        {game.rounds.map((item, index) => (
          <View key={item.id} style={[styles.dot, index <= roundIndex && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.title}>{game.title}</Text>
      <View style={styles.prompt}>
        <Text style={styles.promptText}>{round.prompt}</Text>
        <Text style={styles.step}>
          {entered.length} / {round.correctSequence.length}
        </Text>
      </View>
      {game.id === "zuzu-missing-piece-001" ? (
        <BlockBoard roundId={round.id} solved={entered.length > 0} />
      ) : null}
      <View style={[styles.choices, game.id === "zuzu-missing-piece-001" && styles.puzzleChoices]}>
        {round.choices.map((choice) => (
          <Pressable
            key={choice.id}
            disabled={locked}
            onPress={() => choose(choice.id)}
            style={[
              styles.choice,
              game.id === "zuzu-missing-piece-001" && styles.puzzleChoice,
              highlight === choice.id && styles.highlight,
            ]}
          >
            {game.id === "zuzu-missing-piece-001" ? (
              <BlockPiece icon={choice.icon} />
            ) : illustratedIcons[choice.icon] || rhythm[choice.icon] ? (
              <Image
                source={illustratedIcons[choice.icon] ?? rhythm[choice.icon]}
                style={illustratedIcons[choice.icon] ? styles.illustratedImage : styles.rhythmImage}
              />
            ) : (
              <MaterialCommunityIcons
                name={icons[choice.icon] as never}
                color="#3E5C66"
                size={choice.icon === "small-bear" ? 58 : choice.icon === "large-bear" ? 92 : 72}
              />
            )}
            <Text style={styles.label}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.feedback}>{locked && !feedback ? "Dinle ve izle…" : feedback}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: "center", paddingHorizontal: 20, backgroundColor: "#FFF5DF" },
  close: {
    position: "absolute",
    zIndex: 2,
    top: 12,
    left: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E75252",
  },
  closeText: { fontSize: 32, lineHeight: 35, color: "#FFFFFF" },
  dots: { flexDirection: "row", gap: 8, marginTop: 28 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#DDD6CA" },
  dotOn: { backgroundColor: "#F08A5D" },
  title: { marginTop: 16, color: "#493C38", fontSize: 27, fontWeight: "900", textAlign: "center" },
  prompt: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    marginTop: 20,
    padding: 18,
    borderRadius: 25,
    backgroundColor: "#fff",
  },
  promptText: { color: "#493C38", fontSize: 22, fontWeight: "900", textAlign: "center" },
  step: { marginTop: 5, color: "#E16B45", fontSize: 18, fontWeight: "900" },
  choices: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    marginTop: 35,
  },
  choice: {
    width: "45%",
    minHeight: 165,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderWidth: 4,
    borderColor: "#fff",
    borderRadius: 28,
    backgroundColor: "#DCEEF2",
  },
  puzzleChoices: { marginTop: 18 },
  puzzleChoice: { width: "30%", minHeight: 128, paddingHorizontal: 5 },
  highlight: { borderColor: "#FFD45C", backgroundColor: "#FFF3A6", transform: [{ scale: 1.06 }] },
  rhythmImage: { width: 120, height: 100, resizeMode: "contain" },
  illustratedImage: { width: 142, height: 112, resizeMode: "contain" },
  blockBoard: {
    width: 196,
    height: 196,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 22,
    padding: 6,
    borderRadius: 22,
    backgroundColor: "#313F63",
  },
  boardCell: { width: 42, height: 42, margin: 2, borderRadius: 9, borderWidth: 2 },
  boardFilled: { borderColor: "#4C87D9", backgroundColor: "#65A7F3" },
  boardHole: { borderColor: "#C7D4EB", backgroundColor: "#FFFDF5" },
  pieceCanvas: { position: "relative", width: 82, height: 82 },
  pieceCell: {
    position: "absolute",
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: "#E58B14",
    borderRadius: 6,
    backgroundColor: "#FFD34E",
  },
  label: { marginTop: 7, color: "#493C38", fontSize: 18, fontWeight: "900", textAlign: "center" },
  feedback: {
    minHeight: 30,
    marginTop: 25,
    color: "#80513E",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  finish: {
    width: "90%",
    maxWidth: 430,
    alignItems: "center",
    marginTop: 150,
    padding: 30,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  finishTitle: { color: "#493C38", fontSize: 27, fontWeight: "900", textAlign: "center" },
  copy: { marginTop: 10, color: "#665C57", fontSize: 18, textAlign: "center" },
  exit: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
    backgroundColor: "#E16B45",
  },
  exitText: { color: "#fff", fontSize: 17, fontWeight: "900" },
});
