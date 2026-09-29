import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export default async function Dashboard() {
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

  const [
    { data: org },
    { data: assistant },
    { data: leads },
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

    supabase
      .from('leads')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const activeLeads = leads || []
  const hot = activeLeads.filter(x => x.score === 'HOT').length
  const warm = activeLeads.filter(x => x.score === 'WARM').length

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

          <Link href="/onboarding">Settings</Link>
        </nav>
      </header>

      <section className="wrap">
        <div className="hero">
          <div>
            <small>DASHBOARD</small>
            <h1>{org?.name || 'Your business'}</h1>
            <p>
              Your AI assistant is capturing and qualifying enquiries.
            </p>
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
            <span>Assistant</span>
            <b>{assistant?.active ? 'Live' : 'Off'}</b>
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
      gap: 6,
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
      gap: 6,
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

          {activeLeads.length ? (
            <div className="table">
              <div className="thead">
                <span>Customer</span>
                <span>Enquiry</span>
                <span>Score</span>
                <span>Status</span>
              </div>

              {activeLeads.map(l => (
                <Link
                  href={`/dashboard/leads/${l.id}`}
                  className="tr"
                  key={l.id}
                >
                  <span>
                    <b>{l.name || 'Unknown'}</b>
                    <small>
                      {l.email ||
                        l.phone ||
                        l.postcode ||
                        'Details being collected'}
                    </small>
                  </span>

                  <span>
                    {l.service ||
                      l.enquiry ||
                      'General enquiry'}
                  </span>

                  <span>
                    <em className={l.score.toLowerCase()}>
                      {l.score}
                    </em>
                  </span>

                  <span>{l.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">
              No active leads yet. Open your assistant and send a
              test enquiry.
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
