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
import Admin from './pages/Admin.jsx'
import { useAutoLancarRecorrencias } from './components/AutoLancarRecorrencias.jsx'
import { useConquistas, CelebracaoModal } from './components/Conquistas.jsx'
import { useFaseAtual, FaseBadge } from './components/FasesFinanceiras.jsx'
import Onboarding from './pages/Onboarding.jsx'
import { TrialBanner } from './components/StripeUpgrade.jsx'
import { useMaturidadeIA } from './components/IAMaturidade.jsx'

const ICONS = {
  visao: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="3" y="3" width="6" height="6" rx="1.5"/>
    <rect x="11" y="3" width="6" height="6" rx="1.5"/>
    <rect x="3" y="11" width="6" height="6" rx="1.5"/>
    <rect x="11" y="11" width="6" height="6" rx="1.5"/>
  </svg>`,
  bancos: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M2 8l8-5 8 5"/>
    <rect x="4" y="8" width="2.5" height="6"/>
    <rect x="8.75" y="8" width="2.5" height="6"/>
    <rect x="13.5" y="8" width="2.5" height="6"/>
    <line x1="2" y1="17" x2="18" y2="17"/>
  </svg>`,
  receitas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="10" cy="10" r="7.5"/>
    <path d="M10 7v6M7.5 9.5L10 7l2.5 2.5"/>
  </svg>`,
  despesas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="10" cy="10" r="7.5"/>
    <path d="M10 7v6M7.5 10.5L10 13l2.5-2.5"/>
  </svg>`,
  cartoes: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="2" y="5" width="16" height="11" rx="2"/>
    <line x1="2" y1="9" x2="18" y2="9"/>
    <line x1="5" y1="13" x2="8" y2="13"/>
  </svg>`,
  contas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M4 5h12M4 9h8M4 13h10M4 17h6"/>
  </svg>`,
  streaming: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="2" y="4" width="16" height="11" rx="2"/>
    <path d="M8 15l2 2 2-2"/>
    <path d="M8 8.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/>
  </svg>`,
  rendafixa: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <polyline points="2,14 6,9 10,11 14,6 18,4"/>
    <circle cx="18" cy="4" r="1.5" fill="currentColor" stroke="none"/>
  </svg>`,
  reserva: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M10 2.5L3 6v5c0 4 3.5 6.5 7 7.5 3.5-1 7-3.5 7-7.5V6z"/>
    <polyline points="7,10 9,12 13,8"/>
  </svg>`,
  metas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="10" cy="10" r="7.5"/>
    <circle cx="10" cy="10" r="4"/>
    <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/>
  </svg>`,
  notificacoes: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M10 2.5a5.5 5.5 0 015.5 5.5c0 3 1 4.5 1.5 5H3c.5-.5 1.5-2 1.5-5A5.5 5.5 0 0110 2.5z"/>
    <path d="M8 15.5a2 2 0 004 0"/>
  </svg>`,
  ia: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="3" y="5" width="14" height="10" rx="3"/>
    <circle cx="7" cy="10" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="13" cy="10" r="1.2" fill="currentColor" stroke="none"/>
  </svg>`,
  configuracoes: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="10" cy="10" r="2.5"/>
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4"/>
  </svg>`,
  admin: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M3 5h14M3 10h14M3 15h8"/>
    <circle cx="16" cy="15" r="2.5"/>
    <line x1="18" y1="17" x2="19.5" y2="18.5"/>
  </svg>`,
}

const TABS = [
  { id: 'visao',         icon: 'visao',         label: 'Visão Geral' },
  { id: 'bancos',        icon: 'bancos',        label: 'Bancos' },
  { id: 'receitas',      icon: 'receitas',      label: 'Receitas' },
  { id: 'despesas',      icon: 'despesas',      label: 'Despesas' },
  { id: 'cartoes',       icon: 'cartoes',       label: 'Cartões' },
  { id: 'contas',        icon: 'contas',        label: 'Contas' },
  { id: 'streaming',     icon: 'streaming',     label: 'Assinaturas' },
  { id: 'rendafixa',     icon: 'rendafixa',     label: 'Renda Fixa' },
  { id: 'reserva',       icon: 'reserva',       label: 'Reserva' },
  { id: 'metas',         icon: 'metas',         label: 'Metas' },
  { id: 'notificacoes',  icon: 'notificacoes',  label: 'Notificações' },
  { id: 'ia',            icon: 'ia',            label: 'IA' },
  { id: 'configuracoes', icon: 'configuracoes', label: 'Configurações' },
  { id: 'admin',         icon: 'admin',         label: 'Admin' },
]

function NavIcon({ id }) {
  return (
    <div className="icon" dangerouslySetInnerHTML={{ __html: ICONS[id] || '' }} />
  )
}

function SidebarFaseBadge({ session, profile }) {
  const { fase } = useFaseAtual(session, profile)
  return <FaseBadge fase={fase} />
}

function AutoLancarRunner({ session, profile }) {
  useAutoLancarRecorrencias(session, profile)
  const { novasConquistas, dispensar } = useConquistas(session, profile)
  return <CelebracaoModal conquistas={novasConquistas} onClose={dispensar} />
}

