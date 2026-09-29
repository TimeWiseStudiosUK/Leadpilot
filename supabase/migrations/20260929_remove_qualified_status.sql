alter table public.leads drop constraint if exists leads_status_check;

update public.leads
set status = 'CONTACTED'
where status = 'QUALIFIED';

alter table public.leads
add constraint leads_status_check
check (status in ('NEW', 'CONTACTED', 'WON', 'LOST'));
