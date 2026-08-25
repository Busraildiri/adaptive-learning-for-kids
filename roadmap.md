# Adaptive Learning for Kids — Roadmap

Son güncelleme: 26 Ağustos 2026

Bu belge projenin yaşayan yol haritasıdır. Yapılan işler, devam eden işler, sıradaki işler ve karar bekleyen konular burada takip edilir.

## Güncelleme kuralı

- Her feature veya altyapı pull request’i ilgili roadmap maddesini günceller.
- Başlanan iş `[ ]` durumundan `[-]` durumuna alınır.
- Tamamlanan iş `[x]` olarak işaretlenir ve **Yapılanlar** bölümüne taşınır.
- Yeni kapsam doğrudan geliştirmeye alınmaz; önce **Daha sonra** veya **Karar bekleyenler** bölümüne eklenir.
- Bir iş, testleri ve kabul kriterleri tamamlanmadan bitmiş sayılmaz.
- Tarih yerine öncelik ve bağımlılık sırası esas alınır.

Durum göstergeleri:

- `[x]` Tamamlandı
- `[-]` Devam ediyor
- `[ ]` Başlanmadı
- `[!]` Karar veya dış inceleme bekliyor

## Ekip ve çalışma sırası

### Büşra — Backend, AI ve proje temeli

Büşra’nın birincil sorumlulukları:

- İlk monorepo ve geliştirme iskeletini kurmak.
- Root `package.json`, pnpm workspace ve ortak TypeScript ayarlarını yönetmek.
- Supabase ve PostgreSQL altyapısını kurmak.
- Ebeveyn hesabı, çocuk profili ve izin sistemini geliştirmek.
- API sözleşmelerini ve etkileşim olaylarının backend tarafını geliştirmek.
- İçerik şeması, içerik agent’ı ve admin panelini geliştirmek.
- Kanıt, kişiselleştirme ve insight motorlarının backend tarafını geliştirmek.
- Ortam değişkenleri, migration’lar, CI ve deployment altyapısını yönetmek.

Büşra’nın ana sahiplik alanları:

```text
apps/admin-web/
packages/content-schema/
packages/content-agent/
packages/analytics-events/
supabase/
Root proje ve CI dosyaları
```

### Serenay — Frontend ve mobil çocuk deneyimi

Serenay’ın birincil sorumlulukları:

- React Native ve Expo mobil uygulamasını geliştirmek.
- Çocuk modu ekranlarını hazırlamak.
- iPhone ve iPad uyumluluğunu sağlamak.
- Etkinlik durum makinesinin mobil entegrasyonunu yapmak.
- Ses ve görsel asset’leri uygulamada oynatmak.
- Yazısız ilerleme, cevap penceresi ve tekrar dinleme akışını geliştirmek.
- Mobil ebeveyn ekranlarını backend sözleşmelerine göre geliştirmek.
- Mobil kullanılabilirlik ve cihaz testlerini yürütmek.

Serenay’ın ana sahiplik alanları:

```text
apps/mobile/
packages/activity-engine/
Mobil UI bileşenleri ve mobil testler
```

### Ortak sahiplik

Şu alanlar iki kişinin ortak incelemesini gerektirir:

```text
packages/shared-types/
docs/
README.md
roadmap.md
API sözleşmeleri
Pedagojik ve gizlilik kararları
```

### Başlangıç bağımlılığı

- İlk proje iskeletini yalnızca Büşra kuracaktır.
- Serenay, Büşra açıkça başlangıç vermeden proje kodunda çalışmaya başlamayacaktır.
- Büşra monorepo, mobil uygulama iskeleti, ortak tipler ve CI temelini hazırlayacaktır.
- Büşra’nın `feature/project-foundation` pull request’i incelenip `main` dalına alındıktan sonra paralel geliştirme başlayacaktır.
- Başlangıç verildiğinde Serenay `feature/child-activity-flow`, Büşra ise `feature/content-schema` dalında çalışacaktır.
- İki kişi aynı root yapılandırma dosyasını eş zamanlı değiştirmeyecektir.

---

## Yapılanlar

### Ürün keşfi ve temel kararlar

