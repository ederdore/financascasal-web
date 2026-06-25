import { useState, useEffect, useMemo } from 'react'
import { supabase, fmt } from '../supabase.js'
import { useFaseAtual } from '../components/FasesFinanceiras.jsx'
import { calcular5020 } from '../components/Regra502030.jsx'
import { PerguntaMensal } from '../components/PerguntaMensal.jsx'
import { ReflexaoCard } from '../components/ReflexaoCard.jsx'
import { chamarIA } from '../components/IAEngine.js'

// ── Fases do jardim ────────────────────────────────────
const FASES_JARDIM = [
  { min: 0,  max: 26, emoji: '🌑', nome: 'Terra árida',  cor: '#E24B4A', msg: 'O jardim precisa de atenção urgente. Vamos começar pela fundação.' },
  { min: 26, max: 41, emoji: '🌱', nome: 'Broto',        cor: '#EF9F27', msg: 'Primeiros passos dados. Todo grande jardim começou com uma única semente.' },
  { min: 41, max: 56, emoji: '🌿', nome: 'Crescimento',  cor: '#DFB86A', msg: 'Vocês já estão construindo raízes fortes.' },
  { min: 56, max: 71, emoji: '🌳', nome: 'Árvore',       cor: '#C89A4A', msg: 'Estrutura sólida. Seu patrimônio começa a gerar frutos.' },
  { min: 71, max: 86, emoji: '🌳🌸', nome: 'Jardim',     cor: '#7EA77F', msg: 'Vocês construíram um jardim que floresce.' },
  { min: 86, max: 101,emoji: '🌟', nome: 'Legado',       cor: '#3E6344', msg: 'Um jardim completo que se multiplica e protege as próximas gerações.' },
]

function getFaseJardim(saudeScore) {
  return FASES_JARDIM.find(f => saudeScore >= f.min && saudeScore < f.max) || FASES_JARDIM[3]
}

// ── Saúde do jardim ────────────────────────────────────
// ── Score de engajamento (uso da ferramenta) ─────────
function calcularEngajamento({ totalRec, totalMetas, metasBatidas, pctReserva }) {
  let score = 30
  if (totalRec > 0) score += 20       // tem receitas cadastradas
  if (totalMetas > 0) score += 20     // tem metas
  if (metasBatidas > 0) score += 15   // meta concluída
  if (pctReserva > 0) score += 15     // reserva configurada
  return Math.min(100, Math.max(30, score))
}

