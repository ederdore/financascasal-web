import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase.js'

const FEATURES = [
  { icon: '🌿', title: 'Dois como um', desc: 'Cada um tem seu perfil, mas compartilham o mesmo jardim financeiro em tempo real.' },
  { icon: '💳', title: 'Cartões e faturas', desc: 'Acompanhe a fatura crescendo. Pague com um clique e o banco é atualizado sozinho.' },
  { icon: '🎯', title: 'Metas do casal', desc: 'Viagem, casa, liberdade. Definam juntos, aportem mensalmente, colham os frutos.' },
  { icon: '🛡', title: 'Reserva de emergência', desc: 'Calculadora com base nos seus gastos reais. Saibam exatamente quanto guardar.' },
  { icon: '🤖', title: 'IA que aprende com vocês', desc: 'Análises personalizadas que ficam mais inteligentes a cada mês. Plano Premium.' },
  { icon: '✉️', title: 'Bot no Telegram', desc: '"Gastei 45 no mercado" — registrado. Sem abrir o app, sem esquecer.' },
]

const STEPS = [
  { n: '01', title: 'Crie sua conta', desc: 'Gratuito, sem cartão. Dois minutos.' },
  { n: '02', title: 'Convide seu parceiro(a)', desc: 'Código do casal. Tudo sincronizado.' },
  { n: '03', title: 'Configure seus bancos', desc: 'Débitos automáticos a cada lançamento.' },
  { n: '04', title: 'Plante o hábito', desc: 'App, web ou Telegram — onde for mais fácil.' },
]

function useCountUp(target, duration = 1800) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const start = Date.now()
      const tick = () => {
        const p = Math.min((Date.now()-start)/duration, 1)
        const ease = 1 - Math.pow(1-p, 3)
        setVal(Math.floor(ease * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      tick()
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])
  return [val, ref]
}