- [x] Ürün amacı sosyal-duygusal öğrenme desteği olarak tanımlandı.
- [x] Ürünün tanı, hastalık ihtimali veya klinik risk üretmeyeceği kararlaştırıldı.
- [x] Hedef yaş aralığı 3–7 olarak belirlendi.
- [x] 3–5 ve 5–7 yaş katmanları ayrıldı.
- [x] 3–5 yaşta bireysel öğrenme insight’ı üretilmemesi kararlaştırıldı.
- [x] 5–7 yaş insight’larının izin ve veri yeterliliğine bağlı olması kararlaştırıldı.
- [x] Insight özelliğinin varsayılan olarak kapalı olması kararlaştırıldı.
- [x] Kişiselleştirme, insight ve anonim ürün geliştirme izinleri birbirinden ayrıldı.
- [x] Ebeveynin ham olayları standart panelde görmemesi kararlaştırıldı.
- [x] Ebeveynin yasal erişim, itiraz ve silme haklarının korunması kararlaştırıldı.
- [x] Çocuk verisinin AI geliştirmede kullanımı ayrı izne ve gerçek anonimleştirmeye bağlandı.

### Platform ve çocuk deneyimi

- [x] Web ve mobil karşılaştırması için kısa mobil prototip geliştirildi.
- [x] Prototip iPhone ve iPad üzerinde test edildi.
- [x] Ürünün iOS öncelikli mobil uygulama olması kararlaştırıldı.
- [x] React Native, Expo ve TypeScript mobil teknoloji temeli olarak seçildi.
- [x] Çocukla serbest konuşan AI ve çocuk ses kaydı MVP dışına çıkarıldı.
- [x] Çocuk etkileşiminin hazır ve yapılandırılmış seçeneklerden oluşması kararlaştırıldı.
- [x] Yazılı “Sonraki” ve “Tekrar dinle” düğmelerinin 3–5 yaş için uygun olmadığı testte gözlemlendi.
- [x] Çocuk akışının ses, zaman aşımı ve tam ekran dokunma ile ilerlemesi kararlaştırıldı.
- [x] Tekrar dinleme sayısı en fazla iki olarak sınırlandı.
- [x] Tekrar dinleme aşamasında duygu emojilerinin devre dışı olması kararlaştırıldı.
- [x] Tekrar dokunmasının duygu cevabından ayrı olay olarak kaydedilmesi kararlaştırıldı.
- [x] Doğru veya yanlış seçimden bağımsız sabit öğretim cümlesi kullanılması kararlaştırıldı.

### Hesap ve profil kararları

- [x] Ebeveyn hesabının zorunlu olması kararlaştırıldı.
- [x] E-posta doğrulaması ve ebeveyn PIN’i gereksinimi tanımlandı.
- [x] Çocuk profilinde takma ad, doğum ayı, doğum yılı, cinsiyet ve içerik dili tutulması kararlaştırıldı.
- [x] Tam doğum gününün tutulmaması kararlaştırıldı.
- [x] Cinsiyet bilgisinin tek başına insight veya zorluk belirlememesi kararlaştırıldı.

### İçerik ve asset kararları

- [x] İçerik üretimi için üretici ve denetleyici agent yaklaşımı seçildi.
- [x] İlk aşamada özel model eğitilmemesi kararlaştırıldı.
- [x] Agent çıktısının insan onayı olmadan yayınlanmaması kararlaştırıldı.
- [x] Pilot içeriklerinin çocuk gelişimi uzmanı incelemesine sunulması kararlaştırıldı.
- [x] Görsel sağlayıcısının kontrollü benchmark ile seçilmesi kararlaştırıldı.
- [x] TTS sağlayıcısının kör dinleme testiyle seçilmesi kararlaştırıldı.
- [x] Test uygulamasındaki cihaz TTS sesinin ürün sesi olmayacağı kararlaştırıldı.
- [x] Nihai seslerin önceden üretilmiş ve insan onaylı dosyalar olması kararlaştırıldı.

### Proje yönetimi

- [x] GitHub reposu oluşturuldu.
- [x] Ana ürün gereksinimleri README içine aktarıldı.
- [x] Korumalı `main` ve kısa feature branch yaklaşımı seçildi.
- [x] Uzun ömürlü `develop` branch’i kullanılmaması kararlaştırıldı.
- [x] Yaşayan `roadmap.md` belgesi oluşturuldu.
- [x] Büşra’nın backend/AI ve Serenay’ın frontend/mobil sorumluluğunu alması kararlaştırıldı.
- [x] İlk proje iskeletinin Büşra tarafından kurulması kararlaştırıldı.
- [x] Serenay’ın Büşra başlangıç vermeden geliştirmeye başlamaması kararlaştırıldı.
- [x] Monorepo için ilk aşamada Turborepo eklemeden pnpm workspace kullanılması kararlaştırıldı.

