# Adaptive Learning for Kids — Roadmap

Son güncelleme: 28 Ağustos 2026

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
- [x] Google OAuth ebeveyn kayıt/giriş düğmesini, güvenli tarayıcı dönüşünü ve oturum kurulumunu ekle.
- [x] Google Cloud OAuth istemcisini oluştur ve Supabase Google sağlayıcısını etkinleştir.
- [-] Google OAuth akışını development build ile fiziksel iPhone'da doğrula; EAS development profili
      hazırlandı, Apple imzalama ve cihaz testi ertelendi.
- [x] E-posta doğrulamasını zorunlu yap ve doğrulama bağlantısını fiziksel cihazda test et.
- [x] Auth e-postaları için Brevo SMTP'ye geç (yerleşik servisin proje genelindeki 2/saat
      limiti ve dış adres kısıtı nedeniyle); yerel yapılandırmayı yalnızca gizli ortam
      değişkenlerinden okuyacak şekilde hazırla.
- [-] Ebeveyn/yasal temsilci beyanını ekle; geliştirme taslağını pilot öncesi hukuki incelemeye gönder.
- [x] Ebeveyn/yasal temsilci ve gizlilik beyanlarını ayrı, görünür ve zorunlu onaylar olarak uygula.
- [x] Ebeveyn PIN’ini ayrı private tabloda hash’lenmiş biçimde uygula; yerel SQL testini çalıştır.
- [x] Çocuk profil tablosunu migration olarak oluştur, staging veritabanına uygula ve yerel reseti doğrula.
- [x] Takma ad, doğum ayı/yılı ve dili temel profile ekle; sevilen oyuncak/hayvan ve ilgi alanlarını R5 kişiselleştirme iznine bağla.
- [x] Veri minimizasyonu nedeniyle cinsiyet bilgisini 2–4 MVP profilinden çıkar.
- [x] İlk girişte yalnızca takma ad ve doğum ayı/yılını sor; sevilen oyuncak, hayvan ve ilgi alanlarını kişiselleştirme izni açıldıktan sonra iste.
- [x] Ebeveyn “başlat” dediğinde profil verisini çocuk oturumuna aktar ve çocuğu adıyla sesli karşıla.
- [x] Yaş katmanını ay ve yıldan hesapla ve sınır değerleri unit testlerle doğrula.
- [x] Row Level Security politikalarını ve iki ebeveyn izolasyon testini yazıp yerel PostgreSQL üzerinde çalıştır.
- [x] Aktif çocuk modunu cihazın güvenli deposunda sakla; uygulama yeniden açıldığında PIN kapısının atlanmasını engelle.

Doğrulama notu: **Mobil lint, TypeScript, 28 unit test ve Expo iOS export başarılıdır. `20260826222303_parent_child_profiles.sql` migration'ı `adaptive-kids-staging` projesine uygulanmış; fiziksel cihazda kayıt ve e-posta doğrulama akışı tamamlanmıştır. Yerel Supabase/PostgreSQL sıfırdan kurulmuş ve 13 maddelik otomatik profil/RLS pgTAP testi başarıyla çalıştırılmıştır. Brevo SMTP'nin repo ve yerel geliştirme yapılandırması tamamlanmıştır; Brevo hesabı, doğrulanmış gönderen ve uzak Supabase Dashboard bilgileri proje sahibi tarafından elle girildikten sonra dış adrese teslim testi yapılacaktır.**

#### R4 eksikler

- E-posta kayıt doğrulamasını tarayıcı yönlendirmesine bağımlı bağlantı yerine uygulama içinde
  girilen 6 haneli kod akışına dönüştür. Bu tamamlanana kadar doğrulama bağlantısı hesabı başarıyla
  doğrulasa bile geçersiz dönüş adresi tarayıcıda hata gösterebilir; kullanıcı uygulamaya dönerek
  giriş yapabilir.
- Google Cloud OAuth istemcisi ve Supabase Google provider yapılandırıldı; ancak Google hesabıyla
  uygulama içi giriş iPhone'da uçtan uca tamamlanmadı. Expo Go bu deep-link akışı için yeterli
  değildir; fiziksel iPhone testi Apple imzalı development build ve dolayısıyla aktif Apple Developer
  Program üyeliği gerektirir. Bu doğrulama tamamlanana kadar Google girişi kullanıma hazır kabul edilmez.
