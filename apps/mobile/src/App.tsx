import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.emoji}>🌱</Text>
        <Text style={styles.title}>Adaptive Learning for Kids</Text>
        <Text style={styles.subtitle}>Mobil proje temeli hazır.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff8eb" },
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emoji: { fontSize: 72 },
  title: { marginTop: 18, color: "#246b63", fontSize: 28, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 10, color: "#574a3b", fontSize: 17, textAlign: "center" },
});
