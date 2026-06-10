import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState('login') // 'login' | 'cadastro' | 'recuperar' | 'nova_senha'
  const [msg, setMsg] = useState({ texto: '', tipo: '' }) // tipo: 'sucesso' | 'erro'

  async function handleAuth(e) {
    e.preventDefault()
    setMsg({ texto: '', tipo: '' })
    setLoading(true)
    try {
      if (modo === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/nova-senha`,
        })
        if (error) throw error
        setMsg({ texto: '✅ Link enviado! Verifique seu e-mail e clique no link para redefinir a senha.', tipo: 'sucesso' })
        return
      }

      if (modo === 'nova_senha') {
        if (novaSenha.length < 6) { setMsg({ texto: 'Senha deve ter mínimo 6 caracteres', tipo: 'erro' }); return }
        const { error } = await supabase.auth.updateUser({ password: novaSenha })
        if (error) throw error
        setMsg({ texto: '✅ Senha atualizada com sucesso! Você já pode entrar.', tipo: 'sucesso' })
        setTimeout(() => { setModo('login'); setMsg({ texto: '', tipo: '' }) }, 2000)
        return
      }

      if (modo === 'cadastro') {
        const { error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        setMsg({ texto: '✅ Cadastro feito! Verifique seu e-mail para confirmar a conta.', tipo: 'sucesso' })
        return
      }

      // login
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      onLogin()

    } catch (e) {
      const erros = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
        'User already registered': 'Este e-mail já está cadastrado.',
      }
      setMsg({ texto: erros[e.message] || e.message, tipo: 'erro' })
    } finally {
      setLoading(false)
    }
  }

  // Detecta retorno do link de recuperação de senha
  if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery') && modo !== 'nova_senha') {
    setModo('nova_senha')
  }

  const titulos = {
    login: 'Entrar',
    cadastro: 'Criar conta',
    recuperar: 'Recuperar senha',
    nova_senha: 'Nova senha',
  }
  const btnLabels = {
    login: 'Entrar',
    cadastro: 'Criar conta',
    recuperar: 'Enviar link de recuperação',
    nova_senha: 'Salvar nova senha',
  }
  const subtitulos = {
    login: 'Finanças do casal, juntos e organizados',
    cadastro: 'Crie sua conta gratuitamente',
    recuperar: 'Informe seu e-mail para receber o link',
    nova_senha: 'Digite sua nova senha',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>💑</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>FinançasCasal</h1>
          <p style={{ color: 'var(--secondary)', fontSize: 14 }}>{subtitulos[modo]}</p>
        </div>

        <div className="card">
          <form onSubmit={handleAuth}>

            {/* Campos */}
            {modo !== 'nova_senha' && (
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="seu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
            )}

            {(modo === 'login' || modo === 'cadastro') && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Senha</label>
                  {modo === 'login' && (
                    <button type="button" onClick={() => { setModo('recuperar'); setMsg({ texto: '', tipo: '' }) }}
                      style={{ fontSize: 12, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <input className="form-input" type="password" placeholder="Mínimo 6 caracteres"
                  value={senha} onChange={e => setSenha(e.target.value)} required />
              </div>
            )}

            {modo === 'nova_senha' && (
              <div className="form-group">
                <label className="form-label">Nova senha</label>
                <input className="form-input" type="password" placeholder="Mínimo 6 caracteres"
                  value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required autoFocus />
              </div>
            )}

            {/* Mensagem */}
            {msg.texto && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, lineHeight: 1.5,
                background: msg.tipo === 'sucesso' ? '#E1F5EE' : '#FCEBEB',
                color: msg.tipo === 'sucesso' ? 'var(--green)' : 'var(--red)',
                border: `0.5px solid ${msg.tipo === 'sucesso' ? '#A3D9C0' : '#F5BABA'}`,
              }}>
                {msg.texto}
              </div>
            )}

            {/* Botão principal */}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}>
              {loading ? 'Aguarde...' : btnLabels[modo]}
            </button>
          </form>

          {/* Links secundários */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {modo === 'login' && (
              <button onClick={() => { setModo('cadastro'); setMsg({ texto: '', tipo: '' }) }}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Não tem conta? Cadastre-se gratuitamente
              </button>
            )}
            {modo === 'cadastro' && (
              <button onClick={() => { setModo('login'); setMsg({ texto: '', tipo: '' }) }}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Já tem conta? Entrar
              </button>
            )}
            {(modo === 'recuperar' || modo === 'nova_senha') && (
              <button onClick={() => { setModo('login'); setMsg({ texto: '', tipo: '' }) }}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                ← Voltar para o login
              </button>
            )}
          </div>
        </div>

        {/* Info segurança */}
        {modo === 'login' && (
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--secondary)', marginTop: 20 }}>
            🔒 Seus dados financeiros são criptografados e protegidos
          </p>
        )}
      </div>
    </div>
  )
}
