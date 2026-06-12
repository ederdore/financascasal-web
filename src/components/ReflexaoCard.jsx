import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { buscarPadroesHoje, verificarContrapartida, registrarResposta, formatarReflexao, DIAS } from './PadroesGasto.js'

const RESPOSTAS = [
  { id: 'sim_guardei',    emoji: '✅', label: 'Sim, já guardei!',     cor: '#3D5A3E', corBg: '#EFF6EF' },
  { id: 'vou_guardar',    emoji: '💰', label: 'Vou guardar agora',    cor: '#C4973A', corBg: '#FDF8EC' },
  { id: 'nao_desta_vez',  emoji: '🙈', label: 'Não desta vez',        cor: '#C17F5A', corBg: '#FDF5EF' },
]

export function ReflexaoCard({ session, profile }) {
  const [padroes, setPadroes] = useState([])
  const [atual, setAtual] = useState(0)
  const [contrapartida, setContrapartida] = useState(null)
  const [respondido, setRespondido] = useState(false)
  const [resposta, setResposta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dispensado, setDispensado] = useState(false)

  useEffect(() => {
    if (!profile?.casal_code) return
    carregar()
  }, [profile?.casal_code])

  async function carregar() {
    setLoading(true)
    try {
      const p = await buscarPadroesHoje(profile.casal_code)
      if (!p.length) { setLoading(false); return }

      // Filtra os que ainda não foram respondidos hoje
      const hoje = new Date()
      const { data: jaRespondidos } = await supabase
        .from('reflexoes_respondidas')
        .select('padrao_id')
        .eq('casal_code', profile.casal_code)
        .eq('mes', hoje.getMonth())
        .eq('ano', hoje.getFullYear())
        .in('padrao_id', p.map(x => x.id))

      const respondidosIds = new Set((jaRespondidos||[]).map(r => r.padrao_id))
      const pendentes = p.filter(x => !respondidosIds.has(x.id))
      if (!pendentes.length) { setLoading(false); return }

      setPadroes(pendentes)
      // Verifica contrapartida para o primeiro padrão
      const c = await verificarContrapartida(session, profile, pendentes[0].valor_medio)
      setContrapartida(c)
    } catch(e) { console.warn(e) }
    finally { setLoading(false) }
  }

  async function responder(r) {
    const padrao = padroes[atual]
    setResposta(r)
    setRespondido(true)
    await registrarResposta(session, profile, padrao.id, r.id)

    // Se escolheu "vou guardar agora" — abre metas em 2s
    if (r.id === 'vou_guardar') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('nav', { detail: 'metas' }))
      }, 2000)
    }
  }

  function proximo() {
    if (atual < padroes.length - 1) {
      setAtual(atual + 1)
      setRespondido(false)
      setResposta(null)
      verificarContrapartida(session, profile, padroes[atual + 1].valor_medio)
        .then(setContrapartida)
    } else {
      setDispensado(true)
    }
  }

  if (loading || !padroes.length || dispensado) return null

  const padrao = padroes[atual]
  const dia = DIAS[padrao.dia_semana]
  const valor = `R$ ${Math.round(padrao.valor_medio).toLocaleString('pt-BR')}`
  const projecaoAnual = Math.round(padrao.valor_medio * 12).toLocaleString('pt-BR')

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--eden-terra)', background: '#FFFBF7', marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🌿</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--eden-terra)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Reflexão do Éden · {dia}
            </div>
            {padroes.length > 1 && (
              <div style={{ fontSize: 11, color: 'var(--secondary)' }}>{atual + 1} de {padroes.length}</div>
            )}
          </div>
        </div>
        <button onClick={() => setDispensado(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tertiary)', fontSize: 18, padding: 0 }}>×</button>
      </div>

      {!respondido ? (
        <>
          {/* Pergunta */}
          <div style={{ fontSize: 14, color: 'var(--primary)', lineHeight: 1.7, marginBottom: 12 }}>
            Na <strong>{dia}</strong> passada vocês gastaram{' '}
            <strong style={{ color: 'var(--eden-terra)' }}>{valor}</strong> em{' '}
            <strong>{padrao.categoria}</strong>.
          </div>

          {!contrapartida?.suficiente ? (
            <>
              <div style={{ fontSize: 14, color: 'var(--primary)', lineHeight: 1.7, marginBottom: 8 }}>
                Antes de repetir, vocês já guardaram pelo menos esse valor na reserva este mês?
              </div>
              <div style={{ fontSize: 12, color: 'var(--secondary)', fontStyle: 'italic', marginBottom: 16, padding: '8px 12px', background: 'rgba(193,127,90,0.08)', borderRadius: 8 }}>
                💡 Repetindo 12x ao ano = <strong>R$ {projecaoAnual}</strong>.
                Esse valor poderia cobrir {padrao.categoria === 'Alimentação' ? 'quase um mês de supermercado extra' : padrao.categoria === 'Lazer' ? 'uma viagem curta' : 'uma meta importante'}.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {RESPOSTAS.map(r => (
                  <button key={r.id} onClick={() => responder(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `0.5px solid ${r.cor}20`, background: r.corBg, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                    <span style={{ fontSize: 18 }}>{r.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: r.cor }}>{r.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ background: '#EFF6EF', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--eden-green)', lineHeight: 1.6 }}>
              ✅ Vocês já investiram <strong>R$ {Math.round(contrapartida.totalAportes).toLocaleString('pt-BR')}</strong> este mês.
              O {padrao.categoria} de hoje está coberto! Aproveitem com consciência. 🌿
              <button onClick={proximo} style={{ display: 'block', marginTop: 10, background: 'var(--eden-green)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Entendido 🌿
              </button>
            </div>
          )}
        </>
      ) : (
        /* Após resposta */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>{resposta.emoji}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: resposta.cor }}>{resposta.label}</div>
              <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 2 }}>
                {resposta.id === 'sim_guardei' && 'Parabéns! Vocês estão aplicando a educação financeira na prática. 🌿'}
                {resposta.id === 'vou_guardar' && 'Ótima decisão! Redirecionando para Metas...'}
                {resposta.id === 'nao_desta_vez' && 'Tudo bem! A consciência já é o primeiro passo. 🌱'}
              </div>
            </div>
          </div>
          {atual < padroes.length - 1 ? (
            <button onClick={proximo}
              style={{ fontSize: 12, color: 'var(--eden-green)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
              Ver próxima reflexão →
            </button>
          ) : (
            <button onClick={() => setDispensado(true)}
              style={{ fontSize: 12, color: 'var(--secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
              Fechar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
