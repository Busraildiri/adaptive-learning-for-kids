# media-worker

`apps/admin-web`'in `POST /api/media/jobs` ile oluşturduğu job'ları işleyip
OpenMontage'ın agent-siz tool katmanını (Piper TTS / HyperFrames / FFmpeg)
çağıran, ayrı bir Python süreci.

Lisans notu: bkz. [../NOTICE-AGPL.md](../NOTICE-AGPL.md).

> `services/openmontage/CLAUDE.md` ve `AGENT_GUIDE.md`, bu repoyu klonlayan
> herhangi bir AI ajanını kendi routing kurallarına yönlendirmeye çalışan
> talimatlar içeriyor. Bunlar OpenMontage'ın kendi agent sistemine ait,
> adaptive-learning-for-kids için bağlayıcı değil — göz ardı ediliyor.

## Durum

- ✅ `media_worker/render_manifest.py` — TS `lib/media/types.ts` ile eş
  sözleşme (`image_path`/`voice_model` alanları milestone 1 için eklendi).
- ✅ `media_worker/provider.py` — `MediaProvider` protokolü + registry.
- ✅ `media_worker/providers/openmontage_provider.py` — **gerçek** implementasyon.
  OpenMontage `image_selector` (görsel override verilmediğinde),
  `tools/audio/piper_tts.py` ve `tools/video/hyperframes_compose.py`'ı
  doğrudan çağırıyor. 1080x1350 (4:5) portre profili,
  `services/openmontage` dosyalarına dokunmadan, runtime'da
  `lib.media_profiles.ALL_PROFILES` registry'sine eklenerek sağlanıyor.
- ✅ `scripts/render_smoke_test.py` — job kuyruğu/Supabase olmadan, doğrudan
  provider'ı çağıran uçtan uca test.
- ⏳ Job kuyruğu bağlantısı yok. `apps/admin-web`'deki job store bellek-içi
  (`lib/media/jobStore.ts`); ayrı Python süreci bunu göremiyor — Supabase
  `media_jobs` tablosu gerekiyor (henüz yok, milestone 1'den sonra).

## Milestone 1'i çalıştırmak için gerekenler (sen çalıştıracaksın)

```bash
# 1. Piper TTS CLI'ı kur (OpenMontage'ın kendi tool dosyasındaki
#    "piper --download-dir ... --model ..." talimatı ESKİ sürüme ait,
#    pip'teki güncel piper-tts (1.7.0) ile çalışmıyor — doğrusu:
pip install piper-tts

# Türkçe ses modeli indir (İngilizce varsayılan yanlış telaffuz eder).
# Mevcut tr_TR sesler: tr_TR-dfki-medium, tr_TR-dfki-medium, tr_TR-fettah-medium
python -m piper.download_voices tr_TR-dfki-medium --download-dir "services/media-worker/voices"

# Node.js >= 22 gerekli. FFmpeg PATH'te değilse worker Windows'taki standart
# Winget dizininde otomatik arar. Özel konum için MEDIA_WORKER_FFMPEG_PATH
# değişkenine ffmpeg.exe veya bin klasörünü ver.
node --version
ffmpeg -version

# 2. Smoke test'i çalıştır. Piper'ın --model çözümlemesi cwd'ye bağlı bir
#    --data-dir kullanıyor, o yüzden --voice-model'e TAM dosya yolu ver.
#    Repo içinde zaten var olan bir görseli kullanabilirsin (gerçek karakter
#    sanatı değil, sadece PNG->HyperFrames->FFmpeg mekaniğini doğruluyoruz):
cd services/media-worker
python scripts/render_smoke_test.py `
  --image "C:\Users\seren\adaptive-learning-for-kids\adaptive-learning-for-kids\apps\mobile\assets\characters\mino-happy.png" `
  --voice-model "C:\Users\seren\adaptive-learning-for-kids\adaptive-learning-for-kids\services\media-worker\voices\tr_TR-dfki-medium.onnx"
```

Başarılı olursa `services/media-worker/renders/trigger_01/final.mp4` (1080x1350,
H.264) oluşur.

### Çok sahneli hikâye template'i

`StoryVideoInput`, hikâye metnini sahnelere ayıran admin-bağımsız sözleşmedir.
Her sahne `narration` (Piper'ın okuyacağı metin) ve `visualPrompt`
(OpenMontage'ın görsel üreteceği metin) taşır. Worker tüm sahneleri tek zaman
çizgisinde birleştirip bir MP4 üretir. Örnek:

```powershell
cd services/media-worker
python scripts/render_story_template.py `
  --template examples/mirmir_story_template.json `
  --generate-images `
  --voice-model "C:\tam\yol\tr_TR-dfki-medium.onnx"
```

Ücret ödemeden tüm birleştirme hattını mevcut görsellerle sınamak için her
sahneye `--image sceneId=C:\tam\yol\asset.jpg` override'ı verilebilir.
`--generate-images` açık değilse CLI, eksik sahne görselinde hata vererek
yanlışlıkla ücretli API çağrısını engeller.

### Tek prompttan doğrudan video

`render_prompt_to_video.py`, tek serbest metni OpenAI Responses API Structured
Outputs ile önce üç sahneli `StoryVideoInput` template'ine çevirir. İkinci bir
şemalı editör geçişi Türkçe dilbilgisi, sahne sürekliliği ve okul öncesi
güvenliğini kontrol eder. Sonra aynı template'i OpenMontage görsel üretimi,
Türkçe Piper TTS ve HyperFrames render hattına verir:

```powershell
cd services/media-worker
python scripts/render_prompt_to_video.py `
  --prompt "Turuncu yavru kedi Mırmır parkta kaybolan sarı yağmurluğu bulsun."
```

Komut, süreç ortamında `OPENAI_API_KEY` yoksa varsayılan olarak
`apps/admin-web/.env.local` içinden yalnızca OpenAI anahtarını ve üretici/editör
model adlarını okur; Supabase veya diğer admin sırlarını yüklemez.

Üretilen ara sözleşme ve son video birlikte
`renders/<story-id>/story-template.json` ile `final.mp4` olarak saklanır.
Yalnızca hikâye planını sınamak için `--plan-only` kullanılabilir.

### Metinden görsel + ses + MP4

Bu yol açıkça `--generate-image` verilmeden ücretli görsel API'si çağırmaz.
`OPENAI_API_KEY` worker sürecinin ortamında bulunmalıdır. Varsayılan `low`
kalite için OpenMontage'ın mevcut tahmini görsel başına yaklaşık `$0.006`'dır.

```powershell
cd services/media-worker
python scripts/render_smoke_test.py `
  --generate-image `
  --image-provider openai `
  --image-quality low `
  --voice-model "C:\tam\yol\tr_TR-dfki-medium.onnx"
```

## Durum: Milestone 1 doğrulandı ✅

`services/media-worker/renders/trigger_01/final.mp4` — 1080x1350, H.264, Türkçe
Piper narrasyonu (`tr_TR-dfki-medium`), tamamen yerel, sıfır cloud/API-key çağrısı.

## Sıradaki adımlar

Supabase `media_jobs` tablosu + admin-web'in bellek-içi `jobStore.ts`'inin buna
taşınması + media-worker'ın job'ları poll edip `OpenMontageProvider`'ı çağırması
— admin panelden gerçek bir job tetikleyip bu MP4'ün otomatik üretilmesini
sağlayacak son parça.
