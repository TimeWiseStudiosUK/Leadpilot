'use client'

import { useEffect, useState } from 'react'

const activityLabels = {
  CREATED: 'Lead created',
  STATUS_CHANGED: 'Status changed',
  NOTE_ADDED: 'Note added',
  CALL: 'Call',
  EMAIL: 'Email',
  FOLLOW_UP: 'Follow-up',
  AI_ASSESSED: 'AI assessed',
}

const activityIcons = {
  CREATED: '+',
  STATUS_CHANGED: '↔',
  NOTE_ADDED: 'N',
  CALL: '☎',
  EMAIL: '@',
  FOLLOW_UP: '→',
  AI_ASSESSED: 'AI',
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function LeadActivityTimeline({ leadId }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadActivities() {
      try {
        const response = await fetch('/api/leads/activities?leadId=' + encodeURIComponent(leadId))
        const data = await response.json()

        if (response.ok == false) {
          throw new Error(data.error || 'Unable to load activity')
        }

        if (active) {
          setActivities(data.activities || [])
          setError('')
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load activity')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadActivities()

    return () => {
      active = false
    }
  }, [leadId])

  return (
    <section className='card leadActivityCard'>
      <div className='sectionHeading'>
        <div>
          <h2>Activity</h2>
          <p>A timeline of everything that has happened with this lead.</p>
        </div>
      </div>

      {loading && (
        <div className='activityEmpty'>
          Loading activity...
        </div>
      )}

      {loading == false && error && (
        <div className='activityError'>
          {error}
        </div>
      )}

      {loading == false && error == '' && activities.length == 0 && (
        <div className='activityEmpty'>
          No activity recorded yet.
        </div>
      )}

      {loading == false && error == '' && activities.length > 0 && (
        <div className='activityTimeline'>
          {activities.map((activity) => (
            <div className='activityItem' key={activity.id}>
              <div className='activityIcon'>
                {activityIcons[activity.activity_type] || '•'}
              </div>

              <div className='activityContent'>
                <div className='activityTop'>
                  <strong>
                    {activity.title || activityLabels[activity.activity_type] || 'Activity'}
                  </strong>
                  <time dateTime={activity.created_at}>
                    {formatDate(activity.created_at)}
                  </time>
                </div>

                {activity.description && (
                  <p>{activity.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
