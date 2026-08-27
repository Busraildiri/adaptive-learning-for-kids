import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import {
  requestParentPasswordReset,
  signInParent,
  signUpParent,
  verifyParentPasswordRecoveryOtp,
} from "../../services/account";
import { signInParentWithGoogle } from "../../services/googleAuth";
import {
  isValidParentPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "../../services/passwordPolicy";
import {
  isValidRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_REQUIREMENTS_MESSAGE,
} from "../../services/recoveryCode";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "verify-recovery-code";

export function AuthScreen({
  onPasswordRecoveryVerified,
}: {
  onPasswordRecoveryVerified: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
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

    if (mode === "sign-up" && !isValidParentPassword(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (mode === "verify-recovery-code" && !isValidRecoveryCode(recoveryCode)) {
      setError(RECOVERY_CODE_REQUIREMENTS_MESSAGE);
      return;
    }

    setBusy(true);
    try {
      if (mode === "forgot-password") {
        await requestParentPasswordReset(normalizedEmail, Linking.createURL("reset-password"));
        setEmail(normalizedEmail);
        setRecoveryCode("");
        setNotice("Bu adresle kayıtlı bir hesap varsa 6 haneli parola yenileme kodunu gönderdik.");
        setMode("verify-recovery-code");
      } else if (mode === "verify-recovery-code") {
        await verifyParentPasswordRecoveryOtp(normalizedEmail, recoveryCode);
        onPasswordRecoveryVerified();
      } else if (mode === "sign-up") {
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
      setError(
        mode === "verify-recovery-code"
          ? "Kod doğrulanamadı. Kodu kontrol edin veya yeni bir kod isteyin."
          : submissionError instanceof Error
            ? submissionError.message
            : "İşlem tamamlanamadı.",
      );
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInParentWithGoogle();
    } catch (googleError) {
      setError(
        googleError instanceof Error ? googleError.message : "Google ile giriş tamamlanamadı.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle={
        mode === "verify-recovery-code"
          ? `${email} adresine gelen kodu yazın.`
          : "Hesap ebeveyne aittir. Çocuk uygulamaya ayrı bir kullanıcı olarak giriş yapmaz."
      }
      title={
        mode === "sign-up"
          ? "Ebeveyn hesabı oluştur"
          : mode === "forgot-password"
            ? "Parolamı unuttum"
            : mode === "verify-recovery-code"
              ? "Doğrulama kodunu gir"
              : "Ebeveyn girişi"
      }
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {notice ? <Text style={formStyles.success}>{notice}</Text> : null}

      {mode === "sign-in" || mode === "sign-up" ? (
        <>
          <Pressable
            disabled={busy}
            onPress={() => void continueWithGoogle()}
            style={[formStyles.providerButton, busy && formStyles.disabled]}
          >
            <Text style={formStyles.providerIcon}>G</Text>
            <Text style={formStyles.providerButtonText}>Google ile devam et</Text>
          </Pressable>
          <Text style={formStyles.separatorText}>veya e-posta ile</Text>
        </>
      ) : null}

      {mode === "verify-recovery-code" ? (
        <>
          <Text style={formStyles.fieldLabel}>6 haneli kod</Text>
          <TextInput
            editable={!busy}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => setRecoveryCode(normalizeRecoveryCode(value))}
            style={[formStyles.input, formStyles.codeInput]}
            textContentType="oneTimeCode"
            value={recoveryCode}
          />
          <Text style={formStyles.helper}>
            Kod kısa süre geçerlidir. Gelmediyse e-posta adresinizi ve gereksiz klasörünü kontrol
            edin.
          </Text>
        </>
      ) : (
        <>
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

          {mode !== "forgot-password" ? (
            <>
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
            </>
          ) : (
            <Text style={formStyles.helper}>
              Bu adresle bir hesap varsa e-postanıza 6 haneli bir yenileme kodu gönderilir.
            </Text>
          )}
          {mode === "sign-up" ? (
            <Text style={formStyles.helper}>En az 8 karakter, büyük/küçük harf ve rakam.</Text>
          ) : null}
        </>
      )}

      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[formStyles.primaryButton, busy && formStyles.disabled]}
      >
        <Text style={formStyles.primaryButtonText}>
          {busy
            ? "Bekleyin..."
            : mode === "sign-up"
              ? "Hesap oluştur"
              : mode === "forgot-password"
                ? "Yenileme kodu gönder"
                : mode === "verify-recovery-code"
                  ? "Kodu doğrula"
                  : "Giriş yap"}
        </Text>
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={() => {
          setError(null);
          setNotice(null);
          setRecoveryCode("");
          setMode((current) =>
            current === "forgot-password"
              ? "sign-in"
              : current === "verify-recovery-code"
                ? "forgot-password"
                : current === "sign-up"
                  ? "sign-in"
                  : "sign-up",
          );
        }}
        style={formStyles.secondaryButton}
      >
        <Text style={formStyles.secondaryButtonText}>
          {mode === "sign-up"
            ? "Zaten hesabım var"
            : mode === "forgot-password"
              ? "Giriş ekranına dön"
              : mode === "verify-recovery-code"
                ? "E-posta adresini değiştir"
                : "Yeni hesap oluştur"}
        </Text>
      </Pressable>
      {mode === "sign-in" ? (
        <Pressable
          disabled={busy}
          onPress={() => {
            setError(null);
            setNotice(null);
            setPassword("");
            setMode("forgot-password");
          }}
          style={formStyles.textButton}
        >
          <Text style={formStyles.textButtonText}>Parolamı unuttum</Text>
        </Pressable>
      ) : null}
      {mode === "verify-recovery-code" ? (
        <Pressable
          disabled={busy}
          onPress={() => {
            setError(null);
            setNotice(null);
            setRecoveryCode("");
            setMode("sign-in");
          }}
          style={formStyles.textButton}
        >
          <Text style={formStyles.textButtonText}>Giriş ekranına dön</Text>
        </Pressable>
      ) : null}
    </AccountShell>
  );
}
