# Ürün Gereksinimleri Belgesi (PRD)

## Sosyal-Duygusal Öğrenme Mobil Uygulaması

| Alan | Değer |
|---|---|
| Belge durumu | İlk kapsamlı taslak |
| Tarih | 26 Ağustos 2026 |
| Hedef platform | iOS öncelikli mobil uygulama: iPhone ve iPad |
| Hedef yaş | 2–7 yaş |
| Geliştirme ekibi | İki geliştirici ve dönemsel çocuk gelişimi uzmanı |
| Mobil teknoloji | React Native, Expo, TypeScript |
| Backend yaklaşımı | Supabase, PostgreSQL ve Edge Functions |
| Yönetim paneli | Next.js ve TypeScript |
| AI yaklaşımı | Çocukla canlı konuşmayan, yayın öncesi içerik üreten ve denetleyen agent sistemi |

## Yerel geliştirme hızlı başlangıç

Bağımlılıkları kurun:

```powershell
pnpm install
```

Supabase'i yerelde çalıştırmak için Docker Desktop veya Podman gerekir:

```powershell
pnpm db:start
pnpm db:reset
pnpm db:test
```

Mobil uygulama için `apps/mobile/.env.example` dosyasını `apps/mobile/.env` adıyla kopyalayın ve Supabase proje panelindeki URL ile **publishable key** değerlerini ekleyin. `secret` veya `service_role` anahtarı mobil uygulamaya kesinlikle eklenmez.

Yerel Supabase Auth e-posta testi için Brevo'da doğrulanmış bir gönderen oluşturun; **Settings → SMTP & API → SMTP** ekranındaki SMTP login ve ürettiğiniz SMTP key ile gönderen adresini kök `.env.example` dosyasından oluşturacağınız kök `.env` içindeki `BREVO_SMTP_USER`, `BREVO_SMTP_PASS` ve `BREVO_SENDER_EMAIL` alanlarına ekleyin. SMTP anahtarını `apps/mobile/.env` dosyasına koymayın; uzak Supabase projesi için aynı değerleri Dashboard SMTP Settings ekranına elle girin.

```powershell
pnpm dev:mobile
```

Fiziksel iPhone testinde en kolay yol hosted Supabase geliştirme projesi kullanmaktır. Migration'ı uzak projeye göndermeden önce doğru proje referansını kontrol edin:

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref PROJE_REFERANSI
pnpm exec supabase db push
```

Gerçek aile pilotundan önce `docs/legal` altındaki geliştirme taslakları hukuki incelemeden geçirilmelidir.

---

## 1. Belgenin amacı

Bu belge, 2–7 yaş arasındaki çocukların temel duyguları ve günlük sosyal durumları anlamasını destekleyen mobil uygulamanın ürün, tasarım, teknoloji, veri, güvenlik ve geliştirme gereksinimlerini tanımlar.

Belge şu amaçlarla kullanılacaktır:

- İki geliştirici arasındaki görev ve sorumlulukları netleştirmek.
- Mobil uygulama, backend, içerik agent’ı ve yönetim paneli arasındaki sınırları belirlemek.
- Çocuk etkileşimlerinin nasıl tasarlanacağını ve nasıl kaydedileceğini tanımlamak.
- Öğrenme gözlemlerinin hangi koşullarda üretilebileceğini sınırlandırmak.
- Çocuk verisinin gizlilik ve güvenlik ilkelerini belirlemek.
- MVP kapsamını sonraki sürümlerden ayırmak.
- Projenin geliştirme sırasını ve her aşamada kullanılacak teknolojileri göstermek.

Bu belge klinik protokol veya hukuki görüş değildir. Pilot ve mağaza yayını öncesinde çocuk gelişimi uzmanı ve hedef pazarlara uygun veri koruma uzmanı incelemesi gerekecektir.

---

## 2. Ürün vizyonu

Ürün, çocuklara kısa sesli hikâyeler ve görsel seçimler sunarak duygular, duygu nedenleri ve sosyal durumlar hakkında düşünmelerine yardımcı olacaktır.

Çocuğa “yanlış” denmeyecek, çocuk puanlanmayacak ve çocuk hakkında tanısal sonuç üretilmeyecektir. Sistem, önceden onaylanmış öğretim cümleleriyle hedef kavramı sakin biçimde açıklayacaktır.

Ebeveyn isterse ve yeterli güvenilir kanıt oluşursa, 2–4 ve 4–7 yaş gruplarında tanısal olmayan öğrenme gözlemleri görebilecektir. Yeni profillerde bu tercih açık başlar; ebeveyn istediği zaman kapatabilir.

### 2.1 Temel değer önerisi

- Okuma bilmeyen çocukların kullanabileceği ses ve dokunma odaklı deneyim.
- Doğru/yanlış baskısı oluşturmayan sosyal-duygusal öğretim.
- Kontrollü, sürümlenmiş ve insan onaylı içerik.
- Ebeveynin izinlerini ayrı ayrı yönetebildiği gizlilik modeli.
- Yeterli kanıt olmadan çocuk hakkında çıkarım üretmeyen sistem.
- Çevrimdışı çalışabilen temel etkinlikler.

### 2.2 Ürünün yapmayacakları

Ürün:

- Otizm veya başka bir durum için tanı koymayacaktır.
- Hastalık ihtimali veya klinik risk yüzdesi üretmeyecektir.
- Çocuğu yaşıtlarıyla sıralamayacaktır.
- “Normal”, “geride”, “başarısız” veya benzeri etiketler kullanmayacaktır.
- Çocuğun sesini MVP’de kaydetmeyecektir.
- Çocukla serbest konuşan üretken AI kullanmayacaktır.
- Kamera, yüz analizi veya biyometrik çıkarım kullanmayacaktır.
- Reklam göstermeyecek ve reklam SDK’sı kullanmayacaktır.
- Agent çıktısını insan onayı olmadan çocuklara yayınlamayacaktır.

---

## 3. Hedef kullanıcılar

### 3.1 Birincil kullanıcı: çocuk

- Yaş: 3–7.
- Okuma seviyesi değişken veya yok.
- Uygulamayı dokunma ve ses üzerinden kullanır.
- Kısa oturumlara ve büyük etkileşim alanlarına ihtiyaç duyar.
- Rastgele veya tekrar eden dokunmalar yapabilir.

### 3.2 İkincil kullanıcı: ebeveyn veya yasal temsilci

- Hesabı ve çocuk profilini oluşturur.
- Gizlilik ve kişiselleştirme tercihlerini yönetir.
- Çocuk modunu başlatır.
- İzin vermişse ve yeterli veri varsa öğrenme gözlemlerini görür.
- Verilerle ilgili yasal erişim, itiraz ve silme taleplerini iletebilir.

### 3.3 Dahili kullanıcı: proje ortakları

- İçerik agent’ını çalıştırır.
- Senaryo, görsel ve ses taslaklarını inceler.
- İçerikleri düzenler, onaylar, yayınlar veya yayından kaldırır.
- Teknik ve içerik kalite metriklerini inceler.

### 3.4 Danışman kullanıcı: çocuk gelişimi uzmanı

- Pilot içeriklerini pedagojik açıdan inceler.
- Yaşa uygunluk ve geri bildirim dilini değerlendirir.
- Riskli veya belirsiz içerikleri işaretler.
- Ürünün tanısal sınırlarını ve insight dilini değerlendirir.

Uzman sürekli tam zamanlı ekip üyesi olmak zorunda değildir; dönemsel danışmanlık modeli kullanılabilir.

---

## 4. Platform kararı

Ürün iOS öncelikli mobil uygulama olarak geliştirilecektir.

### 4.1 Desteklenen cihazlar

- iPhone.
- iPad.
- İlk test cihazları: iPhone 17 ve iPad Pro.

### 4.2 Platform teknolojileri

- React Native.
- Expo.
- TypeScript.
- EAS Build ve EAS Submit, mağaza/test dağıtımı gerektiğinde.

### 4.3 Web kapsamı

- Çocuk deneyiminin web sürümü MVP kapsamında değildir.
- İçerik yönetimi için web tabanlı admin paneli geliştirilecektir.
- Ebeveyn ekranları ilk aşamada mobil uygulama içinde bulunacaktır.
- Gerekirse ileride ayrı ebeveyn web paneli değerlendirilebilir.

### 4.4 Android kapsamı

React Native ortak kod tabanı Android’e geçişi kolaylaştıracaktır; ancak Android doğrulama ve mağaza yayını MVP kapsamına dahil değildir.

---

## 5. Yaş katmanları

### 5.1 2–4 yaş katmanı

Sunulacak özellikler:

- Sesli ve görsel duygu etkinlikleri.
- Önceden onaylanmış sabit öğretim geri bildirimi.
- Kural tabanlı sınırlı içerik kişiselleştirmesi, ebeveyn izin verdiyse.
- Tarafsız oturum özeti.

Sunulmayacak özellikler:

- Beceri yüzdesi.
- Öğrenme insight’ı.
- Gelişimsel çıkarım.
- Klinik yönlendirme.

2–4 yaş verileri içerik kalitesi, kullanılabilirlik, tekrar ihtiyacı ve uygulama akışını iyileştirmek için kullanılabilir. Çocuk hakkında bireysel beceri profili oluşturmak için kullanılmaz.

### 5.2 4–7 yaş katmanı

Sunulacak özellikler:

- 2–4 yaş özelliklerinin tamamı.
- Daha karmaşık sosyal bağlamlar.
- Perspektif alma ve neden-sonuç etkinlikleri.
- Ebeveyn izin verdiyse, yeterli ve güvenilir kanıt sonrası nitel öğrenme gözlemleri.

Yaş tek başına insight üretmek için yeterli değildir.

### 5.3 Yaş katmanı geçişi

- Yaş, doğum ayı ve yılından hesaplanır.
- Tam doğum günü saklanmaz.
- Çocuk yeni yaş katmanına geçtiğinde içerik otomatik ve sessizce değişmez.
- Ebeveyne bilgi verilir ve katman geçişi onaylanır.

---

## 6. Ebeveyn hesabı ve çocuk profili

### 6.1 Ebeveyn hesabı

Ebeveyn hesabı zorunludur. Hesap kurulumu tamamlanmadan çocuk moduna erişilemez.

İlk sürüm gereksinimleri:

- E-posta ve şifre ile kayıt.
- Google hesabıyla ebeveyn kaydı ve girişi.
- E-posta doğrulama.
- Şifre sıfırlama.
- 18 yaşından büyük olma beyanı.
- Çocuk için ebeveyn veya yasal temsilci yetkisi beyanı.
- Ebeveyn alanı için dört veya altı haneli PIN.
- PIN sıfırlama işleminin doğrulanmış e-posta üzerinden yapılması.

Parola yenileme isteği hesap bulunup bulunmadığını açıklamayan tek tip bir sonuç gösterir. Expo Go
testinde tarayıcı dönüşüne güvenilmez; e-postadaki altı haneli kod uygulamada doğrulanır ve ebeveyn
yeni parolasını belirler. Bunun için Supabase Reset password şablonunda `{{ .Token }}` yer almalı ve
özel SMTP etkin olmalıdır. Paketlenmiş uygulama için `adaptivekids://**` deep-link desteği korunur.
Oturum içinden parola değişikliğinde mevcut parola hem yeniden girişle hem Supabase’in sunucu
politikasıyla doğrulanır; recovery oturumları bu kontrolden muaftır. Mevcut parolasını unutan ebeveyn
kayıtlı adresine gönderilen kodu kullanabilir. Production ortamında wildcard yerine kesin uygulama
adresi ve uygulamaya ait alan adıyla çalışan güvenilir bir SMTP sağlayıcısı tanımlanmalıdır.

