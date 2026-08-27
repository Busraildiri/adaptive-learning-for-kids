# Adaptive Learning for Kids — Roadmap

Son güncelleme: 27 Ağustos 2026

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
- [x] Hedef yaş aralığı 2–7 olarak belirlendi.
- [x] 2–4 ve 4–7 yaş katmanları ayrıldı.
- [x] Katman sınırlarının ay yaşıyla belirlenmesi kararlaştırıldı: 2–4 katmanı 24–47 ayı, 4–7 katmanı 48–83 ayı kapsar.
- [x] 2–4 yaşta bireysel öğrenme insight’ı üretilmemesi kararlaştırıldı.
- [x] 4–7 yaş insight’larının izin ve veri yeterliliğine bağlı olması kararlaştırıldı.
- [x] Mevcut eski profillerde gözlemlerin kapalı kalması; yeni profillerde üç tercihin açık başlayıp ebeveyn tarafından kapatılabilmesi kararlaştırıldı.
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
- [x] Yazılı “Sonraki” ve “Tekrar dinle” düğmelerinin 2–4 yaş için uygun olmadığı testte gözlemlendi.
- [x] Çocuk akışının ses, zaman aşımı ve tam ekran dokunma ile ilerlemesi kararlaştırıldı.
- [x] Tekrar dinleme sayısı en fazla iki olarak sınırlandı.
- [x] Tekrar dinleme aşamasında duygu emojilerinin devre dışı olması kararlaştırıldı.
- [x] Tekrar dokunmasının duygu cevabından ayrı olay olarak kaydedilmesi kararlaştırıldı.
- [x] Duygular için tek bir doğru cevap varsayılmaması kararlaştırıldı.
- [x] Her duygu seçeneğinin, seçimi doğru/yanlış olarak etiketlemeden çocuğun yorumunu kabul eden ve düşünmesini destekleyen kendine özel geri bildirim taşıması kararlaştırıldı.

### Hesap ve profil kararları

- [x] Ebeveyn hesabının zorunlu olması kararlaştırıldı.
- [x] E-posta doğrulaması ve ebeveyn PIN’i gereksinimi tanımlandı.
- [x] Çocuk profilinde takma ad, doğum ayı/yılı ve içerik dilinin temel; ilgi alanlarının ise açık kişiselleştirme iznine bağlı olması kararlaştırıldı.
- [x] Tam doğum gününün tutulmaması kararlaştırıldı.
- [x] Veri minimizasyonu için cinsiyet bilgisinin 2–4 MVP profilinde tutulmaması kararlaştırıldı.

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
- [x] **Büşra:** Foundation pull request’ini aç ve Serenay’dan inceleme iste.
- [x] **Serenay:** Foundation pull request’ini incele; geliştirmeye henüz başlama.
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

- [x] Etkinlik durum makinesini domain paketi olarak tanımla.
- [x] `PLAYING_NARRATION` durumunu uygula.
- [x] `WAITING_FOR_EMOTION` durumunu uygula.
- [x] `PLAYING_FEEDBACK` durumunu uygula.
- [x] `WAITING_FOR_REPLAY_TAP` durumunu uygula.
- [x] `REPLAYING` ve `TRANSITIONING` durumlarını uygula.
- [x] Cevap zaman aşımını yapılandırılabilir yap.
- [x] Üç saniyelik tekrar penceresini uygula.
- [x] En fazla iki tekrar sınırını uygula.
- [x] Tekrar aşamasında emoji dokunmalarını devre dışı bırak.
- [x] Yazılı “Sonraki” düğmesi olmadan otomatik ilerlemeyi uygula.
- [x] Durum geçişleri için unit test yaz.

#### R1 kabul kriterleri

- Çocuk okumadan bütün etkinliği tamamlayabilir.
- Seçim yapılmaması hata oluşturmaz.
- Tekrar dokunması duygu seçimi olarak işlenmez.
- İkinci tekrardan sonra etkinlik otomatik ilerler.
- Durum geçişlerinin tamamı testlerle kapsanır.

Doğrulama: **26 Ağustos 2026 tarihinde fiziksel iPhone ve Expo Go üzerinde bütün akış başarıyla test edildi.**

### R1.1 — Cihaz testi sonrası çocuk akışı iyileştirmeleri

Birincil sorumlu: **Serenay**

Kaynak: **26 Ağustos 2026 tarihli cihaz testi bulguları**

