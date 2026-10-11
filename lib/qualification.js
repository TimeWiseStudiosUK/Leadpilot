export function evaluateQualification({ qualificationSettings = {}, lead = {} }) {
  const requiredFields = Array.isArray(qualificationSettings.requiredFields)
    ? qualificationSettings.requiredFields
    : ['name', 'contact', 'service', 'enquiry']

  const qualificationValues = {
    name: Boolean(lead.name),
    contact: Boolean(lead.email || lead.phone),
    service: Boolean(lead.service),
    enquiry: Boolean(lead.enquiry),
    location: Boolean(lead.location),
    timescale: Boolean(lead.timescale),
    budget: Boolean(lead.budget),
    quantity: Boolean(lead.quantity),
  }

  const standardComplete = requiredFields.every(
    field => qualificationValues[field] === true
  )

  const customFields =
    lead.custom_fields &&
    typeof lead.custom_fields === 'object' &&
    !Array.isArray(lead.custom_fields)
      ? lead.custom_fields
      : {}

  const customFieldDefinitions = Array.isArray(qualificationSettings.customFields)
    ? qualificationSettings.customFields
    : []

  const requiredCustomFields = customFieldDefinitions.filter(
    field => field && field.required === true && field.key
  )

  const missingCustomFields = requiredCustomFields
    .filter(field => !String(customFields[field.key] || '').trim())
    .map(field => field.label || field.key)

  const customComplete = missingCustomFields.length === 0
  const qualificationComplete = standardComplete && customComplete
  const readyToContact =
    qualificationComplete && Boolean(lead.email || lead.phone)

  return {
    standardComplete,
    customComplete,
    qualificationComplete,
    missingCustomFields,
    readyToContact,
  }
}