Google OAuth, `adaptivekids://auth/callback` dönüşünü kullanır. Bu akış Expo Go’da kararlı biçimde
test edilemediği için development build veya paketlenmiş uygulama gerektirir. İlk Google girişi de
ebeveyn/yasal temsilci ve gizlilik onaylarını atlamaz; ebeveyn onboarding akışına yönlendirilir.

Fiziksel iOS cihazında development build oluşturmak için `apps/mobile` dizininde `eas login`, ardından
`pnpm build:development:ios` çalıştırılır. Build cihaza kurulduktan sonra
Metro `pnpm start:dev-client` ile başlatılır. Google Cloud istemci sırrı yalnızca Supabase Dashboard'daki
Google provider alanında saklanır; uygulamanın `.env` dosyasına veya EAS environment variable'larına
eklenmez.

### Çevrimdışı etkileşim olayları

`@adaptive/analytics-events`, sürüm 1 etkileşim olayı sözleşmesini ve 100 olaylık batch sınırını
tanımlar. Mobil uygulama olayları Expo SQLite kuyruğunda oturum ve `sequenceNumber` sırasıyla tutar.
Ağ yeniden erişilebilir olduğunda kuyruk Supabase `sync_interaction_events` RPC'sine gönderilir;
başarısız istekler kuyruktan silinmez. Sunucu `eventId` ile tekrar gönderimleri tekilleştirir ve aynı
oturumdaki sıra numarasını benzersiz tutar.

Olay toplama, çocuk profilindeki `learning_observations` iznine bağlıdır. İstemci izin kapalıyken
olay üretmez; izin geri çekildiğinde bekleyen yerel olayları temizler. RPC ebeveyn sahipliğini ve
güncel izni yeniden denetler. Private olay tablosu mobil Data API istemcilerine kapalıdır ve kayıtlar
puan, tanı veya öğrenme kanıtı değil, yalnızca asgari etkileşim gerçekleridir.

### Kanıt ve etkinlik seçimi

`@adaptive/evidence-engine`, ham etkileşim olaylarını oturum bazlı kanıttan ayırır. Kanıtlar
`valid_evidence`, `limited_evidence`, `interaction_noise` veya `not_evaluated` olarak sınıflanır.
Tek bir hızlı yanıt sınırlı kanıt sayılır; otomatik olarak gürültüye dönüştürülmez. Aynı
adımdaki tekrar dokunmaları cevap analizinden çıkarılır ve ayrı bir gürültü sayacında tutulur.

Kural tabanlı seçici önce henüz tamamlanmamış, sonra daha az uygulanan ve en uzun süredir
tamamlanmayan etkinliği öne çıkarır. Karar; adaylar, neden kodu, açıklama ve aktif eşik sürümüyle
private logda saklanır. Bu mekanizma tanı, beceri puanı veya akran karşılaştırması üretmez.

### Ebeveyn oturum özeti

`@adaptive/parent-insights`, ebeveyn alanında yalnızca tamamlanan hikâye sayısını, son beş etkinliği
ve uygunluk kapısı açıldığında sabit bir nitel gözlemi gösterir. Öğrenme gözlemi izni kapalıysa veri
fail-closed biçimde gizlenir; üç `valid_evidence` veya `limited_evidence` oturumundan önce gözlem
üretilmez. Özet RPC'si ham seçimleri ve dokunma payload'larını döndürmez; yüzde, puan, tanı ve
yaşıt/akran karşılaştırması sözleşme testleriyle yasaktır. Her özet kararı sürümlü politika koduyla
private audit tablosuna eklenir ve ebeveyn sahipliği sunucuda yeniden doğrulanır.

### Açıklanabilir kişiselleştirme

`@adaptive/personalization-engine`, yalnızca `personalization` ve `learning_observations` izinleri
birlikte açıkken ve en az beş farklı hikâye tamamlandığında önerileri uyarlayabilir. Tek dokunuşlar,
yarıda bırakılan hikâyeler ve tek oturumluk sinyaller kalıcı çıkarım üretmez; öneri için en az iki ayrı
oturumda tekrar seçimi veya yardım tercihi aranır. Koşullar sağlanmazsa sistem genel hikâye
rotasyonuna döner. Son kararın gözlenebilir gerekçesi ebeveyn oturum özetinde gösterilir ve sürümlü
private audit kaydında saklanır.

Sonraki aşamada değerlendirilebilecekler:

- Apple ile giriş.
- Google ile giriş.
- Hedef ülkeye göre daha güçlü ebeveyn doğrulaması.

### 6.2 Çocuk profili

Saklanacak alanlar:

```typescript
type ChildProfile = {
  id: string;
  parentAccountId: string;
  nickname: string;
  birthMonth: number;
  birthYear: number;
  contentLanguage: 'tr';
  favoriteAnimals: string[];
  favoriteToys: string[];
  interests: string[];
  createdAt: string;
  updatedAt: string;
};
```