- [x] “Tekrar dinlemek istersen ekrana dokun.” yönergesini sesli oynat.
- [x] Üç saniyelik tekrar penceresini sesli yönerge tamamlandıktan sonra başlat.
- [x] Tekrar sonrasında duygu seçimini yeniden etkinleştir.
- [x] En fazla iki tekrar sonrasında otomatik ilerle.
- [x] Tekrar yönergesi ve tekrar penceresinde duygu emojilerini devre dışı bırak.
- [x] Duygu emojilerini soru tamamlandığında tek seferlik büyüme animasyonuyla vurgula.
- [x] Seçime özel kabul cümlesini ortak hikâye çözümünden ayır.
- [x] Cevap verilmediğinde değerlendirme geri bildirimi oynatmadan tekrar yönergesine geç.
- [x] Yeni durum geçişleri için unit testleri güncelle.
- [ ] Akışı fiziksel iPhone ve Expo Go üzerinde yeniden doğrula.

#### R1.1 kabul kriterleri

- Çocuk yazılı bir düğmeyi okumadan tekrar dinleyebilir veya sonraki aktiviteye geçebilir.
- Tekrar penceresindeki dokunma duygu seçimi olarak işlenmez.
- Tekrar edilen hikâyeden sonra çocuk yeniden duygu seçebilir.
- İkinci tekrardan sonra yeni bir tekrar döngüsü başlamaz.
- Seçim doğru veya yanlış olarak etiketlenmeden hikâyenin ortak çözümü açıklanır.

### R2 — İçerik şeması

Birincil sorumlu: **Büşra**  
Başlangıç koşulu: **R0 tamamlanmış olmalıdır.**

- [x] `packages/content-schema` paketini oluştur.
- [x] Activity, choice, asset ve içerik sürümü tiplerini tanımla.
- [x] Yaş katmanlarını `2-4` (24–47 ay) ve `4-7` (48–83 ay) olarak şemaya ekle.
- [x] Her choice için zorunlu, seçeneğe özel destekleyici geri bildirim alanı tanımla.
- [x] Duygu choice modelinde `isCorrect`, `correctAnswer` veya tek doğru cevabı ifade eden eşdeğer alanları yasakla.
- [x] Zod doğrulamasını ekle.
- [x] JSON Schema çıktısını oluştur.
- [x] İlk 5–10 test senaryosunu şemaya taşı.
- [x] Geçersiz içeriğin CI kontrolünü durdurmasını sağla.
- [x] Öğretim, rehberli alıştırma, bağımsız uygulama ve aktarım türlerini ayır.

#### R2 kabul kriterleri

- Senaryolar `App.tsx` içine gömülü değildir.
- Mobil uygulama sürümlü içerik dosyalarını okuyabilir.
- Eksik veya geçersiz içerik yayınlanamaz.
- Her duygu seçeneği kendine özel destekleyici geri bildirim içerir.
- Duygu aktiviteleri tek bir doğru cevap tanımlamadan doğrulanabilir ve çalıştırılabilir.

Doğrulama: **26 Ağustos 2026 tarihinde altı sürümlü Türkçe senaryo Zod testlerinden ve Expo iOS export kontrolünden başarıyla geçti.**

### R2.1 — Tek hikâyelik oyun döngüsü prototipi

Birincil amaç: **Soru-cevap zinciri yerine oynanabilir bir dikey kesit doğrulamak**

- [x] “Mino'nun Balonu” adlı tek hikâyeyi sürümlü içerik dosyasına ekle.
- [x] Çocuğu geçici oturum profili ve adıyla karşıla.
- [x] Balon seçme, dokunarak şişirme ve patlama sonucunu görme akışını uygula.
- [x] Hikâye içinde yalnızca bir açık duygu sorusu kullan.
- [x] Her duygu seçeneğine yargılamayan, seçime özel geri bildirim ekle.
- [x] Sarılma, yeni balon verme ve birlikte nefes alma yardım eylemlerini ekle.
- [x] Emoji yerine özgün, şeffaf arka planlı Mino karakter görsellerini kullan.
- [x] İçerik şemasına `choice`, `tap`, `event`, `emotion_choice`, `help_choice`, `breathing` ve `closing` adımlarını ekle.
- [ ] Akışı fiziksel iPhone ve Expo Go üzerinde çocuk gözüyle yeniden doğrula.

Not: Prototip artık R4'te oluşturulan gerçek `ChildSessionProfile` verisini kullanır ve çocuğu profilindeki takma adla karşılar.

#### R2.1 kabul kriterleri

- Çocuk art arda duygu soruları yanıtlamadan hikâyeyi tamamlayabilir.
- Balon seçimi ekrandaki balon rengini değiştirir ve dokunmalar balonu büyütür.
- Çocuğun yardım seçimi farklı, doğal bir hikâye sonucuna dönüşür.
- Hikâye okuma bilmeden ses ve büyük görsel hedeflerle oynanabilir.

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

