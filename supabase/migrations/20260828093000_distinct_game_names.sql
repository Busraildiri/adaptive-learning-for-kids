update public.published_game_versions
set game = jsonb_set(
  jsonb_set(game, '{title}', '"Lila’nın Işık Bahçesi"'::jsonb),
  '{presentation,introNarration}',
  '"Lila’nın bahçesini uyandıralım! Yeşil ışığa dokun. Kırmızı ışıkta sessizce bekle."'::jsonb
)
where game_id = 'color-lights-001';

update public.published_game_versions
set game = jsonb_set(
  jsonb_set(game, '{title}', '"Pati’nin Kural Sepeti"'::jsonb),
  '{presentation,introNarration}',
  '"Pati ile bahçedeki doğru nesneleri bulup sepete koyalım!"'::jsonb
)
where game_id = 'rule-changed-garden-001';

update public.published_game_versions
set game = replace(game::text, 'Mino', 'Tomo')::jsonb
where game_id = 'mino-routine-path-001';

update public.published_game_versions
set game = jsonb_set(game, '{title}', '"Duru Duygu Dedektifi"'::jsonb)
where game_id = 'mino-emotion-detective-001';

update private.game_drafts
set game = jsonb_set(game, '{title}', '"Lila’nın Işık Bahçesi"'::jsonb)
where game_id = 'color-lights-001';

update private.game_drafts
set game = jsonb_set(game, '{title}', '"Pati’nin Kural Sepeti"'::jsonb)
where game_id = 'rule-changed-garden-001';

update private.game_drafts
set game = replace(game::text, 'Mino', 'Tomo')::jsonb
where game_id = 'mino-routine-path-001';

update private.game_drafts
set game = jsonb_set(game, '{title}', '"Duru Duygu Dedektifi"'::jsonb)
where game_id = 'mino-emotion-detective-001';
