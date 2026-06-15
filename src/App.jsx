import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import Landing from './pages/Landing.jsx'
import Jardim from './pages/Jardim.jsx'
import Patrimonio from './pages/Patrimonio.jsx'
import Metas from './pages/Metas.jsx'
import Contas from './pages/Contas.jsx'
import Planejamento from './pages/Planejamento.jsx'
import Streaming from './pages/Streaming.jsx'
import Broto from './pages/Broto.jsx'
import Conquistas from './pages/Conquistas.jsx'
import Configuracoes from './pages/Configuracoes.jsx'
import Admin from './pages/Admin.jsx'
import { useAutoLancarRecorrencias } from './components/AutoLancarRecorrencias.jsx'
import { useConquistas, CelebracaoModal } from './components/Conquistas.jsx'
import { useFaseAtual, FaseBadge } from './components/FasesFinanceiras.jsx'
import Onboarding from './pages/Onboarding.jsx'
import { TrialBanner } from './components/StripeUpgrade.jsx'
import { useMaturidadeIA } from './components/IAMaturidade.jsx'
import { verificarAtividade } from './components/Eventos.js'

// ── Ícones SVG ────────────────────────────────────────
const ICONS = {
  jardim: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M10 17c0 0-7-4-7-9a7 7 0 0114 0c0 5-7 9-7 9z"/>
    <path d="M10 8v9M7 11l3-3 3 3"/>
  </svg>`,
  patrimonio: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M2 8l8-5 8 5"/>
    <rect x="4" y="8" width="2.5" height="6"/>
    <rect x="8.75" y="8" width="2.5" height="6"/>
    <rect x="13.5" y="8" width="2.5" height="6"/>
    <line x1="2" y1="17" x2="18" y2="17"/>
  </svg>`,
  metas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="10" cy="10" r="7.5"/>
    <circle cx="10" cy="10" r="4"/>
    <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/>
  </svg>`,
  contas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="2" y="5" width="16" height="11" rx="2"/>
    <line x1="2" y1="9" x2="18" y2="9"/>
    <line x1="5" y1="13" x2="8" y2="13"/>
  </svg>`,
  planejamento: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="3" y="3" width="14" height="14" rx="2"/>
    <path d="M3 8h14M8 3v14"/>
  </svg>`,
  assinaturas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="2" y="4" width="16" height="11" rx="2"/>
    <path d="M8 15l2 2 2-2"/>
    <path d="M8 8.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/>
  </svg>`,
  broto: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="3" y="5" width="14" height="10" rx="3"/>
    <circle cx="7" cy="10" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="13" cy="10" r="1.2" fill="currentColor" stroke="none"/>
  </svg>`,
  conquistas: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M6 3h8l2 4c0 3-2 5-6 6-4-1-6-3-6-6z"/>
    <path d="M6 17h8M10 13v4"/>
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
  { id: 'jardim',       icon: 'jardim',       label: '🏡 Jardim',        section: 'principal' },
  { id: 'patrimonio',   icon: 'patrimonio',   label: '🌳 Patrimônio',     section: 'principal' },
  { id: 'metas',        icon: 'metas',        label: '🎯 Metas',          section: 'principal' },
  { id: 'contas',       icon: 'contas',       label: '💳 Contas',         section: 'gestao' },
  { id: 'planejamento', icon: 'planejamento', label: '📊 Planejamento',   section: 'gestao' },
  { id: 'assinaturas',  icon: 'assinaturas',  label: '🔄 Assinaturas',   section: 'gestao' },
  { id: 'broto',        icon: 'broto',        label: '🤖 Broto',          section: 'inteligencia' },
  { id: 'conquistas',   icon: 'conquistas',   label: '🍎 Conquistas',     section: 'inteligencia' },
  { id: 'configuracoes',icon: 'configuracoes',label: '⚙️ Configurações',  section: 'conta' },
  { id: 'admin',        icon: 'admin',        label: '🛠 Admin',           section: 'conta' },
]

const SECTIONS = [
  { id: 'principal',    label: 'Jardim' },
  { id: 'gestao',       label: 'Gestão' },
  { id: 'inteligencia', label: 'Inteligência' },
  { id: 'conta',        label: 'Conta' },
]

function NavIcon({ id }) {
  return <div className="icon" dangerouslySetInnerHTML={{ __html: ICONS[id] || '' }} />
}

function SidebarFaseBadge({ session, profile }) {
  const { fase } = useFaseAtual(session, profile)
  return <FaseBadge fase={fase} />
}

function SidebarMaturidade({ session, profile }) {
  const { dados } = useMaturidadeIA(session, profile)
  if (!dados) return null
  const { nivelAtual, proximo, pctProximo, totalLancamentos } = dados
  return (
    <div style={{ margin:'8px 10px', padding:'10px 12px', background:'#FFFFFF', borderRadius:10, boxShadow:'0 1px 4px rgba(0,0,0,0.12)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'#F3F0F9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:15 }}>🧠</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#2C1F14' }}>{nivelAtual.emoji} Broto {nivelAtual.nome}</div>
          <div style={{ fontSize:10, color:'#7A7060', marginTop:1 }}>{totalLancamentos} lançamentos</div>
        </div>
        <span style={{ fontSize:10, fontWeight:700, background:'#FDF8EC', color:'#C4973A', padding:'2px 8px', borderRadius:20, border:'0.5px solid #C4973A', flexShrink:0 }}>
          Nv {nivelAtual.nivel}
        </span>
      </div>
      {proximo && (
        <>
          <div style={{ height:4, background:'#E8DCC8', borderRadius:2, overflow:'hidden', marginBottom:5 }}>
            <div style={{ height:'100%', width:`${pctProximo}%`, background:'linear-gradient(90deg,#C4973A,#DFB86A)', borderRadius:2, transition:'width 0.5s' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#7A7060' }}>
            <span>{pctProximo}%</span>
            <span>{proximo.emoji} {proximo.nome} em {proximo.lancamentos - totalLancamentos}</span>
          </div>
        </>
      )}
    </div>
  )
}

function AutoLancarRunner({ session, profile }) {
  useAutoLancarRecorrencias(session, profile)
  const { novasConquistas, dispensar } = useConquistas(session, profile)
  useEffect(() => {
    if (!session?.user?.id || !profile?.casal_code) return
    const t = setTimeout(() => verificarAtividade(session.user.id, profile.casal_code), 5000)
    return () => clearTimeout(t)
  }, [session?.user?.id])
  return <CelebracaoModal conquistas={novasConquistas} onClose={dispensar} />
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('jardim')

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

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🌿</div>
        <p style={{ color:'var(--secondary)' }}>Cultivando seu jardim...</p>
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
        <p style={{ color:'var(--secondary)' }}>Carregando seu jardim...</p>
      </div>
    </div>
  )

  // Pages map — mantém todas as páginas existentes + novas
  const pages = {
    jardim:       Jardim,
    patrimonio:   Patrimonio,
    metas:        Metas,
    contas:       Contas,
    planejamento: Planejamento,
    assinaturas:  Streaming,
    broto:        Broto,
    conquistas:   Conquistas,
    configuracoes:Configuracoes,
    admin:        Admin,
  }
  const PageComponent = pages[tab] || Jardim
  const tabAtual = TABS.find(t => t.id === tab)

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:9, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:'var(--eden-cream)' }}>É</span>
            </div>
            <div>
              <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, letterSpacing:0.3, color:'var(--eden-cream)' }}>Éden</h1>
              <p style={{ fontStyle:'italic', color:'rgba(232,220,200,0.55)', fontSize:10 }}>Finanças a dois, sem segredos.</p>
            </div>
          </div>
        </div>

        {/* Broto IA */}
        <SidebarMaturidade session={session} profile={profile} />

        {/* Nav por seção */}
        <nav className="sidebar-nav">
          {SECTIONS.map(sec => {
            const tabsDaSec = TABS.filter(t => t.section === sec.id)
            // Oculta admin se não for admin
            const visíveis = tabsDaSec.filter(t => t.id !== 'admin' || profile.email === 'dore09@gmail.com')
            if (!visíveis.length) return null
            return (
              <div key={sec.id}>
                <div className="nav-section-label">{sec.label}</div>
                {visíveis.map(t => (
                  <div key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                    <NavIcon id={t.icon} />
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-avatar">{profile.nome?.charAt(0)?.toUpperCase() || '?'}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span className="sidebar-user-name">{profile.nome}</span>
                <SidebarFaseBadge session={session} profile={profile} />
              </div>
              <div className="sidebar-user-role">{profile.papel?.toUpperCase()} · {profile.casal_code}</div>
            </div>
            <button onClick={() => supabase.auth.signOut()} title="Sair"
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
            <h2>{tabAtual?.label}</h2>
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