Takma ad, doğum ayı/yılı ve içerik dili temel profil alanlarıdır. `favoriteAnimals`,
`favoriteToys` ve `interests` yalnızca ebeveyn çocuk bazında kişiselleştirmeyi açıkça
etkinleştirdikten sonra istenir ve saklanır; izin geri çekildiğinde bu üç alan silinir.

Toplanmayacak alanlar:

- Soyadı.
- Tam doğum tarihi.
- Çocuk fotoğrafı.
- Çocuk sesi.
- Okul veya kreş adı.
- Adres.
- Kesin konum.
- Cihaz kişileri.

### 6.3 Cinsiyet verisinin kullanımı

Cinsiyet bilgisi:

- Tek başına insight üretmeyecek.
- İçerik zorluğunu belirlemeyecek.
- Klinik çıkarımda kullanılmayacak.
- Ebeveyn raporunda karşılaştırmalı norm üretmeyecek.

Kullanım amaçları:

- İçeriklerde temsil dengesini incelemek.
- Agent çıktılarındaki cinsiyet kalıplarını tespit etmek.
- Etkinliklerin farklı gruplarda sistematik olarak farklı çalışıp çalışmadığını toplulaştırılmış biçimde araştırmak.

“Belirtmek istemiyorum” seçeneği sunulacaktır.

---

## 7. Ebeveyn izinleri ve veri tercihleri

İzinler birbirinden bağımsız olacaktır.

### 7.1 Öğrenme deneyimini kişiselleştirme

- Yeni çocuk profillerinde açık başlar, her çocuk için ayrı yönetilir ve ebeveyn tarafından kapatılabilir.
- Açılmadan önce sevilen hayvan, oyuncak ve ilgi alanı verileri istenmez.

Açıksa:

- Etkinlik sırası geçmiş etkileşimlere göre ayarlanabilir.
- Daha fazla tekrar gerektiren içerik türleri yeniden sunulabilir.

Kapalıysa:

- Standart etkinlik sırası kullanılır.
- Çocuk bazlı içerik seçimi yapılmaz.

### 7.2 Öğrenme gözlemleri

- Yeni çocuk profillerinde açık başlar; mevcut eski profiller kapalı kalır.
- 2–4 ve 4–7 yaş gruplarında ebeveyn tarafından çocuk bazında etkinleştirilebilir.
- Ebeveyn izni gerekli fakat tek başına yeterli değildir. Yalnızca yeterli sayıda oturuma
  yayılan güvenilir kanıt varsa bağlamsal ve betimleyici gözlem üretilebilir.
- Tanı/tahmin, beceri puanı, akran karşılaştırması veya kalıcı yetersizlik iddiası üretilemez.
- Kapatıldığında yeni bireysel beceri gözlemi oluşturulmaz.
- Önceki gözlemler için saklama veya silme seçenekleri hukuki değerlendirmeye uygun biçimde sunulur.

### 7.3 Anonim verilerle ürün ve AI geliştirmeye katkı

- Ayrı ve isteğe bağlı izindir.
- Temel uygulama kullanımının koşulu olamaz.
- Insight izniyle birleştirilemez.
- Yalnızca anonimleştirilmiş veya yeterince toplulaştırılmış veri araştırma havuzuna aktarılır.
- İzin geri çekildiğinde yeni veri aktarımı durur.

### 7.4 İzin kaydı

```typescript
type ConsentRecord = {
  id: string;
  parentAccountId: string;
  childProfileId: string;
  consentType:
    | 'personalization'
    | 'learning_observations'
    | 'anonymous_product_improvement';
  status: 'granted' | 'withdrawn';
  noticeVersion: string;
  occurredAt: string;
};
```

Her izin için metin sürümü, verilme tarihi ve geri çekilme tarihi saklanacaktır.
Güncel durum çocuk profilinden ayrı bir tabloda, her değişiklik ise mobil istemciye kapalı,
eklemeli bir audit log’da tutulacaktır.

---

## 8. Çocuk deneyimi

### 8.1 Tasarım ilkeleri

- Okuma zorunluluğu olmayacak.
- Birincil yönlendirme sesle yapılacak.
- Büyük dokunma alanları kullanılacak.
- Sonsuz dikey akış kullanılmayacak.
- Reklam, haricî bağlantı ve satın alma çocuk modunda gösterilmeyecek.
- Hız bonusu, seri baskısı veya kaybetme korkusu yaratılmayacak.
- Yoğun konfeti ve aşırı uyarıcı animasyonlardan kaçınılacak.
- “Yanlış”, “başarısız” veya “kötü seçim” dili kullanılmayacak.
- Duygu hissetmek ile zarar verici davranış göstermek birbirinden ayrılacak.

### 8.2 Etkinlik akışı

```text
Hikâye seslendirmesi
        ↓
Soru seslendirmesi
        ↓
Cevap penceresi
   ┌────┴────┐
Seçim var  Seçim yok
   ↓           ↓
Sabit öğretim  Geri bildirim atlanabilir
cümlesi        veya nötr kapanış
   └────┬────┘
        ↓
“Tekrar dinlemek istersen ekrana dokun.”
        ↓
3 saniyelik tekrar penceresi
   ┌────┴────┐
Dokunma var Dokunma yok
   ↓           ↓
Tekrar oynat Sonraki senaryo
```

### 8.3 Geri bildirim kuralı

- Doğru veya yanlış seçime göre farklı öğretim sonucu oluşturulmayacak.
- Bütün seçimlerden sonra senaryonun onaylanmış hedef öğretim cümlesi okunacak.
- Çocuğun seçimi eleştirilmeyecek.
- Birden fazla duygunun makul olabileceği içerikler ayrıca işaretlenecek.
- Senaryo hedefi tek duygu öğretmekse sabit cümle bunu sade biçimde açıklayacak.

Örnek:

> “Tavşan, balonu patladığı için üzgün hissediyor.”

### 8.4 Seçim yapılmaması

- Seçim yapılmaması hata değildir.
- Çocuk zorlanmaz.
- Ekranda hata mesajı veya kırmızı uyarı gösterilmez.
- Olay `answer_window_expired` olarak kaydedilir.
- Cevap süresi pilot testle belirlenecektir; ilk varsayım ses bittikten sonra 6–8 saniyedir.

### 8.5 Tekrar dinleme

- Yazılı “Tekrar dinle” düğmesi kullanılmayacak.
- Sistem sesli olarak “Tekrar dinlemek istersen ekrana dokun.” diyecek.
- Üç saniyelik tekrar penceresi açılacak.
- Bu sırada duygu emojileri devre dışı kalacak.
- Ekranın tamamı tekrar dokunma katmanı olacak.
- Bu dokunma cevap olarak değil `replay_requested` olarak kaydedilecek.
- İlk oynatma tekrar sayılmaz.
- En fazla iki ek oynatma yapılabilir.
- İkinci tekrar sonunda yeni tekrar penceresi açılmaz; sonraki senaryoya otomatik geçilir.

### 8.6 Durum makinesi

```typescript
type ActivityState =
  | 'PLAYING_NARRATION'
  | 'WAITING_FOR_EMOTION'
  | 'PLAYING_FEEDBACK'
  | 'WAITING_FOR_REPLAY_TAP'
  | 'REPLAYING'
  | 'TRANSITIONING'
  | 'COMPLETED';
```

Kurallar:

- `PLAYING_NARRATION`: duygu seçenekleri etkin değildir.
- `WAITING_FOR_EMOTION`: yalnızca duygu seçenekleri etkindir.
- `PLAYING_FEEDBACK`: bütün dokunuşlar yok sayılır veya teknik olay olarak tutulur.
- `WAITING_FOR_REPLAY_TAP`: duygu seçenekleri devre dışıdır; tam ekran tekrar katmanı etkindir.
- `TRANSITIONING`: yeni etkinlik yüklenir; dokunma kabul edilmez.

Bu durumlar görsel olarak ve olay kayıtlarında birbirinden ayrılacaktır.

---

## 9. Pedagojik içerik modeli

### 9.1 İlk beceri alanları

MVP:

- Mutluluk.
- Üzüntü.
- Kızgınlık.
- Korku.
- Duygunun basit nedenini anlama.

MVP sonrası:

