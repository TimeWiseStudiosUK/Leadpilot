import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "../../../lib/supabase/server"
import LeadAge from "../../../components/LeadAge"
import LeadStatusSelect from "../../../components/LeadStatusSelect"

export default async function AllLeadsPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect("/onboarding")

  const params = await searchParams
  const search = typeof params?.search === "string" ? params.search.trim() : ""
  const score = ["HOT", "WARM"].includes(params?.score) ? params.score : ""
  const status = ["NEW", "CONTACTED", "WON", "LOST"].includes(params?.status) ? params.status : ""
  const sort = params?.sort === "oldest" ? "oldest" : "newest"

  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .is("archived_at", null)

  if (search) {
    const safeSearch = search
      .replace(/[%(),]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100)

    if (safeSearch) {
      leadsQuery = leadsQuery.or(
        `name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%,service.ilike.%${safeSearch}%,enquiry.ilike.%${safeSearch}%`
      )
    }
  }

  if (score) leadsQuery = leadsQuery.eq("score", score)
  if (status) leadsQuery = leadsQuery.eq("status", status)

  leadsQuery = leadsQuery
    .order("created_at", { ascending: sort === "oldest" })
    .limit(50)

  const { data: leads } = await leadsQuery
  const activeLeads = leads || []

  return (
    <main className="app">
      <section className="wrap">
        <div className="hero">
          <div>
            <small>WORKSPACE</small>
            <h1>All leads</h1>
            <p>View, search and manage your active sales pipeline.</p>
          </div>
          <Link href="/dashboard/leads/new">+ Add Lead</Link>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Your leads</h2>
              <p>{activeLeads.length} {activeLeads.length === 1 ? "lead" : "leads"} shown, maximum 50</p>
            </div>
            <Link href="/dashboard/leads/archived">Archived leads →</Link>
          </div>

          <form method="GET" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 24px 18px", borderBottom: "1px solid #eef1f5" }}>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search leads..."
              style={{ flex: "1 1 220px", minWidth: 180, padding: "9px 11px", border: "1px solid #dbe1e8", borderRadius: 7, fontSize: 13 }}
            />
            <select name="score" defaultValue={score} style={{ padding: "9px 11px", border: "1px solid #dbe1e8", borderRadius: 7, background: "#fff", color: "#475569", fontSize: 13 }}>
              <option value="">All scores</option>
              <option value="HOT">Hot</option>
              <option value="WARM">Warm</option>
            </select>
            <select name="status" defaultValue={status} style={{ padding: "9px 11px", border: "1px solid #dbe1e8", borderRadius: 7, background: "#fff", color: "#475569", fontSize: 13 }}>
              <option value="">All statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
            <select name="sort" defaultValue={sort} style={{ padding: "9px 11px", border: "1px solid #dbe1e8", borderRadius: 7, background: "#fff", color: "#475569", fontSize: 13 }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button type="submit" style={{ padding: "9px 13px", border: "1px solid #111827", borderRadius: 7, background: "#111827", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Apply</button>
            {(search || score || status || sort === "oldest") && (
              <Link href="/dashboard/leads" style={{ display: "inline-flex", alignItems: "center", padding: "9px 13px", border: "1px solid #dbe1e8", borderRadius: 7, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Clear</Link>
            )}
          </form>

          {activeLeads.length ? (
            <div className="table leads-table">
              <div className="thead" style={{ gridTemplateColumns: "1.25fr 1.8fr .65fr .75fr 1fr" }}>
                <span>Customer</span>
                <span>Enquiry</span>
                <span>Score</span>
                <span>Status</span>
                <span>Received</span>
              </div>

              {activeLeads.map((lead) => (
                <div className="tr" key={lead.id} style={{ gridTemplateColumns: "1.25fr 1.8fr .65fr .75fr 1fr" }}>
                  <Link href={`/dashboard/leads/${lead.id}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}>
                    <span>
                      <b>{lead.name || "Unknown"}</b>
                      <small>{lead.email || lead.phone || lead.location || "Details being collected"}</small>
                    </span>
                    <span>{lead.service || lead.enquiry || "General enquiry"}</span>
                    <span>
                      {lead.score ? <em className={lead.score.toLowerCase()}>{lead.score}</em> : <em className="unscored">Unscored</em>}
                      {lead.ready_to_contact && <small style={{ display: "block", marginTop: 5, color: "#15803d", fontWeight: 700, fontSize: 11 }}>Ready to contact</small>}
                    </span>
                  </Link>
                  <LeadStatusSelect leadId={lead.id} status={lead.status} />
                  <Link href={`/dashboard/leads/${lead.id}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}>
                    <LeadAge timestamp={lead.created_at} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              {search || score || status ? "No leads match your current search or filters." : "No leads yet. Add a lead or send a test enquiry through your assistant."}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
