import Link from 'next/link'
import LeadActions from '../../../../components/LeadActions'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import LeadNotes from '../../../../components/LeadNotes'
import LeadActivityTimeline from '../../../../components/LeadActivityTimeline'
import LeadFollowUp from '../../../../components/LeadFollowUp'
import LeadStatusSelect from '../../../../components/LeadStatusSelect'
import LeadPageRefresh from '../../../../components/LeadPageRefresh'

export default async function LeadDetails({ params }) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!lead) notFound()

  let customFieldDefinitions = []

  if (lead.assistant_id) {
    const admin = createAdminClient()
    const { data: assistant } = await admin
      .from('assistants')
      .select('qualification_settings')
      .eq('id', lead.assistant_id)
      .eq('organization_id', membership.organization_id)
      .maybeSingle()

    const definitions = assistant?.qualification_settings?.customFields
    customFieldDefinitions = Array.isArray(definitions) ? definitions : []
  }

  const customFieldLabels = new Map(
    customFieldDefinitions
      .filter(field => field?.key && field?.label)
      .map(field => [field.key, field.label])
  )

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, session_id, created_at')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: true })

  const conversationIds = (conversations || []).map((conversation) => conversation.id)

  let messages = []

  if (conversationIds.length > 0) {
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true })

    messages = data || []
  }

  const scoreClass = lead.score?.toLowerCase() || 'unscored'

  return (
    <main className="app">

      <section className="wrap">
        <LeadPageRefresh leadId={lead.id} />
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard">← Back to leads</Link>
        </div>

        <div className="leadDetailHeader">
          <div>
            <small>LEAD DETAILS</small>
            <h1>{lead.name || 'Unnamed lead'}</h1>
            <p>{lead.enquiry || lead.service || 'General enquiry'}</p>
          </div>

          <div className={`leadScore ${scoreClass}`}>
            {lead.score || 'Unscored'}
          </div>
        </div>

        <LeadActions
          leadId={lead.id}
          archived={Boolean(lead.archived_at)}
          role={membership.role}
        />

        {Object.keys(lead.custom_fields || {}).length > 0 && (
          <section className="card" style={{ marginTop: 24 }}>
            <h2>Additional qualification details</h2>
            <div className="detailList">
              {Object.entries(lead.custom_fields || {}).map(([key, value]) => (
                <div key={key}>
                  <small>{customFieldLabels.get(key) || key.replace(/_/g, ' ')}</small>
                  <strong>
                    {value == null || value === '' ? 'Not provided' : String(value)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="leadDetailGrid">
          <section className="card">
            <h2>Contact details</h2>

            <div className="detailList">
              <div>
                <small>Name</small>
                <strong>{lead.name || 'Not provided'}</strong>
              </div>

              <div>
                <small>Email</small>
                <strong>{lead.email || 'Not provided'}</strong>
              </div>

              <div>
                <small>Phone</small>
                <strong>{lead.phone || 'Not provided'}</strong>
              </div>

              <div>
                <small>Location</small>
                <strong>{lead.location || 'Not provided'}</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Enquiry</h2>

            <div className="detailList">
              <div>
                <small>Service</small>
                <strong>{lead.service || 'Not provided'}</strong>
              </div>

              <div>
                <small>Budget</small>
                <strong>{lead.budget || 'Not provided'}</strong>
              </div>

              <div>
                <small>Timescale</small>
                <strong>{lead.timescale || 'Not provided'}</strong>
              </div>


              <div>
                <small>Status</small>
                <LeadStatusSelect leadId={lead.id} initialStatus={lead.status || 'NEW'} />
              </div>
            </div>

            {lead.summary && (
              <div className="summary">
                <small>AI summary</small>
                <p>{lead.summary}</p>
              </div>
            )}
          </section>
        </div>

            <LeadFollowUp lead={lead} />

      <LeadActivityTimeline leadId={lead.id} />

            <div className="leadNotesSpacing"><LeadNotes leadId={lead.id} /></div>

<section className="card conversationCard">
          <details className="leadSectionDisclosure" open>
            <summary>
              <span><strong>AI Conversations</strong><small>Previous conversations between customers and the AI Sales Assistant.</small></span>
              <span className="leadDisclosureHint">{messages.length} messages</span>
            </summary>

            {messages.length === 0 ? (
              <p>No AI conversation messages found for this lead.</p>
            ) : (
              <div className="conversationHistory leadScrollablePanel" aria-label="AI conversation history">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.role === 'user' ? 'customer' : 'assistant'}`}
                  >
                    <small>
                      {message.role === 'user' ? 'Customer' : 'AI Sales Assistant'}
                    </small>
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
            )}
          </details>
        </section>
      </section>
    </main>
  )
}
