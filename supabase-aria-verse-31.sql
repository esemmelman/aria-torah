-- Applied to the shared Supabase project as allow_aria_exodus_verse_31_groups.
-- Preserve existing passage keys and groups while allowing Exodus verse 31.
alter table public.aria_torah_highlight_groups_v1
  drop constraint aria_torah_highlight_groups_v1_verse_check;
alter table public.aria_torah_highlight_groups_v1
  add constraint aria_torah_highlight_groups_v1_verse_check
  check ((passage_key = 'exodus-14-15-30' and verse between 15 and 31)
      or (passage_key = 'genesis-41-1-16' and verse between 1 and 17));
