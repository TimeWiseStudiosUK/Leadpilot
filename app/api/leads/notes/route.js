import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
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

    const { data: notes, error } = await supabase
      .from('lead_notes')
      .select('id, note, created_at, user_id')
      .eq('lead_id', leadId)
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return NextResponse.json(
        { error: 'Unable to load notes' },
        { status: 500 }
      )
    }

    return NextResponse.json({ notes: notes || [] })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unexpected error' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { leadId, note } = body

    if (!leadId || typeof note !== 'string' || !note.trim()) {
      return NextResponse.json(
        { error: 'Lead ID and note are required' },
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

    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('organization_id', membership.organization_id)
      .maybeSingle()

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    const { data: newNote, error } = await supabase
      .from('lead_notes')
      .insert({
        organization_id: membership.organization_id,
        lead_id: leadId,
        user_id: user.id,
        note: note.trim(),
      })
      .select('id, note, created_at, user_id')
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json(
        { error: 'Unable to save note' },
        { status: 500 }
      )
    }

    return NextResponse.json({ note: newNote })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unexpected error' },
      { status: 500 }
    )
  }
}
