alter table public.leads
drop constraint if exists leads_score_check;

update public.leads
set score = null
where score = 'COLD';

alter table public.leads
add constraint leads_score_check
check (score in ('HOT', 'WARM') or score is null);

alter table public.leads
alter column score drop not null;

alter table public.leads
alter column score drop default;
