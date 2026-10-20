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
  const { data: activities, error } = await admin
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: conversations, error: conversationsError } = await admin
    .from("conversations")
    .select("id, created_at")
    .eq("lead_id", leadId)
    .eq("organization_id", membership.organization_id)

  if (conversationsError) {
    return NextResponse.json({ error: conversationsError.message }, { status: 500 })
  }

  const conversationIds = (conversations || []).map(conversation => conversation.id)
  let conversationActivities = []

  if (conversationIds.length > 0) {
    const { data: messages, error: messagesError } = await admin
      .from("messages")
      .select("conversation_id, role")
      .in("conversation_id", conversationIds)

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 })
    }

    const messageCounts = new Map()

    for (const message of messages || []) {
      messageCounts.set(
        message.conversation_id,
        (messageCounts.get(message.conversation_id) || 0) + 1
      )
    }

    conversationActivities = (conversations || [])
      .filter(conversation => messageCounts.has(conversation.id))
      .map(conversation => ({
        id: `conversation-${conversation.id}`,
        activity_type: "AI_CONVERSATION",
        title: "AI conversation",
        description: `${messageCounts.get(conversation.id)} messages exchanged with the AI assistant.`,
        created_at: conversation.created_at,
      }))
  }

  const combinedActivities = [
    ...(activities || []),
    ...conversationActivities,
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return NextResponse.json({ activities: combinedActivities })
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
