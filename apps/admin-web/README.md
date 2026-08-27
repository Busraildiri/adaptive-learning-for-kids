# Admin web

R9 içerik inceleme panelidir. Çocuk uygulamasından ayrıdır ve yalnızca `private.content_admins`
tablosunda izin verilen Supabase kullanıcıları giriş yapabilir.

## Yerel kurulum

1. `.env.example` dosyasını `.env.local` olarak kopyala ve yerel Supabase publishable key'ini ekle.
2. Yönetici olacak hesabı normal Supabase Auth kullanıcısı olarak oluştur.
3. Yerel SQL Editor'da aşağıdaki komutu yalnızca kendi e-posta adresinle bir kez çalıştır:

```sql
insert into private.content_admins (user_id)
select id from auth.users where email = 'YOUR_EMAIL'
on conflict (user_id) do nothing;
```

4. Kök dizinde `pnpm dev:admin` çalıştır ve `http://localhost:3000` adresini aç.

Service-role key bu web uygulamasına verilmez. Listeleme ve karar işlemleri allowlist kontrolü yapan
RPC'lerden geçer. Ret ve 15 günlük süre dolumunda hikâye gövdesi silinir; minimal karar audit'i kalır.
