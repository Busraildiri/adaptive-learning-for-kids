import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { signInParent, signUpParent } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

type AuthMode = "sign-in" | "sign-up";

function validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.includes("@")) {
      setError("Geçerli bir e-posta adresi yazın.");
      return;
    }

    if (mode === "sign-up" && !validatePassword(password)) {
      setError("Parola en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "sign-up") {
        const result = await signUpParent(normalizedEmail, password);
        if (!result.session) {
          setNotice(
            "Doğrulama bağlantısını e-postanıza gönderdik. Doğruladıktan sonra giriş yapın.",
          );
          setMode("sign-in");
        }
      } else {
        await signInParent(normalizedEmail, password);
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle="Hesap ebeveyne aittir. Çocuk uygulamaya ayrı bir kullanıcı olarak giriş yapmaz."
      title={mode === "sign-up" ? "Ebeveyn hesabı oluştur" : "Ebeveyn girişi"}
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {notice ? <Text style={formStyles.success}>{notice}</Text> : null}

      <Text style={formStyles.fieldLabel}>E-posta</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        editable={!busy}
        keyboardType="email-address"
        onChangeText={setEmail}
        style={formStyles.input}
        value={email}
      />

      <Text style={formStyles.fieldLabel}>Parola</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        editable={!busy}
        onChangeText={setPassword}
        secureTextEntry
        style={formStyles.input}
        value={password}
      />
      {mode === "sign-up" ? (
        <Text style={formStyles.helper}>En az 8 karakter, büyük/küçük harf ve rakam.</Text>
      ) : null}

      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[formStyles.primaryButton, busy && formStyles.disabled]}
      >
        <Text style={formStyles.primaryButtonText}>
          {busy ? "Bekleyin..." : mode === "sign-up" ? "Hesap oluştur" : "Giriş yap"}
        </Text>
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={() => {
          setError(null);
          setNotice(null);
          setMode((current) => (current === "sign-up" ? "sign-in" : "sign-up"));
        }}
        style={formStyles.secondaryButton}
      >
        <Text style={formStyles.secondaryButtonText}>
          {mode === "sign-up" ? "Zaten hesabım var" : "Yeni hesap oluştur"}
        </Text>
      </Pressable>
    </AccountShell>
  );
}
