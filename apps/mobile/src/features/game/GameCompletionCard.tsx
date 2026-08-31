import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function GameCompletionCard({
  message,
  onExit,
  onRestart,
  title,
}: {
  message: string;
  onExit: () => void;
  onRestart: () => void;
  title: string;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <MaterialCommunityIcons color="#2EAD61" name="check-circle" size={108} />
        <Text accessibilityRole="header" style={styles.completed}>
          TAMAMLANDI!
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          accessibilityHint="Ana ekrana döner"
          accessibilityRole="button"
          onPress={onExit}
          style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}
        >
          <Text style={styles.homeText}>Ana ekrana dön</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Oyunu birinci seviyeden yeniden başlatır"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onRestart}
          style={({ pressed }) => [styles.replayButton, pressed && styles.pressed]}
        >
          <Text style={styles.replayText}>Tekrar oyna</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "94%",
    maxWidth: 430,
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.97)",
    shadowColor: "#176A37",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  completed: {
    marginTop: 8,
    color: "#249C55",
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "900",
    textAlign: "center",
  },
  title: {
    marginTop: 9,
    color: "#413936",
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    color: "#665C57",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
  },
  homeButton: {
    minWidth: 220,
    alignItems: "center",
    marginTop: 25,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
    backgroundColor: "#2EAD61",
  },
  homeText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  replayButton: { marginTop: 11, paddingVertical: 7, paddingHorizontal: 16 },
  replayText: { color: "#277E48", fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