- Brevo SMTP repo yapılandırması hazırdır; Brevo hesabı ve SMTP key oluşturma, gönderen adresini
  doğrulama, uzak Supabase Dashboard'a kimlik bilgilerini girme ve Serenay'ın adresiyle uçtan uca
  teslim testi dış adım olarak beklemektedir.
- iOS fiziksel cihaz giriş testi ve dağıtılabilir development build henüz yoktur; EAS profili
  hazırdır fakat Apple imzalama ve cihaz kaydı tamamlanmamıştır.

#### R4 kabul kriterleri

- Doğrulanmamış hesap çocuk moduna geçemez.
- Ebeveyn alanı PIN korumalıdır.
- Bir ebeveyn başka ebeveynin çocuk profilini okuyamaz.

#### R4.1 — Parola kurtarma ve değiştirme

- [x] Giriş ekranına hesap varlığını açıklamayan “Parolamı unuttum” akışını ekle.
- [x] Paketlenmiş uygulama deep-link dönüşünü işle ve ilerideki development build için koru.
- [x] E-posta bağlantısından gelen recovery oturumunda yeni parola ekranını zorunlu göster.
- [x] Oturum açıkken mevcut parolayı doğrulayarak parola değiştirme ekranını ekle.
- [x] Staging’de mevcut parola doğrulamasını sunucu tarafında zorunlu kıl ve istemcide yeniden kimlik doğrula.
- [x] Expo Go için altı haneli recovery kodu doğrulama akışını ekle.
- [x] Oturumu açık fakat parolasını unutmuş ebeveyne kayıtlı adresine kod gönderme seçeneği ekle.
- [x] Deep-link ayrıştırması, parola politikası ve recovery kodu için unit testleri yaz.
- [x] Supabase staging redirect allowlist’ine `adaptivekids://**` ve `exp://**` adreslerini kaydet.
- [x] Staging e-posta OTP uzunluğunu uygulamayla uyumlu biçimde altı hane olarak ayarla.
- [x] Yerel ve staging Auth e-postaları için Brevo SMTP yapılandırmasını hazırla; SMTP login,
      SMTP key ve doğrulanmış gönderen adresini kaynak koddan ayır.
- [x] Reset password şablonunda `{{ .Token }}` kodunu göster.
- [x] Fiziksel cihazda parola yenileme kodunu Expo Go üzerinde doğrula.
- [ ] Dış kullanıcılarla kapalı test başlamadan önce uygun bir alan adı satın al, auth e-postaları
      için ayrı bir gönderim alt alanını (ör. `auth.alanadi.com`) Brevo'da DNS kayıtlarıyla doğrula
      ve Supabase gönderen adresini bu alana taşı.
- [ ] Doğrulanmış alan adıyla farklı e-posta sağlayıcılarına kayıt doğrulama ve parola yenileme
      e-postalarının teslimini test et; kişisel test göndericisini pilot veya production'da kullanma.

Doğrulama notu: **Expo, kararlı kimlik doğrulama yönlendirmeleri için Expo Go yerine development
build önerir. Bu nedenle Expo Go cihaz testinde e-posta kodu, development/production build’de
`adaptivekids://` deep link kullanılacaktır. Production’da `exp://**` wildcard’ı ve kişisel SMTP
hesabı kullanılmayacaktır. Alan adı satın alma ve DNS doğrulaması maliyet nedeniyle ertelenmiştir;
Resend deneme göndericisi dış kullanıcı testini destekleyen kalıcı çözüm sayılmayacaktır. 27 Ağustos
2026 tarihinde Supabase parola yenileme isteği Resend üzerinden gönderilmiş ve teslimat günlüğünde
`opened` durumuna ulaşmıştır. Aynı tarihte altı haneli kod doğrulama, parola değiştirme ve yeni
parolayla yeniden giriş akışı fiziksel cihazda Expo Go üzerinde başarıyla tamamlanmıştır.**

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
31 unit test ve Expo iOS export başarılıdır. 19 maddelik izin/RLS pgTAP testi yerel
Supabase/PostgreSQL üzerinde başarıyla çalıştırılmıştır.**

#### R5 kabul kriterleri

- Üç izin birbirinden bağımsız değiştirilebilir.
- AI geliştirme izni temel uygulama kullanımının koşulu değildir.
- Öğrenme gözlemleri 2–4 yaşta kalıcı olarak kilitli değildir; yeni profilde açık başlar ve ebeveyn kapatabilir.
- İzin gerekli ama yeterli değildir: R7 kanıt motoru yeterli oturum ve güvenilir kanıt eşiğini ayrıca uygulamalıdır.
- Gözlem kapalıyken yeni bireysel gözlem üretilemez; açıkken dahi tanı, puan, akran karşılaştırması veya kalıcı yetersizlik iddiası üretilemez.

