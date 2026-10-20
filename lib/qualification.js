const CORE_FIELDS = ['name', 'contact', 'enquiry']

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function getFieldValue(field, lead) {
  switch (field) {
    case 'name':
      return lead.name
    case 'contact':
      return hasValue(lead.email) ? lead.email : lead.phone
    case 'enquiry':
      return lead.enquiry
    default:
      return undefined
  }
}

export function evaluateQualification({
  qualificationSettings = {},
  lead = {},
}) {
  const missingFields = CORE_FIELDS
    .filter(field => !hasValue(getFieldValue(field, lead)))
    .map(field => {
      if (field === 'name') return 'Customer name'
      if (field === 'contact') return 'Phone number or email'
      return 'Enquiry details'
    })

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
    .filter(field => !hasValue(customFields[field.key]))
    .map(field => field.label || field.key)

  const standardComplete = missingFields.length === 0
  const customComplete = missingCustomFields.length === 0
  const qualificationComplete = standardComplete && customComplete
  const readyToContact =
    standardComplete && Boolean(hasValue(lead.email) || hasValue(lead.phone))

  return {
    standardComplete,
    customComplete,
    qualificationComplete,
    missingFields,
    missingCustomFields,
    readyToContact,
  }
}
