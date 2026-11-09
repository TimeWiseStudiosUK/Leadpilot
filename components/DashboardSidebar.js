"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import LogoutButton from "./LogoutButton"

export default function DashboardSidebar({ businessName, assistantSlug, role }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigation = [
    { label: "Dashboard", icon: "⌂", href: "/dashboard" },
    { label: "All Leads", icon: "▤", href: "/dashboard/leads" },
    { label: "Hot Leads", icon: "↑", href: "/dashboard/leads?score=HOT" },
    { label: "Warm Leads", icon: "◷", href: "/dashboard/leads?score=WARM" },
    { label: "Archived Leads", icon: "▣", href: "/dashboard/leads/archived" },
  ]

  const tools = [
    ...(role === "owner" || role === "admin" ? [{ label: "Sales Manager", icon: "✦", href: "/dashboard#sales-manager" }] : []),
    { label: "Test Assistant", icon: "◉", href: assistantSlug ? `/assistant/${assistantSlug}` : "/onboarding", disabled: !assistantSlug },
    ...(role === "owner" || role === "admin" ? [{ label: "AI Employee", icon: "◎", href: "/onboarding" }] : []),
  ]

  function active(href) {
    const path = href.split("?")[0].split("#")[0]
    if (path === "/dashboard") return pathname === "/dashboard" && href.indexOf("#") === -1
    if (path === "/dashboard/leads") {
      if (pathname !== path) return false
      const score = searchParams.get("score")
      if (href.includes("score=HOT")) return score === "HOT"
      if (href.includes("score=WARM")) return score === "WARM"
      return !score
    }
    return pathname === path || pathname.startsWith(path + "/")
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  return (
    <>
      <button className="sidebar-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">
        {mobileOpen ? "✕" : "☰"}
      </button>
      {mobileOpen && <button className="sidebar-overlay" onClick={closeMobile} aria-label="Close navigation" />}
      <aside className={`dashboard-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">L</div>
          {!collapsed && <div className="sidebar-brand-copy"><strong>LeadPilot</strong><span>by TimeWise Studios</span></div>}
          <button className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse navigation">{collapsed ? "›" : "‹"}</button>
        </div>

        {!collapsed && <div className="sidebar-business">{businessName || "Your workspace"}</div>}

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">WORKSPACE</div>
          {navigation.map(item => (
            <Link key={item.label} href={item.href} onClick={closeMobile} title={collapsed ? item.label : undefined} className={`sidebar-link${active(item.href) ? " active" : ""}`}>
              <span className="sidebar-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}

          <div className="sidebar-section-label">TOOLS</div>
          {tools.map(item => (
            item.disabled
              ? <div key={item.label} title={collapsed ? item.label : undefined} className="sidebar-link sidebar-link-muted" aria-disabled="true">
                  <span className="sidebar-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </div>
              : <Link key={item.label} href={item.href} onClick={closeMobile} title={collapsed ? item.label : undefined} className={`sidebar-link${active(item.href) ? " active" : ""}`}>
                  <span className="sidebar-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
          ))}

          <div className="sidebar-section-label">ACCOUNT</div>
          <Link href="/dashboard/settings" onClick={closeMobile} title={collapsed ? "Settings" : undefined} className={`sidebar-link${active("/dashboard/settings") ? " active" : ""}`}>
            <span className="sidebar-icon">⚙</span>
            {!collapsed && <span>Settings</span>}
          </Link>
        </nav>

        <div className="sidebar-footer">
          <LogoutButton />
        </div>
      </aside>
    </>
  )
}