### R6 — Etkileşim olayları ve çevrimdışı senkronizasyon

- [x] Sürümlü olay sözleşmesini oluştur.
- [x] `packages/analytics-events` paketini oluştur.
- [x] Expo SQLite olay kuyruğunu ekle.
- [x] Batch senkronizasyon endpoint’ini geliştir.
- [x] `eventId` tabanlı idempotency uygula.
- [x] Olay sırasını `sequenceNumber` ile koru.
- [x] İnternet kesintisi ve tekrar gönderim testlerini yaz.

Doğrulama notu: **Sürüm 1 olay sözleşmesi, oturum bazlı sıralı Expo SQLite kuyruğu ve
`sync_interaction_events` batch RPC'si tamamlandı. Mobil istemci olayları yalnızca öğrenme gözlemi
izni açıkken üretir; izin geri çekildiğinde bekleyen olaylar silinir ve sunucu yeni olayları ayrıca
reddeder. Migration `adaptive-kids-staging` projesine uygulandı ve uzak şema lint'i hatasız
tamamlandı. TypeScript, Biome ve 50 unit test başarılıdır. Sekiz maddelik SQL pgTAP testi yerel
Supabase/PostgreSQL üzerinde başarıyla çalıştırılmıştır.**

#### R6 kabul kriterleri

- Etkinlik internet olmadan tamamlanır.
- Olaylar bağlantı gelince doğru sırada gönderilir.
- Aynı olay iki kez kaydedilmez.

### R6.1 — Çoklu Mino hikayesi ve hikaye seçimi

- [x] Mevcut balon hikâyesinin yanına kısa kule ve arkadaşa veda hikâyelerini ekle.
- [x] Yeni hikâyelerde mevcut `scene-block-tower` ve `scene-friend-goodbye` emoji-symbol
      asset'lerini ve mevcut iki Mino karakter görselini kullan.
- [x] Her hikâyeye tek doğru cevabı olmayan, seçenek bazlı destekleyici geri bildirim sunan
      en az bir duygu seçimi ekle.
- [x] Hikâye oynatıcıyı dışarıdan `story` alan ve symbol sahne asset'lerini gösteren yapıya getir.
- [x] Çocuk modu ile oynatıcı arasına erişilebilir hikâye seçim ekranı ekle.
- [x] İçerik sözleşmesi ve hikâye seçim davranışı için unit testleri ekle.

Doğrulama notu: **`content.v1.json` içindeki üç hikâye `contentVersionSchema` doğrulamasından
geçer. Yeni dosya asset'i eklenmemiştir; sahne görselleri mevcut emoji-symbol kayıtlarından,
karakterler mevcut Mino PNG'lerinden gelir. Biome, TypeScript, mobil/content-schema testleri ve Expo
iOS export başarılıdır.**

### R7 — Kanıt ve kişiselleştirme motoru

- [x] Etkileşim olayı ile öğrenme kanıtını ayır.
- [x] `valid_evidence`, `limited_evidence`, `interaction_noise` ve `not_evaluated` sınıflarını uygula.
- [x] Tek hızlı cevabın otomatik gürültü sayılmasını engelle.
- [x] Tekrar dokunmalarını cevap analizinden çıkar.
- [x] Kural tabanlı etkinlik seçim motorunu oluştur.
- [x] Açıklanabilir karar logları ekle.
- [x] Pilot öncesi varsayılan eşikleri yapılandırılabilir yap.

Doğrulama notu: **`@adaptive/evidence-engine`, ham etkileşim olaylarından ayrı oturum kanıtı
üretir. Tek hızlı yanıt `limited_evidence` olarak korunur; aynı adımdaki tekrar dokunmaları ilk
anlamlı cevaptan ayrı sayılır. Supabase private kanıt tablosu, sürümlü eşik yapılandırması,
deterministik etkinlik seçim RPC'si ve eklemeli karar logu migration olarak eklenmiştir. Mobil hikâye
seçim ekranı önerilen etkinliği ilk sıraya alır; izin kapalıysa genel sıraya döner.
`20260827143000_evidence_engine.sql` staging projesine uygulanmış, uzak şema lint'i, Biome,
TypeScript, 61 unit test ve Expo iOS export başarılıdır. Sekiz maddelik pgTAP testi yerel
Supabase/PostgreSQL üzerinde başarıyla çalıştırılmıştır.**

