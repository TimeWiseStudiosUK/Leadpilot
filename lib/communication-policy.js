export const COMMUNICATION_CHANNELS = [
  'EMAIL',
  'PHONE',
  'SMS',
  'WHATSAPP',
]

const MARKETING_FIELDS = {
  EMAIL: 'marketing_email',
  PHONE: 'marketing_phone',
  SMS: 'marketing_sms',
  WHATSAPP: 'marketing_whatsapp',
}

export function evaluateCommunication({
  lead,
  channel,
  purpose = 'MARKETING',
}) {
  const normalizedChannel = String(channel || '').toUpperCase()
  const normalizedPurpose = String(purpose || '').toUpperCase()

  if (!COMMUNICATION_CHANNELS.includes(normalizedChannel)) {
    return {
      allowed: false,
      reason: 'Unsupported communication channel.',
    }
  }

  if (!['MARKETING', 'ENQUIRY'].includes(normalizedPurpose)) {
    return {
      allowed: false,
      reason: 'Unsupported communication purpose.',
    }
  }

  if (!lead || lead.do_not_contact === true) {
    return {
      allowed: false,
      reason: 'Contact is blocked or lead information is unavailable.',
    }
  }

  if (normalizedPurpose === 'ENQUIRY') {
    return {
      allowed: null,
      reason: 'Human review required: confirm this contact relates to the existing enquiry and is lawful.',
    }
  }

  const field = MARKETING_FIELDS[normalizedChannel]
  const preference = lead[field]

  if (preference === false) {
    return {
      allowed: false,
      reason: 'Customer has opted out of marketing through this channel.',
    }
  }

  return {
    allowed: null,
    reason: preference === true
      ? 'Positive marketing preference recorded. Verify lawful basis, consent evidence and channel-specific rules before sending.'
      : 'Marketing permission is unknown. Verify the applicable lawful basis and channel-specific rules before sending.',
  }
}
