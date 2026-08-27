import { type ChildProfile, calculateAgeInMonths, resolveAgeBand } from "@adaptive/shared-types";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { signOutParent } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { ChildProfileForm } from "./ChildProfileForm";
import { formStyles } from "./formStyles";

export function ParentHomeScreen({
  parentId,
  children,
  onChildCreated,
  onStartChildMode,
}: {
  parentId: string;
  children: ChildProfile[];
  onChildCreated: (profile: ChildProfile) => void;
  onStartChildMode: (profile: ChildProfile) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(children.length === 0);
  const [startingChildId, setStartingChildId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (showForm) {
    return (
      <AccountShell
        subtitle="Şimdilik yalnızca 2–4 yaş deneyimini geliştiriyoruz. Tam doğum günü istemiyoruz."
        title="Çocuk profili"
      >
        <ChildProfileForm
          onCancel={children.length > 0 ? () => setShowForm(false) : undefined}
          onCreated={(profile) => {
            onChildCreated(profile);
            setShowForm(false);
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
        const canStart = ageBand === "2-4";

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
        );
      })}

      <Pressable onPress={() => setShowForm(true)} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Yeni çocuk profili</Text>
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
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2D8C7C",
  },
  startButtonText: { color: "#FFFFFF", fontWeight: "900" },
  signOutButton: { alignItems: "center", marginTop: 19, padding: 10 },
  signOutText: { color: "#795D51", fontSize: 14, fontWeight: "700" },
});