- Birden fazla duygunun aynı anda var olabilmesi.
- Başkasının bakış açısını anlama.
- Sıra bekleme.
- Oyuna katılma.
- Yardım isteme.
- Sınır koyma.
- Güvenli sosyal davranışlar.
- Kendi duygusunu düzenleme.

### 9.2 Etkinlik türleri

| Tür | Amaç | Insight kanıtı |
|---|---|---|
| Tanıtım | Kavramı ilk kez öğretmek | Hayır |
| Rehberli alıştırma | İpucu ve tekrar ile öğrenmek | Sınırlı |
| Bağımsız uygulama | Yardımsız seçim | Evet, koşullu |
| Aktarım | Yeni bağlamda aynı beceri | Güçlü kanıt |
| Serbest hikâye | Sohbet ve keşif | Hayır |
| Ebeveyn-çocuk etkinliği | Günlük yaşama taşımak | Doğrudan değil |

Öğretim etkinliği ile değerlendirmeye uygun aktarım etkinliği aynı kabul edilmeyecektir.

### 9.3 İçerik şeması

```typescript
type ActivityContent = {
  id: string;
  version: number;
  status:
    | 'draft'
    | 'automated_review_failed'
    | 'human_review'
    | 'partner_approved'
    | 'expert_approved'
    | 'published'
    | 'archived';
  ageBand: '2-4' | '4-7';
  skill: string;
  activityType:
    | 'introduction'
    | 'guided_practice'
    | 'independent_practice'
    | 'transfer'
    | 'free_story'
    | 'parent_child';
  targetEmotions: string[];
  acceptableAlternativeEmotions: string[];
  context: string;
  difficulty: 'introductory' | 'developing' | 'advanced';
  narrationText: string;
  questionText: string;
  canonicalTeachingText: string;
  replayPromptText: string;
  choices: Array<{
    id: string;
    label: string;
    visualAssetId: string;
  }>;
  sceneAssetId: string;
  narrationAudioAssetId: string;
  teachingAudioAssetId: string;
  replayAudioAssetId: string;
  visualClues: string[];
  languageComplexity: number;
  safetyTags: string[];
  createdBy: string;
  reviewedBy?: string;
  expertReviewedBy?: string;
};
```

Şema Zod ve JSON Schema ile doğrulanacaktır.

---

## 10. İçerik üretim agent’ı

### 10.1 Agent’ın rolü

Agent yalnızca yayın öncesi içerik üretim aracıdır. Çocukla canlı konuşmaz ve çocuk uygulamasında çalışmaz.

Agent:

- Senaryo taslakları üretir.
- Soru ve sabit öğretim cümlesi üretir.
- Görsel üretim prompt’u hazırlar.
- Pedagojik etiketleri ekler.
- Yaşa uygunluk kontrollerine veri sağlar.
- İçeriği yalnızca `draft` durumunda kaydeder.

### 10.2 İlk aşamada model eğitimi

- Sıfırdan model eğitilmeyecektir.
- Hazır bir dil modeli kullanılacaktır.
- Sistem talimatları, onaylı örnekler, RAG ve zorunlu JSON şeması kullanılacaktır.
- LangChain zorunlu değildir.
- İlk agent TypeScript içinde küçük ve açık bir pipeline olarak geliştirilecektir.

### 10.3 Agent bileşenleri

```text
İçerik isteği
      ↓
Uzman onaylı rehber ve örneklerin alınması
      ↓
Üretici agent
      ↓
JSON/Zod doğrulaması
      ↓
Kod tabanlı güvenlik kuralları
      ↓
Denetleyici agent
      ↓
İnsan incelemesi
      ↓
Ortak onayı
      ↓
Uzman onayı
      ↓
Yayın
```

### 10.4 Otomatik içerik kontrolleri

- Yaşa göre kelime ve cümle uzunluğu.
- Zorunlu alanların bulunması.
- Tanı ve hastalık ifadeleri.
- “Yanlış”, “kötü çocuk”, “normal değilsin” gibi yasak dil.
- Şiddet, ölüm, kaybolma ve yaşa uygun olmayan korku unsurları.
- Cinsiyet ve kültürel kalıp yargılar.
- Belirsiz tek doğru dayatması.
- Telifli karakter ve marka kullanımı.
- Aynı içeriğin tekrar üretilmesi.
- Görsel ipucu ile hedef kavram uyumu.
- Sabit öğretim cümlesinin seçimden bağımsız olması.

### 10.5 Fine-tuning koşulları

Fine-tuning yalnızca şu koşullarda değerlendirilecektir:

- Yeterli sayıda uzman onaylı içerik bulunması.
- Reddedilmiş içeriklerin ret nedenlerinin kaydedilmiş olması.
- İnsan düzeltmelerinin veri kümesine dönüştürülebilmesi.
- Prompt ve RAG ile çözülemeyen tekrarlı problem bulunması.
- Bağımsız test setinde ölçülebilir kalite artışı göstermesi.

Çocukların uygulama seçimleri içerik üretim modeline doğrudan eğitim verisi olarak verilmeyecektir.

---

## 11. Görsel üretim pipeline’ı

### 11.1 Karakter tutarlılığı

Her ana karakter için karakter kitabı hazırlanacaktır:

- Ön, yan ve arka görünüm.
- Sabit renk paleti.
- Sabit kıyafet ve ayırt edici özellikler.
- Mutlu, üzgün, kızgın ve korkmuş ifadeler.
- Temel beden duruşları.
- Kullanılmayacak özellikler.
- Arka plan ve çizim stili kuralları.

Yalnızca prompt metniyle tutarlılık beklenmeyecektir. Onaylı ana karakter görselleri yeni sahnelere referans girdi olacaktır.

### 11.2 Sağlayıcı seçimi

Sağlayıcı kontrollü benchmark ile seçilecektir. Adaylar sabit değildir; seçim zamanında güncel lisans, maliyet ve özellikler doğrulanacaktır.

Test matrisi:

```text
3 sağlayıcı × 2 karakter × 5 sahne = 30 test görseli
```

Değerlendirme ölçütleri:

- Karakter tutarlılığı.
- Duygu ifadesinin açıklığı.
- Yaşa uygunluk.
- Arka plan sadeliği.
- Referans görselle düzenlenebilirlik.
- Ticari kullanım koşulları.
- Maliyet ve üretim süresi.

OpenAI kullanılması hâlinde güncel görüntü üretme/düzenleme modeli uygulama sırasında yeniden doğrulanacaktır. Belge belirli bir modele kalıcı olarak bağlanmaz.

### 11.3 Görsel onay süreci

```text
Görsel prompt taslağı
→ Görsel varyasyonları
→ Otomatik güvenlik kontrolü
→ İnsan seçimi
→ Karakter tutarlılığı incelemesi
→ Uzman incelemesi
→ Optimize edilmiş mobil asset
→ Yayın
```

### 11.4 Dosya biçimleri

- Kaynak görsel: kayıpsız PNG veya düzenlenebilir kaynak.
- Mobil dağıtım: kalite testine göre WebP veya PNG.
- Asset kimliği içerikten ayrılacak.
- Aynı görselin farklı çözünürlükleri üretilecek.
- Dosya checksum’u ve sürümü saklanacak.

---

## 12. Ses üretim pipeline’ı

### 12.1 Ürün sesi kararı

Test uygulamasında kullanılan cihaz tabanlı Türkçe TTS beğenilmemiştir ve ürün sesi değildir.

Nihai uygulama:

- Çocuk cihazında canlı TTS üretmeyecektir.
- Önceden üretilmiş ve insan tarafından onaylanmış ses dosyaları kullanacaktır.
- Çevrimdışı oynatmayı destekleyecektir.

### 12.2 Sağlayıcı seçimi

OpenAI TTS, ElevenLabs ve seçim zamanında uygun diğer sağlayıcılar kontrollü teste alınacaktır.

Kör test:

- Aynı 10–15 Türkçe cümle.
- Servis ve ses isimleri gizli.
- iPhone ve iPad hoparlörlerinde dinleme.
- Doğallık.
- Sıcaklık.
- Türkçe telaffuz.
- Konuşma hızı.
- Duraklama kalitesi.
- Duygusal ton.
- Çocuğu korkutmayan sakinlik.
- Maliyet ve lisans.

### 12.3 Ses pipeline’ı

