import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import type { ParentSessionSummary } from "@adaptive/parent-insights";
import type { PersonalizationStatus } from "@adaptive/personalization-engine";
import type { ChildProfile } from "@adaptive/shared-types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { loadParentSessionSummary, loadPersonalizationStatus } from "../../services/parentInsights";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

const content = contentVersionSchema.parse(contentV1);
const storyTitles = new Map(content.stories.map((story) => [story.id, story.title]));
const gameTitles = new Map((content.games ?? []).map((game) => [game.id, game.title]));

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type GameInsight = ParentSessionSummary["gameInsights"][number];

const insightThemes: Record<
  GameInsight["code"],
  { icon: IconName; color: string; background: string }
> = {
  continued_play: {
    icon: "flag-checkered",
    color: "#2E806F",
    background: "#E7F5F0",
  },
  support_was_useful: {
    icon: "hand-heart-outline",
    color: "#4874A5",
    background: "#EAF2FA",
  },
  tried_again: {
    icon: "refresh-circle",
    color: "#8058AD",
    background: "#F1EAF8",
  },
  took_more_time: {
    icon: "timer-sand",
    color: "#C07632",
    background: "#FFF1DF",
  },
  paused_and_left: {
    icon: "pause-circle-outline",
    color: "#B45C60",
    background: "#FBEAEC",
  },
};

function statusMessage(summary: ParentSessionSummary): string {
  switch (summary.status) {
    case "consent_required":
      return "Öğrenme gözlemi izni kapalı. İzin açılmadıkça etkinlik ayrıntıları ve içgörüler oluşturulmaz.";
    case "no_activity":
      return "Henüz kaydedilmiş bir etkinlik yok. İlk oyun veya hikâyeden sonra ayrıntılar burada görünür.";
    case "insufficient_data":
      return "Etkinlik ayrıntıları hazır. Güvenilir bir içgörü için birkaç farklı oturum daha gerekiyor.";
    case "ready":
      return "Bu özet yalnızca kaydedilmiş oyun ve hikâye oturumlarından hazırlanmıştır.";
  }
}

function gameStatusMessage(summary: ParentSessionSummary): string {
  switch (summary.gameStatus) {
    case "consent_required":
      return "Oyun içgörüleri için öğrenme gözlemi izni gerekiyor.";
    case "no_activity":
      return "İlk oyun tamamlandığında oyunla ilgili ayrıntılar burada görünür.";
    case "insufficient_data":
      return "Tekrarlanan bir oyun davranışını yorumlamak için en az üç uygun oturum gerekiyor.";
    case "ready":
      return "Aşağıdaki kartlar yalnızca birden fazla oturumda tekrarlanan davranışları açıklar.";
  }
}

