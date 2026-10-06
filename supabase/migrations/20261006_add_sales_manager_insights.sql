create table if not exists public.sales_manager_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  priority_lead_id uuid references public.leads(id) on delete set null,

  headline text not null,
  summary text not null,
  priority_action text not null,
  priority_reason text not null,
  suggested_message text,

  secondary_priorities jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  qualification_opportunities jsonb not null default '[]'::jsonb,

  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'ACTIVE',

  model text,
  source text not null default 'AI',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_manager_insights_status_check
    check (status in ('ACTIVE', 'SUPERSEDED', 'EXPIRED'))
);

create index if not exists sales_manager_insights_org_idx
  on public.sales_manager_insights (organization_id, generated_at desc);

create index if not exists sales_manager_insights_priority_lead_idx
  on public.sales_manager_insights (priority_lead_id);

create unique index if not exists sales_manager_one_active_per_org_idx
  on public.sales_manager_insights (organization_id)
  where status = 'ACTIVE';

alter table public.sales_manager_insights enable row level security;