#### R7 kabul kriterleri

- Ham olaylar kanıt veya kalıcı çocuk özelliği olarak doğrudan yorumlanmaz.
- Tek hızlı yanıt gürültü sayılmaz ve tek başına kalıcı çıkarım üretmez.
- Her etkinlik seçimi sürümlü eşik ve yargılamayan bir neden koduyla geriye dönük izlenebilir.

### R8 — İçerik agent’ı

- [x] `packages/content-agent` paketini oluştur.
- [x] Zorunlu yapılandırılmış çıktı kullanan, model sağlayıcısından bağımsız üretici agent’ı geliştir.
- [x] Üreticiden ayrı model istemcisi ve karar şeması kullanan denetleyici agent’ı geliştir.
- [x] LLM'nin sabit hikâye iskeletleri içinde anlatım, olay, duygu ve yardım varyantları
      üretmesini sağla; temel oyun mekaniğini ve izin verilen asset listesini değiştirmesine izin verme.
- [x] Üretici model çıktısını çocuğa doğrudan gösterme; ayrı denetleyici model, deterministik
      güvenlik kuralları ve `storySchema` doğrulamasından geçir.
- [x] Tek doğru duygu, yargılayıcı geri bildirim, tanı, beceri puanı, korkutucu ayrıntı ve
      yaşa uygun olmayan dili otomatik reddet.
- [x] Model, prompt hash'i, şema, güvenlik/rehber sürümleri, denetim sonucu ve taslak içerik sürümünü eklemeli audit kaydında sakla.
- [x] Üretim veya denetim başarısız olduğunda son onaylı ve cihazda önbelleklenebilen hikâyeye dön.
- [-] Sürümlü Türkçe RAG rehber kaynağını oluştur; pilot öncesinde içerik uzmanı onayını tamamla.
- [x] Zorunlu JSON/Zod çıktısı uygula.
- [x] Yasak dil ve güvenlik kontrollerini ekle.
- [x] Agent’ın yalnızca `draft` içerik oluşturmasını sağla.
- [x] Ret nedenlerini yapılandırılmış biçimde kaydet.
- [x] OpenAI Responses API sağlayıcısını strict JSON Schema ve `store: false` ile sunucu tarafına bağla.
- [x] OpenAI üretici ve denetleyici rollerini ayrı model çağrıları olarak yapılandır; API anahtarını
      yalnızca Git tarafından dışlanan kök `.env` dosyasından yükle ve mobil paketten uzak tut.

Doğrulama notu: **Üretici ve ayrı denetleyici, `storySchema`, sabit mekanik/asset kapısı,
Türkçe güvenlik kuralları, sürümlü rehber erişimi, eklemeli private audit/fallback tabloları ve güvenli
geri dönüş akışı tamamlandı. OpenAI Responses bağlantısı `gpt-5.4-mini`, strict Structured Outputs ve
`store: false` ile gerçek API isteğinde doğrulandı; normal testler kredi harcamaz. İçerik agent'ının
15 unit testi, monorepo genelinde 76 unit test ve yerel
Supabase/PostgreSQL üzerinde 57 pgTAP testi başarılıdır. Audit migration'ı staging projesine
uygulanmıştır. Rehber dosyası teknik olarak hazırdır ancak pilot kullanımı içerik uzmanı onayı bekler.**

#### R8 eksikler

- Prototip aşamasında ücretli Anthropic API kullanılmayacaktır. Uygulama piyasaya sunulmadan veya
  gerçek kullanıcı pilotuna açılmadan önce Claude için ayrı reviewer API anahtarı oluşturulmalı,
  sunucu secret deposuna eklenmeli ve bağımsız sağlayıcı denetimi uçtan uca doğrulanmalıdır.
- OpenAI prototip üreticisi ve ayrı reviewer çağrısı etkinleştirilmiştir. İki rol aynı sağlayıcı ailesini
  kullandığı için bu yapı bağımsız sağlayıcı denetimi sayılmaz; pilot/piyasa öncesinde Claude gibi ikinci
  bir sağlayıcıyla kör nokta çeşitliliği ve maliyet yeniden değerlendirilmelidir.