```text
Onaylanmış metin
→ TTS üretimi
→ İnsan dinleme kontrolü
→ Gerekirse yeniden üretim
→ Ses normalizasyonu
→ Dosya sürümleme
→ Storage/CDN
→ Mobil önbellek
```

### 12.4 Ses dosyaları

Her etkinlik için en az:

- Hikâye ve soru seslendirmesi.
- Sabit öğretim cümlesi.
- Tekrar dinleme yönlendirmesi.
- Geçiş sesi, gerekiyorsa.

Ses dosyasının metin sürümüyle eşleşmesi zorunludur.

---

## 13. Admin paneli

### 13.1 Teknoloji

- Next.js.
- TypeScript.
- Supabase Auth.
- Supabase PostgreSQL.
- Zod.
- Basit bir bileşen kütüphanesi; seçim uygulama sırasında yapılacaktır.

### 13.2 Yetkiler

- `developer`: taslak üretir ve düzenler.
- `reviewer`: diğer ortağın içeriğini onaylar veya reddeder.
- `expert_reviewer`: pedagojik onay verir.
- `admin`: yayınlar, yayından kaldırır ve rol yönetir.

İki kişilik ekipte aynı kullanıcı birden fazla role sahip olabilir; ancak kendi ürettiği içeriğe tek başına son yayın onayı veremez.

### 13.3 Panel özellikleri

- Agent’a içerik talebi gönderme.
- Taslak JSON’u görsel formda düzenleme.
- Otomatik kontrol sonuçları.
- Görsel varyasyonlarını karşılaştırma.
- Ses dosyalarını dinleme.
- İçerik önizlemesi.
- Ret nedeni kaydetme.
- Ortak ve uzman onay akışı.
- İçerik sürüm geçmişi.
- Yayınlama ve geri alma.
- Audit log.

### 13.4 Yapım sırası

Admin paneli içerik şeması ve komut satırı agent prototipi doğrulandıktan sonra yapılacaktır. İlk 10–20 içerik panel olmadan şema üzerinden üretilebilir; 40–60 içerikli MVP’den önce panel tamamlanmalıdır.

---

## 14. Etkileşim olayları ve API sözleşmesi

### 14.1 İlke

Mobil istemci gözlemlediği olayı kaydeder; pedagojik yorum yapmaz.

Kullanılmayacak istemci alanı:

```text
wrong_answer: true
```

Kullanılacak alan:

```text
selected_emotion: "angry"
```

### 14.2 Olay zarfı

```typescript
type InteractionEvent = {
  eventId: string;
  schemaVersion: number;
  sessionId: string;
  childProfileId: string;
  activityId: string;
  activityVersion: number;
  eventType: string;
  occurredAt: string;
  sequenceNumber: number;
  payload: Record<string, unknown>;
};
```

### 14.3 Olaylar

- `session_started`
- `activity_presented`
- `narration_started`
- `narration_completed`
- `emotion_selected`
- `answer_window_expired`
- `feedback_started`
- `feedback_completed`
- `replay_prompt_started`
- `replay_requested`
- `replay_window_expired`
- `activity_completed`
- `session_completed`
- `app_backgrounded`
- `app_foregrounded`

### 14.4 Örnek seçim olayı

```json
{
  "eventId": "01JABC...",
  "schemaVersion": 1,
  "sessionId": "session_8f21",
  "childProfileId": "child_42",
  "activityId": "rabbit_balloon_001",
  "activityVersion": 3,
  "eventType": "emotion_selected",
  "occurredAt": "2026-08-26T15:04:12.412Z",
  "sequenceNumber": 7,
  "payload": {
    "selectedEmotion": "angry",
    "presentationCount": 1,
    "responseTimeMs": 4380,
    "narrationCompleted": true
  }
}
```

### 14.5 Örnek tekrar olayı

```json
{
  "eventId": "01JABD...",
  "schemaVersion": 1,
  "sessionId": "session_8f21",
  "childProfileId": "child_42",
  "activityId": "rabbit_balloon_001",
  "activityVersion": 3,
  "eventType": "replay_requested",
  "occurredAt": "2026-08-26T15:04:18.100Z",
  "sequenceNumber": 11,
  "payload": {
    "presentationCount": 1,
    "replayCount": 1,
    "replayWindowElapsedMs": 1240,
    "tapTarget": "full_screen_replay_layer"
  }
}
```

### 14.6 Çevrimdışı senkronizasyon

- Olaylar önce cihazdaki SQLite kuyruğuna yazılır.
- İnternet bağlantısı olduğunda toplu gönderilir.
- `eventId` idempotency anahtarıdır.
- Sunucu aynı olayı ikinci kez kaydetmez.
- Başarılı gönderilen olaylar yerel kuyruktan saklama politikasına göre temizlenir.
- Olay sırası `sequenceNumber` ile korunur.

---

## 15. Gürültü ve öğrenme kanıtı

### 15.1 Temel ayrım

```text
Etkileşim olayı ≠ öğrenme kanıtı
```

Her dokunma kaydedilebilir; fakat her dokunma insight modeline dahil edilmez.

### 15.2 Tek başına kullanılmayacak kural

“Üç saniyeden hızlı cevap rastgeledir” kuralı kullanılmayacaktır. Çocuk açık bir ifadeyi hızlı biçimde gerçekten tanıyabilir.

Üç saniye yalnızca tekrar dinleme isteği penceresinin ilk ürün varsayımıdır.

### 15.3 Güvenilirlik sinyalleri

Olumlu sinyaller:

- Seslendirme tamamlandıktan sonra seçim.
- Aktif ve görünür emoji alanına tek dokunma.
- Yeni bağlamlarda tutarlılık.
- Oturumun normal tamamlanması.
- Uygulamanın arka plana geçmemesi.

Gürültü sinyalleri:

- Ses devam ederken dokunma.
- Seçenek aktif olmadan dokunma.
- Çok kısa sürede farklı emojilere art arda dokunma.
- Her etkinlikte aynı koordinata basma.
- Uygulamanın arka plana gidip dönmesi.
- Tekrar katmanı dokunmasını cevap gibi değerlendirme.
- Bütün etkinlikleri olağan dışı hızla geçme.

### 15.4 Kanıt sınıfları

- `valid_evidence`
- `limited_evidence`
- `interaction_noise`
- `not_evaluated`

İlk sürümde kurallar deterministik ve test edilebilir olacaktır. Makine öğrenmesiyle gürültü sınıflandırması MVP kapsamında değildir.

Kesin katsayılar pilot öncesinde bilimsel değer gibi sabitlenmeyecektir.

---

## 16. Kişiselleştirme sistemi

### 16.1 Teknoloji

- TypeScript domain paketi.
- Saf ve deterministik fonksiyonlar.
- PostgreSQL etkinlik ve kanıt kayıtları.
- Supabase Edge Function veya backend domain servisi.

### 16.2 İlk kurallar

Sıradaki etkinlik şunlara göre seçilebilir:

- Yaş katmanı.
- Daha önce görülen etkinlikler.
- Öğretim veya aktarım ihtiyacı.
- Tekrar isteği sayısı.
- Aynı becerinin aşırı tekrarlanmasını önleme.
- Oturum uzunluğu.
- İçerik zorluğu.
- Ebeveyn kişiselleştirme izni.

### 16.3 Kullanılmayacak özellikler

- Cinsiyete göre zorluk belirleme.
- Hastalık veya tanı tahmini.
- Tek bir cevaba göre içerik profilini değiştirme.
- Açıklanamayan kara kutu puanlama.

---

## 17. Öğrenme gözlemleri

### 17.1 Uygunluk kapıları

```text
4–7 yaş politikası uygun
AND ebeveyn insight izni açık
AND minimum farklı gün
AND minimum oturum
AND minimum geçerli bağımsız/aktarım etkinliği
AND yeterli senaryo çeşitliliği
AND yeterli etkileşim güvenilirliği
= insight üretilebilir
```

İlk pilot varsayımları:

- En az 3 farklı gün.
- En az 4 oturum.
- En az 8 geçerli bağımsız veya aktarım etkinliği.
- En az 4 farklı senaryo.
- En az 2 sunum biçimi.

Bu eşikler pilot sonrasında güncellenecektir.

### 17.2 Ebeveyne gösterilecek dil

Gösterilebilir:

