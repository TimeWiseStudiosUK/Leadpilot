import { NextResponse } from "next/server"
import { createClient } from "../../../../lib/supabase/server"
import { createAdminClient } from "../../../../lib/supabase/admin"

const allowedTypes = ["CREATED", "STATUS_CHANGED", "NOTE_ADDED", "CALL", "EMAIL", "FOLLOW_UP"]

async function getMembership(supabase, userId) {
  const { data, error } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", userId).limit(1).maybeSingle()
  if (error) return null
  return data
}

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const leadId = new URL(request.url).searchParams.get("leadId")
  if (leadId == null) return NextResponse.json({ error: "Lead ID is required" }, { status: 400 })
  const membership = await getMembership(supabase, user.id)
  if (membership == null) return NextResponse.json({ error: "Organization membership not found" }, { status: 403 })
  const admin = createAdminClient()
  const { data: lead, error: leadError } = await admin.from("leads").select("id, organization_id").eq("id", leadId).eq("organization_id", membership.organization_id).single()
  if (leadError || lead == null) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  const { data: activities, error } = await admin.from("lead_activities").select("*").eq("lead_id", leadId).eq("organization_id", membership.organization_id).order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: activities || [] })
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const { leadId, activityType, title, description, metadata } = body
  if (leadId == null || activityType == null || title == null) return NextResponse.json({ error: "Lead ID, activity type and title are required" }, { status: 400 })
  if (allowedTypes.includes(activityType) == false) return NextResponse.json({ error: "Invalid activity type" }, { status: 400 })
  const membership = await getMembership(supabase, user.id)
  if (membership == null) return NextResponse.json({ error: "Organization membership not found" }, { status: 403 })
  const admin = createAdminClient()
  const { data: lead, error: leadError } = await admin.from("leads").select("id, organization_id").eq("id", leadId).eq("organization_id", membership.organization_id).single()
  if (leadError || lead == null) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  const { data: activity, error } = await admin.from("lead_activities").insert({ organization_id: membership.organization_id, lead_id: leadId, user_id: user.id, activity_type: activityType, title, description: description || null, metadata: metadata || {} }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity }, { status: 201 })
}
