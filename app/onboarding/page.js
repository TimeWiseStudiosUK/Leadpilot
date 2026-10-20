'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'

const defaultForm = {
  name: '',
  industry: '',
  businessDescription: '',
  services: '',
  areas: '',
  rules: '',
  greeting: '',
  tone: 'friendly, professional and concise',
  qualificationSettings: {
    requiredFields: ['name', 'contact', 'enquiry'],
    enabledFields: ['name', 'contact', 'enquiry'],
    hotCriteria: '',
    warmCriteria: '',
    readyCriteria: '',
    additionalInformation: '',
    customFields: [],
  },
}

const steps = [
  { title: 'Your business', label: 'Business' },
  { title: 'What you sell', label: 'Services' },
  { title: 'Great leads', label: 'Lead quality' },
  { title: 'Urgency & priorities', label: 'Priorities' },
  { title: 'Qualification', label: 'Information' },
  { title: 'Communication', label: 'Style' },
  { title: 'Meet your AI employee', label: 'Ready' },
]

const fieldOptions = [
  ['name', 'Customer name', 'Who am I speaking to?'],
  ['contact', 'Phone or email', 'How can your team contact them?'],
  ['enquiry', 'Enquiry details', 'What exactly do they need help with?'],
];
function normaliseAssistant(organisation, assistant) {
  return {
    name: organisation?.name || '',
    industry: organisation?.industry || '',
    businessDescription: assistant?.business_description || '',
    services: Array.isArray(assistant?.services) ? assistant.services.join('\n') : '',
    areas: Array.isArray(assistant?.areas) ? assistant.areas.join('\n') : '',
    rules: assistant?.qualification_rules || '',
    greeting: assistant?.greeting || '',
    tone: assistant?.tone || defaultForm.tone,
    qualificationSettings: {
      requiredFields: assistant?.qualification_settings?.requiredFields || defaultForm.qualificationSettings.requiredFields,
      enabledFields: assistant?.qualification_settings?.enabledFields || assistant?.qualification_settings?.requiredFields || defaultForm.qualificationSettings.enabledFields,
      hotCriteria: assistant?.qualification_settings?.hotCriteria || '',
      warmCriteria: assistant?.qualification_settings?.warmCriteria || '',
      readyCriteria: assistant?.qualification_settings?.readyCriteria || '',
      additionalInformation: assistant?.qualification_settings?.additionalInformation || '',
      customFields: Array.isArray(assistant?.qualification_settings?.customFields) ? assistant.qualification_settings.customFields : [],
    },
  }
}