export default function Landing({ onLogin }) {
  const [tab, setTab]     = useState('login')
  const [loading, setLoad] = useState(false)
  const [msg, setMsg]     = useState({ txt: '', ok: true })
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome]   = useState('')
  const [recEmail, setRec] = useState('')
  const [menuOpen, setMenu] = useState(false)
  const loginRef = useRef(null)
  const [counter, counterRef] = useCountUp(3200)

  function scrollToLogin() {
    setMenu(false)
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function showMsg(txt, ok = true) {
    setMsg({ txt, ok })
    setTimeout(() => setMsg({ txt: '', ok: true }), 5000)
  }

  async function handleAuth(e) {
    e.preventDefault()
    setMsg({ txt: '', ok: true })
    setLoad(true)
    try {
      if (tab === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        showMsg('✅ Link enviado! Verifique seu e-mail.')
        setTimeout(() => setTab('login'), 3000)
        return
      }
      if (tab === 'cadastro') {
        const { error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        showMsg('✅ Conta criada! Confirme seu e-mail.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      onLogin()
    } catch(e) {
      const msgs = { 'Invalid login credentials': 'E-mail ou senha incorretos.', 'Email not confirmed': 'Confirme seu e-mail primeiro.', 'User already registered': 'Este e-mail já existe.' }
      showMsg(msgs[e.message] || e.message, false)
    } finally { setLoad(false) }
  }

  const S = {
    // cores
    bg:     '#FAF6EF',
    green:  '#3D5A3E',
    sage:   '#7A9E7E',
    terra:  '#C17F5A',
    sand:   '#E8DCC8',
    gold:   '#C4973A',
    bark:   '#2C1F14',
    cream:  '#FAF6EF',
    muted:  '#6B5E50',
    border: '#DDD5C5',
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: S.bg, color: S.bark, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        * { box-sizing: border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .fade-up { animation: fadeUp 0.7s ease both; }
        a { text-decoration: none; color: inherit; }
        input, textarea, select { font-family: inherit; }

        /* Nav */
        .nav-links-desktop { display: flex; align-items: center; gap: 28px; }
        .nav-hamburger { display: none; }
        .mobile-menu { display: none; }

        /* Responsive */
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-left { padding: 60px 28px 48px !important; }
          .hero-right { padding: 40px 28px !important; min-height: auto !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; max-width: 400px !important; }
          .section { padding: 72px 28px !important; }
          .cta-section { padding: 72px 28px !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
          footer { padding: 48px 28px 28px !important; }
        }

        @media (max-width: 640px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
          .mobile-menu.open { display: flex !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .hero-stat { flex-direction: column !important; gap: 4px !important; align-items: flex-start !important; }
          .hero-features { gap: 8px !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .footer-bottom { flex-direction: column !important; gap: 12px !important; text-align: center !important; }
          .section { padding: 56px 20px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 40px', height:60, background:'rgba(250,246,239,0.93)', backdropFilter:'blur(12px)', borderBottom:`0.5px solid ${S.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:S.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🌿</div>
          <span className="serif" style={{ fontSize:20, fontWeight:600, color:S.green, letterSpacing:0.3 }}>Éden</span>
        </div>

        {/* Desktop links */}
        <div className="nav-links-desktop">
          {[['#funcionalidades','Funcionalidades'],['#como-funciona','Como funciona'],['#precos','Preços']].map(([href,label]) => (
            <a key={href} href={href} onClick={e=>{e.preventDefault();document.querySelector(href)?.scrollIntoView({behavior:'smooth'})}}
              style={{ fontSize:13, color:S.muted, fontWeight:500, transition:'color .15s' }}
              onMouseEnter={e=>e.target.style.color=S.green} onMouseLeave={e=>e.target.style.color=S.muted}>
              {label}
            </a>
          ))}
          <button onClick={scrollToLogin} style={{ background:S.green, color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Entrar
          </button>
        </div>

        {/* Hamburger */}
        <button className="nav-hamburger" onClick={()=>setMenu(!menuOpen)}
          style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', gap:5, padding:4 }}>
          {[0,1,2].map(i => <div key={i} style={{ width:22, height:2, background:S.green, borderRadius:1 }} />)}
        </button>
      </nav>

      {/* Mobile menu */}
      <div className={`mobile-menu${menuOpen?' open':''}`}
        style={{ position:'fixed', top:60, left:0, right:0, zIndex:99, background:S.bg, borderBottom:`0.5px solid ${S.border}`, flexDirection:'column', padding:'20px 24px', gap:16, display:'none' }}>
        {[['#funcionalidades','Funcionalidades'],['#como-funciona','Como funciona'],['#precos','Preços']].map(([href,label]) => (
          <a key={href} href={href} onClick={e=>{e.preventDefault();setMenu(false);document.querySelector(href)?.scrollIntoView({behavior:'smooth'})}}
            style={{ fontSize:15, color:S.muted, fontWeight:500, padding:'8px 0', borderBottom:`0.5px solid ${S.border}` }}>
            {label}
          </a>
        ))}
        <button onClick={scrollToLogin} style={{ background:S.green, color:'#fff', border:'none', padding:'12px', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:4 }}>
          Entrar no Éden
        </button>
      </div>

      {/* ── HERO ── */}
      <section style={{ paddingTop:60 }}>
        <div className="hero-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:'100vh' }}>

          {/* Esquerda */}
          <div className="hero-left" style={{ background:S.green, padding:'88px 64px 88px 80px', display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', overflow:'hidden' }}>
            {/* Textura vegetal sutil */}
            <div style={{ position:'absolute', top:-100, right:-80, width:500, height:500, background:'radial-gradient(circle, rgba(196,151,58,0.12) 0%, transparent 65%)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:-60, left:-40, width:300, height:300, background:'radial-gradient(circle, rgba(122,158,126,0.15) 0%, transparent 65%)', pointerEvents:'none' }} />

            <p className="fade-up" style={{ fontSize:11, fontWeight:600, letterSpacing:2.5, textTransform:'uppercase', color:S.gold, marginBottom:18, animationDelay:'0s' }}>
              🌿 Um novo começo financeiro
            </p>

            <h1 className="fade-up serif" style={{ fontSize:'clamp(38px,4.5vw,58px)', fontWeight:600, lineHeight:1.1, color:'#fff', marginBottom:22, letterSpacing:-0.5, animationDelay:'0.1s' }}>
              O jardim das<br />
              <em style={{ fontStyle:'italic', color:S.gold }}>suas finanças.</em>
            </h1>

            <p className="fade-up" style={{ fontSize:16, color:'rgba(232,220,200,0.75)', lineHeight:1.7, marginBottom:36, maxWidth:380, animationDelay:'0.2s' }}>
              Dinheiro é o assunto que mais divide casais. O Éden coloca tudo na mesa — para os dois verem, decidirem e crescerem juntos.
            </p>

            {/* Stat animado */}
            <div ref={counterRef} className="hero-stat fade-up" style={{ display:'inline-flex', alignItems:'baseline', gap:12, background:'rgba(255,255,255,0.06)', border:`0.5px solid rgba(196,151,58,0.3)`, borderRadius:12, padding:'14px 20px', marginBottom:36, animationDelay:'0.3s' }}>
              <span className="serif" style={{ fontSize:38, fontWeight:600, color:S.gold, letterSpacing:-1 }}>
                R$ {counter.toLocaleString('pt-BR')}
              </span>
              <span style={{ fontSize:13, color:'rgba(232,220,200,0.6)', lineHeight:1.4, maxWidth:150 }}>
                economizados em média no primeiro mês
              </span>
            </div>

            {/* Features mini */}
            <div className="hero-features fade-up" style={{ display:'flex', flexDirection:'column', gap:10, animationDelay:'0.4s' }}>
              {['Sincronização em tempo real entre vocês dois','IA que aprende e evolui com o casal','App, web e bot Telegram integrados','Dados protegidos pela LGPD'].map(f => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'rgba(232,220,200,0.78)' }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:S.gold, flexShrink:0 }} />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Direita — Login */}
          <div className="hero-right" ref={loginRef} style={{ background:S.sand, display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 48px', position:'relative', minHeight:600 }}>
            {/* Fundo sutil */}
            <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, rgba(232,220,200,0) 0%, rgba(232,220,200,0.9) 50%), url(https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&q=50&fit=crop) center/cover no-repeat`, opacity:0.3 }} />

            <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:400, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', border:`0.5px solid rgba(61,90,62,0.1)`, borderRadius:20, padding:36, boxShadow:'0 20px 60px rgba(44,31,20,0.14)' }}>

              {/* Logo no card */}
              <div style={{ textAlign:'center', marginBottom:22 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:S.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🌿</div>
                  <span className="serif" style={{ fontSize:20, fontWeight:600, color:S.green }}>Éden</span>
                </div>
                <div style={{ fontSize:13, color:S.muted }}>
                  {tab === 'recuperar' ? 'Recuperar acesso' : 'Entre no seu jardim'}
                </div>
              </div>

              {/* Tabs */}
              {tab !== 'recuperar' && (
                <div style={{ display:'flex', background:S.sand, borderRadius:10, padding:4, marginBottom:22, gap:0 }}>
                  {[['login','Entrar'],['cadastro','Criar conta']].map(([id,label]) => (
                    <button key={id} onClick={()=>{setTab(id);setMsg({txt:'',ok:true})}}
                      style={{ flex:1, padding:'8px 12px', border:'none', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', background:tab===id?'#fff':'transparent', color:tab===id?S.green:S.muted, boxShadow:tab===id?'0 1px 4px rgba(61,90,62,0.12)':'none' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Mensagem */}
              {msg.txt && (
                <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:14, fontSize:13, background:msg.ok?'rgba(61,90,62,0.08)':'rgba(192,75,58,0.08)', color:msg.ok?S.green:'#8B2315', border:`0.5px solid ${msg.ok?'rgba(61,90,62,0.2)':'rgba(192,75,58,0.2)'}` }}>
                  {msg.txt}
                </div>
              )}

              <form onSubmit={handleAuth}>
                {/* Valor em destaque (login/cadastro) */}
                {tab !== 'recuperar' && (
                  <div style={{ background:S.sand, borderRadius:12, padding:'16px 14px', marginBottom:16, textAlign:'center' }}>
                    <input type={tab==='cadastro'?'email':'email'} placeholder={tab==='cadastro'?'Seu nome' : 'E-mail'} style={{ display:'none' }} />
                    {tab === 'cadastro' && (
                      <input style={{ width:'100%', padding:'10px 13px', border:`0.5px solid ${S.border}`, borderRadius:9, fontSize:14, background:'#fff', fontFamily:'inherit', outline:'none', marginBottom:10 }}
                        placeholder="Seu nome" value={nome} onChange={e=>setNome(e.target.value)} />
                    )}
                    <input style={{ width:'100%', padding:'10px 13px', border:`0.5px solid ${S.border}`, borderRadius:9, fontSize:14, background:'#fff', fontFamily:'inherit', outline:'none', marginBottom:10 }}
                      type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:12, color:S.muted }}>Senha</span>
                      {tab==='login' && (
                        <button type="button" onClick={()=>{setTab('recuperar');setMsg({txt:'',ok:true})}}
                          style={{ fontSize:11, color:S.sage, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                          Esqueci minha senha
                        </button>
                      )}
                    </div>
                    <input style={{ width:'100%', padding:'10px 13px', border:`0.5px solid ${S.border}`, borderRadius:9, fontSize:14, background:'#fff', fontFamily:'inherit', outline:'none' }}
                      type="password" placeholder="••••••••" value={senha} onChange={e=>setSenha(e.target.value)} required />
                  </div>
                )}

                {tab === 'recuperar' && (
                  <div style={{ marginBottom:16 }}>
                    <input style={{ width:'100%', padding:'11px 14px', border:`0.5px solid ${S.border}`, borderRadius:9, fontSize:14, background:S.sand, fontFamily:'inherit', outline:'none' }}
                      type="email" placeholder="seu@email.com" value={recEmail} onChange={e=>setRec(e.target.value)} required autoFocus />
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:'13px', background:S.green, color:'#fff', border:'none', borderRadius:11, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', opacity:loading?0.7:1, transition:'all .15s' }}>
                  {loading ? 'Aguarde...' : tab==='login' ? 'Entrar no Éden →' : tab==='cadastro' ? 'Plantar minha conta →' : 'Enviar link →'}
                </button>
              </form>

              {tab !== 'recuperar' && (
                <button onClick={()=>{setTab(tab==='login'?'cadastro':'login');setMsg({txt:'',ok:true})}}
                  style={{ display:'block', width:'100%', textAlign:'center', marginTop:14, fontSize:12, color:S.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  {tab==='login' ? 'Não tem conta? Cadastre-se grátis' : 'Já tem conta? Entrar'}
                </button>
              )}
              {tab === 'recuperar' && (
                <button onClick={()=>{setTab('login');setMsg({txt:'',ok:true})}}
                  style={{ display:'block', width:'100%', textAlign:'center', marginTop:14, fontSize:12, color:S.muted, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  ← Voltar para o login
                </button>
              )}

              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:20, paddingTop:16, borderTop:`0.5px solid ${S.border}`, justifyContent:'center' }}>
                <span style={{ fontSize:11, color:S.muted }}>🔒 Protegido pela LGPD</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section id="funcionalidades" className="section" style={{ padding:'100px 80px' }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:S.terra, marginBottom:14 }}>O que o Éden oferece</p>
        <h2 className="serif" style={{ fontSize:'clamp(28px,3vw,44px)', fontWeight:600, color:S.green, marginBottom:16, letterSpacing:-0.3, lineHeight:1.15 }}>
          Feito para a vida financeira<br />real de um casal
        </h2>
        <p style={{ fontSize:16, color:S.muted, maxWidth:520, lineHeight:1.7, marginBottom:56 }}>
          Não é mais uma planilha. É um jardim onde vocês cultivam o hábito da prosperidade juntos.
        </p>

        <div className="features-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
          {FEATURES.map(f => (
            <div key={f.title}
              style={{ background:'#fff', border:`0.5px solid ${S.border}`, borderRadius:16, padding:26, transition:'transform .2s, box-shadow .2s', cursor:'default' }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 12px 40px rgba(61,90,62,0.1)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
              <div style={{ width:44, height:44, borderRadius:12, background:S.sand, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:16 }}>
                {f.icon}
              </div>
              <div className="serif" style={{ fontSize:18, fontWeight:600, color:S.green, marginBottom:8 }}>{f.title}</div>
              <div style={{ fontSize:14, color:S.muted, lineHeight:1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" className="section" style={{ padding:'100px 80px', background:S.sand }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:S.terra, marginBottom:14 }}>Em minutos</p>
        <h2 className="serif" style={{ fontSize:'clamp(28px,3vw,44px)', fontWeight:600, color:S.green, marginBottom:60, letterSpacing:-0.3 }}>
          Plantem juntos em 4 passos
        </h2>
        <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:32 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ textAlign:'center' }}>
              <div className="serif" style={{ fontSize:52, fontWeight:700, color:S.terra, opacity:0.3, lineHeight:1, marginBottom:14 }}>{s.n}</div>
              <div style={{ fontWeight:600, fontSize:15, color:S.green, marginBottom:8 }}>{s.title}</div>
              <div style={{ fontSize:13, color:S.muted, lineHeight:1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEPOIMENTO ── */}
      <section className="section" style={{ padding:'80px 80px', textAlign:'center' }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <div style={{ color:S.gold, fontSize:20, letterSpacing:3, marginBottom:24 }}>★★★★★</div>
          <div className="serif" style={{ fontSize:'clamp(20px,2.5vw,30px)', fontStyle:'italic', color:S.green, lineHeight:1.5, marginBottom:32 }}>
            "Finalmente paramos de evitar a conversa sobre dinheiro. O Éden colocou{' '}
            <span style={{ color:S.terra }}>tudo na mesa</span> de um jeito que os dois entendemos."
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14 }}>
            <div style={{ width:48, height:48, borderRadius:14, background:S.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>💑</div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontWeight:600, fontSize:14, color:S.green }}>João & Maria</div>
              <div style={{ fontSize:12, color:S.muted }}>Usuários desde jan/2025 · São Paulo</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PREÇOS ── */}
      <section id="precos" className="section" style={{ padding:'100px 80px', background:S.sand, textAlign:'center' }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:S.terra, marginBottom:14 }}>Simples e justo</p>
        <h2 className="serif" style={{ fontSize:'clamp(28px,3vw,44px)', fontWeight:600, color:S.green, marginBottom:16 }}>
          Comece a plantar grátis
        </h2>
        <p style={{ fontSize:16, color:S.muted, marginBottom:56 }}>Sem cartão de crédito para começar.</p>

        <div className="pricing-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, maxWidth:720, margin:'0 auto' }}>
          {/* Free */}
          <div style={{ background:'#fff', border:`0.5px solid ${S.border}`, borderRadius:20, padding:36, textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:600, color:S.muted, marginBottom:8 }}>Plano Gratuito</div>
            <div className="serif" style={{ fontSize:44, fontWeight:700, color:S.green, lineHeight:1, marginBottom:4 }}>R$ 0</div>
            <div style={{ fontSize:13, color:S.muted, marginBottom:28 }}>para sempre · sem cartão</div>
            <ul style={{ listStyle:'none', marginBottom:32 }}>
              {['1 banco e 1 cartão','Despesas e receitas','Metas e reserva','Código do casal'].map(i=>(
                <li key={i} style={{ fontSize:14, color:S.muted, padding:'7px 0', borderBottom:`0.5px solid ${S.border}`, display:'flex', gap:10 }}>
                  <span style={{ color:S.sage, fontWeight:700 }}>✓</span>{i}
                </li>
              ))}
              {['IA financeira','Aprendizado contínuo'].map(i=>(
                <li key={i} style={{ fontSize:14, color:S.border, padding:'7px 0', borderBottom:`0.5px solid ${S.border}`, display:'flex', gap:10 }}>
                  <span>—</span>{i}
                </li>
              ))}
            </ul>
            <button onClick={scrollToLogin}
              style={{ width:'100%', padding:13, borderRadius:11, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:`1.5px solid ${S.green}`, color:S.green, background:'transparent', transition:'all .15s' }}
              onMouseEnter={e=>{e.currentTarget.style.background=S.green;e.currentTarget.style.color='#fff'}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=S.green}}>
              Plantar grátis
            </button>
          </div>

          {/* Premium */}
          <div style={{ background:S.green, border:'none', borderRadius:20, padding:36, textAlign:'left', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200, background:'radial-gradient(circle, rgba(196,151,58,0.2) 0%, transparent 70%)' }} />
            <div style={{ display:'inline-block', background:S.gold, color:S.bark, fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', padding:'4px 10px', borderRadius:20, marginBottom:18 }}>Mais completo</div>
            <div style={{ fontSize:13, fontWeight:600, color:'rgba(232,220,200,0.6)', marginBottom:8 }}>Plano Premium</div>
            <div className="serif" style={{ fontSize:44, fontWeight:700, color:'#fff', lineHeight:1, marginBottom:4 }}>R$ 24</div>
            <div style={{ fontSize:13, color:'rgba(232,220,200,0.6)', marginBottom:28 }}>por casal · mês</div>
            <ul style={{ listStyle:'none', marginBottom:32 }}>
              {['Bancos e cartões ilimitados','Metas, reserva e renda fixa','IA com Claude (análise profunda)','Aprendizado contínuo do casal','Bot Telegram com IA','Retrospectiva mensal automática','Conquistas e celebrações'].map(i=>(
                <li key={i} style={{ fontSize:14, color:'rgba(232,220,200,0.82)', padding:'7px 0', borderBottom:'0.5px solid rgba(255,255,255,0.1)', display:'flex', gap:10 }}>
                  <span style={{ color:S.gold, fontWeight:700 }}>✓</span>{i}
                </li>
              ))}
            </ul>
            <button onClick={scrollToLogin}
              style={{ width:'100%', padding:13, borderRadius:11, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:S.gold, color:S.bark, transition:'all .15s' }}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.9'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              Experimentar 14 dias grátis →
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section" style={{ background:S.green, padding:'88px 80px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-80, left:'50%', transform:'translateX(-50%)', width:600, height:400, background:'radial-gradient(ellipse, rgba(196,151,58,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />
        <h2 className="serif" style={{ fontSize:'clamp(28px,3.5vw,48px)', fontWeight:600, color:'#fff', marginBottom:16, position:'relative', lineHeight:1.15 }}>
          Prontos para florescer<br />
          <em style={{ fontStyle:'italic', color:S.gold }}>financeiramente juntos?</em>
        </h2>
        <p style={{ fontSize:16, color:'rgba(232,220,200,0.65)', marginBottom:36, position:'relative' }}>
          Porque dinheiro não deveria ser segredo entre vocês.
        </p>
        <button onClick={scrollToLogin}
          style={{ display:'inline-block', padding:'15px 40px', background:S.gold, color:S.bark, borderRadius:11, fontSize:15, fontWeight:700, border:'none', cursor:'pointer', position:'relative', transition:'all .15s' }}
          onMouseEnter={e=>{e.currentTarget.style.background=S.sand;e.currentTarget.style.transform='translateY(-1px)'}}
          onMouseLeave={e=>{e.currentTarget.style.background=S.gold;e.currentTarget.style.transform=''}}>
          Criar conta grátis →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:'#1E1208', padding:'56px 80px 32px', color:'rgba(232,220,200,0.55)' }}>
        <div className="footer-grid" style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:48 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:S.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🌿</div>
              <span className="serif" style={{ fontSize:20, fontWeight:600, color:S.sand }}>Éden</span>
            </div>
            <p style={{ fontSize:13, lineHeight:1.7, maxWidth:260, fontStyle:'italic', color:'rgba(232,220,200,0.45)' }}>
              "E plantou o Senhor Deus um jardim para prosperar." Finanças a dois, sem segredos..
            </p>
          </div>
          {[
            ['Produto', [['#funcionalidades','Funcionalidades'],['#como-funciona','Como funciona'],['#precos','Preços']]],
            ['Legal', [['#','Política de Privacidade'],['#','Termos de Uso'],['#','LGPD']]],
            ['Contato', [['mailto:contato@edenfinancas.com.br','contato@eden...'],['mailto:privacidade@edenfinancas.com.br','privacidade@eden...'],['#','Suporte']]],
          ].map(([title, links]) => (
            <div key={String(title)}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(232,220,200,0.3)', marginBottom:16 }}>{title}</div>
              <ul style={{ listStyle:'none' }}>
                {(links as [string,string][]).map(([href,label]) => (
                  <li key={label} style={{ marginBottom:10 }}>
                    <a href={href} style={{ fontSize:13, color:'rgba(232,220,200,0.5)', transition:'color .15s' }}
                      onMouseEnter={e=>(e.target as HTMLElement).style.color=S.sand}
                      onMouseLeave={e=>(e.target as HTMLElement).style.color='rgba(232,220,200,0.5)'}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom" style={{ borderTop:'0.5px solid rgba(255,255,255,0.06)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
          <span>© 2025 Éden. Todos os direitos reservados.</span>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'5px 14px', fontSize:11 }}>
            🔒 Dados protegidos pela LGPD
          </div>
        </div>
      </footer>
    </div>
  )
}