---

## Şimdi

### R0 — Repo ve geliştirme temeli

Aktif sorumlu: **Büşra**  
Serenay durumu: **Büşra’nın başlangıç bildirimini bekliyor**

- [x] **Büşra:** GitHub reposunu yerel bilgisayara clone et.
- [x] **Büşra:** Repo klasörünü VS Code’da aç.
- [ ] **Büşra:** Serenay’ı GitHub collaborator olarak ekle.
- [ ] **Büşra:** `main` branch korumasını aç.
- [ ] **Büşra:** Pull request için en az bir onay zorunluluğu getir.
- [x] **Büşra:** `feature/project-foundation` branch’ini oluştur.
- [x] **Büşra:** pnpm workspace tabanlı monorepo iskeletini kur.
- [x] **Büşra:** `apps/mobile` altında temiz Expo uygulaması oluştur.
- [x] **Büşra:** `apps/admin-web` için boş Next.js uygulama iskeleti oluştur.
- [x] **Büşra:** Paylaşılan TypeScript config, lint ve format kurallarını ekle.
- [x] **Büşra:** GitHub Actions ile typecheck, lint ve build kontrollerini ekle.
- [x] **Büşra:** `README.md` ve `roadmap.md` dosyalarının repo kökünde olduğunu doğrula.
- [x] **Büşra:** Proje temelini iPhone/iPad ve web build ile doğrula.
- [ ] **Büşra:** Foundation pull request’ini aç ve Serenay’dan inceleme iste.
- [ ] **Serenay:** Foundation pull request’ini incele; geliştirmeye henüz başlama.
- [ ] **Büşra:** Foundation merge edildikten sonra Serenay’a başlangıç bildirimi ver.

#### R0 kabul kriterleri

- iPhone ve iPad’de temiz mobil uygulama açılır.
- Admin web uygulaması yerelde çalışır.
- CI kontrolleri pull request üzerinde çalışır.
- `main` doğrudan push kabul etmez.
- `node_modules`, `.expo`, build çıktıları ve gizli dosyalar Git’e girmez.
- Büşra foundation pull request’ini tamamlamıştır.
- Serenay repo yapısını ve mobil sorumluluk alanını incelemiştir.
- Büşra paralel geliştirme için açık başlangıç bildirimi vermiştir.

---

## Sıradaki

### R1 — Çocuk etkinlik motoru

Birincil sorumlu: **Serenay**  
Başlangıç koşulu: **R0 tamamlanmış ve Büşra başlangıç vermiş olmalıdır.**

- [ ] Etkinlik durum makinesini domain paketi olarak tanımla.
- [ ] `PLAYING_NARRATION` durumunu uygula.
- [ ] `WAITING_FOR_EMOTION` durumunu uygula.
- [ ] `PLAYING_FEEDBACK` durumunu uygula.
- [ ] `WAITING_FOR_REPLAY_TAP` durumunu uygula.
- [ ] `REPLAYING` ve `TRANSITIONING` durumlarını uygula.
- [ ] Cevap zaman aşımını yapılandırılabilir yap.
- [ ] Üç saniyelik tekrar penceresini uygula.
- [ ] En fazla iki tekrar sınırını uygula.
- [ ] Tekrar aşamasında emoji dokunmalarını devre dışı bırak.
- [ ] Yazılı “Sonraki” düğmesi olmadan otomatik ilerlemeyi uygula.
- [ ] Durum geçişleri için unit test yaz.

#### R1 kabul kriterleri

- Çocuk okumadan bütün etkinliği tamamlayabilir.
- Seçim yapılmaması hata oluşturmaz.
- Tekrar dokunması duygu seçimi olarak işlenmez.
- İkinci tekrardan sonra etkinlik otomatik ilerler.
- Durum geçişlerinin tamamı testlerle kapsanır.

### R2 — İçerik şeması

Birincil sorumlu: **Büşra**  
Başlangıç koşulu: **R0 tamamlanmış olmalıdır.**

- [ ] `packages/content-schema` paketini oluştur.
- [ ] Activity, choice, asset ve içerik sürümü tiplerini tanımla.
- [ ] Zod doğrulamasını ekle.
- [ ] JSON Schema çıktısını oluştur.
- [ ] İlk 5–10 test senaryosunu şemaya taşı.
- [ ] Geçersiz içeriğin CI kontrolünü durdurmasını sağla.
- [ ] Öğretim, rehberli alıştırma, bağımsız uygulama ve aktarım türlerini ayır.

