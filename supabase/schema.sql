-- LeadPilot v0.2 database
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.assistants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'AI Sales Assistant',
  public_slug text not null unique,
  greeting text not null default 'Hi, how can I help today?',
  business_description text not null default '',
  services jsonb not null default '[]'::jsonb,
  areas jsonb not null default '[]'::jsonb,
  qualification_rules text not null default '',
  tone text not null default 'friendly, professional and concise',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assistant_id uuid not null references public.assistants(id) on delete cascade,
  name text,
  email text,
  phone text,
  postcode text,
  service text,
  property_type text,
  timescale text,
  enquiry text,
  summary text,
  notes text,
  score text check (score in ('HOT','WARM') or score is null),
  ready_to_contact boolean not null default false,
  status text not null default 'NEW' check (status in ('NEW','CONTACTED','WON','LOST')),
  source text not null default 'AI_ASSISTANT',
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assistant_id uuid not null references public.assistants(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  session_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists leads_org_created_idx on public.leads(organization_id, created_at desc);
create index if not exists conversations_session_idx on public.conversations(session_id);
create index if not exists assistants_slug_idx on public.assistants(public_slug);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.assistants enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members m where m.organization_id = org_id and m.user_id = auth.uid());
$$;

create policy "members read organisations" on public.organizations for select using (public.is_org_member(id));
create policy "members read membership" on public.organization_members for select using (user_id = auth.uid());
create policy "members manage assistants" on public.assistants for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage leads" on public.leads for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage conversations" on public.conversations for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage messages" on public.messages for all using (exists(select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.organization_id))) with check (exists(select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.organization_id)));

-- Public assistant lookup is handled server-side. Do not make leads publicly readable.
