"use client";

export function GamePanel() {
  return (
    <section className="generation-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">OYUN ÜRETİMİ</p>
          <h2>Yeni oyun üret</h2>
        </div>
      </div>
      <p className="generation-help">
        Bu ekran henüz yapım aşamasında. Oyun üretimi için önce bir oyun mekaniği tanımlanmalı (örn.
        hangi adımlardan oluşacağı, hangi asset türlerinin kullanılacağı) — hikâye üretiminde olduğu
        gibi şema, güvenlik denetimi ve inceleme kuyruğuyla birlikte inşa edilecek.
      </p>
    </section>
  );
}
