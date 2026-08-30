import { type ChildProfile, calculateAgeInMonths, resolveAgeBand } from "@adaptive/shared-types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { signOutParent } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { ChildConsentSettingsScreen } from "./ChildConsentSettingsScreen";
import { ChildProfileForm } from "./ChildProfileForm";
import { ChildProfilesManagementScreen } from "./ChildProfilesManagementScreen";
import { formStyles } from "./formStyles";
import { ParentAccountInfoScreen } from "./ParentAccountInfoScreen";
import { ParentPinUpdateScreen } from "./ParentPinUpdateScreen";
import { ParentSessionSummaryScreen } from "./ParentSessionSummaryScreen";
import { ParentSettingsScreen } from "./ParentSettingsScreen";
import { PasswordUpdateScreen } from "./PasswordUpdateScreen";
import { PermissionProfileSelectionScreen } from "./PermissionProfileSelectionScreen";

type ParentPanel =
  | "home"
  | "settings"
  | "pin"
  | "account"
  | "password"
  | "permissions"
  | "children";

export function ParentHomeScreen({
  parentId,
  parentDisplayName,
  parentEmail,
  children,
  onChildCreated,
  onChildUpdated,
  onChildDeleted,
  onStartChildMode,
}: {
  parentId: string;
  parentDisplayName: string;
  parentEmail: string;
  children: ChildProfile[];
  onChildCreated: (profile: ChildProfile) => void;
  onChildUpdated: (profile: ChildProfile) => void;
  onChildDeleted: (childId: string) => void;
  onStartChildMode: (profile: ChildProfile) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(children.length === 0);
  const [panel, setPanel] = useState<ParentPanel>("home");
  const [settingsChild, setSettingsChild] = useState<ChildProfile | null>(null);
  const [summaryChild, setSummaryChild] = useState<ChildProfile | null>(null);
  const [startingChildId, setStartingChildId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (panel === "password") {
    return (
      <PasswordUpdateScreen
        mode="authenticated"
        onCancel={() => setPanel("settings")}
        onCompleted={() => setPanel("settings")}
      />
    );
  }

  if (panel === "pin") {
    return <ParentPinUpdateScreen onBack={() => setPanel("settings")} />;
  }

  if (panel === "account") {
    return (
      <ParentAccountInfoScreen
        childCount={children.length}
        initialDisplayName={parentDisplayName}
        initialEmail={parentEmail}
        onBack={() => setPanel("settings")}
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

  if (panel === "permissions") {
    return (
      <PermissionProfileSelectionScreen
        children={children}
        onBack={() => setPanel("settings")}
        onSelectChild={setSettingsChild}
      />
    );
  }

  if (panel === "children") {
    return (
      <ChildProfilesManagementScreen
        children={children}
        onBack={() => setPanel("settings")}
        onDeleted={onChildDeleted}
        onUpdated={onChildUpdated}
      />
    );
  }

  if (panel === "settings") {
    return (
      <ParentSettingsScreen
        onBack={() => setPanel("home")}
        onOpenAccount={() => setPanel("account")}
        onOpenPassword={() => setPanel("password")}
        onOpenChildren={() => setPanel("children")}
        onOpenPermissions={() => setPanel("permissions")}
        onOpenPin={() => setPanel("pin")}
      />
    );
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
      <Pressable onPress={() => setPanel("settings")} style={styles.settingsMenuButton}>
        <MaterialCommunityIcons color="#216D61" name="cog-outline" size={23} />
        <Text style={styles.settingsMenuButtonText}>Ayarlar</Text>
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
  summaryButton: {
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F7EEF9",
  },
  summaryButtonText: { color: "#75547E", fontSize: 12, fontWeight: "900" },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2D8C7C",
  },
  startButtonText: { color: "#FFFFFF", fontWeight: "900" },
  settingsMenuButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: "#F1F8F6",
  },
  settingsMenuButtonText: { color: "#216D61", fontSize: 15, fontWeight: "900" },
  signOutButton: { alignItems: "center", marginTop: 19, padding: 10 },
  signOutText: { color: "#795D51", fontSize: 14, fontWeight: "700" },
});
