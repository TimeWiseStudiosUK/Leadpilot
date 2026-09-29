alter table public.leads
add column if not exists archived_at timestamptz;

create index if not exists leads_active_idx
on public.leads (organization_id, created_at desc)
where archived_at is null;
