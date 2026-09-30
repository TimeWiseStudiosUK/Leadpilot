alter table public.assistants
add column if not exists qualification_settings jsonb not null default '{}'::jsonb;
