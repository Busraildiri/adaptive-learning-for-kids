alter table public.child_momo_customizations
add column unlocked_milestones integer[] not null default '{}';

alter table public.child_momo_customizations
add constraint child_momo_customizations_valid_milestones check (
  unlocked_milestones <@ array[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]
);

comment on table public.child_momo_customizations is
  'Stores the selected Momo visual theme and permanent assembly milestones for a child profile.';
