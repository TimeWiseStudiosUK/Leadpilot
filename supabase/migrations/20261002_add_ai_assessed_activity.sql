alter table public.lead_activities
drop constraint if exists lead_activities_type_check;

alter table public.lead_activities
add constraint lead_activities_type_check
check (
  activity_type in (
    'CREATED',
    'STATUS_CHANGED',
    'NOTE_ADDED',
    'CALL',
    'EMAIL',
    'FOLLOW_UP',
    'AI_ASSESSED'
  )
);
