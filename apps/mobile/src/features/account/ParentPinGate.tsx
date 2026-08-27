import { useEffect, useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { verifyParentPin } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

export function ParentPinGate({
  onCancel,
  onUnlocked,
}: {
  onCancel: () => void;
  onUnlocked: () => void;
}) {
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lockedUntil) return;
    const delay = Math.max(0, lockedUntil - Date.now());
    const timer = setTimeout(() => {
      setLockedUntil(null);
      setAttempts(0);
      setError(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const submit = async () => {
    if (lockedUntil || !/^\d{4}$/.test(pin)) {
      setError(
        lockedUntil ? "Çok fazla deneme yapıldı. 30 saniye bekleyin." : "Dört haneli PIN’i yazın.",
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (await verifyParentPin(pin)) {
        onUnlocked();
        return;
      }

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPin("");
      if (nextAttempts >= 5) {
        setLockedUntil(Date.now() + 30_000);
        setError("Çok fazla deneme yapıldı. 30 saniye bekleyin.");
      } else {
        setError("PIN doğru değil.");
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "PIN doğrulanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle="Çocuk modundan çıkmak için ebeveyn PIN’ini yazın."
      title="Ebeveyn alanı"
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      <Text style={formStyles.fieldLabel}>4 haneli PIN</Text>
      <TextInput
        autoFocus
        editable={!busy && !lockedUntil}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={setPin}
        onSubmitEditing={() => void submit()}
        secureTextEntry
        style={formStyles.input}
        value={pin}
      />
      <Pressable
        disabled={busy || Boolean(lockedUntil)}
        onPress={() => void submit()}
        style={[formStyles.primaryButton, (busy || Boolean(lockedUntil)) && formStyles.disabled]}
      >
        <Text style={formStyles.primaryButtonText}>Ebeveyn alanına dön</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={onCancel} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Çocuk moduna dön</Text>
      </Pressable>
    </AccountShell>
  );
}
