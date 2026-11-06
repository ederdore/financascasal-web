import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function PasswordRecovery({ session, onComplete }) {
  const [password,setPassword] = useState('')
  const [confirmation,setConfirmation] = useState('')
  const [error,setError] = useState('')
  const [saving,setSaving] = useState(false)
  async function save(event) {
    event.preventDefault(); setError('')
    if(password.length<8) { setError('Use pelo menos 8 caracteres.'); return }
    if(password!==confirmation) { setError('As senhas precisam ser iguais.'); return }
    setSaving(true)
    try {
      const result=await supabase.auth.updateUser({password})
      if(result.error) throw result.error
      await onComplete()
    } catch(err) { setError(err.message) } finally { setSaving(false) }
  }
  return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24}}><section className="card" style={{width:'100%',maxWidth:440,padding:32}}>
    <h1 style={{fontSize:24}}>Defina sua nova senha</h1>
    {!session ? <><p>Este link não está válido ou expirou. Solicite outro link de recuperação para continuar.</p><button className="btn btn-primary" onClick={async () => {
    try { await onComplete() } catch (err) { setError(err.message) }
  }}>Voltar para entrar</button>{error&&<p role="alert">{error}</p>}</> : <form onSubmit={save}>
      <p>Escolha uma senha que você ainda não usa em outros serviços.</p>
      <label className="form-group" style={{display:'block'}}>Nova senha<input className="form-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required autoFocus/></label>
      <label className="form-group" style={{display:'block'}}>Confirmar senha<input className="form-input" type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required/></label>
      {error&&<p role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Salvando…':'Salvar e continuar'}</button>
    </form>}
  </section></main>
}
