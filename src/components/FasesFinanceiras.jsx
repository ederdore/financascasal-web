import { useState, useEffect } from 'react'
import { supabase, fmt } from '../supabase.js'
import { calcular5020 } from './Regra502030.jsx'

export const FASES = [
  {
    id: 'iniciante',
    nivel: 1,
    nome: 'Iniciante',
    emoji: '🌱',
    cor: '#8A8A8E',
    corBg: '#F5F5F5',
    descricao: 'Organizando as finanças',
    criterio: 'Primeiro mês com lançamentos',
    dica: 'Continue registrando todos os gastos. Consistência é o primeiro passo.',
  },
  {
    id: 'consciente',
    nivel: 2,
    nome: 'Consciente',
    emoji: '🔵',
    cor: '#3B82F6',
    corBg: '#EFF6FF',
    descricao: 'Controlando os gastos',
    criterio: '3 meses sem dívida no cartão',
    dica: 'Ótimo! Agora foque em construir sua reserva de emergência.',
  },
  {
    id: 'equilibrado',
    nivel: 3,
    nome: 'Equilibrado',
    emoji: '🟡',
    cor: '#F59E0B',
    corBg: '#FFFBEB',
    descricao: 'Aplicando a regra 50/30/20',
    criterio: 'Poupança ≥ 20% por 2 meses',
    dica: 'Excelente disciplina! Direcione a poupança para investimentos.',
  },
  {
    id: 'estrategico',
    nivel: 4,
    nome: 'Estratégico',
    emoji: '🟠',
    cor: '#F97316',
    corBg: '#FFF7ED',
    descricao: 'Reserva de emergência completa',
    criterio: 'Reserva de 6 meses concluída',
    dica: 'Base sólida! Hora de acelerar os investimentos e metas.',
  },
  {
    id: 'investidor',
    nivel: 5,
    nome: 'Investidor',
    emoji: '🔴',
    cor: '#E8384F',
    corBg: '#FFF1F2',
    descricao: 'Patrimônio crescendo',
    criterio: 'Investimentos ativos + 3 metas concluídas',
    dica: 'Patrimônio em construção. Diversifique e pense em renda passiva.',
  },
  {
    id: 'livre',
    nivel: 6,
    nome: 'Livre',
    emoji: '💜',
    cor: '#8B5CF6',
    corBg: '#F5F3FF',
    descricao: 'Liberdade financeira',
    criterio: 'Objetivo liberdade + renda passiva detectada',
    dica: 'Vocês chegaram lá! Mantenham o caminho e ajudem outros casais.',
  },
]

export function useFaseAtual(session, profile) {
  const [fase, setFase] = useState(null)
  const [progressoProxima, setProgressoProxima] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.casal_code) return
    calcularFase()
  }, [profile?.casal_code])

  async function calcularFase() {
    setLoading(true)
    const cc  = profile.casal_code
    const uid = session.user.id
    const now = new Date()
    const mes = now.getMonth()
    const ano = now.getFullYear()

    try {
      const [desp, rec, cartoes, reservaD, metasD, conquistasD] = await Promise.all([
        supabase.from('despesas').select('valor,categoria').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('receitas').select('valor').eq('casal_code', cc).eq('mes', mes).eq('ano', ano),
        supabase.from('cartoes').select('fatura').eq('casal_code', cc),
        supabase.from('reserva').select('atual,meta').eq('user_id', uid).maybeSingle(),
        supabase.from('metas').select('*').eq('casal_code', cc),
        supabase.from('conquistas').select('tipo,mes,ano').eq('casal_code', cc).order('created_at', { ascending: false }),
      ])

      const totalRec  = (rec.data||[]).reduce((s,r)=>s+r.valor,0)
      const faturas   = (cartoes.data||[]).reduce((s,c)=>s+(c.fatura||0),0)
      const reserva   = reservaD.data || { atual:0, meta:30000 }
      const pctRes    = reserva.meta>0 ? (reserva.atual/reserva.meta)*100 : 0
      const conquistas = conquistasD.data || []
      const metasBatidas = (metasD.data||[]).filter(m=>{
        const atual = m.valor_atual ?? m.atual ?? 0
        return (m.valor_alvo??0)>0 && atual >= (m.valor_alvo??0)
      }).length
      const investAtivos = (metasD.data||[]).filter(m=>m.ativa).length

      // Calcula 50/30/20
      const regra = calcular5020(desp.data||[], rec.data||[])
      const poupancaPct = regra?.poupanca?.pct || 0

      // Meses com poupança ≥ 20%
      const mesesPoupanca = conquistas.filter(c=>c.tipo==='poupanca_20').length

      // Meses sem fatura
      const mesesSemFatura = conquistas.filter(c=>c.tipo==='sem_cartao_devedor').length

      // Determina fase
      let faseAtual = FASES[0] // iniciante
      let progresso = 0

      if (totalRec > 0) {
        faseAtual = FASES[0]; progresso = 100

        if (mesesSemFatura >= 3) {
          faseAtual = FASES[1]; progresso = 100
        } else { progresso = Math.round((mesesSemFatura/3)*100) }

        if (mesesPoupanca >= 2) {
          faseAtual = FASES[2]; progresso = 100
        } else if (faseAtual.nivel >= 2) { progresso = Math.round((mesesPoupanca/2)*100) }

        if (pctRes >= 100) {
          faseAtual = FASES[3]; progresso = 100
        } else if (faseAtual.nivel >= 3) { progresso = Math.round(Math.min(pctRes,100)) }

        if (investAtivos > 0 && metasBatidas >= 3) {
          faseAtual = FASES[4]; progresso = 100
        } else if (faseAtual.nivel >= 4) { progresso = Math.round((metasBatidas/3)*100) }

        if (profile.objetivo==='liberdade' && investAtivos >= 3) {
          faseAtual = FASES[5]; progresso = 100
        }
      }

      setFase(faseAtual)
      setProgressoProxima(progresso)
    } catch(e) { console.warn(e) }
    finally { setLoading(false) }
  }

  return { fase, progressoProxima, loading }
}

