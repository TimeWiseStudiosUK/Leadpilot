import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { assessLead } from '../../../../lib/ai'
import { evaluateQualification } from '../../../../lib/qualification'

const meaningfulFields = [
  'name',
  'email',
  'phone',
  'location',
  'service',
  'timescale',
  'budget',
  'quantity',
  'enquiry',
  'custom_fields',
]

function normalise(value) {
  return value == null ? '' : String(value).trim()
}

export async function GET(request, { params }) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return Response.json({ error: 'No organization found' }, { status: 403 })
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (error) {
    console.error('Get lead error:', error)
    return Response.json({ error: 'Unable to load lead' }, { status: 500 })
  }

  if (!lead) {
    return Response.json({ error: 'Lead not found' }, { status: 404 })
  }

  let qualificationSettings = {}

  if (lead.assistant_id) {
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('qualification_settings')
      .eq('id', lead.assistant_id)
      .eq('organization_id', membership.organization_id)
      .maybeSingle()

    if (assistantError) {
      console.error('Load qualification settings error:', assistantError)
    }

    qualificationSettings = assistant?.qualification_settings || {}
  }

  return Response.json({
    lead,
    qualificationSettings,
  })
}

export async function PATCH(request, { params }) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return Response.json({ error: 'No organization found' }, { status: 403 })
  }

  const allowedRoles = ['owner', 'admin']

  if (!allowedRoles.includes(membership.role)) {
    return Response.json(
      { error: 'You do not have permission to edit this lead' },
      { status: 403 }
    )
  }

  const admin = createAdminClient()

  const { data: existingLead, error: existingError } = await admin
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (existingError) {
    console.error('Load lead error:', existingError)
    return Response.json({ error: 'Unable to load lead' }, { status: 500 })
  }

  if (!existingLead) {
    return Response.json({ error: 'Lead not found' }, { status: 404 })
  }

  let body

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const action = body.action

  if (action === 'edit') {
    const name = normalise(Object.prototype.hasOwnProperty.call(body, 'name') ? body.name : existingLead.name)
    const email = normalise(Object.prototype.hasOwnProperty.call(body, 'email') ? body.email : existingLead.email)
    const phone = normalise(Object.prototype.hasOwnProperty.call(body, 'phone') ? body.phone : existingLead.phone)
    const enquiry = normalise(Object.prototype.hasOwnProperty.call(body, 'enquiry') ? body.enquiry : existingLead.enquiry)

    if (!name) {
      return Response.json(
        { error: 'Lead name is required' },
        { status: 400 }
      )
    }

    if (!email && !phone) {
      return Response.json(
        { error: 'A phone number or email address is required' },
        { status: 400 }
      )
    }

    if (!enquiry) {
      return Response.json(
        { error: 'Enquiry details are required' },
        { status: 400 }
      )
    }

    const {
      data: assistantForValidation,
      error: assistantSettingsError,
    } = await admin
      .from("assistants")
      .select("qualification_settings")
      .eq("id", existingLead.assistant_id)
      .eq("organization_id", membership.organization_id)
      .maybeSingle()

    if (assistantSettingsError || !assistantForValidation) {
      console.error("Unable to load assistant qualification settings:", assistantSettingsError)
      return Response.json(
        { error: "Unable to load qualification settings. Please try again." },
        { status: 500 }
      )
    }

    const settings = assistantForValidation.qualification_settings || {}
    const standardValues = {
      location: normalise(Object.prototype.hasOwnProperty.call(body, 'location') ? body.location : existingLead.location),
      service: normalise(Object.prototype.hasOwnProperty.call(body, 'service') ? body.service : existingLead.service),
      timescale: normalise(Object.prototype.hasOwnProperty.call(body, 'timescale') ? body.timescale : existingLead.timescale),
      budget: normalise(Object.prototype.hasOwnProperty.call(body, 'budget') ? body.budget : existingLead.budget),
      quantity: normalise(Object.prototype.hasOwnProperty.call(body, 'quantity') ? body.quantity : existingLead.quantity),
    }

    const submittedCustomFields =
      body.customFields &&
      typeof body.customFields === 'object' &&
      !Array.isArray(body.customFields)
        ? body.customFields
        : {}

    const existingCustomFields =
      existingLead.custom_fields &&
      typeof existingLead.custom_fields === 'object' &&
      !Array.isArray(existingLead.custom_fields)
        ? existingLead.custom_fields
        : {}

    const mergedCustomFields = {
      ...existingCustomFields,
      ...submittedCustomFields,
    }

    const customDefinitions = Array.isArray(settings.customFields)
      ? settings.customFields
      : []

    for (const field of customDefinitions) {
      if (
        field?.required &&
        field.key &&
        !normalise(mergedCustomFields[field.key])
      ) {
        return Response.json(
          { error: `${field.label || field.key} is required` },
          { status: 400 }
        )
      }
    }

    const updatedFields = {
      name,
      email: email || null,
      phone: phone || null,
      location: standardValues.location || null,
      service: standardValues.service || null,
      timescale: standardValues.timescale || null,
      budget: standardValues.budget || null,
      quantity: standardValues.quantity || null,
      enquiry: enquiry || null,
      custom_fields: mergedCustomFields,
    }

    const changedFields = meaningfulFields.filter(field => {
      if (field === 'custom_fields') {
        const sortKeys = value =>
          Object.fromEntries(
            Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b))
          )

        return JSON.stringify(sortKeys(existingLead.custom_fields)) !==
          JSON.stringify(sortKeys(updatedFields.custom_fields))
      }

      return normalise(existingLead[field]) !== normalise(updatedFields[field])
    })

    const { data: updatedLead, error: updateError } = await admin
      .from('leads')
      .update(updatedFields)
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Update lead error:', updateError)
      return Response.json(
        { error: 'Unable to update lead' },
        { status: 500 }
      )
    }

    if (changedFields.length === 0) {
      return Response.json({
        lead: updatedLead,
        reassessed: false,
      })
    }

    const { data: assistant } = await admin
      .from('assistants')
      .select('*')
      .eq('id', updatedLead.assistant_id)
      .eq('organization_id', membership.organization_id)
      .maybeSingle()

    if (!assistant) {
      return Response.json({
        lead: updatedLead,
        reassessed: false,
      })
    }

    try {
      const assessment = await assessLead({
        assistant,
        lead: updatedLead,
      })

      const qualificationSettings =
        assistant.qualification_settings || {}

      const qualificationResult = evaluateQualification({
      qualificationSettings,
      lead: updatedLead,
    })

    const readyToContact =
      updatedLead.status === 'NEW' &&
      qualificationResult.readyToContact

      const { data: assessedLead, error: assessmentUpdateError } =
        await admin
          .from('leads')
          .update({
            score: assessment.lead.score || null,
            summary: assessment.lead.summary || null,
            ready_to_contact: readyToContact,
          })
          .eq('id', updatedLead.id)
          .eq('organization_id', membership.organization_id)
          .select('*')
          .single()

      if (assessmentUpdateError) {
        console.error(
          'Assessment update error:',
          assessmentUpdateError
        )

        return Response.json({
          lead: updatedLead,
          reassessed: false,
        })
      }

      await admin.from('lead_activities').insert({
        organization_id: membership.organization_id,
        lead_id: updatedLead.id,
        user_id: user.id,
        activity_type: 'AI_ASSESSED',
        title: 'AI reassessment',
        description: `Lead reassessed after changes to ${changedFields.map(field => ({
          name: 'Name',
          email: 'Email',
          phone: 'Phone',
          location: 'Location',
          service: 'Service or product',
          timescale: 'Timescale',
          budget: 'Budget',
          quantity: 'Quantity',
          enquiry: 'Enquiry details',
          custom_fields: 'Additional information',
        }[field] || field)).join(', ')}. Score: ${assessedLead.score || 'Unscored'}. Ready to contact: ${assessedLead.ready_to_contact ? 'Yes' : 'No'}.`,
        metadata: {
          trigger: 'LEAD_EDIT',
          changed_fields: changedFields,
          score: assessedLead.score,
          ready_to_contact: assessedLead.ready_to_contact,
        },
      })

      return Response.json({
        lead: assessedLead,
        reassessed: true,
      })
    } catch (assessmentError) {
      console.error('AI reassessment error:', assessmentError)

      return Response.json({
        lead: updatedLead,
        reassessed: false,
      })
    }
  }

  if (action === 'status') {
    const allowedStatuses = ['NEW', 'CONTACTED', 'WON', 'LOST']

    if (!allowedStatuses.includes(body.status)) {
      return Response.json(
        { error: 'Invalid lead status' },
        { status: 400 }
      )
    }

    const newStatus = body.status
    const readyToContact =
      newStatus === 'NEW' ? existingLead.ready_to_contact : false

    const { data: updatedLead, error } = await admin
      .from('leads')
      .update({
        status: newStatus,
        ready_to_contact: readyToContact,
      })
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .select('*')
      .single()

    if (error) {
      console.error('Status update error:', error)
      return Response.json(
        { error: 'Unable to update lead status' },
        { status: 500 }
      )
    }

    if (existingLead.status !== newStatus) {
      await admin.from('lead_activities').insert({
        organization_id: membership.organization_id,
        lead_id: id,
        user_id: user.id,
        activity_type: 'STATUS_CHANGED',
        title: 'Status changed',
        description: `${existingLead.status || 'NEW'} → ${newStatus}`,
        metadata: {
          from: existingLead.status || 'NEW',
          to: newStatus,
        },
      })
    }

    return Response.json({ lead: updatedLead })
  }

  if (action === 'archive') {
    const { data: updatedLead, error } = await admin
      .from('leads')
      .update({
        archived_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .select('*')
      .single()

    if (error) {
      console.error('Archive error:', error)
      return Response.json(
        { error: 'Unable to archive lead' },
        { status: 500 }
      )
    }

    return Response.json({ lead: updatedLead })
  }

  if (action === 'restore') {
    const { data: updatedLead, error } = await admin
      .from('leads')
      .update({
        archived_at: null,
      })
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .select('*')
      .single()

    if (error) {
      console.error('Restore error:', error)
      return Response.json(
        { error: 'Unable to restore lead' },
        { status: 500 }
      )
    }

    return Response.json({ lead: updatedLead })
  }

  return Response.json(
    { error: 'Invalid action' },
    { status: 400 }
  )
}

export async function DELETE(request, { params }) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return Response.json({ error: 'No organization found' }, { status: 403 })
  }

  if (membership.role !== 'owner') {
    return Response.json(
      { error: 'Only the owner can permanently delete a lead' },
      { status: 403 }
    )
  }

  const admin = createAdminClient()

  const { data: lead } = await admin
    .from('leads')
    .select('id')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!lead) {
    return Response.json({ error: 'Lead not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('organization_id', membership.organization_id)

  if (error) {
    console.error('Delete lead error:', error)
    return Response.json(
      { error: 'Unable to delete lead' },
      { status: 500 }
    )
  }

  return Response.json({ success: true })
}
