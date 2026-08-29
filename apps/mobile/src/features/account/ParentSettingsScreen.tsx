import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const settingsItems: Array<{
  id: "pin" | "account" | "password" | "permissions";
  title: string;
  description: string;
  icon: IconName;
  color: string;
  background: string;
}> = [
  {
    id: "pin",
    title: "Ebeveyn PIN’ini değiştir",
    description: "Çocuk alanından çıkarken kullanılan 4 haneli kod",
    icon: "dialpad",
    color: "#7551AE",
    background: "#F2EAFB",
  },
  {
    id: "account",
    title: "Kullanıcı bilgileri",
    description: "Ebeveyn adı ve hesap e-postası",
    icon: "account-edit-outline",
    color: "#2D7E72",
    background: "#E4F4EF",
  },
  {
    id: "password",
    title: "Hesap şifresini değiştir",
    description: "Uygulamaya giriş yaparken kullanılan şifre",
    icon: "lock-reset",
    color: "#C96842",
    background: "#FCE9DE",
  },
  {
    id: "permissions",
    title: "İzinler",
    description: "Çocuk profillerinin veri ve kişiselleştirme tercihleri",
    icon: "shield-check-outline",
    color: "#3379A1",
    background: "#E3F1F8",
  },
];

export function ParentSettingsScreen({
  onBack,
  onOpenAccount,
  onOpenPassword,
  onOpenPermissions,
  onOpenPin,
}: {
  onBack: () => void;
  onOpenAccount: () => void;
  onOpenPassword: () => void;
  onOpenPermissions: () => void;
  onOpenPin: () => void;
}) {
  const actions = {
    account: onOpenAccount,
    password: onOpenPassword,
    permissions: onOpenPermissions,
    pin: onOpenPin,
  };

  return (
    <AccountShell
      subtitle="Hesabınızı, ebeveyn erişimini ve çocuk profili tercihlerini buradan yönetin."
      title="Ayarlar"
    >
      <View style={styles.menu}>
        {settingsItems.map((item) => (
          <Pressable
            accessibilityHint={item.description}
            accessibilityLabel={item.title}
            accessibilityRole="button"
            key={item.id}
            onPress={actions[item.id]}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <View style={[styles.iconBubble, { backgroundColor: item.background }]}>
              <MaterialCommunityIcons color={item.color} name={item.icon} size={28} />
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDescription}>{item.description}</Text>
            </View>
            <MaterialCommunityIcons color="#A8998D" name="chevron-right" size={28} />
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onBack} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Profil ekranına dön</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  menu: { gap: 11 },
  menuItem: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: "#EEE4DA",
    borderRadius: 19,
    backgroundColor: "#FFFCF8",
  },
  iconBubble: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  menuCopy: { flex: 1 },
  menuTitle: { color: "#3F352E", fontSize: 16, fontWeight: "900" },
  menuDescription: { marginTop: 3, color: "#786B61", fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
