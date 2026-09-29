'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function Assistant({ params }) {
  const [slug, setSlug] = useState(null)
  const [assistant, setAssistant] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const messagesRef = useRef(null)

  const [session] = useState(() =>
    typeof crypto !== 'undefined'
      ? crypto.randomUUID()
      : String(Date.now())
  )

  useEffect(() => {
    Promise.resolve(params).then((p) => setSlug(p.slug))
  }, [params])

  useEffect(() => {
    if (!slug) return

    async function loadAssistant() {
      try {
        const response = await fetch(
          `/api/chat?slug=${encodeURIComponent(slug)}`
        )

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Could not load assistant')
          return
        }

        setAssistant(data)
      } catch {
        setError('Could not load assistant')
      }
    }

    loadAssistant()
  }, [slug])

  useEffect(() => {
    const container = messagesRef.current

    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, busy])

  async function send() {
    if (!input.trim() || busy || !slug) return

    const text = input.trim()

    setInput('')
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
    ])

    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug,
          sessionId: session,
          message: text,
        }),
      })

      const data = await response.json()

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            data.reply ||
            data.error ||
            'Sorry, something went wrong.',
        },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="chat-page">
      <div className="chat-card">

        <header>
          <Link
            href="/dashboard"
            style={{
              textDecoration: 'none',
              marginRight: '14px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            ← Dashboard
          </Link>

          <div className="logo">LP</div>

          <div>
            <b>{assistant?.name || 'LeadPilot AI'}</b>
            <small>Sales assistant</small>
          </div>
        </header>

        <div
          className="messages"
          ref={messagesRef}
        >
          {error ? (
            <div className="msg ai">
              {error}
            </div>
          ) : (
            <div className="msg ai">
              {assistant?.greeting || 'Loading assistant...'}
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`msg ${m.role === 'assistant' ? 'ai' : 'user'}`}
            >
              {m.content}
            </div>
          ))}

          {busy && (
            <div className="msg ai">
              Thinking...
            </div>
          )}
        </div>

        <div className="composer">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && send()
            }
            placeholder="Type a customer enquiry..."
            disabled={!assistant || busy}
          />

          <button
            onClick={send}
            disabled={!assistant || busy}
          >
            Send
          </button>
        </div>

      </div>
    </main>
  )
}
