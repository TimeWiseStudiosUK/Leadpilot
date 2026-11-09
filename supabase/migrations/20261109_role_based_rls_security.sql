-- LeadPilot: role-based RLS security
-- Applied to the live Supabase project on 2026-11-09.
-- This migration records the role-based policies and function permissions.

BEGIN;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated, service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_manager_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read organisations" ON public.organizations;
DROP POLICY IF EXISTS "admins read organisations" ON public.organizations;
DROP POLICY IF EXISTS "members read membership" ON public.organization_members;
DROP POLICY IF EXISTS "members manage assistants" ON public.assistants;
DROP POLICY IF EXISTS "admins manage assistants" ON public.assistants;
DROP POLICY IF EXISTS "members manage leads" ON public.leads;
DROP POLICY IF EXISTS "members create leads" ON public.leads;
DROP POLICY IF EXISTS "members read leads" ON public.leads;
DROP POLICY IF EXISTS "members update leads" ON public.leads;
DROP POLICY IF EXISTS "owners delete leads" ON public.leads;
DROP POLICY IF EXISTS "members manage conversations" ON public.conversations;
DROP POLICY IF EXISTS "members read conversations" ON public.conversations;
DROP POLICY IF EXISTS "members manage messages" ON public.messages;
DROP POLICY IF EXISTS "members read messages" ON public.messages;
DROP POLICY IF EXISTS "members manage lead notes" ON public.lead_notes;
DROP POLICY IF EXISTS "members add lead notes" ON public.lead_notes;
DROP POLICY IF EXISTS "members read lead notes" ON public.lead_notes;
DROP POLICY IF EXISTS "members read lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "members add lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "members read lead follow ups" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "members create lead follow ups" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "members update lead follow ups" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "admins manage sales manager insights" ON public.sales_manager_insights;

CREATE POLICY "admins read organisations"
ON public.organizations FOR SELECT
USING (public.is_org_admin(id));

CREATE POLICY "members read membership"
ON public.organization_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "admins manage assistants"
ON public.assistants FOR ALL
USING (public.is_org_admin(organization_id))
WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "members create leads"
ON public.leads FOR INSERT
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "members read leads"
ON public.leads FOR SELECT
USING (public.is_org_member(organization_id));

CREATE POLICY "members update leads"
ON public.leads FOR UPDATE
USING (public.is_org_member(organization_id))
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "owners delete leads"
ON public.leads FOR DELETE
USING (public.is_org_owner(organization_id));

CREATE POLICY "members read conversations"
ON public.conversations FOR SELECT
USING (public.is_org_member(organization_id));

CREATE POLICY "members read messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND public.is_org_member(c.organization_id)
  )
);

CREATE POLICY "members read lead notes"
ON public.lead_notes FOR SELECT
USING (public.is_org_member(organization_id));

CREATE POLICY "members add lead notes"
ON public.lead_notes FOR INSERT
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "members read lead activities"
ON public.lead_activities FOR SELECT
USING (public.is_org_member(organization_id));

CREATE POLICY "members add lead activities"
ON public.lead_activities FOR INSERT
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "members read lead follow ups"
ON public.lead_follow_ups FOR SELECT
USING (public.is_org_member(organization_id));

CREATE POLICY "members create lead follow ups"
ON public.lead_follow_ups FOR INSERT
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "members update lead follow ups"
ON public.lead_follow_ups FOR UPDATE
USING (public.is_org_member(organization_id))
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "admins manage sales manager insights"
ON public.sales_manager_insights FOR ALL
USING (public.is_org_admin(organization_id))
WITH CHECK (public.is_org_admin(organization_id));

COMMIT;
