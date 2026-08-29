import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export function FinishedStage({
  onReplay,
  onExit,
}: {
  onReplay: () => void;
  onExit: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.symbol}>🎉</Text>
        <Text style={styles.title}>Hikâye bitti!</Text>
        <Pressable
          accessibilityLabel="Tekrar izle"
          accessibilityRole="button"
          onPress={onReplay}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Tekrar izle</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Hikâyelere dön"
          accessibilityRole="button"
          onPress={onExit}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>Hikâyelere dön</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF6E8", alignItems: "center", justifyContent: "center" },
  card: {
    width: "86%",
    padding: 28,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 10,
  },
  symbol: { fontSize: 56, marginBottom: 6 },
  title: { color: "#463A31", fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "#2D8C7C",
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  secondaryButton: { paddingVertical: 12, alignItems: "center" },
  secondaryButtonText: { color: "#887867", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.72 },
});
