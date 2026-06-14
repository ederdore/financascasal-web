import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

// ── Níveis de maturidade ──────────────────────────────
export const NIVEIS = [
  {
    id: 'semente',
    nivel: 1,
    nome: 'Semente',
    emoji: '🌱',
    cor: '#7A9E7E',
    corBg: '#F0FBF6',
    lancamentos: 0,
    descricao: 'A IA está aprendendo quem vocês são',
    capacidade: 'Dicas genéricas baseadas em categoria',
    proxLabel: 'Broto',
    proxMeta: 10,
  },
  {
    id: 'broto',
    nivel: 2,
    nome: 'Broto',
    emoji: '🌿',
    cor: '#3D7A41',
    corBg: '#EFF6EF',
    lancamentos: 10,
    descricao: 'A IA já reconhece seus padrões básicos',
    capacidade: 'Dicas personalizadas por categoria e objetivo',
    proxLabel: 'Crescendo',
    proxMeta: 30,
  },
  {
    id: 'crescendo',
    nivel: 3,
    nome: 'Crescendo',
    emoji: '🌳',
    cor: '#2D5A30',
    corBg: '#E8F5E9',
    lancamentos: 30,
    descricao: 'A IA identifica seus padrões semanais',
    capacidade: 'Reflexões proativas no momento certo',
    proxLabel: 'Florescendo',
    proxMeta: 60,
  },
  {
    id: 'florescendo',
    nivel: 4,
    nome: 'Florescendo',
    emoji: '🍃',
    cor: '#C17F5A',
    corBg: '#FDF5EF',
    lancamentos: 60,
    descricao: 'A IA antecipa comportamentos do casal',
    capacidade: 'Alertas preditivos antes do gasto acontecer',
    proxLabel: 'Maduro',
    proxMeta: 100,
  },
  {
    id: 'maduro',
    nivel: 5,
    nome: 'Parceiro',
    emoji: '🌺',
    cor: '#C4973A',
    corBg: '#FDF8EC',
    lancamentos: 100,
    descricao: 'A IA é um parceiro financeiro do casal',
    capacidade: 'Análise comportamental profunda e planejamento preditivo',
    proxLabel: null,
    proxMeta: null,
  },
]

export function calcularNivel(totalLancamentos) {
  let nivel = NIVEIS[0]
  for (const n of NIVEIS) {
    if (totalLancamentos >= n.lancamentos) nivel = n
    else break
  }
  return nivel
}

export function useMaturidadeIA(session, profile) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.casal_code) return
    carregar()
  }, [profile?.casal_code])

  async function carregar() {
    setLoading(true)
    try {
      const cc = profile.casal_code
      const [desps, recs, ctx, reflexoes] = await Promise.all([
        supabase.from('despesas').select('id', { count: 'exact' }).eq('casal_code', cc),
        supabase.from('receitas').select('id', { count: 'exact' }).eq('casal_code', cc),
        supabase.from('bot_contextos').select('id', { count: 'exact' }).eq('casal_code', cc),
        supabase.from('reflexoes_respondidas').select('id', { count: 'exact' }).eq('casal_code', cc),
      ])

      const totalLancamentos = (desps.count || 0) + (recs.count || 0)
      const totalDicas       = ctx.count || 0
      const totalReflexoes   = reflexoes.count || 0
      const nivelAtual       = calcularNivel(totalLancamentos)
      const proximo          = NIVEIS.find(n => n.nivel === nivelAtual.nivel + 1)
      const pctProximo       = proximo
        ? Math.min(100, Math.round(((totalLancamentos - nivelAtual.lancamentos) / (proximo.lancamentos - nivelAtual.lancamentos)) * 100))
        : 100

      setDados({ totalLancamentos, totalDicas, totalReflexoes, nivelAtual, proximo, pctProximo })
    } catch(e) { console.warn(e) }
    finally { setLoading(false) }
  }

  return { dados, loading, recarregar: carregar }
}

