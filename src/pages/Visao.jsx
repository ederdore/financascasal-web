import { useState, useEffect } from 'react'
import { supabase, fmt, toBRL, MESES_CURTO, CAT_ICONS } from '../supabase.js'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#1D9E75','#178DD1','#EF9F27','#E24B4A','#7F77DD','#2E7D32','#993556']

export default function Visao({ session, profile }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const uid = session.user.id
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', uid)
    const now = new Date()
    const mes = now.getMonth()
    const ano = now.getFullYear()

    const [desp, rec, cartoes, bancos, reserva, investimentos, metas] = await Promise.all([
      cf(supabase.from('despesas').select('*')).eq('mes', mes).eq('ano', ano),
      cf(supabase.from('receitas').select('*')).eq('mes', mes).eq('ano', ano),
      cf(supabase.from('cartoes').select('*')),
      cf(supabase.from('contas_banco').select('*')),
      supabase.from('reserva').select('*').eq('user_id', uid).maybeSingle(),
      cf(supabase.from('investimentos').select('*')),
      cf(supabase.from('metas').select('*')).eq('ativa', true),
    ])

    setData({
      despesas: desp.data || [],
      receitas: rec.data || [],
      cartoes: cartoes.data || [],
      bancos: bancos.data || [],
      reserva: reserva.data || { atual: 0, meta: 30000 },
      investimentos: investimentos.data || [],
      metas: metas.data || [],
    })
    setLoading(false)
  }

  if (loading) return <div className="empty">Carregando...</div>

  const { despesas, receitas, cartoes, bancos, reserva, investimentos, metas } = data
  const totalRec = receitas.filter(r => r.quem === profile.papel).reduce((s, r) => s + r.valor, 0)
  const totalDesp = despesas.filter(d => d.quem === profile.papel || d.quem === 'casal')
    .reduce((s, d) => s + (d.quem === 'casal' ? d.valor / 2 : d.valor), 0)
  const faturaTotal = cartoes.reduce((s, c) => s + (c.fatura || 0), 0)
  const saldoReal = totalRec - totalDesp - faturaTotal
  const saldoBancos = bancos.reduce((s, b) => s + (b.moeda === 'USD' ? toBRL(b.saldo) : b.saldo), 0)
  const totalInv = investimentos.reduce((s, i) => s + i.valor, 0)
  const pctReserva = reserva.meta > 0 ? Math.min(100, (reserva.atual / reserva.meta) * 100) : 0

  // Gráfico de categorias
  const cats = {}
  despesas.forEach(d => { cats[d.categoria] = (cats[d.categoria] || 0) + d.valor })
  const pieData = Object.entries(cats).map(([name, value]) => ({ name, value }))

  // Gráfico receita x despesa (últimos 6 meses — simplificado com dados do mês atual)
  const barData = [{ mes: MESES_CURTO[new Date().getMonth()], receitas: totalRec, despesas: totalDesp }]

  return (
    <div>
      {/* Mini cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="mini-card">
          <div className="lbl">Saldo real do mês</div>
          <div className="val" style={{ color: saldoReal >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoReal)}</div>
          <div className="sub">Rec: {fmt(totalRec)} · Desp: {fmt(totalDesp)}</div>
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
        {/* Gráfico categorias */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Gastos por categoria</div>
          {pieData.length === 0 ? <div className="empty" style={{ padding: 20 }}>Sem despesas este mês</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Últimas despesas */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Últimas despesas</div>
          {despesas.length === 0 ? <div className="empty" style={{ padding: 20 }}>Sem despesas este mês</div> : (
            <div>
              {despesas.slice(0, 6).map(d => (
                <div key={d.id} className="row-between" style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <div className="row">
                    <span style={{ fontSize: 20 }}>{CAT_ICONS[d.categoria] || '💸'}</span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{d.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--secondary)' }}>{d.categoria} · {d.pagamento_tipo === 'cartao' ? '💳 ' + d.cartao_nome : '🏦 Débito'}</div>
                    </div>
                  </div>
                  <span style={{ color: 'var(--red)', fontWeight: 500 }}>-{fmt(d.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metas em andamento */}
      {metas.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>🎯 Metas em andamento</div>
          <div className="grid-3">
            {metas.slice(0, 3).map(m => {
              const pct = m.valor_alvo > 0 ? Math.min(100, (m.valor_atual / m.valor_alvo) * 100) : 0
              const cor = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--blue)' : 'var(--yellow)'
              return (
                <div key={m.id} style={{ padding: 12, border: '0.5px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{m.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 8 }}>{fmt(m.valor_atual)} / {fmt(m.valor_alvo)}</div>
                  <div className="prog-wrap">
                    <div className="prog-fill" style={{ width: pct + '%', background: cor }} />
                  </div>
                  <div style={{ fontSize: 11, color: cor, marginTop: 4 }}>{pct.toFixed(0)}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
