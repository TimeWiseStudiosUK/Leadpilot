'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function NewLeadPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    postcode: '',
    service: '',
    propertyType: '',
    timescale: '',
    enquiry: '',
    notes: '',
    score: 'COLD',
    status: 'NEW',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
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
                <p>Information about the enquiry and opportunity.</p>
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

              <div className={styles.field}>
                <label htmlFor="score">Lead score</label>
                <select
                  id="score"
                  value={form.score}
                  onChange={e => updateField('score', e.target.value)}
                >
                  <option value="HOT">Hot</option>
                  <option value="WARM">Warm</option>
                  <option value="COLD">Cold</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={form.status}
                  onChange={e => updateField('status', e.target.value)}
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
            </div>

            <div className={styles.fullField}>
              <label htmlFor="enquiry">Enquiry</label>
              <textarea
                id="enquiry"
                rows="5"
                value={form.enquiry}
                onChange={e => updateField('enquiry', e.target.value)}
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
