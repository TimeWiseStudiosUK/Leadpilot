import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { assessFollowUp } from '../../../../lib/ai'

const allowedStatuses = [
  'PENDING',
  'COMPLETED',
  'SNOOZED',
  'CANCELLED',
]

const allowedActions = [
  'CALL',
  'EMAIL',
  'FOLLOW_UP',
  'QUOTE',
  'CHECK_IN',
]

const timingToMinutes = {
  TODAY: 60,
  TOMORROW: 24 * 60,
  IN_3_DAYS: 3 * 24 * 60,
  IN_7_DAYS: 7 * 24 * 60,
  IN_14_DAYS: 14 * 24 * 60,
  IN_30_DAYS: 30 * 24 * 60,
}

function calculateDueAt(timing) {
  const minutes = timingToMinutes[timing]

  if (!minutes) {
    return null
  }

  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

async function getMembership(supabase, userId) {
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  return membership
}

export async function GET(request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getMembership(supabase, user.id)

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')

  let query = admin
    .from('lead_follow_ups')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('due_at', { ascending: true })

  if (leadId) {
    query = query.eq('lead_id', leadId)
  }

  const { data: followUps, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ followUps: followUps || [] })
}

export async function POST(request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getMembership(supabase, user.id)

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const leadId = body.leadId
  const dueAt = body.dueAt
  const action = body.action
  const reason = body.reason || null
  const suggestedMessage = body.suggestedMessage || null
  const source = body.source || 'MANUAL'

  if (!leadId || !dueAt || !action) {
    return Response.json(
      { error: 'leadId, dueAt and action are required' },
      { status: 400 }
    )
  }

  if (!allowedActions.includes(action)) {
    return Response.json({ error: 'Invalid follow-up action' }, { status: 400 })
  }

  if (!['AI', 'MANUAL'].includes(source)) {
    return Response.json({ error: 'Invalid follow-up source' }, { status: 400 })
  }

  const { data: lead } = await admin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!lead) {
    return Response.json({ error: 'Lead not found' }, { status: 404 })
  }

  const { data: existingFollowUp } = await admin
    .from('lead_follow_ups')
    .select('id, status')
    .eq('lead_id', leadId)
    .in('status', ['PENDING', 'SNOOZED'])
    .maybeSingle()

  if (existingFollowUp) {
    return Response.json(
      {
        error: 'An active follow-up already exists for this lead',
        followUp: existingFollowUp,
      },
      { status: 409 }
    )
  }

  const { data: followUp, error } = await admin
    .from('lead_follow_ups')
    .insert({
      organization_id: membership.organization_id,
      lead_id: leadId,
      user_id: user.id,
      due_at: dueAt,
      action,
      reason,
      suggested_message: suggestedMessage,
      source,
    })
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await admin.from('lead_activities').insert({
    organization_id: membership.organization_id,
    lead_id: leadId,
    user_id: user.id,
    activity_type: 'FOLLOW_UP',
    title: 'Follow-up scheduled',
    description: `${action.replace('_', ' ')} follow-up scheduled for ${new Date(dueAt).toLocaleString('en-GB')}.`,
    metadata: {
      follow_up_id: followUp.id,
      source,
      action,
    },
  })

  return Response.json({ followUp }, { status: 201 })
}

