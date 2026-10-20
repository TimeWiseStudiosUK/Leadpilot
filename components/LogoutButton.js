'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

export default function LogoutButton() {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    setBusy(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      setBusy(false)
      window.alert('Unable to log out. Please try again.')
      return
    }

    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        color: '#C3CCDA',
        border: 'none',
        borderRadius: 6,
        padding: '0 0 0 4px',
        lineHeight: 'inherit',
        verticalAlign: 'middle',
        cursor: busy ? 'wait' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>{busy ? 'Logging out...' : 'Log out'}</>
    </button>
  )
}