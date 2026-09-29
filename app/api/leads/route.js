import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(request) {
  try {
    const body = await request.json()

    const {
      name,
      email,
      phone,
      postcode,
      service,
      propertyType,
      timescale,
      enquiry,
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

    const allowedScores = ['HOT', 'WARM', 'COLD']
    const allowedStatuses = ['NEW', 'CONTACTED', 'WON', 'LOST']

    const safeScore = allowedScores.includes(score) ? score : 'COLD'
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

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const { data: assistant } = await supabase
      .from('assistants')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (!assistant) {
      return NextResponse.json({ error: 'No active assistant found' }, { status: 400 })
    }


    if (!membership) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 403 }
      )
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        organization_id: membership.organization_id,
            assistant_id: assistant.id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        postcode: postcode?.trim() || null,
        service: service?.trim() || null,
        property_type: propertyType?.trim() || null,
        timescale: timescale?.trim() || null,
        enquiry: enquiry?.trim() || null,
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

    return NextResponse.json(
      { success: true, lead },
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