- R9 kuşkulu içerik kuyruğu ve yayın kapısı tamamlanana kadar hiçbir model çıktısı otomatik
  yayınlanmamalı; OpenAI çıktıları deterministik güvenlik kontrollerinden geçmeli ve yalnızca `draft`
  durumunda tutulmalıdır.
- Gemini API anahtarı şu anda Free tier projeye aittir. Türkiye'deki ücretsiz API kullanımında prompt ve
  yanıtların Google ürün/model geliştirmesinde kullanılabilmesi ürün gizliliği duruşuyla uyumlu değildir;
  gerçek hikâye üretimi paid tier doğrulanana kadar teknik olarak kapalı tutulmalıdır.
- İnsan onayı tüm içerikler için zorunlu bir darboğaz olmamalıdır. Otomatik kontrollerden yüksek güvenle
  geçen içerik yayın sırasına alınmalı; yalnızca kuşkulu içerikler insan inceleme kuyruğuna düşmelidir.
- Kuşkulu içerik onaylanırsa yayınlanmalı, reddedilirse içerik gövdesi hemen silinmeli; 15 gün boyunca
  işlem yapılmazsa içerik gövdesi otomatik silinmeli ve yalnızca minimal ret/süre aşımı audit kaydı kalmalıdır.

#### R8 kabul kriterleri

- LLM çıktısı denetleyici ve deterministik kontrollerden geçmeden çocuğa ulaşmaz.
- Uygulama yeni içerik üretilemediğinde çevrimdışı ve güvenli bir hikâyeyle çalışmaya devam eder.
- Yayınlanan her hikâye model, prompt, şema ve denetim sürümleriyle geriye dönük izlenebilir.
- Yalnızca kuşkulu taslaklar insan incelemesine düşer; bekleyen taslak içerikleri 15 gün sonunda otomatik silinir.

### R8.1 — Beş hikâye sonrası açıklanabilir kişiselleştirme

- [x] Kişiselleştirilmiş önerileri en az beş tamamlanmış ve birbirinden farklı hikâyeden sonra aç.
- [x] Yalnızca tekrar seçimi, tamamlama, yardım tercihi ve birden fazla oturumda tutarlı tercih gibi
      sınırlı etkileşim sinyallerini kullan.
- [x] Kişiselleştirmeyi hem `personalization` hem `learning_observations` izni açıkken çalıştır;
      izinlerden biri kapanırsa genel hikâye rotasyonuna geri dön.
- [x] Tek bir dokunuştan, hızlı cevaptan veya yarıda kalan hikâyeden kalıcı çıkarım üretme.
- [x] Öneri gerekçesini ebeveyne olumlu ve gözlenebilir dille göster; tanı, kişilik etiketi,
      akran karşılaştırması veya yetersizlik iddiası kullanma.
- [x] Ebeveyne kişiselleştirilmiş önerileri kapatma ve genel hikâye rotasyonuna dönme kontrolü ver.
- [x] Kullanılan kanıt sayısını, güvenilirlik eşiğini ve öneri nedenini sürümlü karar logunda sakla.

#### R8.1 kabul kriterleri

- Beş farklı hikâye tamamlanmadan kişiselleştirilmiş öneri üretilmez.
- İzin kapatıldığında yeni kişiselleştirilmiş çıkarım ve öneri oluşturulmaz.
- Her öneri ebeveyne anlaşılır, yargılamayan ve gözlenebilir bir gerekçeyle açıklanır.

Doğrulama notu: **`personalization-policy-v1` karar motoru, iki bağımsız izin kapısı, beş farklı
tamamlama eşiği, çoklu oturum sinyalleri, ebeveyn açıklama kartı ve private karar audit'i eklendi.
Yerel Supabase sıfırdan kuruldu; R8.1'in 9 pgTAP testi dahil toplam 99 veritabanı testi ve
kişiselleştirme paketinin 6 unit testi geçti. Eşiğin gerçek cihazda erişilebilir olması için yalnızca
mevcut `scene-lost-toy` sembolünü ve Mino görsellerini kullanan beşinci kısa hikâye eklendi; içerik
şeması testi beş oynanabilir hikâyeyi doğrular.**

### R9 — Admin paneli

