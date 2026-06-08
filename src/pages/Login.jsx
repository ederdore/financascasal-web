import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState('login')
  const [erro, setErro] = useState('')

  async function handleAuth(e) {
    e.preventDefault()
    if (!email || !senha) { setErro('Preencha e-mail e senha'); return }
    setLoading(true); setErro('')
    try {
      if (modo === 'cadastro') {
        const { error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        setErro('Verifique seu e-mail para confirmar o cadastro.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
        onLogin()
      }
    } catch (e) { setErro(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:56, marginBottom:8 }}>💑</div>
          <h1 style={{ fontSize:24, fontWeight:700, marginBottom:4 }}>FinançasCasal</h1>
          <p style={{ color:'var(--secondary)' }}>Finanças do casal, juntos e organizados</p>
        </div>
        <div className="card">
          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" placeholder="seu@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" placeholder="Mínimo 6 caracteres"
                value={senha} onChange={e => setSenha(e.target.value)} required />
            </div>
            {erro && <div style={{ color: erro.includes('Verifique') ? 'var(--green)' : 'var(--red)', fontSize:13, marginBottom:12 }}>{erro}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width:'100%', justifyContent:'center', padding:'11px' }}>
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
          <button onClick={() => setModo(modo === 'login' ? 'cadastro' : 'login')}
            style={{ width:'100%', marginTop:14, background:'none', border:'none',
              color:'var(--secondary)', fontSize:13, textDecoration:'underline', cursor:'pointer' }}>
            {modo === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
