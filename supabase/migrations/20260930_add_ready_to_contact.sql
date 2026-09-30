alter table public.leads
add column if not exists ready_to_contact boolean not null default false;
