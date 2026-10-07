import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { suggestQualificationTraining } from '../../../../lib/ai'

export async function POST(request) {
  try {
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

    const body = await request.json()

    const admin = createAdminClient()

    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 400 }
      )
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not have permission to train this AI employee.' },
        { status: 403 }
      )
    }

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .select('id, name, industry')
      .eq('id', membership.organization_id)
      .single()

    if (organizationError) {
      return NextResponse.json(
        { error: organizationError.message },
        { status: 400 }
      )
    }

    const { data: assistant, error: assistantError } = await admin
      .from('assistants')
      .select(
        'id, organization_id, business_description, services, areas, qualification_settings'
      )
      .eq('organization_id', organization.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (assistantError) {
      return NextResponse.json(
        { error: assistantError.message },
        { status: 400 }
      )
    }

    if (!assistant) {
      return NextResponse.json(
        { error: 'No active AI employee found.' },
        { status: 404 }
      )
    }

    const qualification = assistant.qualification_settings || {}

    const suggestions = await suggestQualificationTraining({
      businessName: body.businessName?.trim() || '',
      industry: body.industry?.trim() || '',
      businessDescription: body.businessDescription?.trim() || '',
      services: body.services?.trim() || '',
      areas: body.areas?.trim() || '',
      additionalInformation: body.additionalInformation?.trim() || '',
      hotCriteria: body.hotCriteria?.trim() || '',
      warmCriteria: body.warmCriteria?.trim() || '',
    })

    return NextResponse.json({
      suggestions,
    })
  } catch (error) {
    console.error('Training suggestion error:', error)

    return NextResponse.json(
      { error: error.message || 'Unable to generate training suggestions.' },
      { status: 500 }
    )
  }
}
