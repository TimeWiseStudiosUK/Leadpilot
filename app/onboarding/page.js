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
    qualificationSettings: {
      requiredFields: ['name', 'contact', 'service', 'enquiry'],
      hotCriteria: '',
      warmCriteria: '',
      readyCriteria: '',
    },
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
        qualificationSettings: {
          requiredFields:
            assistant.qualification_settings?.requiredFields ||
            ['name', 'contact', 'service', 'enquiry'],
          hotCriteria:
            assistant.qualification_settings?.hotCriteria || '',
          warmCriteria:
            assistant.qualification_settings?.warmCriteria || '',
          readyCriteria:
            assistant.qualification_settings?.readyCriteria || '',
        },
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

        <p className="hint">
          Choose what the AI should collect before handing an enquiry to your team.
        </p>

        <label>
          Information to collect
        </label>

        <div style={{
          display: 'grid',
          gap: 10,
          marginBottom: 20,
        }}>
          {[
            ['name', 'Customer name'],
            ['contact', 'Phone or email'],
            ['postcode', 'Postcode / location'],
            ['service', 'Service required'],
            ['property_type', 'Property / business type'],
            ['timescale', 'Timescale'],
            ['enquiry', 'Enquiry details'],
          ].map(([value, label]) => (
            <label
              key={value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontWeight: 400,
              }}
            >
              <input
                type="checkbox"
                checked={form.qualificationSettings.requiredFields.includes(value)}
                onChange={e => {
                  const current = form.qualificationSettings.requiredFields

                  const requiredFields = e.target.checked
                    ? [...new Set([...current, value])]
                    : current.filter(field => field !== value)

                  set(
                    'qualificationSettings',
                    {
                      ...form.qualificationSettings,
                      requiredFields,
                    }
                  )
                }}
                style={{ width: 18, height: 18 }}
              />
              {label}
            </label>
          ))}
        </div>

        <div
          style={{
            marginTop: 28,
            marginBottom: 8,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Lead scoring
        </div>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 18,
          }}
        >
          <span style={{ fontWeight: 700 }}>
            HOT lead criteria
          </span>
          <span
            className="hint"
            style={{
              display: 'block',
              marginTop: -2,
              lineHeight: 1.45,
            }}
          >
            What makes an enquiry a strong immediate opportunity?
          </span>
          <textarea
            value={form.qualificationSettings.hotCriteria}
            onChange={e =>
              set(
                'qualificationSettings',
                {
                  ...form.qualificationSettings,
                  hotCriteria: e.target.value,
                }
              )
            }
            rows="5"
            placeholder="For example: urgent work, ready to proceed, clear scope of work, high-value project..."
          />
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 18,
          }}
        >
          <span style={{ fontWeight: 700 }}>
            WARM lead criteria
          </span>
          <span
            className="hint"
            style={{
              display: 'block',
              marginTop: -2,
              lineHeight: 1.45,
            }}
          >
            What makes an enquiry genuine but not yet ready to buy?
          </span>
          <textarea
            value={form.qualificationSettings.warmCriteria}
            onChange={e =>
              set(
                'qualificationSettings',
                {
                  ...form.qualificationSettings,
                  warmCriteria: e.target.value,
                }
              )
            }
            rows="5"
            placeholder="For example: researching options, longer-term project, needs more information..."
          />
        </label>

        <div
          style={{
            marginTop: 28,
            marginBottom: 8,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Handover
        </div>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 18,
          }}
        >
          <span style={{ fontWeight: 700 }}>
            Ready to contact
          </span>
          <span
            className="hint"
            style={{
              display: 'block',
              marginTop: -2,
              lineHeight: 1.45,
            }}
          >
            When should the AI hand the enquiry to a salesperson?
          </span>
          <textarea
            value={form.qualificationSettings.readyCriteria}
            onChange={e =>
              set(
                'qualificationSettings',
                {
                  ...form.qualificationSettings,
                  readyCriteria: e.target.value,
                }
              )
            }
            rows="5"
            placeholder="For example: all required information has been collected and the customer has provided a phone number or email..."
          />
        </label>

        <div
          style={{
            marginTop: 28,
            marginBottom: 8,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Additional AI instructions
        </div>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 18,
          }}
        >
          <span
            className="hint"
            style={{
              display: 'block',
              lineHeight: 1.45,
            }}
          >
            General instructions for how the AI should handle enquiries.
            These should not be used to define mandatory information, as that
            is controlled by the required information settings above.
          </span>
          <textarea
            value={form.rules}
            onChange={e => set('rules', e.target.value)}
            rows="5"
            placeholder="For example: prioritise urgent enquiries, be concise, explain services clearly and avoid repeating questions..."
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
