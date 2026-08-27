import {
  type ChildProfile,
  type ChildSessionProfile,
  createChildSessionProfile,
  resolveAgeBand,
} from "@adaptive/shared-types";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { AccountLoadErrorScreen } from "./features/account/AccountLoadErrorScreen";
import { AuthScreen } from "./features/account/AuthScreen";
import { GuardianOnboardingScreen } from "./features/account/GuardianOnboardingScreen";
import { ParentHomeScreen } from "./features/account/ParentHomeScreen";
import { ParentPinGate } from "./features/account/ParentPinGate";
import {
  PasswordRecoveryErrorScreen,
  PasswordUpdateScreen,
} from "./features/account/PasswordUpdateScreen";
import { SetupRequiredScreen } from "./features/account/SetupRequiredScreen";
import { MinoStory } from "./features/story/MinoStory";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { loadChildProfiles, loadParentProfile } from "./services/account";
import { completePasswordRecoveryRedirect, isPasswordRecoveryUrl } from "./services/authDeepLink";
import {
  clearPersistedActiveChildId,
  getPersistedActiveChildId,
  persistActiveChildId,
} from "./services/childMode";
import { loadChildConsentSettings } from "./services/consents";

type PasswordRecoveryStatus = "checking" | "idle" | "processing" | "ready" | "error";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [parentOnboarded, setParentOnboarded] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<ChildSessionProfile | null>(null);
  const [showParentPinGate, setShowParentPinGate] = useState(false);
  const [passwordRecoveryStatus, setPasswordRecoveryStatus] =
    useState<PasswordRecoveryStatus>("checking");
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);
  const handledRecoveryUrl = useRef<string | null>(null);

  const refreshAccount = useCallback(async (userId: string) => {
    setLoadingAccount(true);
    setAccountError(null);
    try {
      const parentProfile = await loadParentProfile(userId);
      const onboardingComplete = Boolean(parentProfile?.pin_configured_at);
      setParentOnboarded(onboardingComplete);
      const childProfiles = onboardingComplete ? await loadChildProfiles() : [];
      setChildren(childProfiles);

      const activeChildId = onboardingComplete ? await getPersistedActiveChildId() : null;
      const persistedChild = childProfiles.find((child) => child.id === activeChildId);
      if (
        persistedChild &&
        resolveAgeBand(persistedChild.birthMonth, persistedChild.birthYear) === "2-4"
      ) {
        const consentSettings = await loadChildConsentSettings(persistedChild.id);
        setActiveChild(
          createChildSessionProfile(persistedChild, {
            personalizationEnabled: consentSettings.personalization,
          }),
        );
      } else {
        setActiveChild(null);
        if (activeChildId) await clearPersistedActiveChildId();
      }
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Hesap bilgileri yüklenemedi.");
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryError(null);
        setPasswordRecoveryStatus("ready");
      }
      if (!nextSession) {
        setAccountError(null);
        setParentOnboarded(false);
        setChildren([]);
        setActiveChild(null);
        setShowParentPinGate(false);
        void clearPersistedActiveChildId();
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleUrl = async (url: string | null) => {
      if (!url || !isPasswordRecoveryUrl(url)) {
        if (mounted) {
          setPasswordRecoveryStatus((current) => (current === "checking" ? "idle" : current));
        }
        return;
      }

      if (handledRecoveryUrl.current === url) return;
      handledRecoveryUrl.current = url;
      setPasswordRecoveryError(null);
      setPasswordRecoveryStatus("processing");

      try {
        await completePasswordRecoveryRedirect(url);
        if (mounted) setPasswordRecoveryStatus("ready");
      } catch (error) {
        if (!mounted) return;
        setPasswordRecoveryError(
          error instanceof Error ? error.message : "Parola yenileme bağlantısı kullanılamadı.",
        );
        setPasswordRecoveryStatus("error");
      }
    };

    void Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => {
        if (mounted) setPasswordRecoveryStatus("idle");
      });
    const subscription = Linking.addEventListener("url", ({ url }) => void handleUrl(url));

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const sessionUserId = session?.user.id;

  useEffect(() => {
    if (!sessionUserId) return;
    void refreshAccount(sessionUserId);
  }, [refreshAccount, sessionUserId]);

  if (!isSupabaseConfigured) return <SetupRequiredScreen />;

  if (
    loadingSession ||
    passwordRecoveryStatus === "checking" ||
    passwordRecoveryStatus === "processing"
  ) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#2D8C7C" size="large" />
      </SafeAreaView>
    );
  }

  if (passwordRecoveryStatus === "error") {
    return (
      <PasswordRecoveryErrorScreen
        message={passwordRecoveryError ?? "Parola yenileme bağlantısı kullanılamadı."}
        onDismiss={() => {
          setPasswordRecoveryError(null);
          setPasswordRecoveryStatus("idle");
        }}
      />
    );
  }

  if (passwordRecoveryStatus === "ready") {
    return (
      <PasswordUpdateScreen mode="recovery" onCompleted={() => setPasswordRecoveryStatus("idle")} />
    );
  }

  if (loadingAccount) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#2D8C7C" size="large" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        onPasswordRecoveryVerified={() => {
          setPasswordRecoveryError(null);
          setPasswordRecoveryStatus("ready");
        }}
      />
    );
  }

  if (accountError) {
    return (
      <AccountLoadErrorScreen
        message={accountError}
        onRetry={() => refreshAccount(session.user.id)}
      />
    );
  }

  if (!parentOnboarded) {
    return (
      <GuardianOnboardingScreen
        onCompleted={() => refreshAccount(session.user.id)}
        userId={session.user.id}
      />
    );
  }

  if (activeChild && showParentPinGate) {
    return (
      <ParentPinGate
        onCancel={() => setShowParentPinGate(false)}
        onUnlocked={() => {
          setShowParentPinGate(false);
          setActiveChild(null);
          void clearPersistedActiveChildId();
        }}
      />
    );
  }

  if (activeChild) {
    return <MinoStory child={activeChild} onRequestParentArea={() => setShowParentPinGate(true)} />;
  }

  return (
    <ParentHomeScreen
      children={children}
      onChildCreated={(profile) => setChildren((current) => [...current, profile])}
      onChildUpdated={(profile) =>
        setChildren((current) =>
          current.map((child) => (child.id === profile.id ? profile : child)),
        )
      }
      onStartChildMode={async (profile) => {
        const consentSettings = await loadChildConsentSettings(profile.id);
        await persistActiveChildId(profile.id);
        setActiveChild(
          createChildSessionProfile(profile, {
            personalizationEnabled: consentSettings.personalization,
          }),
        );
      }}
      parentId={session.user.id}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF6E8" },
});
