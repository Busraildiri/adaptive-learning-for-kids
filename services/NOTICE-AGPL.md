# Lisans Notu — services/ dizini

`services/openmontage/` (vendored, https://github.com/calesthio/OpenMontage) **GNU AGPLv3**
altında lisanslıdır. `services/media-worker/` bu kodu içe aktardığı için AGPLv3'ün ağ
üzerinden erişim şartına (bölüm 13) tabidir: bu servisle ağ üzerinden etkileşen kullanıcılara
birleşik kaynak kodun tam haline erişim sağlanmalıdır.

Bu kapsam, `apps/admin-web`, `apps/mobile` ve `packages/*` altındaki mevcut koda **uygulanmaz**
— onlar OpenMontage ile yalnızca job-tabanlı bir API sözleşmesi (`RenderManifest` / `media_jobs`)
üzerinden, süreç sınırı ötesinden konuşur, kodu içe aktarmaz.

Yayına almadan önce bu ayrımın (ayrı servis, ayrı lisans, ayrı repo-içi sınır) gerçek hukuki
danışmanlıkla doğrulanması gerekir.