#### R2 kabul kriterleri

- Senaryolar `App.tsx` içine gömülü değildir.
- Mobil uygulama sürümlü içerik dosyalarını okuyabilir.
- Eksik veya geçersiz içerik yayınlanamaz.

### R3 — Görsel ve ses kontrollü testleri

- [ ] İlk iki ana karakter için karakter kitabı hazırla.
- [ ] Değişmeyecek karakter özelliklerini tanımla.
- [ ] Görsel sağlayıcı benchmark matrisini hazırla.
- [ ] 30 test görseli üret ve kör puanla.
- [ ] TTS testi için 10–15 Türkçe cümle hazırla.
- [ ] En az iki TTS sağlayıcısıyla ses varyasyonları üret.
- [ ] Sağlayıcı isimlerini gizleyerek kör dinleme testi yap.
- [ ] iPhone ve iPad hoparlörlerinde sesleri test et.
- [ ] Ürün sesini, hızını ve tonunu seç.
- [ ] Görsel ve TTS sağlayıcısı için mimari karar kaydı oluştur.

#### R3 kabul kriterleri

- Karakter tutarlılığı ölçülmüş bir sağlayıcı seçilir.
- Beğenilen Türkçe ürün sesi seçilir.
- Nihai uygulama cihaz TTS’sine bağımlı değildir.

### R4 — Ebeveyn hesabı ve çocuk profili

- [ ] Supabase projesini oluştur.
- [ ] Yerel, staging ve production ortamlarını ayır.
- [ ] E-posta/şifre kayıt akışını geliştir.
- [ ] E-posta doğrulamasını zorunlu yap.
- [ ] Ebeveyn/yasal temsilci beyanını ekle.
- [ ] Ebeveyn PIN’ini güvenli biçimde uygula.
- [ ] Çocuk profil tablosunu oluştur.
- [ ] Takma ad, doğum ayı/yılı, cinsiyet ve dil alanlarını ekle.
- [ ] Yaş katmanını ay ve yıldan hesapla.
- [ ] Row Level Security politikalarını yaz ve test et.

#### R4 kabul kriterleri

- Doğrulanmamış hesap çocuk moduna geçemez.
- Ebeveyn alanı PIN korumalıdır.
- Bir ebeveyn başka ebeveynin çocuk profilini okuyamaz.

### R5 — İzin yönetimi

- [ ] Kişiselleştirme iznini ekle.
- [ ] Öğrenme gözlemi iznini ekle.
- [ ] Anonim ürün/AI geliştirme iznini ekle.
- [ ] İzinleri varsayılan olarak kapalı yapılandır.
- [ ] İzin metni sürümünü kaydet.
- [ ] İzin geri çekme akışını geliştir.
- [ ] Audit log oluştur.

#### R5 kabul kriterleri

- Üç izin birbirinden bağımsız değiştirilebilir.
- AI geliştirme izni temel uygulama kullanımının koşulu değildir.
- Insight kapalıyken yeni bireysel gözlem üretilmez.

### R6 — Etkileşim olayları ve çevrimdışı senkronizasyon

- [ ] Sürümlü olay sözleşmesini oluştur.
- [ ] `packages/analytics-events` paketini oluştur.
- [ ] Expo SQLite olay kuyruğunu ekle.
- [ ] Batch senkronizasyon endpoint’ini geliştir.
- [ ] `eventId` tabanlı idempotency uygula.
- [ ] Olay sırasını `sequenceNumber` ile koru.
- [ ] İnternet kesintisi ve tekrar gönderim testlerini yaz.

#### R6 kabul kriterleri

- Etkinlik internet olmadan tamamlanır.
- Olaylar bağlantı gelince doğru sırada gönderilir.
- Aynı olay iki kez kaydedilmez.

### R7 — Kanıt ve kişiselleştirme motoru

- [ ] Etkileşim olayı ile öğrenme kanıtını ayır.
- [ ] `valid_evidence`, `limited_evidence`, `interaction_noise` ve `not_evaluated` sınıflarını uygula.
- [ ] Tek hızlı cevabın otomatik gürültü sayılmasını engelle.
- [ ] Tekrar dokunmalarını cevap analizinden çıkar.
- [ ] Kural tabanlı etkinlik seçim motorunu oluştur.
- [ ] Açıklanabilir karar logları ekle.
- [ ] Pilot öncesi varsayılan eşikleri yapılandırılabilir yap.

