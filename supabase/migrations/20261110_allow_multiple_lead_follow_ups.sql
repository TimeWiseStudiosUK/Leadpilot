-- Allow multiple active manual follow-ups per lead while retaining a single
-- active AI-generated recommendation per lead.
-- The previous unique index covered every source and therefore blocked
-- legitimate manual tasks. The replacement scopes uniqueness to AI tasks.

drop index if exists public.lead_follow_ups_one_active_idx;

create unique index if not exists lead_follow_ups_one_active_ai_idx
  on public.lead_follow_ups (lead_id)
  where source = 'AI' and status in ('PENDING', 'SNOOZED');
