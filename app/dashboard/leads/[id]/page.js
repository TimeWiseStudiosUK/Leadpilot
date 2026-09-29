import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import LeadStatusSelect from '../../../../components/LeadStatusSelect'

export default async function LeadDetails({ params }) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
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

  const scoreClass = lead.score?.toLowerCase() || 'cold'

  return (
    <main className="app">
      <header className="bar">
        <div>
          <strong>LeadPilot</strong>
          <span>AI Sales Assistant</span>
        </div>

        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/assistant">Assistant</Link>
          <Link href="/onboarding">Settings</Link>
        </nav>
      </header>

      <section className="wrap">
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
            {lead.score || 'COLD'}
          </div>
        </div>

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
                <small>Postcode</small>
                <strong>{lead.postcode || 'Not provided'}</strong>
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
                <small>Property type</small>
                <strong>{lead.property_type || 'Not provided'}</strong>
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

        <section className="card conversationCard">
          <div className="sectionHeading">
            <div>
              <h2>Conversation history</h2>
              <p>The complete conversation between the customer and AI Sales Assistant.</p>
            </div>
          </div>

          {messages.length === 0 ? (
            <p>No conversation messages found for this lead.</p>
          ) : (
            <div className="conversationHistory">
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
        </section>
      </section>
    </main>
  )
}
