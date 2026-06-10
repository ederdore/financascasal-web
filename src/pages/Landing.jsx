import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase.js'

const FEATURES = [
  { icon: '💑', title: 'EU e ELA separados', desc: 'Cada um tem seu perfil, sua renda e sua visão — mas compartilham o mesmo painel em tempo real.' },
  { icon: '💳', title: 'Cartões e faturas', desc: 'Acompanhe a fatura crescendo em tempo real. Pague com 1 clique e o banco é debitado automaticamente.' },
  { icon: '🎯', title: 'Metas financeiras', desc: 'Viagem, casa própria, carro novo. Defina metas, aporte mensalmente e veja o progresso de cada um.' },
  { icon: '🛡️', title: 'Reserva de emergência', desc: 'Calculadora automática de 6 ou 12 meses com base nas suas despesas fixas reais. Em BRL e USD.' },
  { icon: '🤖', title: 'IA financeira', desc: 'Análise mensal personalizada com diagnóstico, alertas e sugestões práticas baseados nos seus dados reais.' },
  { icon: '✈️', title: 'Bot no Telegram', desc: '"Gastei R$ 45 no mercado" — o bot entende e lança automaticamente. Sem abrir o app.' },
]

const STEPS = [
  { n: '1', title: 'Crie sua conta', desc: 'Cadastro gratuito em segundos. Nenhum cartão necessário para começar.' },
  { n: '2', title: 'Convide seu parceiro(a)', desc: 'Compartilhe o código do casal. Vocês dois passam a ver o mesmo painel.' },
  { n: '3', title: 'Configure seus bancos', desc: 'Adicione seus bancos e cartões. Cada lançamento debita automaticamente.' },
  { n: '4', title: 'Comece a lançar', desc: 'App mobile, versão web ou Telegram. Registre onde for mais conveniente.' },
]

function AnimatedNumber({ target, prefix = '', duration = 1800 }) {
  const [current, setCurrent] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const start = Date.now()
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setCurrent(Math.floor(ease * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      tick()
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])
  return <span ref={ref}>{prefix}{current.toLocaleString('pt-BR')}</span>
}