- [x] Next.js tabanlı, çocuk uygulamasından ayrı ve mobil uyumlu yönetim paneli temelini oluştur.
- [x] Supabase e-posta/parola oturumu ve `private.content_admins` allowlist'iyle yönetici erişimini sınırla.
- [x] Yalnızca kuşkulu içerikleri gösteren inceleme kuyruğu ve yapılandırılmış kuşku nedenleri.
- [x] İnceleme kuyruğunda hikâye önizlemesi, kalan süre, onayla/yayınla ve reddet/içeriği sil eylemleri.
- [x] Yüksek güvenli taslağı yayın deposuna, düşük güvenli veya neden kodlu taslağı kuyruğa yönlendiren
      sunucu-only publication sink ve service-role RPC'si geliştir.
- [x] İşlem yapılmayan kuşkulu içerik gövdelerini 15 gün sonunda otomatik silen saatlik retention görevi.
- [x] Ret ve süre aşımında içerik gövdesini fiziksel olarak sil; minimal ve eklemeli karar audit kaydını koru.
- [x] Yayınlanan hikâyeleri sürümlü ve yalnızca oturum açmış ailelerin okuyabildiği depoda sakla.
- [x] Yönetici olmayan, anonim ve mobil istemcilerin kuyruk/karar/yayın RPC'lerine erişimini engelle.

Doğrulama notu: **Yerel Supabase sıfırdan kuruldu; kuyruk, allowlist, onay/yayın, ret/silme,
otomatik yönlendirme ve 15 günlük süre aşımı dahil monorepo genelinde 82 pgTAP testi geçti.
Admin panelinin 3 unit testi, content-agent'ın 20 unit testi, TypeScript ve Next.js production build'i
başarılıdır. İnceleme kuyruğu migration'ı staging projesine uygulanmıştır. Service-role anahtarı web
istemcisine verilmez; kök sunucu ortamında kalır.**

#### R9 sonraki editoryal araçlar

- [x] İçerik üretim talebi ekranı.
- [ ] Taslak düzenleme ekranı.
- [ ] Otomatik kontrol sonuçları.
- [ ] Görsel varyasyon karşılaştırması.
- [ ] Ses dinleme ve seçme.
- [ ] Ortak onayı.
- [ ] Uzman onayı.
- [ ] Yayın arşivleme ve sürüm geri alma.

### R9.1 — Yönetim panelinden kontrollü hikâye üretimi

- [x] Yönetici allowlist kontrolünden sonra erişilen “Yeni hikâye üret” formunu ekle.
- [x] Tema, hedef duygu, mevcut hikâye mekaniği ve onaylı sahne asset'i seçimlerini sınırla.
- [x] OpenAI üretici ve bağımsız denetleyici çağrılarını yalnızca Next.js sunucu route'unda çalıştır.
- [x] API ve service-role anahtarlarının tarayıcıya veya mobil uygulamaya aktarılmasını engelle.
- [x] Üretilen taslağı mevcut şema, çocuk güvenliği ve asset-anlatı tutarlılığı kontrollerinden geçir.
- [x] Audit kaydını publication işleminden önce private ve eklemeli tabloda sakla.
- [x] Başarılı taslağı yayın havuzuna, kuşkulu veya özellikle işaretlenen taslağı 15 günlük inceleme
      kuyruğuna yönlendir.
- [x] Yetkisiz mobil veya tarayıcı istemcisinin generation audit RPC'sini çağırmasını engelle.
- [x] Gerçek OpenAI anahtarıyla yerel panelden bir kontrollü üretim smoke testi yap.
- [x] `20260827223000_content_generation_api.sql` migration'ını staging'e uygula.

Doğrulama notu: **Kod, soyut olay akışı formu, server-only üretim route'u, model denetimi,
audit-before-publication bağlantısı ve service-role erişim sınırı tamamlandı. OpenAI `gpt-5.4-mini`
ile gerçek üretici/denetleyici smoke testi yapıldı; üretilen taslak isteğe uygun biçimde 15 günlük
inceleme kuyruğuna düştü. Generation audit migration'ı staging projesine uygulandı.**

### R9.2 — Üç sahneli etkileşimli hikâye videosu ve gerçek dallanma

Birincil amaç: **Mevcut MP4 üretimini bozmadan, tek hikâye planından uygulamada seçimlerle
ilerleyen kısa video bölümleri üretmek.**

#### Tamamlanan üretim temeli

- [x] Mevcut OpenMontage/HyperFrames hattıyla görsel, Türkçe TTS ve MP4 üretimini koru.
- [x] Tek serbest metin promptunu yapılandırılmış, kronolojik ve tam üç sahneli `StoryVideoInput`
      planına dönüştür.
