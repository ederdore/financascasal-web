import { useState, useEffect } from 'react'
import { supabase, fmt, CAT_ICONS, MESES } from '../supabase.js'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#1D9E75','#178DD1','#EF9F27','#E24B4A','#7F77DD','#2E7D32','#993556','#FF6B35','#4ECDC4']

export default function FaturaDetalhe({ session, profile, cartao, onVoltar }) {
  const [despesas, setDespesas] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [recorrencias, setRecorrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth())
  const [ano, setAno] = useState(new Date().getFullYear())

  useEffect(() => { loadData() }, [mes, ano])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [d, p, r] = await Promise.all([
      cf(supabase.from('despesas').select('*'))
        .eq('cartao_id', cartao.id).eq('mes', mes).eq('ano', ano)
        .order('created_at', { ascending: false }),
      cf(supabase.from('parcelas').select('*')).eq('cartao_id', cartao.id),
      cf(supabase.from('recorrencias_cartao').select('*')).eq('cartao_id', cartao.id).eq('ativa', true),
    ])
    if (d.data) setDespesas(d.data)
    if (p.data) setParcelas(p.data)
    if (r.data) setRecorrencias(r.data)
    setLoading(false)
  }

  const totalDesp = despesas.reduce((s, d) => s + d.valor, 0)
  const totalParc = parcelas.reduce((s, p) => s + p.valor_parcela, 0)
  const totalRec = recorrencias.reduce((s, r) => s + r.valor, 0)
  const pct = cartao.limite > 0 ? Math.min(100, ((cartao.fatura || 0) / cartao.limite) * 100) : 0
  const cor = pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--yellow)' : 'var(--green)'

  // Gráfico por categoria
  const catMap = {}
  despesas.forEach(d => { catMap[d.categoria] = (catMap[d.categoria] || 0) + d.valor })
  const pieData = Object.entries(catMap).sort((a,b) => b[1]-a[1]).map(([name, value]) => ({ name, value }))

  // Meses disponíveis (últimos 6)
  const mesesOpts = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
    mesesOpts.push({ mes: d.getMonth(), ano: d.getFullYear(), label: `${MESES[d.getMonth()]} ${d.getFullYear()}` })
  }

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-outline btn-sm" onClick={onVoltar} style={{ marginBottom: 12 }}>← Voltar para cartões</button>
        <div className="row-between">
          <div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>💳 {cartao.nome}</div>
            <div style={{ fontSize: 13, color: 'var(--secondary)', marginTop: 2 }}>
              {cartao.titular === 'eu' ? 'EU' : cartao.titular === 'ela' ? 'ELA' : 'Casal'} · Limite {fmt(cartao.limite)} · Fecha dia {cartao.dia_fechamento || 3}
            </div>
          </div>
          <select className="form-select" style={{ width: 'auto' }}
            value={`${mes}-${ano}`}
            onChange={e => { const [m,a] = e.target.value.split('-'); setMes(parseInt(m)); setAno(parseInt(a)) }}>
            {mesesOpts.map(o => <option key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="mini-card">
          <div className="lbl">Fatura atual</div>
          <div className="val" style={{ color: 'var(--red)' }}>{fmt(cartao.fatura || 0)}</div>
          <div className="sub">{pct.toFixed(0)}% do limite</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Limite disponível</div>
          <div className="val" style={{ color: 'var(--green)' }}>{fmt(Math.max(0, cartao.limite - (cartao.fatura||0) - (cartao.limite_bloqueado||0)))}</div>
          <div className="sub">de {fmt(cartao.limite)}</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Parcelas ativas</div>
          <div className="val" style={{ color: 'var(--yellow)' }}>{fmt(totalParc)}</div>
          <div className="sub">{parcelas.length} parcelamento(s)</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Assinaturas/mês</div>
          <div className="val" style={{ color: 'var(--blue)' }}>{fmt(totalRec)}</div>
          <div className="sub">{recorrencias.length} serviço(s)</div>
        </div>
      </div>

      {/* Barra de uso */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>Uso do limite</span>
          <span style={{ fontWeight: 600, color: cor }}>{pct.toFixed(0)}%</span>
        </div>
        <div className="prog-wrap" style={{ height: 10, marginBottom: 8 }}>
          <div className="prog-fill" style={{ width: (cartao.limite > 0 ? ((cartao.fatura||0)/cartao.limite)*100 : 0) + '%', background: 'var(--red)' }} />
          {(cartao.limite_bloqueado||0) > 0 && (
            <div className="prog-fill" style={{ width: (cartao.limite > 0 ? ((cartao.limite_bloqueado||0)/cartao.limite)*100 : 0) + '%', background: 'var(--yellow)' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <span style={{ color: 'var(--red)' }}>🔴 Fatura: {fmt(cartao.fatura||0)}</span>
          {(cartao.limite_bloqueado||0) > 0 && <span style={{ color: 'var(--yellow)' }}>🟡 Bloqueado: {fmt(cartao.limite_bloqueado||0)}</span>}
          <span style={{ color: 'var(--green)' }}>🟢 Livre: {fmt(Math.max(0, cartao.limite - (cartao.fatura||0) - (cartao.limite_bloqueado||0)))}</span>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Gráfico */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Por categoria</div>
          {pieData.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>Sem lançamentos neste mês</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8 }}>
                {pieData.map((item, i) => (
                  <div key={item.name} className="row-between" style={{ padding: '4px 0', fontSize: 12 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span>{CAT_ICONS[item.name] || '💸'} {item.name}</span>
                    </div>
                    <span style={{ fontWeight: 500 }}>{fmt(item.value)}</span>
                  </div>
                ))}
                <div className="row-between" style={{ padding: '6px 0', borderTop: '0.5px solid var(--border)', marginTop: 4, fontSize: 13, fontWeight: 600 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--red)' }}>{fmt(totalDesp)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Assinaturas e parcelas */}
        <div>
          {recorrencias.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>📺 Assinaturas ({fmt(totalRec)}/mês)</div>
              {recorrencias.map(r => (
                <div key={r.id} className="row-between" style={{ padding: '6px 0', fontSize: 13, borderBottom: '0.5px solid var(--border)' }}>
                  <span>{r.nome}</span>
                  <span style={{ color: 'var(--blue)', fontWeight: 500 }}>{fmt(r.valor)}</span>
                </div>
              ))}
            </div>
          )}
          {parcelas.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>📦 Parcelas ativas ({fmt(totalParc)}/mês)</div>
              {parcelas.map(p => (
                <div key={p.id} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <div className="row-between" style={{ fontSize: 13 }}>
                    <span>{p.descricao}</span>
                    <span style={{ color: 'var(--yellow)', fontWeight: 500 }}>{fmt(p.valor_parcela)}/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--secondary)', marginTop: 2 }}>
                    {p.parcela_atual}/{p.total_parcelas} parcelas · Restam {fmt((p.total_parcelas - p.parcela_atual) * p.valor_parcela)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lançamentos do mês */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 14 }}>
          Lançamentos — {MESES[mes]} {ano}
          <span style={{ fontWeight: 400, color: 'var(--secondary)', fontSize: 13, marginLeft: 8 }}>({despesas.length} item(s))</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Descrição</th><th>Categoria</th><th>Quem</th><th>Tipo</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {despesas.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.nome}</td>
                  <td>{CAT_ICONS[d.categoria] || '💸'} {d.categoria}</td>
                  <td>
                    <span className={`badge ${d.quem === 'eu' ? 'badge-blue' : d.quem === 'ela' ? 'badge-red' : 'badge-yellow'}`}>
                      {d.quem === 'casal' ? 'Casal' : d.quem === 'eu' ? 'EU' : 'ELA'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.tipo === 'recorrente' ? 'badge-green' : d.tipo === 'fixa' ? 'badge-blue' : 'badge-yellow'}`}>
                      {d.tipo === 'recorrente' ? '🔄 Rec.' : d.tipo === 'fixa' ? '📌 Fixa' : '📦 Var.'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--red)', fontWeight: 500 }}>{fmt(d.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {despesas.length === 0 && <div className="empty">Nenhum lançamento neste mês</div>}
        </div>
      </div>
    </div>
  )
}
