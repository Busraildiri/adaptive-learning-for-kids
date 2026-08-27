import { StatusBar } from "expo-status-bar";
import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function AccountShell({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}>
            <View style={styles.brandEarLeft} />
            <View style={styles.brandEarRight} />
            <View style={styles.brandFace} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF6E8" },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 36,
  },
  brandMark: { width: 70, height: 58, alignItems: "center", justifyContent: "flex-end" },
  brandEarLeft: {
    position: "absolute",
    top: 0,
    left: 15,
    width: 16,
    height: 37,
    borderRadius: 10,
    backgroundColor: "#F4BFA7",
    transform: [{ rotate: "-10deg" }],
  },
  brandEarRight: {
    position: "absolute",
    top: 0,
    right: 15,
    width: 16,
    height: 37,
    borderRadius: 10,
    backgroundColor: "#F4BFA7",
    transform: [{ rotate: "10deg" }],
  },
  brandFace: { width: 52, height: 42, borderRadius: 25, backgroundColor: "#F8DEC6" },
  title: {
    marginTop: 12,
    color: "#3F352E",
    fontSize: 31,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 520,
    marginTop: 8,
    color: "#6F6258",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    marginTop: 24,
    padding: 22,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    shadowColor: "#705A48",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
});
