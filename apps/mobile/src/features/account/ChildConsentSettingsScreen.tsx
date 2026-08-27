import type { ChildConsentSettings, ChildProfile } from "@adaptive/shared-types";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  loadChildConsentSettings,
  setChildConsent,
  setChildPersonalization,
} from "../../services/consents";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

function parseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 10);
}

export function ChildConsentSettingsScreen({
  child,
  onBack,
  onSaved,
}: {
  child: ChildProfile;
  onBack: () => void;
  onSaved: (profile: ChildProfile) => void;
}) {
  const [settings, setSettings] = useState<ChildConsentSettings | null>(null);
  const [favoriteAnimals, setFavoriteAnimals] = useState(child.favoriteAnimals.join(", "));
  const [favoriteToys, setFavoriteToys] = useState(child.favoriteToys.join(", "));
  const [interests, setInterests] = useState(child.interests.join(", "));
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void loadChildConsentSettings(child.id)
      .then((loadedSettings) => {
        if (mounted) setSettings(loadedSettings);
      })
      .catch((loadError) => {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "İzinler yüklenemedi.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [child.id, reloadToken]);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);

    const optionalProfileData = {
      favoriteAnimals: parseList(favoriteAnimals),
      favoriteToys: parseList(favoriteToys),
      interests: parseList(interests),
    };

    try {
      await setChildPersonalization(child.id, settings.personalization, optionalProfileData);
      await Promise.all([
        setChildConsent(child.id, "learning_observations", settings.learning_observations),
        setChildConsent(
          child.id,
          "anonymous_product_improvement",
          settings.anonymous_product_improvement,
        ),
      ]);

      onSaved({
        ...child,
        favoriteAnimals: settings.personalization ? optionalProfileData.favoriteAnimals : [],
        favoriteToys: settings.personalization ? optionalProfileData.favoriteToys : [],
        interests: settings.personalization ? optionalProfileData.interests : [],
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "İzinler kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell
      subtitle={`${child.nickname} için isteğe bağlı özellikleri ayrı ayrı seçebilirsiniz.`}
      title="İzinler ve tercihler"
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color="#2D8C7C" size="large" />
      ) : !settings ? (
        <>
          <Pressable
            onPress={() => setReloadToken((current) => current + 1)}
            style={formStyles.primaryButton}
          >
            <Text style={formStyles.primaryButtonText}>Tekrar dene</Text>
          </Pressable>
          <Pressable onPress={onBack} style={formStyles.secondaryButton}>
            <Text style={formStyles.secondaryButtonText}>Geri dön</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ConsentRow
            description="Açarsanız sevdiği hayvan, oyuncak ve ilgi alanları hikâyeyi uyarlamak için kullanılır. Kapatınca bu alanlar silinir."
            disabled={busy}
            label="Kişiselleştirme"
            onValueChange={(personalization) =>
              setSettings((current) => (current ? { ...current, personalization } : current))
            }
            value={settings.personalization}
          />

          {settings.personalization ? (
            <View style={styles.optionalFields}>
              <Text style={formStyles.fieldLabel}>Sevdiği hayvanlar</Text>
              <TextInput
                editable={!busy}
                maxLength={500}
                onChangeText={setFavoriteAnimals}
                placeholder="tavşan, kedi"
                style={formStyles.input}
                value={favoriteAnimals}
              />
              <Text style={formStyles.fieldLabel}>Sevdiği oyuncaklar</Text>
              <TextInput
                editable={!busy}
                maxLength={500}
                onChangeText={setFavoriteToys}
                placeholder="balon, bloklar"
                style={formStyles.input}
                value={favoriteToys}
              />
              <Text style={formStyles.fieldLabel}>İlgi alanları</Text>
              <TextInput
                editable={!busy}
                maxLength={500}
                onChangeText={setInterests}
                placeholder="renkler, araçlar"
                style={formStyles.input}
                value={interests}
              />
              <Text style={formStyles.helper}>Değerleri virgülle ayırabilirsiniz.</Text>
            </View>
          ) : null}

          <ConsentRow
            description="2–4 yaşta ebeveyn tercihiyle açılabilir. İzin tek başına gözlem üretmez; yeterli ve güvenilir etkileşim gerekir. Tanı, puan veya akran karşılaştırması yapılmaz."
            disabled={busy}
            label="Öğrenme gözlemleri"
            onValueChange={(learning_observations) =>
              setSettings((current) => (current ? { ...current, learning_observations } : current))
            }
            value={settings.learning_observations}
          />

          <ConsentRow
            description="Temel kullanımın koşulu değildir. Yeni profilde açık başlar ve istediğiniz zaman kapatılabilir. Anonim aktarım hattı henüz kurulmadığı için bu sürümde veri göndermez."
            disabled={busy}
            label="Anonim ürün geliştirme"
            onValueChange={(anonymous_product_improvement) =>
              setSettings((current) =>
                current ? { ...current, anonymous_product_improvement } : current,
              )
            }
            value={settings.anonymous_product_improvement}
          />

          <Text style={styles.legalDraft}>
            Bu izin metinleri geliştirme taslağıdır; çocuklarla pilot öncesinde hukuk ve etik
            incelemeden geçirilecektir.
          </Text>
          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={[formStyles.primaryButton, busy && formStyles.disabled]}
          >
            <Text style={formStyles.primaryButtonText}>
              {busy ? "Kaydediliyor..." : "Tercihleri kaydet"}
            </Text>
          </Pressable>
          <Pressable disabled={busy} onPress={onBack} style={formStyles.secondaryButton}>
            <Text style={formStyles.secondaryButtonText}>Geri dön</Text>
          </Pressable>
        </>
      )}
    </AccountShell>
  );
}

function ConsentRow({
  description,
  disabled,
  label,
  onValueChange,
  value,
}: {
  description: string;
  disabled: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.consentCard}>
      <View style={styles.consentCopy}>
        <Text style={styles.consentLabel}>{label}</Text>
        <Text style={styles.consentDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={`${label}: ${value ? "açık" : "kapalı"}`}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: "#CFC7BE", true: "#87C9BC" }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  consentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    padding: 15,
    borderWidth: 2,
    borderColor: "#E9DDCF",
    borderRadius: 17,
    backgroundColor: "#FFFCF7",
  },
  consentCopy: { flex: 1 },
  consentLabel: { color: "#3F352E", fontSize: 17, fontWeight: "900" },
  consentDescription: { marginTop: 5, color: "#6F6258", fontSize: 13, lineHeight: 19 },
  optionalFields: {
    marginTop: -3,
    marginBottom: 15,
    padding: 15,
    borderRadius: 17,
    backgroundColor: "#F1F8F6",
  },
  legalDraft: { marginVertical: 5, color: "#776A60", fontSize: 12, lineHeight: 17 },
});
