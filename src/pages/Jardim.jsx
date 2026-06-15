import { useState, useEffect, useMemo } from 'react'
import { supabase, fmt } from '../supabase.js'
import { useFaseAtual } from '../components/FasesFinanceiras.jsx'
import { calcular5020 } from '../components/Regra502030.jsx'
import { PerguntaMensal } from '../components/PerguntaMensal.jsx'
import { ReflexaoCard } from '../components/ReflexaoCard.jsx'
import { chamarIA } from '../components/IAEngine.js'

// ── Fases do jardim ────────────────────────────────────
const FASES_JARDIM = [
  { min: 0,   max: 10,  emoji: '🌱', nome: 'Broto',  msg: 'Todo grande jardim começou com uma única semente.' },
  { min: 10,  max: 35,  emoji: '🌿', nome: 'Crescimento', msg: 'Vocês já estão construindo raízes fortes.' },
  { min: 35,  max: 70,  emoji: '🌳', nome: 'Árvore', msg: 'Seu patrimônio começa a gerar frutos.' },
  { min: 70,  max: 100, emoji: '🌳🌳🌳', nome: 'Jardim', msg: 'Vocês construíram um jardim sólido.' },
]

function getFaseJardim(saudeScore) {
  return FASES_JARDIM.find(f => saudeScore >= f.min && saudeScore < f.max) || FASES_JARDIM[3]
}

// ── Saúde do jardim ────────────────────────────────────
function calcularSaude({ saldo, totalRec, pctReserva, totalMetas, metasBatidas, poupanca }) {
  // Base de 30 — usar o app já é positivo
  let score = 30
  if (totalRec > 0) score += 10       // tem receitas cadastradas
  if (saldo >= 0) score += 15         // mês no azul
  if (poupanca >= 20) score += 15     // poupando bem
  else if (poupanca >= 5) score += 8  // poupando um pouco
  if (pctReserva >= 100) score += 20  // reserva completa
  else if (pctReserva >= 50) score += 10
  else if (pctReserva > 0) score += 5
  if (totalMetas > 0) score += 5      // tem metas
  if (metasBatidas > 0) score += 5    // meta concluída
  return Math.min(100, Math.max(30, score))
}

