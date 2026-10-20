'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import styles from '../../new/page.module.css'

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    service: '',
    timescale: '',
    budget: '',
    quantity: '',
    enquiry: '',
    customFields: {},
  })

  const [customFields, setCustomFields] = useState([])
  const [qualificationSettings, setQualificationSettings] = useState({
    enabledFields: ['name', 'contact', 'enquiry'],
    requiredFields: ['name', 'contact', 'enquiry'],
    customFields: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadLead() {
      try {
        const response = await fetch(`/api/leads/${leadId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load lead')
        }

        const lead = data.lead
        const settings = data.qualificationSettings || {}

        setQualificationSettings({
          enabledFields: [...new Set([
            'name',
            'contact',
            'enquiry',
            ...(Array.isArray(settings.enabledFields) ? settings.enabledFields : []),
            ...(Array.isArray(settings.requiredFields) ? settings.requiredFields : []),
          ])],
          requiredFields: Array.isArray(settings.requiredFields)
            ? settings.requiredFields
            : ['name', 'contact', 'enquiry'],
          customFields: Array.isArray(settings.customFields)
            ? settings.customFields
            : [],
        })

        setCustomFields(
          Array.isArray(settings.customFields) ? settings.customFields : []
        )

        setForm({
          name: lead.name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          location: lead.location || '',
          service: lead.service || '',
          timescale: lead.timescale || '',
          budget: lead.budget || '',
          quantity: lead.quantity == null ? '' : String(lead.quantity),
          enquiry: lead.enquiry || '',
          customFields:
            lead.custom_fields && typeof lead.custom_fields === 'object'
              ? lead.custom_fields
              : {},
        })
      } catch (err) {
        setError(err.message || 'Unable to load lead')
      } finally {
        setLoading(false)
      }
    }

    loadLead()
  }, [leadId])

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateCustomField(key, value) {
    setForm(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [key]: value,
      },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Please enter the lead name.')
      return
    }

    if (!form.email.trim() && !form.phone.trim()) {
      setError('Please enter a phone number or email address.')
      return
    }

    if (!form.enquiry.trim()) {
      setError('Please enter the enquiry details.')
      return
    }

    for (const field of customFields) {
      if (field.required && !String(form.customFields[field.key] ?? '').trim()) {
        setError(`Please complete ${field.label || field.key}.`)
        return
      }
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          ...form,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update lead')
      }

      router.push(`/dashboard/leads/${leadId}`)
      router.refresh()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p>Loading lead...</p>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div>
            <Link href={`/dashboard/leads/${leadId}`} className={styles.backLink}>
              ← Back to lead
            </Link>
            <div className={styles.heading}>
              <span className={styles.eyebrow}>LEADS</span>
              <h1>Edit lead</h1>
              <p>Update the lead information and let AI reassess the opportunity.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Contact details</h2>
                <p>Update the customer's contact information.</p>
              </div>
            </div>

            <div className={styles.grid}>
              {[
                ['name', 'Name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
              ].map(([key, label]) => (
                <div className={styles.field} key={key}>
                  <label htmlFor={key}>
                    {label}{key === 'name' && <span> *</span>}
                  </label>
                  <input
                    id={key}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                    value={form[key]}
                    onChange={e => updateField(key, e.target.value)}
                    required={key === 'name'}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Lead details</h2>
                <p>Update the enquiry information. Meaningful changes trigger AI reassessment.</p>
              </div>
            </div>

            <div className={styles.fullField}>
              <label htmlFor="enquiry">Enquiry details <span> *</span></label>
              <textarea
                id="enquiry"
                rows="5"
                value={form.enquiry}
                onChange={e => updateField('enquiry', e.target.value)}
                required
              />
            </div>
          </section>

          {customFields.length > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Additional qualification details</h2>
                  <p>Custom questions configured in Training Hub for this business.</p>
                </div>
              </div>

              {customFields.map(field => (
                <div className={styles.fullField} key={field.key}>
                  <label htmlFor={`custom-${field.key}`}>
                    {field.label || field.key}
                    {field.required ? ' *' : ''}
                  </label>
                  {field.description && <p>{field.description}</p>}
                  <textarea
                    id={`custom-${field.key}`}
                    rows="2"
                    value={form.customFields[field.key] == null
                      ? ''
                      : String(form.customFields[field.key])}
                    onChange={e => updateCustomField(field.key, e.target.value)}
                    required={Boolean(field.required)}
                  />
                </div>
              ))}
            </section>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <Link href={`/dashboard/leads/${leadId}`} className={styles.cancel}>
              Cancel
            </Link>
            <button type="submit" className={styles.save} disabled={saving}>
              {saving ? 'Saving and assessing...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
