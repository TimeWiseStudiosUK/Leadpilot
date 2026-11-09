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

async function logLeadActivity(admin, activity) {
  const { error } = await admin.from('lead_activities').insert(activity)
  return error ? error.message : null
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

  let latestAssessment = null

  if (leadId) {
    const { data: assessmentActivity } = await admin
      .from('lead_activities')
      .select('metadata, created_at')
      .eq('organization_id', membership.organization_id)
      .eq('lead_id', leadId)
      .eq('activity_type', 'FOLLOW_UP')
      .eq('metadata->>event_type', 'AI_ASSESSMENT')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    latestAssessment = assessmentActivity?.metadata?.assessment || null
  }

  return Response.json({ followUps: followUps || [], latestAssessment })
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

  if (Number.isNaN(Date.parse(dueAt))) {
    return Response.json({ error: "Invalid follow-up due date" }, { status: 400 })
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

  // AI recommendations should have at most one active task per lead.
  // Manual follow-ups are intentionally allowed to coexist.
  if (source === 'AI') {
    const { data: existingAiFollowUp } = await admin
      .from('lead_follow_ups')
      .select('*')
      .eq('lead_id', leadId)
      .eq('organization_id', membership.organization_id)
      .eq('source', 'AI')
      .in('status', ['PENDING', 'SNOOZED'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingAiFollowUp) {
      return Response.json({ followUp: existingAiFollowUp, alreadyScheduled: true })
    }
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
    if (source === 'AI' && error.code === '23505') {
      const { data: existingAiFollowUp } = await admin
        .from('lead_follow_ups')
        .select('*')
        .eq('lead_id', leadId)
        .eq('organization_id', membership.organization_id)
        .eq('source', 'AI')
        .in('status', ['PENDING', 'SNOOZED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingAiFollowUp) {
        return Response.json({ followUp: existingAiFollowUp, alreadyScheduled: true })
      }
    }

    return Response.json({ error: error.message }, { status: 500 })
  }

  const activityWarning = await logLeadActivity(admin, {
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
      event_type: 'FOLLOW_UP_SCHEDULED',
    },
  })

  return Response.json({ followUp, activityWarning }, { status: 201 })
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
  const action = body.action
  const reason = body.reason
  const suggestedMessage = body.suggestedMessage

  if (!followUpId) {
    return Response.json({ error: 'Follow-up id is required' }, { status: 400 })
  }

  if (status && !allowedStatuses.includes(status)) {
    return Response.json({ error: 'Invalid follow-up status' }, { status: 400 })
  }

  if (action && !allowedActions.includes(action)) {
    return Response.json({ error: 'Invalid follow-up action' }, { status: 400 })
  }

  if (dueAt && Number.isNaN(Date.parse(dueAt))) {
    return Response.json({ error: 'Invalid follow-up due date' }, { status: 400 })
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

  if (dueAt) update.due_at = dueAt
  if (action) update.action = action
  if (Object.prototype.hasOwnProperty.call(body, 'reason')) update.reason = reason || null
  if (Object.prototype.hasOwnProperty.call(body, 'suggestedMessage')) update.suggested_message = suggestedMessage || null

  if (nextStatus === 'COMPLETED') {
    // Preserve the original completion timestamp when editing an already
    // completed task. Only set it when the task first becomes completed.
    if (existingFollowUp.status !== 'COMPLETED' || !existingFollowUp.completed_at) {
      update.completed_at = new Date().toISOString()
      update.completed_by = user.id
    }
  } else {
    // Cancelled tasks are not completed. Reopening or snoozing also clears it.
    update.completed_at = null
    update.completed_by = null
  }

  const { data: followUp, error } = await admin
    .from('lead_follow_ups')
    .update(update)
    .eq('id', followUpId)
    .eq('organization_id', membership.organization_id)
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if ((status && status !== existingFollowUp.status) || dueAt || action || Object.prototype.hasOwnProperty.call(body, 'reason') || Object.prototype.hasOwnProperty.call(body, 'suggestedMessage')) {
    const activityTitles = {
      COMPLETED: 'Follow-up completed',
      SNOOZED: 'Follow-up snoozed',
      CANCELLED: 'Follow-up cancelled',
      PENDING: 'Follow-up reopened',
    }

    const activityWarning = await logLeadActivity(admin, {
      organization_id: membership.organization_id,
      lead_id: existingFollowUp.lead_id,
      user_id: user.id,
      activity_type: 'FOLLOW_UP',
      title: activityTitles[status] || 'Follow-up updated',
      description: status && status !== existingFollowUp.status
        ? `Follow-up status changed from ${existingFollowUp.status} to ${status}.`
        : 'Follow-up details updated.',
      metadata: {
        follow_up_id: followUpId,
        previous_status: existingFollowUp.status,
        status: status || existingFollowUp.status,
        due_at: dueAt || existingFollowUp.due_at,
        action: action || existingFollowUp.action,
        event_type: 'FOLLOW_UP_UPDATED',
      },
    })

    return Response.json({ followUp, activityWarning })
  }

  return Response.json({ followUp, activityWarning: null })
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
    const assessment = {
      follow_up_required: false,
      recommended_action: 'NONE',
      recommended_timing: 'NONE',
      reason: 'The lead is closed and does not require further follow-up.',
      suggested_message: '',
    }
    const activityWarning = await logLeadActivity(admin, {
      organization_id: membership.organization_id,
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'FOLLOW_UP',
      title: 'AI follow-up assessment',
      description: assessment.reason,
      metadata: { event_type: 'AI_ASSESSMENT', source: 'AI', assessment },
    })

    return Response.json({ followUp: null, assessment, activityWarning })
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

  let assessment

  try {
    assessment = await assessFollowUp({
      assistant,
      lead,
      activities: activities || [],
    })
  } catch (error) {
    console.error('[LeadPilot] AI follow-up assessment failed', {
      leadId,
      error: error instanceof Error ? error.message : error,
    })

    return Response.json(
      { error: 'The AI assessment could not be completed. Please try again.' },
      { status: 502 }
    )
  }

  if (
    !assessment.follow_up_required ||
    assessment.recommended_action === 'NONE' ||
    assessment.recommended_timing === 'NONE'
  ) {
    const activityWarning = await logLeadActivity(admin, {
      organization_id: membership.organization_id,
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'FOLLOW_UP',
      title: 'AI follow-up assessment',
      description: assessment.reason || 'AI assessment recommends no further follow-up.',
      metadata: { event_type: 'AI_ASSESSMENT', source: 'AI', assessment },
    })

    return Response.json({ followUp: null, assessment, activityWarning })
  }

  const dueAt = calculateDueAt(assessment.recommended_timing)

  if (!dueAt) {
    const normalizedAssessment = {
      ...assessment,
      follow_up_required: false,
      recommended_action: 'NONE',
      recommended_timing: 'NONE',
      reason: 'No valid follow-up timing was returned.',
      suggested_message: '',
    }
    const activityWarning = await logLeadActivity(admin, {
      organization_id: membership.organization_id,
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'FOLLOW_UP',
      title: 'AI follow-up assessment',
      description: normalizedAssessment.reason,
      metadata: { event_type: 'AI_ASSESSMENT', source: 'AI', assessment: normalizedAssessment },
    })

    return Response.json({ followUp: null, assessment: normalizedAssessment, activityWarning })
  }

  const { data: existingFollowUp } = await admin
    .from('lead_follow_ups')
    .select('*')
    .eq('lead_id', leadId)
    .eq('organization_id', membership.organization_id)
    .eq('source', 'AI')
    .in('status', ['PENDING', 'SNOOZED'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingFollowUp) {
    const activityWarning = await logLeadActivity(admin, {
      organization_id: membership.organization_id,
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'FOLLOW_UP',
      title: 'AI follow-up assessment',
      description: assessment.reason || 'AI assessment completed.',
      metadata: {
        event_type: 'AI_ASSESSMENT',
        source: 'AI',
        assessment,
        follow_up_id: existingFollowUp.id,
      },
    })

    return Response.json({ followUp: existingFollowUp, assessment, alreadyScheduled: true, activityWarning })
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
    if (error.code === '23505') {
      const { data: existingAiFollowUp } = await admin
        .from('lead_follow_ups')
        .select('*')
        .eq('lead_id', leadId)
        .eq('organization_id', membership.organization_id)
        .eq('source', 'AI')
        .in('status', ['PENDING', 'SNOOZED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingAiFollowUp) {
        return Response.json({
          followUp: existingAiFollowUp,
          assessment,
          alreadyScheduled: true,
        })
      }
    }

    return Response.json({ error: error.message }, { status: 500 })
  }

  const assessmentWarning = await logLeadActivity(admin, {
    organization_id: membership.organization_id,
    lead_id: leadId,
    user_id: user.id,
    activity_type: 'FOLLOW_UP',
    title: 'AI follow-up assessment',
    description: assessment.reason || 'AI assessment completed.',
    metadata: {
      event_type: 'AI_ASSESSMENT',
      source: 'AI',
      assessment,
      follow_up_id: followUp.id,
    },
  })
  const schedulingWarning = await logLeadActivity(admin, {
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
      event_type: 'AI_FOLLOW_UP_SCHEDULED',
    },
  })
  const activityWarning = [assessmentWarning, schedulingWarning].filter(Boolean).join(' ' ) || null

  return Response.json({
    followUp,
    assessment,
    alreadyScheduled: false,
    activityWarning,
  }, { status: 201 })
}