export default function Jardim({ session, profile }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [brotoMsg, setBroroMsg] = useState('')
  const [loadingBroto, setLoadingBroto] = useState(false)
  const { fase } = useFaseAtual(session, profile)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const uid = session.user.id
    const cc  = profile.casal_code
    const now = new Date()
    const mes = now.getMonth()
    const ano = now.getFullYear()
    try {
      const [desp, rec, bancos, cartoes, reservaD, metasD, aportes] = await Promise.all([
        supabase.from('despesas').select('valor,categoria,nome').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('receitas').select('valor').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('contas_banco').select('banco,saldo').eq('casal_code', cc),
        supabase.from('cartoes').select('nome,fatura').eq('casal_code', cc),
        supabase.from('reserva').select('atual,meta').eq('user_id', uid).maybeSingle(),
        supabase.from('metas').select('*').eq('casal_code', cc).eq('ativa', true),
        supabase.from('aportes_metas').select('valor').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
      ])

      const totalRec  = (rec.data||[]).reduce((s,r)=>s+r.valor,0)
      const totalDesp = (desp.data||[]).reduce((s,d)=>s+d.valor,0)
      const saldoBancos = (bancos.data||[]).reduce((s,b)=>s+b.saldo,0)
      const faturas   = (cartoes.data||[]).reduce((s,c)=>s+(c.fatura||0),0)
      const reserva   = reservaD.data || { atual:0, meta:30000 }
      const pctReserva = reserva.meta > 0 ? (reserva.atual/reserva.meta)*100 : 0
      const investimentos = (aportes.data||[]).reduce((s,a)=>s+a.valor,0)
      const metas = metasD.data || []
      const metasBatidas = metas.filter(m => (m.valor_atual||m.atual||0) >= (m.valor_alvo||0) && m.valor_alvo > 0).length
      const patrimônio = saldoBancos + reserva.atual + investimentos
      const poupanca = totalRec > 0 ? ((totalRec-totalDesp)/totalRec)*100 : 0

      // Regra 50/30/20
      const regra = calcular5020(desp.data||[], rec.data||[])

      // Saúde do jardim
      const saude = calcularSaude({ saldo: totalRec-totalDesp, totalRec, pctReserva, totalMetas: metas.length, metasBatidas, poupanca })

      // Vazamentos — top 5 categorias com maior gasto
      const cats = {}
      ;(desp.data||[]).forEach(d => { cats[d.categoria] = (cats[d.categoria]||0) + d.valor })
      const vadamentos = Object.entries(cats)
        .filter(([,v]) => v > 50)
        .sort((a,b) => b[1]-a[1])
        .slice(0,5)

      setDados({
        totalRec, totalDesp, saldo: totalRec-totalDesp,
        saldoBancos, faturas, reserva, pctReserva,
        patrimônio, poupanca, saude, regra,
        metas: metas.slice(0,4),
        metasBatidas,
        vazamentos: vadamentos,
        bancos: bancos.data||[],
        mes: now.toLocaleString('pt-BR', { month:'long' }),
      })
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function gerarBroto() {
    if (!dados) return
    setLoadingBroto(true); setBroroMsg('')
    try {
      const prompt = `Consultor financeiro para casais. Casal com objetivo: ${profile.objetivo||'controle'}.
Dados: Patrimônio R$${dados.patrimônio.toFixed(0)}, Saldo mês R$${dados.saldo.toFixed(0)}, Poupança ${dados.poupanca.toFixed(0)}%, Reserva ${dados.pctReserva.toFixed(0)}%, Metas: ${dados.metas.length}.
Gere 2-3 mensagens curtas e motivadoras sobre o jardim financeiro deste casal. Seja pessoal, use metáforas de jardim. Máx 60 palavras total. Sem títulos.`
      const res = await chamarIA(prompt, profile.plano||'free')
      setBroroMsg(res)
    } catch(e) { console.warn(e) }
    finally { setLoadingBroto(false) }
  }

  useEffect(() => { if (dados) gerarBroto() }, [dados])

  if (loading) return <div className="empty">Cultivando seu jardim...</div>
  if (!dados) return null

  const faseJardim = getFaseJardim(dados.saude)
  const nome1 = profile.nome?.split(' ')[0]

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ background:'linear-gradient(135deg, #3D5A3E 0%, #2D4A2E 100%)', borderRadius:18, padding:'28px 32px', marginBottom:20, color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:300, height:300, background:'radial-gradient(circle,rgba(196,151,58,.15) 0%,transparent 65%)', pointerEvents:'none' }}/>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <p style={{ fontSize:13, color:'rgba(232,220,200,.65)', marginBottom:6 }}>
              🌿 Bom dia, {nome1}
            </p>
            <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:600, color:'#fff', letterSpacing:-.5, lineHeight:1.1, marginBottom:4 }}>
              Seu jardim está<br/>
              <em style={{ color:'#C4973A', fontStyle:'italic' }}>crescendo.</em>
            </h1>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:10, color:'rgba(232,220,200,.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Saúde do Jardim</div>
            <div style={{ fontSize:36, fontWeight:700, color: dados.saude >= 70 ? '#C4973A' : '#DFB86A', lineHeight:1 }}>
              {dados.saude}%
            </div>
            <div style={{ fontSize:11, color:'rgba(232,220,200,.5)', marginTop:4 }}>{faseJardim.nome}</div>
          </div>
        </div>

        {/* Patrimônio */}
        <div style={{ display:'flex', gap:32, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:10, color:'rgba(232,220,200,.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Patrimônio atual</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:42, fontWeight:600, color:'#fff', letterSpacing:-1, lineHeight:1 }}>
              {fmt(dados.patrimônio)}
            </div>
            <div style={{ fontSize:12, color: dados.saldo>=0?'#7A9E7E':'#E87A6A', marginTop:6 }}>
              {dados.saldo>=0?'▲':'▼'} {fmt(Math.abs(dados.saldo))} este mês
            </div>
          </div>
          <div style={{ display:'flex', gap:24 }}>
            {[['💰','Receitas',dados.totalRec],['💸','Gastos',dados.totalDesp],['💳','Faturas',dados.faturas]].map(([e,l,v])=>(
              <div key={l}>
                <div style={{ fontSize:10, color:'rgba(232,220,200,.45)', marginBottom:4 }}>{e} {l}</div>
                <div style={{ fontSize:15, fontWeight:600, color:'rgba(232,220,200,.85)' }}>{fmt(v)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── VISUAL DO JARDIM ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16, marginBottom:16 }}>

        {/* Fase visual */}
        <div className="card" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'28px 20px', background:'linear-gradient(135deg, #F8F5EE 0%, #EFF6EF 100%)' }}>
          <div style={{ fontSize:52, lineHeight:1, marginBottom:16 }}>{faseJardim.emoji}</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:'var(--eden-green)', marginBottom:8 }}>
            {faseJardim.nome}
          </div>
          <div style={{ fontSize:13, color:'var(--secondary)', lineHeight:1.6, fontStyle:'italic' }}>
            "{faseJardim.msg}"
          </div>
          {fase && (
            <div style={{ marginTop:14, fontSize:11, color:'var(--eden-terra)', fontWeight:600 }}>
              {fase.emoji} Fase {fase.nome}
            </div>
          )}
        </div>

        {/* Broto IA */}
        <div className="card" style={{ background:'#2C1F14', border:'none', color:'#fff' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🤖</div>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>Broto</div>
              <div style={{ fontSize:11, color:'rgba(232,220,200,.5)' }}>Seu consultor financeiro familiar</div>
            </div>
          </div>
          {loadingBroto ? (
            <div style={{ fontSize:13, color:'rgba(232,220,200,.5)', fontStyle:'italic' }}>Analisando seu jardim...</div>
          ) : brotoMsg ? (
            <div style={{ fontSize:14, color:'rgba(232,220,200,.85)', lineHeight:1.8 }}>{brotoMsg}</div>
          ) : (
            <button onClick={gerarBroto} className="btn" style={{ background:'rgba(255,255,255,.1)', color:'rgba(232,220,200,.8)', border:'0.5px solid rgba(255,255,255,.15)', fontSize:13 }}>
              🌿 Analisar meu jardim
            </button>
          )}
        </div>
      </div>

      {/* ── 5 CARDS ── */}
      <div className="grid-2" style={{ gap:16, marginBottom:16 }}>

        {/* Card 1 — Reserva */}
        <div className="card" style={{ borderLeft:'3px solid #6B5A8E' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:22 }}>🛡️</span>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>Reserva de Segurança</div>
              <div style={{ fontSize:11, color:'var(--secondary)' }}>
                {dados.pctReserva >= 100 ? '✅ Completa!' : dados.pctReserva >= 50 ? 'Em crescimento' : 'Em construção'}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
            <span style={{ color:'var(--secondary)' }}>Meta: {fmt(dados.reserva.meta)}</span>
            <span style={{ fontWeight:700, color:'#6B5A8E' }}>{dados.pctReserva.toFixed(0)}%</span>
          </div>
          <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', marginBottom:8 }}>
            <div style={{ height:'100%', width:`${Math.min(100,dados.pctReserva)}%`, background:'#6B5A8E', borderRadius:3, transition:'width .4s' }}/>
          </div>
          <div style={{ fontSize:13, fontWeight:600 }}>{fmt(dados.reserva.atual)}</div>
          {dados.pctReserva < 100 && (
            <div style={{ fontSize:11, color:'var(--secondary)', marginTop:4 }}>
              Faltam {fmt(dados.reserva.meta - dados.reserva.atual)}
            </div>
          )}
        </div>

        {/* Card 2 — Meta principal */}
        {dados.metas[0] ? (
          <div className="card" style={{ borderLeft:'3px solid var(--eden-terra)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ fontSize:22 }}>🎯</span>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>Meta Principal</div>
                <div style={{ fontSize:11, color:'var(--secondary)' }}>{dados.metas[0].nome}</div>
              </div>
            </div>
            {(() => {
              const m = dados.metas[0]
              const atual = m.valor_atual||m.atual||0
              const alvo  = m.valor_alvo||0
              const pct   = alvo > 0 ? Math.min(100,(atual/alvo)*100) : 0
              return (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                    <span style={{ color:'var(--secondary)' }}>Meta: {fmt(alvo)}</span>
                    <span style={{ fontWeight:700, color:'var(--eden-terra)' }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', marginBottom:8 }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--eden-terra)', borderRadius:3 }}/>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{fmt(atual)}</div>
                </>
              )
            })()}
          </div>
        ) : (
          <div className="card" style={{ borderLeft:'3px solid var(--eden-terra)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--secondary)', fontSize:13, textAlign:'center' }}>
            <span style={{ fontSize:28 }}>🎯</span>
            <div>Nenhuma meta ativa</div>
            <div style={{ fontSize:11 }}>Crie metas em Metas</div>
          </div>
        )}

        {/* Card 3 — Patrimônio familiar */}
        <div className="card" style={{ borderLeft:'3px solid var(--eden-green)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:22 }}>🌳</span>
            <div style={{ fontWeight:600, fontSize:14 }}>Patrimônio Familiar</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              ['🏦 Bancos', dados.saldoBancos],
              ['🛡 Reserva', dados.reserva.atual],
              ['💳 Faturas', -dados.faturas],
            ].map(([l,v])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderBottom:'0.5px solid var(--border)' }}>
                <span style={{ color:'var(--secondary)' }}>{l}</span>
                <span style={{ fontWeight:600, color: v<0?'var(--red)':'var(--primary)' }}>{v<0?'-':''}{fmt(Math.abs(v))}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, padding:'6px 0', fontWeight:700 }}>
              <span>Total consolidado</span>
              <span style={{ color:'var(--eden-green)' }}>{fmt(dados.patrimônio - dados.faturas)}</span>
            </div>
          </div>
        </div>

        {/* Card 4 — Vazamentos */}
        <div className="card" style={{ borderLeft:'3px solid var(--yellow)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:22 }}>⚠️</span>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>Vazamentos do Jardim</div>
              <div style={{ fontSize:11, color:'var(--secondary)' }}>Onde os recursos estão escapando</div>
            </div>
          </div>
          {dados.vazamentos.length > 0 ? (
            <>
              {dados.vazamentos.map(([cat, val], i)=>{
                const pct = dados.totalDesp > 0 ? Math.round((val/dados.totalDesp)*100) : 0
                const cores = ['var(--red)','var(--yellow)','var(--yellow)','var(--secondary)','var(--secondary)']
                return (
                  <div key={cat}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--secondary)', width:14 }}>#{i+1}</span>
                        <span style={{ fontWeight:500 }}>{cat}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:11, color:'var(--secondary)' }}>{pct}%</span>
                        <span style={{ fontWeight:700, color:cores[i] }}>{fmt(val)}</span>
                      </div>
                    </div>
                    <div style={{ height:3, background:'var(--border)', borderRadius:2, overflow:'hidden', marginBottom:8 }}>
                      <div style={{ height:'100%', width:`${Math.min(100,pct*2)}%`, background:cores[i], borderRadius:2, transition:'width .4s' }}/>
                    </div>
                  </div>
                )
              })}
              <div style={{ fontSize:11, color:'var(--secondary)', marginTop:4, fontStyle:'italic', borderTop:'0.5px solid var(--border)', paddingTop:8 }}>
                Total gasto: {fmt(dados.totalDesp)} · Reduza para acelerar suas metas.
              </div>
            </>
          ) : (
            <div style={{ fontSize:13, color:'var(--green)', fontWeight:500 }}>✅ Sem gastos registrados este mês</div>
          )}
        </div>
      </div>

      {/* Card 5 — Próximas colheitas */}
      {dados.metas.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:22 }}>🍎</span>
            <div style={{ fontWeight:600, fontSize:14 }}>Próximas Colheitas</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {dados.metas.map(m => {
              const atual = m.valor_atual||m.atual||0
              const alvo  = m.valor_alvo||0
              const pct   = alvo > 0 ? Math.min(100,(atual/alvo)*100) : 0
              return (
                <div key={m.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                    <span style={{ fontWeight:500 }}>{m.nome}</span>
                    <span style={{ color:'var(--eden-green)', fontWeight:600 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--eden-green)', borderRadius:3, transition:'width .4s' }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reflexão + Pergunta mensal */}
      <ReflexaoCard session={session} profile={profile} />
      <PerguntaMensal session={session} profile={profile} />
    </div>
  )
}
