'use client'

import { useState } from 'react'

const statuses = ['NEW', 'CONTACTED', 'WON', 'LOST']

export default function LeadStatusSelect({ leadId, initialStatus }) {
  const [status, setStatus] = useState(initialStatus || 'NEW')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(event) {
    const nextStatus = event.target.value
    const previousStatus = status

    setStatus(nextStatus)
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/leads/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId,
          status: nextStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to save status')
      }
    } catch (err) {
      setStatus(previousStatus)
      setError('Could not save status. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <select
        value={status}
        onChange={handleChange}
        disabled={saving}
        className="statusSelect"
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {saving && <small className="savingStatus">Saving...</small>}
      {error && <small className="statusError">{error}</small>}
    </div>
  )
}
