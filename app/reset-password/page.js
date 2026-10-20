'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPassword() {
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [ready,setReady]=useState(false)
  const router=useRouter()
  const supabase=useMemo(() => createClient(), [])

  useEffect(() => {
    let active = true

    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')

      if (tokenHash && type === 'recovery') {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery'
        })

        if (!active) return
        if (verifyError) {
          setError('This reset link is invalid or has expired. Please request a new password reset email.')
          return
        }

        window.history.replaceState({}, document.title, window.location.pathname)
        setReady(true)
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!active) return
      if (sessionError || !data.session) {
        setError('This reset link is invalid or has expired. Please request a new password reset email.')
        return
      }

      setReady(true)
    }

    establishRecoverySession()
    return () => { active = false }
  }, [supabase])

  async function submit(e) {
    e.preventDefault()
    setError('');setNotice('')
    if (!ready) return setError('Please open a valid password reset link from your email.')
    if(password.length<6)return setError('Your password must be at least 6 characters long.')
    if(password!==confirmPassword)return setError('The passwords do not match.')
    setBusy(true)
    const {data,error:sessionError}=await supabase.auth.getSession()
    if(sessionError||!data.session){setBusy(false);return setError('This reset link is invalid or has expired. Please request a new password reset email.')}
    const {error:updateError}=await supabase.auth.updateUser({password})
    setBusy(false)
    if(updateError)return setError(updateError.message)
    setNotice('Your password has been updated. You can now sign in with your new password.')
    setTimeout(()=>router.push('/login'),1500)
  }

  return <main className="auth"><div className="auth-card"><div className="logo">LP</div><h1>Reset password</h1><p>Choose a new password for your LeadPilot account.</p>{!ready && !error && <p>Verifying your reset link...</p>}<form onSubmit={submit}><input type="password" placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} disabled={!ready || busy}/><input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={6} disabled={!ready || busy}/>{error&&<div className="error">{error}</div>}{notice&&<div className="notice">{notice}</div>}<button disabled={busy || !ready}>{busy?'Updating...':'Update password'}</button></form><button type="button" className="link" onClick={()=>router.push('/login')}>Back to sign in</button></div></main>
}