- [x] Supabase CLI yerel proje yapılandırmasını ve sürümlü migration altyapısını oluştur.
- [x] Ortak `adaptive-kids-staging` Supabase projesini oluştur.
- [-] Yerel ve staging yapılandırmalarını ayır; production projesini pilot öncesinde ayrıca oluştur.
- [x] E-posta/şifre kayıt akışını geliştir ve staging projesinde fiziksel cihazla doğrula.
- [x] E-posta doğrulamasını zorunlu yap ve doğrulama bağlantısını fiziksel cihazda test et.
- [-] Ebeveyn/yasal temsilci beyanını ekle; geliştirme taslağını pilot öncesi hukuki incelemeye gönder.
- [-] Ebeveyn PIN’ini ayrı private tabloda hash’lenmiş biçimde uygula; yerel SQL testini çalıştır.
- [-] Çocuk profil tablosunu migration olarak oluştur ve staging veritabanına uygula; Docker kurulduğunda yerel reseti de doğrula.
- [x] Takma ad, doğum ayı/yılı ve dili temel profile ekle; sevilen oyuncak/hayvan ve ilgi alanlarını R5 kişiselleştirme iznine bağla.
- [x] Veri minimizasyonu nedeniyle cinsiyet bilgisini 2–4 MVP profilinden çıkar.
- [x] İlk girişte yalnızca takma ad ve doğum ayı/yılını sor; sevilen oyuncak, hayvan ve ilgi alanlarını kişiselleştirme izni açıldıktan sonra iste.
- [x] Ebeveyn “başlat” dediğinde profil verisini çocuk oturumuna aktar ve çocuğu adıyla sesli karşıla.
- [x] Yaş katmanını ay ve yıldan hesapla ve sınır değerleri unit testlerle doğrula.
- [-] Row Level Security politikalarını ve iki ebeveyn izolasyon testini yaz; Docker bulunan ortamda testi çalıştır.
- [x] Aktif çocuk modunu cihazın güvenli deposunda sakla; uygulama yeniden açıldığında PIN kapısının atlanmasını engelle.

Doğrulama notu: **Mobil lint, TypeScript, 28 unit test ve Expo iOS export başarılıdır. `20260826222303_parent_child_profiles.sql` migration'ı `adaptive-kids-staging` projesine uygulanmış; fiziksel cihazda kayıt ve e-posta doğrulama akışı tamamlanmıştır. Supabase pgTAP runner uzak proje seçilse bile yerel Docker çalıştırıcısı istediği için 13 maddelik otomatik RLS testi henüz yürütülememiştir.**

#### R4 kabul kriterleri

- Doğrulanmamış hesap çocuk moduna geçemez.
- Ebeveyn alanı PIN korumalıdır.
- Bir ebeveyn başka ebeveynin çocuk profilini okuyamaz.

### R5 — İzin yönetimi

- [x] Çocuk bazlı kişiselleştirme iznini ekle.
- [x] 2–4 yaşta da ebeveynin açabildiği çocuk bazlı öğrenme gözlemi iznini ekle.
- [x] Anonim ürün/AI geliştirme iznini ayrı ekle.
- [x] Mevcut profilleri kapalı bırak; migration sonrasında oluşturulan yeni profillerde üç tercihi de açık başlat.
- [x] İzin metni sürümünü, verilme ve geri çekilme zamanlarını kaydet.
- [x] Kişiselleştirme geri çekildiğinde isteğe bağlı profil alanlarını sil.
- [x] Mobil istemciye kapalı, eklemeli izin audit log’u oluştur.
- [x] Başka ebeveyn erişimini, doğrudan tablo yazımını ve eski metin sürümünü SQL testleriyle reddet.
- [-] İzin metinlerini çocuklarla pilot öncesinde hukuk ve etik incelemeye gönder.

Doğrulama notu: **`20260827002500_consent_management.sql` ve ileriye dönük yeni profil
varsayılanını belirleyen `20260827043000_enable_consents_for_new_children.sql` ortak
`adaptive-kids-staging` projesine uygulanmış ve uzak şema lint’i hatasız tamamlanmıştır. Biome, TypeScript,
31 unit test ve Expo iOS export başarılıdır. 19 maddelik izin/RLS pgTAP testi yazılmıştır;
Supabase test runner yerel Docker gerektirdiği için henüz çalıştırılamamıştır.**

#### R5 kabul kriterleri

- Üç izin birbirinden bağımsız değiştirilebilir.
- AI geliştirme izni temel uygulama kullanımının koşulu değildir.
- Öğrenme gözlemleri 2–4 yaşta kalıcı olarak kilitli değildir; yeni profilde açık başlar ve ebeveyn kapatabilir.
- İzin gerekli ama yeterli değildir: R7 kanıt motoru yeterli oturum ve güvenilir kanıt eşiğini ayrıca uygulamalıdır.
- Gözlem kapalıyken yeni bireysel gözlem üretilemez; açıkken dahi tanı, puan, akran karşılaştırması veya kalıcı yetersizlik iddiası üretilemez.

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
- [ ] 2–4 ve 4–7 yaş varyasyonlarını hazırla.
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