function personalizationMessage(status: PersonalizationStatus): string {
  if (!status.personalizationEnabled) {
    return "Kişiselleştirilmiş öneriler kapalı; içerikler genel sırayla gösteriliyor.";
  }
  if (!status.learningObservationsEnabled) {
    return "Öğrenme gözlemleri kapalı olduğu için kişiselleştirilmiş öneri yapılmıyor.";
  }
  if (!status.eligible) {
    return (
      "Önerileri uyarlamak için gereken 5 farklı hikâyeden " +
      status.eligibleDistinctActivityCount +
      " tanesi tamamlandı."
    );
  }
  return (
    status.lastDecision?.explanation ??
    "Yeterli farklı hikâye tamamlandı. Tutarlı seçimler oluştuğunda öneriler buna göre uyarlanabilir."
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function gameOutcomeLabel(outcome: ParentSessionSummary["recentGameSessions"][number]["outcome"]) {
  if (outcome === "completed") return "Tamamlandı";
  if (outcome === "left_early") return "Ara verildi";
  return "Devam ediyor";
}

function SectionHeading({
  number,
  subtitle,
  title,
}: {
  number: string;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{number}</Text>
      </View>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function MetricCard({
  background,
  color,
  icon,
  label,
  value,
  wide,
}: {
  background: string;
  color: string;
  icon: IconName;
  label: string;
  value: number;
  wide: boolean;
}) {
  return (
    <View
      style={[styles.metricCard, { backgroundColor: background, width: wide ? "23.5%" : "48%" }]}
    >
      <MaterialCommunityIcons color={color} name={icon} size={27} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function DetailCard({
  children,
  icon,
  title,
  wide,
}: {
  children: ReactNode;
  icon: IconName;
  title: string;
  wide: boolean;
}) {
  return (
    <View style={[styles.detailCard, { width: wide ? "48.7%" : "100%" }]}>
      <View style={styles.detailCardHeader}>
        <View style={styles.detailIconBubble}>
          <MaterialCommunityIcons color="#5D6570" name={icon} size={23} />
        </View>
        <Text style={styles.detailCardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLineLabel}>{label}</Text>
      <Text style={styles.detailLineValue}>{value}</Text>
    </View>
  );
}

function InsightCard({ insight, wide }: { insight: GameInsight; wide: boolean }) {
  const theme = insightThemes[insight.code];
  return (
    <View
      style={[
        styles.insightCard,
        { backgroundColor: theme.background, width: wide ? "48.7%" : "100%" },
      ]}
    >
      <View style={[styles.insightIcon, { backgroundColor: theme.color + "18" }]}>
        <MaterialCommunityIcons color={theme.color} name={theme.icon} size={27} />
      </View>
      <View style={styles.insightCopy}>
        <Text style={[styles.insightTitle, { color: theme.color }]}>{insight.title}</Text>
        <Text style={styles.insightText}>{insight.text}</Text>
        <View style={styles.evidencePill}>
          <MaterialCommunityIcons color="#69767D" name="database-check-outline" size={15} />
          <Text style={styles.evidencePillText}>
            {insight.supportingSessionCount} oturumda görüldü
          </Text>
        </View>
      </View>
    </View>
  );
}

export function ParentSessionSummaryScreen({
  child,
  onBack,
}: {
  child: ChildProfile;
  onBack: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [summary, setSummary] = useState<ParentSessionSummary | null>(null);
  const [personalization, setPersonalization] = useState<PersonalizationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showEvidenceDetails, setShowEvidenceDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.allSettled([
      loadParentSessionSummary(child.id),
      loadPersonalizationStatus(child.id),
    ]).then(([summaryResult, personalizationResult]) => {
      if (cancelled) return;
      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        setError("Etkinlik özeti şu anda alınamadı. Lütfen yeniden deneyin.");
      }
      setPersonalization(
        personalizationResult.status === "fulfilled" ? personalizationResult.value : null,
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [child.id, reloadKey]);

  const recentActivity = useMemo(() => {
    if (!summary) return [];
    return [
      ...summary.recentSessions.map((session) => ({
        id: session.sessionId,
        title: storyTitles.get(session.activityId) ?? "Hikâye etkinliği",
        occurredAt: session.completedAt,
        kind: "story" as const,
        status: "Tamamlandı",
      })),
      ...summary.recentGameSessions.map((session) => ({
        id: session.sessionId,
        title: gameTitles.get(session.gameId) ?? "Oyun etkinliği",
        occurredAt: session.occurredAt,
        kind: "game" as const,
        status: gameOutcomeLabel(session.outcome),
      })),
    ]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 8);
  }, [summary]);

  return (
    <AccountShell
      alignFromTop
      cardMaxWidth={980}
      subtitle="Etkinlik ayrıntıları, gözlemler ve birlikte deneyebileceğiniz küçük fikirler"
      title={child.nickname + " için özet"}
    >
      {error ? (
        <View>
          <Text style={formStyles.error}>{error}</Text>
          <Pressable
            onPress={() => setReloadKey((current) => current + 1)}
            style={formStyles.primaryButton}
          >
            <Text style={formStyles.primaryButtonText}>Yeniden dene</Text>
          </Pressable>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator color="#2D8C7C" size="large" />
          <Text style={styles.loadingText}>Etkinlikler hazırlanıyor...</Text>
        </View>
      ) : null}

      {summary ? (
        <>
          <View style={styles.summaryHero}>
            <View style={styles.childAvatar}>
              <Text style={styles.childInitial}>{child.nickname.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.heroCopy}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle}>{child.nickname}’in etkinlik dünyası</Text>
                <View style={styles.currentPill}>
                  <View style={styles.currentDot} />
                  <Text style={styles.currentPillText}>Güncel</Text>
                </View>
              </View>
              <Text style={styles.heroText}>{statusMessage(summary)}</Text>
              <Text style={styles.generatedText}>
                Son yenileme: {formatDate(summary.generatedAt)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Özeti yenile"
              accessibilityRole="button"
              disabled={loading}
              onPress={() => setReloadKey((current) => current + 1)}
              style={styles.refreshButton}
            >
              <MaterialCommunityIcons color="#2D8C7C" name="refresh" size={26} />
            </Pressable>
          </View>

          <SectionHeading
            number="1"
            subtitle="Önce kaydedilen oyun ve hikâye oturumlarına bakalım."
            title="Neler yaptı?"
          />

          <View style={styles.metricGrid}>
            <MetricCard
              background="#E9F6F1"
              color="#2D806F"
              icon="shape-outline"
              label="Toplam etkinlik"
              value={summary.activityDetails.totalSessionCount}
              wide={wide}
            />
            <MetricCard
              background="#FFF0E5"
              color="#C56B3E"
              icon="calendar-heart"
              label="Etkin gün"
              value={summary.activityDetails.activeDayCount}
              wide={wide}
            />
            <MetricCard
              background="#EAF2FB"
              color="#4877A8"
              icon="gamepad-variant-outline"
              label="Farklı oyun"
              value={summary.activityDetails.distinctGameCount}
              wide={wide}
            />
            <MetricCard
              background="#F2EAF9"
              color="#7E58A8"
              icon="book-open-page-variant-outline"
              label="Farklı hikâye"
              value={summary.activityDetails.distinctStoryCount}
              wide={wide}
            />
          </View>

          <View style={styles.detailGrid}>
            <DetailCard icon="gamepad-variant-outline" title="Oyun ayrıntıları" wide={wide}>
              <DetailLine label="Toplam oyun oturumu" value={summary.eligibleGameSessionCount} />
              <DetailLine
                label="Tamamlanan"
                value={summary.activityDetails.completedGameSessionCount}
              />
              <DetailLine
                label="Ara verilen"
                value={summary.activityDetails.pausedGameSessionCount}
              />
              {summary.activityDetails.inProgressGameSessionCount > 0 ? (
                <DetailLine
                  label="Devam eden"
                  value={summary.activityDetails.inProgressGameSessionCount}
                />
              ) : null}
              {summary.activityDetails.mostRepeatedGame?.sessionCount &&
              summary.activityDetails.mostRepeatedGame.sessionCount > 1 ? (
                <View style={styles.repeatHighlight}>
                  <MaterialCommunityIcons color="#4877A8" name="replay" size={19} />
                  <Text style={styles.repeatHighlightText}>
                    {gameTitles.get(summary.activityDetails.mostRepeatedGame.activityId) ??
                      "Bir oyun"}{" "}
                    {summary.activityDetails.mostRepeatedGame.sessionCount} kez açıldı.
                  </Text>
                </View>
              ) : null}
            </DetailCard>

            <DetailCard
              icon="book-open-page-variant-outline"
              title="Hikâye ayrıntıları"
              wide={wide}
            >
              <DetailLine label="Tamamlanan hikâye" value={summary.completedSessionCount} />
              <DetailLine
                label="Farklı hikâye"
                value={summary.activityDetails.distinctStoryCount}
              />
              <DetailLine label="İçgörüye uygun oturum" value={summary.eligibleSessionCount} />
              {summary.activityDetails.mostRepeatedStory?.sessionCount &&
              summary.activityDetails.mostRepeatedStory.sessionCount > 1 ? (
                <View style={[styles.repeatHighlight, styles.storyRepeatHighlight]}>
                  <MaterialCommunityIcons color="#7E58A8" name="book-refresh-outline" size={19} />
                  <Text style={styles.repeatHighlightText}>
                    {storyTitles.get(summary.activityDetails.mostRepeatedStory.activityId) ??
                      "Bir hikâye"}{" "}
                    {summary.activityDetails.mostRepeatedStory.sessionCount} kez tamamlandı.
                  </Text>
                </View>
              ) : null}
            </DetailCard>
          </View>

          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>Son etkinlikler</Text>
                <Text style={styles.historySubtitle}>En yeni oyun ve hikâye oturumları</Text>
              </View>
              <MaterialCommunityIcons color="#9A8779" name="history" size={27} />
            </View>
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <View
                  key={activity.id}
                  style={[
                    styles.activityRow,
                    index < recentActivity.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.activityIcon,
                      activity.kind === "game" ? styles.gameActivityIcon : styles.storyActivityIcon,
                    ]}
                  >
                    <MaterialCommunityIcons
                      color={activity.kind === "game" ? "#4877A8" : "#7E58A8"}
                      name={
                        activity.kind === "game"
                          ? "gamepad-variant-outline"
                          : "book-open-page-variant-outline"
                      }
                      size={22}
                    />
                  </View>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityDate}>{formatDate(activity.occurredAt)}</Text>
                  </View>
                  <View
                    style={[
                      styles.outcomePill,
                      activity.status === "Ara verildi" && styles.pausedPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.outcomeText,
                        activity.status === "Ara verildi" && styles.pausedText,
                      ]}
                    >
                      {activity.status}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHistory}>Henüz görüntülenecek etkinlik yok.</Text>
            )}
          </View>

          <View style={styles.sectionDivider} />
          <SectionHeading
            number="2"
            subtitle="Şimdi birden fazla oturumda tekrar eden sinyallere bakalım."
            title="Neler fark ediyoruz?"
          />

          <View style={styles.safetyNotice}>
            <MaterialCommunityIcons color="#745E35" name="information-outline" size={22} />
            <Text style={styles.safetyNoticeText}>
              Bunlar tanı, puan veya akran karşılaştırması değildir; yalnızca kayıtlı etkinliklerde
              görülen davranışların sade bir özetidir.
            </Text>
          </View>

          {summary.observation ? (
            <View style={styles.storyObservation}>
              <View style={styles.observationIcon}>
                <MaterialCommunityIcons color="#7E58A8" name="book-heart-outline" size={29} />
              </View>
              <View style={styles.insightCopy}>
                <Text style={styles.observationEyebrow}>HİKÂYE GÖZLEMİ</Text>
                <Text style={styles.observationText}>{summary.observation.text}</Text>
                <Text style={styles.observationEvidence}>
                  {summary.observation.supportingSessionIds.length} uygun oturuma dayanır.
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.insightGroupTitle}>Oyunlardan gelen sinyaller</Text>
          <Text style={styles.insightGroupStatus}>{gameStatusMessage(summary)}</Text>
          {summary.gameInsights.length > 0 ? (
            <View style={styles.insightGrid}>
              {summary.gameInsights.map((insight) => (
                <InsightCard insight={insight} key={insight.code} wide={wide} />
              ))}
            </View>
          ) : (
            <View style={styles.waitingInsightCard}>
              <MaterialCommunityIcons color="#78909B" name="chart-timeline-variant" size={31} />
              <View style={styles.insightCopy}>
                <Text style={styles.waitingInsightTitle}>Yeni sinyaller birikiyor</Text>
                <Text style={styles.waitingInsightText}>
                  Çocuk oynadıkça, yalnızca tekrarlanan davranışlar burada içgörüye dönüşür.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.profileContextCard}>
            <View style={styles.profileContextHeader}>
              <View style={styles.profileContextIcon}>
                <MaterialCommunityIcons color="#4D739C" name="account-heart-outline" size={29} />
              </View>
              <View style={styles.insightCopy}>
                <Text style={styles.profileContextEyebrow}>PROFİL BAZLI RAG ÖZETİ</Text>
                <Text style={styles.profileContextTitle}>
                  {summary.parentGuidance.personalized
                    ? `${summary.profileContext.nickname} için kişiselleştirildi`
                    : "Her çocuk için ayrı özet"}
                </Text>
                <Text style={styles.profileContextText}>
                  {summary.parentGuidance.personalized
                    ? "Yaş grubu, izin verilen profil tercihleri ve yalnızca bu çocuğa ait etkinlikler birlikte kullanıldı."
                    : "Bu özet yalnızca seçilen çocuğun etkinliklerinden oluşur. Profil tercihleri kişiselleştirme izni kapalı olduğu için kullanılmadı."}
                </Text>
              </View>
            </View>
            <View style={styles.contextChipRow}>
              {summary.profileContext.ageBand !== "outside_supported_range" ? (
                <View style={styles.contextChip}>
                  <MaterialCommunityIcons color="#4D739C" name="cake-variant-outline" size={16} />
                  <Text style={styles.contextChipText}>{summary.profileContext.ageBand} yaş</Text>
                </View>
              ) : null}
              {summary.parentGuidance.contextLabels.map((label) => (
                <View key={label} style={styles.contextChip}>
                  <MaterialCommunityIcons color="#4D739C" name="star-outline" size={16} />
                  <Text style={styles.contextChipText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.parentIdeasCard}>
            <View style={styles.parentIdeasHeader}>
              <View style={styles.parentIdeasIcon}>
                <MaterialCommunityIcons color="#B8653F" name="home-heart" size={29} />
              </View>
              <View style={styles.insightCopy}>
                <Text style={styles.parentIdeasEyebrow}>BİRLİKTE DENEYİN</Text>
                <Text style={styles.parentIdeasTitle}>Bugün için küçük fikirler</Text>
              </View>
            </View>
            {summary.parentGuidance.ideas.map((idea, index) => (
              <View key={idea} style={styles.ideaRow}>
                <View style={styles.ideaNumber}>
                  <Text style={styles.ideaNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.ideaText}>{idea}</Text>
              </View>
            ))}
          </View>

          {personalization ? (
            <View style={styles.personalizationCard}>
              <MaterialCommunityIcons color="#2D806F" name="creation-outline" size={28} />
              <View style={styles.insightCopy}>
                <Text style={styles.personalizationTitle}>Öneriler nasıl şekilleniyor?</Text>
                <Text style={styles.personalizationText}>
                  {personalizationMessage(personalization)}
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowEvidenceDetails((current) => !current)}
            style={styles.evidenceToggle}
          >
            <View style={styles.evidenceToggleTitle}>
              <MaterialCommunityIcons color="#6A645F" name="database-eye-outline" size={22} />
              <Text style={styles.evidenceToggleText}>Bu özet nasıl hazırlandı?</Text>
            </View>
            <MaterialCommunityIcons
              color="#8C827A"
              name={showEvidenceDetails ? "chevron-up" : "chevron-down"}
              size={25}
            />
          </Pressable>
          {showEvidenceDetails ? (
            <View style={styles.evidenceDetails}>
              <Text style={styles.evidenceDetailsText}>
                {summary.retrieval.storyEvidenceCount} hikâye ve{" "}
                {summary.retrieval.gameEvidenceCount} oyun oturumu kullanıldı. Kayıtlar{" "}
                {summary.retrieval.gameDayCount} oyun gününe yayılıyor.
              </Text>
              <Text style={styles.evidenceContextText}>
                Profil bağlamı:{" "}
                {summary.parentGuidance.personalized ? "kullanıldı" : "kullanılmadı"}. Kardeş
                profillerinin verileri bu özete dahil edilmez.
              </Text>
              {summary.retrieval.windowStartedAt && summary.retrieval.windowEndedAt ? (
                <Text style={styles.evidenceWindow}>
                  İncelenen aralık: {formatDate(summary.retrieval.windowStartedAt)} –{" "}
                  {formatDate(summary.retrieval.windowEndedAt)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <Pressable onPress={onBack} style={[formStyles.secondaryButton, styles.backButton]}>
        <Text style={formStyles.secondaryButtonText}>Çocuk profillerine dön</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  loadingArea: { alignItems: "center", gap: 10, paddingVertical: 30 },
  loadingText: { color: "#6F6258", fontSize: 14, fontWeight: "700" },
  summaryHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#F1F8F6",
  },
  childAvatar: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 31,
    backgroundColor: "#F7CDB7",
  },
  childInitial: { color: "#704D3B", fontSize: 27, fontWeight: "900" },
  heroCopy: { flex: 1 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  heroTitle: { color: "#34443F", fontSize: 19, fontWeight: "900" },
  heroText: { marginTop: 5, color: "#596C66", fontSize: 13, lineHeight: 19 },
  generatedText: { marginTop: 6, color: "#87948F", fontSize: 11, fontWeight: "700" },
  currentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#42A68D" },
  currentPillText: { color: "#347B6B", fontSize: 10, fontWeight: "900" },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 25 },
  stepBadge: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#3F8E7E",
  },
  stepBadgeText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  sectionHeadingCopy: { flex: 1 },
  sectionTitle: { color: "#3F352E", fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { marginTop: 2, color: "#796E66", fontSize: 13, lineHeight: 18 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 15 },
  metricCard: { minHeight: 132, padding: 14, borderRadius: 20 },
  metricValue: { marginTop: 8, fontSize: 31, fontWeight: "900", lineHeight: 35 },
  metricLabel: { marginTop: 3, color: "#5F5B57", fontSize: 12, fontWeight: "800" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 13 },
  detailCard: {
    padding: 15,
    borderWidth: 2,
    borderColor: "#EEE4DA",
    borderRadius: 21,
    backgroundColor: "#FFFCF8",
  },
  detailCardHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  detailIconBubble: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#F2EEE9",
  },
  detailCardTitle: { color: "#443A33", fontSize: 16, fontWeight: "900" },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1EAE3",
  },
  detailLineLabel: { color: "#71665E", fontSize: 13 },
  detailLineValue: { color: "#3F352E", fontSize: 15, fontWeight: "900" },
  repeatHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "#EAF2FB",
  },
  storyRepeatHighlight: { backgroundColor: "#F2EAF9" },
  repeatHighlightText: { flex: 1, color: "#54636C", fontSize: 12, lineHeight: 17 },
  historyCard: {
    marginTop: 13,
    padding: 16,
    borderWidth: 2,
    borderColor: "#EEE4DA",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  historyTitle: { color: "#443A33", fontSize: 17, fontWeight: "900" },
  historySubtitle: { marginTop: 2, color: "#8A7C71", fontSize: 12 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1EAE3" },
  activityIcon: {
    width: 41,
    height: 41,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  gameActivityIcon: { backgroundColor: "#EAF2FB" },
  storyActivityIcon: { backgroundColor: "#F2EAF9" },
  activityCopy: { flex: 1 },
  activityTitle: { color: "#443A33", fontSize: 14, fontWeight: "800" },
  activityDate: { marginTop: 3, color: "#8A7D73", fontSize: 11 },
  outcomePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#E7F5F0",
  },
  pausedPill: { backgroundColor: "#FFF0E3" },
  outcomeText: { color: "#337B6C", fontSize: 10, fontWeight: "900" },
  pausedText: { color: "#B96D37" },
  emptyHistory: { paddingVertical: 18, color: "#85786E", fontSize: 13, textAlign: "center" },
  sectionDivider: { height: 2, marginTop: 25, borderRadius: 1, backgroundColor: "#F0E7DF" },
  safetyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 15,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FFF6DF",
  },
  safetyNoticeText: { flex: 1, color: "#745E35", fontSize: 12, lineHeight: 18 },
  storyObservation: {
    flexDirection: "row",
    gap: 12,
    marginTop: 13,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E5D8F0",
    borderRadius: 21,
    backgroundColor: "#F8F3FC",
  },
  observationIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#EEE3F7",
  },
  observationEyebrow: {
    color: "#7E58A8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  observationText: {
    marginTop: 5,
    color: "#493D50",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
  },
  observationEvidence: { marginTop: 7, color: "#84758D", fontSize: 11, fontWeight: "700" },
  insightGroupTitle: { marginTop: 20, color: "#443A33", fontSize: 17, fontWeight: "900" },
  insightGroupStatus: { marginTop: 4, color: "#756B63", fontSize: 13, lineHeight: 19 },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  insightCard: { flexDirection: "row", gap: 11, padding: 15, borderRadius: 20 },
  insightIcon: {
    width: 47,
    height: 47,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  insightCopy: { flex: 1 },
  insightTitle: { fontSize: 16, fontWeight: "900" },
  insightText: { marginTop: 5, color: "#526069", fontSize: 13, lineHeight: 19 },
  evidencePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  evidencePillText: { color: "#69767D", fontSize: 10, fontWeight: "800" },
  waitingInsightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 16,
    borderRadius: 19,
    backgroundColor: "#EFF4F5",
  },
  waitingInsightTitle: { color: "#53686E", fontSize: 15, fontWeight: "900" },
  waitingInsightText: { marginTop: 4, color: "#718086", fontSize: 12, lineHeight: 18 },
  profileContextCard: {
    marginTop: 18,
    padding: 17,
    borderWidth: 2,
    borderColor: "#DCE7F2",
    borderRadius: 22,
    backgroundColor: "#F3F8FD",
  },
  profileContextHeader: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  profileContextIcon: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#E3EEF8",
  },
  profileContextEyebrow: {
    color: "#4D739C",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  profileContextTitle: { marginTop: 3, color: "#365674", fontSize: 17, fontWeight: "900" },
  profileContextText: { marginTop: 5, color: "#61788C", fontSize: 12, lineHeight: 18 },
  contextChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  contextChipText: { color: "#4D657B", fontSize: 11, fontWeight: "800" },
  parentIdeasCard: { marginTop: 18, padding: 17, borderRadius: 22, backgroundColor: "#FFF0E5" },
  parentIdeasHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 8 },
  parentIdeasIcon: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#FFE0CE",
  },
  parentIdeasEyebrow: {
    color: "#B8653F",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  parentIdeasTitle: { marginTop: 3, color: "#6F432E", fontSize: 18, fontWeight: "900" },
  ideaRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
  ideaNumber: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  ideaNumberText: { color: "#B8653F", fontSize: 12, fontWeight: "900" },
  ideaText: { flex: 1, color: "#704F3F", fontSize: 13, lineHeight: 20 },
  personalizationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 13,
    padding: 16,
    borderWidth: 2,
    borderColor: "#D6EAE4",
    borderRadius: 20,
    backgroundColor: "#F2F9F7",
  },
  personalizationTitle: { color: "#326D60", fontSize: 15, fontWeight: "900" },
  personalizationText: { marginTop: 4, color: "#58716B", fontSize: 12, lineHeight: 18 },
  evidenceToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 15,
    padding: 14,
    borderRadius: 17,
    backgroundColor: "#F5F2EF",
  },
  evidenceToggleTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  evidenceToggleText: { color: "#5F5954", fontSize: 13, fontWeight: "900" },
  evidenceDetails: { marginTop: 7, padding: 14, borderRadius: 15, backgroundColor: "#FAF8F6" },
  evidenceDetailsText: { color: "#6F6862", fontSize: 12, lineHeight: 18 },
  evidenceContextText: { marginTop: 6, color: "#6F6862", fontSize: 12, lineHeight: 18 },
  evidenceWindow: { marginTop: 6, color: "#8A817A", fontSize: 11, fontWeight: "700" },
  backButton: { marginTop: 18 },
});
