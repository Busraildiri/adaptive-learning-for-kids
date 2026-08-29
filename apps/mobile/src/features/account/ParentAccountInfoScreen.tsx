import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { updateParentAccountInfo } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ParentAccountInfoScreen({
  childCount,
  initialDisplayName,
  initialEmail,
  onBack,
}: {
  childCount: number;
  initialDisplayName: string;
  initialEmail: string;
  onBack: () => void;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (displayName.trim().length > 80) {
      setError("Ebeveyn adı en fazla 80 karakter olabilir.");
      return;
    }
    if (!emailPattern.test(email.trim())) {
      setError("Geçerli bir e-posta adresi yazın.");
      return;
    }

    setBusy(true);
    try {
      const result = await updateParentAccountInfo({
        currentEmail: initialEmail,
        displayName,
        email,
      });
      setNotice(
        result.emailConfirmationRequired
          ? "Bilgiler kaydedildi. E-posta değişikliğini tamamlamak için gönderilen bağlantıyı onaylayın."
          : "Kullanıcı bilgileriniz kaydedildi.",
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Bilgiler kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle={`${childCount} çocuk profili bu ebeveyn hesabına bağlı.`}
      title="Kullanıcı bilgileri"
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {notice ? <Text style={formStyles.success}>{notice}</Text> : null}
      <Text style={formStyles.fieldLabel}>Ebeveyn adı</Text>
      <TextInput
        autoCapitalize="words"
        editable={!busy}
        maxLength={80}
        onChangeText={setDisplayName}
        placeholder="Adınız"
        style={formStyles.input}
        value={displayName}
      />
      <Text style={formStyles.fieldLabel}>E-posta adresi</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        editable={!busy}
        keyboardType="email-address"
        maxLength={254}
        onChangeText={setEmail}
        style={formStyles.input}
        value={email}
      />
      <Text style={formStyles.helper}>
        E-posta değişikliklerinde güvenlik için yeni adresi onaylamanız istenebilir.
      </Text>
      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[formStyles.primaryButton, busy && formStyles.disabled]}
      >
        <Text style={formStyles.primaryButtonText}>
          {busy ? "Kaydediliyor..." : "Bilgileri kaydet"}
        </Text>
      </Pressable>
      <Pressable disabled={busy} onPress={onBack} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Ayarlara dön</Text>
      </Pressable>
    </AccountShell>
  );
}
