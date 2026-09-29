import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const allowedStatuses = ['NEW', 'CONTACTED', 'WON', 'LOST']

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { leadId, status } = body

    if (!leadId || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid lead ID or status' },
        { status: 400 }
      )
    }

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

    if (!membership) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 403 }
      )
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('organization_id', membership.organization_id)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', leadId)
      .eq('organization_id', membership.organization_id)

    if (error) {
      console.error(error)

      return NextResponse.json(
        { error: 'Unable to update lead' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unexpected error' },
      { status: 500 }
    )
  }
}
