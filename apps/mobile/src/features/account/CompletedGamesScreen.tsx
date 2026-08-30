import type { Game } from "@adaptive/content-schema";
import type { ChildProfile } from "@adaptive/shared-types";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  type GameProgressMap,
  loadGameProgress,
  restartCompletedGame,
} from "../../services/gameProgress";
import { AccountShell } from "./AccountShell";

export function CompletedGamesScreen({
  child,
  games,
  onBack,
}: {
  child: ChildProfile;
  games: Game[];
  onBack: () => void;
}) {
  const [progress, setProgress] = useState<GameProgressMap | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void loadGameProgress(child.id).then(setProgress);
  }, [child.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completed = games.filter((game) => progress?.[game.id]?.completed);
  return (
    <AccountShell subtitle={`${child.nickname} için bitirilen oyunlar.`} title="Tamamlanan oyunlar">
      {progress === null ? <ActivityIndicator color="#2D8C7C" /> : null}
      {progress !== null && completed.length === 0 ? (
        <Text style={styles.empty}>Henüz tamamlanan bir oyun yok.</Text>
      ) : null}
      {completed.map((game) => (
        <View key={game.id} style={styles.card}>
          <View style={styles.copy}>
            <Text style={styles.title}>{game.title}</Text>
            <Text style={styles.detail}>Çocuk ekranında gizli</Text>
          </View>
          <Pressable
            disabled={restoringId !== null}
            onPress={() => {
              setRestoringId(game.id);
              void restartCompletedGame(child.id, game.id)
                .then(setProgress)
                .finally(() => setRestoringId(null));
            }}
            style={[styles.restore, restoringId !== null && styles.disabled]}
          >
            <Text style={styles.restoreText}>
              {restoringId === game.id ? "Yükleniyor..." : "Yeniden etkinleştir"}
            </Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>Geri dön</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#75685E", fontSize: 16, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFCF7",
  },
  copy: { flex: 1 },
  title: { color: "#3F352E", fontSize: 16, fontWeight: "900" },
  detail: { marginTop: 4, color: "#75685E", fontSize: 13 },
  restore: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2D8C7C",
  },
  restoreText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  back: { alignItems: "center", marginTop: 8, padding: 14 },
  backText: { color: "#216D61", fontWeight: "900" },
});
