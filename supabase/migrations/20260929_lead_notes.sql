create table if not exists public.lead_notes (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    lead_id uuid not null references public.leads(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    note text not null,
    created_at timestamptz not null default now()
);

create index if not exists lead_notes_lead_created_idx
on public.lead_notes(lead_id, created_at desc);

alter table public.lead_notes enable row level security;

create policy "members manage lead notes"
on public.lead_notes
for all
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
