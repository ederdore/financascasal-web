import { useState, useEffect } from 'react'
import { supabase, fmt, toBRL, iconeBanco, SUBTIPOS_RF } from '../supabase.js'

export default function RendaFixa({ session, profile }) {
  const [investimentos, setInvestimentos] = useState([])
  const [bancos, setBancos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [nome, setNome] = useState('')
  const [subtipo, setSubtipo] = useState('cdb')
  const [dono, setDono] = useState(profile.papel)
  const [valor, setValor] = useState('')
  const [rent, setRent] = useState('')
  const [taxa, setTaxa] = useState('')
  const [venc, setVenc] = useState('')
  const [moeda, setMoeda] = useState('BRL')
  const [bancoId, setBancoId] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const [inv, ban] = await Promise.all([
      cf(supabase.from('investimentos').select('*')).order('created_at', { ascending: false }),
      cf(supabase.from('contas_banco').select('*')),
    ])
    if (inv.data) setInvestimentos(inv.data)
    if (ban.data) {
      setBancos(ban.data)
      const principal = ban.data.find(b => b.id === profile.banco_principal_id) || ban.data[0]
      if (principal && !bancoId) { setBancoId(principal.id); setBancoNome(principal.banco) }
    }
    setLoading(false)
  }

  function openModal(i = null) {
    setEdit(i)
    setNome(i?.nome || '')
    setSubtipo(i?.subtipo || 'cdb')
    setDono(i?.dono || profile.papel)
    setValor(i ? String(i.valor) : '')
    setRent(i ? String(i.rentabilidade || 0) : '')
    setTaxa(i?.taxa_contratada ? String(i.taxa_contratada) : '')
    setVenc(i?.vencimento || '')
    setMoeda(i?.moeda || 'BRL')
    setBancoId(i?.banco_id || bancos.find(b => b.id === profile.banco_principal_id)?.id || bancos[0]?.id || '')
    setBancoNome(i?.banco_nome || bancos.find(b => b.id === profile.banco_principal_id)?.banco || bancos[0]?.banco || '')
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      user_id: session.user.id,
      casal_code: profile.casal_code || session.user.id,
      nome,
      categoria: 'Renda Fixa',
      subtipo,
      dono,
      valor: parseFloat(valor) || 0,
      rentabilidade: parseFloat(rent) || 0,
      taxa_contratada: parseFloat(taxa) || 0,
      vencimento: venc || null,
      moeda: moeda || 'BRL',
      banco_id: bancoId || null,
      banco_nome: bancoNome || '',
    }
    try {
      let result
      if (edit) result = await supabase.from('investimentos').update(payload).eq('id', edit.id)
      else result = await supabase.from('investimentos').insert(payload)
      if (result.error) throw result.error
      setModal(false); loadData()
    } catch (e) {
      console.error('Erro investimentos:', e)
      alert('Erro ao salvar: ' + (e.message || JSON.stringify(e)))
    } finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir este ativo?')) return
    await supabase.from('investimentos').delete().eq('id', id); loadData()
  }

  // Totais
  const totalBRL = investimentos.filter(i => i.moeda !== 'USD').reduce((s, i) => s + i.valor, 0)
  const totalUSD = investimentos.filter(i => i.moeda === 'USD').reduce((s, i) => s + i.valor, 0)
  const totalConsolidado = totalBRL + toBRL(totalUSD)
  const totalRentBRL = investimentos.filter(i => i.moeda !== 'USD').reduce((s, i) => s + (i.valor * (i.rentabilidade || 0) / 100), 0)
  const totalRentUSD = investimentos.filter(i => i.moeda === 'USD').reduce((s, i) => s + (i.valor * (i.rentabilidade || 0) / 100), 0)

  // Agrupado por banco
  const porBanco = {}
  investimentos.forEach(i => {
    const key = i.banco_nome || 'Sem banco'
    if (!porBanco[key]) porBanco[key] = { nome: key, total: 0, ativos: 0 }
    porBanco[key].total += i.moeda === 'USD' ? toBRL(i.valor) : i.valor
    porBanco[key].ativos++
  })

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      {/* Mini cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="mini-card">
          <div className="lbl">Total investido (BRL)</div>
          <div className="val" style={{ color: 'var(--green)' }}>{fmt(totalBRL)}</div>
          <div className="sub">{investimentos.filter(i => i.moeda !== 'USD').length} ativo(s)</div>
        </div>
        {totalUSD > 0 && (
          <div className="mini-card">
            <div className="lbl">Total investido (USD)</div>
            <div className="val" style={{ color: 'var(--usd)' }}>{fmt(totalUSD, 'USD')}</div>
            <div className="sub">≈ {fmt(toBRL(totalUSD))}</div>
          </div>
        )}
        <div className="mini-card">
          <div className="lbl">Consolidado BRL</div>
          <div className="val" style={{ color: 'var(--blue)' }}>{fmt(totalConsolidado)}</div>
          <div className="sub">{investimentos.length} ativo(s) total</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Resultado do mês</div>
          <div className="val" style={{ color: 'var(--green)' }}>+{fmt(totalRentBRL)}</div>
          <div className="sub">{totalConsolidado > 0 ? ((totalRentBRL / totalConsolidado) * 100).toFixed(2) + '% mês' : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Novo ativo</button>
      </div>

      {/* Por banco */}
      {Object.keys(porBanco).length > 1 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Distribuição por banco</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.values(porBanco).sort((a, b) => b.total - a.total).map(b => (
              <div key={b.nome} style={{ flex: 1, minWidth: 140, background: 'var(--bg)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>🏦 {b.nome}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)', margin: '4px 0' }}>{fmt(b.total)}</div>
                <div style={{ fontSize: 11, color: 'var(--secondary)' }}>{b.ativos} ativo(s)</div>
                <div style={{ fontSize: 11, color: 'var(--secondary)' }}>
                  {totalConsolidado > 0 ? ((b.total / totalConsolidado) * 100).toFixed(0) + '% da carteira' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Banco</th><th>De quem</th><th>Taxa</th><th>Vencimento</th><th>Rent./mês</th><th>Valor</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {investimentos.map(i => {
                const rent = i.rentabilidade || 0
                const subtipo = SUBTIPOS_RF.find(x => x[0] === i.subtipo)
                const flag = iconeBanco(i.moeda)
                return (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 500 }}>{i.nome}</td>
                    <td style={{ fontSize: 12 }}>{subtipo ? subtipo[1] : i.categoria}</td>
                    <td style={{ fontSize: 12 }}>
                      {i.banco_nome
                        ? <span>{flag} {i.banco_nome}</span>
                        : <span style={{ color: 'var(--secondary)' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${i.dono === 'eu' ? 'badge-blue' : i.dono === 'ela' ? 'badge-red' : 'badge-yellow'}`}>
                        {i.dono === 'eu' ? 'EU' : i.dono === 'ela' ? 'ELA' : 'Casal'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{i.taxa_contratada > 0 ? i.taxa_contratada + '%' : '—'}</td>
                    <td style={{ fontSize: 12 }}>{i.vencimento || '—'}</td>
                    <td style={{ color: rent >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                      {rent >= 0 ? '+' : ''}{rent.toFixed(2)}%
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {fmt(i.valor, i.moeda)}
                      {i.moeda === 'USD' && <div style={{ fontSize: 11, color: 'var(--secondary)' }}>≈ {fmt(toBRL(i.valor))}</div>}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openModal(i)}>✏️</button>
                        <button className="btn btn-sm" style={{ background: '#FCEBEB', color: 'var(--red)' }} onClick={() => excluir(i.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {investimentos.length === 0 && <div className="empty">Nenhum ativo de renda fixa cadastrado</div>}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar ativo' : '🏦 Novo ativo — Renda Fixa'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" placeholder="Ex: CDB Nubank, Tesouro Selic..." value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={subtipo} onChange={e => setSubtipo(e.target.value)}>
                    {SUBTIPOS_RF.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Moeda</label>
                  <select className="form-select" value={moeda} onChange={e => setMoeda(e.target.value)}>
                    <option value="BRL">🇧🇷 Real (BRL)</option>
                    <option value="USD">🇺🇸 Dólar (USD)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">De quem?</label>
                  <select className="form-select" value={dono} onChange={e => setDono(e.target.value)}>
                    <option value="eu">EU</option>
                    <option value="ela">ELA</option>
                    <option value="casal">Casal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor ({moeda})</label>
                  <input className="form-input" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Rentabilidade mês (%)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="Ex: 0.92" value={rent} onChange={e => setRent(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Taxa contratada (%)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="Ex: 110.5" value={taxa} onChange={e => setTaxa(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">🏦 Banco onde está aplicado</label>
                <select className="form-select" value={bancoId} onChange={e => { setBancoId(e.target.value); setBancoNome(bancos.find(b => b.id === e.target.value)?.banco || '') }}>
                  <option value="">Não vincular banco</option>
                  {bancos.map(b => <option key={b.id} value={b.id}>{iconeBanco(b.moeda)} {b.banco}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vencimento (opcional)</label>
                <input className="form-input" type="date" value={venc} onChange={e => setVenc(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : edit ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
