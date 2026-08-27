import { useState } from "react";
import { Pressable, Text } from "react-native";
import { signOutParent } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

export function AccountLoadErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle="Bağlantınızı kontrol edip yeniden deneyebilirsiniz."
      title="Hesap yüklenemedi"
    >
      <Text style={formStyles.error}>{message}</Text>
      {actionError ? <Text style={formStyles.error}>{actionError}</Text> : null}
      <Pressable
        disabled={busy}
        onPress={() => void run(onRetry)}
        style={[formStyles.primaryButton, busy && formStyles.disabled]}
      >
        <Text style={formStyles.primaryButtonText}>Yeniden dene</Text>
      </Pressable>
      <Pressable
        disabled={busy}
        onPress={() => void run(signOutParent)}
        style={formStyles.secondaryButton}
      >
        <Text style={formStyles.secondaryButtonText}>Hesaptan çık</Text>
      </Pressable>
    </AccountShell>
  );
}
