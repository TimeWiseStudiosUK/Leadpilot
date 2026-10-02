'use client'

import { useEffect, useState } from 'react'

const actionLabels = {
  CALL: 'Call',
  EMAIL: 'Email',
  FOLLOW_UP: 'Follow up',
  QUOTE: 'Quote',
  CHECK_IN: 'Check in',
}

function formatDueAt(value) {
  if (!value) return ''

  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LeadFollowUp({ leadId }) {
  const [followUp, setFollowUp] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assessing, setAssessing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  async function loadFollowUp() {
    setLoading(true)

    try {
      const response = await fetch(
        `/api/leads/follow-ups?leadId=${encodeURIComponent(leadId)}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load follow-up')
      }

      setFollowUp(data.followUps?.[0] || null)
    } catch (err) {
      setError(err.message || 'Unable to load follow-up')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFollowUp()
  }, [leadId])

  async function assess() {
    setAssessing(true)
    setError('')

    try {
      const response = await fetch('/api/leads/follow-ups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to assess follow-up')
      }

      setAssessment(data.assessment || null)
      setFollowUp(data.followUp || null)
    } catch (err) {
      setError(err.message || 'Unable to assess follow-up')
    } finally {
      setAssessing(false)
    }
  }

  async function updateStatus(status) {
    if (!followUp) return

    setUpdating(true)
    setError('')

    try {
      const response = await fetch('/api/leads/follow-ups', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: followUp.id,
          status,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update follow-up')
      }

      setFollowUp(data.followUp)
    } catch (err) {
      setError(err.message || 'Unable to update follow-up')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <section className="card aiFollowUpCard">
      <div className="sectionHeading">
        <div>
          <h2>AI Follow-Up</h2>
          <p>AI-generated recommendation for the next sales action.</p>
        </div>

        <button
          type="button"
          className="followUpAssessButton"
          onClick={assess}
          disabled={assessing || loading}
        >
          {assessing ? 'Assessing...' : followUp ? 'Reassess' : 'Ask AI to assess'}
        </button>
      </div>

      {error && <div className="followUpError">{error}</div>}

      {loading ? (
        <div className="followUpEmpty">
          Loading follow-up information...
        </div>
      ) : followUp ? (
        <>
          <div className="followUpGrid">
            <div className="followUpStatus">
              <small>Follow-up</small>
              <strong>
                {followUp.status === 'COMPLETED'
                  ? 'Completed'
                  : followUp.status === 'SNOOZED'
                    ? 'Snoozed'
                    : followUp.status === 'CANCELLED'
                      ? 'Cancelled'
                      : 'Required'}
              </strong>
            </div>

            <div className="followUpStatus">
              <small>Action</small>
              <strong>
                {actionLabels[followUp.action] || followUp.action}
              </strong>
            </div>

            <div className="followUpStatus">
              <small>Due</small>
              <strong>{formatDueAt(followUp.due_at)}</strong>
            </div>
          </div>

          {followUp.reason && (
            <div className="followUpReason">
              <small>Why this action</small>
              <p>{followUp.reason}</p>
            </div>
          )}

          {followUp.suggested_message && (
            <div className="followUpMessage">
              <small>Suggested message</small>
              <p>{followUp.suggested_message}</p>
            </div>
          )}

          {followUp.status === 'PENDING' && (
            <div className="followUpActions">
              <button
                type="button"
                className="followUpSecondaryButton"
                onClick={() => updateStatus('SNOOZED')}
                disabled={updating}
              >
                Snooze
              </button>

              <button
                type="button"
                className="followUpCompleteButton"
                onClick={() => updateStatus('COMPLETED')}
                disabled={updating}
              >
                {updating ? 'Updating...' : 'Mark complete'}
              </button>

              <button
                type="button"
                className="followUpCancelButton"
                onClick={() => updateStatus('CANCELLED')}
                disabled={updating}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      ) : assessment ? (
        <div className="followUpRecommendation">
          <div className="followUpRecommendationHeader">
            <div>
              <small>Follow-up required</small>
              <strong>
                {assessment.follow_up_required ? 'Yes' : 'No'}
              </strong>
            </div>

            {assessment.follow_up_required && (
              <>
                <div>
                  <small>Recommended action</small>
                  <strong>
                    {actionLabels[assessment.recommended_action] ||
                      assessment.recommended_action}
                  </strong>
                </div>

                <div>
                  <small>Recommended timing</small>
                  <strong>{assessment.recommended_timing}</strong>
                </div>
              </>
            )}
          </div>

          {assessment.reason && (
            <div className="followUpReason">
              <small>Why this action</small>
              <p>{assessment.reason}</p>
            </div>
          )}

          {assessment.suggested_message && (
            <div className="followUpMessage">
              <small>Suggested message</small>
              <p>{assessment.suggested_message}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="followUpEmpty">
          Ask AI to assess this lead and recommend the next action.
        </div>
      )}
    </section>
  )
}
