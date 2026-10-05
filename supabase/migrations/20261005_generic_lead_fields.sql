alter table public.leads
  add column if not exists location text,
  add column if not exists budget text,
  add column if not exists quantity text,
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;
