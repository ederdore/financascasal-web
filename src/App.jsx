import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import Landing from './pages/Landing.jsx'
import Visao from './pages/Visao.jsx'
import Bancos from './pages/Bancos.jsx'
import Receitas from './pages/Receitas.jsx'
import Despesas from './pages/Despesas.jsx'
import Cartoes from './pages/Cartoes.jsx'
import Contas from './pages/Contas.jsx'
import Streaming from './pages/Streaming.jsx'
import RendaFixa from './pages/RendaFixa.jsx'
import Reserva from './pages/Reserva.jsx'
import Metas from './pages/Metas.jsx'
import Notificacoes from './pages/Notificacoes.jsx'
import IA from './pages/IA.jsx'
import Configuracoes from './pages/Configuracoes.jsx'

const TABS = [
  { id: 'visao',         icon: '◉',  label: 'Visão Geral' },
  { id: 'bancos',        icon: '🏦', label: 'Bancos' },
  { id: 'receitas',      icon: '💰', label: 'Receitas' },
  { id: 'despesas',      icon: '💸', label: 'Despesas' },
  { id: 'cartoes',       icon: '💳', label: 'Cartões' },
  { id: 'contas',        icon: '📋', label: 'Contas' },
  { id: 'streaming',     icon: '📺', label: 'Streaming' },
  { id: 'rendafixa',     icon: '📈', label: 'Renda Fixa' },
  { id: 'reserva',       icon: '🛡', label: 'Reserva' },
  { id: 'metas',         icon: '🎯', label: 'Metas' },
  { id: 'notificacoes',  icon: '🔔', label: 'Notificações' },
  { id: 'ia',            icon: '🤖', label: 'IA' },
  { id: 'configuracoes', icon: '⚙️',  label: 'Configurações' },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('visao')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })
    supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
  }, [])

  async function loadProfile(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data)
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💑</div>
        <p style={{ color:'var(--secondary)' }}>Carregando...</p>
      </div>
    </div>
  )

  // Usuário não logado — mostra landing com login integrado
  if (!session) return <Landing onLogin={() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id)
    })
  }} />

  // Logado mas sem perfil completo — redireciona para configurar
  if (!profile) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>💑</div>
        <p style={{ color:'var(--secondary)', marginBottom:16 }}>Carregando seu perfil...</p>
      </div>
    </div>
  )

  const papelBg = profile.papel === 'eu' ? 'var(--eu-bg)' : 'var(--ela-bg)'
  const papelTxt = profile.papel === 'eu' ? 'var(--eu-text)' : 'var(--ela-text)'

  const pages = { visao: Visao, bancos: Bancos, receitas: Receitas, despesas: Despesas,
    cartoes: Cartoes, contas: Contas, streaming: Streaming, rendafixa: RendaFixa, reserva: Reserva,
    metas: Metas, notificacoes: Notificacoes, ia: IA, configuracoes: Configuracoes }
  const PageComponent = pages[tab] || Visao

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>💑 FinançasCasal</h1>
          <p>Finanças do casal</p>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="icon">{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:14, background:papelBg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color:papelTxt }}>
                {profile.papel === 'eu' ? 'EU' : 'ELA'}
              </div>
              <div>
                <div style={{ fontWeight:500, color:'var(--primary)', fontSize:12 }}>{profile.nome}</div>
                <div style={{ fontSize:10 }}>{profile.casal_code}</div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={logout}>Sair</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <h2>{TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}</h2>
          <div className="topbar-right">
            <span style={{ fontSize:12, color:'var(--secondary)' }}>
              Código: <strong>{profile.casal_code}</strong>
            </span>
          </div>
        </div>
        <div className="page">
          <PageComponent session={session} profile={profile} onProfileUpdate={() => loadProfile(session.user.id)} />
        </div>
      </main>
    </div>
  )
}
