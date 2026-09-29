import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    lead: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: ['string','null'] },
        email: { type: ['string','null'] },
        phone: { type: ['string','null'] },
        postcode: { type: ['string','null'] },
        service: { type: ['string','null'] },
        property_type: { type: ['string','null'] },
        timescale: { type: ['string','null'] },
        enquiry: { type: ['string','null'] },
        summary: { type: 'string' },
        score: { type: 'string', enum: ['HOT','WARM','COLD'] },
        ready_to_contact: { type: 'boolean' }
      },
      required: ['name','email','phone','postcode','service','property_type','timescale','enquiry','summary','score','ready_to_contact']
    }
  },
  required: ['reply','lead']
}

export async function runLeadPilot({ assistant, history, message }) {
  const instructions = `You are ${assistant.name}, the AI sales assistant for this business.
Business description: ${assistant.business_description || 'Not supplied'}
Services: ${(assistant.services || []).join(', ') || 'Not supplied'}
Areas covered: ${(assistant.areas || []).join(', ') || 'Not supplied'}
Tone: ${assistant.tone}
Qualification rules: ${assistant.qualification_rules || 'Qualify politely and collect enough information for a human to follow up.'}

Your job is to help the customer, qualify genuine enquiries and capture useful sales information. Never invent prices, availability, guarantees, qualifications or services. If something is unknown, say a team member can confirm it.
Ask natural follow-up questions rather than interrogating the customer. Do not ask for information already provided.
A HOT lead is a clear commercial opportunity that is ready for contact or has an urgent/high-value need. WARM means genuine interest but missing timing/details. COLD means vague, informational or low-intent.
Return a helpful customer-facing reply and the current structured lead state.`

  const input = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ]

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    instructions,
    input,
    store: false,
    text: { format: { type: 'json_schema', name: 'leadpilot_turn', strict: true, schema } }
  })

  return JSON.parse(response.output_text)
}
