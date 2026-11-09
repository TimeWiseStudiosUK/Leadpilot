'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LeadPageRefresh({ leadId }) {
  const router = useRouter()

  useEffect(() => {
    function refreshForLead(event) {
      if (event?.detail?.leadId && event.detail.leadId !== leadId) return
      router.refresh()
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') router.refresh()
    }

    window.addEventListener('leadpilot:lead-updated', refreshForLead)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)

    return () => {
      window.removeEventListener('leadpilot:lead-updated', refreshForLead)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [leadId, router])

  return null
}
