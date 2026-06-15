import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase.js'

export default function Landing({ onLogin }) {
  const [tab, setTab]       = useState('login')
  const [loading, setLoad]  = useState(false)
  const [msg, setMsg]       = useState({ txt: '', ok: true })
  const [email, setEmail]   = useState('')
  const [senha, setSenha]   = useState('')
  const [menuOpen, setMenu] = useState(false)
  const loginRef = useRef(null)

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
    setLoad(true)
    try {
      if (tab === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        showMsg('Link enviado! Verifique seu e-mail.')
        setTimeout(() => setTab('login'), 3000)
        return
      }
      if (tab === 'cadastro') {
        const { error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        showMsg('Conta criada! Confirme seu e-mail.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      onLogin()
    } catch(e) {
      const msgs = { 'Invalid login credentials': 'E-mail ou senha incorretos.', 'Email not confirmed': 'Confirme seu e-mail primeiro.', 'User already registered': 'E-mail já cadastrado.' }
      showMsg(msgs[e.message] || e.message, false)
    } finally { setLoad(false) }
  }

  const G = '#3D5A3E'   // verde oliva
  const T = '#C17F5A'   // terracota
  const C = '#FAF6EF'   // creme
  const S = '#E8DCC8'   // areia
  const B = '#2C1F14'   // bark
  const M = '#6B5E50'   // muted
  const D = '#E4DDD2'   // border

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif", background:C, color:B, overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;}
        .serif{font-family:'Cormorant Garamond',Georgia,serif;}
        a{text-decoration:none;color:inherit;}
        input{font-family:inherit;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .7s ease both;}
        .fu1{animation-delay:.1s}.fu2{animation-delay:.2s}.fu3{animation-delay:.3s}
        @media(max-width:900px){
          .hero-grid{grid-template-columns:1fr!important;}
          .two-col{grid-template-columns:1fr!important;}
          .four-col{grid-template-columns:1fr 1fr!important;}
          .section{padding:72px 28px!important;}
          .hide-mob{display:none!important;}
        }
        @media(max-width:600px){
          .four-col{grid-template-columns:1fr!important;}
          .section{padding:56px 20px!important;}
          .nav-links{display:none!important;}
          .hamburger{display:flex!important;}
          .mob-menu.open{display:flex!important;}
        }
      `}</style>

      {/* NAV */}
      <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 48px',height:60,background:'rgba(250,246,239,.94)',backdropFilter:'blur(12px)',borderBottom:`0.5px solid ${D}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:G,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:700,color:C}}>É</span>
          </div>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:G}}>Éden</span>
        </div>
        <div className="nav-links" style={{display:'flex',alignItems:'center',gap:28}}>
          {[['#funcionalidades','Funcionalidades'],['#ia','IA'],['#precos','Preços']].map(([h,l])=>(
            <a key={h} href={h} onClick={e=>{e.preventDefault();document.querySelector(h)?.scrollIntoView({behavior:'smooth'})}}
              style={{fontSize:13,color:M,fontWeight:500}}
              onMouseEnter={e=>e.target.style.color=G} onMouseLeave={e=>e.target.style.color=M}>{l}</a>
          ))}
          <button onClick={scrollToLogin} style={{background:G,color:'#fff',border:'none',padding:'8px 18px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>Entrar</button>
        </div>
        <button className="hamburger" onClick={()=>setMenu(!menuOpen)}
          style={{display:'none',flexDirection:'column',gap:5,padding:4,background:'none',border:'none',cursor:'pointer'}}>
          {[0,1,2].map(i=><div key={i} style={{width:22,height:2,background:G,borderRadius:1}}/>)}
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`mob-menu${menuOpen?' open':''}`}
        style={{position:'fixed',top:60,left:0,right:0,zIndex:99,background:C,borderBottom:`0.5px solid ${D}`,flexDirection:'column',padding:'20px 24px',gap:16,display:'none'}}>
        {[['#funcionalidades','Funcionalidades'],['#ia','IA'],['#precos','Preços']].map(([h,l])=>(
          <a key={h} href={h} onClick={e=>{e.preventDefault();setMenu(false);document.querySelector(h)?.scrollIntoView({behavior:'smooth'})}}
            style={{fontSize:15,color:M,padding:'8px 0',borderBottom:`0.5px solid ${D}`}}>{l}</a>
        ))}
        <button onClick={scrollToLogin} style={{background:G,color:'#fff',border:'none',padding:'12px',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Criar conta grátis
        </button>
      </div>

      {/* HERO */}
      <section style={{paddingTop:60}}>
        <div className="hero-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',minHeight:'100vh'}}>

          {/* Esquerda — copy */}
          <div style={{background:G,padding:'88px 72px 88px 80px',display:'flex',flexDirection:'column',justifyContent:'center',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-100,right:-80,width:500,height:500,background:'radial-gradient(circle,rgba(196,151,58,.1) 0%,transparent 65%)',pointerEvents:'none'}}/>

            <p className="fu" style={{fontSize:11,fontWeight:600,letterSpacing:2.5,textTransform:'uppercase',color:'#C4973A',marginBottom:20}}>
              🌿 Finanças a dois, sem segredos.
            </p>

            <h1 className="fu fu1 serif" style={{fontSize:'clamp(32px,3.5vw,52px)',fontWeight:600,lineHeight:1.12,color:'#fff',marginBottom:24,letterSpacing:-.5}}>
              O primeiro sistema financeiro pensado para casais que querem{' '}
              <em style={{fontStyle:'italic',color:'#C4973A'}}>construir patrimônio juntos.</em>
            </h1>

            <p className="fu fu2" style={{fontSize:16,color:'rgba(232,220,200,.75)',lineHeight:1.75,marginBottom:36,maxWidth:440}}>
              Organize contas, acompanhe metas, fortaleça sua reserva e descubra para onde o dinheiro da família está indo. Tudo em um único lugar, com transparência para os dois.
            </p>

            <div className="fu fu3" style={{display:'flex',flexDirection:'column',gap:10,marginBottom:40}}>
              {['Menos discussões. Mais patrimônio.','Dois usuários. Um plano.','Clareza financeira para os dois.'].map(f=>(
                <div key={f} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:'rgba(232,220,200,.8)'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'#C4973A',flexShrink:0}}/>
                  {f}
                </div>
              ))}
            </div>

            <button onClick={scrollToLogin}
              style={{display:'inline-flex',alignItems:'center',gap:10,padding:'14px 28px',background:'#C4973A',color:B,borderRadius:11,fontSize:15,fontWeight:700,border:'none',cursor:'pointer',alignSelf:'flex-start'}}>
              Criar conta grátis →
            </button>
          </div>

          {/* Direita — login */}
          <div ref={loginRef} style={{background:S,display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 48px',position:'relative'}}>
            <div style={{position:'absolute',inset:0,background:`linear-gradient(180deg,rgba(232,220,200,0) 0%,rgba(232,220,200,.85) 50%)`,opacity:.4}}/>
            <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:400,background:'rgba(255,255,255,.97)',borderRadius:20,padding:36,boxShadow:'0 20px 60px rgba(44,31,20,.13)',border:`0.5px solid ${D}`}}>

              <div style={{textAlign:'center',marginBottom:22}}>
                <div style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{width:30,height:30,borderRadius:9,background:G,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:C}}>É</span>
                  </div>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:G}}>Éden</span>
                </div>
                <div style={{fontSize:13,color:M}}>
                  {tab==='recuperar'?'Recuperar acesso':'Entre no seu jardim financeiro'}
                </div>
              </div>

              {tab !== 'recuperar' && (
                <div style={{display:'flex',background:S,borderRadius:10,padding:4,marginBottom:22,gap:0}}>
                  {[['login','Entrar'],['cadastro','Criar conta']].map(([id,label])=>(
                    <button key={id} onClick={()=>{setTab(id);setMsg({txt:'',ok:true})}}
                      style={{flex:1,padding:'8px 12px',border:'none',borderRadius:7,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',
                        background:tab===id?'#fff':'transparent',color:tab===id?G:M,
                        boxShadow:tab===id?'0 1px 4px rgba(61,90,62,.12)':'none'}}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {msg.txt && (
                <div style={{padding:'10px 14px',borderRadius:8,marginBottom:14,fontSize:13,
                  background:msg.ok?'rgba(61,90,62,.08)':'rgba(192,75,58,.08)',
                  color:msg.ok?G:'#8B2315',border:`0.5px solid ${msg.ok?'rgba(61,90,62,.2)':'rgba(192,75,58,.2)'}`}}>
                  {msg.txt}
                </div>
              )}

              <form onSubmit={handleAuth}>
                <div style={{background:S,borderRadius:12,padding:'16px 14px',marginBottom:16}}>
                  <input style={{width:'100%',padding:'10px 13px',border:`0.5px solid ${D}`,borderRadius:9,fontSize:14,background:'#fff',fontFamily:'inherit',color:B,outline:'none',marginBottom:10}}
                    type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
                  {tab !== 'recuperar' && (
                    <div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                        <span style={{fontSize:12,color:M}}>Senha</span>
                        {tab==='login' && (
                          <button type="button" onClick={()=>{setTab('recuperar');setMsg({txt:'',ok:true})}}
                            style={{fontSize:11,color:'#7A9E7E',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                            Esqueci minha senha
                          </button>
                        )}
                      </div>
                      <input style={{width:'100%',padding:'10px 13px',border:`0.5px solid ${D}`,borderRadius:9,fontSize:14,background:'#fff',fontFamily:'inherit',color:B,outline:'none'}}
                        type="password" placeholder="••••••••" value={senha} onChange={e=>setSenha(e.target.value)} required/>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={loading}
                  style={{width:'100%',padding:'13px',background:G,color:'#fff',border:'none',borderRadius:11,fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'inherit',opacity:loading?.7:1}}>
                  {loading?'Aguarde...' : tab==='login'?'Entrar no Éden →' : tab==='cadastro'?'Começar gratuitamente →' : 'Enviar link →'}
                </button>
              </form>

              <button onClick={()=>{setTab(tab==='login'?'cadastro':'login');setMsg({txt:'',ok:true})}}
                style={{display:'block',width:'100%',textAlign:'center',marginTop:14,fontSize:12,color:M,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                {tab==='login'?'Não tem conta? Cadastre-se grátis':'Já tem conta? Entrar'}
              </button>
              {tab==='recuperar' && (
                <button onClick={()=>{setTab('login');setMsg({txt:'',ok:true})}}
                  style={{display:'block',width:'100%',textAlign:'center',marginTop:14,fontSize:12,color:M,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                  ← Voltar para o login
                </button>
              )}

              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:20,paddingTop:16,borderTop:`0.5px solid ${D}`,justifyContent:'center'}}>
                <span style={{fontSize:11,color:M}}>🔒 Protegido pela LGPD</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="section" style={{padding:'100px 80px',background:'#fff',textAlign:'center'}}>
        <p style={{fontSize:11,fontWeight:600,letterSpacing:2,textTransform:'uppercase',color:T,marginBottom:14}}>O problema</p>
        <h2 className="serif" style={{fontSize:'clamp(28px,3vw,46px)',fontWeight:600,color:G,marginBottom:20,letterSpacing:-.3,lineHeight:1.15}}>
          Menos discussões. Mais patrimônio.
        </h2>
        <p style={{fontSize:17,color:M,maxWidth:620,margin:'0 auto 60px',lineHeight:1.75}}>
          O dinheiro não desaparece por acaso. Pequenos gastos, assinaturas esquecidas, compras impulsivas e falta de planejamento podem consumir milhares de reais por ano. O Éden ajuda vocês a enxergar exatamente onde o dinheiro está escorrendo e transformar essa diferença em patrimônio.
        </p>
        <div className="four-col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,maxWidth:900,margin:'0 auto'}}>
          {[['💸','O dinheiro some todo mês','Pequenas despesas, assinaturas esquecidas e compras impulsivas que somam milhares por ano — sem que percebam.'],
            ['📺','Vocês pagam por serviços que não usam','Streaming, academia, planos... assinaturas ativas que ninguém lembra de cancelar.'],
            ['🤷','O dinheiro que sobra não vai a lugar nenhum','Sem objetivo definido, o que poderia virar patrimônio vira gasto sem propósito.'],
            ['⚡','Uma compra pode virar uma briga','Decisões financeiras tomadas separadamente geram surpresas — e surpresas geram conflito.']].map(([e,t,d])=>(
            <div key={t} style={{background:C,borderRadius:16,padding:24,textAlign:'left',border:`0.5px solid ${D}`}}>
              <div style={{fontSize:28,marginBottom:14}}>{e}</div>
              <div style={{fontWeight:600,fontSize:14,color:G,marginBottom:8}}>{t}</div>
              <div style={{fontSize:13,color:M,lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DOIS USUÁRIOS */}
      <section className="section" style={{padding:'100px 80px',background:C}}>
        <div className="two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:64,alignItems:'center',maxWidth:1000,margin:'0 auto'}}>
          <div>
            <p style={{fontSize:11,fontWeight:600,letterSpacing:2,textTransform:'uppercase',color:T,marginBottom:14}}>Como funciona</p>
            <h2 className="serif" style={{fontSize:'clamp(28px,3vw,44px)',fontWeight:600,color:G,marginBottom:20,letterSpacing:-.3,lineHeight:1.15}}>
              Dois usuários.<br/>Um plano.
            </h2>
            <p style={{fontSize:16,color:M,lineHeight:1.75,marginBottom:28}}>
              Cada pessoa mantém seu perfil. Mas ambos acompanham o mesmo patrimônio, as mesmas metas e a mesma evolução financeira.
            </p>
            <p style={{fontSize:15,color:B,lineHeight:1.75,marginBottom:32,fontWeight:500,fontStyle:'italic'}}>
              "Quando os dois enxergam os números, as decisões ficam mais simples."
            </p>
            <button onClick={scrollToLogin}
              style={{padding:'12px 24px',background:G,color:'#fff',borderRadius:10,fontSize:14,fontWeight:600,border:'none',cursor:'pointer',fontFamily:'inherit'}}>
              Criar conta grátis →
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[['🔍','Descubram para onde o dinheiro está indo','Gastos por categoria, cartões, contas recorrentes e assinaturas esquecidas. Visualizem o que cresce sem perceber.'],
              ['🎯','Definam objetivos e acompanhem conquistas','Casa própria, viagem, mudança de país, educação dos filhos, independência financeira. Metas compartilhadas com progresso real.'],
              ['🛡','Reserva de emergência com meta real','Saibam exatamente quanto precisam acumular para proteger a família — e acompanhem o progresso mês a mês.'],
              ['📈','Visualizem o patrimônio crescendo','Antes de investir mais, descubram onde estão perdendo. Transformem renda em patrimônio.']].map(([e,t,d])=>(
              <div key={t} style={{display:'flex',gap:14,padding:'16px 18px',background:'#fff',borderRadius:14,border:`0.5px solid ${D}`}}>
                <span style={{fontSize:22,flexShrink:0,marginTop:2}}>{e}</span>
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:B,marginBottom:5}}>{t}</div>
                  <div style={{fontSize:13,color:M,lineHeight:1.6}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IA */}
      <section id="ia" className="section" style={{padding:'100px 80px',background:G}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <p style={{fontSize:11,fontWeight:600,letterSpacing:2,textTransform:'uppercase',color:'#C4973A',marginBottom:14}}>Inteligência artificial</p>
          <h2 className="serif" style={{fontSize:'clamp(28px,3vw,46px)',fontWeight:600,color:'#fff',marginBottom:20,letterSpacing:-.3,lineHeight:1.15}}>
            Seu consultor financeiro<br/>dentro do aplicativo.
          </h2>
          <p style={{fontSize:16,color:'rgba(232,220,200,.75)',lineHeight:1.75,marginBottom:48,maxWidth:560}}>
            A IA do Éden acompanha os hábitos financeiros do casal e aprende com o tempo. Quanto mais vocês usam, mais personalizadas ficam as recomendações.
          </p>
          <div className="two-col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:48}}>
            {[['Onde reduzir gastos','Identifica categorias que crescem e sugere ajustes específicos'],
              ['Como acelerar metas','Calcula quanto investir mensalmente para atingir cada objetivo'],
              ['Fortalecer a reserva','Monitora o progresso e alerta quando está abaixo do ideal'],
              ['Quais despesas merecem atenção','Compara mês a mês e destaca o que mudou']].map(([t,d])=>(
              <div key={t} style={{background:'rgba(255,255,255,.07)',borderRadius:14,padding:'18px 20px',border:'0.5px solid rgba(255,255,255,.12)'}}>
                <div style={{fontWeight:600,fontSize:14,color:'#C4973A',marginBottom:6}}>→ {t}</div>
                <div style={{fontSize:13,color:'rgba(232,220,200,.7)',lineHeight:1.6}}>{d}</div>
              </div>
            ))}
          </div>

          {/* Telegram */}
          <div style={{background:'rgba(255,255,255,.06)',borderRadius:18,padding:'32px 36px',border:'0.5px solid rgba(196,151,58,.3)',display:'flex',gap:48,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:240}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:1.5,textTransform:'uppercase',color:'#C4973A',marginBottom:12}}>Telegram integrado</div>
              <h3 className="serif" style={{fontSize:26,fontWeight:600,color:'#fff',marginBottom:12,lineHeight:1.2}}>
                Registre gastos sem abrir o aplicativo.
              </h3>
              <p style={{fontSize:14,color:'rgba(232,220,200,.65)',lineHeight:1.7}}>
                Menos atrito. Mais consistência.
              </p>
            </div>
            <div style={{flexShrink:0}}>
              <div style={{background:'rgba(0,0,0,.25)',borderRadius:16,padding:'20px 24px',minWidth:220}}>
                <div style={{fontSize:11,color:'rgba(232,220,200,.4)',marginBottom:14,fontWeight:500}}>Telegram · Éden Bot</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{background:'rgba(255,255,255,.1)',borderRadius:'16px 16px 4px 16px',padding:'10px 14px',fontSize:14,color:'rgba(232,220,200,.9)',alignSelf:'flex-end',maxWidth:180}}>
                    Mercado R$ 245
                  </div>
                  <div style={{background:'rgba(196,151,58,.2)',borderRadius:'4px 16px 16px 16px',padding:'10px 14px',fontSize:13,color:'rgba(232,220,200,.85)',maxWidth:220}}>
                    ✅ R$ 245,00 lançado em Alimentação
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades" className="section" style={{padding:'100px 80px',background:'#fff'}}>
        <p style={{fontSize:11,fontWeight:600,letterSpacing:2,textTransform:'uppercase',color:T,marginBottom:14}}>Tudo que precisam</p>
        <h2 className="serif" style={{fontSize:'clamp(28px,3vw,44px)',fontWeight:600,color:G,marginBottom:16,letterSpacing:-.3,lineHeight:1.15}}>
          Construído para a vida<br/>financeira real de um casal.
        </h2>
        <p style={{fontSize:16,color:M,maxWidth:520,lineHeight:1.75,marginBottom:56}}>
          Não é apenas uma planilha digital. É um ambiente onde duas pessoas compartilham objetivos, acompanham resultados e tomam decisões financeiras juntos.
        </p>
        <div className="four-col" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
          {[['💳','"De onde veio essa fatura?"','Nunca mais sejam surpreendidos. Acompanhem a fatura dos cartões crescendo em tempo real — os dois.'],
            ['📊','"Para onde foi o dinheiro do mês?"','Cada real categorizado automaticamente. Enxerguem o padrão antes que ele vire problema.'],
            ['🔄','"A gente paga isso ainda?"','Todas as assinaturas e contas recorrentes em um lugar. Cancelem o que não usam, paguem o que importa.'],
            ['🎯','"A gente nunca poupa o suficiente."','Metas com valor, prazo e aporte mensal. Os dois acompanham o progresso — e se cobram juntos.'],
            ['🛡','"E se acontecer uma emergência?"','Reserva calculada com base nos gastos reais de vocês. Saibam exatamente onde estão e quanto falta.'],
            ['📈','"A gente deveria estar investindo mais."','Visualizem o patrimônio crescendo mês a mês. Do zero até a independência financeira.'],
            ['🤖','"Ninguém nos avisa quando estamos errando."','A IA observa os padrões e avisa antes que o problema apareça na fatura.'],
            ['✉️','"Anotar gasto é chato, aí a gente desiste."','Uma mensagem no Telegram. Sem abrir app, sem formulário, sem desculpa.'],
            ['🏆','"A sensação é que nunca evoluímos."','Fases, conquistas e marcos celebrados. O progresso financeiro visível para os dois.']].map(([e,t,d])=>(
            <div key={t} style={{background:C,borderRadius:16,padding:'22px 24px',border:`0.5px solid ${D}`,transition:'transform .2s,box-shadow .2s',cursor:'default'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 32px rgba(61,90,62,.1)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
              <div style={{fontSize:26,marginBottom:12}}>{e}</div>
              <div className="serif" style={{fontSize:17,fontWeight:600,color:G,marginBottom:7}}>{t}</div>
              <div style={{fontSize:13,color:M,lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="section" style={{padding:'100px 80px',background:C,textAlign:'center'}}>
        <p style={{fontSize:11,fontWeight:600,letterSpacing:2,textTransform:'uppercase',color:T,marginBottom:14}}>Simples e justo</p>
        <h2 className="serif" style={{fontSize:'clamp(28px,3vw,44px)',fontWeight:600,color:G,marginBottom:16}}>
          Comece gratuitamente.
        </h2>
        <p style={{fontSize:16,color:M,marginBottom:56}}>14 dias de Premium grátis. Sem cartão de crédito para começar.</p>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,maxWidth:720,margin:'0 auto'}}>
          {/* Free */}
          <div style={{background:'#fff',border:`0.5px solid ${D}`,borderRadius:20,padding:'36px 32px',textAlign:'left'}}>
            <div style={{fontSize:13,fontWeight:600,color:M,marginBottom:8}}>Gratuito</div>
            <div className="serif" style={{fontSize:44,fontWeight:700,color:G,lineHeight:1,marginBottom:4}}>R$ 0</div>
            <div style={{fontSize:13,color:M,marginBottom:28}}>para sempre</div>
            <ul style={{listStyle:'none',marginBottom:32}}>
              {['Comece sem cartão de crédito','Registre gastos pelos dois','Crie metas e acompanhe reserva','Código compartilhado do casal','Lance gastos pelo Telegram'].map(i=>(
                <li key={i} style={{fontSize:14,color:M,padding:'7px 0',borderBottom:`0.5px solid ${D}`,display:'flex',gap:10}}>
                  <span style={{color:'#7A9E7E',fontWeight:700}}>✓</span>{i}
                </li>
              ))}
              {['IA contextual','Aprendizado contínuo'].map(i=>(
                <li key={i} style={{fontSize:14,color:D,padding:'7px 0',borderBottom:`0.5px solid ${D}`,display:'flex',gap:10}}>
                  <span>—</span>{i}
                </li>
              ))}
            </ul>
            <button onClick={scrollToLogin}
              style={{width:'100%',padding:13,borderRadius:11,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:`1.5px solid ${G}`,color:G,background:'transparent',transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background=G;e.currentTarget.style.color='#fff'}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=G}}>
              Começar grátis
            </button>
          </div>

          {/* Premium */}
          <div style={{background:G,border:'none',borderRadius:20,padding:'36px 32px',textAlign:'left',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-50,right:-50,width:200,height:200,background:'radial-gradient(circle,rgba(196,151,58,.15) 0%,transparent 70%)'}}/>
            <div style={{display:'inline-block',background:'#C4973A',color:B,fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',padding:'4px 10px',borderRadius:20,marginBottom:18}}>
              14 dias grátis
            </div>
            <div style={{fontSize:13,fontWeight:600,color:'rgba(232,220,200,.6)',marginBottom:8}}>Premium</div>
            <div className="serif" style={{fontSize:44,fontWeight:700,color:'#fff',lineHeight:1,marginBottom:4}}>R$ 24</div>
            <div style={{fontSize:13,color:'rgba(232,220,200,.6)',marginBottom:28}}>por casal · mês</div>
            <ul style={{listStyle:'none',marginBottom:32}}>
              {['Sem limite de bancos e cartões','IA que aprende com vocês todo mês','Alertas antes de gastar demais','Bot no Telegram com respostas inteligentes','Reflexões que mudam comportamentos','Celebração de cada conquista do casal','Comparativo anônimo com outros casais'].map(i=>(
                <li key={i} style={{fontSize:14,color:'rgba(232,220,200,.82)',padding:'7px 0',borderBottom:'0.5px solid rgba(255,255,255,.1)',display:'flex',gap:10}}>
                  <span style={{color:'#C4973A',fontWeight:700}}>✓</span>{i}
                </li>
              ))}
            </ul>
            <button onClick={scrollToLogin}
              style={{width:'100%',padding:13,borderRadius:11,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',border:'none',background:'#C4973A',color:B,transition:'all .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.9'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              Experimentar 14 dias grátis →
            </button>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="section" style={{padding:'100px 80px',background:G,textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:600,height:400,background:'radial-gradient(ellipse,rgba(196,151,58,.1) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <p style={{fontSize:11,fontWeight:600,letterSpacing:2,textTransform:'uppercase',color:'#C4973A',marginBottom:20,position:'relative'}}>O futuro financeiro da família começa com clareza</p>
        <h2 className="serif" style={{fontSize:'clamp(28px,3.5vw,50px)',fontWeight:600,color:'#fff',marginBottom:20,position:'relative',lineHeight:1.15}}>
          Transformem renda em patrimônio.<br/>
          <em style={{fontStyle:'italic',color:'#C4973A'}}>Metas em conquistas.</em>
        </h2>
        <p style={{fontSize:16,color:'rgba(232,220,200,.65)',marginBottom:40,position:'relative',maxWidth:480,margin:'0 auto 40px'}}>
          Quando os dois enxergam os números, as decisões ficam mais simples. Planejamento em tranquilidade.
        </p>
        <button onClick={scrollToLogin}
          style={{display:'inline-block',padding:'15px 40px',background:'#C4973A',color:B,borderRadius:11,fontSize:15,fontWeight:700,border:'none',cursor:'pointer',position:'relative',transition:'all .15s'}}
          onMouseEnter={e=>{e.currentTarget.style.background=S;e.currentTarget.style.transform='translateY(-1px)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='#C4973A';e.currentTarget.style.transform=''}}>
          Começar gratuitamente →
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{background:'#1E1208',padding:'56px 80px 32px',color:'rgba(232,220,200,.55)'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:48,marginBottom:40}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{width:28,height:28,borderRadius:8,background:G,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:700,color:C}}>É</span>
              </div>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:S}}>Éden</span>
            </div>
            <p style={{fontSize:13,lineHeight:1.7,maxWidth:260,fontStyle:'italic',color:'rgba(232,220,200,.45)'}}>
              Finanças a dois, sem segredos.<br/>Não para controlar — para planejar juntos.
            </p>
          </div>
          {[['Produto',[['#funcionalidades','Funcionalidades'],['#ia','IA'],['#precos','Preços']]],
            ['Legal',[['#','Política de Privacidade'],['#','Termos de Uso'],['#','LGPD']]]].map(([title,links])=>(
            <div key={String(title)}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'rgba(232,220,200,.3)',marginBottom:16}}>{title}</div>
              <ul style={{listStyle:'none'}}>
                {links.map(([href,label])=>(
                  <li key={label} style={{marginBottom:10}}>
                    <a href={href} style={{fontSize:13,color:'rgba(232,220,200,.5)',transition:'color .15s'}}
                      onMouseEnter={e=>e.target.style.color=S}
                      onMouseLeave={e=>e.target.style.color='rgba(232,220,200,.5)'}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{borderTop:'0.5px solid rgba(255,255,255,.06)',paddingTop:24,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,flexWrap:'wrap',gap:12}}>
          <span>© 2026 Éden. Todos os direitos reservados.</span>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,.04)',border:'0.5px solid rgba(255,255,255,.08)',borderRadius:20,padding:'5px 14px',fontSize:11}}>
            🔒 Dados protegidos pela LGPD
          </div>
        </div>
      </footer>
    </div>
  )
}
