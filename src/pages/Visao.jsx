import { useState, useEffect } from 'react'
import { supabase, fmt, toBRL, MESES_CURTO, CAT_ICONS } from '../supabase.js'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PerguntaMensal } from '../components/PerguntaMensal.jsx'
import { ConquistasRecentes } from '../components/Conquistas.jsx'
import { Medidor502030 } from '../components/Regra502030.jsx'
import { CardFases, useFaseAtual } from '../components/FasesFinanceiras.jsx'
import { useComparativoFase, ComparativoFase } from '../components/ComparativoFases.jsx'
import { ReflexaoCard } from '../components/ReflexaoCard.jsx'
import { analisarPadroes } from '../components/PadroesGasto.js'

const COLORS = ['#1D9E75','#178DD1','#EF9F27','#E24B4A','#7F77DD','#2E7D32','#993556']

export default function Visao({ session, profile }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // Analisa padrões em background
    setTimeout(() => analisarPadroes(session, profile), 5000)
  }, [])
  const { fase, progressoProxima } = useFaseAtual(session, profile)
  const comparativo = useComparativoFase(profile, fase)

  async function loadData() {
    const uid = session.user.id
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', uid)
    const now = new Date()

    const [desp, rec, cartoes, bancos, reserva, investimentos, metas, fixas, recorrencias, pagamentos] = await Promise.all([
      cf(supabase.from('despesas').select('*')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
      cf(supabase.from('receitas').select('*')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
      cf(supabase.from('cartoes').select('*')),
      cf(supabase.from('contas_banco').select('*')),
      supabase.from('reserva').select('*').eq('user_id', uid).maybeSingle(),
      cf(supabase.from('investimentos').select('*')),
      cf(supabase.from('metas').select('*')).eq('ativa', true),
      cf(supabase.from('contas_fixas').select('*')),
      cf(supabase.from('recorrencias_cartao').select('*')).eq('ativa', true),
      cf(supabase.from('pagamentos_contas').select('*')).eq('mes', now.getMonth()).eq('ano', now.getFullYear()),
    ])

    setData({
      despesas: desp.data || [],
      receitas: rec.data || [],
      cartoes: cartoes.data || [],
      bancos: bancos.data || [],
      reserva: reserva.data || { atual: 0, meta: 30000 },
      investimentos: investimentos.data || [],
      metas: metas.data || [],
      fixas: fixas.data || [],
      recorrencias: recorrencias.data || [],
      pagamentos: pagamentos.data || [],
    })
    setLoading(false)
  }

  if (loading) return <div className="empty">Carregando...</div>

  const { despesas, receitas, cartoes, bancos, reserva, investimentos, metas, fixas, recorrencias, pagamentos } = data
  const now = new Date()

  const totalRec = receitas.filter(r => r.quem === profile.papel).reduce((s, r) => s + r.valor, 0)
  const totalDesp = despesas.filter(d => d.quem === profile.papel || d.quem === 'casal')
    .reduce((s, d) => s + (d.quem === 'casal' ? d.valor / 2 : d.valor), 0)
  const faturaTotal = cartoes.reduce((s, c) => s + (c.fatura || 0), 0)
  const deficitReal = totalDesp + faturaTotal
  const saldoReal = totalRec - deficitReal
  const saldoBancos = bancos.reduce((s, b) => s + (b.moeda === 'USD' ? toBRL(b.saldo) : b.saldo), 0)
  const totalInv = investimentos.reduce((s, i) => s + i.valor, 0)
  const pctReserva = reserva.meta > 0 ? Math.min(100, (reserva.atual / reserva.meta) * 100) : 0
  const totalFixas = fixas.reduce((s, f) => s + f.valor, 0)
  const totalRecorrencias = recorrencias.reduce((s, r) => s + r.valor, 0)
  const superavit = saldoReal

  // Contas atrasadas
  const atrasadas = fixas.filter(f => {
    const pag = pagamentos.find(p => p.conta_fixa_id === f.id)
    return !pag?.pago && now.getDate() > f.dia_vencimento
  })

  // Gráfico categorias
  const cats = {}
  despesas.forEach(d => { cats[d.categoria] = (cats[d.categoria] || 0) + d.valor })
  const pieData = Object.entries(cats).map(([name, value]) => ({ name, value }))

  // 70/30
  const ideal70 = totalRec * 0.7
  const ideal30 = totalRec * 0.3

  return (
    <div>
      {/* Alertas */}
      {atrasadas.length > 0 && (
        <div style={{ background: '#FCEBEB', border: '0.5px solid var(--red)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 10 }}>
            ⚠️ {atrasadas.length} conta(s) fixa(s) em atraso!
          </div>
          {atrasadas.map(f => (
            <div key={f.id} className="row-between" style={{ padding: '6px 0', borderTop: '0.5px solid #FCCACA' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{f.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--secondary)' }}>Venceu dia {f.dia_vencimento}</div>
              </div>
              <span style={{ fontWeight: 600, color: 'var(--red)' }}>{fmt(f.valor)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mini cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="mini-card">
          <div className="lbl">Saldo real do mês</div>
          <div className="val" style={{ color: saldoReal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoReal)}</div>
          <div className="sub">Rec: {fmt(totalRec)} · Gastos+Fat: {fmt(deficitReal)}</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Saldo bancos</div>
          <div className="val" style={{ color: 'var(--blue)' }}>{fmt(saldoBancos)}</div>
          <div className="sub">{bancos.length} conta(s)</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Faturas abertas</div>
          <div className="val" style={{ color: faturaTotal > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(faturaTotal)}</div>
          <div className="sub">{cartoes.length} cartão(ões)</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Reserva</div>
          <div className="val" style={{ color: 'var(--green)' }}>{pctReserva.toFixed(0)}%</div>
          <div className="sub">{fmt(reserva.atual)} de {fmt(reserva.meta)}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Regra 70/30 */}
        {totalRec > 0 && (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16 }}>📊 Regra 70/30 do mês</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ background: '#FCEBEB', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 4 }}>Despesas (70%)</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>{fmt(ideal70)}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: deficitReal > ideal70 ? 'var(--red)' : 'var(--green)' }}>
                  Real: {fmt(deficitReal)} {deficitReal > ideal70 ? '⚠️' : '✓'}
                </div>
              </div>
              <div style={{ background: '#E1F5EE', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 4 }}>Investimentos (30%)</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)' }}>{fmt(ideal30)}</div>
                <div style={{ fontSize: 12, color: 'var(--secondary)', marginTop: 4 }}>Meta mensal</div>
              </div>
            </div>
            {superavit > 0 ? (
              <div style={{ background: '#E1F5EE', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>🚀 Superávit: {fmt(superavit)}</div>
                <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                  Sugestão: aplique {fmt(superavit * 0.3)} em renda fixa ou adicione à reserva
                </div>
              </div>
            ) : superavit < 0 ? (
              <div style={{ background: '#FCEBEB', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>⚠️ Déficit: {fmt(Math.abs(superavit))}</div>
                <div style={{ fontSize: 12, color: 'var(--secondary)' }}>
                  Gastos acima das receitas. Revise as despesas variáveis.
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Gráfico categorias */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Gastos por categoria</div>
          {pieData.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>Sem despesas este mês</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Últimas despesas */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Últimas despesas</div>
          {despesas.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>Sem despesas este mês</div>
          ) : (
            despesas.slice(0, 6).map(d => (
              <div key={d.id} className="row-between" style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div className="row">
                  <span style={{ fontSize: 20 }}>{CAT_ICONS[d.categoria] || '💸'}</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{d.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--secondary)' }}>
                      {d.categoria} · {d.pagamento_tipo === 'cartao' ? '💳 ' + d.cartao_nome : '🏦 Débito'}
                    </div>
                  </div>
                </div>
                <span style={{ color: 'var(--red)', fontWeight: 500 }}>-{fmt(d.valor)}</span>
              </div>
            ))
          )}
        </div>

        {/* Metas */}
        {metas.length > 0 && (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16 }}>🎯 Metas em andamento</div>
            {metas.filter(m => m.valor_atual < m.valor_alvo).slice(0, 3).map(m => {
              const pct = m.valor_alvo > 0 ? Math.min(100, (m.valor_atual / m.valor_alvo) * 100) : 0
              const cor = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--blue)' : 'var(--yellow)'
              return (
                <div key={m.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--border)' }}>
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{m.nome}</span>
                    <span style={{ fontSize: 13, color: cor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="prog-wrap">
                    <div className="prog-fill" style={{ width: pct + '%', background: cor }} />
                  </div>
                  <div className="row-between" style={{ marginTop: 4, fontSize: 12, color: 'var(--secondary)' }}>
                    <span>{fmt(m.valor_atual)}</span>
                    <span>de {fmt(m.valor_alvo)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* Reflexão comportamental do dia */}
      <ReflexaoCard session={session} profile={profile} />

      {/* Medidor 50/30/20 + Fases */}
      <div className="grid-2" style={{ marginTop: 16 }}>
        <Medidor502030 despesas={despesas} receitas={receitas} />
        <CardFases fase={fase} progressoProxima={progressoProxima} />
      </div>

      {/* Comparativo anônimo */}
      {comparativo && (
        <div style={{ marginTop: 12 }}>
          <ComparativoFase
            comparativo={comparativo}
            dadosUsuario={{ totalDesp, totalRec: data.receitas.reduce((s,r)=>s+r.valor,0) }}
            fase={fase}
          />
        </div>
      )}

      {/* Pergunta mensal + conquistas */}
      <div className="grid-2" style={{ marginTop: 12 }}>
        <PerguntaMensal session={session} profile={profile} />
        <ConquistasRecentes session={session} profile={profile} />
      </div>
    </div>
  )
}
