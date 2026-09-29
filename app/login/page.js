'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState('login'),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const router=useRouter(); const supabase=createClient()
  async function submit(e){e.preventDefault();setBusy(true);setError('');const result=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});setBusy(false);if(result.error)return setError(result.error.message);if(mode==='signup' && !result.data.session)return setError('Check your email to confirm your account.');router.push('/dashboard')}
  return <main className="auth"><div className="auth-card"><div className="logo">LP</div><h1>LeadPilot</h1><p>AI sales assistants for small businesses.</p><form onSubmit={submit}><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?'Working...':mode==='login'?'Sign in':'Create account'}</button></form><button className="link" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create a new account':'I already have an account'}</button></div></main>
}
