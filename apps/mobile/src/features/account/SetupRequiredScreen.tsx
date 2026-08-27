import { Text } from "react-native";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

export function SetupRequiredScreen() {
  return (
    <AccountShell
      subtitle="Hesap ekranını çalıştırmak için mobil uygulamanın Supabase proje bilgilerine ihtiyacı var."
      title="Supabase bağlantısı gerekli"
    >
      <Text style={formStyles.error}>
        apps/mobile/.env dosyasında EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        değerlerini tanımlayın.
      </Text>
      <Text style={formStyles.helper}>
        Örnek dosya: apps/mobile/.env.example. Secret veya service-role anahtarını mobil uygulamaya
        koymayın.
      </Text>
    </AccountShell>
  );
}
