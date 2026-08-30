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
  children,
  games,
  onBack,
}: {
  children: ChildProfile[];
  games: Game[];
  onBack: () => void;
}) {
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [progress, setProgress] = useState<GameProgressMap | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!child) return;
    void loadGameProgress(child.id).then(setProgress);
  }, [child]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completed = games.filter((game) => progress?.[game.id]?.completed);
  return (
    <AccountShell
      subtitle={child ? `${child.nickname} için bitirilen oyunlar.` : "Bir çocuk profili seçin."}
      title="Tamamlanan oyunlar"
    >
      {!child ? (
        <View style={styles.profileList}>
          {children.map((profile) => (
            <Pressable
              key={profile.id}
              onPress={() => {
                setProgress(null);
                setChild(profile);
              }}
              style={styles.profile}
            >
              <Text style={styles.profileName}>{profile.nickname}</Text>
              <Text style={styles.profileHint}>Tamamlanan oyunları görüntüle</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {child && progress === null ? <ActivityIndicator color="#2D8C7C" /> : null}
      {child && progress !== null && completed.length === 0 ? (
        <Text style={styles.empty}>Henüz tamamlanan bir oyun yok.</Text>
      ) : null}
      {child &&
        completed.map((game) => (
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
      <Pressable onPress={child ? () => setChild(null) : onBack} style={styles.back}>
        <Text style={styles.backText}>{child ? "Çocuk seçimine dön" : "Ayarlara dön"}</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#75685E", fontSize: 16, textAlign: "center" },
  profileList: { gap: 11 },
  profile: { padding: 15, borderRadius: 16, backgroundColor: "#FFFCF7" },
  profileName: { color: "#3F352E", fontSize: 17, fontWeight: "900" },
  profileHint: { marginTop: 4, color: "#75685E", fontSize: 13 },
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
