-- Applied to the shared Supabase project as allow_aria_passage_recordings.
-- Keep Brady's Genesis recordings valid and allow Aria's Exodus recordings.
alter table public.brady_torah_passage_recordings_v1 drop constraint brady_recording_fixed_name;
alter table public.brady_torah_passage_recordings_v1 add constraint passage_recording_name_matches_passage
  check ((name = 'Brady' and passage_key = 'genesis-42-8-23')
      or (name = 'Aria' and passage_key = 'exodus-14-15-30'));
alter table public.brady_torah_passage_recordings_v1 drop constraint brady_torah_passage_recordings_v1_passage_key_check;
alter table public.brady_torah_passage_recordings_v1 drop column playback_url;
alter table public.brady_torah_passage_recordings_v1 add column playback_url text generated always as
  (case when name = 'Aria'
    then 'https://esemmelman.github.io/aria-torah/recording.html#'
    else 'https://esemmelman.github.io/bradytorah/recording.html#'
  end || id::text) stored;
