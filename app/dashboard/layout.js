import { redirect } from "next/navigation"
import { createClient } from "../../lib/supabase/server"
import { createAdminClient } from "../../lib/supabase/admin"
import DashboardSidebar from "../../components/DashboardSidebar"

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect("/onboarding")

  const admin = createAdminClient()

  const [organizationResult, assistantResult] = await Promise.all([
    admin
      .from("organizations")
      .select("name")
      .eq("id", membership.organization_id)
      .maybeSingle(),
    admin
      .from("assistants")
      .select("public_slug")
      .eq("organization_id", membership.organization_id)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <div className="dashboard-shell">
      <DashboardSidebar
        businessName={organizationResult.data?.name}
        assistantSlug={assistantResult.data?.public_slug}
        role={membership.role}
      />
      <div className="dashboard-main">{children}</div>
    </div>
  )
}