> “Deniz, farklı hikâyelerde açık mutluluk ve üzüntü ifadelerini çoğunlukla bağımsız seçti.”

> “Korku içeren bazı hikâyelerde tekrar dinlemekten yararlandı.”

> “Bir kişinin duygusunun yalnızca olaydan anlaşılması gereken etkinliklerde henüz yeterli gözlem oluşmadı.”

Gösterilmeyecek:

- “Korku %45.”
- “Sosyal beceri 72/100.”
- “Yaşıtlarının gerisinde.”
- “Otizm ihtimali.”
- “Gelişim geriliği.”

### 17.3 Insight üretim tekniği

- İlk sürümde şablon tabanlı olacaktır.
- Dil modeli ebeveyne serbest psikolojik yorum yazmayacaktır.
- Her şablon uzman ve proje ortakları tarafından onaylanacaktır.
- Insight kaydı veri kapsamı, içerik sürümleri ve kanıt sayısını içerecektir.

### 17.4 Cold start

İlk dönemde boş grafik veya uydurma sonuç gösterilmez.

Örnek:

> “Öğrenme gözlemleri hazırlanıyor. Güvenilir bir gözlem oluşturabilmek için farklı günlerde ve farklı hikâyelerde daha fazla etkileşim gerekiyor.”

Yüzdelik ilerleme çubuğu kullanılmayacaktır; bu, ebeveyni çocuğa gereğinden fazla etkinlik yaptırmaya yönlendirebilir.

Durumlar:

```text
Başlangıç
→ İlk etkinlikler tamamlanıyor
→ Farklı hikâyeler deneniyor
→ Henüz yeterli gözlem yok
→ İlk öğrenme gözlemleri hazır
```

---

## 18. Erken yönlendirme

Erken yönlendirme MVP kapsamında değildir.

İleride değerlendirilmesi hâlinde:

- Yalnızca uygulama verisine dayanmayacaktır.
- Ebeveynin günlük yaşam gözlemleri ayrıca sorulacaktır.
- Uzmanlarca hazırlanmış sorular kullanılacaktır.
- Hastalık adı veya risk yüzdesi verilmeyecektir.
- Mesaj, gerektiğinde profesyonel görüşün düşünülebileceğini söyleyecektir.
- Yanlış pozitif ve yanlış negatif riskleri ayrıca test edilecektir.

Bu özellik ayrı bir ürün, hukuk ve uzman onayı olmadan yol haritasına otomatik olarak eklenmeyecektir.

---

## 19. Teknik mimari

### 19.1 Bileşenler

```text
iOS Mobil Uygulama
├── Çocuk modu
├── Mobil ebeveyn alanı
├── Yerel içerik/asset önbelleği
└── SQLite olay kuyruğu
        ↓
Supabase API / Edge Functions
        ↓
PostgreSQL
├── Ebeveyn hesapları
├── Çocuk profilleri
├── İzin kayıtları
├── İçerik ve sürümler
├── Etkileşim olayları
├── Kanıt kayıtları
└── Öğrenme gözlemleri

Admin Web
├── İçerik agent’ı
├── İnceleme akışı
├── Asset önizleme
└── Yayınlama

Storage/CDN
├── Görseller
└── Ses dosyaları
```

### 19.2 Teknoloji tablosu

| Alan | Teknoloji | Aşama |
|---|---|---|
| Mobil | React Native + Expo | Başlangıç |
| Dil | TypeScript | Başlangıç |
| Mobil navigasyon | Expo Router | Gerçek proje iskeleti |
| Yerel veri | Expo SQLite | Olay toplama aşaması |
| Backend | Supabase | Hesap ve profil aşaması |
| Veritabanı | PostgreSQL | Hesap ve profil aşaması |
| Auth | Supabase Auth | Ebeveyn onboarding |
| Dosya depolama | Supabase Storage veya uyumlu obje deposu | Asset aşaması |
| Edge API | Supabase Edge Functions | Senkronizasyon ve domain işlemleri |
| Admin web | Next.js | İçerik şeması doğrulandıktan sonra |
| Şema doğrulama | Zod + JSON Schema | İçerik şeması aşaması |
| İçerik agent’ı | TypeScript + seçilecek model API’si | İçerik şemasından sonra |
| Test | Vitest/Jest | Başlangıçtan itibaren |
| Mobil akış testleri | Maestro | Durum makinesi tamamlandığında |
| Web E2E | Playwright | Admin paneli aşaması |
| Hata izleme | Sentry | Pilot öncesi |
| CI/CD | GitHub Actions | Başlangıç |
| iOS dağıtım | EAS Build/Submit | Cihaz pilotu ve mağaza öncesi |

### 19.3 Başlangıçta kullanılmayacaklar

- Mikroservis mimarisi.
- Kubernetes.
- Ayrı FastAPI servisi.
- LangChain zorunluluğu.
- Çocuk cihazında model çalıştırma.
- Özel model eğitimi.
- Gerçek zamanlı sesli AI.

FastAPI yalnızca ileride Python tabanlı veri bilimi ihtiyacı TypeScript servisinden açıkça ayrılırsa değerlendirilecektir.

---

## 20. Veritabanı ana tabloları

- `parent_accounts`
- `child_profiles`
- `consent_records`
- `devices`
- `content_activities`
- `content_versions`
- `content_reviews`
- `asset_records`
- `sessions`
- `interaction_events`
- `evidence_records`
- `learning_insights`
- `admin_users`
- `audit_logs`

### 20.1 Veri ayrımı

- Ham olaylar değiştirilemez event kayıtlarıdır.
- Kanıt kayıtları yeniden hesaplanabilir türetilmiş verilerdir.
- Insight kayıtları belirli kanıt sürümünden üretilir.
- İçerik ve asset sürümleri geçmiş oturumlarla eşleştirilebilir.

---

## 21. Gizlilik ve güvenlik

### 21.1 İlkeler

- Veri minimizasyonu.
- Belirli ve açık işleme amaçları.
- Amaçla sınırlı saklama.
- Çocuk verisi için varsayılan koruma.
- Reklamsız ürün.
- Üçüncü taraf analitik SDK’larını minimumda tutma.
- Yetki ve erişim kayıtları.

### 21.2 Ebeveyn erişimi

- Ebeveyn ham dokunma olaylarını standart panelde görmez.
- Ebeveyn yalnızca izin verdiği ve uygunluğu sağlanan gözlemleri görür.
- Ham verilerin standart panelde gösterilmemesi, yasal erişim ve silme haklarını ortadan kaldırmaz.
- Veri talepleri için uygulama içi veya açık başvuru kanalı bulunacaktır.

### 21.3 Anonimleştirme

Takma adlandırma anonimleştirme değildir.

Araştırma havuzundan çıkarılacak veya genelleştirilecek alanlar:

- Ebeveyn ve çocuk kimliği.
- IP ve cihaz tanımlayıcıları.
- Kesin zaman damgaları.
- Tam doğum bilgileri.
- Nadir ve yeniden tanımlamaya yol açabilecek kombinasyonlar.

### 21.4 Saklama süreleri

Kesin süreler hukuk incelemesi ve ürün ihtiyacına göre belirlenecektir. Her veri sınıfı için ayrı politika gerekir:

- Güvenlik logları.
- Ham etkileşim olayları.
- Türetilmiş kanıtlar.
- Öğrenme gözlemleri.
- İzin kayıtları.
- Muhasebe veya zorunlu hukuki kayıtlar.

“Süresiz saklama” varsayılan politika değildir.

### 21.5 Güvenlik kontrolleri

- Aktarımda TLS.
- Depolamada şifreleme.
- Row Level Security.
- Minimum yetki.
- Admin için güçlü kimlik doğrulama.
- Gizli anahtarların mobil uygulamaya gömülmemesi.
- Prod/test ortamlarının ayrılması.
- Gerçek çocuk verisinin geliştirme ortamında kullanılmaması.
- Audit log.
- Düzenli bağımlılık taraması.

---

## 22. GitHub çalışma düzeni

### 22.1 Monorepo

```text
apps/
  mobile/
  admin-web/

packages/
  domain/
  content-schema/
  content-agent/
  analytics-events/
  shared-types/
  ui/

content/
  approved/
  fixtures/

supabase/
  migrations/
  functions/
  seed/

docs/
  product-principles.md
  prohibited-claims.md
  privacy-data-map.md
  measurement-model.md
  content-guidelines.md
  architecture-decisions/
```

