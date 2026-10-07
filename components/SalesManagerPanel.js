'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function SalesManagerPanel() {
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSavedInsight() {
      try {
        const response = await fetch('/api/sales-manager')
        const data = await response.json()

        if (response.ok && data.success) {
          setInsight(data.insight || null)
        }
      } catch {
        // Saved insight is optional; the user can refresh the analysis manually.
      }
    }

    loadSavedInsight()
  }, [])

  async function runSalesManager() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/sales-manager', { method: 'POST' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Sales Manager analysis failed.')
      }

      setInsight(data.insight)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="salesManagerPanel">
      <div className="salesManagerHeader">
        <div>
          <small>AI SALES MANAGER</small>
          <h2>Your sales manager is ready to review the pipeline.</h2>
          <p>
            Run an AI analysis to identify the most important opportunity
            and what you should do next.
          </p>
          {insight?.generated_at ? (
            <small className="salesManagerLastAnalysed">
              Last analysed {new Date(insight.generated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </small>
          ) : null}
        </div>

        <button
          type="button"
          onClick={runSalesManager}
          disabled={loading}
          className="salesManagerButton"
        >
          {loading ? 'Analysing pipeline...' : insight ? 'Refresh AI Analysis' : 'Run AI Sales Manager'}
        </button>
      </div>

      {error ? (
        <div className="salesManagerError">{error}</div>
      ) : null}

      {insight ? (
        <div className="salesManagerResult">
          <div className="salesManagerResultMain">
            <span>PRIORITY</span>
            <h3>{insight.headline}</h3>
            <p>{insight.summary}</p>

            <strong>Recommended action</strong>
            <p>{insight.priority_action}</p>

            <strong>Why</strong>
            <p>{insight.priority_reason}</p>

            {insight.suggested_message ? (
              <>
                <strong>Suggested message</strong>
                <p className="salesManagerMessage">
                  {insight.suggested_message}
                </p>
              </>
            ) : null}
          </div>

          {insight.secondary_priorities?.length ||
          insight.risks?.length ||
          insight.qualification_opportunities?.length ? (
            <div className="salesManagerSecondary">
              {insight.secondary_priorities?.length ? (
                <div>
                  <span>OTHER PRIORITIES</span>
                  {insight.secondary_priorities.slice(0, 3).map((item, index) => (
                    <div className="salesManagerItem" key={index}>
                      <strong>{item.action}</strong>
                      <p>{item.reason}</p>
                      {item.lead_id ? <Link href={'/dashboard/leads/' + item.lead_id}>Open lead →</Link> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {insight.risks?.length ? (
                <div>
                  <span>RISKS</span>
                  {insight.risks.slice(0, 3).map((item, index) => (
                    <div className="salesManagerItem" key={index}>
                      <strong>{item.risk}</strong>
                      <p>{item.recommended_action}</p>
                      {item.lead_id ? <Link href={'/dashboard/leads/' + item.lead_id}>Open lead →</Link> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {insight.qualification_opportunities?.length ? (
                <div>
                  <span>QUALIFICATION OPPORTUNITIES</span>
                  {insight.qualification_opportunities.slice(0, 3).map((item, index) => (
                    <div className="salesManagerItem" key={index}>
                      <strong>{item.missing_information}</strong>
                      <p>{item.recommended_question}</p>
                      {item.lead_id ? <Link href={'/dashboard/leads/' + item.lead_id}>Open lead →</Link> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
