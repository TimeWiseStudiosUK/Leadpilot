'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Onboarding() {
  const router = useRouter()
  const sb = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    name: '',
    industry: '',
    businessDescription: '',
    services: '',
    areas: '',
    rules: '',
    greeting: '',
    tone: 'friendly, professional and concise',
  })

  useEffect(() => {
    async function loadSettings() {
      const {
        data: { user },
      } = await sb.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: memberships, error: membershipError } = await sb
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)

      const membership = memberships?.[0]

      if (membershipError || !membership) {
        setError('No business account found.')
        setLoading(false)
        return
      }

      const { data: organisation } = await sb
        .from('organizations')
        .select('*')
        .eq('id', membership.organization_id)
        .single()

      const { data: assistant } = await sb
        .from('assistants')
        .select('*')
        .eq('organization_id', membership.organization_id)
        .eq('active', true)
        .limit(1)
        .maybeSingle()

      if (!organisation || !assistant) {
        setError('Your AI assistant could not be found.')
        setLoading(false)
        return
      }

      setForm({
        name: organisation.name || '',
        industry: organisation.industry || '',
        businessDescription: assistant.business_description || '',
        services: Array.isArray(assistant.services)
          ? assistant.services.join('\n')
          : '',
        areas: Array.isArray(assistant.areas)
          ? assistant.areas.join('\n')
          : '',
        rules: assistant.qualification_rules || '',
        greeting: assistant.greeting || '',
        tone: assistant.tone || 'friendly, professional and concise',
      })

      setLoading(false)
    }

    loadSettings()
  }, [])

  function set(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
    setSaved(false)
  }

  async function save(e) {
    e.preventDefault()

    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const response = await fetch('/api/assistant', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Could not save settings')
        setSaving(false)
        return
      }

      setSaved(true)
      setSaving(false)
    } catch {
      setError('Could not save settings')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="auth">
        <div className="onboard">
          <p>Loading assistant settings...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="auth">
      <form className="onboard" onSubmit={save}>

        <div className="logo">LP</div>

        <h1>AI Sales Assistant</h1>

        <p>
          Configure how your AI employee represents your business
          and handles customer enquiries.
        </p>

        <h2>Business</h2>

        <label>
          Business name
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </label>

        <label>
          Industry
          <input
            value={form.industry}
            onChange={e => set('industry', e.target.value)}
          />
        </label>

        <label>
          Business description
          <textarea
            value={form.businessDescription}
            onChange={e => set('businessDescription', e.target.value)}
            rows="4"
          />
        </label>

        <h2>What you offer</h2>

        <label>
          Services
          <span className="hint">One service per line</span>
          <textarea
            value={form.services}
            onChange={e => set('services', e.target.value)}
            rows="6"
          />
        </label>

        <label>
          Areas covered
          <span className="hint">One area per line</span>
          <textarea
            value={form.areas}
            onChange={e => set('areas', e.target.value)}
            rows="5"
          />
        </label>

        <h2>AI behaviour</h2>

        <label>
          Tone
          <select
            value={form.tone}
            onChange={e => set('tone', e.target.value)}
          >
            <option value="friendly, professional and concise">
              Friendly & professional
            </option>
            <option value="friendly and conversational">
              Friendly & conversational
            </option>
            <option value="professional and formal">
              Professional & formal
            </option>
            <option value="casual and approachable">
              Casual & approachable
            </option>
          </select>
        </label>

        <label>
          Opening message
          <textarea
            value={form.greeting}
            onChange={e => set('greeting', e.target.value)}
            rows="4"
          />
        </label>

        <h2>Lead qualification</h2>

        <label>
          Qualification rules
          <span className="hint">
            Tell the AI what makes an enquiry valuable.
          </span>
          <textarea
            value={form.rules}
            onChange={e => set('rules', e.target.value)}
            rows="7"
          />
        </label>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {saved && (
          <div className="success">
            Settings saved successfully.
          </div>
        )}

        <button disabled={saving}>
          {saving ? 'Saving...' : 'Save assistant settings'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          style={{
            background: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
          }}
        >
          Back to dashboard
        </button>

      </form>
    </main>
  )
}
