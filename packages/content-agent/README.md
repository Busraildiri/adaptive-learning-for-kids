# Content agent

R8 hikâye varyasyonu üretim ve denetim hattıdır. Paket yalnızca `draft` sonuç oluşturur;
çocuk uygulamasına doğrudan içerik yayınlamaz.

## Akış

1. Çağıran servis bir `Story` iskeleti, izinli asset kimlikleri ve varyasyon tohumu verir.
2. Üretici model zorunlu JSON biçiminde bir hikâye taslağı döndürür.
3. `storySchema` ve deterministik kurallar iskelet, asset, yaş dili ve güvenliği kontrol eder.
4. Ayrı denetleyici model yapılandırılmış onay veya ret nedenleri döndürür.
5. Onaylanan sonuç yine yalnızca `draft` olur ve audit kaydı yazılır.
6. Herhangi bir hata veya ret durumunda son onaylı önbellek kaydı döndürülür.

Gerçek model istemcileri `StructuredModel` arayüzünün arkasında sunucu tarafında sağlanmalıdır.
API anahtarları constructor/configuration üzerinden secret store'dan alınmalı; mobil uygulamaya,
kaynak koda, prompt audit kaydına veya GitHub'a yazılmamalıdır.

## OpenAI sağlayıcısı

`createOpenAIStructuredModel`, Responses API'yi `store: false` ve strict JSON Schema çıktısıyla
çağırır. Yerel geliştirmede yalnızca kök `.env` içindeki `OPENAI_API_KEY` kullanılır;
`apps/mobile/.env` içine LLM anahtarı eklenmez. Önerilen prototip modeli üretici ve bağımsız
çağrılan denetleyici için `gpt-5.4-mini`'dir. Normal testler API çağrısı yapmaz. Tek ve düşük
maliyetli canlı bağlantı kontrolü açıkça `RUN_OPENAI_SMOKE=1` verildiğinde çalışır.

`createOpenAIContentModelsFromEnv()` aynı sunucu anahtarından iki ayrı istemci oluşturur:
`OPENAI_PRODUCER_MODEL` hikâye taslağını üretir, `OPENAI_REVIEWER_MODEL` ise farklı bir çağrıda
taslağı denetler. Prototipte ikisi de varsayılan olarak `gpt-5.4-mini` kullanır; bu, iki farklı
sağlayıcı kadar bağımsız bir denetim değildir ve pilot öncesinde yeniden değerlendirilmelidir.

Uzman rehber kaynağı `guidance/tr-TR.approved.json` altında sürümlüdür. Pilot/yayın ortamında bu
dosyanın içerik uzmanı onayı olmadan yeni bir sürümü etkinleştirilmemelidir.
