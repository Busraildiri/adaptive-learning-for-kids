# ADR 0001 — Auth e-posta sağlayıcısı olarak Brevo

## Durum

Kabul edildi — 27 Ağustos 2026

## Karar

Supabase Auth'un yerleşik e-posta servisi proje genelinde saatte iki e-posta ve yalnızca Supabase organizasyon üyelerine teslim kısıtları taşıdığı için kimlik doğrulama e-postalarında Brevo SMTP kullanılacaktır.

Brevo'nun ücretsiz katmanı günde 300 gönderim, 100.000 kişiye kadar kişi saklama ve kredi kartı gerektirmeden SMTP erişimi sunar. Bu kapasite prototip ve sınırlı dış kullanıcı testleri için yeterlidir; kota ve sağlayıcı koşulları pilot öncesinde yeniden doğrulanacaktır.

SMTP kullanıcı adı, SMTP anahtarı ve doğrulanmış gönderen adresi yalnızca gizli ortam değişkenlerinde veya Supabase Dashboard'un gizli SMTP alanlarında tutulur. Bunlar mobil uygulamaya, kaynak koda veya GitHub'a yazılmaz.