export default function Landing({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ texto: '', tipo: '' })
  const loginRef = useRef(null)

  // Form state
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [recEmail, setRecEmail] = useState('')

  function showMsg(texto, tipo = 'sucesso') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 5000)
  }

  function scrollToLogin() {
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !senha) { showMsg('Preencha e-mail e senha', 'erro'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      onLogin()
    } catch (e) {
      const msgs = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
      }
      showMsg(msgs[e.message] || e.message, 'erro')
    } finally { setLoading(false) }
  }

  async function handleCadastro(e) {
    e.preventDefault()
    if (!nome || !email || !senha) { showMsg('Preencha todos os campos', 'erro'); return }
    if (senha.length < 6) { showMsg('Senha deve ter mínimo 6 caracteres', 'erro'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password: senha })
      if (error) throw error
      showMsg('✅ Conta criada! Verifique seu e-mail para confirmar.')
      setTab('login')
    } catch (e) {
      const msgs = { 'User already registered': 'Este e-mail já está cadastrado.' }
      showMsg(msgs[e.message] || e.message, 'erro')
    } finally { setLoading(false) }
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    if (!recEmail) { showMsg('Informe seu e-mail', 'erro'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recEmail, {
        redirectTo: `${window.location.origin}`,
      })
      if (error) throw error
      showMsg('✅ Link enviado! Verifique seu e-mail.')
    } catch (e) { showMsg('Erro: ' + e.message, 'erro') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: '#FAFAF8', color: '#1A1A18' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');
        :root {
          --verde: #0D3D2B; --verde-md: #1A5C40; --verde-lt: #2E8B5A;
          --dourado: #C9A84C; --dourado-lt: #E8C96A;
          --creme: #F5F0E8; --creme-dk: #EDE5D5;
          --muted: #5C5C52; --border: rgba(13,61,43,0.12);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        .playfair { font-family: 'Playfair Display', Georgia, serif; }
        .fade-in { animation: fadeSlide 0.7s ease both; }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @media(prefers-reduced-motion:reduce) { .fade-in { animation:none } }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 40px', height:64, background:'rgba(250,250,248,0.92)', backdropFilter:'blur(12px)', borderBottom:'0.5px solid var(--border)' }}>
        <div className="playfair" style={{ fontSize:20, fontWeight:700, color:'var(--verde)' }}>
          Finanças<span style={{ color:'var(--dourado)' }}>Casal</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:28 }}>
          {[['#funcionalidades','Funcionalidades'],['#como-funciona','Como funciona'],['#precos','Preços']].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize:13, color:'var(--muted)', textDecoration:'none', fontWeight:500 }}
              onClick={e => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior:'smooth' }) }}>
              {label}
            </a>
          ))}
          <button onClick={scrollToLogin} style={{ background:'var(--verde)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Entrar
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight:'100vh', display:'grid', gridTemplateColumns:'1fr 1fr', paddingTop:64 }}>

        {/* Esquerda */}
        <div style={{ background:'var(--verde)', padding:'80px 64px 80px 80px', display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-120, right:-80, width:400, height:400, background:'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)', pointerEvents:'none' }} />

          <p className="fade-in" style={{ fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:'var(--dourado)', marginBottom:20 }}>
            Para casais que pensam juntos
          </p>
          <h1 className="playfair fade-in" style={{ fontSize:'clamp(36px,4vw,52px)', fontWeight:700, lineHeight:1.15, color:'#fff', marginBottom:24, letterSpacing:-0.5, animationDelay:'0.1s' }}>
            O dinheiro do casal,<br />
            <em style={{ fontStyle:'italic', color:'var(--dourado-lt)' }}>finalmente organizado.</em>
          </h1>
          <p className="fade-in" style={{ fontSize:16, color:'rgba(255,255,255,0.72)', lineHeight:1.7, marginBottom:40, maxWidth:380, animationDelay:'0.2s' }}>
            Despesas, metas, reserva e investimentos — tudo compartilhado em tempo real entre você e seu parceiro(a).
          </p>

          {/* Stat animado */}
          <div className="fade-in" style={{ display:'inline-flex', alignItems:'baseline', gap:12, background:'rgba(255,255,255,0.07)', border:'0.5px solid rgba(201,168,76,0.3)', borderRadius:12, padding:'16px 24px', marginBottom:40, animationDelay:'0.35s' }}>
            <div className="playfair" style={{ fontSize:36, fontWeight:700, color:'var(--dourado-lt)', letterSpacing:-1 }}>
              <AnimatedNumber target={3200} prefix="R$ " />
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.4, maxWidth:160 }}>
              economizados em média no primeiro mês
            </div>
          </div>

          {/* Features mini */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {['Sincronização em tempo real entre vocês dois', 'Análise financeira com IA personalizada', 'App mobile + versão web + bot Telegram', 'Dados protegidos pela LGPD'].map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:12, fontSize:14, color:'rgba(255,255,255,0.8)' }}>
                <div style={{ width:6, height:6, borderRadius:3, background:'var(--dourado)', flexShrink:0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Direita — Login */}
        <div ref={loginRef} style={{ background:'var(--creme)', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 48px', position:'relative' }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(245,240,232,0) 0%,rgba(245,240,232,0.95) 55%), url(https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=60&fit=crop) center/cover no-repeat', opacity:0.3 }} />
          <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:400, background:'rgba(255,255,255,0.93)', backdropFilter:'blur(20px)', border:'0.5px solid rgba(13,61,43,0.1)', borderRadius:20, padding:40, boxShadow:'0 20px 60px rgba(13,61,43,0.12)' }}>

            <div className="playfair" style={{ fontSize:24, fontWeight:600, color:'var(--verde)', marginBottom:4 }}>
              {tab === 'recuperar' ? 'Recuperar senha' : 'Bem-vindo(a)'}
            </div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:24 }}>
              {tab === 'recuperar' ? 'Receba um link para redefinir sua senha' : 'Entre na sua conta ou comece gratuitamente'}
            </div>

            {/* Tabs */}
            {tab !== 'recuperar' && (
              <div style={{ display:'flex', background:'var(--creme-dk)', borderRadius:10, padding:4, marginBottom:24, gap:0 }}>
                {[['login','Entrar'],['cadastro','Criar conta']].map(([id, label]) => (
                  <button key={id} onClick={() => { setTab(id); setMsg({ texto:'', tipo:'' }) }}
                    style={{ flex:1, padding:'8px 12px', border:'none', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all .2s', background: tab === id ? '#fff' : 'transparent', color: tab === id ? 'var(--verde)' : 'var(--muted)', boxShadow: tab === id ? '0 1px 4px rgba(13,61,43,0.1)' : 'none' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Mensagem */}
            {msg.texto && (
              <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:14, fontSize:13, background: msg.tipo === 'sucesso' ? '#E1F5EE' : '#FCEBEB', color: msg.tipo === 'sucesso' ? '#085041' : '#791F1F', border: `0.5px solid ${msg.tipo === 'sucesso' ? '#A3D9C0' : '#F5BABA'}` }}>
                {msg.texto}
              </div>
            )}

            {/* Form Login */}
            {tab === 'login' && (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--verde)', marginBottom:6, letterSpacing:0.3 }}>E-mail</label>
                  <input style={{ width:'100%', padding:'11px 14px', border:'1px solid var(--border)', borderRadius:10, fontSize:14, background:'#FAFAF8', fontFamily:'inherit', outline:'none' }}
                    type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--verde)', letterSpacing:0.3 }}>Senha</label>
                    <button type="button" onClick={() => { setTab('recuperar'); setMsg({ texto:'', tipo:'' }) }}
                      style={{ fontSize:11, color:'var(--verde-lt)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>
                      Esqueci minha senha
                    </button>
                  </div>
                  <input style={{ width:'100%', padding:'11px 14px', border:'1px solid var(--border)', borderRadius:10, fontSize:14, background:'#FAFAF8', fontFamily:'inherit', outline:'none' }}
                    type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:13, background:'var(--verde)', color:'#fff', border:'none', borderRadius:11, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginTop:16, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Entrando...' : 'Entrar no app →'}
                </button>
              </form>
            )}

            {/* Form Cadastro */}
            {tab === 'cadastro' && (
              <form onSubmit={handleCadastro}>
                {[['text','Seu nome','Como quer ser chamado(a)?',nome,setNome],['email','E-mail','seu@email.com',email,setEmail],['password','Senha','Mínimo 6 caracteres',senha,setSenha]].map(([type, label, ph, val, setter]) => (
                  <div key={label} style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--verde)', marginBottom:6, letterSpacing:0.3 }}>{label}</label>
                    <input style={{ width:'100%', padding:'11px 14px', border:'1px solid var(--border)', borderRadius:10, fontSize:14, background:'#FAFAF8', fontFamily:'inherit', outline:'none' }}
                      type={type} placeholder={ph} value={val} onChange={e => setter(e.target.value)} required />
                  </div>
                ))}
                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:13, background:'var(--verde)', color:'#fff', border:'none', borderRadius:11, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginTop:4, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Criando conta...' : 'Criar minha conta gratuitamente →'}
                </button>
              </form>
            )}

            {/* Form Recuperar */}
            {tab === 'recuperar' && (
              <form onSubmit={handleRecuperar}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--verde)', marginBottom:6 }}>E-mail</label>
                  <input style={{ width:'100%', padding:'11px 14px', border:'1px solid var(--border)', borderRadius:10, fontSize:14, background:'#FAFAF8', fontFamily:'inherit', outline:'none' }}
                    type="email" placeholder="seu@email.com" value={recEmail} onChange={e => setRecEmail(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:13, background:'var(--verde)', color:'#fff', border:'none', borderRadius:11, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Enviando...' : 'Enviar link de recuperação →'}
                </button>
                <button type="button" onClick={() => { setTab('login'); setMsg({ texto:'', tipo:'' }) }}
                  style={{ display:'block', width:'100%', textAlign:'center', marginTop:12, fontSize:12, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  ← Voltar para o login
                </button>
              </form>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:20, paddingTop:20, borderTop:'0.5px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--muted)' }}>🔒 Dados criptografados · Protegido pela LGPD</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section id="funcionalidades" style={{ padding:'100px 80px' }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:'var(--verde-lt)', marginBottom:14 }}>Tudo em um só lugar</p>
        <h2 className="playfair" style={{ fontSize:'clamp(28px,3vw,42px)', fontWeight:700, color:'var(--verde)', marginBottom:16, letterSpacing:-0.3 }}>
          Feito para a vida financeira real de um casal
        </h2>
        <p style={{ fontSize:16, color:'var(--muted)', maxWidth:520, lineHeight:1.7, marginBottom:56 }}>
          Não é mais uma planilha. É uma plataforma completa que entende que vocês dois têm rendas, gastos e sonhos diferentes.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background:'#fff', border:'0.5px solid var(--border)', borderRadius:16, padding:28, transition:'transform .2s, box-shadow .2s', cursor:'default' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 40px rgba(13,61,43,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg, var(--verde), var(--verde-lt))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:18 }}>
                {f.icon}
              </div>
              <div className="playfair" style={{ fontSize:18, fontWeight:600, color:'var(--verde)', marginBottom:10 }}>{f.title}</div>
              <div style={{ fontSize:14, color:'var(--muted)', lineHeight:1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" style={{ padding:'100px 80px', background:'var(--creme)' }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:'var(--verde-lt)', marginBottom:14 }}>Simples de começar</p>
        <h2 className="playfair" style={{ fontSize:'clamp(28px,3vw,42px)', fontWeight:700, color:'var(--verde)', marginBottom:56, letterSpacing:-0.3 }}>
          Três minutos para organizar as finanças do casal
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:32 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ textAlign:'center' }}>
              <div className="playfair" style={{ fontSize:56, fontWeight:700, color:'var(--dourado)', opacity:0.35, lineHeight:1, marginBottom:16 }}>{s.n}</div>
              <div style={{ fontWeight:600, fontSize:15, color:'var(--verde)', marginBottom:8 }}>{s.title}</div>
              <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEPOIMENTO ── */}
      <section style={{ padding:'80px', textAlign:'center' }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <div style={{ color:'var(--dourado)', fontSize:18, letterSpacing:3, marginBottom:24 }}>★★★★★</div>
          <div className="playfair" style={{ fontSize:'clamp(20px,2.5vw,28px)', fontStyle:'italic', color:'var(--verde)', lineHeight:1.5, marginBottom:32 }}>
            "Pela primeira vez conseguimos ter uma conversa sobre dinheiro{' '}
            <span style={{ color:'var(--dourado)' }}>sem brigar.</span>{' '}
            O app colocou tudo na mesa de um jeito que os dois entendemos."
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14 }}>
            <div style={{ width:48, height:48, borderRadius:24, background:'linear-gradient(135deg, var(--verde), var(--verde-lt))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>💑</div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontWeight:600, fontSize:14, color:'var(--verde)' }}>João & Maria</div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>Usuários desde jan/2025 · São Paulo</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PREÇOS ── */}
      <section id="precos" style={{ padding:'100px 80px', background:'var(--creme)', textAlign:'center' }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:'var(--verde-lt)', marginBottom:14 }}>Transparente e justo</p>
        <h2 className="playfair" style={{ fontSize:'clamp(28px,3vw,42px)', fontWeight:700, color:'var(--verde)', marginBottom:16, letterSpacing:-0.3 }}>
          Comece grátis, evolua quando quiser
        </h2>
        <p style={{ fontSize:16, color:'var(--muted)', marginBottom:56 }}>Sem surpresas. Sem cartão para o plano gratuito.</p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, maxWidth:720, margin:'0 auto' }}>
          {/* Free */}
          <div style={{ background:'#fff', border:'0.5px solid var(--border)', borderRadius:20, padding:36, textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--muted)', marginBottom:8 }}>Plano Gratuito</div>
            <div className="playfair" style={{ fontSize:42, fontWeight:700, color:'var(--verde)', lineHeight:1, marginBottom:4 }}>R$ 0</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:28 }}>para sempre · sem cartão</div>
            <ul style={{ listStyle:'none', marginBottom:32 }}>
              {['1 banco e 1 cartão','Despesas e receitas','Metas e reserva','Código do casal'].map(i => (
                <li key={i} style={{ fontSize:14, color:'var(--muted)', padding:'6px 0', borderBottom:'0.5px solid var(--border)', display:'flex', gap:10 }}>
                  <span style={{ color:'var(--verde-lt)', fontWeight:700 }}>✓</span>{i}
                </li>
              ))}
              {['IA financeira','Bot Telegram','Relatório PDF'].map(i => (
                <li key={i} style={{ fontSize:14, color:'#ccc', padding:'6px 0', borderBottom:'0.5px solid var(--border)', display:'flex', gap:10 }}>
                  <span>—</span>{i}
                </li>
              ))}
            </ul>
            <button onClick={scrollToLogin} style={{ width:'100%', padding:13, borderRadius:11, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', border:'1px solid var(--verde)', color:'var(--verde)', background:'transparent', transition:'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.background='var(--verde)'; e.currentTarget.style.color='#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--verde)' }}>
              Começar grátis
            </button>
          </div>

          {/* Premium */}
          <div style={{ background:'var(--verde)', border:'none', borderRadius:20, padding:36, textAlign:'left', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, background:'radial-gradient(circle, rgba(201,168,76,0.2) 0%, transparent 70%)' }} />
            <div style={{ display:'inline-block', background:'var(--dourado)', color:'var(--verde)', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', padding:'4px 10px', borderRadius:20, marginBottom:20 }}>Mais popular</div>
            <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.6)', marginBottom:8 }}>Plano Premium</div>
            <div className="playfair" style={{ fontSize:42, fontWeight:700, color:'#fff', lineHeight:1, marginBottom:4 }}>R$ 24</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:28 }}>por casal · mês</div>
            <ul style={{ listStyle:'none', marginBottom:32 }}>
              {['Bancos e cartões ilimitados','Lançamentos ilimitados','Metas, reserva e renda fixa','IA financeira com Groq','Bot Telegram com IA','Relatório PDF mensal','Suporte prioritário'].map(i => (
                <li key={i} style={{ fontSize:14, color:'rgba(255,255,255,0.8)', padding:'6px 0', borderBottom:'0.5px solid rgba(255,255,255,0.1)', display:'flex', gap:10 }}>
                  <span style={{ color:'var(--dourado-lt)', fontWeight:700 }}>✓</span>{i}
                </li>
              ))}
            </ul>
            <button onClick={scrollToLogin} style={{ width:'100%', padding:13, borderRadius:11, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'var(--dourado)', color:'var(--verde)', transition:'all .2s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--dourado-lt)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--dourado)'}>
              Experimentar 14 dias grátis →
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background:'var(--verde)', padding:'80px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:600, height:400, background:'radial-gradient(ellipse, rgba(201,168,76,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />
        <h2 className="playfair" style={{ fontSize:'clamp(28px,3.5vw,44px)', fontWeight:700, color:'#fff', marginBottom:16, position:'relative' }}>
          Prontos para organizar<br />
          <em style={{ fontStyle:'italic', color:'var(--dourado-lt)' }}>as finanças juntos?</em>
        </h2>
        <p style={{ fontSize:16, color:'rgba(255,255,255,0.65)', marginBottom:36, position:'relative' }}>
          Junte-se a casais que já pararam de discutir sobre dinheiro.
        </p>
        <button onClick={scrollToLogin} style={{ display:'inline-block', padding:'15px 40px', background:'var(--dourado)', color:'var(--verde)', borderRadius:11, fontSize:15, fontWeight:700, border:'none', cursor:'pointer', transition:'all .2s', position:'relative' }}
          onMouseEnter={e => { e.currentTarget.style.background='var(--dourado-lt)'; e.currentTarget.style.transform='translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background='var(--dourado)'; e.currentTarget.style.transform='' }}>
          Criar conta grátis →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:'#0A2E20', padding:'56px 80px 32px', color:'rgba(255,255,255,0.6)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:48 }}>
          <div>
            <div className="playfair" style={{ fontSize:22, fontWeight:700, color:'#fff', marginBottom:12 }}>
              Finanças<span style={{ color:'var(--dourado)' }}>Casal</span>
            </div>
            <p style={{ fontSize:13, lineHeight:1.7, maxWidth:260 }}>
              A plataforma financeira feita para casais que querem construir um futuro próspero juntos.
            </p>
          </div>
          {[
            ['Produto', [['#funcionalidades','Funcionalidades'],['#como-funciona','Como funciona'],['#precos','Preços']]],
            ['Legal', [['#','Política de Privacidade'],['#','Termos de Uso'],['#','LGPD'],['#','Cookies']]],
            ['Contato', [['mailto:contato@financascasal.com.br','contato@financascasal.com.br'],['mailto:privacidade@financascasal.com.br','privacidade@...'],['#','Suporte']]],
          ].map(([title, links]) => (
            <div key={title}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.4)', marginBottom:16 }}>{title}</div>
              <ul style={{ listStyle:'none' }}>
                {links.map(([href, label]) => (
                  <li key={label} style={{ marginBottom:10 }}>
                    <a href={href} style={{ fontSize:13, color:'rgba(255,255,255,0.55)', textDecoration:'none' }}
                      onMouseEnter={e => e.currentTarget.style.color='#fff'}
                      onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.55)'}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.08)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
          <span>© 2025 FinançasCasal. Todos os direitos reservados.</span>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'6px 14px', fontSize:11 }}>
            🔒 Dados protegidos pela LGPD
          </div>
        </div>
      </footer>
    </div>
  )
}
