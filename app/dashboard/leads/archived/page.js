import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'

export default async function ArchivedLeads() {
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

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  return (
    <main className="app">
      <header className="bar">
        <div>
          <strong>LeadPilot</strong>
          <span>Archived Leads</span>
        </div>

        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/onboarding">Settings</Link>
        </nav>
      </header>

      <section className="wrap">
        <div className="hero">
          <div>
            <small>LEADS</small>
            <h1>Archived leads</h1>
            <p>
              Leads removed from your active pipeline.
            </p>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Archived</h2>
              <p>
                These leads are retained and can be restored.
              </p>
            </div>

            <Link href="/dashboard">
              ← Back to dashboard
            </Link>
          </div>

          {leads?.length ? (
            <div className="table">
              <div className="thead">
                <span>Customer</span>
                <span>Enquiry</span>
                <span>Score</span>
                <span>Status</span>
              </div>

              {leads.map((lead) => (
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="tr"
                  key={lead.id}
                >
                  <span>
                    <b>{lead.name || 'Unknown'}</b>
                    <small>
                      {lead.email ||
                        lead.phone ||
                        lead.postcode ||
                        'No contact details'}
                    </small>
                  </span>

                  <span>
                    {lead.service ||
                      lead.enquiry ||
                      'General enquiry'}
                  </span>

                  <span>
                    <em className={lead.score?.toLowerCase()}>
                      {lead.score}
                    </em>
                  </span>

                  <span>{lead.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">
              No archived leads.
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
