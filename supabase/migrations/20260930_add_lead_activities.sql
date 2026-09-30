create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint lead_activities_type_check check (activity_type in ('CREATED','STATUS_CHANGED','NOTE_ADDED','CALL','EMAIL','FOLLOW_UP'))
);

create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index if not exists lead_activities_org_idx on public.lead_activities (organization_id, created_at desc);

alter table public.lead_activities enable row level security;
