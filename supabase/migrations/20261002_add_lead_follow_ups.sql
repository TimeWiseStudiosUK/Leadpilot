create table if not exists public.lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,

  due_at timestamptz not null,
  action text not null,
  reason text,
  suggested_message text,

  status text not null default 'PENDING',

  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,

  source text not null default 'AI',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lead_follow_ups_status_check
    check (
      status in (
        'PENDING',
        'COMPLETED',
        'SNOOZED',
        'CANCELLED'
      )
    ),

  constraint lead_follow_ups_source_check
    check (
      source in (
        'AI',
        'MANUAL'
      )
    )
  )
);

create index if not exists lead_follow_ups_lead_idx
  on public.lead_follow_ups (lead_id, due_at asc);

create index if not exists lead_follow_ups_org_due_idx
  on public.lead_follow_ups (organization_id, due_at asc);

create index if not exists lead_follow_ups_pending_idx
  on public.lead_follow_ups (organization_id, due_at asc)
  where status in ('PENDING', 'SNOOZED');

create unique index if not exists lead_follow_ups_one_active_idx
  on public.lead_follow_ups (lead_id)
  where status in ('PENDING', 'SNOOZED');

alter table public.lead_follow_ups enable row level security;
