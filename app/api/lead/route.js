import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function PATCH(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { id, status } = await request.json()
  const { error } = await supabase.from('leads').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
