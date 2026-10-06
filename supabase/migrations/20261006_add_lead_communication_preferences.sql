alter table public.leads
  add column if not exists preferred_contact_method text,
  add column if not exists marketing_email boolean,
  add column if not exists marketing_sms boolean,
  add column if not exists marketing_phone boolean,
  add column if not exists marketing_whatsapp boolean,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists communication_preference_source text,
  add column if not exists communication_preferences_updated_at timestamptz;

alter table public.leads
  drop constraint if exists leads_preferred_contact_method_check;

alter table public.leads
  add constraint leads_preferred_contact_method_check
  check (
    preferred_contact_method is null
    or preferred_contact_method in (
      'PHONE',
      'EMAIL',
      'SMS',
      'WHATSAPP',
      'NO_PREFERENCE'
    )
  );

create index if not exists leads_do_not_contact_idx
  on public.leads (organization_id, do_not_contact);

create index if not exists leads_preferred_contact_method_idx
  on public.leads (organization_id, preferred_contact_method);
