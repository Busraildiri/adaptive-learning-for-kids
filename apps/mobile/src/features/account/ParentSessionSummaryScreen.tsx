import { contentVersionSchema } from "@adaptive/content-schema";
import contentV1 from "@adaptive/content-schema/content/tr-TR/v1";
import type { ParentSessionSummary } from "@adaptive/parent-insights";
import type { PersonalizationStatus } from "@adaptive/personalization-engine";
import type { ChildProfile } from "@adaptive/shared-types";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { loadParentSessionSummary, loadPersonalizationStatus } from "../../services/parentInsights";
import { AccountShell } from "./AccountShell";
import { formStyles } from "./formStyles";

const content = contentVersionSchema.parse(contentV1);
const storyTitles = new Map(content.stories.map((story) => [story.id, story.title]));
const gameTitles = new Map((content.games ?? []).map((game) => [game.id, game.title]));

function statusMessage(summary: ParentSessionSummary): string {
  switch (summary.status) {
    case "consent_required":
      return "Öğrenme gözlemi izni kapalı. İzin açılmadıkça oturum özeti oluşturulmaz.";
    case "no_activity":
      return "Henüz tamamlanmış bir hikâye yok. İlk etkinlikten sonra tarafsız oturum geçmişi burada görünür.";
    case "insufficient_data":
      return "Henüz nitel gözlem oluşturmak için yeterli etkinlik yok. Tamamlanan oturumlar aşağıda tarafsız biçimde listelenir.";
    case "ready":
      return "Bu özet yalnızca aşağıda getirilen oturum kanıtlarından üretilir; tanı, puan veya yaşıt karşılaştırması değildir.";
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function personalizationMessage(status: PersonalizationStatus): string {
  if (!status.personalizationEnabled) {
    return "Kişiselleştirilmiş öneriler kapalı. Hikâyeler genel sırayla gösterilir.";
  }
  if (!status.learningObservationsEnabled) {
    return "Öğrenme gözlemleri kapalı olduğu için kişiselleştirilmiş öneri yapılmaz.";
  }
  if (!status.eligible) {
    return `Kişiselleştirme için 5 farklı hikâyeden ${status.eligibleDistinctActivityCount} tanesi tamamlandı.`;
  }
  return (
    status.lastDecision?.explanation ??
    "Beş farklı hikâye tamamlandı. Tutarlı bir tercih oluştuğunda öneriler uyarlanabilir."
  );
}

function gameStatusMessage(summary: ParentSessionSummary): string {
  switch (summary.gameStatus) {
    case "consent_required":
      return "Oyun oturumları için öğrenme gözlemi izni kapalı.";
    case "no_activity":
      return "Henüz kaydedilmiş bir oyun oturumu yok.";
    case "insufficient_data":
      return "Oyun gözlemleri için en az üç uygun oyun oturumu bekleniyor. Aynı gün içindeki farklı oturumlar da sayılır.";
    case "ready":
      return "Kartlar yalnızca birden fazla oturumda tekrarlanan, gözlenebilir oyun olaylarını açıklar.";
  }
}

function gameOutcomeLabel(outcome: ParentSessionSummary["recentGameSessions"][number]["outcome"]) {
  if (outcome === "completed") return "Tamamlandı";
  if (outcome === "left_early") return "Ara verildi";
  return "Devam ediyor";
}

export function ParentSessionSummaryScreen({
  child,
  onBack,
}: {
  child: ChildProfile;
  onBack: () => void;
}) {
  const [summary, setSummary] = useState<ParentSessionSummary | null>(null);
  const [personalization, setPersonalization] = useState<PersonalizationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

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
        setError("Oturum özeti şu anda alınamadı. Lütfen yeniden dene.");
      }
      if (personalizationResult.status === "fulfilled") {
        setPersonalization(personalizationResult.value);
      } else {
        setPersonalization(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [child.id, reloadKey]);

  return (
    <AccountShell subtitle={`${child.nickname} için tarafsız etkinlik özeti`} title="Oturum özeti">
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
      {loading ? <ActivityIndicator color="#2D8C7C" size="large" /> : null}

      {summary ? (
        <>
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>{statusMessage(summary)}</Text>
          </View>

          <View style={styles.retrievalCard}>
            <Text style={styles.sectionLabel}>Kullanılan kanıt kümesi</Text>
            <Text style={styles.retrievalText}>
              {summary.retrieval.storyEvidenceCount} hikâye ve {summary.retrieval.gameEvidenceCount}{" "}
              oyun oturumu getirildi. Oyun kanıtları {summary.retrieval.gameDayCount} farklı güne
              yayılıyor.
            </Text>
            {summary.retrieval.windowStartedAt && summary.retrieval.windowEndedAt ? (
              <Text style={styles.retrievalWindow}>
                Kanıt aralığı: {formatDate(summary.retrieval.windowStartedAt)} –{" "}
                {formatDate(summary.retrieval.windowEndedAt)}
              </Text>
            ) : null}
          </View>

          {personalization ? (
            <View style={styles.personalizationCard}>
              <Text style={styles.sectionLabel}>Hikâye önerileri</Text>
              <Text style={styles.personalizationText}>
                {personalizationMessage(personalization)}
              </Text>
            </View>
          ) : null}

          {summary.status !== "consent_required" ? (
            <View style={styles.countCard}>
              <Text style={styles.count}>{summary.completedSessionCount}</Text>
              <Text style={styles.countLabel}>tamamlanan hikâye oturumu</Text>
            </View>
          ) : null}

          {summary.observation ? (
            <View style={styles.observationCard}>
              <Text style={styles.sectionLabel}>Tarafsız gözlem</Text>
              <Text style={styles.observationText}>{summary.observation.text}</Text>
              <Text style={styles.evidenceNote}>
                {summary.observation.supportingSessionIds.length} uygun oturumla doğrulandı.
              </Text>
            </View>
          ) : null}

          <View style={styles.gameSection}>
            <Text style={styles.sectionTitle}>Oyun oturumları</Text>
            <Text style={styles.gameStatusText}>{gameStatusMessage(summary)}</Text>

            {summary.gameInsights.map((insight) => (
              <View key={insight.code} style={styles.gameInsightCard}>
                <Text style={styles.gameInsightTitle}>{insight.title}</Text>
                <Text style={styles.gameInsightText}>{insight.text}</Text>
                <Text style={styles.evidenceNote}>
                  {insight.supportingSessionCount} ayrı oturumdaki kanıta dayanır; kart yalnızca bu
                  oturumlarda görülen sinyali anlatır.
                </Text>
              </View>
            ))}

            {summary.recentGameSessions.map((session) => (
              <View key={session.sessionId} style={styles.sessionRow}>
                <View style={[styles.sessionDot, styles.gameSessionDot]} />
                <View style={styles.sessionText}>
                  <Text style={styles.sessionTitle}>
                    {gameTitles.get(session.gameId) ?? "Oyun etkinliği"}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {gameOutcomeLabel(session.outcome)} · {formatDate(session.occurredAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {summary.recentSessions.length > 0 ? (
            <View style={styles.history}>
              <Text style={styles.sectionLabel}>Son tamamlananlar</Text>
              {summary.recentSessions.map((session) => (
                <View key={session.sessionId} style={styles.sessionRow}>
                  <View style={styles.sessionDot} />
                  <View style={styles.sessionText}>
                    <Text style={styles.sessionTitle}>
                      {storyTitles.get(session.activityId) ?? "Hikâye etkinliği"}
                    </Text>
                    <Text style={styles.sessionDate}>{formatDate(session.completedAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <Pressable onPress={onBack} style={formStyles.secondaryButton}>
        <Text style={formStyles.secondaryButtonText}>Geri dön</Text>
      </Pressable>
    </AccountShell>
  );
}

const styles = StyleSheet.create({
  noticeCard: {
    padding: 15,
    borderRadius: 16,
    backgroundColor: "#F2F7F5",
  },
  noticeText: { color: "#4D655F", fontSize: 14, lineHeight: 21, fontWeight: "700" },
  retrievalCard: {
    marginTop: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: "#D8E7DE",
    borderRadius: 17,
    backgroundColor: "#F5FAF7",
  },
  retrievalText: { color: "#405C55", fontSize: 14, lineHeight: 21, fontWeight: "700" },
  retrievalWindow: { marginTop: 7, color: "#71837D", fontSize: 12, fontWeight: "700" },
  countCard: { alignItems: "center", marginTop: 14, padding: 16 },
  count: { color: "#2D8C7C", fontSize: 38, fontWeight: "900" },
  countLabel: { marginTop: 3, color: "#6F6258", fontSize: 14, fontWeight: "700" },
  observationCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E7D9EF",
    borderRadius: 18,
    backgroundColor: "#FAF6FC",
  },
  personalizationCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#CFE5DF",
    borderRadius: 18,
    backgroundColor: "#F1F8F6",
  },
  personalizationText: { color: "#405C55", fontSize: 15, lineHeight: 22, fontWeight: "700" },
  sectionLabel: { marginBottom: 9, color: "#66536F", fontSize: 13, fontWeight: "900" },
  observationText: { color: "#493D50", fontSize: 17, lineHeight: 24, fontWeight: "800" },
  history: { marginTop: 18 },
  gameSection: { marginTop: 20 },
  sectionTitle: { color: "#40362F", fontSize: 19, fontWeight: "900" },
  gameStatusText: { marginTop: 7, color: "#665E56", fontSize: 14, lineHeight: 21 },
  gameInsightCard: {
    marginTop: 11,
    padding: 15,
    borderWidth: 2,
    borderColor: "#D7E8F4",
    borderRadius: 17,
    backgroundColor: "#F4FAFE",
  },
  gameInsightTitle: { color: "#315C75", fontSize: 16, fontWeight: "900" },
  gameInsightText: { marginTop: 5, color: "#405B69", fontSize: 14, lineHeight: 21 },
  evidenceNote: { marginTop: 8, color: "#748995", fontSize: 12, fontWeight: "700" },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 },
  sessionDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#F2B89D" },
  gameSessionDot: { backgroundColor: "#87BDD8" },
  sessionText: { flex: 1 },
  sessionTitle: { color: "#40362F", fontSize: 15, fontWeight: "800" },
  sessionDate: { marginTop: 2, color: "#85786E", fontSize: 12 },
});
