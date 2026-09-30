import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

async function getMembership(supabase, userId) {
  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .limit(1)

  return {
    membership: memberships?.[0],
    error,
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, status } = body

    if (!['archive', 'restore', 'status'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const { membership, error: membershipError } =
      await getMembership(supabase, user.id)

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 400 }
      )
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      )
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage leads' },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    if (action === 'status') {
      if (!['NEW', 'CONTACTED', 'WON', 'LOST'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid lead status' },
          { status: 400 }
        )
      }

      const updateData = {
        status,
      }

      if (status === 'CONTACTED') {
        updateData.last_contacted_at = new Date().toISOString()
      }

      const { error } = await admin
        .from('leads')
        .update(updateData)
        .eq('id', id)
        .eq('organization_id', membership.organization_id)

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        action: 'status',
        status,
      })
    }

    const { error } = await admin
      .from('leads')
      .update({
        archived_at:
          action === 'archive'
            ? new Date().toISOString()
            : null,
      })
      .eq('id', id)
      .eq('organization_id', membership.organization_id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { id } = await params

    const { membership, error: membershipError } =
      await getMembership(supabase, user.id)

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 400 }
      )
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      )
    }

    if (membership.role !== 'owner') {
      return NextResponse.json(
        {
          error:
            'Only the account owner can permanently delete leads',
        },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    const { error } = await admin
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('organization_id', membership.organization_id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      action: 'delete',
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