### 22.2 Rol dağılımı

Geliştirici A:

- Mobil uygulama.
- Çocuk modu.
- Ses/görsel oynatma.
- Durum makinesi.
- Çevrimdışı olay kuyruğu.
- iPhone/iPad testleri.

Geliştirici B:

- Supabase/PostgreSQL.
- Auth ve çocuk profili.
- Admin paneli.
- İçerik agent’ı.
- Asset pipeline’ı.
- Kanıt ve insight servisi.

Ortak:

- API sözleşmesi.
- İçerik şeması.
- Gizlilik.
- Pedagojik kurallar.
- Migration ve PR incelemesi.

### 22.3 Branch stratejisi

- Korumalı `main`.
- Uzun ömürlü `develop` dalı yok.
- Kısa feature branch’leri.
- Bir diğer ortak onayı zorunlu.

Örnekler:

- `feature/kids-audio-flow`
- `feature/parent-onboarding`
- `feature/content-schema`
- `feature/agent-pipeline`
- `fix/replay-touch-state`

### 22.4 CI kontrolleri

- TypeScript typecheck.
- Lint.
- Unit test.
- İçerik şeması doğrulaması.
- Migration kontrolü.
- iOS bundle testi.
- Admin web build testi.

---

## 23. Geliştirme aşamaları ve teknoloji sırası

### Aşama 0 — Ürün ve güvenlik kuralları

Çıktılar:

- PRD.
- Yasak iddialar belgesi.
- İçerik rehberi.
- Veri haritası.
- Insight uygunluk kuralları.

Teknoloji:

- Markdown.
- GitHub.

Çıkış kriteri:

- İki ortak ürün kapsamını onaylar.
- Klinik/tanısal yasaklar yazılıdır.

### Aşama 1 — Gerçek proje iskeleti

İşler:

- Monorepo kurulumu.
- Expo mobil uygulaması.
- Next.js placeholder.
- Paylaşılan TypeScript paketleri.
- GitHub Actions.
- Branch koruması.

Teknoloji:

- pnpm workspace veya Turborepo.
- React Native, Expo, TypeScript.
- Next.js.
- GitHub Actions.

Çıkış kriteri:

- iOS build alınabilir.
- CI yeşildir.
- İki geliştirici aynı repo üzerinde çalışabilir.

### Aşama 2 — Çocuk akışı durum makinesi

İşler:

- Sesli hikâye.
- Cevap penceresi.
- Sabit öğretim geri bildirimi.
- Tam ekran tekrar katmanı.
- Üç saniyelik tekrar penceresi.
- En fazla iki tekrar.
- Otomatik sonraki senaryo.

Teknoloji:

- React Native.
- TypeScript reducer veya küçük state machine.
- Önceden hazırlanmış yerel test asset’leri.
- Vitest/Jest.

Çıkış kriteri:

- Okuma gerektiren ilerleme düğmesi yoktur.
- Emojiler tekrar aşamasında tıklanamaz.
- Loop sınırı çalışır.
- Durum geçiş testleri geçer.

### Aşama 3 — İçerik şeması

İşler:

- JSON içerik formatı.
- Zod doğrulaması.
- İçerik sürümleme.
- Beş-on manuel test içeriğinin şemaya taşınması.

Teknoloji:

- TypeScript.
- Zod.
- JSON Schema.

Çıkış kriteri:

- Mobil uygulama kod içine gömülü senaryo yerine içerik dosyası okuyabilir.
- Geçersiz içerik build’i durdurur.

### Aşama 4 — Görsel ve ses benchmark’ı

İşler:

- Karakter kitabı.
- Görsel sağlayıcı karşılaştırması.
- TTS kör dinleme testi.
- Mobil asset format ve kalite testi.

Teknoloji:

- Seçilecek görsel üretim servisleri.
- Seçilecek TTS servisleri.
- Basit değerlendirme formu.
- Ses/görsel optimizasyon araçları.

Çıkış kriteri:

- Görsel sağlayıcısı seçilir.
- TTS sağlayıcısı ve ses profili seçilir.
- Test uygulamasındaki cihaz sesi ürün kapsamından çıkarılır.

### Aşama 5 — Ebeveyn hesabı ve profil

İşler:

- E-posta kaydı ve doğrulama.
- PIN.
- Çocuk profili.
- Yaş katmanı.
- Veri minimizasyonlu ilgi alanları.

Teknoloji:

- Supabase Auth.
- PostgreSQL.
- React Native form ekranları.
- Row Level Security.

Çıkış kriteri:

- Doğrulanmamış kullanıcı çocuk moduna erişemez.
- Ebeveyn alanı PIN korumalıdır.

### Aşama 6 — İzin yönetimi

İşler:

- Üç ayrı izin.
- İzin sürümü.
- Geri çekme.
- Audit kaydı.

Teknoloji:

- PostgreSQL.
- Supabase Edge Functions.
- Mobil ebeveyn ekranları.

Çıkış kriteri:

- Insight ve AI geliştirme izinleri birbirinden bağımsız çalışır.

### Aşama 7 — Olay toplama ve çevrimdışı senkronizasyon

İşler:

- Olay sözleşmesi.
- SQLite kuyruk.
- Batch senkronizasyon.
- Idempotency.

Teknoloji:

- Expo SQLite.
- Supabase Edge Functions.
- PostgreSQL.

Çıkış kriteri:

- İnternet kesilse bile etkinlik tamamlanır.
- Aynı olay iki kez kaydedilmez.

### Aşama 8 — Kanıt ve kişiselleştirme motoru

İşler:

- Gürültü sınıfları.
- Kanıt kayıtları.
- Kural tabanlı etkinlik seçimi.
- Açıklanabilir karar logları.

Teknoloji:

- Paylaşılan TypeScript domain paketi.
- PostgreSQL.
- Unit ve property testleri.

Çıkış kriteri:

- Tekrar dokunması cevap olarak işlenmez.
- Tek hızlı cevap otomatik gürültü sayılmaz.

### Aşama 9 — İçerik agent’ı

İşler:

- Üretici agent.
- Denetleyici agent.
- RAG rehberi.
- JSON çıktısı.
- Otomatik güvenlik kontrolleri.

Teknoloji:

- TypeScript.
- Seçilecek model API’si.
- Zod.
- PostgreSQL veya sürümlü doküman deposu.

Çıkış kriteri:

- Agent geçerli taslak üretebilir.
- Agent doğrudan yayın yapamaz.

### Aşama 10 — Admin paneli

İşler:

- Taslak inceleme.
- Asset karşılaştırma.
- Ses dinleme.
- Ret ve onay.
- Yayınlama ve geri alma.

Teknoloji:

- Next.js.
- Supabase Auth/PostgreSQL/Storage.
- Playwright.

Çıkış kriteri:

- Bir içerik baştan sona onay akışından geçebilir.
- Kendi içeriğine tek kişi son yayın onayı veremez.

### Aşama 11 — MVP içerik üretimi

İşler:

- 40–60 onaylı senaryo.
- Dört temel duygu.
- 2–4 ve 4–7 varyasyonları.
- Görsel ve ses asset’leri.
- Uzman incelemesi.

Teknoloji:

- İçerik agent’ı.
- Admin paneli.
- Görsel ve TTS pipeline’ı.

Çıkış kriteri:

- Bütün MVP içerikleri iki ortak ve uzman tarafından onaylanmıştır.

### Aşama 12 — Ebeveyn oturum özeti

İşler:

- Tamamlanan oturumlar.
- Genel ev etkinliği önerileri.
- Insight durumu.

Teknoloji:

- React Native ebeveyn ekranları.
- Supabase sorguları.

Çıkış kriteri:

- Ham dokunma verileri gösterilmez.
- Tanısal dil bulunmaz.

### Aşama 13 — Sınırlı insight pilotu

İşler:

- Uygunluk kapıları.
- Şablon tabanlı nitel gözlemler.
- Cold start ekranı.
- Yanlış anlaşılma testleri.

Teknoloji:

- TypeScript insight motoru.
- PostgreSQL kanıt sorguları.
- Önceden onaylı metin şablonları.

Çıkış kriteri:

- Yetersiz veriyle insight oluşmaz.
- Yüzde, tanı ve yaşıt karşılaştırması yoktur.

