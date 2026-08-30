import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import type { PublishedStoryExperience } from "@adaptive/media-schema";
import {
  type ChildProfile,
  type ChildSessionProfile,
  createChildSessionProfile,
  resolveAgeBand,
} from "@adaptive/shared-types";
import type { Session } from "@supabase/supabase-js";
import { setAudioModeAsync } from "expo-audio";
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
import { TrackedGame } from "./features/game/TrackedGame";
import { MinoStory } from "./features/story/MinoStory";
import { StorySelectionScreen } from "./features/story/StorySelectionScreen";
import { StoryPlayer } from "./features/storyPlayer/StoryPlayer";
import { resolveStoryRoute } from "./features/storyPlayer/storyRouting";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { loadChildProfiles, loadParentProfile } from "./services/account";
import { selectNextStory } from "./services/activitySelection";
import { completePasswordRecoveryRedirect, isPasswordRecoveryUrl } from "./services/authDeepLink";
import {
  clearPersistedActiveChildId,
  getPersistedActiveChildId,
  persistActiveChildId,
} from "./services/childMode";
import { loadChildConsentSettings } from "./services/consents";
import { loadPublishedGames } from "./services/gameCatalog";
import { loadGameVariantPreference } from "./services/gamePersonalization";
import { type GameProgressMap, loadGameProgress, saveGameProgress } from "./services/gameProgress";
import { initializeInteractionEventSync } from "./services/interactionEvents";
import { loadPublishedStoryExperiences } from "./services/storyExperiences";

type PasswordRecoveryStatus = "checking" | "idle" | "processing" | "ready" | "error";
type DiscoveryTab = "games" | "stories";

