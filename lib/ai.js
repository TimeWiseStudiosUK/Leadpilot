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
        location: { type: ['string','null'] },
        service: { type: ['string','null'] },
        timescale: { type: ['string','null'] },
        budget: { type: ['string','null'] },
        quantity: { type: ['string','null'] },
        enquiry: { type: ['string','null'] },
        custom_fields: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['key','value'],
          },
        },
        summary: { type: 'string' },
        score: { type: ['string', 'null'], enum: ['HOT','WARM', null] },
        qualification_complete: { type: 'boolean' },
        missing_information: {
          type: 'array',
          items: { type: 'string' }
        },
        ready_to_contact: { type: 'boolean' }
      },
      required: ['name','email','phone','location','service','timescale','budget','quantity','enquiry','custom_fields','summary','score','qualification_complete','missing_information','ready_to_contact']
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
Business-specific information to collect: ${qualification.additionalInformation || 'None specified'}
Additional qualification rules: ${assistant.qualification_rules || 'Qualify politely and collect enough information for a human to follow up.'}

Qualification behaviour:
- Treat the configured required information as the minimum information needed for qualification.
- Ask for missing required information naturally and avoid repeatedly asking for information already provided.
- The core information is always required: customer name, phone or email, service or product, and enquiry details.
- Optional standard information is location, timescale, budget and quantity. Only require these when they are configured as required.
- If business-specific information is configured, collect the useful details described there and store each answer in custom_fields.
- Do not require optional standard information unless configured.
- Once the core and configured required information has been provided, set qualification_complete to true unless the business-specific rules clearly require something else.

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
Business-specific information to collect: ${qualification.additionalInformation || 'None specified'}
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
        location: lead.location || null,
        service: lead.service || null,
        timescale: lead.timescale || null,
        budget: lead.budget || null,
        quantity: lead.quantity || null,
        enquiry: lead.enquiry || null,
        custom_fields: lead.custom_fields || [],
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


export async function assessFollowUp({ assistant, lead, activities = [] }) {
  const qualification = assistant.qualification_settings || {}

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      follow_up_required: {
        type: 'boolean',
      },
      recommended_action: {
        type: 'string',
        enum: ['CALL', 'EMAIL', 'FOLLOW_UP', 'QUOTE', 'CHECK_IN', 'NONE'],
      },
      recommended_timing: {
        type: 'string',
        enum: [
          'TODAY',
          'TOMORROW',
          'IN_3_DAYS',
          'IN_7_DAYS',
          'IN_14_DAYS',
          'IN_30_DAYS',
          'NONE',
        ],
      },
      reason: {
        type: 'string',
      },
      suggested_message: {
        type: 'string',
      },
    },
    required: [
      'follow_up_required',
      'recommended_action',
      'recommended_timing',
      'reason',
      'suggested_message',
    ],
  }

  const instructions = `
You are the follow-up intelligence engine for ${assistant.name || 'this business'}.

Your job is to decide whether a sales lead needs a follow-up, what the salesperson should do next, and when they should do it.

Business information:
- Business description: ${assistant.business_description || 'Not provided'}
- Services: ${assistant.services || 'Not provided'}
- Areas: ${assistant.areas || 'Not provided'}
- Tone: ${assistant.tone || 'friendly, professional and concise'}

Qualification settings:
${JSON.stringify(qualification, null, 2)}

Rules:
1. Never invent information about the customer or enquiry.
2. Use the lead information and activity history to make the recommendation.
3. WON and LOST leads must never require a follow-up.
4. If the lead has no meaningful opportunity or there is insufficient information, do not force a follow-up.
5. HOT leads with urgent requirements or strong buying intent should normally receive prompt action.
6. WARM leads may need a later nurture follow-up depending on their timescale and enquiry.
7. Consider whether the customer has already been contacted or followed up.
8. Do not recommend repeated immediate contact when a recent meaningful contact activity already exists.
9. Choose the most appropriate action:
   - CALL for urgent, high-intent or conversational opportunities.
   - EMAIL when written information, a quote or details are appropriate.
   - QUOTE when the next clear step is preparing or discussing a quotation.
   - CHECK_IN for a genuine opportunity that needs nurturing.
   - FOLLOW_UP for a general sales follow-up where no more specific action applies.
   - NONE when no follow-up is required.
10. Choose timing from the allowed timing values only.
11. Do not calculate or invent an exact calendar date.
12. The suggested message should be short, natural and usable by a salesperson. Do not make it sound like AI.
13. The reason is an internal explanation for the salesperson, not a customer-facing message.
14. If follow_up_required is false, recommended_action and recommended_timing must both be NONE and suggested_message should be an empty string.

Lead:
${JSON.stringify({
  name: lead.name || null,
  email: lead.email || null,
  phone: lead.phone || null,
  location: lead.location || null,
  service: lead.service || null,
  timescale: lead.timescale || null,
  budget: lead.budget || null,
  quantity: lead.quantity || null,
  enquiry: lead.enquiry || null,
  custom_fields: lead.custom_fields || {},
  summary: lead.summary || null,
  score: lead.score || null,
  status: lead.status || 'NEW',
  ready_to_contact: Boolean(lead.ready_to_contact),
}, null, 2)}

Recent activity:
${JSON.stringify(
  activities.slice(0, 20).map((activity) => ({
    type: activity.activity_type,
    title: activity.title,
    description: activity.description || null,
    created_at: activity.created_at,
  })),
  null,
  2
)}
`

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    instructions,
    input: 'Assess the lead and determine the most appropriate follow-up action.',
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'leadpilot_follow_up',
        strict: true,
        schema,
      },
    },
  })

  return JSON.parse(response.output_text)
}

export async function suggestQualificationTraining({
  businessName,
  industry,
  businessDescription,
  services,
  areas,
  additionalInformation,
  hotCriteria,
  warmCriteria,
}) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    input: [
      {
        role: 'system',
        content: `You help train an AI sales employee for a real business.

Your job is to analyse only the business information supplied in this current training session and the owner's description of what makes a good lead.

Suggest practical HOT and WARM lead criteria that the AI sales employee can use when qualifying future enquiries.

Rules:
- Stay specific to the business described in this training session.
- Treat the current training information as the source of truth.
- Do not use or infer information from any previous business, previous training session or existing AI configuration.
- Do not invent services the business does not provide.
- Do not invent pricing, guarantees or policies.
- HOT means genuinely high-priority or high-intent opportunities.
- WARM means genuine opportunities that are worth following up but are not immediately urgent.
- Keep the criteria concise and practical.
- Do not make assumptions about an industry that contradict the information provided.
- Return suggestions only. The business owner will approve them before they are saved.
- If the business has provided additional business-specific information to collect, convert it into a short list of practical custom qualification fields.
- Only create fields clearly supported by the business information supplied.
- Do not invent industry-specific fields.
- Give each field a stable lowercase key using letters and underscores only.
- Mark a field required only when the business information clearly indicates the team needs it before handover.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          businessName,
          industry,
          businessDescription,
          services,
          areas,
          additionalInformation,
          good_lead_description: hotCriteria,
          warm_lead_description: warmCriteria,
        }),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'qualification_training',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            hotCriteria: {
              type: 'string',
            },
            warmCriteria: {
              type: 'string',
            },
            customFields: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  key: { type: 'string' },
                  label: { type: 'string' },
                  description: { type: 'string' },
                  required: { type: 'boolean' },
                },
                required: ['key','label','description','required'],
              },
            },
          },
          required: ['hotCriteria', 'warmCriteria', 'customFields'],
        },
      },
    },
  })

  return JSON.parse(response.output_text)
}
