import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const form = await request.json()
  if (!form.name?.trim()) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  const admin = createAdminClient()
  const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2,7)
  const { data: org, error: orgError } = await admin.from('organizations').insert({ name: form.name.trim(), slug, industry: form.industry?.trim() }).select().single()
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 400 })
  const { error: memberError } = await admin.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role: 'owner' })
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 })
  const { data: assistant, error: assistantError } = await admin.from('assistants').insert({
    organization_id: org.id, public_slug: slug, name: 'AI Sales Assistant', greeting: form.greeting,
    business_description: form.businessDescription?.trim() || `${form.name} is a ${form.industry || 'business'}.`,
    services: (form.services || '').split('\n').map(x=>x.trim()).filter(Boolean),
    areas: (form.areas || '').split('\n').map(x=>x.trim()).filter(Boolean),
    qualification_rules: form.rules || '',
    qualification_settings: form.qualificationSettings || {
      requiredFields: ['name', 'contact', 'service', 'enquiry'],
      hotCriteria: '',
      warmCriteria: '',
      readyCriteria: '',
      additionalInformation: '',
    },
    tone: form.tone || 'friendly, professional and concise'
  }).select().single()
  if (assistantError) return NextResponse.json({ error: assistantError.message }, { status: 400 })
  return NextResponse.json({ organization: org, assistant })
}
