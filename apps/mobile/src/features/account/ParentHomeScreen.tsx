import { type ChildProfile, calculateAgeInMonths, resolveAgeBand } from "@adaptive/shared-types";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { signOutParent } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { ChildConsentSettingsScreen } from "./ChildConsentSettingsScreen";
import { ChildProfileForm } from "./ChildProfileForm";
import { formStyles } from "./formStyles";
import { ParentSessionSummaryScreen } from "./ParentSessionSummaryScreen";
import { PasswordUpdateScreen } from "./PasswordUpdateScreen";

export function ParentHomeScreen({
  parentId,
  children,
  onChildCreated,
  onChildUpdated,
  onStartChildMode,
}: {
  parentId: string;
  children: ChildProfile[];
  onChildCreated: (profile: ChildProfile) => void;
  onChildUpdated: (profile: ChildProfile) => void;
  onStartChildMode: (profile: ChildProfile) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(children.length === 0);
  const [showPasswordSettings, setShowPasswordSettings] = useState(false);
  const [settingsChild, setSettingsChild] = useState<ChildProfile | null>(null);
  const [summaryChild, setSummaryChild] = useState<ChildProfile | null>(null);
  const [startingChildId, setStartingChildId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (showPasswordSettings) {
    return (
      <PasswordUpdateScreen
        mode="authenticated"
        onCancel={() => setShowPasswordSettings(false)}
        onCompleted={() => setShowPasswordSettings(false)}
      />
    );
  }

  if (settingsChild) {
    return (
      <ChildConsentSettingsScreen
        child={settingsChild}
        onBack={() => setSettingsChild(null)}
        onSaved={(profile) => {
          onChildUpdated(profile);
          setSettingsChild(null);
        }}
      />
    );
  }

  if (summaryChild) {
    return <ParentSessionSummaryScreen child={summaryChild} onBack={() => setSummaryChild(null)} />;
  }

  if (showForm) {
    return (
      <AccountShell
        subtitle="2–4 ve 5–7 yaş deneyimleri açık. Tam doğum günü istemiyoruz."
        title="Çocuk profili"
      >
        <ChildProfileForm
          onCancel={children.length > 0 ? () => setShowForm(false) : undefined}
          onCreated={(profile) => {
            onChildCreated(profile);
            setShowForm(false);
            setSettingsChild(profile);
          }}
          parentId={parentId}
        />
      </AccountShell>
    );
  }

  return (
    <AccountShell
      subtitle="Çocuk moduna geçmeden önce kullanacağınız profili seçin."
      title="Çocuk profilleri"
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {children.map((child) => {
        const ageBand = resolveAgeBand(child.birthMonth, child.birthYear);
        const ageInMonths = calculateAgeInMonths(child.birthMonth, child.birthYear);
        const canStart = ageBand === "2-4" || ageBand === "4-7";

        return (
          <View key={child.id} style={styles.childCard}>
            <View style={styles.childAvatar}>
              <Text style={styles.childInitial}>{child.nickname.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{child.nickname}</Text>
              <Text style={styles.childAge}>
                {ageInMonths} aylık · {ageBand ?? "desteklenmiyor"}
              </Text>
            </View>
            <View style={styles.childActions}>
              <Pressable onPress={() => setSummaryChild(child)} style={styles.summaryButton}>
                <Text style={styles.summaryButtonText}>Özet</Text>
              </Pressable>
              <Pressable onPress={() => setSettingsChild(child)} style={styles.settingsButton}>
                <Text style={styles.settingsButtonText}>İzinler</Text>
              </Pressable>
              <Pressable
                disabled={!canStart || startingChildId !== null}
                onPress={() => {
                  setError(null);
                  setStartingChildId(child.id);
                  void onStartChildMode(child)
                    .catch((startError) =>
                      setError(
                        startError instanceof Error ? startError.message : "Çocuk modu açılamadı.",
                      ),
                    )
                    .finally(() => setStartingChildId(null));
                }}
                style={[
                  styles.startButton,
                  (!canStart || startingChildId !== null) && formStyles.disabled,
                ]}
              >
                <Text style={styles.startButtonText}>
                  {startingChildId === child.id ? "Açılıyor..." : canStart ? "Başlat" : "Yakında"}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Pressable onPress={() => setShowForm(true)} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Yeni çocuk profili</Text>
      </Pressable>
      <Pressable onPress={() => setShowPasswordSettings(true)} style={styles.passwordButton}>
        <Text style={styles.passwordButtonText}>Parolayı değiştir</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setError(null);
          void signOutParent().catch((signOutError) =>
            setError(signOutError instanceof Error ? signOutError.message : "Çıkış yapılamadı."),
          );
        }}
        style={styles.signOutButton}
      >
        <Text style={styles.signOutText}>Hesaptan çık</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 13,
    padding: 13,
    borderWidth: 2,
    borderColor: "#E9DDCF",
    borderRadius: 18,
    backgroundColor: "#FFFCF7",
  },
  childAvatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#F7CDB7",
  },
  childInitial: { color: "#704D3B", fontSize: 23, fontWeight: "900" },
  childInfo: { flex: 1 },
  childName: { color: "#3F352E", fontSize: 19, fontWeight: "900" },
  childAge: { marginTop: 3, color: "#75685E", fontSize: 13 },
  childActions: { gap: 7 },
  settingsButton: {
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#EAF5F2",
  },
  summaryButton: {
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F7EEF9",
  },
  summaryButtonText: { color: "#75547E", fontSize: 12, fontWeight: "900" },
  settingsButtonText: { color: "#216D61", fontSize: 12, fontWeight: "900" },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2D8C7C",
  },
  startButtonText: { color: "#FFFFFF", fontWeight: "900" },
  passwordButton: { alignItems: "center", marginTop: 12, padding: 10 },
  passwordButtonText: { color: "#216D61", fontSize: 14, fontWeight: "800" },
  signOutButton: { alignItems: "center", marginTop: 19, padding: 10 },
  signOutText: { color: "#795D51", fontSize: 14, fontWeight: "700" },
});
