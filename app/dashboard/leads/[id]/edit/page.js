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
    postcode: '',
    service: '',
    propertyType: '',
    timescale: '',
    enquiry: '',
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

        setForm({
          name: lead.name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          postcode: lead.postcode || '',
          service: lead.service || '',
          propertyType: lead.property_type || '',
          timescale: lead.timescale || '',
          enquiry: lead.enquiry || '',
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
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Please enter the lead name.')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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
            <Link
              href={`/dashboard/leads/${leadId}`}
              className={styles.backLink}
            >
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

              <div className={styles.field}>
                <label htmlFor="postcode">Postcode</label>
                <input
                  id="postcode"
                  value={form.postcode}
                  onChange={e => updateField('postcode', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Lead details</h2>
                <p>Update the enquiry information. Meaningful changes will trigger an AI reassessment.</p>
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="service">Service</label>
                <input
                  id="service"
                  value={form.service}
                  onChange={e => updateField('service', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="propertyType">Property type</label>
                <input
                  id="propertyType"
                  value={form.propertyType}
                  onChange={e => updateField('propertyType', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="timescale">Timescale</label>
                <input
                  id="timescale"
                  value={form.timescale}
                  onChange={e => updateField('timescale', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fullField}>
              <label htmlFor="enquiry">Enquiry</label>
              <textarea
                id="enquiry"
                rows="7"
                value={form.enquiry}
                onChange={e => updateField('enquiry', e.target.value)}
              />
            </div>
          </section>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <Link
              href={`/dashboard/leads/${leadId}`}
              className={styles.cancel}
            >
              Cancel
            </Link>

            <button
              type="submit"
              className={styles.save}
              disabled={saving}
            >
              {saving ? 'Saving and assessing...' : 'Save changes'}
            </button>
          </div>

        </form>
      </div>
    </main>
  )
}
