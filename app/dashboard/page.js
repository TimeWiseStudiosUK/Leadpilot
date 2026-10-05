import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import LeadAge from '../../components/LeadAge'
import LeadStatusSelect from '../../components/LeadStatusSelect'

export default async function Dashboard({ searchParams }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)

  const membership = memberships?.[0]

  if (!membership) redirect('/onboarding')

  const params = await searchParams

  const search = typeof params?.search === 'string'
    ? params.search.trim()
    : ''

  const score = ['HOT', 'WARM'].includes(params?.score)
    ? params.score
    : ''

  const status = ['NEW', 'CONTACTED', 'WON', 'LOST'].includes(params?.status)
    ? params.status
    : ''

  const sort = params?.sort === 'oldest' ? 'oldest' : 'newest'

  const [
    { data: org },
    { data: assistant },
  ] = await Promise.all([
    supabase
      .from('organizations')
      .select('*')
      .eq('id', membership.organization_id)
      .single(),

    supabase
      .from('assistants')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .limit(1)
      .maybeSingle(),
  ])

  const { data: allActiveLeads } = await supabase
    .from('leads')
    .select('status, id, name, score, ready_to_contact, created_at')
    .eq('organization_id', membership.organization_id)
    .is('archived_at', null)

  const now = new Date()
  const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: dueFollowUps } = await supabase
    .from('lead_follow_ups')
    .select('id, lead_id, due_at, action, status')
    .eq('organization_id', membership.organization_id)
    .in('status', ['PENDING', 'SNOOZED'])
    .lte('due_at', now.toISOString())
    .order('due_at', { ascending: true })
    .limit(10)

  let leadsQuery = supabase
    .from('leads')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .is('archived_at', null)

  if (search) {
    const safeSearch = search
      .replace(/[%(),]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100)

    if (safeSearch) {
      leadsQuery = leadsQuery.or(
        `name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%,service.ilike.%${safeSearch}%,enquiry.ilike.%${safeSearch}%`
      )
    }
  }

  if (score) {
    leadsQuery = leadsQuery.eq('score', score)
  }

  if (status) {
    leadsQuery = leadsQuery.eq('status', status)
  }

  leadsQuery = leadsQuery
    .order('created_at', { ascending: sort === 'oldest' })
    .limit(50)

  const { data: leads } = await leadsQuery

  const activeLeads = leads || []
  const hot = activeLeads.filter((lead) => lead.score === 'HOT').length
  const warm = activeLeads.filter((lead) => lead.score === 'WARM').length

  const allLeads = allActiveLeads || []

  const hotReadyLeads = allLeads.filter(
    (lead) =>
      lead.status === 'NEW' &&
      lead.score === 'HOT' &&
      lead.ready_to_contact
  )

  const newLeads = allLeads.filter(
    (lead) =>
      lead.status === 'NEW' &&
      !lead.ready_to_contact &&
      new Date(lead.created_at) >= staleCutoff
  )

  const agedLeads = allLeads.filter(
    (lead) =>
      lead.status === 'NEW' &&
      !lead.ready_to_contact &&
      new Date(lead.created_at) < staleCutoff
  )

  const activeFollowUps = dueFollowUps || []

  const wonLeads = allLeads.filter((lead) => lead.status === 'WON').length
  const conversionRate = allLeads.length
    ? Math.round((wonLeads / allLeads.length) * 100)
    : 0

  const totalAttention =
    hotReadyLeads.length +
    activeFollowUps.length +
    newLeads.length +
    agedLeads.length

  const priorityLead = hotReadyLeads[0] || (activeFollowUps[0] ? { id: activeFollowUps[0].lead_id, name: "Follow-up due" } : null) || agedLeads[0] || newLeads[0]

  const priorityMessage = hotReadyLeads.length
    ? `${hotReadyLeads[0]?.name || 'Your HOT lead'} is ready to contact. This should be your first action.`
    : activeFollowUps.length
      ? 'You have follow-ups due. Work through these before moving on to lower-priority enquiries.'
      : agedLeads.length
        ? 'You have aged enquiries waiting for qualification. Review these and move the strongest opportunities forward.'
        : newLeads.length
          ? 'You have new enquiries waiting for qualification. Review them and collect the remaining information.'
          : 'You are all caught up. There are no outstanding sales priorities right now.'

  return (
    <main className="app">
      <header className="bar">
        <div>
          <strong>LeadPilot</strong>
          <span>AI Sales Assistant</span>
        </div>

        <nav>
          <Link href="/dashboard">Dashboard</Link>

          <Link
            href={
              assistant
                ? `/assistant/${assistant.public_slug}`
                : '/onboarding'
            }
          >
            Test assistant
          </Link>

          <Link href="/onboarding">AI Employee</Link>
        </nav>
      </header>

      <section className="wrap">
        <div className="hero">
          <div>
            <small>DASHBOARD</small>
            <h1>{org?.name || 'Your business'}</h1>
            <p>Your AI assistant is capturing and qualifying enquiries.</p>
          </div>

          <span className="online">● Online</span>
        </div>

        <section className="stats">
          <div>
            <span>Leads</span>
            <b>{activeLeads.length}</b>
          </div>

          <div>
            <span>Hot leads</span>
            <b>{hot}</b>
          </div>

          <div>
            <span>Warm leads</span>
            <b>{warm}</b>
          </div>

          <div>
            <span>Conversion rate</span>
            <b>{conversionRate}%</b>
          </div>

          <div>
            <span>Assistant</span>
            <b>{assistant?.active ? 'Live' : 'Off'}</b>
          </div>
        </section>

        <section className="dailyBrief">
          <div className="dailyBriefMain">
            <small>AI DAILY BRIEF</small>
            <h2>
              {totalAttention
                ? `You have ${totalAttention} priorit${totalAttention === 1 ? 'y' : 'ies'} today.`
                : 'You are all caught up.'}
            </h2>
            <p>{priorityMessage}</p>
          </div>

          <div className="dailyBriefPriority">
            <span>PRIORITY</span>
            {priorityLead ? (
              <Link href={`/dashboard/leads/${priorityLead.id}`}>
                <strong>{priorityLead.name || 'Lead'}</strong>
                <small>Open lead →</small>
              </Link>
            ) : (
              <div>
                <strong>Nothing outstanding</strong>
                <small>Keep up the good work</small>
              </div>
            )}
          </div>
        </section>

        <section className="attentionPanel">
          <div className="attentionHeader">
            <div>
              <small>SALES PRIORITIES</small>
              <h2>Needs attention</h2>
              <p>The leads and follow-ups most likely to need action next.</p>
            </div>
          </div>

          <div className="attentionGrid">
            <div className="attentionCard">
              <div className="attentionCardTop">
                <span>🔥</span>
                <strong>HOT leads</strong>
                <b>{hotReadyLeads.length}</b>
              </div>

              {hotReadyLeads.length ? (
                <div className="attentionList">
                  {hotReadyLeads.slice(0, 3).map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/dashboard/leads/${lead.id}`}
                      className="attentionLead"
                    >
                      <span>
                        <b>{lead.name || 'Unknown'}</b>
                        <small>Ready to contact</small>
                      </span>
                      <span>→</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="attentionEmpty">No HOT leads need contact.</p>
              )}
            </div>

            <div className="attentionCard">
              <div className="attentionCardTop">
                <span>📅</span>
                <strong>Follow-ups</strong>
                <b>{activeFollowUps.length}</b>
              </div>

              {activeFollowUps.length ? (
                <div className="attentionList">
                  {activeFollowUps.slice(0, 3).map((followUp) => (
                    <Link
                      key={followUp.id}
                      href={`/dashboard/leads/${followUp.lead_id}`}
                      className="attentionLead"
                    >
                      <span>
                        <b>{followUp.action.replace('_', ' ')}</b>
                        <small>Due / overdue</small>
                      </span>
                      <span>→</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="attentionEmpty">No follow-ups are due.</p>
              )}
            </div>

            <div className="attentionCard">
              <div className="attentionCardTop">
                <span>🆕</span>
                <strong>New enquiries</strong>
                <b>{newLeads.length}</b>
              </div>

              {newLeads.length ? (
                <div className="attentionList">
                  {newLeads.slice(0, 3).map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/dashboard/leads/${lead.id}`}
                      className="attentionLead"
                    >
                      <span>
                        <b>{lead.name || 'Unknown'}</b>
                        <small>Still being qualified</small>
                      </span>
                      <span>→</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="attentionEmpty">No new enquiries waiting.</p>
              )}
            </div>

            <div className="attentionCard">
              <div className="attentionCardTop">
                <span>⏳</span>
                <strong>Aged enquiries</strong>
                <b>{agedLeads.length}</b>
              </div>

              {agedLeads.length ? (
                <div className="attentionList">
                  {agedLeads.slice(0, 3).map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/dashboard/leads/${lead.id}`}
                      className="attentionLead"
                    >
                      <span>
                        <b>{lead.name || 'Unknown'}</b>
                        <small>Waiting for qualification</small>
                      </span>
                      <span>→</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="attentionEmpty">No aged enquiries.</p>
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent leads</h2>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                marginLeft: 'auto',
              }}
            >
              <Link
                href="/dashboard/leads/new"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '7px 11px',
                  borderRadius: 7,
                  background: '#111827',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                + Add Lead
              </Link>

              <Link
                href="/dashboard/leads/archived"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '7px 11px',
                  border: '1px solid #dbe1e8',
                  borderRadius: 7,
                  background: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Archived leads →
              </Link>
            </div>
          </div>

          <form
            method="GET"
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              padding: '0 24px 18px',
              borderBottom: '1px solid #eef1f5',
            }}
          >
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search leads..."
              style={{
                flex: '1 1 220px',
                minWidth: 180,
                padding: '9px 11px',
                border: '1px solid #dbe1e8',
                borderRadius: 7,
                fontSize: 13,
                outline: 'none',
              }}
            />

            <select
              name="score"
              defaultValue={score}
              style={{
                padding: '9px 11px',
                border: '1px solid #dbe1e8',
                borderRadius: 7,
                background: '#fff',
                color: '#475569',
                fontSize: 13,
              }}
            >
              <option value="">All scores</option>
              <option value="HOT">Hot</option>
              <option value="WARM">Warm</option>

            </select>

            <select
              name="status"
              defaultValue={status}
              style={{
                padding: '9px 11px',
                border: '1px solid #dbe1e8',
                borderRadius: 7,
                background: '#fff',
                color: '#475569',
                fontSize: 13,
              }}
            >
              <option value="">All statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>

            <select
              name="sort"
              defaultValue={sort}
              style={{
                padding: '9px 11px',
                border: '1px solid #dbe1e8',
                borderRadius: 7,
                background: '#fff',
                color: '#475569',
                fontSize: 13,
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            <button
              type="submit"
              style={{
                padding: '9px 13px',
                border: '1px solid #111827',
                borderRadius: 7,
                background: '#111827',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>

            {(search || score || status || sort === 'oldest') && (
              <a
                href="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '9px 13px',
                  border: '1px solid #dbe1e8',
                  borderRadius: 7,
                  background: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Clear
              </a>
            )}
          </form>

          {activeLeads.length ? (
            <div className="table">
              <div
                className="thead"
                style={{
                  gridTemplateColumns: '1.25fr 1.8fr .65fr .75fr 1fr',
                }}
              >
                <span>Customer</span>
                <span>Enquiry</span>
                <span>Score</span>
                <span>Status</span>
                <span>Received</span>
              </div>

              {activeLeads.map((lead) => (
                <div
                  className="tr"
                  key={lead.id}
                  style={{
                    gridTemplateColumns: '1.25fr 1.8fr .65fr .75fr 1fr',
                  }}
                >
                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}
                  >
                    <span>
                      <b>{lead.name || 'Unknown'}</b>
                      <small>
                        {lead.email ||
                          lead.phone ||
                          lead.location ||
                          'Details being collected'}
                      </small>
                    </span>

                    <span>
                      {lead.service || lead.enquiry || 'General enquiry'}
                    </span>

                    <span>
                      {lead.score ? (
                        <em className={lead.score.toLowerCase()}>
                          {lead.score}
                        </em>
                      ) : (
                        <em className="unscored">
                          Unscored
                        </em>
                      )}

                      {lead.ready_to_contact && (
                        <small
                          style={{
                            display: 'block',
                            marginTop: 5,
                            color: '#15803d',
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          Ready to contact
                        </small>
                      )}
                    </span>
                  </Link>

                  <LeadStatusSelect
                    leadId={lead.id}
                    status={lead.status}
                  />

                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}
                  >
                    <LeadAge timestamp={lead.created_at} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              {search || score || status
                ? 'No leads match your current search or filters.'
                : 'No leads yet. Open your assistant and send a test enquiry.'}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