### R8 — İçerik agent’ı

- [ ] `packages/content-agent` paketini oluştur.
- [ ] Üretici agent’ı geliştir.
- [ ] Denetleyici agent’ı geliştir.
- [ ] Uzman onaylı rehberler için RAG kaynağı oluştur.
- [ ] Zorunlu JSON/Zod çıktısı uygula.
- [ ] Yasak dil ve güvenlik kontrollerini ekle.
- [ ] Agent’ın yalnızca `draft` içerik oluşturmasını sağla.
- [ ] Ret nedenlerini yapılandırılmış biçimde kaydet.

### R9 — Admin paneli

- [ ] İçerik üretim talebi ekranı.
- [ ] Taslak düzenleme ekranı.
- [ ] Otomatik kontrol sonuçları.
- [ ] Görsel varyasyon karşılaştırması.
- [ ] Ses dinleme ve seçme.
- [ ] Ortak onayı.
- [ ] Uzman onayı.
- [ ] Yayınlama, arşivleme ve sürüm geri alma.
- [ ] Admin audit log.

### R10 — MVP içerik paketi

- [ ] Dört temel duygu için içerik planı oluştur.
- [ ] 40–60 senaryo üret.
- [ ] 3–5 ve 5–7 yaş varyasyonlarını hazırla.
- [ ] Görsel ve ses asset’lerini üret.
- [ ] Bütün içerikleri iki ortak incelemesinden geçir.
- [ ] Bütün pilot içeriklerini uzman incelemesinden geçir.

### R11 — Ebeveyn oturum özeti ve insight altyapısı

- [ ] Tarafsız oturum özeti oluştur.
- [ ] Cold start ekranını geliştir.
- [ ] Insight uygunluk kapılarını uygula.
- [ ] Şablon tabanlı nitel gözlemler oluştur.
- [ ] Yüzde ve yaşıt karşılaştırmalarını yasaklayan testler ekle.
- [ ] Yetersiz veride gözlem oluşmamasını test et.

### R12 — Pilot

- [ ] Ekip içi test.
- [ ] Çocuk gelişimi uzmanı testi.
- [ ] 5–10 aileyle kullanılabilirlik testi.
- [ ] Bulgulara göre cevap ve tekrar sürelerini güncelle.
- [ ] Görsel ve ses geri bildirimlerini değerlendir.
- [ ] 20–30 aileyle sınırlı pilot.
- [ ] Gürültü ve insight eşiklerini pilot verisiyle güncelle.
- [ ] Gizlilik ve güvenlik incelemesi yap.

---

## Daha sonra

- [ ] Android cihaz doğrulaması ve mağaza yayını.
- [ ] Çoklu dil desteği.
- [ ] Kreş veya öğretmen paneli.
- [ ] Uzman görüşüne yönlendirme özelliğinin ayrı değerlendirmesi.
- [ ] Yeterli uzman onaylı veri oluşursa içerik modeli fine-tuning araştırması.
- [ ] Çocuğun sesini işlemeye yönelik ayrı güvenlik ve pedagojik araştırma.
- [ ] Serbest konuşan AI ihtiyacının yeniden değerlendirilmesi.

Bu maddeler MVP’ye otomatik olarak dahil değildir.

---

## Karar bekleyenler

- [!] Görsel üretim sağlayıcısı.
- [!] TTS sağlayıcısı ve ürün sesi.
- [!] Desteklenecek minimum iOS sürümü.
- [!] Cevap bekleme süresi.
- [!] Gürültü sınıflandırma katsayıları.
- [!] Insight için minimum veri eşikleri.
- [!] Veri sınıflarının kesin saklama süreleri.
- [!] Çocuk gelişimi uzmanıyla çalışma modeli.
- [!] Gelir ve abonelik modeli.

---

## Kapsam dışı

- Çocukla canlı serbest konuşan AI.
- Çocuk sesinin MVP’de kaydedilmesi.
- Kamera ve yüz analizi.
- Otizm veya başka bir durum için tanı.
- Klinik risk yüzdesi.
- Çocuğu yaşıtlarıyla sıralama.
- Reklam ve reklam SDK’ları.
- Agent çıktısının otomatik yayınlanması.
- Mikroservis ve Kubernetes altyapısı.

