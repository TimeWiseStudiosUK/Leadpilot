import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'

export async function PATCH(request) {
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

    const form = await request.json()

    if (!form.name?.trim()) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      )
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)

    if (membershipError) {
      console.error(membershipError)

      return NextResponse.json(
        { error: membershipError.message },
        { status: 400 }
      )
    }

    const membership = memberships?.[0]

    if (!membership) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      )
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to change settings' },
        { status: 403 }
      )
    }

    const { data: assistants, error: assistantLookupError } = await supabase
      .from('assistants')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .limit(1)

    if (assistantLookupError) {
      console.error(assistantLookupError)

      return NextResponse.json(
        { error: assistantLookupError.message },
        { status: 400 }
      )
    }

    const assistant = assistants?.[0]

    if (!assistant) {
      return NextResponse.json(
        { error: 'No active assistant found' },
        { status: 404 }
      )
    }

    const admin = createAdminClient()

    const { error: organisationError } = await admin
      .from('organizations')
      .update({
        name: form.name.trim(),
        industry: form.industry?.trim() || null,
      })
      .eq('id', membership.organization_id)

    if (organisationError) {
      console.error(organisationError)

      return NextResponse.json(
        { error: organisationError.message },
        { status: 400 }
      )
    }

    const { error: updateError } = await admin
      .from('assistants')
      .update({
        greeting:
          form.greeting?.trim() ||
          'Hi, how can I help today?',

        business_description:
          form.businessDescription?.trim() || '',

        services: (form.services || '')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),

        areas: (form.areas || '')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),

        qualification_rules:
          form.rules?.trim() || '',

        tone:
          form.tone?.trim() ||
          'friendly, professional and concise',
      })
      .eq('id', assistant.id)

    if (updateError) {
      console.error(updateError)

      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Something went wrong while saving settings' },
      { status: 500 }
    )
  }
}
