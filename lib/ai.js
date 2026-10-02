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
        score: { type: ['string', 'null'], enum: ['HOT','WARM', null] },
        qualification_complete: { type: 'boolean' },
        missing_information: {
          type: 'array',
          items: { type: 'string' }
        },
        ready_to_contact: { type: 'boolean' }
      },
      required: ['name','email','phone','postcode','service','property_type','timescale','enquiry','summary','score','qualification_complete','missing_information','ready_to_contact']
    }
  },
  required: ['reply','lead']
}

export async function runLeadPilot({ assistant, history, message }) {
  const qualification = assistant.qualification_settings || {}
  const requiredFields = Array.isArray(qualification.requiredFields)
    ? qualification.requiredFields
    : ['name', 'contact', 'service', 'enquiry']

  const instructions = `You are ${assistant.name}, the AI sales assistant for this business.
Business description: ${assistant.business_description || 'Not supplied'}
Services: ${(assistant.services || []).join(', ') || 'Not supplied'}
Areas covered: ${(assistant.areas || []).join(', ') || 'Not supplied'}
Tone: ${assistant.tone}

Lead qualification configuration:
Required information: ${requiredFields.join(', ')}
HOT lead criteria: ${qualification.hotCriteria || 'Not supplied'}
WARM lead criteria: ${qualification.warmCriteria || 'Not supplied'}
Ready to contact criteria: ${qualification.readyCriteria || 'Not supplied'}
Additional qualification rules: ${assistant.qualification_rules || 'Qualify politely and collect enough information for a human to follow up.'}

Qualification behaviour:
- Treat the configured required information as the minimum information needed for qualification.
- Ask for missing required information naturally and avoid repeatedly asking for information already provided.
- Do not require optional information before considering a lead qualified.
- You may collect useful optional information when it is relevant, but optional information must not block the lead from becoming ready.
- Once all configured required information has been provided, set qualification_complete to true unless the business-specific rules clearly require something else.

Your job is to help the customer, qualify genuine enquiries and capture useful sales information. Never invent prices, availability, guarantees, qualifications or services. If something is unknown, say a team member can confirm it.
Ask natural follow-up questions rather than interrogating the customer. Do not ask for information already provided.
A HOT lead is a clear commercial opportunity that is ready for contact or has an urgent/high-value need. WARM means genuine interest but needs nurturing, follow-up or more information. If there is not enough information to confidently classify the lead as HOT or WARM, leave the score unscored.

Qualification is progressive. Review the entire conversation and identify what useful information is still missing. Do not ask for information the customer has already provided.

qualification_complete should only be true when you have enough information to hand the enquiry to a human salesperson without needing another basic qualification question.

missing_information should contain only the genuinely useful information still needed. Keep these short and human-readable, for example "phone number" or "timescale".

ready_to_contact should only be true when qualification_complete is true and the customer has provided enough contact information for a human follow-up.

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

export async function assessLead({ assistant, lead }) {
  const qualification = assistant.qualification_settings || {}
  const requiredFields = Array.isArray(qualification.requiredFields)
    ? qualification.requiredFields
    : ['name', 'contact', 'service', 'enquiry']

  const instructions = `You are assessing a sales lead for ${assistant.name}, the AI sales assistant for this business.

Business description: ${assistant.business_description || 'Not supplied'}
Services: ${(assistant.services || []).join(', ') || 'Not supplied'}
Areas covered: ${(assistant.areas || []).join(', ') || 'Not supplied'}
Tone: ${assistant.tone || 'friendly, professional and concise'}

Lead qualification configuration:
Required information: ${requiredFields.join(', ')}
HOT lead criteria: ${qualification.hotCriteria || 'Not supplied'}
WARM lead criteria: ${qualification.warmCriteria || 'Not supplied'}
Ready to contact criteria: ${qualification.readyCriteria || 'Not supplied'}
Additional qualification rules: ${assistant.qualification_rules || 'Not supplied'}

Assess the supplied lead information.

Important rules:
- Do not invent information that is not present in the lead.
- Assess the lead using the business-specific qualification rules.
- HOT means a clear commercial opportunity, urgent need, strong buying intent or otherwise high-priority opportunity according to the business criteria.
- WARM means a genuine enquiry or opportunity that needs nurturing, more information or follow-up.
- If there is insufficient information to confidently classify the lead, leave the score unscored.
- Identify genuinely useful missing information.
- Treat configured required fields as the minimum information needed for qualification.
- Optional fields must not prevent qualification.
- ready_to_contact should only be true when all configured required information is present and the business rules allow the lead to be handed to a salesperson.
- Create a concise internal summary suitable for a salesperson reviewing the lead.
- Do not change or invent the customer's supplied information.

Return the structured lead assessment.`

  const input = [
    {
      role: 'user',
      content: JSON.stringify({
        name: lead.name || null,
        email: lead.email || null,
        phone: lead.phone || null,
        postcode: lead.postcode || null,
        service: lead.service || null,
        property_type: lead.property_type || null,
        timescale: lead.timescale || null,
        enquiry: lead.enquiry || null,
        current_summary: lead.summary || null,
      }),
    },
  ]

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    instructions,
    input,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'leadpilot_assessment',
        strict: true,
        schema,
      },
    },
  })

  return JSON.parse(response.output_text)
}
