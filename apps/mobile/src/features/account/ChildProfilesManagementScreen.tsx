import { type ChildProfile, resolveAgeBand } from "@adaptive/shared-types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteChildProfile, updateChildProfile } from "../../services/account";
import { AccountShell } from "./AccountShell";
import { formatChildAge } from "./childAge";
import { formStyles } from "./formStyles";

export function ChildProfilesManagementScreen({
  children,
  onBack,
  onDeleted,
  onUpdated,
}: {
  children: ChildProfile[];
  onBack: () => void;
  onDeleted: (childId: string) => void;
  onUpdated: (profile: ChildProfile) => void;
}) {
  const [editing, setEditing] = useState<ChildProfile | null>(null);
  const [nickname, setNickname] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const beginEditing = (child: ChildProfile) => {
    setError(null);
    setEditing(child);
    setNickname(child.nickname);
    setBirthMonth(String(child.birthMonth));
    setBirthYear(String(child.birthYear));
  };

  const save = async () => {
    if (!editing) return;
    const month = Number(birthMonth);
    const year = Number(birthYear);
    if (nickname.trim().length < 1 || nickname.trim().length > 40) {
      setError("1–40 karakter arasında bir takma ad yazın.");
      return;
    }
    try {
      const ageBand = resolveAgeBand(month, year, now);
      if (ageBand !== "2-4" && ageBand !== "4-7") {
        setError("Bu sürüm 24–83 aylık çocuk profillerini destekliyor.");
        return;
      }
    } catch {
      setError("Doğum ayı ve yılını kontrol edin.");
      return;
    }

    setBusyId(editing.id);
    setError(null);
    try {
      const profile = await updateChildProfile(editing.id, {
        nickname: nickname.trim(),
        birthMonth: month,
        birthYear: year,
      });
      onUpdated(profile);
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Profil güncellenemedi.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (child: ChildProfile) => {
    Alert.alert(
      `${child.nickname} profilini sil?`,
      "Bu profile bağlı etkinlik ve kişiselleştirme kayıtları kalıcı olarak silinir.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Profili sil",
          style: "destructive",
          onPress: () => {
            setBusyId(child.id);
            setError(null);
            void deleteChildProfile(child.id)
              .then(() => {
                if (editing?.id === child.id) setEditing(null);
                onDeleted(child.id);
              })
              .catch((deleteError) =>
                setError(
                  deleteError instanceof Error ? deleteError.message : "Profil silinemedi.",
                ),
              )
              .finally(() => setBusyId(null));
          },
        },
      ],
    );
  };

  return (
    <AccountShell
      alignFromTop
      subtitle="Takma ad ve doğum bilgilerini güncelleyin veya artık kullanılmayan profili silin."
      title="Çocuk profillerini düzenle"
    >
      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {children.length === 0 ? <Text style={styles.empty}>Henüz çocuk profili yok.</Text> : null}
      {children.map((child) => {
        const isEditing = editing?.id === child.id;
        const isBusy = busyId === child.id;
        return (
          <View key={child.id} style={styles.card}>
            <View style={styles.heading}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{child.nickname.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{child.nickname}</Text>
                <Text style={styles.age}>{formatChildAge(child.birthMonth, child.birthYear, now)}</Text>
                <Text style={styles.birthDate}>
                  Doğum: {String(child.birthMonth).padStart(2, "0")}/{child.birthYear}
                </Text>
              </View>
            </View>

            {isEditing ? (
              <View style={styles.editor}>
                <Text style={formStyles.fieldLabel}>Takma ad</Text>
                <TextInput
                  editable={!isBusy}
                  maxLength={40}
                  onChangeText={setNickname}
                  style={formStyles.input}
                  value={nickname}
                />
                <View style={formStyles.row}>
                  <View style={formStyles.rowField}>
                    <Text style={formStyles.fieldLabel}>Doğum ayı</Text>
                    <TextInput
                      editable={!isBusy}
                      keyboardType="number-pad"
                      maxLength={2}
                      onChangeText={setBirthMonth}
                      style={formStyles.input}
                      value={birthMonth}
                    />
                  </View>
                  <View style={formStyles.rowField}>
                    <Text style={formStyles.fieldLabel}>Doğum yılı</Text>
                    <TextInput
                      editable={!isBusy}
                      keyboardType="number-pad"
                      maxLength={4}
                      onChangeText={setBirthYear}
                      style={formStyles.input}
                      value={birthYear}
                    />
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable disabled={isBusy} onPress={() => setEditing(null)} style={styles.cancelButton}>
                    <Text style={styles.cancelText}>Vazgeç</Text>
                  </Pressable>
                  <Pressable disabled={isBusy} onPress={() => void save()} style={styles.saveButton}>
                    <Text style={styles.saveText}>{isBusy ? "Kaydediliyor..." : "Kaydet"}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable disabled={busyId !== null} onPress={() => beginEditing(child)} style={styles.editButton}>
                  <MaterialCommunityIcons color="#216D61" name="pencil-outline" size={20} />
                  <Text style={styles.editText}>Düzenle</Text>
                </Pressable>
                <Pressable disabled={busyId !== null} onPress={() => confirmDelete(child)} style={styles.deleteButton}>
                  <MaterialCommunityIcons color="#A44141" name="trash-can-outline" size={20} />
                  <Text style={styles.deleteText}>{isBusy ? "Siliniyor..." : "Sil"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
      <Pressable disabled={busyId !== null} onPress={onBack} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Ayarlara dön</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, padding: 15, borderWidth: 2, borderColor: "#E9DDCF", borderRadius: 20, backgroundColor: "#FFFCF7" },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: "#F7CDB7" },
  avatarText: { color: "#704D3B", fontSize: 23, fontWeight: "900" },
  copy: { flex: 1 },
  name: { color: "#3F352E", fontSize: 19, fontWeight: "900" },
  age: { marginTop: 3, color: "#216D61", fontSize: 14, fontWeight: "800" },
  birthDate: { marginTop: 2, color: "#7C7067", fontSize: 12 },
  editor: { marginTop: 16 },
  actions: { flexDirection: "row", gap: 9, marginTop: 14 },
  editButton: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 14, backgroundColor: "#EAF5F2" },
  editText: { color: "#216D61", fontWeight: "900" },
  deleteButton: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 14, backgroundColor: "#FBE9E7" },
  deleteText: { color: "#A44141", fontWeight: "900" },
  cancelButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#EEE8E1" },
  cancelText: { color: "#665A51", fontWeight: "900" },
  saveButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#2D8C7C" },
  saveText: { color: "#FFFFFF", fontWeight: "900" },
  empty: { color: "#75685E", textAlign: "center" },
});
