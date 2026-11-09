import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { assessLead } from '../../../lib/ai'
import { evaluateQualification } from '../../../lib/qualification'


export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: assistant, error: assistantError } = await admin
      .from('assistants')
      .select('qualification_settings')
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (assistantError || !assistant) {
      return NextResponse.json({ error: 'No active assistant found' }, { status: 400 })
    }

    const settings = assistant.qualification_settings || {}

    return NextResponse.json({
      qualificationSettings: {
        requiredFields: ['name', 'contact', 'enquiry'],
        enabledFields: ['name', 'contact', 'enquiry'],
        customFields: Array.isArray(settings.customFields)
          ? settings.customFields
          : [],
      },
    })
  } catch (error) {
    console.error('Unable to load lead qualification settings:', error)
    return NextResponse.json({ error: 'Unable to load qualification settings' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()

    const {
      name,
      email,
      phone,
      location,
      service,
      timescale,
      budget,
      quantity,
      enquiry,
      customFields,
      notes,
      score,
      status,
    } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const allowedScores = ['HOT', 'WARM']
    const allowedStatuses = ['NEW', 'CONTACTED', 'WON', 'LOST']

    const safeScore = allowedScores.includes(score) ? score : null
    const safeStatus = allowedStatuses.includes(status) ? status : 'NEW'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorised' },
        { status: 401 }
      )
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()
    const { data: assistant } = await admin
      .from('assistants')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (!assistant) {
      return NextResponse.json(
        { error: 'No active assistant found' },
        { status: 400 }
      )
    }

    const settings = assistant.qualification_settings || {}
    const submittedCustomFields =
      customFields &&
      typeof customFields === 'object' &&
      !Array.isArray(customFields)
        ? customFields
        : {}

    if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json(
        { error: 'A phone number or email address is required' },
        { status: 400 }
      )
    }

    if (!enquiry?.trim()) {
      return NextResponse.json(
        { error: 'Enquiry details are required' },
        { status: 400 }
      )
    }

    const customDefinitions = Array.isArray(settings.customFields)
      ? settings.customFields
      : []

    for (const field of customDefinitions) {
      if (
        field?.required &&
        field.key &&
        !String(submittedCustomFields[field.key] ?? '').trim()
      ) {
        return NextResponse.json(
          { error: `${field.label || field.key} is required` },
          { status: 400 }
        )
      }
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        organization_id: membership.organization_id,
        assistant_id: assistant.id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        location: location?.trim() || null,
        service: service?.trim() || null,
        timescale: timescale?.trim() || null,
        budget: budget?.trim() || null,
        quantity: quantity?.trim() || null,
        enquiry: enquiry?.trim() || null,
        custom_fields:
          customFields && typeof customFields === 'object' && !Array.isArray(customFields)
            ? customFields
            : {},
        notes: notes?.trim() || null,
        score: safeScore,
        status: safeStatus,
        source: 'MANUAL',
      })
      .select('*')
      .single()

    if (error) {
      console.error(error)

      return NextResponse.json(
        { error: 'Unable to create lead' },
        { status: 500 }
      )
    }

    await admin
      .from('lead_activities')
      .insert({
        organization_id: membership.organization_id,
        lead_id: lead.id,
        user_id: user.id,
        activity_type: 'CREATED',
        title: 'Lead created',
        description: 'Lead created manually in LeadPilot.',
        metadata: { source: 'MANUAL' },
      })

    let assessedLead = lead

    try {
      const assessment = await assessLead({
        assistant,
        lead,
      })

      const qualificationSettings =
        assistant.qualification_settings || {}

      const qualificationResult = evaluateQualification({
        qualificationSettings,
        lead,
      })

      const qualificationComplete =
        qualificationResult.qualificationComplete

      const readyToContact =
        safeStatus === 'NEW' &&
        qualificationResult.readyToContact

      const updateData = {
        score: assessment.lead.score || null,
        summary: assessment.lead.summary || null,
        ready_to_contact: readyToContact,
      }

      const { data: updatedLead, error: assessmentError } = await admin
        .from('leads')
        .update(updateData)
        .eq('id', lead.id)
        .eq('organization_id', membership.organization_id)
        .select('*')
        .single()

      if (assessmentError) {
        console.error('AI assessment save failed:', assessmentError)
      } else if (updatedLead) {
        assessedLead = updatedLead

        await admin
          .from('lead_activities')
          .insert({
            organization_id: membership.organization_id,
            lead_id: lead.id,
            user_id: user.id,
            activity_type: 'AI_ASSESSED',
            title: 'AI assessed lead',
            description: `AI assessed this lead as ${updatedLead.score || 'Unscored'} and marked it ${updatedLead.ready_to_contact ? 'ready to contact' : 'not yet ready to contact'}.`,
            metadata: {
              score: updatedLead.score,
              ready_to_contact: updatedLead.ready_to_contact,
              qualification_complete: qualificationComplete,
            },
          })
      }
    } catch (assessmentError) {
      console.error('AI lead assessment failed:', assessmentError)
    }

    return NextResponse.json(
      {
        success: true,
        lead: assessedLead,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unexpected error' },
      { status: 500 }
    )
  }
}
