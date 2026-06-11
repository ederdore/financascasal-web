import { useMemo } from 'react'
import { fmt } from '../supabase.js'

// Mapeamento automático de categorias → tipo 50/30/20
const MAPA_CATEGORIA = {
  // Necessidades (50%)
  Moradia:      'necessidade',
  Saúde:        'necessidade',
  Transporte:   'necessidade',
  Educação:     'necessidade',
  Alimentação:  'necessidade',
  // Desejos (30%)
  Lazer:        'desejo',
  Assinaturas:  'desejo',
  Vestuário:    'desejo',
  Viagem:       'desejo',
  Presente:     'desejo',
  Pets:         'desejo',
  // Poupança/Investimento (20%)
  Investimento: 'poupanca',
  // Outros → necessidade por padrão (conservador)
  Outros:       'necessidade',
}

export function classificar(categoria) {
  return MAPA_CATEGORIA[categoria] || 'necessidade'
}

export function calcular5020(despesas, receitas) {
  const totalRec = receitas.reduce((s, r) => s + r.valor, 0)
  if (totalRec === 0) return null

  const buckets = { necessidade: 0, desejo: 0, poupanca: 0 }
  despesas.forEach(d => {
    const tipo = classificar(d.categoria)
    buckets[tipo] += d.valor
  })

  // Poupança = receita - total gasto (o que sobrou também conta)
  const totalGasto = buckets.necessidade + buckets.desejo + buckets.poupanca
  const sobrou = Math.max(0, totalRec - totalGasto)
  buckets.poupanca += sobrou

  return {
    totalRec,
    necessidade: { valor: buckets.necessidade, pct: (buckets.necessidade / totalRec) * 100, meta: 50 },
    desejo:      { valor: buckets.desejo,      pct: (buckets.desejo      / totalRec) * 100, meta: 30 },
    poupanca:    { valor: buckets.poupanca,    pct: (buckets.poupanca    / totalRec) * 100, meta: 20 },
  }
}

// ── Componente visual do medidor ──────────────────────
export function Medidor502030({ despesas, receitas }) {
  const dados = useMemo(() => calcular5020(despesas, receitas), [despesas, receitas])

  if (!dados) return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>⚖️ Regra 50/30/20</div>
      <div style={{ fontSize: 13, color: 'var(--secondary)' }}>Lance receitas para ver o medidor</div>
    </div>
  )

  const itens = [
    { key: 'necessidade', label: 'Necessidades', meta: 50, cor: '#3B82F6', corBg: 'var(--blue-bg)', emoji: '🏠',
      dica: dados.necessidade.pct > 55 ? 'Acima do ideal — revise gastos fixos' : dados.necessidade.pct < 40 ? 'Ótimo controle!' : 'Dentro da meta' },
    { key: 'desejo',      label: 'Desejos',      meta: 30, cor: '#F59E0B', corBg: 'var(--yellow-bg)', emoji: '🎉',
      dica: dados.desejo.pct > 35 ? 'Atenção — desejos acima do ideal' : dados.desejo.pct < 20 ? 'Muito econômico!' : 'Dentro da meta' },
    { key: 'poupanca',    label: 'Poupança',     meta: 20, cor: '#00C781', corBg: 'var(--green-bg)', emoji: '💰',
      dica: dados.poupanca.pct >= 20 ? '🏆 Meta batida!' : dados.poupanca.pct >= 10 ? 'Quase lá!' : 'Abaixo da meta' },
  ]

  // Status geral
  const tudoCerto = dados.necessidade.pct <= 50 && dados.desejo.pct <= 30 && dados.poupanca.pct >= 20
  const status = tudoCerto ? { label: 'Regra cumprida! 🏆', cor: '#00C781', bg: 'var(--green-bg)' }
    : dados.poupanca.pct >= 10 ? { label: 'No caminho certo', cor: '#F59E0B', bg: 'var(--yellow-bg)' }
    : { label: 'Precisa de ajustes', cor: '#E8384F', bg: 'var(--red-bg)' }

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>⚖️ Regra 50/30/20</div>
          <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 2 }}>Sobre {fmt(dados.totalRec)} de receita</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: status.bg, color: status.cor }}>
          {status.label}
        </span>
      </div>

      {/* Barra empilhada */}
      <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 16, gap: 1 }}>
        {itens.map(item => (
          <div key={item.key} style={{ width: `${Math.min(dados[item.key].pct, 100)}%`, background: item.cor, transition: 'width 0.5s ease', minWidth: dados[item.key].valor > 0 ? 3 : 0 }} />
        ))}
      </div>

      {/* Detalhes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {itens.map(item => {
          const d = dados[item.key]
          const ok = item.key === 'poupanca' ? d.pct >= item.meta : d.pct <= item.meta
          const overPct = item.key === 'poupanca' ? 0 : Math.max(0, d.pct - item.meta)
          return (
            <div key={item.key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15 }}>{item.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--secondary)' }}>meta: {item.meta}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--secondary)' }}>{fmt(d.valor)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: ok ? item.cor : '#E8384F' }}>
                    {d.pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              {/* Barra individual */}
              <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                {/* Zona da meta */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${item.meta}%`, background: `${item.cor}22`, borderRight: `1px dashed ${item.cor}66` }} />
                {/* Valor real */}
                <div style={{ height: '100%', width: `${Math.min(d.pct, 100)}%`, background: ok ? item.cor : '#E8384F', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              {/* Dica */}
              <div style={{ fontSize: 11, color: ok ? item.cor : '#E8384F', marginTop: 3 }}>
                {ok ? `✓ ${item.dica}` : `↑ ${item.dica}${overPct > 0 ? ` (+${overPct.toFixed(0)}% acima)` : ''}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