export default function Onboarding() {
  const router = useRouter()
  const sb = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [training, setTraining] = useState(false)
  const [trainingSuggestions, setTrainingSuggestions] = useState(null)
  const [selectedTrainingSuggestions, setSelectedTrainingSuggestions] = useState({ hotCriteria: true, warmCriteria: true, customFields: [] })
  const [step, setStep] = useState(0)
  const [existingBusiness, setExistingBusiness] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [customFieldDraft, setCustomFieldDraft] = useState({ label: '', required: false })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: memberships } = await sb
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)

      const membership = memberships?.[0]

      if (!membership) {
        setExistingBusiness(false)
        setLoading(false)
        return
      }

      const [{ data: organisation }, { data: assistant }] = await Promise.all([
        sb.from('organizations').select('*').eq('id', membership.organization_id).single(),
        sb.from('assistants').select('*').eq('organization_id', membership.organization_id).eq('active', true).limit(1).maybeSingle(),
      ])

      if (!organisation || !assistant) {
        setError('Your AI employee could not be loaded.')
        setLoading(false)
        return
      }

      setForm(normaliseAssistant(organisation, assistant))
      setExistingBusiness(true)
      setLoading(false)
    }

    load()
  }, [])

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  function updateQualification(field, value) {
    setForm(prev => ({
      ...prev,
      qualificationSettings: {
        ...prev.qualificationSettings,
        [field]: value,
      },
    }))
    setError('')
  }

  function setStandardField(value, mode) {
    const settings = form.qualificationSettings
    const enabled = new Set(settings.enabledFields || settings.requiredFields || [])
    const required = new Set(settings.requiredFields || [])

    if (mode === 'off') {
      enabled.delete(value)
      required.delete(value)
    } else {
      enabled.add(value)
      if (mode === 'required') required.add(value)
      else required.delete(value)
    }

    updateQualification('enabledFields', [...enabled])
    updateQualification('requiredFields', [...required])
  }

  function addCustomField(field = customFieldDraft) {
    const label = String(field.label || '').trim()
    if (!label) {
      setError('Give the additional field a name first.')
      return
    }

    const key = String(field.key || label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const current = form.qualificationSettings.customFields || []
    if (current.some(item => item.key === key)) {
      setError('That field already exists. Choose a different name.')
      return
    }

    updateQualification('customFields', [
      ...current,
      { key, label, description: field.description || '', required: Boolean(field.required) },
    ])
    setCustomFieldDraft({ label: '', required: false })
    setError('')
  }

  function updateCustomField(index, changes) {
    const fields = [...(form.qualificationSettings.customFields || [])]
    fields[index] = { ...fields[index], ...changes }
    updateQualification('customFields', fields)
  }

  function removeCustomField(index) {
    updateQualification(
      'customFields',
      (form.qualificationSettings.customFields || []).filter((_, i) => i !== index)
    )
  }

  function next() {
    if (step === 0 && !form.name.trim()) {
      setError('Tell us your business name before continuing.')
      return
    }
    setError('')
    setStep(current => Math.min(current + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setError('')
    setStep(current => Math.max(current - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function trainQualification() {
    const hotCriteria = form.qualificationSettings.hotCriteria.trim()
    const warmCriteria = form.qualificationSettings.warmCriteria.trim()

    if (!hotCriteria && !warmCriteria) {
      setError('Give me a little guidance first, then I can help train your AI employee.')
      return
    }

    setTraining(true)
    setError('')

    try {
      const response = await fetch('/api/onboarding/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.name.trim(),
          industry: form.industry.trim(),
          businessDescription: form.businessDescription.trim(),
          services: form.services.trim(),
          areas: form.areas.trim(),
          additionalInformation: (form.qualificationSettings.customFields || [])
            .map(field => field.label + (field.description ? ': ' + field.description : '') + (field.required ? ' (required)' : ' (optional)'))
            .join('\n'),
          existingCustomFields: form.qualificationSettings.customFields || [],
          hotCriteria,
          warmCriteria,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError((data.error || data.message || ('Training API returned HTTP ' + response.status)) + (data.details ? ' ' + data.details : ''))
        return
      }

      setSelectedTrainingSuggestions({
        hotCriteria: true,
        warmCriteria: true,
        customFields: [],
      })
      setTrainingSuggestions(data.suggestions)
    } catch {
      setError('Could not generate AI training suggestions. Please try again.')
    } finally {
      setTraining(false)
    }
  }

  function applyTrainingSuggestions(acceptAll = false) {
    if (!trainingSuggestions) return

    const selected = selectedTrainingSuggestions
    const existingFields = form.qualificationSettings.customFields || []

    function normaliseFieldText(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
    }

    function fieldWords(value) {
      return new Set(normaliseFieldText(value).split(/\s+/).filter(Boolean))
    }

    function fieldsOverlap(suggested, existing) {
      const suggestedText = normaliseFieldText(
        suggested.label + ' ' + (suggested.description || '')
      )
      const existingText = normaliseFieldText(
        existing.label + ' ' + (existing.description || '')
      )

      if (!suggestedText || !existingText) return false

      if (
        normaliseFieldText(suggested.label) === normaliseFieldText(existing.label)
      ) {
        return true
      }

      const suggestedWords = fieldWords(suggestedText)
      const existingWords = fieldWords(existingText)
      const sharedWords = [...suggestedWords].filter(word => existingWords.has(word))

      return sharedWords.length >= 2 &&
        sharedWords.length / Math.min(suggestedWords.size, existingWords.size) >= 0.6
    }

    const selectedKeys = new Set(
      acceptAll
        ? (trainingSuggestions.customFields || []).map(field => field.key)
        : selected.customFields
    )

    const suggestedFields = (trainingSuggestions.customFields || [])
      .filter(field => field.label && field.key && selectedKeys.has(field.key))
      .filter(field => {
        const duplicateKey = existingFields.some(existing => existing.key === field.key)
        const duplicateInformation = existingFields.some(existing => fieldsOverlap(field, existing))
        return !duplicateKey && !duplicateInformation
      })
      .map(field => ({
        key: field.key,
        label: field.label,
        description: field.description || '',
        required: Boolean(field.required),
      }))

    if (
      trainingSuggestions.hotCriteria?.trim() &&
      (acceptAll || selected.hotCriteria)
    ) {
      updateQualification('hotCriteria', trainingSuggestions.hotCriteria)
    }

    if (
      trainingSuggestions.warmCriteria?.trim() &&
      (acceptAll || selected.warmCriteria)
    ) {
      updateQualification('warmCriteria', trainingSuggestions.warmCriteria)
    }

    if (suggestedFields.length) {
      updateQualification('customFields', [...existingFields, ...suggestedFields])
    }

    setTrainingSuggestions(null)
    setSelectedTrainingSuggestions({ hotCriteria: true, warmCriteria: true, customFields: [] })
  }

  async function finish() {
    setSaving(true)
    setError('')

    try {
      const endpoint = existingBusiness ? '/api/assistant' : '/api/onboarding'
      const response = await fetch(endpoint, {
        method: existingBusiness ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Could not save your AI employee training.')
        setSaving(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Could not save your AI employee training.')
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="employeeTrainingPage"><div className="employeeTrainingShell"><p>Loading your AI employee...</p></div></main>
  }

  const progress = ((step + 1) / steps.length) * 100
  const isFinal = step === steps.length - 1

  return (
    <main className="employeeTrainingPage">
      <div className="employeeTrainingShell">
        <header className="employeeTrainingHeader">
          <div className="employeeBrand"><span className="employeeLogo">LP</span><strong>LeadPilot</strong></div>
          <div className="employeeTrainingHeaderRight">
            <span className="employeeTrainingMode">{existingBusiness ? 'AI EMPLOYEE' : 'TRAIN YOUR AI EMPLOYEE'}</span>
            {existingBusiness && (
              <button type="button" className="employeeDashboardLink" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </button>
            )}
          </div>
        </header>

        <div className="employeeProgress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((item, index) => (
            <span key={item.title} className={index <= step ? 'active' : ''} />
          ))}
        </div>
        <div className="employeeProgressMeta">
          <span>Step {step + 1} of {steps.length}</span>
          <span>{steps[step].label}</span>
        </div>

        <section className="employeeTrainingCard">
          {step === 0 && (
            <StepFrame eyebrow="LET'S GET STARTED" title="Let's get to know your business" intro="Before I start handling enquiries, tell me a little about the business. A few details are enough to get me started.">
              <Field label="What's your business called?" value={form.name} onChange={value => update('name', value)} placeholder="e.g. Tony Roofing Ltd" />
              <Field label="What do you do?" value={form.industry} onChange={value => update('industry', value)} placeholder="e.g. Roofing, recruitment, estate agency" />
              <Field label="Tell me a little about the business" hint="Tell me what you do, who you help and anything you'd like your AI employee to know." value={form.businessDescription} onChange={value => update('businessDescription', value)} placeholder="We provide... We mainly work with... We cover..." multiline rows={5} />
              <p className="employeeReassurance"><strong>Don't worry about getting this perfect.</strong> You can change anything later, and I'll use what you tell me to tailor how I handle enquiries.</p>
            </StepFrame>
          )}

          {step === 1 && (
            <StepFrame eyebrow="YOUR OFFER" title="What should I know about what you sell?" intro="Tell me the services or products I should be able to talk to customers about.">
              <Field label="What do you offer?" hint="One service or product per line is easiest." value={form.services} onChange={value => update('services', value)} placeholder={'Roof repairs\nFull roof replacements\nFlat roofing'} multiline rows={7} />
              <Field label="Where do you work?" hint="Add towns, counties, regions or say nationwide." value={form.areas} onChange={value => update('areas', value)} placeholder={'Southampton\nHampshire\nSurrounding areas'} multiline rows={5} />
              <p className="employeeTip"><strong>Tip:</strong> Don't worry about writing this like a brochure. Just tell me what your team actually sells.</p>
            </StepFrame>
          )}

          {step === 2 && (
            <StepFrame eyebrow="LEAD QUALITY" title="What makes a great lead?" intro="You're the expert on your business. Tell me what makes an enquiry worth your team's attention.">
              <Field label="What makes an enquiry a strong opportunity?" hint="Think about customers who are likely to buy, have a clear need or are valuable to your business." value={form.qualificationSettings.hotCriteria} onChange={value => updateQualification('hotCriteria', value)} placeholder="For example: urgent work, ready to proceed, clear scope, high-value project..." multiline rows={7} />

              <Field label="What makes an enquiry genuine, but not ready yet?" hint="These become useful WARM opportunities that should not be ignored." value={form.qualificationSettings.warmCriteria} onChange={value => updateQualification('warmCriteria', value)} placeholder="For example: researching options, planning work later, needs more information..." multiline rows={6} />

              <p className="employeeTip"><strong>Keep it natural.</strong> Write this exactly as you'd explain it to a new salesperson joining your team.</p>
            </StepFrame>
          )}

          {step === 3 && (
            <StepFrame eyebrow="PRIORITIES" title="What should I treat as urgent?" intro="Help me understand what needs attention first, so I can prioritise the right opportunities for your team.">
              <Field label="What makes an enquiry urgent or time-sensitive?" value={form.rules} onChange={value => update('rules', value)} placeholder="For example: emergency repairs, customers ready for a quote, jobs starting within 6 weeks..." multiline rows={7} />
              <div className="employeePriorityExamples">
                <span>Examples</span>
                <div><b>Urgent problems</b><b>Ready to buy</b><b>High-value work</b><b>Short timescales</b></div>
              </div>
              <p className="employeeTip">You can describe other priorities too. Existing customers, specific services, locations or anything else important to your business can be included.</p>
            </StepFrame>
          )}

          {step === 4 && (
            <StepFrame eyebrow="QUALIFICATION" title="What information should I collect?" intro="Some information is essential for every enquiry. The rest can be tailored to your business.">
              <div className="employeeSectionLabel">Always required</div>
              <div className="employeeCoreGrid">
                {fieldOptions.map(([value, label, description], index) => (
                  <div className="employeeCoreCard" key={value}>
                    <div className="employeeCoreTop">
                      <span className="employeeCoreIcon" aria-hidden="true">
                        {index === 0 ? (
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="3.5" />
                            <path d="M5 20v-1.5a7 7 0 0 1 14 0V20Z" />
                          </svg>
                        ) : index === 1 ? (
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 3h3l2 5-2 1.5a15 15 0 0 0 4.5 4.5L16 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 5 5a2 2 0 0 1 2-2Z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 1 1 21 11.5Z" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <div className="employeeCoreText">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </div>
                    <div className="employeeCoreRequired">✓ <span>Required</span></div>
                  </div>
                ))}
              </div>

              <div className="employeeSectionLabel">Business-specific information</div>
              <p className="employeeTip">Add the extra details that matter to your business. Each field can be optional or required before handover.</p>

              {(form.qualificationSettings.customFields || []).map((field, index) => (
                <div className="employeeCustomField" key={field.key || index}>
                  <label>
                    <span>Field name</span>
                    <input value={field.label || ''} onChange={e => updateCustomField(index, { label: e.target.value })} />
                  </label>
                  <label>
                    <span>What should I collect?</span>
                    <input value={field.description || ''} placeholder="Optional guidance for the AI employee" onChange={e => updateCustomField(index, { description: e.target.value })} />
                  </label>
                  <label>
                    <span>Requirement</span>
                    <select value={field.required ? 'required' : 'optional'} onChange={e => updateCustomField(index, { required: e.target.value === 'required' })}>
                      <option value="optional">Optional</option>
                      <option value="required">Required before handover</option>
                    </select>
                  </label>
                  <button type="button" className="employeeSecondaryAction" onClick={() => removeCustomField(index)}>Remove field</button>
                </div>
              ))}

              <div className="employeeCustomFieldDraft">
                <label>
                  <span>New field name</span>
                  <input value={customFieldDraft.label} onChange={e => setCustomFieldDraft(prev => ({ ...prev, label: e.target.value }))} placeholder="e.g. Vehicle required" />
                </label>
                <label>
                  <span>Requirement</span>
                  <select value={customFieldDraft.required ? 'required' : 'optional'} onChange={e => setCustomFieldDraft(prev => ({ ...prev, required: e.target.value === 'required' }))}>
                    <option value="optional">Optional</option>
                    <option value="required">Required before handover</option>
                  </select>
                </label>
                <button type="button" className="employeePrimaryAction" onClick={() => addCustomField()}>+ Add field</button>
              </div>

              <button type="button" className="employeeAiButton" onClick={trainQualification} disabled={training}>
                {training ? 'Training your AI employee...' : '✨ Help me turn this into AI rules'}
              </button>

              {trainingSuggestions && (
                <div className="employeeTrainingResult">
                  <div className="employeeTrainingResultHeader">
                    <span>AI TRAINING SUGGESTION</span>
                    <strong>Review each proposed change</strong>
                  </div>

                  <label className="employeeTrainingRule">
                    <input
                      type="checkbox"
                      checked={selectedTrainingSuggestions.hotCriteria}
                      onChange={event => setSelectedTrainingSuggestions(prev => ({
                        ...prev,
                        hotCriteria: event.target.checked,
                      }))}
                    />
                    <span>🔥 HOT qualification rule</span>
                    <p>{trainingSuggestions.hotCriteria || 'No HOT rule suggested.'}</p>
                  </label>

                  <label className="employeeTrainingRule">
                    <input
                      type="checkbox"
                      checked={selectedTrainingSuggestions.warmCriteria}
                      onChange={event => setSelectedTrainingSuggestions(prev => ({
                        ...prev,
                        warmCriteria: event.target.checked,
                      }))}
                    />
                    <span>🟠 WARM qualification rule</span>
                    <p>{trainingSuggestions.warmCriteria || 'No WARM rule suggested.'}</p>
                  </label>

                  {trainingSuggestions.customFields?.length ? (
                    <div className="employeeTrainingRule">
                      <span>📋 BUSINESS-SPECIFIC INFORMATION</span>
                      {trainingSuggestions.customFields.map(field => (
                        <label key={field.key} style={{ display: 'block', marginTop: '10px' }}>
                          <input
                            type="checkbox"
                            checked={selectedTrainingSuggestions.customFields.includes(field.key)}
                            onChange={event => setSelectedTrainingSuggestions(prev => ({
                              ...prev,
                              customFields: event.target.checked
                                ? [...prev.customFields, field.key]
                                : prev.customFields.filter(key => key !== field.key),
                            }))}
                          />
                          {' '}
                          <strong>{field.label}</strong>
                          {' '}{field.required ? '(required before handover)' : '(optional)'}
                          {field.description ? <p>{field.description}</p> : null}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  <p className="employeeTip">
                    <strong>Nothing changes until you approve it.</strong>
                    Select the rules and fields you want to apply. Each item is independent.
                  </p>

                  <div className="employeeTrainingActions">
                    <button
                      type="button"
                      className="employeePrimaryAction"
                      onClick={() => applyTrainingSuggestions(false)}
                    >
                      ✓ Accept selected
                    </button>
                    <button
                      type="button"
                      className="employeePrimaryAction"
                      onClick={() => applyTrainingSuggestions(true)}
                    >
                      Accept all changes
                    </button>
                    <button
                      type="button"
                      className="employeeSecondaryAction"
                      onClick={() => {
                        setTrainingSuggestions(null)
                        setSelectedTrainingSuggestions({ hotCriteria: true, warmCriteria: true, customFields: [] })
                      }}
                    >
                      Discard suggestions
                    </button>
                  </div>
                </div>
              )}


              <p className="employeeTip"><strong>Keep it focused.</strong> Only make optional information a requirement when your team genuinely needs it before taking over an enquiry.</p>
              <Field label="When should I hand an enquiry to your team?" hint="This is your final handover rule. The four core fields above are always required." value={form.qualificationSettings.readyCriteria} onChange={value => updateQualification('readyCriteria', value)} placeholder="For example: all required information is collected and the customer has provided a phone number or email..." multiline rows={5} />
            </StepFrame>
          )}

          {step === 5 && (
            <StepFrame eyebrow="COMMUNICATION" title="How should I speak to your customers?" intro="Choose the style that feels right for your business. You can change this later.">
              <div className="employeeToneGrid">
                {[
                  ['friendly, professional and concise', 'Friendly & professional', 'Helpful, clear and confident.'],
                  ['friendly and conversational', 'Friendly & conversational', 'Natural, relaxed and approachable.'],
                  ['professional and formal', 'Professional & formal', 'Polished, structured and formal.'],
                  ['casual and approachable', 'Casual & approachable', 'Warm, relaxed and easy-going.'],
                ].map(([value, label, description]) => (
                  <button type="button" key={value} className={`employeeToneOption ${form.tone === value ? 'selected' : ''}`} onClick={() => update('tone', value)}>
                    <strong>{label}</strong><small>{description}</small>
                  </button>
                ))}
              </div>
              <Field label="What should my opening message be?" hint="Leave this blank if you'd prefer me to use a simple default." value={form.greeting} onChange={value => update('greeting', value)} placeholder="Hi, thanks for getting in touch. How can I help?" multiline rows={4} />
              <Field label="Anything else I should know?" hint="Optional. Add general instructions that don't fit elsewhere." value={form.rules} onChange={value => update('rules', value)} placeholder="Anything important about how enquiries should be handled..." multiline rows={4} />
            </StepFrame>
          )}

          {step === 6 && (
            <div className="employeeReady">
              <div className="employeeReadyIcon">✓</div>
              <p className="employeeEyebrow">YOUR AI EMPLOYEE IS READY</p>
              <h1>Meet your trained AI employee</h1>
              <p className="employeeReadyIntro">Here's what I've learned about your business. You can return here at any time to retrain me.</p>
              <div className="employeeSummaryGrid">
                <Summary label="Business" value={form.name || 'Not set'} />
                <Summary label="Industry" value={form.industry || 'Not set'} />
                <Summary label="Services" value={listSummary(form.services)} />
                <Summary label="Coverage" value={listSummary(form.areas)} />
                <Summary label="Lead priorities" value={form.qualificationSettings.hotCriteria || 'Not set yet'} />
                <Summary label="Qualification" value={`${form.qualificationSettings.requiredFields.length} required standard fields and ${(form.qualificationSettings.customFields || []).filter(field => field.required).length} required business-specific fields`} />
                <Summary label="Communication" value={toneLabel(form.tone)} />
                <Summary label="Handover" value={form.qualificationSettings.readyCriteria || 'Based on your required information'} />
              </div>
              <p className="employeeReadyNote">Nothing is locked in. Once you're using LeadPilot, you can come back and change how your AI employee works.</p>
            </div>
          )}

          {error && <div className="employeeError">{error}</div>}

          <div className="employeeNavigation">
            <button type="button" className="employeeBack" onClick={back} disabled={step === 0}>Back</button>
            {!isFinal ? (
              <button type="button" className="employeeContinue" onClick={next}>Continue <span>→</span></button>
            ) : (
              <button type="button" className="employeeContinue" onClick={finish} disabled={saving}>{saving ? 'Training...' : existingBusiness ? 'Save training & return to dashboard' : 'Start using LeadPilot'}</button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StepFrame({ eyebrow, title, intro, children }) {
  return <>
    <p className="employeeEyebrow">{eyebrow}</p>
    <h1 className="employeeStepTitle">{title}</h1>
    <p className="employeeStepIntro">{intro}</p>
    <div className="employeeStepContent">{children}</div>
  </>
}

function Field({ label, hint, value, onChange, placeholder, multiline = false, rows = 4 }) {
  return <label className="employeeField">
    <span className="employeeFieldLabel">{label}</span>
    {hint && <span className="employeeFieldHint">{hint}</span>}
    {multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} /> : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
  </label>
}

function Summary({ label, value }) {
  return <div className="employeeSummaryItem"><span>{label}</span><strong>{value}</strong></div>
}

function listSummary(value) {
  const items = value.split('\n').map(item => item.trim()).filter(Boolean)
  if (!items.length) return 'Not set'
  return items.slice(0, 3).join(', ') + (items.length > 3 ? ` + ${items.length - 3} more` : '')
}

function toneLabel(value) {
  const labels = {
    'friendly, professional and concise': 'Friendly & professional',
    'friendly and conversational': 'Friendly & conversational',
    'professional and formal': 'Professional & formal',
    'casual and approachable': 'Casual & approachable',
  }
  return labels[value] || value || 'Not set'
}
