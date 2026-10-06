import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function analyseSalesPipeline({
  assistant,
  leads = [],
  activities = [],
  followUps = [],
}) {
  const qualification = assistant?.qualification_settings || {}

  const businessContext = {
    businessName: assistant?.business_name || '',
    businessDescription: assistant?.business_description || '',
    services: assistant?.services || '',
    areas: assistant?.areas || '',
    tone: assistant?.tone || 'friendly, professional and concise',
    qualificationRules: assistant?.qualification_rules || '',
    qualificationSettings: qualification,
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    input: [
      {
        role: 'system',
        content: `
You are the AI Sales Manager for a business using LeadPilot.

Your job is to analyse the current sales pipeline and identify what the human salesperson should pay attention to next.

You must work for ANY type of business. Never assume the business is a particular industry.

Use the business's own training, qualification rules, services, priorities and communication preferences to understand what matters.

Your role is advisory:
- Recommend actions.
- Explain why.
- Never invent facts.
- Never assume a customer has consented to marketing.
- Never override do-not-contact or communication preferences.
- Do not make legally significant decisions.
- The human salesperson remains responsible for deciding what action to take.

Prioritise genuine sales opportunities, urgent enquiries, leads ready to progress, overdue follow-ups, qualification gaps and leads at risk of being forgotten.

Distinguish between:
1. Existing enquiry/service communication.
2. Marketing communication.

A recommendation to contact a customer about their existing enquiry is not automatically a marketing recommendation.

When recommending communication, consider the customer's preferred contact method and communication preferences.

If information is missing, say so rather than inventing it.

LeadPilot uses a generic lead structure. Treat these as universal fields across all businesses: customer name, phone or email, service or product, enquiry details, location, timescale, budget and quantity.

Business-specific information must come only from the business training configuration, particularly qualificationSettings.additionalInformation. Do not invent industry-specific fields or refer to fields such as postcode, property type, vehicle type, roof type or similar unless that information is explicitly configured by the business.

When identifying qualification gaps, use only the universal LeadPilot fields and the business-specific information explicitly configured in qualificationSettings.additionalInformation. If no business-specific information is configured, do not create industry-specific qualification requirements.

Each qualification opportunity must identify ONE missing field or requirement at a time. Never concatenate multiple field names into one label. Use clear labels such as Name, Contact method, Service or product, Enquiry details, Location, Timescale, Budget, Quantity, or the exact configured business-specific field.

Do not let industry-specific wording found inside an individual lead override the trained business context. If a lead contains information that appears unrelated to the business being analysed, treat it as potentially anomalous or a duplicate and do not use that unrelated information to invent qualification requirements.

Business context:
${JSON.stringify(businessContext, null, 2)}

Return concise, practical recommendations that a salesperson could act on immediately.
        `,
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Analyse the current pipeline and tell the salesperson what deserves attention now.',
          leads,
          activities,
          followUps,
        }),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'sales_manager_analysis',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            headline: {
              type: 'string',
            },
            summary: {
              type: 'string',
            },
            priority_lead_id: {
              type: ['string', 'null'],
            },
            priority_action: {
              type: 'string',
            },
            priority_reason: {
              type: 'string',
            },
            suggested_message: {
              type: ['string', 'null'],
            },
            secondary_priorities: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  lead_id: {
                    type: 'string',
                  },
                  action: {
                    type: 'string',
                  },
                  reason: {
                    type: 'string',
                  },
                },
                required: ['lead_id', 'action', 'reason'],
              },
            },
            risks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  lead_id: {
                    type: ['string', 'null'],
                  },
                  risk: {
                    type: 'string',
                  },
                  recommended_action: {
                    type: 'string',
                  },
                },
                required: ['lead_id', 'risk', 'recommended_action'],
              },
            },
            qualification_opportunities: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  lead_id: {
                    type: 'string',
                  },
                  missing_information: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                  recommended_question: {
                    type: 'string',
                  },
                },
                required: [
                  'lead_id',
                  'missing_information',
                  'recommended_question',
                ],
              },
            },
          },
          required: [
            'headline',
            'summary',
            'priority_lead_id',
            'priority_action',
            'priority_reason',
            'suggested_message',
            'secondary_priorities',
            'risks',
            'qualification_opportunities',
          ],
        },
      },
    },
  })

  return JSON.parse(response.output_text)
}