// ── Badge para sidebar ────────────────────────────────
export function FaseBadge({ fase }) {
  if (!fase) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
      background: fase.corBg, color: fase.cor, marginLeft: 6, flexShrink: 0 }}>
      {fase.emoji} {fase.nome}
    </span>
  )
}

// ── Card de progresso de fases ────────────────────────
export function CardFases({ fase, progressoProxima }) {
  if (!fase) return null
  const proxima = FASES.find(f => f.nivel === fase.nivel + 1)

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontWeight:600, fontSize:14 }}>🎮 Fase financeira</div>
        <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
          background: fase.corBg, color: fase.cor }}>
          Nível {fase.nivel}
        </span>
      </div>

      {/* Fase atual */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14,
        background: fase.corBg, borderRadius:12, padding:'12px 14px' }}>
        <span style={{ fontSize:32 }}>{fase.emoji}</span>
        <div>
          <div style={{ fontWeight:700, fontSize:16, color: fase.cor }}>{fase.nome}</div>
          <div style={{ fontSize:12, color:'var(--secondary)', marginTop:2 }}>{fase.descricao}</div>
          <div style={{ fontSize:12, color: fase.cor, marginTop:4, fontStyle:'italic' }}>"{fase.dica}"</div>
        </div>
      </div>

      {/* Progresso para próxima fase */}
      {proxima && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
            <span style={{ color:'var(--secondary)' }}>Próxima: {proxima.emoji} {proxima.nome}</span>
            <span style={{ fontWeight:600, color:'var(--primary)' }}>{progressoProxima}%</span>
          </div>
          <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
            <div style={{ height:'100%', width:`${progressoProxima}%`, background: proxima.cor,
              borderRadius:3, transition:'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize:11, color:'var(--secondary)' }}>
            Critério: {proxima.criterio}
          </div>
        </div>
      )}

      {/* Todas as fases — linha do tempo */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:16, overflowX:'auto', paddingBottom:4 }}>
        {FASES.map((f, i) => (
          <div key={f.id} style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <div style={{ width:28, height:28, borderRadius:14, display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:14,
                background: f.nivel <= fase.nivel ? f.cor : 'var(--border)',
                opacity: f.nivel <= fase.nivel ? 1 : 0.4,
                border: f.nivel === fase.nivel ? `2px solid ${f.cor}` : 'none',
                boxShadow: f.nivel === fase.nivel ? `0 0 0 3px ${f.corBg}` : 'none',
              }}>
                <span style={{ filter: f.nivel <= fase.nivel ? 'none' : 'grayscale(1)' }}>{f.emoji}</span>
              </div>
              <div style={{ fontSize:9, color: f.nivel <= fase.nivel ? f.cor : 'var(--tertiary)',
                fontWeight: f.nivel === fase.nivel ? 600 : 400 }}>
                {f.nome}
              </div>
            </div>
            {i < FASES.length-1 && (
              <div style={{ width:20, height:2, borderRadius:1, marginBottom:14,
                background: f.nivel < fase.nivel ? f.cor : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
