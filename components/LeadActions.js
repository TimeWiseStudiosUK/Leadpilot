'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LeadActions({ leadId, archived = false }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function archiveOrRestore() {
    const action = archived ? 'restore' : 'archive'

    const confirmed = window.confirm(
      archived
        ? 'Restore this lead to your active leads?'
        : 'Archive this lead? It will be removed from your active leads but can be restored later.'
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        window.alert(data.error || 'Could not update lead')
        return
      }

      router.push(action === 'archive' ? '/dashboard' : '/dashboard/leads/archived')
      router.refresh()
    } catch {
      window.alert('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteLead() {
    const confirmed = window.confirm(
      'Permanently delete this lead?\n\nThis cannot be undone.'
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        window.alert(data.error || 'Could not delete lead')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      window.alert('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 14,
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Link
        href={`/dashboard/leads/${leadId}/edit`}
        style={{
          padding: '7px 11px',
          borderRadius: 7,
          border: '1px solid #dbe1e8',
          background: '#fff',
          color: '#2563eb',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Edit Lead
      </Link>

      <button
        type="button"
        onClick={archiveOrRestore}
        disabled={busy}
        style={{
          padding: '7px 11px',
          borderRadius: 7,
          border: '1px solid #dbe1e8',
          background: '#fff',
          color: '#475569',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Working...' : archived ? 'Restore Lead' : 'Archive Lead'}
      </button>

      <button
        type="button"
        onClick={deleteLead}
        disabled={busy}
        style={{
          padding: '7px 11px',
          borderRadius: 7,
          border: '1px solid transparent',
          background: 'transparent',
          color: '#b91c1c',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        Delete Lead
      </button>
    </div>
  )
}
