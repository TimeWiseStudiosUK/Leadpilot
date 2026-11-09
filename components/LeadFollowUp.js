'use client'

import { useEffect, useState } from 'react'
import { notifyLeadDataChanged } from '../lib/lead-refresh'

const actionLabels = { CALL: 'Call', EMAIL: 'Email', FOLLOW_UP: 'Follow up', QUOTE: 'Quote', CHECK_IN: 'Check in' }
const statusLabels = { PENDING: 'Pending', SNOOZED: 'Snoozed', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }
const emptyForm = { action: 'CALL', dueAt: '', reason: '', suggestedMessage: '' }

function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function formatDueAt(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function LeadFollowUp({ lead }) {
  const leadId = lead.id
  const [followUps, setFollowUps] = useState([])
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assessing, setAssessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  async function loadFollowUps() {
    setLoading(true)
    try {
      const response = await fetch(`/api/leads/follow-ups?leadId=${encodeURIComponent(leadId)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load follow-ups')
      setFollowUps(data.followUps || [])
      setAssessment(data.latestAssessment || null)
    } catch (err) { setError(err.message || 'Unable to load follow-ups') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadFollowUps() }, [leadId])

  function startNew() {
    setEditingId(null)
    setForm({ ...emptyForm, dueAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)) })
    setShowForm(true)
    setError('')
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({ action: item.action, dueAt: toLocalInput(item.due_at), reason: item.reason || '', suggestedMessage: item.suggested_message || '' })
    setShowForm(true)
    setError('')
  }

  async function saveFollowUp(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/leads/follow-ups', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId
          ? { id: editingId, action: form.action, dueAt: new Date(form.dueAt).toISOString(), reason: form.reason, suggestedMessage: form.suggestedMessage }
          : { leadId, action: form.action, dueAt: new Date(form.dueAt).toISOString(), reason: form.reason, suggestedMessage: form.suggestedMessage, source: 'MANUAL' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save follow-up')
      setError(data.activityWarning ? `Follow-up saved, but its activity log could not be recorded: ${data.activityWarning}` : '')
      setShowForm(false)
      setEditingId(null)
      await loadFollowUps()
      notifyLeadDataChanged(leadId)
    } catch (err) { setError(err.message || 'Unable to save follow-up') }
    finally { setSaving(false) }
  }

  async function updateFollowUp(id, changes) {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/leads/follow-ups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...changes }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to update follow-up')
      setError(data.activityWarning ? `Follow-up updated, but its activity log could not be recorded: ${data.activityWarning}` : '')
      await loadFollowUps()
      notifyLeadDataChanged(leadId)
    } catch (err) { setError(err.message || 'Unable to update follow-up') }
    finally { setSaving(false) }
  }

  async function assess() {
    setAssessing(true)
    setError('')
    try {
      const response = await fetch('/api/leads/follow-ups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to assess follow-up')
      setAssessment(data.assessment || null)
      setError(data.activityWarning ? `Assessment completed, but its activity log could not be recorded: ${data.activityWarning}` : '')
      await loadFollowUps()
      notifyLeadDataChanged(leadId)
    } catch (err) { setError(err.message || 'Unable to assess follow-up') }
    finally { setAssessing(false) }
  }

  const activeFollowUps = followUps.filter(item => ['PENDING', 'SNOOZED'].includes(item.status))
  const historicalFollowUps = followUps.filter(item => ['COMPLETED', 'CANCELLED'].includes(item.status))
  const activeCount = activeFollowUps.length

  return (
    <section className="card aiFollowUpCard unifiedFollowUpCard">
      <div className="sectionHeading">
        <div><h2>AI Handover &amp; Follow-Ups</h2><p>Lead readiness, AI recommendations and all planned sales actions in one place.</p></div>
        <div className="unifiedFollowUpHeaderActions">
          <button type="button" className="followUpAssessButton" onClick={assess} disabled={assessing || loading || lead.status === 'WON' || lead.status === 'LOST'}>{assessing ? 'Assessing...' : 'Ask AI to assess'}</button>
          <button type="button" className="followUpCompleteButton" onClick={startNew}>+ Add follow-up</button>
        </div>
      </div>

      <div className="unifiedHandoverGrid">
        <div className="handoverStatus"><small>Lead score</small><strong className={`leadScore ${lead.score ? lead.score.toLowerCase() : 'unscored'}`}>{lead.score || 'Unscored'}</strong></div>
        <div className="handoverStatus"><small>Contact readiness</small><strong className={lead.ready_to_contact ? 'readyYes' : 'readyNo'}>{lead.ready_to_contact ? 'Ready to contact' : 'More information needed'}</strong></div>
        <div className="handoverStatus"><small>Lead status</small><strong className="handoverLeadStatus">{(lead.status || 'NEW').replace(/_/g, ' ')}</strong></div>
      </div>

      {lead.ready_to_contact && lead.status !== 'WON' && lead.status !== 'LOST' && (lead.phone || lead.email) && <div className="contactActions"><div><small>Contact customer</small><p>Take the next step with this lead.</p></div><div className="contactActionButtons">{lead.phone && <a className="contactButton callButton" href={`tel:${lead.phone}`}>Call</a>}{lead.email && <a className="contactButton emailButton" href={`mailto:${lead.email}`}>Email</a>}</div></div>}

      {error && <div className="followUpError">{error}</div>}

      {showForm && <form className="manualFollowUpForm" onSubmit={saveFollowUp}>
        <div className="manualFollowUpFormHeading"><h3>{editingId ? 'Edit follow-up' : 'Create manual follow-up'}</h3><button type="button" className="followUpCancelButton" onClick={() => setShowForm(false)}>Close</button></div>
        <div className="manualFollowUpFields">
          <label>Action<select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Due date and time<input type="datetime-local" required value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} /></label>
          <label className="manualFollowUpWide">Description / reason<textarea rows="2" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="What needs to happen?" /></label>
          <label className="manualFollowUpWide">Notes or suggested message<textarea rows="3" value={form.suggestedMessage} onChange={e => setForm({ ...form, suggestedMessage: e.target.value })} placeholder="Add useful context or a draft message (optional)" /></label>
        </div>
        <div className="followUpActions"><button type="button" className="followUpSecondaryButton" onClick={() => setShowForm(false)}>Discard</button><button type="submit" className="followUpCompleteButton" disabled={saving || !form.dueAt}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create follow-up'}</button></div>
      </form>}

      {assessment && <div className="followUpRecommendation"><strong>Latest AI assessment</strong><p>{assessment.reason || (assessment.follow_up_required ? `Recommended: ${actionLabels[assessment.recommended_action] || assessment.recommended_action}, ${assessment.recommended_timing}.` : 'No further follow-up recommended at this time.')}</p>{assessment.suggested_message && <p>{assessment.suggested_message}</p>}</div>}

      <div className="followUpListHeading"><h3>Active follow-ups</h3><span>{activeCount} active</span></div>
      {loading ? <div className="followUpEmpty">Loading follow-ups...</div> : activeFollowUps.length === 0 ? <div className="followUpEmpty">No active follow-ups. Ask AI to assess the lead or add a manual follow-up.</div> : <div className="unifiedFollowUpList followUpScrollablePanel">{activeFollowUps.map(item => <article className={`unifiedFollowUpItem ${item.status.toLowerCase()}`} key={item.id}>
        <div className="unifiedFollowUpItemTop"><div><span className={`followUpSource ${item.source === 'AI' ? 'ai' : 'manual'}`}>{item.source === 'AI' ? 'AI generated' : 'Manual'}</span><h4>{actionLabels[item.action] || item.action}</h4></div><span className={`followUpStatusPill ${item.status.toLowerCase()}`}>{statusLabels[item.status] || item.status}</span></div>
        <div className="unifiedFollowUpMeta"><span><strong>Due:</strong> {formatDueAt(item.due_at)}</span></div>
        {item.reason && <p className="unifiedFollowUpReason">{item.reason}</p>}
        {item.suggested_message && <details className="unifiedFollowUpMessage"><summary>View notes / suggested message</summary><p>{item.suggested_message}</p></details>}
        <div className="followUpActions"><button type="button" className="followUpSecondaryButton" disabled={saving} onClick={() => startEdit(item)}>Edit / reschedule</button>{item.status === 'PENDING' ? <button type="button" className="followUpSecondaryButton" disabled={saving} onClick={() => updateFollowUp(item.id, { status: 'SNOOZED' })}>Snooze</button> : <button type="button" className="followUpSecondaryButton" disabled={saving} onClick={() => updateFollowUp(item.id, { status: 'PENDING' })}>Reopen</button>}<button type="button" className="followUpCompleteButton" disabled={saving} onClick={() => updateFollowUp(item.id, { status: 'COMPLETED' })}>Complete</button><button type="button" className="followUpCancelButton" disabled={saving} onClick={() => updateFollowUp(item.id, { status: 'CANCELLED' })}>Cancel</button></div>
      </article>)}</div>}
      {historicalFollowUps.length > 0 && <details className="followUpHistoryDetails"><summary>Follow-up history <span>{historicalFollowUps.length} completed or cancelled</span></summary><div className="unifiedFollowUpList followUpHistoryList">{historicalFollowUps.map(item => <article className={`unifiedFollowUpItem ${item.status.toLowerCase()}`} key={item.id}>
        <div className="unifiedFollowUpItemTop"><div><span className={`followUpSource ${item.source === 'AI' ? 'ai' : 'manual'}`}>{item.source === 'AI' ? 'AI generated' : 'Manual'}</span><h4>{actionLabels[item.action] || item.action}</h4></div><span className={`followUpStatusPill ${item.status.toLowerCase()}`}>{statusLabels[item.status] || item.status}</span></div>
        <div className="unifiedFollowUpMeta"><span><strong>Due:</strong> {formatDueAt(item.due_at)}</span>{item.completed_at && <span><strong>Completed:</strong> {formatDueAt(item.completed_at)}</span>}</div>
        {item.reason && <p className="unifiedFollowUpReason">{item.reason}</p>}
        {item.suggested_message && <details className="unifiedFollowUpMessage"><summary>View notes / suggested message</summary><p>{item.suggested_message}</p></details>}
        <div className="followUpActions"><button type="button" className="followUpSecondaryButton" disabled={saving} onClick={() => updateFollowUp(item.id, { status: 'PENDING' })}>Reopen follow-up</button></div>
      </article>)}</div></details>}
    </section>
  )
}