function withTimeout<T>(operation: Promise<T>, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Bağlantı zaman aşımına uğradı.")), timeoutMs);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

const content = contentVersionSchema.parse(contentV1);

function createCatalogSessionSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getParentDisplayName(session: Session): string {
  const metadata = session.user.user_metadata;
  const candidate = metadata.display_name ?? metadata.full_name ?? metadata.name;
  return typeof candidate === "string" ? candidate : "";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [parentOnboarded, setParentOnboarded] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<ChildSessionProfile | null>(null);
  const [catalogSessionSeed, setCatalogSessionSeed] = useState(createCatalogSessionSeed);
  const [showParentPinGate, setShowParentPinGate] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [discoveryTab, setDiscoveryTab] = useState<DiscoveryTab>("games");
  const [lastPlayedBktGameId, setLastPlayedBktGameId] = useState<string | null>(null);
  const [gameRecommendationRevision, setGameRecommendationRevision] = useState(0);
  const [gameProgress, setGameProgress] = useState<GameProgressMap>({});
  const [availableGames, setAvailableGames] = useState(content.games ?? []);
  const [publishedStories, setPublishedStories] = useState<PublishedStoryExperience[]>([]);
  const [recommendedStoryId, setRecommendedStoryId] = useState<string | null>(null);
  const [recommendedGameId, setRecommendedGameId] = useState<string | null>(null);
  const [gameRecommendationExplanation, setGameRecommendationExplanation] = useState<string | null>(
    null,
  );
  const [passwordRecoveryStatus, setPasswordRecoveryStatus] =
    useState<PasswordRecoveryStatus>("checking");
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);
  const handledRecoveryUrl = useRef<string | null>(null);

  useEffect(() => initializeInteractionEventSync(), []);
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "doNotMix",
    }).catch(() => undefined);
  }, []);

  const refreshAccount = useCallback(async (userId: string) => {
    setLoadingAccount(true);
    setAccountError(null);
    try {
      const parentProfile = await withTimeout(loadParentProfile(userId));
      const onboardingComplete = Boolean(parentProfile?.pin_configured_at);
      setParentOnboarded(onboardingComplete);
      const childProfiles = onboardingComplete ? await withTimeout(loadChildProfiles()) : [];
      setChildren(childProfiles);

      const activeChildId = onboardingComplete ? await getPersistedActiveChildId() : null;
      const persistedChild = childProfiles.find((child) => child.id === activeChildId);
      if (persistedChild && resolveAgeBand(persistedChild.birthMonth, persistedChild.birthYear)) {
        const [consentSettings, storedGameProgress] = await Promise.all([
          withTimeout(loadChildConsentSettings(persistedChild.id)),
          loadGameProgress(persistedChild.id),
        ]);
        setGameProgress(storedGameProgress);
        setCatalogSessionSeed(createCatalogSessionSeed());
        setActiveChild(
          createChildSessionProfile(persistedChild, {
            personalizationEnabled: consentSettings.personalization,
            learningObservationsEnabled: consentSettings.learning_observations,
          }),
        );
      } else {
        setGameProgress({});
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
    const loadingTimeout = setTimeout(() => {
      if (mounted) setLoadingSession(false);
    }, 5000);
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(() => {
        clearTimeout(loadingTimeout);
        if (mounted) setLoadingSession(false);
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
        setSelectedStoryId(null);
        setSelectedGameId(null);
        setDiscoveryTab("games");
        void clearPersistedActiveChildId();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const recoveryTimeout = setTimeout(() => {
      if (mounted) {
        setPasswordRecoveryStatus((current) => (current === "checking" ? "idle" : current));
      }
    }, 3000);

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
      clearTimeout(recoveryTimeout);
      subscription.remove();
    };
  }, []);

  const sessionUserId = session?.user.id;

  useEffect(() => {
    if (!activeChild) {
      setRecommendedStoryId(null);
      return;
    }
    let cancelled = false;
    void selectNextStory(
      activeChild.id,
      content.stories.map((story) => story.id),
    )
      .then((decision) => {
        if (!cancelled) setRecommendedStoryId(decision.selectedActivityId);
      })
      .catch(() => {
        if (!cancelled) setRecommendedStoryId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeChild]);

  useEffect(() => {
    if (!activeChild) {
      setAvailableGames(content.games ?? []);
      setRecommendedGameId(null);
      setGameRecommendationExplanation(null);
      return;
    }
    let cancelled = false;
    void loadPublishedGames(activeChild.ageBand, content.games ?? []).then((games) => {
      if (!cancelled) setAvailableGames(games);
    });
    return () => {
      cancelled = true;
    };
  }, [activeChild]);

  useEffect(() => {
    if (!activeChild) return;
    const eligibleGames = availableGames.filter(
      (game) =>
        game.status === "published" &&
        game.ageBand === activeChild.ageBand &&
        !gameProgress[game.id]?.completed,
    );
    const currentGame =
      eligibleGames.find(
        (game) =>
          game.id === lastPlayedBktGameId &&
          game.mechanic === "sequence_and_place" &&
          game.leveling?.strategy === "bkt",
      ) ??
      eligibleGames.find(
        (game) =>
          game.mechanic === "sequence_and_place" &&
          game.leveling?.strategy === "bkt" &&
          game.difficulty.level === "starter",
      ) ??
      eligibleGames[0];
    if (!currentGame) {
      setRecommendedGameId(null);
      setGameRecommendationExplanation(null);
      return;
    }

    let cancelled = false;
    void loadGameVariantPreference(
      activeChild.id,
      activeChild.ageBand,
      currentGame.difficulty.level,
      currentGame.mechanic,
    )
      .then((decision) => {
        if (cancelled) return;
        const recommendedGame = decision.personalized
          ? eligibleGames.find(
              (game) =>
                game.mechanic === currentGame.mechanic &&
                game.difficulty.level === decision.preferredDifficulty,
            )
          : undefined;
        setRecommendedGameId(recommendedGame?.id ?? null);
        setGameRecommendationExplanation(recommendedGame ? decision.explanation : null);
      })
      .catch(() => {
        if (!cancelled) {
          setRecommendedGameId(null);
          setGameRecommendationExplanation(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeChild, availableGames, gameProgress, gameRecommendationRevision, lastPlayedBktGameId]);

  useEffect(() => {
    if (!activeChild) {
      setPublishedStories([]);
      return;
    }
    let cancelled = false;
    void loadPublishedStoryExperiences(supabase).then((result) => {
      if (!cancelled) setPublishedStories(result.experiences);
    });
    return () => {
      cancelled = true;
    };
  }, [activeChild]);

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
    const eligibleGames = availableGames.filter(
      (game) => game.status === "published" && game.ageBand === activeChild.ageBand,
    );
    const playableGames = eligibleGames.filter((game) => !gameProgress[game.id]?.completed);
    const selectedGame = eligibleGames.find((game) => game.id === selectedGameId);
    const eligiblePublishedStories = publishedStories.filter((experience) =>
      experience.ageBands.includes(activeChild.ageBand),
    );
    const storyRoute = resolveStoryRoute(
      selectedStoryId,
      content.stories,
      eligiblePublishedStories,
    );

    if (selectedGame) {
      return (
        <TrackedGame
          child={activeChild}
          game={selectedGame}
          games={playableGames}
          initialProgress={gameProgress[selectedGame.id]}
          onExit={() => {
            if (
              selectedGame.mechanic === "sequence_and_place" &&
              selectedGame.leveling?.strategy === "bkt"
            ) {
              setLastPlayedBktGameId(selectedGame.id);
            }
            setSelectedGameId(null);
            setGameRecommendationRevision((current) => current + 1);
          }}
          onProgress={(adaptiveProgress, completed = false) => {
            const previous = gameProgress[selectedGame.id];
            const progress = {
              gameId: selectedGame.id,
              maxItemCount: adaptiveProgress.itemCount,
              completed,
              replayCount: previous?.replayCount ?? 0,
              adaptiveLevel: adaptiveProgress.adaptiveLevel,
              challengeIndex: adaptiveProgress.challengeIndex,
              completedRunsAtLevel: adaptiveProgress.completedRunsAtLevel,
              currentDifficulty: adaptiveProgress.difficulty,
              updatedAt: new Date().toISOString(),
            };
            setGameProgress((current) => ({ ...current, [selectedGame.id]: progress }));
            void saveGameProgress(activeChild.id, progress);
          }}
        />
      );
    }

    if (storyRoute.kind === "none") {
      return (
        <StorySelectionScreen
          assets={content.assets}
          ageBand={activeChild.ageBand}
          catalogSessionSeed={catalogSessionSeed}
          childName={activeChild.nickname}
          gameRecommendationExplanation={gameRecommendationExplanation}
          games={playableGames}
          initialTab={discoveryTab}
          gameProgress={gameProgress}
          onRequestParentArea={() => setShowParentPinGate(true)}
          onSelectGame={(gameId) => {
            setDiscoveryTab("games");
            setSelectedStoryId(null);
            setSelectedGameId(gameId);
          }}
          onSelectStory={(storyId) => {
            setDiscoveryTab("stories");
            setSelectedGameId(null);
            setSelectedStoryId(storyId);
          }}
          publishedStories={eligiblePublishedStories}
          recommendedStoryId={recommendedStoryId}
          recommendedGameId={recommendedGameId}
          stories={content.stories}
        />
      );
    }

    if (storyRoute.kind === "published") {
      return (
        <StoryPlayer
          experience={storyRoute.experience}
          onExit={() => {
            setDiscoveryTab("stories");
            setSelectedStoryId(null);
          }}
        />
      );
    }

    return (
      <MinoStory
        child={activeChild}
        onRequestParentArea={() => setShowParentPinGate(true)}
        onRequestStorySelection={() => {
          setDiscoveryTab("stories");
          setSelectedStoryId(null);
        }}
        story={storyRoute.story}
      />
    );
  }

  return (
    <ParentHomeScreen
      children={children}
      games={content.games ?? []}
      onChildCreated={(profile) => setChildren((current) => [...current, profile])}
      onChildDeleted={(childId) =>
        setChildren((current) => current.filter((child) => child.id !== childId))
      }
      onChildUpdated={(profile) =>
        setChildren((current) =>
          current.map((child) => (child.id === profile.id ? profile : child)),
        )
      }
      onStartChildMode={async (profile) => {
        const [consentSettings, storedGameProgress] = await Promise.all([
          loadChildConsentSettings(profile.id),
          loadGameProgress(profile.id),
        ]);
        await persistActiveChildId(profile.id);
        setSelectedStoryId(null);
        setSelectedGameId(null);
        setDiscoveryTab("games");
        setCatalogSessionSeed(createCatalogSessionSeed());
        setGameProgress(storedGameProgress);
        setActiveChild(
          createChildSessionProfile(profile, {
            personalizationEnabled: consentSettings.personalization,
            learningObservationsEnabled: consentSettings.learning_observations,
          }),
        );
      }}
      parentDisplayName={getParentDisplayName(session)}
      parentEmail={session.user.email ?? ""}
      parentId={session.user.id}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF6E8" },
});