// ── Score de saúde financeira real ───────────────────
function calcularSaude({ saldo, totalRec, totalDesp, pctReserva, poupanca, orcamento, faturaTotal, limiteTotal, contasAtrasadas, reservaAtual, reservaMeta }) {
  if (totalRec === 0) return { score: 0, breakdown: [] }

  const breakdown = []
  let score = 0

  // 1. Saldo vs receita (25pts)
  const pctSaldo = totalRec > 0 ? (saldo / totalRec) * 100 : 0
  let pts1 = 0
  if (pctSaldo >= 20) pts1 = 25
  else if (pctSaldo >= 10) pts1 = 18
  else if (pctSaldo > 0) pts1 = 10
  else if (pctSaldo === 0) pts1 = 3
  score += pts1
  breakdown.push({
    label: 'Saldo do mês',
    pts: pts1, max: 25,
    status: pts1 >= 18 ? 'ok' : pts1 >= 10 ? 'atencao' : 'critico',
    detalhe: saldo >= 0
      ? fmt(saldo) + ' sobraram (' + pctSaldo.toFixed(0) + '% da receita) — meta: ≥20%'
      : 'Gastos superaram receitas em ' + fmt(Math.abs(saldo)),
  })

  // 2. Taxa de poupança (25pts)
  const metaPoupanca = orcamento?.pct_poupanca || 20
  let pts2 = 0
  if (poupanca >= metaPoupanca) pts2 = 25
  else if (poupanca >= metaPoupanca * 0.7) pts2 = 15
  else if (poupanca >= metaPoupanca * 0.4) pts2 = 8
  else if (poupanca > 0) pts2 = 3
  score += pts2
  breakdown.push({
    label: 'Taxa de poupança',
    pts: pts2, max: 25,
    status: pts2 >= 20 ? 'ok' : pts2 >= 8 ? 'atencao' : 'critico',
    detalhe: poupanca > 0
      ? poupanca.toFixed(0) + '% poupado (' + fmt(totalDesp * poupanca / 100) + ') — meta: ' + metaPoupanca + '%'
      : 'Nenhum valor poupado este mês — meta: ' + metaPoupanca + '% da renda',
  })

  // 3. Reserva de emergência (25pts)
  let pts3 = 0
  if (pctReserva >= 100) pts3 = 25
  else if (pctReserva >= 75) pts3 = 20
  else if (pctReserva >= 50) pts3 = 14
  else if (pctReserva >= 25) pts3 = 8
  else if (pctReserva > 0) pts3 = 3
  score += pts3
  breakdown.push({
    label: 'Reserva de emergência',
    pts: pts3, max: 25,
    status: pts3 >= 20 ? 'ok' : pts3 >= 8 ? 'atencao' : 'critico',
    detalhe: pctReserva >= 100
      ? 'Reserva completa — jardim protegido!'
      : fmt(reservaAtual) + ' de ' + fmt(reservaMeta) + ' — faltam ' + fmt(Math.max(0, reservaMeta - reservaAtual)),
  })

  // 4. Fatura do cartão vs RECEITA (15pts) — não vs limite
  let pts4 = 0
  if (faturaTotal === 0) {
    pts4 = 15
  } else if (totalRec > 0) {
    const pctFaturaRec = (faturaTotal / totalRec) * 100
    if (pctFaturaRec <= 20) pts4 = 15
    else if (pctFaturaRec <= 35) pts4 = 10
    else if (pctFaturaRec <= 50) pts4 = 5
    else pts4 = 0
    breakdown.push({
      label: 'Fatura vs renda',
      pts: pts4, max: 15,
      status: pts4 >= 10 ? 'ok' : pts4 >= 5 ? 'atencao' : 'critico',
      detalhe: 'Fatura ' + fmt(faturaTotal) + ' = ' + pctFaturaRec.toFixed(0) + '% da renda ' + fmt(totalRec) + ' — ideal: ≤20%',
    })
  }
  if (faturaTotal === 0) {
    breakdown.push({ label: 'Fatura do cartão', pts: 15, max: 15, status: 'ok', detalhe: 'Sem fatura aberta' })
  }
  score += pts4

  // 5. Contas em dia (10pts)
  let pts5 = 0
  if (contasAtrasadas === 0) pts5 = 10
  else if (contasAtrasadas === 1) pts5 = 4
  else pts5 = 0
  score += pts5
  breakdown.push({
    label: 'Contas em dia',
    pts: pts5, max: 10,
    status: pts5 === 10 ? 'ok' : pts5 > 0 ? 'atencao' : 'critico',
    detalhe: contasAtrasadas === 0
      ? 'Nenhuma conta em atraso este mês'
      : contasAtrasadas + ' conta(s) em atraso — regularize para proteger o score',
  })

  return { score: Math.min(100, Math.max(0, score)), breakdown }
}


