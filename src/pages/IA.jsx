import { useState, useEffect } from 'react'
import { supabase, fmt } from '../supabase.js'
import { OBJETIVOS, buildPromptAnalise, buildPromptNotificacoes, chamarIA, buscarMemoriaPerguntas, formatarMemoria } from '../components/IAEngine.js'
import { useComparativoFase, ComparativoFase } from '../components/ComparativoFases.jsx'
import { carregarMemoria, atualizarMemoria, formatarMemoriaIA, gerarAlertaProativo } from '../components/IAMemoria.js'
import { useFaseAtual } from '../components/FasesFinanceiras.jsx'

const TIPO_CORES = {
  alerta:    { bg: 'var(--red-bg)',    color: 'var(--red)',   icon: '⚠️' },
  dica:      { bg: 'var(--blue-bg)',   color: 'var(--blue)',  icon: '💡' },
  conquista: { bg: 'var(--green-bg)',  color: 'var(--green)', icon: '🏆' },
}

export default function IA({ session, profile }) {
  const [analise, setAnalise]           = useState('')
  const [notifs, setNotifs]             = useState([])
  const [loadingAnalise, setLoadingA]   = useState(false)
  const [loadingNotifs, setLoadingN]    = useState(false)
  const [erroAnalise, setErroA]         = useState('')
  const [erroNotifs, setErroN]          = useState('')
  const [dados, setDados]               = useState(null)
  const [loadingDados, setLoadingDados] = useState(true)
  const [memoriaIA, setMemoriaIA] = useState(null)
  const [alertaProativo, setAlertaProativo] = useState('')
  const isPremium = (profile.plano || 'free') === 'premium'

  const objetivo = profile.objetivo || 'controle'
  const obj      = OBJETIVOS[objetivo]
  const { fase }  = useFaseAtual(session, profile)
  const comparativo = useComparativoFase(profile, fase)

  useEffect(() => { carregarDados() }, [])
  useEffect(() => {
    if (!profile?.casal_code) return
    carregarMemoria(profile.casal_code).then(m => {
      if (m) setMemoriaIA(m)
    })
  }, [profile?.casal_code])

  // Alerta proativo para premium — gera automaticamente
  useEffect(() => {
    if (!isPremium || !dados || !memoriaIA) return
    gerarAlertaProativo({
      casalCode: profile.casal_code,
      dados, memoria: memoriaIA,
      objetivo: profile.objetivo || 'controle',
    }).then(alerta => { if (alerta) setAlertaProativo(alerta) })
  }, [isPremium, dados, memoriaIA])

  async function carregarDados() {
    setLoadingDados(true)
    const uid = session.user.id
    const cc  = profile.casal_code
    const cf  = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', uid)
    const now = new Date()
    try {
      const [desp, rec, cartoes, bancos, reservaData, invData, metasData] = await Promise.all([
        cf(supabase.from('despesas').select('valor,categoria')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
        cf(supabase.from('receitas').select('valor')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
        cf(supabase.from('cartoes').select('fatura')),
        cf(supabase.from('contas_banco').select('saldo')),
        supabase.from('reserva').select('atual,meta').eq('user_id', uid).maybeSingle(),
        cf(supabase.from('investimentos').select('valor')),
        cf(supabase.from('metas').select('id').eq('ativa', true)),
      ])
      const totalRec  = (rec.data  || []).reduce((s,r) => s+r.valor, 0)
      const totalDesp = (desp.data || []).reduce((s,d) => s+d.valor, 0)
      const cats = {}; (desp.data||[]).forEach(d => { cats[d.categoria] = (cats[d.categoria]||0)+d.valor })
      const res = reservaData.data || { atual:0, meta:30000 }
      res.pct = res.meta > 0 ? (res.atual/res.meta)*100 : 0
      const d = {
        totalRec, totalDesp, saldo: totalRec-totalDesp, cats,
        saldoBancos: (bancos.data||[]).reduce((s,b)=>s+b.saldo,0),
        faturas:     (cartoes.data||[]).reduce((s,c)=>s+(c.fatura||0),0),
        reserva:     res,
        investimentos: (invData.data||[]).reduce((s,i)=>s+i.valor,0),
        metas:       (metasData.data||[]).length,
        pctReserva:  profile.pct_reserva || 5,
      }
      setDados(d)
    } catch(e) { console.error(e) }
    finally { setLoadingDados(false) }
  }

  async function gerarAnalise() {
    if (!dados) return
    setLoadingA(true); setErroA(''); setAnalise('')
    try {
      // Carrega memória das perguntas mensais para contexto
      const perguntas = await buscarMemoriaPerguntas(supabase, profile.casal_code, 6)
      const memoriaPerguntas = formatarMemoria(perguntas)
      const memoriaAprendida = formatarMemoriaIA(memoriaIA)
      const memoria = memoriaPerguntas + memoriaAprendida
      const prompt = buildPromptAnalise({ objetivo, dados, memoria })
      const plano = profile.plano || 'free'
      const resultado = await chamarIA(prompt, plano)
      setAnalise(resultado)

      // Atualiza memória para usuários premium
      if (isPremium && resultado) {
        atualizarMemoria({
          casalCode: profile.casal_code,
          analise: resultado,
          dados, perguntas, plano: 'premium',
        }).then(resumo => {
          if (resumo) setMemoriaIA(prev => ({ ...prev, resumo, total_analises: (prev?.total_analises||0)+1 }))
        })
      }

    } catch(e) {
      console.error('Erro IA:', e)
      setErroA(e.message)
    } finally { setLoadingA(false) }
  }

  async function gerarNotificacoes() {
    if (!dados) return
    setLoadingN(true); setErroN(''); setNotifs([])
    try {
      const prompt = buildPromptNotificacoes({ objetivo, dados })
      const plano = profile.plano || 'free'
      const raw = await chamarIA(prompt, plano)
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setNotifs(Array.isArray(parsed) ? parsed : [])
    } catch(e) {
      console.error('Erro notifs:', e)
      setErroN('Não foi possível gerar as notificações. ' + e.message)
    } finally { setLoadingN(false) }
  }

  // Formata a análise em blocos visuais
  function renderAnalise(texto) {
    if (!texto) return null
    const blocos = texto.split(/\n(?=📊|⚠️|💡|🚀)/).filter(Boolean)
    if (blocos.length <= 1) {
      return <div style={{ fontSize:14, lineHeight:1.8, whiteSpace:'pre-wrap', color:'var(--primary)' }}>{texto}</div>
    }
    const cores = { '📊':'var(--blue-bg)', '⚠️':'var(--yellow-bg)', '💡':'var(--green-bg)', '🚀':'var(--red-bg)' }
    const textCores = { '📊':'var(--blue)', '⚠️':'var(--yellow)', '💡':'var(--green)', '🚀':'var(--red)' }
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {blocos.map((bloco, i) => {
          const emoji = bloco.trim()[0]
          const lines = bloco.trim().split('\n')
          const titulo = lines[0].replace(emoji, '').trim()
          const corpo = lines.slice(1).join('\n').trim()
          return (
            <div key={i} style={{ background: cores[emoji]||'var(--bg)', borderRadius:12, padding:'14px 16px', borderLeft:`3px solid ${textCores[emoji]||'var(--border)'}` }}>
              <div style={{ fontWeight:600, fontSize:13, color:textCores[emoji]||'var(--primary)', marginBottom:corpo?6:0, display:'flex', alignItems:'center', gap:6 }}>
                <span>{emoji}</span><span>{titulo}</span>
              </div>
              {corpo && <div style={{ fontSize:13, lineHeight:1.7, color:'var(--primary)', whiteSpace:'pre-wrap' }}>{corpo}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  if (loadingDados) return <div className="empty">Carregando dados financeiros...</div>

  return (
    <div>
      {/* Objetivo atual */}
      <div className="card" style={{ marginBottom:16, background:`linear-gradient(135deg, var(--primary) 0%, #2D2D35 100%)`, color:'#fff', border:'none' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:32 }}>{obj.icon}</div>
            <div>
              <div style={{ fontSize:11, opacity:0.6, textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 }}>Objetivo do casal</div>
              <div style={{ fontSize:18, fontWeight:600 }}>{obj.label}</div>
              <div style={{ fontSize:12, opacity:0.7, marginTop:4 }}>Foco: {obj.foco}</div>
            </div>
          </div>
          <a href="#" onClick={e=>{e.preventDefault();window.dispatchEvent(new CustomEvent('nav', {detail:'configuracoes'}))}}
            style={{ fontSize:12, color:'rgba(255,255,255,0.5)', textDecoration:'underline' }}>
            Alterar objetivo →
          </a>
        </div>
        {/* Alertas do objetivo */}
        <div style={{ marginTop:14, display:'flex', gap:8, flexWrap:'wrap' }}>
          {obj.alertas.map(a => (
            <span key={a} style={{ fontSize:11, background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'3px 10px', color:'rgba(255,255,255,0.7)' }}>
              {a}
            </span>
          ))}
        </div>
      </div>

      {/* Resumo do mês */}
      {dados && (
        <div className="grid-4" style={{ marginBottom:16 }}>
          <div className="mini-card">
            <div className="lbl">Saldo do mês</div>
            <div className="val" style={{ color: dados.saldo>=0?'var(--green)':'var(--red)' }}>{fmt(dados.saldo)}</div>
            <div className="sub">rec: {fmt(dados.totalRec)}</div>
          </div>
          <div className="mini-card">
            <div className="lbl">Taxa poupança</div>
            <div className="val" style={{ color: dados.totalRec>0 && ((dados.totalRec-dados.totalDesp)/dados.totalRec)>=0.2 ? 'var(--green)' : 'var(--yellow)' }}>
              {dados.totalRec > 0 ? (((dados.totalRec-dados.totalDesp)/dados.totalRec)*100).toFixed(0) : 0}%
            </div>
            <div className="sub">meta: ≥ 20%</div>
          </div>
          <div className="mini-card">
            <div className="lbl">Reserva</div>
            <div className="val" style={{ color: dados.reserva.pct >= 100 ? 'var(--green)' : dados.reserva.pct >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
              {dados.reserva.pct?.toFixed(0) || 0}%
            </div>
            <div className="sub">{fmt(dados.reserva.atual)} / {fmt(dados.reserva.meta)}</div>
          </div>
          <div className="mini-card">
            <div className="lbl">Investido</div>
            <div className="val" style={{ color:'var(--blue)' }}>{fmt(dados.investimentos)}</div>
            <div className="sub">{dados.metas} meta(s) ativa(s)</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Análise mensal */}
        <div>
          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:6 }}>📊 Análise do mês</div>
            <div style={{ fontSize:13, color:'var(--secondary)', marginBottom:14, lineHeight:1.5 }}>
              {isPremium ? `Análise profunda com memória de ${memoriaIA?.total_analises||0} mês(es). A IA aprende e evolui com vocês.` : `Diagnóstico personalizado para o objetivo `}<strong>{!isPremium && obj.label}</strong>{!isPremium && ` com base nos seus dados reais.`}
            </div>
            <button className="btn btn-primary" onClick={gerarAnalise}
              disabled={loadingAnalise} style={{ width:'100%', justifyContent:'center' }}>
              {loadingAnalise ? '⏳ Analisando com Claude...' : isPremium ? `🧠 Analisar e aprender` : `${obj.icon} Gerar análise`}
            </button>
          </div>
          {erroAnalise && (
            <div style={{ background:'var(--red-bg)', border:'0.5px solid var(--red)', borderRadius:10, padding:12, marginBottom:12, fontSize:13, color:'var(--red)' }}>
              ❌ {erroAnalise}
              <div style={{ fontSize:11, marginTop:6, opacity:0.7 }}>Verifique se a ANTHROPIC_API_KEY está configurada na Vercel.</div>
            </div>
          )}
          {analise && (
            <div className="card">
              {renderAnalise(analise)}
            </div>
          )}
        </div>

        {/* Notificações por objetivo */}
        <div>
          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:6 }}>🔔 Alertas personalizados</div>
            <div style={{ fontSize:13, color:'var(--secondary)', marginBottom:14, lineHeight:1.5 }}>
              3 alertas e dicas específicos para avançar no objetivo <strong>{obj.label}</strong>.
            </div>
            <button className="btn btn-outline" onClick={gerarNotificacoes}
              disabled={loadingNotifs} style={{ width:'100%', justifyContent:'center' }}>
              {loadingNotifs ? '⏳ Gerando alertas...' : '🔔 Gerar alertas'}
            </button>
          </div>
          {erroNotifs && (
            <div style={{ background:'var(--red-bg)', borderRadius:10, padding:12, marginBottom:12, fontSize:13, color:'var(--red)' }}>
              ❌ {erroNotifs}
            </div>
          )}
          {notifs.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {notifs.map((n, i) => {
                const c = TIPO_CORES[n.tipo] || TIPO_CORES.dica
                return (
                  <div key={i} className="card" style={{ borderLeft:`3px solid ${c.color}`, background:c.bg }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>{c.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13, color:c.color, marginBottom:4 }}>{n.titulo}</div>
                        <div style={{ fontSize:13, color:'var(--primary)', lineHeight:1.5 }}>{n.mensagem}</div>
                      </div>
                      <span className={`badge ${n.prioridade==='alta'?'badge-red':n.prioridade==='media'?'badge-yellow':'badge-green'}`}>
                        {n.prioridade}
                      </span>
                    </div>
                  </div>
                )
              })}
              {/* Salvar notificações no banco */}
              <button className="btn btn-outline btn-sm" style={{ alignSelf:'flex-end' }}
                onClick={async () => {
                  for (const n of notifs) {
                    await supabase.from('notificacoes').insert({
                      user_id: session.user.id,
                      casal_code: profile.casal_code,
                      tipo: n.tipo, titulo: n.titulo,
                      mensagem: n.mensagem, lida: false,
                    })
                  }
                  alert('✅ Alertas salvos em Notificações!')
                }}>
                💾 Salvar nos alertas
              </button>
            </div>
          )}
          {!analise && !notifs.length && !erroAnalise && !erroNotifs && (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
              <div style={{ fontWeight:500, marginBottom:8 }}>Claude AI</div>
              <div style={{ color:'var(--secondary)', fontSize:13, lineHeight:1.6 }}>
                Análises personalizadas para o objetivo<br/><strong>{obj.label}</strong>
              </div>
              <div style={{ marginTop:12, fontSize:11, color:'var(--secondary)' }}>
                Powered by Claude Sonnet
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Comparativo anônimo com casais na mesma fase */}
      {comparativo && dados && (
        <div style={{ marginTop: 16 }}>
          <ComparativoFase
            comparativo={comparativo}
            dadosUsuario={{ totalDesp: dados.totalDesp, totalRec: dados.totalRec }}
            fase={fase}
          />
        </div>
      )}
    </div>
  )
}