// ── Card de maturidade ────────────────────────────────
export function CardMaturidadeIA({ session, profile }) {
  const { dados, loading } = useMaturidadeIA(session, profile)
  const [expandido, setExpandido] = useState(false)

  if (loading || !dados) return null

  const { nivelAtual, proximo, pctProximo, totalLancamentos, totalDicas, totalReflexoes } = dados

  return (
    <div className="card" style={{ borderLeft: `3px solid ${nivelAtual.cor}` }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, cursor:'pointer' }}
        onClick={() => setExpandido(!expandido)}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:26 }}>{nivelAtual.emoji}</span>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14, fontWeight:700, color:nivelAtual.cor }}>IA {nivelAtual.nome}</span>
              <span style={{ fontSize:11, background:nivelAtual.corBg, color:nivelAtual.cor, padding:'1px 7px', borderRadius:20, fontWeight:600 }}>
                Nível {nivelAtual.nivel}
              </span>
            </div>
            <div style={{ fontSize:12, color:'var(--secondary)', marginTop:2 }}>{nivelAtual.descricao}</div>
          </div>
        </div>
        <span style={{ color:'var(--tertiary)', fontSize:18 }}>{expandido ? '▲' : '▼'}</span>
      </div>

      {/* Barra de progresso para próximo nível */}
      {proximo && (
        <div style={{ marginBottom: expandido ? 14 : 0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--secondary)', marginBottom:5 }}>
            <span>{totalLancamentos} lançamentos</span>
            <span>Próximo: {proximo.emoji} {proximo.nome} em {proximo.lancamentos - totalLancamentos} lançamentos</span>
          </div>
          <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pctProximo}%`, background:nivelAtual.cor, borderRadius:3, transition:'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {!proximo && (
        <div style={{ fontSize:12, color:nivelAtual.cor, fontWeight:600, marginBottom: expandido ? 14 : 0 }}>
          🌺 Nível máximo atingido — a IA conhece vocês profundamente
        </div>
      )}

      {/* Detalhes expandidos */}
      {expandido && (
        <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:14 }}>
          {/* O que a IA consegue agora */}
          <div style={{ background:nivelAtual.corBg, borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:nivelAtual.cor, textTransform:'uppercase', letterSpacing:0.5, marginBottom:5 }}>
              O que a IA faz agora
            </div>
            <div style={{ fontSize:13, color:'var(--primary)', lineHeight:1.5 }}>✓ {nivelAtual.capacidade}</div>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
            {[
              ['💸', 'Lançamentos', totalLancamentos],
              ['💡', 'Dicas enviadas', totalDicas],
              ['🌿', 'Reflexões', totalReflexoes],
            ].map(([emoji, label, val]) => (
              <div key={label} style={{ textAlign:'center', background:'var(--bg)', borderRadius:8, padding:'8px 4px' }}>
                <div style={{ fontSize:16, marginBottom:3 }}>{emoji}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--primary)' }}>{val}</div>
                <div style={{ fontSize:10, color:'var(--secondary)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Próximos níveis */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--secondary)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
              Jornada de aprendizado
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {NIVEIS.map(n => {
                const ativo  = n.nivel <= nivelAtual.nivel
                const atual  = n.nivel === nivelAtual.nivel
                return (
                  <div key={n.id} style={{ display:'flex', alignItems:'flex-start', gap:10, opacity: ativo ? 1 : 0.4 }}>
                    <div style={{ width:28, height:28, borderRadius:14, background: ativo ? n.cor : 'var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0,
                      boxShadow: atual ? `0 0 0 3px ${n.corBg}` : 'none' }}>
                      {n.emoji}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight: atual ? 700 : 500, color: ativo ? n.cor : 'var(--secondary)' }}>
                        {n.nome} {atual && '← você está aqui'}
                      </div>
                      <div style={{ fontSize:11, color:'var(--secondary)', lineHeight:1.4 }}>{n.capacidade}</div>
                      {!ativo && <div style={{ fontSize:10, color:'var(--tertiary)' }}>a partir de {n.lancamentos} lançamentos</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
