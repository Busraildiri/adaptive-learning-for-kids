import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { completeParentOnboarding } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

export function GuardianOnboardingScreen({
  userId,
  onCompleted,
}: {
  userId: string;
  onCompleted: () => Promise<void>;
}) {
  const [guardianAccepted, setGuardianAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    if (!guardianAccepted || !privacyAccepted) {
      setError("Devam etmek için iki beyanı da onaylamanız gerekir.");
      return;
    }

    if (!/^\d{4}$/.test(pin) || pin !== pinAgain) {
      setError("Birbiriyle aynı, dört haneli bir ebeveyn PIN’i belirleyin.");
      return;
    }

    setBusy(true);
    try {
      await completeParentOnboarding(userId, pin, { guardianAccepted, privacyAccepted });
      await onCompleted();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle="Çocuk modu ile ebeveyn alanını ayırmak ve veriyi doğru kişiye bağlamak için bu adım gereklidir."
      title="Ebeveyn doğrulaması"
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: guardianAccepted, disabled: busy }}
        disabled={busy}
        onPress={() => setGuardianAccepted((current) => !current)}
        style={styles.acceptance}
      >
        <View style={[styles.checkbox, guardianAccepted && styles.checkboxSelected]}>
          {guardianAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.acceptanceText}>
          <Text style={styles.requiredLabel}>Zorunlu: </Text>
          Bu hesapta oluşturacağım çocuk profilleri için ebeveyn veya yasal temsilci olduğumu beyan
          ediyorum.
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: privacyAccepted, disabled: busy }}
        disabled={busy}
        onPress={() => setPrivacyAccepted((current) => !current)}
        style={styles.acceptance}
      >
        <View style={[styles.checkbox, privacyAccepted && styles.checkboxSelected]}>
          {privacyAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.acceptanceText}>
          <Text style={styles.requiredLabel}>Zorunlu: </Text>
          Geliştirme sürümündeki gizlilik bilgilendirmesini okudum. Tam ad, ses ve görüntü
          kaydedilmediğini anladım.
        </Text>
      </Pressable>

      <Text style={styles.draftNotice}>
        Bu metinler geliştirme taslağıdır; gerçek aile pilotundan önce hukuki inceleme gerekir.
      </Text>

      <Text style={formStyles.fieldLabel}>4 haneli ebeveyn PIN’i</Text>
      <TextInput
        editable={!busy}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={setPin}
        secureTextEntry
        style={formStyles.input}
        value={pin}
      />
      <Text style={formStyles.fieldLabel}>PIN’i yeniden yazın</Text>
      <TextInput
        editable={!busy}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={setPinAgain}
        secureTextEntry
        style={formStyles.input}
        value={pinAgain}
      />

      <Pressable
        disabled={busy || !guardianAccepted || !privacyAccepted}
        onPress={() => void submit()}
        style={[
          formStyles.primaryButton,
          (busy || !guardianAccepted || !privacyAccepted) && formStyles.disabled,
        ]}
      >
        <Text style={formStyles.primaryButtonText}>{busy ? "Kaydediliyor..." : "Devam et"}</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  acceptance: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  checkbox: {
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: "#B8A896",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { borderColor: "#2D8C7C", backgroundColor: "#2D8C7C" },
  checkmark: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", lineHeight: 20 },
  acceptanceText: { flex: 1, color: "#51463D", fontSize: 15, lineHeight: 21 },
  requiredLabel: { color: "#8A3838", fontWeight: "900" },
  draftNotice: {
    marginBottom: 20,
    padding: 11,
    borderRadius: 12,
    color: "#70551E",
    backgroundColor: "#FFF0C9",
    fontSize: 13,
    lineHeight: 18,
  },
});
