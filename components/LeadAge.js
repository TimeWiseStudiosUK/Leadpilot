'use client'

import { useEffect, useState } from 'react'

function getAgeLabel(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))

  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`

  const years = Math.floor(days / 365)
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}

function formatLocalDate(date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LeadAge({ timestamp }) {
  const date = new Date(timestamp)
  const [formattedDate, setFormattedDate] = useState('')
  const [age, setAge] = useState('')

  useEffect(() => {
    const update = () => {
      setFormattedDate(formatLocalDate(date))
      setAge(getAgeLabel(date))
    }

    update()

    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [timestamp])

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <small
        suppressHydrationWarning
        style={{ color: '#475569', fontSize: 12 }}
      >
        {formattedDate || '—'}
      </small>
      <small style={{ color: '#94a3b8', fontSize: 12 }}>
        {age || 'Just now'}
      </small>
    </span>
  )
}