- [x] Üç sahneyi başlangıç, hafif gündelik sorun ve güvenli çözüm sırasıyla birbirine bağımlı üret.
- [x] Karakter kitabını, görsel stili ve mekân sürekliliğini bütün sahne promptlarına taşı.
- [x] Her sahne için ayrı görsel promptu ve ayrı anlatım metni oluştur.
- [x] Sahne anlatımlarını Türkçe Piper TTS ile üretip gerçek ses süresine göre zaman çizelgesine yerleştir.
- [x] Bütün sahneleri tek zaman çizgisinde birleştirerek isteğe bağlı tam hikâye `final.mp4` çıktısı üret.
- [x] Mevcut onaylı görsellerle API maliyeti oluşturmadan render alma ve eksik görselleri sağlayıcıyla
      üretme yollarını aynı sözleşmede destekle.

#### Sıradaki — sahne klipleri ve mobil oynatma

- [ ] `StoryVideoInput` ve üretim sonucunu `clips[]` alanıyla genişlet; her klipte `sceneId`, dosya URI'si,
      süre, seçim kapısı ve olası sonraki klip kimliklerini taşı.
- [ ] Hikâyeyi 20 saniyelik MP4'ten üç eşit süreyle kesmek yerine planlanan gerçek sahne sınırlarından
      ayrı `scene-01.mp4`, `scene-02.mp4` ve `scene-03.mp4` dosyaları olarak render et.
- [ ] Üç sahne klibinin yanında inceleme ve doğrusal oynatma için birleşik `final.mp4` üretmeye devam et.
- [ ] Tek bir sahne başarısız olduğunda yalnızca o klibi yeniden üretecek tekrar deneme davranışını ekle.
- [ ] Mobil içerik sözleşmesini statik `VIDEO_ASSETS` eşlemesi yerine dinamik klip URI'larını kabul edecek
      biçimde genişlet.
- [ ] Mobil oynatıcıda klip tamamlanınca akışı `WAITING_FOR_INPUT` durumuna al ve seçim yapılmadan sonraki
      klibi başlatma.
- [ ] Anlatım sesi klibin içine gömülü olduğunda mobil cihaz TTS'sinin aynı metni ikinci kez okumasını engelle.

#### Sıradaki — gerçek dallanma

- [ ] Seçim adımlarına `choiceId -> nextClipId` eşlemesi ekle; dalları yalnızca duraklatma etkisi değil,
      farklı video sonucu üretecek şekilde tanımla.
- [ ] İlk dikey kesitte ikinci sahneden sonra en az iki sonuç klibi üret: örneğin
      `scene-03-sarilma.mp4` ve `scene-03-yeni-balon.mp4`.
- [ ] Her dal promptuna ana hikâye planını, karakter kitabını, görsel stili, önceki sahnenin bitiş durumunu
      ve seçilen yardım eylemini aktar.
- [ ] Eksik veya başarısız dal videosunda çocuk akışını kesmeyen, onaylı ortak çözüm klibine güvenli geri
      dönüş ekle.
- [ ] Dallanma grafiğinde eksik hedef, erişilemeyen klip, istemsiz döngü ve hikâye dışı seçim bulunmadığını
      şema ve unit testlerle doğrula.
- [ ] Aynı seçimle aynı sürümlü hikâye dalının deterministik biçimde açıldığını mobil testle doğrula.

#### Sonraki entegrasyon — admin ve otomasyon

- [ ] Yönetim panelindeki hikâye üretim formuna “üç sahneli etkileşimli video üret” işlemini bağla.
- [ ] Yöneticiye ana hikâyeyi, sahne promptlarını, sesleri, klipleri ve bütün dal sonuçlarını yayın öncesi
      ayrı ayrı önizlet.
- [ ] Yalnızca bütün zorunlu klipleri hazır, güvenlik kontrolleri geçmiş ve insan onayı verilmiş hikâye
      sürümünü mobil uygulamaya yayınla.
- [ ] Job durumlarını planlama, görsel üretimi, TTS, sahne render'ı, dal render'ı, birleştirme, yükleme ve
      yayın aşamalarında izlenebilir yap.
- [ ] Panel akışı doğrulandıktan sonra kuyruk tabanlı otomatik üretim ve kontrollü yeniden deneme ekle.

#### R9.2 kabul kriterleri

