'use client'

import { useEffect, useState } from 'react'

export default function LeadNotes({ leadId }) {
  const [notes, setNotes] = useState([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadNotes() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        `/api/leads/notes?leadId=${encodeURIComponent(leadId)}`
      )

      if (!response.ok) {
        throw new Error('Unable to load notes')
      }

      const data = await response.json()
      setNotes(data.notes || [])
    } catch (err) {
      console.error(err)
      setError('Unable to load notes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (leadId) {
      loadNotes()
    }
  }, [leadId])

  async function saveNote() {
    if (!note.trim() || saving) return

    try {
      setSaving(true)
      setError('')

      const response = await fetch('/api/leads/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId,
          note: note.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to save note')
      }

      const data = await response.json()

      if (data.note) {
        setNotes((current) => [data.note, ...current])
      }

      setNote('')
    } catch (err) {
      console.error(err)
      setError('Unable to save note. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <section className="card notesCard">
      <div className="sectionHeading">
        <div>
          <h2>Internal notes</h2>
          <p>
            Private notes for your team. These are not shown to the customer or AI assistant.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <textarea
          className="notesInput"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note about this lead..."
          rows={5}
          disabled={saving}
        />

        <div className="notesActions">
          <button
            type="button"
            className="saveNotesButton"
            onClick={saveNote}
            disabled={saving || !note.trim()}
          >
            {saving ? 'Saving...' : 'Add note'}
          </button>
        </div>

        {error && (
          <p className="statusError" style={{ marginTop: 10 }}>
            {error}
          </p>
        )}
      </div>

      <div>
        <h3 style={{ marginBottom: 14 }}>Note history</h3>

        {loading ? (
          <p>Loading notes...</p>
        ) : notes.length === 0 ? (
          <p>No notes have been added yet.</p>
        ) : (
          <div>
            {notes.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '16px 0',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#64748b',
                    marginBottom: 7,
                  }}
                >
                  {formatDate(item.created_at)}
                </div>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                  }}
                >
                  {item.note}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
