import {
  type ChildProfile,
  type ChildSessionProfile,
  createChildSessionProfile,
  resolveAgeBand,
} from "@adaptive/shared-types";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { AccountLoadErrorScreen } from "./features/account/AccountLoadErrorScreen";
import { AuthScreen } from "./features/account/AuthScreen";
import { GuardianOnboardingScreen } from "./features/account/GuardianOnboardingScreen";
import { ParentHomeScreen } from "./features/account/ParentHomeScreen";
import { ParentPinGate } from "./features/account/ParentPinGate";
import { SetupRequiredScreen } from "./features/account/SetupRequiredScreen";
import { MinoStory } from "./features/story/MinoStory";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { loadChildProfiles, loadParentProfile } from "./services/account";
import {
  clearPersistedActiveChildId,
  getPersistedActiveChildId,
  persistActiveChildId,
} from "./services/childMode";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [parentOnboarded, setParentOnboarded] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<ChildSessionProfile | null>(null);
  const [showParentPinGate, setShowParentPinGate] = useState(false);

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
        setActiveChild(createChildSessionProfile(persistedChild));
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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
    if (!session) return;
    void refreshAccount(session.user.id);
  }, [refreshAccount, session]);

  if (!isSupabaseConfigured) return <SetupRequiredScreen />;

  if (loadingSession || loadingAccount) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#2D8C7C" size="large" />
      </SafeAreaView>
    );
  }

  if (!session) return <AuthScreen />;

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
      onStartChildMode={async (profile) => {
        await persistActiveChildId(profile.id);
        setActiveChild(createChildSessionProfile(profile));
      }}
      parentId={session.user.id}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF6E8" },
});
