'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const statuses = ['NEW', 'CONTACTED', 'WON', 'LOST']

const styles = {
  NEW: { background: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  CONTACTED: { background: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  WON: { background: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  LOST: { background: '#fef2f2', color: '#dc2626', border: '#fecaca' },
}

export default function LeadStatusSelect({ leadId, status, initialStatus }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const startingStatus = status || initialStatus || 'NEW'
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(startingStatus)

  async function handleChange(event) {
    const nextStatus = event.target.value
    setValue(nextStatus)
    setSaving(true)

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', status: nextStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update status')
      }

      router.replace(`/dashboard?${searchParams.toString()}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setValue(startingStatus)
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  const style = styles[value] || styles.NEW

  return (
    <span onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      aria-label="Lead status"
      style={{
        appearance: 'none',
        WebkitAppearance: 'none',
        padding: '5px 24px 5px 9px',
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        backgroundColor: style.background,
        color: style.color,
        fontSize: 12,
        fontWeight: 700,
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.65 : 1,
        minWidth: 96,
      }}
    >
        {statuses.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </span>
  )
}