// ── Maturidade IA na sidebar ──────────────────────────
function SidebarMaturidade({ session, profile }) {
  const { dados } = useMaturidadeIA(session, profile)
  if (!dados) return null
  const { nivelAtual, proximo, pctProximo, totalLancamentos } = dados

  return (
    <div style={{
      margin: '8px 10px',
      padding: '10px 12px',
      background: 'rgba(0,0,0,0.18)',
      borderRadius: 10,
      border: '0.5px solid rgba(196,151,58,0.25)',
    }}>
      {/* Linha principal */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ fontSize:16, lineHeight:1 }}>{nivelAtual.emoji}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#E8DCC8', letterSpacing:0.2 }}>
            IA {nivelAtual.nome}
          </div>
          <div style={{ fontSize:9, color:'rgba(232,220,200,0.5)', marginTop:1 }}>
            {totalLancamentos} lançamento{totalLancamentos !== 1 ? 's' : ''}
          </div>
        </div>
        <span style={{
          fontSize:9, fontWeight:700, letterSpacing:0.3,
          background:'rgba(196,151,58,0.2)',
          color:'#C4973A',
          padding:'2px 7px', borderRadius:20,
          border:'0.5px solid rgba(196,151,58,0.3)',
          flexShrink:0,
        }}>
          Nv {nivelAtual.nivel}
        </span>
      </div>

      {/* Barra de progresso */}
      {proximo && (
        <>
          <div style={{ height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden', marginBottom:5 }}>
            <div style={{
              height:'100%', width:`${pctProximo}%`,
              background:'linear-gradient(90deg, #C4973A, #DFB86A)',
              borderRadius:2, transition:'width 0.5s ease',
            }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'rgba(232,220,200,0.45)' }}>
            <span>{pctProximo}% completo</span>
            <span>{proximo.emoji} {proximo.nome} em {proximo.lancamentos - totalLancamentos}</span>
          </div>
        </>
      )}

      {!proximo && (
        <div style={{ fontSize:10, color:'#C4973A', fontWeight:700, textAlign:'center', marginTop:2 }}>
          🌺 Nível máximo atingido
        </div>
      )}
    </div>
  )
}

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
        <div style={{ fontSize:48, marginBottom:16 }}>🌿</div>
        <p style={{ color:'var(--secondary)' }}>Carregando...</p>
      </div>
    </div>
  )

  if (session && profile && !profile.onboarding_completo) {
    return <Onboarding session={session} onComplete={() => loadProfile(session.user.id)} />
  }

  if (!session) return <Landing onLogin={() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id)
    })
  }} />

  if (!profile) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🌿</div>
        <p style={{ color:'var(--secondary)', marginBottom:16 }}>Carregando seu perfil...</p>
      </div>
    </div>
  )

  const papelBg  = profile.papel === 'eu' ? 'var(--eu-bg)'   : 'var(--ela-bg)'
  const papelTxt = profile.papel === 'eu' ? 'var(--eu-text)' : 'var(--ela-text)'

  const pages = {
    visao: Visao, bancos: Bancos, receitas: Receitas, despesas: Despesas,
    cartoes: Cartoes, contas: Contas, streaming: Streaming, rendafixa: RendaFixa,
    reserva: Reserva, metas: Metas, notificacoes: Notificacoes, ia: IA,
    configuracoes: Configuracoes, admin: Admin,
  }
  const PageComponent = pages[tab] || Visao

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:9, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🌿</div>
            <div>
              <h1 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:20, fontWeight:600, letterSpacing:0.3, color:'var(--eden-cream)' }}>Éden</h1>
              <p style={{ fontStyle:'italic', color:'rgba(232,220,200,0.55)', fontSize:10 }}>Finanças a dois, sem segredos.</p>
            </div>
          </div>
        </div>

        {/* Maturidade IA */}
        <SidebarMaturidade session={session} profile={profile} />

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Finanças</div>
          {TABS.slice(0, 6).map(t => (
            <div key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <NavIcon id={t.id} />
              <span>{t.label}</span>
            </div>
          ))}
          <div className="nav-section-label">Investimentos</div>
          {TABS.slice(6, 10).map(t => (
            <div key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <NavIcon id={t.id} />
              <span>{t.label}</span>
            </div>
          ))}
          <div className="nav-section-label">Conta</div>
          {TABS.slice(10).map(t => (
            <div key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <NavIcon id={t.id} />
              <span>{t.label}</span>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-avatar">
              {profile.nome?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span className="sidebar-user-name">{profile.nome}</span>
                <SidebarFaseBadge session={session} profile={profile} />
              </div>
              <div className="sidebar-user-role">{profile.papel?.toUpperCase()} · {profile.casal_code}</div>
            </div>
            <button onClick={logout} title="Sair"
              style={{ background:'none', border:'none', color:'rgba(232,220,200,0.4)', cursor:'pointer', padding:4, display:'flex', alignItems:'center', flexShrink:0 }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M13 3h4v14h-4M9 13l4-3-4-3M2 10h11"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main">
        <TrialBanner profile={profile} session={session} />
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-page-icon">
              <div style={{ width:18, height:18 }} dangerouslySetInnerHTML={{ __html: ICONS[tab] || '' }} />
            </div>
            <h2>{TABS.find(t => t.id === tab)?.label}</h2>
          </div>
          <div className="topbar-right">
            <span style={{ fontSize:11, color:'var(--secondary)', background:'var(--eden-sand)', padding:'4px 10px', borderRadius:8, fontFamily:'monospace', letterSpacing:1 }}>
              {profile.casal_code}
            </span>
          </div>
        </div>
        <div className="page">
          <AutoLancarRunner session={session} profile={profile} />
          <PageComponent session={session} profile={profile} onProfileUpdate={() => loadProfile(session.user.id)} />
        </div>
      </main>
    </div>
  )
}
