import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { analyseSalesPipeline } from '../../../lib/sales-manager'

export async function POST() {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      console.error('Sales Manager membership error:', membershipError)
      return Response.json(
        { error: 'Unable to load your organization.' },
        { status: 500 }
      )
    }

    if (!membership) {
      return Response.json(
        { error: 'You do not have permission to run the Sales Manager.' },
        { status: 403 }
      )
    }

    const organizationId = membership.organization_id

    const [
      organizationResult,
      assistantResult,
      leadsResult,
      activitiesResult,
      followUpsResult,
    ] = await Promise.all([
      admin
        .from('organizations')
        .select('id, name, industry')
        .eq('id', organizationId)
        .single(),

      admin
        .from('assistants')
        .select(
          'id, organization_id, business_description, services, areas, qualification_rules, qualification_settings, tone'
        )
        .eq('organization_id', organizationId)
        .eq('active', true)
        .limit(1)
        .maybeSingle(),

      admin
        .from('leads')
        .select(
          'id, name, email, phone, location, service, timescale, budget, quantity, enquiry, custom_fields, score, status, ready_to_contact, preferred_contact_method, marketing_email, marketing_sms, marketing_phone, marketing_whatsapp, do_not_contact, communication_preference_source,  created_at, created_at'
        )
        .eq('organization_id', organizationId)
        .neq('status', 'LOST')
        .order('created_at', { ascending: false })
        .limit(100),

      admin
        .from('lead_activities')
        .select(
          'id, lead_id, activity_type, title, description, created_at'
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(200),

      admin
        .from('lead_follow_ups')
        .select(
          'id, lead_id, due_at, action, reason, suggested_message, status, source, created_at, completed_at'
        )
        .eq('organization_id', organizationId)
        .in('status', ['PENDING', 'SNOOZED'])
        .order('due_at', { ascending: true })
        .limit(100),
    ])

    if (organizationResult.error) {
      console.error('Sales Manager organization error:', organizationResult.error)
      return Response.json(
        { error: 'Unable to load organization data.' },
        { status: 500 }
      )
    }

    if (assistantResult.error) {
      console.error('Sales Manager assistant error:', assistantResult.error)
      return Response.json(
        { error: 'Unable to load AI Employee training.' },
        { status: 500 }
      )
    }

    if (!assistantResult.data) {
      return Response.json(
        { error: 'Your AI Employee has not been trained yet.' },
        { status: 400 }
      )
    }

    if (leadsResult.error) {
      console.error('Sales Manager leads error:', leadsResult.error)
      return Response.json(
        { error: 'Unable to load leads.' },
        { status: 500 }
      )
    }

    if (activitiesResult.error) {
      console.error('Sales Manager activities error:', activitiesResult.error)
      return Response.json(
        { error: 'Unable to load lead activity.' },
        { status: 500 }
      )
    }

    if (followUpsResult.error) {
      console.error('Sales Manager follow-up error:', followUpsResult.error)
      return Response.json(
        { error: 'Unable to load follow-ups.' },
        { status: 500 }
      )
    }

    const organisation = organizationResult.data
    const assistant = {
      ...assistantResult.data,
      business_name: organisation?.name || '',
      industry: organisation?.industry || '',
    }

    const leads = leadsResult.data || []
    const activities = activitiesResult.data || []
    const followUps = followUpsResult.data || []

    const analysis = await analyseSalesPipeline({
      assistant,
      leads,
      activities,
      followUps,
    })

    const now = new Date().toISOString()

    await admin
      .from('sales_manager_insights')
      .update({
        status: 'SUPERSEDED',
        created_at: now,
      })
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')

    const { data: insight, error: insertError } = await admin
      .from('sales_manager_insights')
      .insert({
        organization_id: organizationId,
        priority_lead_id: analysis.priority_lead_id,
        headline: analysis.headline,
        summary: analysis.summary,
        priority_action: analysis.priority_action,
        priority_reason: analysis.priority_reason,
        suggested_message: analysis.suggested_message,
        secondary_priorities: analysis.secondary_priorities || [],
        risks: analysis.risks || [],
        qualification_opportunities:
          analysis.qualification_opportunities || [],
        generated_at: now,
        status: 'ACTIVE',
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        source: 'AI',
        created_at: now,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Sales Manager insight save error:', insertError)
      return Response.json(
        { error: 'The Sales Manager analysed the pipeline but could not save the result.' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      insight,
    })
  } catch (error) {
    console.error('Sales Manager error:', error)

    return Response.json(
      { error: error?.message || 'Sales Manager analysis failed.' },
      { status: 500 }
    )
  }
}
