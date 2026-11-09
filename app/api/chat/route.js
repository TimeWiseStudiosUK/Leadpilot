import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { runLeadPilot } from '../../../lib/ai'
import { evaluateQualification } from '../../../lib/qualification'

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug) return NextResponse.json({error:'Missing slug'}, {status:400})
  const admin=createAdminClient(); const {data,error}=await admin.from('assistants').select('name,greeting,active,public_slug').eq('public_slug',slug).eq('active',true).single()
  if(error||!data) return NextResponse.json({error:'Assistant not found'},{status:404})
  return NextResponse.json(data)
}

export async function POST(request) {
  try {
    const {slug,sessionId,message}=await request.json()
    if(!slug||!sessionId||!message?.trim()) return NextResponse.json({error:'Missing chat details'},{status:400})
    const admin=createAdminClient()
    const {data:assistant,error:ae}=await admin.from('assistants').select('*').eq('public_slug',slug).eq('active',true).single()
    if(ae||!assistant) return NextResponse.json({error:'Assistant not found'},{status:404})
    let {data:conversation}=await admin.from('conversations').select('*').eq('assistant_id',assistant.id).eq('session_id',sessionId).maybeSingle()
    if(!conversation){const r=await admin.from('conversations').insert({organization_id:assistant.organization_id,assistant_id:assistant.id,session_id:sessionId}).select().single();if(r.error)throw r.error;conversation=r.data}
    const {data:previous}=await admin.from('messages').select('role,content').eq('conversation_id',conversation.id).order('created_at',{ascending:true}).limit(30)
    const result=await runLeadPilot({assistant,history:previous||[],message:message.trim()})
    const ins=await admin.from('messages').insert([{conversation_id:conversation.id,role:'user',content:message.trim()},{conversation_id:conversation.id,role:'assistant',content:result.reply}]); if(ins.error)throw ins.error
    const lead=result.lead
    const hasCustomFieldData = Array.isArray(lead.custom_fields)
      ? lead.custom_fields.some(field =>
          field?.key && field?.value != null && String(field.value).trim() !== ''
        )
      : Boolean(
          lead.custom_fields &&
          typeof lead.custom_fields === 'object' &&
          Object.values(lead.custom_fields).some(
            value => value != null && String(value).trim() !== ''
          )
        )

    if(lead.name||lead.email||lead.phone||lead.service||lead.timescale||lead.enquiry||lead.location||lead.budget||lead.quantity||hasCustomFieldData){
      let existingLead=null

      if(conversation.lead_id){
        const existing=await admin
          .from('leads')
          .select('*')
          .eq('id',conversation.lead_id)
          .eq('organization_id',assistant.organization_id)
          .single()

        if(existing.error)throw existing.error
        existingLead=existing.data
      }

      const keepExisting = value =>
        value != null && String(value).trim() !== '' ? value : null

      const name = keepExisting(lead.name) ?? existingLead?.name ?? null
      const email = keepExisting(lead.email) ?? existingLead?.email ?? null
      const phone = keepExisting(lead.phone) ?? existingLead?.phone ?? null
      const location = keepExisting(lead.location) ?? existingLead?.location ?? null
      const service = keepExisting(lead.service) ?? existingLead?.service ?? null
      const timescale = keepExisting(lead.timescale) ?? existingLead?.timescale ?? null
      const budget = keepExisting(lead.budget) ?? existingLead?.budget ?? null
      const quantity = keepExisting(lead.quantity) ?? existingLead?.quantity ?? null
      const enquiry = keepExisting(lead.enquiry) ?? existingLead?.enquiry ?? null

      const existingCustomFields =
        existingLead?.custom_fields &&
        typeof existingLead.custom_fields === 'object' &&
        !Array.isArray(existingLead.custom_fields)
          ? existingLead.custom_fields
          : {}

      const incomingCustomFields = Array.isArray(lead.custom_fields)
        ? lead.custom_fields.reduce((acc, field) => {
            if (
              field?.key &&
              field?.value != null &&
              String(field.value).trim() !== ''
            ) {
              acc[field.key] = field.value
            }
            return acc
          }, {})
        : lead.custom_fields &&
          typeof lead.custom_fields === 'object' &&
          !Array.isArray(lead.custom_fields)
        ? Object.fromEntries(
            Object.entries(lead.custom_fields).filter(
              ([key, value]) =>
                key && value != null && String(value).trim() !== ''
            )
          )
        : {}

      const customFields = {
        ...existingCustomFields,
        ...incomingCustomFields,
      }

      const qualificationSettings = assistant.qualification_settings || {}

      const qualificationResult = evaluateQualification({
        qualificationSettings,
        lead: {
          name,
          email,
          phone,
          service,
          enquiry,
          location,
          timescale,
          budget,
          quantity,
          custom_fields: customFields,
        },
      })

      const qualificationComplete = qualificationResult.qualificationComplete

      const payload={
        organization_id:assistant.organization_id,
        assistant_id:assistant.id,
        name,
        email,
        phone,
        location,
        service,
        timescale,
        budget,
        quantity,
        enquiry,
        custom_fields:customFields,
        summary:lead.summary || existingLead?.summary || null,
        score:lead.score ?? existingLead?.score ?? null,
        ready_to_contact:(existingLead?.status || 'NEW') === 'NEW' && qualificationResult.readyToContact
      }

      if(conversation.lead_id){
        const r=await admin
          .from('leads')
          .update(payload)
          .eq('id',conversation.lead_id)
          .eq('organization_id',assistant.organization_id)

        if(r.error)throw r.error
      } else {
        const r=await admin
          .from('leads')
          .insert(payload)
          .select('id')
          .single()

        if(r.error)throw r.error

        await admin
          .from('conversations')
          .update({lead_id:r.data.id})
          .eq('id',conversation.id)
      }
    }
    return NextResponse.json({reply:result.reply,lead:result.lead})
  } catch(e){console.error(e);return NextResponse.json({error:e.message||'AI request failed'},{status:500})}
}