### Aşama 14 — Pilot ve iyileştirme

Pilot sırası:

- Ekip içi test.
- Uzman testi.
- 5–10 aileyle kullanılabilirlik testi.
- 20–30 aileyle sınırlı pilot.

Ölçümler:

- Oturum tamamlama.
- Seçim yapılmama oranı.
- Tekrar isteme oranı.
- Rastgele dokunma örüntüleri.
- İçerik bazlı hata kümeleri.
- Ebeveyn müdahalesi.
- Ses ve görsel beğenisi.
- Insight dilinin yanlış anlaşılması.

Çıkış kriteri:

- Kritik güvenlik sorunu yoktur.
- Durum makinesi çocuklar tarafından kullanılabilir.
- Eşikler pilot verisiyle güncellenmiştir.

---

## 24. MVP kapsamı

### Dahil

- iPhone ve iPad uygulaması.
- Zorunlu ebeveyn hesabı.
- E-posta doğrulama.
- PIN korumalı ebeveyn alanı.
- Çocuk profili.
- Doğum ayı/yılı ve temel ilgi alanları.
- Üç ayrı izin.
- 2–4 ve 4–7 yaş katmanları.
- Dört temel duygu.
- 40–60 onaylı senaryo.
- Önceden üretilmiş görsel ve sesler.
- Sesle ilerleyen çocuk akışı.
- En fazla iki tekrar.
- Çevrimdışı etkinlik oynatma.
- Olay kuyruğu ve senkronizasyon.
- Kural tabanlı kişiselleştirme.
- İçerik agent’ı.
- Admin paneli.
- Tarafsız oturum özeti.
- 4–7 yaş için sınırlı ve izinli insight altyapısı; pilot sonucuna göre açılacaktır.

### Dahil değil

- Çocuğun sesini kaydetme.
- Serbest konuşan AI.
- Kamera veya yüz analizi.
- Tanı veya klinik risk.
- Otomatik uzman yönlendirmesi.
- Özel eğitilmiş model.
- Android mağaza yayını.
- Çoklu dil.
- Kreş veya öğretmen paneli.
- Reklam.
- Sosyal özellikler.

---

## 25. Test stratejisi

### 25.1 Unit test

- Durum geçişleri.
- Tekrar sınırı.
- Zaman aşımı.
- İçerik şeması.
- Olay üretimi.
- Idempotency.
- Yaş katmanı hesabı.
- İzin kapıları.
- Insight uygunluğu.

### 25.2 Mobil uçtan uca test

- Ebeveyn kayıt akışı.
- Çocuk profili.
- Çocuk moduna giriş.
- Seçim yapılması.
- Seçim yapılmaması.
- Tekrar istenmesi.
- İki tekrar sonrası otomatik ilerleme.
- İnternet kesintisi.
- Uygulamanın arka plana gitmesi.

### 25.3 İçerik testleri

- Yasak kelimeler.
- Eksik ses/görsel asset’i.
- Metin ve ses sürümü uyumsuzluğu.
- Tekrarlanan içerik.
- Cinsiyet kalıpları.
- Yaşa uygunluk.
- Belirsiz hedef duygu.

### 25.4 Cihaz matrisi

- Küçük ekranlı iPhone.
- iPhone 17.
- iPad Pro.
- Farklı iOS sürümleri, destek politikası belirlendikten sonra.
- Sessiz mod ve ses seviyesi senaryoları.
- Çevrimdışı kullanım.

---

## 26. Başarı ölçütleri

MVP başarısı çocukların yüksek doğruluk oranı değildir.

Başarı göstergeleri:

- Çocukların önemli bölümünün ebeveyn teknik yardımı olmadan akışı tamamlayabilmesi.
- Tekrar dinleme komutunun anlaşılması.
- Tekrar dokunmalarının duygu cevabıyla karışmaması.
- Oturumların yaşa uygun sürede tamamlanması.
- Ebeveynlerin ürünü tanı aracı olarak yanlış anlamaması.
- İçeriklerin uzman değerlendirmesinden geçmesi.
- Ses ve görsel tutarlılığının kabul edilebilir bulunması.
- Kritik güvenlik ve gizlilik hatası olmaması.
- Agent taslaklarının insan düzenleme süresini azaltması.

Kesin hedef değerler ilk kullanılabilirlik testinden sonra belirlenecektir.

---

## 27. Açık kararlar

Kontrollü test gerektiren kararlar:

- Görsel üretim sağlayıcısı.
- TTS sağlayıcısı ve ses profili.
- Cevap penceresi süresi.
- Tekrar yönlendirmesinin kesin ses metni.
- Gürültü sınıflandırma katsayıları.
- Insight için minimum kanıt eşikleri.
- Ham olaylar ve türetilmiş veriler için saklama süreleri.
- Desteklenecek minimum iOS sürümü.
- Ücretlendirme modeli.
- Dönemsel uzman çalışma modeli.

Bu kararlar varsayımla kalıcılaştırılmayacak; ilgili geliştirme aşamasındaki test ve uzman incelemesiyle alınacaktır.

---

## 28. Riskler ve azaltma yöntemleri

| Risk | Etki | Azaltma |
|---|---|---|
| Rastgele dokunmanın beceri kanıtı sayılması | Yanlış gözlem | Durum makinesi, çoklu sinyal ve kanıt sınıfları |
| Ebeveynin insight’ı tanı gibi anlaması | Kaygı ve yanlış karar | Nitel dil, açık sınırlar, uzman incelemesi |
| Agent’ın uygunsuz içerik üretmesi | Çocuk güvenliği | Şema, otomatik kurallar, iki insan ve uzman onayı |
| Karakterlerin görsel olarak değişmesi | Güven ve kalite kaybı | Karakter kitabı ve referans görseller |
| Türkçe TTS’nin yapay veya korkutucu olması | Kullanılabilirlik kaybı | Kör dinleme ve cihaz testi |
| İki kişilik ekipte kapsamın büyümesi | Gecikme | Modüler monolit, sıkı MVP sınırı |
| Çocuk verisinin gereğinden fazla tutulması | Hukuki ve etik risk | Veri minimizasyonu ve saklama politikası |
| Öğretim içeriğinin değerlendirme sayılması | Yanlış çıkarım | Etkinlik türlerini ayırma |
| Cinsiyet kalıpları | Ayrımcı içerik | Temsil analizi ve içerik denetimi |
| Üçüncü taraf servise bağımlılık | Maliyet ve kesinti | Asset’leri önceden üretme ve sağlayıcı soyutlaması |

---

## 29. Son ürün ilkeleri

1. Çocuk puanlanmaz; desteklenir.
2. Her dokunma öğrenme kanıtı değildir.
3. Yaş, insight için tek başına yeterli değildir.
4. Ebeveyn izni gerekli fakat yeterli değildir; veri yeterliliği ayrıca aranır.
5. Çocuğa canlı üretken AI cevap vermez.
6. İçerik agent tarafından taslaklanabilir fakat insan onayı olmadan yayınlanamaz.
7. Görsel ve sesler sürümlü, denetlenmiş ve çevrimdışı oynatılabilir olur.
8. Üç–beş yaş akışı okuma gerektirmez.
9. Tekrar dinleme dokunuşu duygu seçimi olarak kaydedilmez.
10. Sistem tanı, hastalık ihtimali veya klinik risk üretmez.
11. Ebeveyn ham olayları standart panelde görmez; yasal veri hakları korunur.
12. Çocuk verisinin AI geliştirmede kullanımı ayrı izin ve gerçek anonimleştirme gerektirir.
13. Yüzde ve yaşıt sıralaması yerine kanıta dayalı nitel gözlemler kullanılır.
14. Bilinmeyen eşikler pilot verisinden önce bilimsel kesinlik gibi sunulmaz.

---

## 30. Referanslar

- Expo proje ve fiziksel cihaz dokümantasyonu: https://docs.expo.dev/
- OpenAI güncel model dokümantasyonu: https://developers.openai.com/api/docs/models
- KVKK kişisel veri ve açık rıza rehberleri: https://www.kvkk.gov.tr/
- Avrupa Komisyonu çocuk verisi ve GDPR rehberleri: https://commission.europa.eu/law/law-topic/data-protection/
- FTC COPPA rehberleri: https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
