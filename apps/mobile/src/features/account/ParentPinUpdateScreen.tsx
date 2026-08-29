import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { changeParentPin } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

export function ParentPinUpdateScreen({ onBack }: { onBack: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^\d{4}$/.test(currentPin)) {
      setError("Mevcut 4 haneli ebeveyn PIN’inizi yazın.");
      return;
    }
    if (!/^\d{4}$/.test(newPin) || newPin !== confirmation) {
      setError("Birbiriyle aynı, 4 haneli yeni bir PIN belirleyin.");
      return;
    }
    if (currentPin === newPin) {
      setError("Yeni PIN mevcut PIN’den farklı olmalı.");
      return;
    }

    setBusy(true);
    try {
      await changeParentPin(currentPin, newPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmation("");
      setCompleted(true);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Ebeveyn PIN’i değiştirilemedi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle="Bu PIN, çocuk alanından ebeveyn paneline dönmek için kullanılır."
      title="Ebeveyn PIN’i"
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {completed ? (
        <>
          <Text style={formStyles.success}>Ebeveyn PIN’iniz başarıyla değiştirildi.</Text>
          <Pressable onPress={onBack} style={formStyles.primaryButton}>
            <Text style={formStyles.primaryButtonText}>Ayarlara dön</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={formStyles.fieldLabel}>Mevcut PIN</Text>
          <TextInput
            editable={!busy}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setCurrentPin}
            secureTextEntry
            style={[formStyles.input, formStyles.codeInput]}
            value={currentPin}
          />
          <Text style={formStyles.fieldLabel}>Yeni PIN</Text>
          <TextInput
            editable={!busy}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setNewPin}
            secureTextEntry
            style={[formStyles.input, formStyles.codeInput]}
            value={newPin}
          />
          <Text style={formStyles.fieldLabel}>Yeni PIN tekrar</Text>
          <TextInput
            editable={!busy}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setConfirmation}
            secureTextEntry
            style={[formStyles.input, formStyles.codeInput]}
            value={confirmation}
          />
          <Pressable
            disabled={busy}
            onPress={() => void submit()}
            style={[formStyles.primaryButton, busy && formStyles.disabled]}
          >
            <Text style={formStyles.primaryButtonText}>
              {busy ? "Değiştiriliyor..." : "PIN’i değiştir"}
            </Text>
          </Pressable>
          <Pressable disabled={busy} onPress={onBack} style={formStyles.secondaryButton}>
            <Text style={formStyles.secondaryButtonText}>Vazgeç</Text>
          </Pressable>
        </>
      )}
    </AccountShell>
  );
}