// ── Jardim SVG animado ────────────────────────────────
function JardimSVG({ score }) {
  const T='#6B4A2A', L1='#4A7A3E', L2='#3D6A32', L3='#5A8A4A'
  const FR='#D97C6C', FY='#C89A4A', FW='#F4EFE7', FP='#9B6B9E'
  const GR='#4A6B3E', GR2='#3D5A33'
  const BASE = 148

  function op(v) { return Math.min(1,Math.max(0,v)).toFixed(2) }
  function fade(s,from,to) { return op((s-from)/(to-from)) }

  function tree(x,baseY,h,rTop,rMid,rBot,o,v=0) {
    const cols=v===0?[L2,L1,L3]:v===1?[L1,L3,L2]:[L3,L2,L1]
    return [
      <rect key={`tr${x}`} x={x-3} y={baseY-h} width="6" height={h} fill={T} opacity={o} rx="3"/>,
      <ellipse key={`te1${x}`} cx={x} cy={baseY-h} rx={rBot} ry={Math.round(rBot*0.75)} fill={cols[0]} opacity={o}/>,
      <ellipse key={`te2${x}`} cx={x} cy={baseY-h-rBot*0.4} rx={rMid} ry={Math.round(rMid*0.75)} fill={cols[1]} opacity={o}/>,
      <ellipse key={`te3${x}`} cx={x} cy={baseY-h-rBot*0.4-rMid*0.5} rx={rTop} ry={Math.round(rTop*0.75)} fill={cols[2]} opacity={o}/>,
      <ellipse key={`ts${x}`} cx={x+6} cy={baseY+3} rx={rBot*0.9} ry="4" fill="rgba(0,0,0,0.12)" opacity={o}/>,
    ]
  }

  function bush(x,y,r,o,col=L2) {
    return [
      <ellipse key={`b1${x}`} cx={x} cy={y} rx={r} ry={Math.round(r*0.65)} fill={col} opacity={o}/>,
      <ellipse key={`b2${x}`} cx={x-r*0.3} cy={y-r*0.3} rx={r*0.7} ry={Math.round(r*0.5)} fill={L1} opacity={o}/>,
    ]
  }

  function flower(x,y,o,col=FR,size=5) {
    return [
      <circle key={`fl1${x}${y}`} cx={x-size*0.8} cy={y} r={size*0.7} fill={col} opacity={o}/>,
      <circle key={`fl2${x}${y}`} cx={x+size*0.8} cy={y} r={size*0.7} fill={col} opacity={o}/>,
      <circle key={`fl3${x}${y}`} cx={x} cy={y-size*0.8} r={size*0.7} fill={col} opacity={o}/>,
      <circle key={`fl4${x}${y}`} cx={x} cy={y+size*0.8} r={size*0.7} fill={col} opacity={o}/>,
      <circle key={`fc${x}${y}`} cx={x} cy={y} r={size*0.6} fill={FY} opacity={o}/>,
    ]
  }

  function butterfly(x,y,o,col=FR) {
    return [
      <ellipse key={`bf1${x}`} cx={x-7} cy={y} rx="8" ry="5" fill={col} opacity={o} transform={`rotate(-25 ${x-7} ${y})`}/>,
      <ellipse key={`bf2${x}`} cx={x+7} cy={y} rx="8" ry="5" fill={col} opacity={o} transform={`rotate(25 ${x+7} ${y})`}/>,
      <ellipse key={`bf3${x}`} cx={x-5} cy={y+4} rx="5" ry="3" fill={col} opacity={(parseFloat(o)*0.7).toFixed(2)} transform={`rotate(-15 ${x-5} ${y+4})`}/>,
      <ellipse key={`bf4${x}`} cx={x+5} cy={y+4} rx="5" ry="3" fill={col} opacity={(parseFloat(o)*0.7).toFixed(2)} transform={`rotate(15 ${x+5} ${y+4})`}/>,
      <rect key={`bb${x}`} x={x-1} y={y-6} width="2" height="12" fill={T} opacity={o} rx="1"/>,
    ]
  }

  function bird(x,y,o) {
    return [
      <path key={`bd1${x}`} d={`M${x} ${y} Q${x-10} ${y-6} ${x-18} ${y-2}`} fill="none" stroke="#C89A4A" strokeWidth="1.5" opacity={o} strokeLinecap="round"/>,
      <path key={`bd2${x}`} d={`M${x} ${y} Q${x+10} ${y-6} ${x+18} ${y-2}`} fill="none" stroke="#C89A4A" strokeWidth="1.5" opacity={o} strokeLinecap="round"/>,
    ]
  }

  const b1=fade(score,30,41), b2=fade(score,41,57), b3=fade(score,57,72)
  const b4=fade(score,72,87), b5=fade(score,87,100)
  const bf2=fade(score,49,57), bf3=fade(score,63,72), bf4=fade(score,77,87)
  const bf5=fade(score,91,100)
  const starOp=(parseFloat(fade(score,80,87))*0.5).toFixed(2)

  return (
    <svg width="100%" viewBox="0 0 680 180" preserveAspectRatio="xMidYMax meet" style={{ display:'block' }}>
      {/* Ground */}
      <rect x="0" y={BASE} width="680" height="32" fill={GR}/>
      <rect x="0" y={BASE+10} width="680" height="22" fill={GR2}/>
      {[40,90,150,220,310,370,440,530,600,650].map(x => (
        <path key={x} d={`M${x} ${BASE} Q${x-3} ${BASE-6} ${x} ${BASE-9} Q${x+3} ${BASE-6} ${x} ${BASE}`} fill={L2} opacity="0.6"/>
      ))}

      {/* Fase 1 — Broto */}
      {parseFloat(b1)>0 && <>
        <rect x="338" y={BASE-28} width="4" height="28" fill={T} opacity={b1} rx="2"/>
        <ellipse cx="340" cy={BASE-30} rx="12" ry="9" fill={L1} opacity={b1}/>
        <ellipse cx="332" cy={BASE-24} rx="9" ry="6" fill={L2} opacity={b1} transform={`rotate(-35 332 ${BASE-24})`}/>
        <ellipse cx="348" cy={BASE-24} rx="9" ry="6" fill={L2} opacity={b1} transform={`rotate(35 348 ${BASE-24})`}/>
        {flower(310, BASE-8, fade(score,36,41), FR, 4)}
      </>}

      {/* Fase 2 — Crescimento */}
      {parseFloat(b2)>0 && <>
        <rect x="338" y={BASE-55} width="4" height="55" fill={T} opacity={b2} rx="2"/>
        <ellipse cx="340" cy={BASE-57} rx="22" ry="17" fill={L1} opacity={b2}/>
        <ellipse cx="340" cy={BASE-68} rx="16" ry="13" fill={L3} opacity={b2}/>
        {bush(150, BASE-12, 28, b2, L2)}
        {bush(530, BASE-12, 28, b2, L2)}
        {flower(145, BASE-24, bf2, FR, 5)}
        {flower(535, BASE-24, bf2, FY, 5)}
        {flower(370, BASE-8, bf2, FW, 4)}
      </>}

      {/* Fase 3 — Árvore */}
      {parseFloat(b3)>0 && <>
        {tree(340, BASE, 90, 18, 26, 34, b3, 0)}
        {bush(200, BASE-8, 30, b3, L1)}
        {bush(480, BASE-8, 30, b3, L3)}
        {[[240,FR],[290,FY],[390,FR],[440,FW],[160,FP]].map(([x,c]) => flower(x, BASE-10, bf3, c, 5))}
        {butterfly(420, BASE-45, bf3, FR)}
      </>}

      {/* Fase 4 — Jardim */}
      {parseFloat(b4)>0 && <>
        {tree(130, BASE, 72, 15, 22, 28, b4, 1)}
        {tree(550, BASE, 72, 15, 22, 28, b4, 2)}
        {[[75,FR],[95,FY],[105,FW],[580,FR],[600,FP],[615,FY],[220,FP],[250,FW],[430,FW],[460,FP]].map(([x,c]) => flower(x, BASE-10, bf4, c, 5))}
        {butterfly(255, BASE-55, bf4, FY)}
        {butterfly(480, BASE-40, bf4, FP)}
        {[[60,20],[180,12],[490,15],[620,10]].map(([x,y]) => (
          <circle key={`s${x}`} cx={x} cy={y} r="2" fill="#DFB86A" opacity={starOp}/>
        ))}
      </>}

      {/* Fase 5 — Legado */}
      {parseFloat(b5)>0 && <>
        {tree(48, BASE, 58, 12, 17, 22, b5, 2)}
        {tree(632, BASE, 58, 12, 17, 22, b5, 0)}
        {tree(280, BASE, 35, 8, 11, 14, b5, 1)}
        {tree(400, BASE, 35, 8, 11, 14, b5, 0)}
        {bush(340, BASE-5, 15, b5, L3)}
        {[[30,FR],[55,FY],[330,FW],[350,FR],[658,FP],[640,FY],[175,FW],[320,FP]].map(([x,c]) => flower(x, BASE-8, bf5, c, 4))}
        {butterfly(100, BASE-50, bf5, FR)}
        {butterfly(340, BASE-100, bf5, FY)}
        {butterfly(570, BASE-55, bf5, FP)}
        {bird(200, 25, bf5)}
        {bird(440, 18, bf5)}
        {bird(560, 32, bf5)}
        <circle cx="610" cy="22" r="18" fill="#DFB86A" opacity={(parseFloat(bf5)*0.4).toFixed(2)}/>
        <circle cx="619" cy="17" r="16" fill="#2D4A2E" opacity={(parseFloat(bf5)*0.4).toFixed(2)}/>
        {[[40,14],[120,8],[260,5],[380,9],[500,6],[650,18],[80,28],[300,20],[450,25],[580,12]].map(([x,y]) => (
          <circle key={`st${x}`} cx={x} cy={y} r="1.5" fill="#DFB86A" opacity={(parseFloat(bf5)*0.7).toFixed(2)}/>
        ))}
        {[[340,20],[325,35],[355,28]].map(([x,y]) => (
          <path key={`sp${x}`} d={`M${x} ${y-4} L${x} ${y+4} M${x-4} ${y} L${x+4} ${y}`} stroke="#DFB86A" strokeWidth="1.5" opacity={(parseFloat(bf5)*0.6).toFixed(2)} strokeLinecap="round"/>
        ))}
      </>}
    </svg>
  )
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
      const [desp, rec, bancos, cartoes, reservaD, metasD, aportes, orcamentoD, contasD] = await Promise.all([
        supabase.from('despesas').select('valor,categoria,nome').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('receitas').select('valor').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('contas_banco').select('banco,saldo').eq('casal_code', cc),
        supabase.from('cartoes').select('nome,fatura,limite').eq('casal_code', cc),
        supabase.from('reserva').select('atual,meta').eq('user_id', uid).maybeSingle(),
        supabase.from('metas').select('*').eq('casal_code', cc).eq('ativa', true),
        supabase.from('aportes_metas').select('valor').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('orcamento_config').select('*').eq('casal_code', cc).maybeSingle(),
        supabase.from('contas_fixas').select('id,dia_vencimento').eq('casal_code', cc),
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

      // Orçamento configurado
      const orcamento = orcamentoD.data

      // Regra 50/30/20
      const regra = calcular5020(desp.data||[], rec.data||[], orcamento)

      // Contas atrasadas
      const hoje = now.getDate()
      const contasAtrasadas = (contasD.data||[]).filter(c => c.dia_vencimento < hoje).length

      // Limite total de cartões
      const limiteTotal = (cartoes.data||[]).reduce((s,c)=>s+(c.limite||0),0)
      const faturaTotal = (cartoes.data||[]).reduce((s,c)=>s+(c.fatura||0),0)

      // Score de saúde real (qualidade dos frutos)
      const reservaAtual = reservaD.data?.atual || 0
      const reservaMeta  = reservaD.data?.meta  || 30000
      const { score: saude, breakdown: saudeBreakdown } = calcularSaude({
        saldo: totalRec-totalDesp, totalRec, totalDesp,
        pctReserva, poupanca, orcamento,
        faturaTotal, limiteTotal, contasAtrasadas,
        reservaAtual, reservaMeta,
      })

      // Score de engajamento (uso da ferramenta)
      const engajamento = calcularEngajamento({ totalRec, totalMetas: metas.length, metasBatidas, pctReserva })

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
        patrimônio, poupanca, saude, saudeBreakdown, engajamento, regra,
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
            <div style={{ fontSize:36, fontWeight:700, color: faseJardim.cor || '#DFB86A', lineHeight:1 }}>
              {dados.saude}%
            </div>
            <div style={{ fontSize:11, color:'rgba(232,220,200,.6)', marginTop:4, fontWeight:500 }}>
              {faseJardim.emoji} {faseJardim.nome}
            </div>

            {/* Engajamento */}
            <div style={{ marginTop:8, paddingTop:8, borderTop:'0.5px solid rgba(255,255,255,.1)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'rgba(232,220,200,.4)' }}>Engajamento</span>
                <span style={{ fontSize:10, color:'rgba(232,220,200,.5)' }}>{dados.engajamento}%</span>
              </div>
              <div style={{ height:3, background:'rgba(255,255,255,.1)', borderRadius:2 }}>
                <div style={{ height:'100%', width:dados.engajamento+'%', background:'#7EA77F', borderRadius:2 }}/>
              </div>
            </div>
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

        {/* Fase visual — Jardim animado */}
        <div style={{ borderRadius:14, overflow:'hidden', background:'linear-gradient(160deg, #3D5A3E 0%, #2D4A2E 100%)', position:'relative', minHeight:200 }}>
          <div style={{ padding:'18px 20px 0', position:'relative', zIndex:2 }}>
            <div style={{ display:'inline-block', background:'rgba(196,151,58,0.25)', color:'#DFB86A', fontSize:11, fontWeight:600, padding:'2px 10px', borderRadius:20, border:'0.5px solid rgba(196,151,58,0.4)', marginBottom:8 }}>
              {faseJardim.emoji} {faseJardim.nome}
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, fontWeight:600, color:'#fff', lineHeight:1.3 }}>
              "{faseJardim.msg}"
            </div>
            {fase && (
              <div style={{ fontSize:11, color:'rgba(232,220,200,0.5)', marginTop:6 }}>
                {fase.emoji} Fase financeira: {fase.nome}
              </div>
            )}
          </div>
          <JardimSVG score={dados.saude} />
        </div>

        {/* Diagnóstico do jardim */}
        {dados.saudeBreakdown?.length > 0 && (
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>📋 Diagnóstico do jardim</div>
                <div style={{ fontSize:12, color:'var(--secondary)', marginTop:2 }}>
                  O que está impactando sua saúde financeira
                </div>
              </div>
              <div style={{
                fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20,
                background: dados.saude >= 71 ? '#E1F5EE' : dados.saude >= 41 ? '#FFF8EE' : '#FCEBEB',
                color: dados.saude >= 71 ? 'var(--green)' : dados.saude >= 41 ? 'var(--yellow)' : 'var(--red)',
              }}>
                {faseJardim.emoji} {faseJardim.nome}
              </div>
            </div>

            {/* Barra de progresso total */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                <span style={{ color:'var(--secondary)' }}>Saúde financeira real</span>
                <span style={{ fontWeight:700, color: dados.saude >= 71?'var(--green)':dados.saude>=41?'var(--yellow)':'var(--red)' }}>
                  {dados.saude}/100
                </span>
              </div>
              <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                <div style={{
                  height:'100%',
                  width: dados.saude + '%',
                  background: dados.saude>=71?'var(--green)':dados.saude>=41?'var(--yellow)':'var(--red)',
                  borderRadius:4, transition:'width .6s'
                }}/>
              </div>
            </div>

            {/* Itens do breakdown */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {dados.saudeBreakdown.map((item, i) => (
                <div key={i}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{
                        width:24, height:24, borderRadius:6, flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:12,
                        background: item.status==='ok'?'#E1F5EE':item.status==='atencao'?'#FFF8EE':'#FCEBEB',
                      }}>
                        {item.status==='ok'?'✅':item.status==='atencao'?'⚠️':'❌'}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{item.label}</div>
                        <div style={{ fontSize:11, color:'var(--secondary)', marginTop:1 }}>{item.detalhe}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                      <span style={{
                        fontSize:12, fontWeight:700,
                        color: item.status==='ok'?'var(--green)':item.status==='atencao'?'var(--yellow)':'var(--red)'
                      }}>
                        {item.pts}
                      </span>
                      <span style={{ fontSize:11, color:'var(--secondary)' }}>/{item.max}</span>
                    </div>
                  </div>
                  {/* Mini barra por item */}
                  <div style={{ height:3, background:'var(--border)', borderRadius:2, marginLeft:32, overflow:'hidden' }}>
                    <div style={{
                      height:'100%',
                      width: item.max > 0 ? (item.pts/item.max*100)+'%' : '0%',
                      background: item.status==='ok'?'var(--green)':item.status==='atencao'?'var(--yellow)':'var(--red)',
                      borderRadius:2, transition:'width .4s'
                    }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Mensagem motivadora baseada no estágio */}
            <div style={{ marginTop:16, padding:12, background:'var(--bg)', borderRadius:10, borderLeft:'3px solid var(--eden-green)' }}>
              <div style={{ fontSize:12, color:'var(--secondary)', fontStyle:'italic' }}>
                "{faseJardim.msg}"
              </div>
            </div>
          </div>
        )}

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
