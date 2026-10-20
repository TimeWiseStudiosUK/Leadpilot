'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function NewLeadPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    location: '',
    timescale: '',
    budget: '',
    quantity: '',
    enquiry: '',
    notes: '',
    score: '',
    status: 'NEW',
  })

  const [saving, setSaving] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [qualificationSettings, setQualificationSettings] = useState({
    requiredFields: ['name', 'contact', 'enquiry'],
    enabledFields: ['name', 'contact', 'enquiry'],
    customFields: [],
  })
  const [customFields, setCustomFields] = useState({})

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const response = await fetch('/api/leads')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load qualification settings')
        }

        if (!cancelled) {
          setQualificationSettings(data.qualificationSettings)
        }
      } catch (err) {
        if (!cancelled) {
          setSettingsLoadFailed(true)
          setError(err.message || 'Unable to load qualification settings')
        }
      } finally {
        if (!cancelled) setLoadingSettings(false)
      }
    }

    loadSettings()
    return () => { cancelled = true }
  }, [])

  const enabledFields = new Set([
    'name',
    'contact',
    'email',
    'phone',
    'enquiry',
    ...(qualificationSettings.enabledFields || []),
    ...(qualificationSettings.requiredFields || []),
  ])
  const requiredFields = new Set([
    'name',
    'contact',
    'enquiry',
    ...(qualificationSettings.requiredFields || []),
  ])

  function updateCustomField(key, value) {
    setCustomFields(prev => ({ ...prev, [key]: value }))
  }

  function updateField(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (loadingSettings) {
      setError('Please wait while the business settings load.')
      return
    }

    if (settingsLoadFailed) {
      setError('Business qualification settings could not be loaded. Please refresh the page and try again.')
      return
    }

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

    for (const field of qualificationSettings.customFields || []) {
      if (field.required && !String(customFields[field.key] || '').trim()) {
        setError(`Please complete ${field.label || field.key}.`)
        return
      }
    }

    setSaving(true)

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...form, customFields }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create lead')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>

        <div className={styles.topBar}>
          <div>
            <Link href="/dashboard" className={styles.backLink}>
              ← Back to leads
            </Link>

            <div className={styles.heading}>
              <span className={styles.eyebrow}>LEADS</span>
              <h1>New lead</h1>
              <p>Add a lead directly to your CRM.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>

          {loadingSettings && <p>Loading business qualification settings...</p>}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Contact details</h2>
                <p>Basic information about the customer.</p>
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="name">Name <span>*</span></label>
                <input
                  id="name"
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => updateField('phone', e.target.value)}
                />
              </div>


            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Lead details</h2>
                <p>Information about the enquiry and opportunity.</p>
              </div>
            </div>

            <div className={styles.grid}>

            </div>

            <div className={styles.fullField}>
              <label htmlFor="enquiry">Enquiry details *</label>
              <textarea
                id="enquiry"
                rows="5"
                value={form.enquiry}
                onChange={e => updateField('enquiry', e.target.value)}
                required
              />
            </div>

            <div className={styles.fullField}>
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                rows="4"
                value={form.notes}
                onChange={e => updateField('notes', e.target.value)}
              />
            </div>
          </section>



          {(qualificationSettings.customFields || []).length > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Additional qualification details</h2>
                  <p>Custom questions configured for this business.</p>
                </div>
              </div>

              {(qualificationSettings.customFields || []).map(field => (
                <div className={styles.fullField} key={field.key}>
                  <label htmlFor={`custom-${field.key}`}>
                    {field.label || field.key}{field.required ? ' *' : ''}
                  </label>
                  {field.description && <p>{field.description}</p>}
                  <textarea
                    id={`custom-${field.key}`}
                    rows="2"
                    value={customFields[field.key] == null ? '' : String(customFields[field.key])}
                    onChange={e => updateCustomField(field.key, e.target.value)}
                    required={Boolean(field.required)}
                  />
                </div>
              ))}
            </section>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <Link href="/dashboard" className={styles.cancel}>
              Cancel
            </Link>

            <button
              type="submit"
              className={styles.save}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save lead'}
            </button>
          </div>

        </form>
      </div>
    </main>
  )
}