- Tek ana prompttan aynı karakter ve olay sürekliliğini koruyan üç temel sahne üretilir.
- Her temel sahne ayrı MP4'tür; birleşik MP4 mevcut çıktı olarak korunur.
- Uygulama klipler arasında doğru noktada durur ve çocuğun seçimine göre farklı sonuç klibini oynatır.
- Ses, kelime veya geçişler rastgele eşit süreli kesim nedeniyle bölünmez.
- Bir dal veya sahne yeniden üretildiğinde diğer onaylı kliplerin yeniden render edilmesi gerekmez.
- Eksik dal, hatalı hedef veya başarısız video çocuk akışını kilitlemez.
- Admin paneli ve otomasyon bağlantısı, üç klipli ve dallı yerel akış doğrulanmadan başlatılmaz.

### R10 — MVP içerik paketi

- [x] İlk dış asset paketi olarak Mırmır'ın kırmızı balonlu iki görselini ve videosunu katalogla;
      duygu, olay durumu, izinli/yasak anlatım ve inceleme/hak durumu metadata'sını şemaya ekle.
- [x] Producer prompt'unu yalnızca onaylı ve kullanım hakkı doğrulanmış asset metadata'sıyla sınırla;
      denetleyiciye görsel/video–metin duygu ve olay tutarlılığı kontrolü ekle.
- [x] Asset metadata'sıyla çelişen anlatımı deterministik `asset_semantic_mismatch`, onaysız veya
      kullanım hakkı belirsiz asset'i `asset_not_approved` nedeniyle reddet.
- [ ] Dört temel duygu için içerik planı oluştur.
- [ ] 40–60 senaryo üret.
- [ ] 2–4 ve 4–7 yaş varyasyonlarını hazırla.
- [ ] Görsel ve ses asset’lerini üret.
- [ ] Bütün içerikleri iki ortak incelemesinden geçir.
- [ ] Bütün pilot içeriklerini uzman incelemesinden geçir.

R10 doğrulama notu: **Mırmır görselleri `happy/holding` ve `sad/popped` olarak semantik incelemeden
geçti. Video `happy/playing` adayı olarak kaydedildi fakat kare incelemesi tamamlanana kadar `pending`;
üç asset de kullanım hakkı doğrulanana kadar `needs_confirmation` ve üretim/yayın kapısında kapalıdır.**

### R11 — Ebeveyn oturum özeti ve insight altyapısı

- [x] Tamamlanan hikâye sayısı ve son beş oturumu gösteren tarafsız ebeveyn özeti oluştur.
- [x] İzin kapalı, hiç etkinlik yok ve yetersiz veri durumları için ayrı cold start ekranlarını geliştir.
- [x] Öğrenme gözlemi izni, ebeveyn sahipliği ve en az üç uygun oturum kapılarını uygula.
- [x] Yalnızca sabit, sürümlü ve tanısal olmayan nitel gözlem şablonları oluştur.
- [x] Yüzde, puan, tanı ve yaşıt/akran karşılaştırmalarını yasaklayan unit testleri ekle.
- [x] Yetersiz veride ve izin kapalıyken gözlem oluşmamasını test et.
- [x] Ham seçimleri ve dokunma payload'larını ebeveyn özet RPC'sinden çıkar.
- [x] Her özet uygunluk kararını private ve eklemeli audit tablosunda sakla.
- [x] Ebeveynin yalnızca kendi çocuğunun özetini okuyabildiğini pgTAP testiyle doğrula.

Doğrulama notu: **`@adaptive/parent-insights`, `parent-insight-policy-v1` uygunluk kapısı,
`get_parent_session_summary` güvenli RPC'si, private audit tablosu ve mobil ebeveyn “Özet” ekranı
tamamlandı. Üç uygun oturumdan önce nitel gözlem üretilmez; izin kapalıysa sayaç ve geçmiş dahi
döndürülmez. Monorepo genelinde 91 unit test, yerel Supabase/PostgreSQL üzerinde 90 pgTAP testi,
TypeScript, Biome ve Expo iOS export başarılıdır. R11 migration'ı `adaptive-kids-staging` projesine
uygulanmıştır.**

#### R11 kabul kriterleri

- Ebeveyn özeti ham seçim, tekrar dokunması, yüzde, puan, tanı veya yaşıt karşılaştırması içermez.
- İzin kapalıyken ve yeterli uygun oturum yokken nitel gözlem üretilmez.
- Başka bir ebeveyn çocuğun özetine veya private audit kayıtlarına erişemez.

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
