import { type ChildProfile, calculateAgeInMonths, resolveAgeBand } from "@adaptive/shared-types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

export function PermissionProfileSelectionScreen({
  children,
  onBack,
  onSelectChild,
}: {
  children: ChildProfile[];
  onBack: () => void;
  onSelectChild: (child: ChildProfile) => void;
}) {
  return (
    <AccountShell
      subtitle="İzinlerini düzenlemek istediğiniz çocuk profilini seçin."
      title="İzinler"
    >
      <View style={styles.profileList}>
        {children.map((child) => {
          const ageInMonths = calculateAgeInMonths(child.birthMonth, child.birthYear);
          return (
            <Pressable
              accessibilityLabel={`${child.nickname} izinlerini aç`}
              accessibilityRole="button"
              key={child.id}
              onPress={() => onSelectChild(child)}
              style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{child.nickname.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>{child.nickname}</Text>
                <Text style={styles.profileAge}>
                  {ageInMonths} aylık · {resolveAgeBand(child.birthMonth, child.birthYear)}
                </Text>
              </View>
              <View style={styles.shieldBubble}>
                <MaterialCommunityIcons color="#2D7E72" name="shield-check-outline" size={27} />
              </View>
              <MaterialCommunityIcons color="#A8998D" name="chevron-right" size={28} />
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onBack} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Ayarlara dön</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  profileList: { gap: 11 },
  profileCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: "#E9DDCF",
    borderRadius: 19,
    backgroundColor: "#FFFCF7",
  },
  avatar: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    backgroundColor: "#F7CDB7",
  },
  avatarText: { color: "#704D3B", fontSize: 22, fontWeight: "900" },
  profileCopy: { flex: 1 },
  profileName: { color: "#3F352E", fontSize: 17, fontWeight: "900" },
  profileAge: { marginTop: 3, color: "#75685E", fontSize: 12 },
  shieldBubble: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#E4F4EF",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