export async function PATCH(request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getMembership(supabase, user.id)

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const followUpId = body.id
  const status = body.status
  const dueAt = body.dueAt

  if (!followUpId) {
    return Response.json({ error: 'Follow-up id is required' }, { status: 400 })
  }

  if (status && !allowedStatuses.includes(status)) {
    return Response.json({ error: 'Invalid follow-up status' }, { status: 400 })
  }

  const { data: existingFollowUp } = await admin
    .from('lead_follow_ups')
    .select('*')
    .eq('id', followUpId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!existingFollowUp) {
    return Response.json({ error: 'Follow-up not found' }, { status: 404 })
  }

  const nextStatus = status || existingFollowUp.status

  const update = {
    updated_at: new Date().toISOString(),
  }

  if (status) {
    update.status = status
  }

  if (dueAt) {
    update.due_at = dueAt
  }

  if (nextStatus === 'COMPLETED') {
    update.completed_at = new Date().toISOString()
    update.completed_by = user.id
  }

  if (nextStatus === 'PENDING' || nextStatus === 'SNOOZED') {
    update.completed_at = null
    update.completed_by = null
  }

  const { data: followUp, error } = await admin
    .from('lead_follow_ups')
    .update(update)
    .eq('id', followUpId)
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (status && status !== existingFollowUp.status) {
    const activityTitles = {
      COMPLETED: 'Follow-up completed',
      SNOOZED: 'Follow-up snoozed',
      CANCELLED: 'Follow-up cancelled',
      PENDING: 'Follow-up reopened',
    }

    await admin.from('lead_activities').insert({
      organization_id: membership.organization_id,
      lead_id: existingFollowUp.lead_id,
      user_id: user.id,
      activity_type: 'FOLLOW_UP',
      title: activityTitles[status] || 'Follow-up updated',
      description: `Follow-up status changed from ${existingFollowUp.status} to ${status}.`,
      metadata: {
        follow_up_id: followUpId,
        previous_status: existingFollowUp.status,
        status,
      },
    })
  }

  return Response.json({ followUp })
}

export async function PUT(request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getMembership(supabase, user.id)

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const leadId = body.leadId

  if (!leadId) {
    return Response.json({ error: 'leadId is required' }, { status: 400 })
  }

  const { data: lead } = await admin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!lead) {
    return Response.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (lead.status === 'WON' || lead.status === 'LOST') {
    return Response.json({
      followUp: null,
      assessment: {
        follow_up_required: false,
        recommended_action: 'NONE',
        recommended_timing: 'NONE',
        reason: 'The lead is closed and does not require further follow-up.',
        suggested_message: '',
      },
    })
  }

  const { data: assistant } = await admin
    .from('assistants')
    .select('*')
    .eq('id', lead.assistant_id)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!assistant) {
    return Response.json({ error: 'Assistant not found' }, { status: 404 })
  }

  const { data: activities } = await admin
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const assessment = await assessFollowUp({
    assistant,
    lead,
    activities: activities || [],
  })

  if (
    !assessment.follow_up_required ||
    assessment.recommended_action === 'NONE' ||
    assessment.recommended_timing === 'NONE'
  ) {
    return Response.json({
      followUp: null,
      assessment,
    })
  }

  const dueAt = calculateDueAt(assessment.recommended_timing)

  if (!dueAt) {
    return Response.json({
      followUp: null,
      assessment: {
        ...assessment,
        follow_up_required: false,
        recommended_action: 'NONE',
        recommended_timing: 'NONE',
        reason: 'No valid follow-up timing was returned.',
        suggested_message: '',
      },
    })
  }

  const { data: existingFollowUp } = await admin
    .from('lead_follow_ups')
    .select('*')
    .eq('lead_id', leadId)
    .in('status', ['PENDING', 'SNOOZED'])
    .maybeSingle()

  if (existingFollowUp) {
    return Response.json({
      followUp: existingFollowUp,
      assessment,
      alreadyScheduled: true,
    })
  }

  const { data: followUp, error } = await admin
    .from('lead_follow_ups')
    .insert({
      organization_id: membership.organization_id,
      lead_id: leadId,
      user_id: user.id,
      due_at: dueAt,
      action: assessment.recommended_action,
      reason: assessment.reason,
      suggested_message: assessment.suggested_message,
      source: 'AI',
    })
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await admin.from('lead_activities').insert({
    organization_id: membership.organization_id,
    lead_id: leadId,
    user_id: user.id,
    activity_type: 'FOLLOW_UP',
    title: 'AI scheduled follow-up',
    description: `${assessment.recommended_action.replace('_', ' ')} follow-up scheduled. ${assessment.reason}`,
    metadata: {
      follow_up_id: followUp.id,
      source: 'AI',
      timing: assessment.recommended_timing,
      action: assessment.recommended_action,
    },
  })

  return Response.json({
    followUp,
    assessment,
    alreadyScheduled: false,
  }, { status: 201 })
}
