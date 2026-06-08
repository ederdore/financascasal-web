import { useState, useEffect } from 'react'
import { supabase, fmt, SUBTIPOS_RF } from '../supabase.js'

export default function RendaFixa({ session, profile }) {
  const [investimentos, setInvestimentos] = useState([])
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
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const cc = profile.casal_code
    const cf = q => cc ? q.eq('casal_code', cc) : q.eq('user_id', session.user.id)
    const { data } = await cf(supabase.from('investimentos').select('*')).order('created_at', { ascending: false })
    if (data) setInvestimentos(data)
    setLoading(false)
  }

  function openModal(i = null) {
    setEdit(i); setNome(i?.nome || ''); setSubtipo(i?.subtipo || 'cdb')
    setDono(i?.dono || profile.papel); setValor(i ? String(i.valor) : '')
    setRent(i ? String(i.rentabilidade || 0) : ''); setTaxa(i?.taxa_contratada ? String(i.taxa_contratada) : '')
    setVenc(i?.vencimento || ''); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault(); setSaving(true)
    const payload = { user_id: session.user.id, casal_code: profile.casal_code || session.user.id, nome, categoria: 'Renda Fixa', subtipo, dono, valor: parseFloat(valor), rentabilidade: parseFloat(rent) || 0, taxa_contratada: parseFloat(taxa) || 0, vencimento: venc || null, moeda: 'BRL' }
    try {
      if (edit) await supabase.from('investimentos').update(payload).eq('id', edit.id)
      else await supabase.from('investimentos').insert(payload)
      setModal(false); loadData()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir este ativo?')) return
    await supabase.from('investimentos').delete().eq('id', id); loadData()
  }

  const totalInv = investimentos.reduce((s, i) => s + i.valor, 0)
  const totalRent = investimentos.reduce((s, i) => s + (i.valor * (i.rentabilidade || 0) / 100), 0)

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="mini-card">
          <div className="lbl">Total investido</div>
          <div className="val" style={{ color: 'var(--green)' }}>{fmt(totalInv)}</div>
          <div className="sub">{investimentos.length} ativo(s)</div>
        </div>
        <div className="mini-card">
          <div className="lbl">Resultado do mês</div>
          <div className="val" style={{ color: totalRent >= 0 ? 'var(--green)' : 'var(--red)' }}>{totalRent >= 0 ? '+' : ''}{fmt(totalRent)}</div>
          <div className="sub">{totalInv > 0 ? ((totalRent / totalInv) * 100).toFixed(2) + '% mês' : '-'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => openModal()}>+ Novo ativo</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Tipo</th><th>De quem</th><th>Taxa contratada</th><th>Vencimento</th><th>Rent. mês</th><th>Valor</th><th>Ações</th></tr></thead>
            <tbody>
              {investimentos.map(i => {
                const rent = i.rentabilidade || 0
                const subtipo = SUBTIPOS_RF.find(x => x[0] === i.subtipo)
                return (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 500 }}>{i.nome}</td>
                    <td>{subtipo ? subtipo[1] : i.categoria}</td>
                    <td><span className={`badge ${i.dono === 'eu' ? 'badge-blue' : i.dono === 'ela' ? 'badge-red' : 'badge-yellow'}`}>{i.dono === 'eu' ? 'EU' : i.dono === 'ela' ? 'ELA' : 'Casal'}</span></td>
                    <td>{i.taxa_contratada > 0 ? i.taxa_contratada + '%' : '-'}</td>
                    <td>{i.vencimento || '-'}</td>
                    <td style={{ color: rent >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{rent >= 0 ? '+' : ''}{rent.toFixed(2)}%</td>
                    <td style={{ fontWeight: 600 }}>{fmt(i.valor)}</td>
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

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? '✏️ Editar ativo' : '🏦 Novo ativo — Renda Fixa'}</h3>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome</label><input className="form-input" placeholder="Ex: CDB Nubank, Tesouro Selic..." value={nome} onChange={e => setNome(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={subtipo} onChange={e => setSubtipo(e.target.value)}>{SUBTIPOS_RF.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="form-group"><label className="form-label">De quem?</label><select className="form-select" value={dono} onChange={e => setDono(e.target.value)}><option value="eu">EU</option><option value="ela">ELA</option><option value="casal">Casal</option></select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Valor (R$)</label><input className="form-input" type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Rentabilidade mês (%)</label><input className="form-input" type="number" step="0.01" placeholder="Ex: 0.92" value={rent} onChange={e => setRent(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Taxa contratada (%)</label><input className="form-input" type="number" step="0.01" placeholder="Ex: 110.5% CDI" value={taxa} onChange={e => setTaxa(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Vencimento</label><input className="form-input" placeholder="Ex: 01/2027" value={venc} onChange={e => setVenc(e.target.value)} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : edit ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
