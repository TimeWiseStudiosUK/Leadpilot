export function notifyLeadDataChanged(leadId) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent('leadpilot:lead-updated', {
      detail: { leadId },
    })
  )
}
