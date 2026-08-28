-- Local-dev-only test job, inserted directly (bypassing admin-web, which has
-- no image-sourcing UI yet) so worker.py's poll/claim/render loop can be
-- verified end-to-end. Run against the local Supabase Postgres only.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values (
  '99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'worker-test@example.test', ''
)
on conflict (id) do nothing;

insert into private.media_jobs (story_id, scene_id, provider, mode, render_manifest, requested_by)
values (
  'story_001',
  'trigger_01',
  'openmontage',
  'local_animation',
  '{
    "scene": {
      "sceneId": "trigger_01",
      "storyId": "story_001",
      "emotion": "neutral",
      "event": "trigger_01",
      "narration": "Öğretmeni, şimdi başka etkinliğe geçiyoruz, dedi. Momo bunu beklemiyordu.",
      "visualPrompt": "test scene for worker loop verification",
      "duration": 5
    },
    "mode": "local_animation",
    "aspectRatio": "4:5",
    "imagePath": "C:\\Users\\seren\\adaptive-learning-for-kids\\adaptive-learning-for-kids\\apps\\mobile\\assets\\characters\\mino-happy.png",
    "voiceModel": "C:\\Users\\seren\\adaptive-learning-for-kids\\adaptive-learning-for-kids\\services\\media-worker\\voices\\tr_TR-dfki-medium.onnx"
  }'::jsonb,
  '99999999-9999-9999-9999-999999999999'
);
