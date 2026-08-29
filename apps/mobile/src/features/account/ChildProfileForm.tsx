import { type ChildProfile, type ChildProfileInput, resolveAgeBand } from "@adaptive/shared-types";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createChildProfile } from "../../services/account";
import { formStyles } from "./formStyles";

export function ChildProfileForm({
  parentId,
  onCreated,
  onCancel,
}: {
  parentId: string;
  onCreated: (profile: ChildProfile) => void;
  onCancel?: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const month = Number(birthMonth);
    const year = Number(birthYear);

    if (nickname.trim().length < 1 || nickname.trim().length > 40) {
      setError("1–40 karakter arasında bir takma ad yazın.");
      return;
    }

    let ageBand: ReturnType<typeof resolveAgeBand>;
    try {
      ageBand = resolveAgeBand(month, year);
    } catch {
      setError("Doğum ayı ve yılını kontrol edin.");
      return;
    }

    if (ageBand !== "2-4" && ageBand !== "4-7") {
      setError("Bu sürüm 24–83 aylık çocuk profillerini destekliyor.");
      return;
    }

    const input: ChildProfileInput = {
      nickname: nickname.trim(),
      birthMonth: month,
      birthYear: year,
      contentLocale: "tr-TR",
      favoriteAnimals: [],
      favoriteToys: [],
      interests: [],
    };

    setBusy(true);
    try {
      onCreated(await createChildProfile(parentId, input));
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Profil oluşturulamadı.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error ? <Text style={formStyles.error}>{error}</Text> : null}

      <Text style={formStyles.fieldLabel}>Takma ad</Text>
      <TextInput
        autoCapitalize="words"
        editable={!busy}
        maxLength={40}
        onChangeText={setNickname}
        placeholder="Örneğin Ece"
        style={formStyles.input}
        value={nickname}
      />
      <Text style={formStyles.helper}>Gerçek ad veya soyad kullanmak zorunda değilsiniz.</Text>

      <View style={formStyles.row}>
        <View style={formStyles.rowField}>
          <Text style={formStyles.fieldLabel}>Doğum ayı</Text>
          <TextInput
            editable={!busy}
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={setBirthMonth}
            placeholder="1–12"
            style={formStyles.input}
            value={birthMonth}
          />
        </View>
        <View style={formStyles.rowField}>
          <Text style={formStyles.fieldLabel}>Doğum yılı</Text>
          <TextInput
            editable={!busy}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setBirthYear}
            placeholder="2023"
            style={formStyles.input}
            value={birthYear}
          />
        </View>
      </View>

      <Text style={formStyles.helper}>
        Sevdiği hayvanlar, oyuncaklar ve ilgi alanları yalnızca kişiselleştirmeyi açarsanız sonraki
        ekranda istenir.
      </Text>

      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[formStyles.primaryButton, busy && formStyles.disabled]}
      >
        <Text style={formStyles.primaryButtonText}>
          {busy ? "Kaydediliyor..." : "Çocuk profilini oluştur"}
        </Text>
      </Pressable>
      {onCancel ? (
        <Pressable disabled={busy} onPress={onCancel} style={formStyles.secondaryButton}>
          <Text style={formStyles.secondaryButtonText}>Vazgeç</Text>
        </Pressable>
      ) : null}
    </>
  );
}
