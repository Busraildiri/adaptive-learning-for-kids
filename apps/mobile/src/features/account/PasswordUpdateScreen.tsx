import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import {
  changeParentPassword,
  requestCurrentParentPasswordReset,
  updateRecoveredParentPassword,
  verifyParentPasswordRecoveryOtp,
} from "../../services/account";
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

export function PasswordUpdateScreen({
  mode,
  onCancel,
  onCompleted,
}: {
  mode: "authenticated" | "recovery";
  onCancel?: () => void;
  onCompleted: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const awaitingRecoveryCode =
    mode === "authenticated" && recoveryEmail !== null && !recoveryVerified;
  const effectiveMode = mode === "recovery" || recoveryVerified ? "recovery" : "authenticated";

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (effectiveMode === "authenticated" && !currentPassword) {
      setError("Mevcut parolanızı yazın.");
      return;
    }

    if (!isValidParentPassword(newPassword)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (newPassword !== confirmation) {
      setError("Yeni parola ve tekrarı eşleşmiyor.");
      return;
    }

    if (effectiveMode === "authenticated" && currentPassword === newPassword) {
      setError("Yeni parola mevcut paroladan farklı olmalı.");
      return;
    }

    setBusy(true);
    try {
      if (effectiveMode === "recovery") {
        await updateRecoveredParentPassword(newPassword);
      } else {
        await changeParentPassword(currentPassword, newPassword);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setCompleted(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Parola güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const sendRecoveryEmail = async () => {
    setError(null);
    setNotice(null);
    setRecoveryBusy(true);
    try {
      const email = await requestCurrentParentPasswordReset(Linking.createURL("reset-password"));
      setRecoveryEmail(email);
      setRecoveryCode("");
      setNotice("6 haneli parola yenileme kodunu kayıtlı e-posta adresinize gönderdik.");
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error ? recoveryError.message : "Yenileme kodu gönderilemedi.",
      );
    } finally {
      setRecoveryBusy(false);
    }
  };

  const verifyRecoveryCode = async () => {
    setError(null);
    setNotice(null);

    if (!recoveryEmail || !isValidRecoveryCode(recoveryCode)) {
      setError(RECOVERY_CODE_REQUIREMENTS_MESSAGE);
      return;
    }

    setRecoveryBusy(true);
    try {
      await verifyParentPasswordRecoveryOtp(recoveryEmail, recoveryCode);
      setCurrentPassword("");
      setRecoveryVerified(true);
      setNotice("Kod doğrulandı. Şimdi yeni parolanızı belirleyin.");
    } catch {
      setError("Kod doğrulanamadı. Kodu kontrol edin veya yeni bir kod isteyin.");
    } finally {
      setRecoveryBusy(false);
    }
  };

  const returnToCurrentPassword = () => {
    setError(null);
    setNotice(null);
    setRecoveryEmail(null);
    setRecoveryCode("");
  };

  return (
    <AccountShell
      subtitle={
        awaitingRecoveryCode
          ? `${recoveryEmail} adresine gelen kodu yazın.`
          : effectiveMode === "recovery"
            ? "Hesabınız için yeni bir parola belirleyin."
            : "Parolayı değiştirmek için önce mevcut parolanızı doğrulayın."
      }
      title={
        awaitingRecoveryCode
          ? "Doğrulama kodunu gir"
          : effectiveMode === "recovery"
            ? "Yeni parola belirle"
            : "Parolayı değiştir"
      }
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {notice ? <Text style={formStyles.success}>{notice}</Text> : null}
      {completed ? (
        <>
          <Text style={formStyles.success}>Parolanız başarıyla güncellendi.</Text>
          <Pressable onPress={onCompleted} style={formStyles.primaryButton}>
            <Text style={formStyles.primaryButtonText}>
              {mode === "recovery" ? "Hesabıma devam et" : "Profil ekranına dön"}
            </Text>
          </Pressable>
        </>
      ) : awaitingRecoveryCode ? (
        <>
          <Text style={formStyles.fieldLabel}>6 haneli kod</Text>
          <TextInput
            editable={!recoveryBusy}
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
          <Pressable
            disabled={recoveryBusy}
            onPress={() => void verifyRecoveryCode()}
            style={[formStyles.primaryButton, recoveryBusy && formStyles.disabled]}
          >
            <Text style={formStyles.primaryButtonText}>
              {recoveryBusy ? "Doğrulanıyor..." : "Kodu doğrula"}
            </Text>
          </Pressable>
          <Pressable
            disabled={recoveryBusy}
            onPress={() => void sendRecoveryEmail()}
            style={formStyles.textButton}
          >
            <Text style={formStyles.textButtonText}>Yeni kod gönder</Text>
          </Pressable>
          <Pressable
            disabled={recoveryBusy}
            onPress={returnToCurrentPassword}
            style={formStyles.secondaryButton}
          >
            <Text style={formStyles.secondaryButtonText}>Mevcut parolayla değiştirmeye dön</Text>
          </Pressable>
          {onCancel ? (
            <Pressable disabled={recoveryBusy} onPress={onCancel} style={formStyles.textButton}>
              <Text style={formStyles.textButtonText}>Vazgeç</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          {effectiveMode === "authenticated" ? (
            <>
              <Text style={formStyles.fieldLabel}>Mevcut parola</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!busy}
                maxLength={128}
                onChangeText={setCurrentPassword}
                secureTextEntry
                style={formStyles.input}
                value={currentPassword}
              />
            </>
          ) : null}

          <Text style={formStyles.fieldLabel}>Yeni parola</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!busy}
            maxLength={128}
            onChangeText={setNewPassword}
            secureTextEntry
            style={formStyles.input}
            value={newPassword}
          />
          <Text style={formStyles.helper}>En az 8 karakter, büyük/küçük harf ve rakam.</Text>

          <Text style={formStyles.fieldLabel}>Yeni parola tekrar</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!busy}
            maxLength={128}
            onChangeText={setConfirmation}
            secureTextEntry
            style={formStyles.input}
            value={confirmation}
          />

          <Pressable
            disabled={busy || recoveryBusy}
            onPress={() => void submit()}
            style={[formStyles.primaryButton, (busy || recoveryBusy) && formStyles.disabled]}
          >
            <Text style={formStyles.primaryButtonText}>
              {busy ? "Güncelleniyor..." : "Parolayı güncelle"}
            </Text>
          </Pressable>
          {effectiveMode === "authenticated" ? (
            <Pressable
              disabled={busy || recoveryBusy}
              onPress={() => void sendRecoveryEmail()}
              style={formStyles.textButton}
            >
              <Text style={formStyles.textButtonText}>
                {recoveryBusy ? "Kod gönderiliyor..." : "Mevcut parolamı unuttum"}
              </Text>
            </Pressable>
          ) : null}
          {onCancel ? (
            <Pressable
              disabled={busy || recoveryBusy}
              onPress={onCancel}
              style={formStyles.secondaryButton}
            >
              <Text style={formStyles.secondaryButtonText}>Vazgeç</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </AccountShell>
  );
}

export function PasswordRecoveryErrorScreen({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <AccountShell
      subtitle="Yeni bir kod istemek için giriş ekranına dönebilirsiniz."
      title="Bağlantı kullanılamadı"
    >
      <Text style={formStyles.error}>{message}</Text>
      <Pressable onPress={onDismiss} style={formStyles.primaryButton}>
        <Text style={formStyles.primaryButtonText}>Giriş ekranına dön</Text>
      </Pressable>
    </AccountShell>
  );
}
