# Admin web

R9 içerik inceleme panelidir. Çocuk uygulamasından ayrıdır ve yalnızca `private.content_admins`
tablosunda izin verilen Supabase kullanıcıları giriş yapabilir.

## Yerel kurulum

1. `.env.example` dosyasını `.env.local` olarak kopyala; Supabase URL, publishable key, server-only
   service-role key ve OpenAI API key değerlerini ekle.
2. Yönetici olacak hesabı normal Supabase Auth kullanıcısı olarak oluştur.
3. Yerel SQL Editor'da aşağıdaki komutu yalnızca kendi e-posta adresinle bir kez çalıştır:

```sql
insert into private.content_admins (user_id)
select id from auth.users where email = 'YOUR_EMAIL'
on conflict (user_id) do nothing;
```

4. Kök dizinde `pnpm dev:admin` çalıştır ve `http://localhost:3000` adresini aç.

Service-role ve OpenAI anahtarları yalnızca Next.js sunucu route'unda tutulur; tarayıcı paketine
aktarılmaz ve `NEXT_PUBLIC_` öneki almaz. Listeleme, üretim ve karar işlemleri allowlist kontrolünden
geçer. “Yeni hikâye üret” formu onaylı şablon ve asset kullanır; audit kaydı oluşmadan taslak yayın
veya inceleme RPC'sine gönderilmez. Ret ve 15 günlük süre dolumunda hikâye gövdesi silinir; minimal
karar audit'i kalır.
