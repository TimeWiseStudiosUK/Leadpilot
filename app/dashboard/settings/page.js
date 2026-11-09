import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)

  const membership = memberships?.[0]
  if (!membership) redirect('/onboarding')

  const canManageBusiness = ["owner", "admin"].includes(membership.role)
  const isOwner = membership.role === "owner"

  const [{ data: organisation }, { data: assistant }] = canManageBusiness ? await Promise.all([
    supabase.from('organizations').select('name, industry')
      .eq('id', membership.organization_id).maybeSingle(),
    supabase.from('assistants').select('name, services, areas, tone, active')
      .eq('organization_id', membership.organization_id)
      .eq('active', true).limit(1).maybeSingle(),
  ]) : [{ data: null }, { data: null }]

  const services = Array.isArray(assistant?.services) ? assistant.services : []
  const areas = Array.isArray(assistant?.areas) ? assistant.areas : []

  return (
    <main className="app settings-page">
      <section className="wrap">
        <div className="hero">
          <div>
            <small>ACCOUNT</small>
            <h1>Settings</h1>
            <p>Manage your business, AI employee and LeadPilot account.</p>
          </div>
        </div>

        <div className="settings-grid">
          {canManageBusiness && (
          <section className="panel settings-card">
            <div className="panel-head">
              <h2>Business profile</h2>
              <p>Your business details held by LeadPilot.</p>
            </div>
            <div className="settings-card-body">
              <div className="settings-detail"><span>Business name</span><strong>{organisation?.name || 'Not set'}</strong></div>
              <div className="settings-detail"><span>Industry</span><strong>{organisation?.industry || 'Not set'}</strong></div>
              <p className="settings-note">To update these details, use the AI Employee configuration.</p>
              <Link className="settings-link" href="/onboarding">Edit business details <span>→</span></Link>
            </div>
          </section>
          )}

          {canManageBusiness && (
          <section className="panel settings-card">
            <div className="panel-head">
              <h2>AI Employee</h2>
              <p>Your customer-facing assistant and its training.</p>
            </div>
            <div className="settings-card-body">
              <div className="settings-detail"><span>Status</span><strong>{assistant ? 'Active' : 'Not configured'}</strong></div>
              <div className="settings-detail"><span>Assistant</span><strong>{assistant?.name || 'No active assistant found'}</strong></div>
              <div className="settings-detail"><span>Services configured</span><strong>{services.length}</strong></div>
              <div className="settings-detail"><span>Service areas configured</span><strong>{areas.length}</strong></div>
              {assistant?.tone && <div className="settings-detail"><span>Communication style</span><strong>{assistant.tone}</strong></div>}
              <Link className="settings-link" href="/onboarding">Manage AI Employee <span>→</span></Link>
            </div>
          </section>
          )}

          {isOwner && (
          <section className="panel settings-card settings-billing">
            <div className="panel-head">
              <h2>Subscription &amp; billing</h2>
              <p>Your LeadPilot plan and payment arrangements.</p>
            </div>
            <div className="settings-card-body">
              <div className="settings-status"><span className="settings-status-dot" />Billing integration not connected</div>
              <p className="settings-description">Subscription payments are not yet set up for this account. No payment method or Direct Debit mandate is currently managed through LeadPilot.</p>
              <div className="settings-feature-list">
                <div><strong>Subscription plan</strong><span>Plan and monthly or annual billing frequency</span></div>
                <div><strong>Recurring payments</strong><span>Secure Direct Debit mandate and payment status</span></div>
                <div><strong>Billing details</strong><span>Payment method, billing contact and invoice address</span></div>
                <div><strong>Invoices &amp; changes</strong><span>Invoice history, plan changes and cancellation</span></div>
              </div>
              <p className="settings-note">These billing controls will become available when the payment integration is introduced.</p>
            </div>
          </section>
          )}

          <section className="panel settings-card">
            <div className="panel-head">
              <h2>Account &amp; security</h2>
              <p>Your sign-in and account access.</p>
            </div>
            <div className="settings-card-body">
              <div className="settings-detail"><span>Account email</span><strong className="settings-email">{user.email || 'Unavailable'}</strong></div>
              <div className="settings-detail"><span>Account role</span><strong>{membership.role || 'Member'}</strong></div>
              <p className="settings-note">For now, sign out using the Log out option in the sidebar. Password and team access management are not yet available here.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
