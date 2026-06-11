import { useState, useEffect } from 'react'
import { supabase, fmt } from '../supabase.js'
import { FASES } from './FasesFinanceiras.jsx'

// Busca mediana anônima dos casais na mesma fase
export function useComparativoFase(profile, faseAtual) {
  const [comparativo, setComparativo] = useState(null)

  useEffect(() => {
    if (!faseAtual || !profile?.casal_code) return
    buscarComparativo(faseAtual, profile)
  }, [faseAtual?.id, profile?.casal_code])

  async function buscarComparativo(fase, profile) {
    try {
      const now = new Date()
      const mes = now.getMonth()
      const ano = now.getFullYear()

      // Busca conquistas de outros casais na mesma fase (anônimo — só agrega)
      const { data: conquistasFase } = await supabase
        .from('conquistas')
        .select('casal_code')
        .eq('tipo', fase.id === 'consciente' ? 'sem_cartao_devedor'
          : fase.id === 'equilibrado' ? 'poupanca_20'
          : fase.id === 'estrategico' ? 'reserva_100'
          : 'mes_positivo')
        .neq('casal_code', profile.casal_code)
        .limit(200)

      const casaisFase = [...new Set((conquistasFase || []).map(c => c.casal_code))]
      if (casaisFase.length < 3) return // mínimo para anonimato

      // Busca despesas e receitas desses casais (agregado)
      const [desps, recs] = await Promise.all([
        supabase.from('despesas').select('casal_code,valor').in('casal_code', casaisFase).eq('mes', mes).eq('ano', ano),
        supabase.from('receitas').select('casal_code,valor').in('casal_code', casaisFase).eq('mes', mes).eq('ano', ano),
      ])

      // Calcula por casal e depois mediana
      const porCasal = {}
      ;(desps.data||[]).forEach(d => {
        if (!porCasal[d.casal_code]) porCasal[d.casal_code] = { desp: 0, rec: 0 }
        porCasal[d.casal_code].desp += d.valor
      })
      ;(recs.data||[]).forEach(r => {
        if (!porCasal[r.casal_code]) porCasal[r.casal_code] = { desp: 0, rec: 0 }
        porCasal[r.casal_code].rec += r.valor
      })

      const valores = Object.values(porCasal)
      if (valores.length < 3) return

      // Mediana
      const medianaDesp = mediana(valores.map(v => v.desp).sort((a,b) => a-b))
      const medianaRec  = mediana(valores.map(v => v.rec).sort((a,b) => a-b))
      const medianaPoup = mediana(valores.map(v => v.rec > 0 ? ((v.rec-v.desp)/v.rec)*100 : 0).sort((a,b)=>a-b))

      setComparativo({
        totalCasais: casaisFase.length,
        medianaDesp,
        medianaRec,
        medianaPoup: Math.max(0, medianaPoup),
      })
    } catch(e) { console.warn('Comparativo:', e.message) }
  }

  return comparativo
}

function mediana(arr) {
  if (!arr.length) return 0
  const meio = Math.floor(arr.length / 2)
  return arr.length % 2 !== 0 ? arr[meio] : (arr[meio-1]+arr[meio]) / 2
}

// ── Componente visual ─────────────────────────────────
export function ComparativoFase({ comparativo, dadosUsuario, fase }) {
  if (!comparativo || comparativo.totalCasais < 3) return null

  const { medianaDesp, medianaRec, medianaPoup, totalCasais } = comparativo
  const { totalDesp, totalRec } = dadosUsuario

  const poupUsuario = totalRec > 0 ? ((totalRec-totalDesp)/totalRec)*100 : 0
  const melhorPoup  = poupUsuario >= medianaPoup
  const melhorDesp  = totalDesp <= medianaDesp

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontWeight:600, fontSize:14 }}>👥 Casais na mesma fase</div>
        <span style={{ fontSize:11, color:'var(--secondary)', background:'var(--bg)', padding:'3px 8px', borderRadius:6 }}>
          {fase?.emoji} {fase?.nome} · {totalCasais} casais (anônimo)
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
        {/* Despesas */}
        <div style={{ background:'var(--bg)', borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:'var(--secondary)', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:0.5 }}>
            Despesas medianas
          </div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--primary)', marginBottom:4 }}>
            {fmt(medianaDesp)}
          </div>
          <div style={{ fontSize:12, color: melhorDesp ? 'var(--green)' : 'var(--yellow)' }}>
            Vocês: {fmt(totalDesp)} {melhorDesp ? '✓ abaixo' : '↑ acima'}
          </div>
        </div>

        {/* Receitas */}
        <div style={{ background:'var(--bg)', borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:'var(--secondary)', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:0.5 }}>
            Receitas medianas
          </div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--primary)', marginBottom:4 }}>
            {fmt(medianaRec)}
          </div>
          <div style={{ fontSize:12, color:'var(--secondary)' }}>
            Vocês: {fmt(totalRec)}
          </div>
        </div>

        {/* Poupança */}
        <div style={{ background:'var(--bg)', borderRadius:10, padding:12 }}>
          <div style={{ fontSize:11, color:'var(--secondary)', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:0.5 }}>
            Poupança mediana
          </div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--primary)', marginBottom:4 }}>
            {medianaPoup.toFixed(0)}%
          </div>
          <div style={{ fontSize:12, color: melhorPoup ? 'var(--green)' : 'var(--yellow)' }}>
            Vocês: {poupUsuario.toFixed(0)}% {melhorPoup ? '✓ acima' : '↑ abaixo'}
          </div>
        </div>
      </div>

      <div style={{ fontSize:11, color:'var(--tertiary)', marginTop:10, textAlign:'center' }}>
        Dados anônimos e agregados — nenhum casal é identificado individualmente
      </div>
    </div>
  )
}
